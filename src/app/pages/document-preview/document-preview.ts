import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PdfViewerModule } from 'ng2-pdf-viewer'; // Import the PDF module
import { ButtonModule } from 'primeng/button';
import { DocumentService } from '../../services/document';

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [CommonModule, PdfViewerModule, ButtonModule],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
})
export class DocumentPreview implements OnInit {
  pdfSrc: any = null; // This will hold the PDF data
  zoom = 1.0;
  isLoading = true;

  constructor(private documentService: DocumentService, private router: Router) {}

  ngOnInit() {
    // Example of using the service to get the uploaded file
    const file = this.documentService.getFile();

    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        // We use Uint8Array which works robustly with ng2-pdf-viewer
        this.pdfSrc = new Uint8Array(e.target.result);
        this.isLoading = false;
        console.log("PDF Data loaded");
      };
      reader.readAsArrayBuffer(file);
    } else {
      console.error("No file found in service");
      this.router.navigate(['/']);
    }
  }

  zoomIn() {this.zoom += 0.1;}

  zoomOut() { if (this.zoom > 0.5) { this.zoom -= 0.1;} }

  resetZoom() { this.zoom = 1.0;}
}