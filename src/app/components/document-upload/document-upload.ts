import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FileUploadHandlerEvent, FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { DocumentService } from '../../services/document';

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [FileUploadModule, ToastModule],
  providers: [MessageService],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css',
})
export class DocumentUpload {
  private readonly messageService = inject(MessageService);
  private readonly documentService = inject(DocumentService);
  private readonly router = inject(Router);

  /** Called by the FileUpload custom upload handler with the chosen file. */
  handleUpload(event: FileUploadHandlerEvent): void {
    const file = event.files?.[0];
    if (!file) {
      this.messageService.add({
        severity: 'error',
        summary: 'No file',
        detail: 'Please choose a PDF to continue.',
      });
      return;
    }

    this.documentService.setFile(file);
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'File uploaded, opening preview…',
    });

    setTimeout(() => this.router.navigate(['/preview']), 800);
  }
}
