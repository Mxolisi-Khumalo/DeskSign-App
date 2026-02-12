import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { ButtonModule } from 'primeng/button';
import { DocumentService } from '../../services/document';
import { DragDropModule, CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog'; 
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import SignaturePad from 'signature_pad';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface DocField {
  id: number;
  type: 'signature' | 'initials' | 'text' | 'date';
  x: number; // Relative to the PDF PAGE, not the container
  y: number; // Relative to the PDF PAGE
  page: number; // The page number this field belongs to
  value?: string; 
}

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule, ButtonModule, NgxExtendedPdfViewerModule, DragDropModule, FormsModule, DialogModule, TabsModule, InputTextModule],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
})

export class DocumentPreview implements OnInit {
  pdfSrc: any = null; 
  private originalPdfBytes: Uint8Array | null = null;
  zoom = '100%';
  isLoading = true;
  isDragging = false;

  fields: DocField[] = [];

  @ViewChild('mainContainer') mainContainer!: ElementRef;
  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  
  private signaturePadInstance!: SignaturePad;

  displaySignDialog: boolean = false;
  activeFieldId: number | null = null;
  typedSignature: string = '';

  constructor(
    private documentService: DocumentService, 
    private router: Router,
    private cdr: ChangeDetectorRef
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

  onPdfLoaded() {
    console.log("PDF loaded successfully");
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  zoomIn() {
    let currentZoom = parseInt(this.zoom);
    if (currentZoom < 200) {
      currentZoom += 10;
      this.zoom = currentZoom + '%';
    }
  }

  zoomOut() {
    let currentZoom = parseInt(this.zoom);
    if (currentZoom > 50) {
      currentZoom -= 10;
      this.zoom = currentZoom + '%';
    }
  }

  onDragStart() {
    this.isDragging = true;
  }

  /**
   * CRITICAL FIX: Coordinate Calculation
   * We calculate coordinates relative to the specific PDF Page element in the DOM.
   */
  onDragEnded(event: CdkDragEnd, type: 'signature' | 'date') {
    const dropPoint = event.dropPoint; // Screen coordinates {x, y}

    // 1. Find the specific PDF page element under the mouse
    // ngx-extended-pdf-viewer renders pages with class 'page' and data-page-number
    const elements = document.elementsFromPoint(dropPoint.x, dropPoint.y);
    const pageElement = elements.find(el => el.classList.contains('page')) as HTMLElement;

    if (!pageElement) {
      console.warn("Dropped outside of a PDF page");
      event.source.reset();
      this.isDragging = false;
      return;
    }

    // 2. Get the Page Number and Dimensions
    const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1');
    const pageRect = pageElement.getBoundingClientRect();

    // 3. Calculate X/Y relative to that specific page
    // This solves the "Scrolling" and "Floating" issue because we save the position relative to the page itself.
    const relativeX = dropPoint.x - pageRect.left;
    const relativeY = dropPoint.y - pageRect.top;

    this.fields.push({
      id: Date.now(),
      type: type,
      x: relativeX,
      y: relativeY,
      page: pageNumber,
      value: ''
    });
    
    event.source.reset(); 
    
    setTimeout(() => {
        this.isDragging = false;
    }, 100);
  }

  /**
   * Helper to get the absolute style for the UI overlay
   * This places the field correctly on top of the correct page
   */
  getFieldStyle(field: DocField) {
    // We need to find the current location of the page in the DOM
    const pageElement = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
    
    if (!pageElement) return { display: 'none' };

    // Since our #mainContainer is 'relative', we need to calculate the position relative to it
    // Or simpler: We can rely on the fact that if the overlay is absolute inside mainContainer,
    // we just need the offset of the page relative to the mainContainer.
    
    // However, the cleanest UI fix for "floating" is to force a re-render or check positions.
    // A simplified approach for the UI Preview:
    // We add the Page's OffsetTop to the Field's Y
    
    const containerRect = this.mainContainer.nativeElement.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    
    // Offset of the page relative to the container
    const pageOffsetX = pageRect.left - containerRect.left + this.mainContainer.nativeElement.scrollLeft;
    const pageOffsetY = pageRect.top - containerRect.top + this.mainContainer.nativeElement.scrollTop;

    return {
        top: `${pageOffsetY + field.y}px`,
        left: `${pageOffsetX + field.x}px`,
        width: '200px',
        height: '60px',
        position: 'absolute'
    };
  }

  deleteField(index: number) {
    this.fields.splice(index, 1);
  }

  openSignDialog(field: DocField) {
    if (!this.isDragging && field.type === 'signature') {
      this.activeFieldId = field.id;
      this.displaySignDialog = true;
      this.typedSignature = '';
    }
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

        // 1. Load Font (Fixing the 404 and Font format error)
        let customFont;
        try {
            const fontBytes = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf').then(res => res.arrayBuffer());
            customFont = await pdfDoc.embedFont(fontBytes);
        } catch (e) {
            console.warn('Fallback to standard font');
            customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        }

        const pages = pdfDoc.getPages();

        for (const field of this.fields) {
            if (!field.value) continue;

            const pdfPage = pages[field.page - 1]; // Pages are 0-indexed in pdf-lib
            if (!pdfPage) continue;

            const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();

            // 2. Get the DOM Element for this specific page to calculate scale
            const pageDomElement = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
            if (!pageDomElement) continue;

            const renderedWidth = pageDomElement.clientWidth; // Width on screen (px)
            const scaleFactor = pdfWidth / renderedWidth; // Conversion ratio

            // 3. Convert Coordinates
            // HTML: (0,0) is Top-Left. PDF: (0,0) is Bottom-Left.
            // We use the field.x/y which we stored relative to the page top-left.
            const pdfX = field.x * scaleFactor;
            const pdfY = pdfHeight - (field.y * scaleFactor) - (60 * scaleFactor); // Subtract height of field

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
                // Text / Date
                const textValue = field.value || (field.type === 'date' ? new Date().toISOString().split('T')[0] : '');
                
                if(textValue) {
                  pdfPage.drawText(textValue, {
                      x: pdfX + (10 * scaleFactor),
                      y: pdfY + (15 * scaleFactor), // Adjust baseline
                      size: 24 * scaleFactor,
                      font: customFont, // <--- CRITICAL: Pass the font here
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