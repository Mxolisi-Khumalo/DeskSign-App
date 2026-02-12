import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DocumentService } from '../../services/document';
import { Router } from '@angular/router';

// Create a simple interface for our file data
interface UploadedFile {
  name: string;
  size: number;
  url: string;
}

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [CommonModule, FileUploadModule, ToastModule],
  providers: [MessageService], // Required for Toast to work
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css'
})
export class DocumentUpload {
  uploadedFiles: any[] = []; // This will hold the uploaded file data
  
  constructor(private messageService: MessageService
    , private documentService: DocumentService
    , private router: Router
  ) {}

  // Function to handle the file selection
  onUpload(event: any) {
    this.uploadedFiles = event.currentFiles;
    for(let file of event.files) {
        this.messageService.add({severity: 'info', summary: 'File Uploaded', detail: file.name + 'Ready to upload.'});
    }
  }

  customUpload(event: any) {
     const file = event.files[0];
     this.documentService.setFile(file); // Store the file in our service for access in the preview page
     this.messageService.add({severity: 'success', summary: 'Success', detail: 'File uploaded, opening preview...'});

      // Navigate to the preview page after a short delay to show the toast message
      setTimeout(() => {
        this.router.navigate(['/preview']);
      }, 1500);
     
     // TODO: This is where we will eventually add logic to send to backend
     console.log("File captured:", file);
  }
}