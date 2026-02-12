import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
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

interface DocField {
  id: number;
  type: 'signature' | 'initials' | 'text' | 'date';
  x: number;
  y: number;
  value?: string; // For text fields
}

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule, ButtonModule, NgxExtendedPdfViewerModule, DragDropModule, FormsModule, DialogModule, TabsModule, InputTextModule],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
})

export class DocumentPreview implements OnInit {
  pdfSrc: any = null; // This will hold the PDF data
  zoom = '100%';
  isLoading = true;

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
        // convert pdf data to Uint8Array for the PDF viewer to read the file data
        this.pdfSrc = new Uint8Array(e.target.result);
        this.cdr.detectChanges(); // updates preview after loading pdf
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

  resetZoom() {
    this.zoom = '100%';
  }

  fields: DocField[] = [];

  // Reference to the main container so we can calculate relative coordinates
  @ViewChild('mainContainer') mainContainer!: ElementRef;

  onDragEnded(event: CdkDragEnd, type: 'signature' | 'date') {
    const element = event.source.getRootElement();
    const boundingClientRect = element.getBoundingClientRect();
    const parentPosition = this.mainContainer.nativeElement.getBoundingClientRect();

     // Get the current scroll amount
    const scrollOffset = this.mainContainer.nativeElement.scrollTop;

    // Calculate x/y relative to the PDF container
    const x = boundingClientRect.x - parentPosition.x;
    const y = (boundingClientRect.y - parentPosition.y) + scrollOffset; 

    // Add a new field to our array
    this.fields.push({
      id: Date.now(),
      type: type,
      x: x,
      y: y
    });
    console.log(`Added ${type} field at (${x}, ${y})`);
    event.source.reset(); // Reset the position of the dragged element
  }

  deleteField(index: number) {
    this.fields.splice(index, 1);
  }

  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  private signaturePadInstance!: SignaturePad;

  displaySignDialog: boolean = false;
  activeFieldId: number | null = null;
  typedSignature: string = '';

  openSignDialog(field: DocField) {
    if (field.type === 'signature') {
      this.activeFieldId = field.id;
      this.displaySignDialog = true;
      this.typedSignature = '';
    }
  }

  initSignaturePad() {
    // We use setTimeout to ensure the DOM is rendered inside the modal
    setTimeout(() => {
        if (this.signatureCanvas && !this.signaturePadInstance) {
            const canvas = this.signatureCanvas.nativeElement;
            
            // Handle High DPI screens (Retina displays) so ink isn't blurry
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d")!.scale(ratio, ratio);

            this.signaturePadInstance = new SignaturePad(canvas, {
                backgroundColor: 'rgba(255, 255, 255, 0)', // Transparent
                penColor: 'black'
            });
        } else if (this.signaturePadInstance) {
            this.signaturePadInstance.clear(); // Reset if reopening
        }
    }, 100);
  }

  // 5. UPDATE: Apply Drawing logic
  applyDrawing() {
    if (this.activeFieldId && this.signaturePadInstance && !this.signaturePadInstance.isEmpty()) {
      // Get image from the instance
      const base64Data = this.signaturePadInstance.toDataURL(); 
      this.updateField(base64Data);
    }
  }

  updateField(value: string) {
    const index = this.fields.findIndex(f => f.id === this.activeFieldId);
    if (index !== -1) {
      this.fields[index].value = value;
    }
    this.displaySignDialog = false;
  }

  applyTyping() {
    if (this.activeFieldId && this.typedSignature) {
      this.updateField(this.typedSignature);
    }
  }

  clearPad() {
    if (this.signaturePadInstance) {
        this.signaturePadInstance.clear();
    }
  }

}