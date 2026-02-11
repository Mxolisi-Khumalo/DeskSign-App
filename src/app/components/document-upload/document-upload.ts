import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

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
  uploadedFiles: any;
  
  constructor(private messageService: MessageService) {}

  // Function to handle the file selection
  onUpload(event: any) {
    // In a real backend, the upload is handled automatically by the URL property of the component,
    // but here we capture it client-side to simulate the process.
    
    for(let file of event.files) {
        this.messageService.add({severity: 'success', summary: 'File Uploaded', detail: file.name + ' ready for signing.'});
    }
  }

  // Custom function if we want to bypass PrimeNG's auto upload and do it manually
  customUpload(event: any) {
     const file = event.files[0];
     this.messageService.add({severity: 'info', summary: 'Processing', detail: `Preparing ${file.name}...`});
     
     // TODO: This is where we will eventually add logic to send to backend
     console.log("File captured:", file);
  }
}