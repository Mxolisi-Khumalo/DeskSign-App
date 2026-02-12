import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, NgZone, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { ButtonModule } from 'primeng/button';
import { DocumentService } from '../../services/document';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog'; 
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface DocField {
  id: number;
  type: 'signature' | 'initials' | 'text' | 'date';
  x: number; 
  y: number; 
  page: number; 
  value?: string; 
}

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule, ButtonModule, NgxExtendedPdfViewerModule, DragDropModule, FormsModule, DialogModule, TabsModule, InputTextModule],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
})

export class DocumentPreview implements OnInit, AfterViewInit, OnDestroy {
  pdfSrc: any = null; 
  private originalPdfBytes: Uint8Array | null = null;
  private scrollListener: (() => void) | null = null;
  zoom = '100%';
  isLoading = true;
  isDragging = false;
  dialogMode: 'signature' | 'initials' = 'signature';
  initialsText: string = ''; 
  
  fields: DocField[] = [];
  
  private pagePositionCache: { [page: number]: { top: number, left: number } } = {};

  @ViewChild('mainContainer') mainContainer!: ElementRef;
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  
  private signaturePadInstance!: SignaturePad;

  displaySignDialog: boolean = false;
  activeFieldId: number | null = null;
  typedSignature: string = '';

  constructor(
    private documentService: DocumentService, 
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone 
  ) {}

  ngOnInit() {
    const file = this.documentService.getFile();
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.pdfSrc = new Uint8Array(e.target.result);
        this.originalPdfBytes = new Uint8Array(e.target.result).slice();
        this.cdr.detectChanges(); 
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.router.navigate(['/']);
    }
  }

  ngAfterViewInit() {
    this.attachScrollListener();
  }

  private attachScrollListener() {
    const tryAttach = () => {
      const viewerContainer = document.querySelector('#viewerContainer');
      
      if (viewerContainer) {
        const handler = () => this.onContainerScroll();
        viewerContainer.addEventListener('scroll', handler);
        
        this.scrollListener = () => viewerContainer.removeEventListener('scroll', handler);
        console.log("Scroll listener attached to PDF Viewer");
      } else {
        setTimeout(tryAttach, 500);
      }
    };
    tryAttach();
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      this.scrollListener();
    }
  }

  

  onPdfLoaded() {
    console.log("PDF loaded successfully");
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  onContainerScroll() {
    this.cdr.detectChanges();
  }

  zoomIn() {
    this.updateZoom(10);
  }

  zoomOut() {
    this.updateZoom(-10);
  }

  private updateZoom(delta: number) {
    let currentZoom = parseInt(this.zoom);
    const newZoom = currentZoom + delta;
    if (newZoom >= 50 && newZoom <= 200) {
      this.zoom = newZoom + '%';
      this.pagePositionCache = {}; 
      this.cdr.detectChanges();
    }
  }

  onDragStart() {
    this.isDragging = true;
  }

  onDragEnded(event: CdkDragEnd, type: string, fieldId?: number) {
    const dropPoint = event.dropPoint; 

    // 1. Find the specific PDF page element under the mouse
    const elements = document.elementsFromPoint(dropPoint.x, dropPoint.y);
    const pageElement = elements.find(el => el.classList.contains('page')) as HTMLElement;

    if (!pageElement) {
      event.source.reset();
      this.isDragging = false;
      return;
    }

    const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1');
    const pageRect = pageElement.getBoundingClientRect();
    // 2. Calculate relative coordinates
    const relativeX = dropPoint.x - pageRect.left;
    const relativeY = dropPoint.y - pageRect.top;

    // 3. LOGIC SPLIT: Update Existing OR Create New
    if (fieldId) {
        // --- MOVE EXISTING FIELD ---
        const fieldIndex = this.fields.findIndex(f => f.id === fieldId);
        if (fieldIndex !== -1) {
            this.fields[fieldIndex].x = relativeX;
            this.fields[fieldIndex].y = relativeY;
            this.fields[fieldIndex].page = pageNumber;
            
            // Force cache update since we moved it
            // This prevents the "flash" of the old position
            this.pagePositionCache[pageNumber] = { 
                top: pageRect.top - this.mainContainer.nativeElement.getBoundingClientRect().top,
                left: pageRect.left - this.mainContainer.nativeElement.getBoundingClientRect().left
            };
        }
    } else {
        // --- CREATE NEW FIELD (From Sidebar) ---
        // We cast 'type' because HTML passes string, but interface expects specific union
        const fieldType = type as 'signature' | 'initials' | 'text' | 'date';
        
        // AUTO-FILL DATE LOGIC
        let initialValue = '';
        if (fieldType === 'date') {
            initialValue = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        }

        this.fields.push({
          id: Date.now(),
          type: fieldType,
          x: relativeX,
          y: relativeY,
          page: pageNumber,
          value: initialValue 
        });
    }
    
    event.source.reset(); 
    setTimeout(() => {
        this.isDragging = false;
        this.cdr.detectChanges();
    }, 100);
  }

  getFieldStyle(field: DocField) {
    const pageElement = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
    
    if (!pageElement) {
       const cached = this.pagePositionCache[field.page];
       if (cached) {
           return {
               top: `${cached.top + field.y}px`,
               left: `${cached.left + field.x}px`,
               width: '200px',
               height: '60px',
               position: 'absolute'
           };
       }
       return { display: 'none' };
    }

    const containerRect = this.mainContainer.nativeElement.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    
    const offsetTop = pageRect.top - containerRect.top;
    const offsetLeft = pageRect.left - containerRect.left;

    this.pagePositionCache[field.page] = { top: offsetTop, left: offsetLeft };

    return {
        top: `${offsetTop + field.y}px`,
        left: `${offsetLeft + field.x}px`,
        width: '200px',
        height: '60px',
        position: 'absolute'
    };
  }

  deleteField(index: number) { this.fields.splice(index, 1); }

  openSignDialog(field: DocField) {
    if (this.isDragging) return;

    if (field.type === 'signature') {
      this.activeFieldId = field.id;
      this.dialogMode = 'signature';
      this.typedSignature = '';
      this.displaySignDialog = true;
    } 
    else if (field.type === 'initials') {
      this.activeFieldId = field.id;
      this.dialogMode = 'initials';
      this.initialsText = ''; 
      this.typedSignature = '';
      this.displaySignDialog = true;
    }
  }

  updateInitialsPreview() {
    if (!this.initialsText) {
        this.typedSignature = '';
        return;
    }
    const matches = this.initialsText.match(/\b(\w)/g); 
    this.typedSignature = matches ? matches.join('').toUpperCase() : '';
  }

  initSignaturePad() {
    setTimeout(() => {
        if (this.signatureCanvas && !this.signaturePadInstance) {
            const canvas = this.signatureCanvas.nativeElement;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d")!.scale(ratio, ratio);
            this.signaturePadInstance = new SignaturePad(canvas, { backgroundColor: 'rgba(255, 255, 255, 0)', penColor: 'black' });
        } else if (this.signaturePadInstance) {
            this.signaturePadInstance.clear(); 
        }
    }, 100);
  }

  applyDrawing() {
    if (this.activeFieldId && this.signaturePadInstance && !this.signaturePadInstance.isEmpty()) {
      this.updateField(this.signaturePadInstance.toDataURL());
    }
  }

  updateField(value: string) {
    const index = this.fields.findIndex(f => f.id === this.activeFieldId);
    if (index !== -1) this.fields[index].value = value;
    this.displaySignDialog = false;
  }

  applyTyping() {
    if (this.activeFieldId && this.typedSignature) {
      this.updateField(this.typedSignature);
    }
  }

  clearPad() {
    if (this.signaturePadInstance) this.signaturePadInstance.clear();
  }

  async finishSigning() {
    if (!this.originalPdfBytes) return;
    this.isLoading = true;

    try {
        const pdfDoc = await PDFDocument.load(this.originalPdfBytes);
        pdfDoc.registerFontkit(await import('@pdf-lib/fontkit').then(m => m.default));

        let cursiveFont;
        try {
            const fontBytes = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf').then(res => res.arrayBuffer());
            cursiveFont = await pdfDoc.embedFont(fontBytes);
        } catch (e) {
            cursiveFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }

        const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();

        for (const field of this.fields) {
            if (!field.value) continue;

            const pdfPage = pages[field.page - 1]; 
            if (!pdfPage) continue;

            const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
            
            const pageDomElement = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
            const activePageEl = pageDomElement || document.querySelector('.page');
            if (!activePageEl) continue;

            const renderedWidth = (activePageEl as HTMLElement).clientWidth; 
            const scaleFactor = pdfWidth / renderedWidth; 

            const pdfX = field.x * scaleFactor;
            const pdfY = pdfHeight - (field.y * scaleFactor) - (60 * scaleFactor); 

            if (field.type === 'signature' && field.value.startsWith('data:image')) {
                const pngImage = await pdfDoc.embedPng(field.value);
                pdfPage.drawImage(pngImage, {
                    x: pdfX,
                    y: pdfY,
                    width: 200 * scaleFactor, 
                    height: 60 * scaleFactor  
                });
            } 
            else {
                const textValue = field.value || (field.type === 'date' ? new Date().toISOString().split('T')[0] : '');
                
                if(textValue) {
                  const fontToUse = (field.type === 'text' || field.type === 'date') ? standardFont : cursiveFont;
                  const fontSize = (field.type === 'text' || field.type === 'date') ? 12 : 24;
                  const yOffset = (field.type === 'text' || field.type === 'date') ? 35 : 15; // Standard text needs different alignment

                  pdfPage.drawText(textValue, {
                      x: pdfX + (10 * scaleFactor),
                      y: pdfY + (yOffset * scaleFactor), 
                      size: fontSize * scaleFactor,
                      font: fontToUse, 
                      color: rgb(0, 0, 0),
                  });
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        this.triggerDownload(pdfBytes, 'signed_document.pdf');

    } catch (error) {
        console.error("Error signing:", error);
        alert("Error creating PDF.");
    } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
    }
  }

  triggerDownload(data: Uint8Array, filename: string) {
    const blob = new Blob([data as any], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}