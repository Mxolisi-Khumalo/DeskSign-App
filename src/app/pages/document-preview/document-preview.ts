import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { ButtonModule } from 'primeng/button';
import { DocumentService } from '../../services/document';

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule, ButtonModule, NgxExtendedPdfViewerModule],
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

}