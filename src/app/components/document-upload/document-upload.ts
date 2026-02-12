import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DocumentService } from '../../services/document';
import { Router } from '@angular/router';

interface UploadedFile {
  name: string;
  size: number;
  url: string;
}

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [CommonModule, FileUploadModule, ToastModule],
  providers: [MessageService],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.css'
})
export class DocumentUpload {
  uploadedFiles: any[] = [];
  
  constructor(private messageService: MessageService
    , private documentService: DocumentService
    , private router: Router
  ) {}

  onUpload(event: any) {
    this.uploadedFiles = event.currentFiles;
    for(let file of event.files) {
        this.messageService.add({severity: 'info', summary: 'File Uploaded', detail: file.name + 'Ready to upload.'});
    }
  }

  customUpload(event: any) {
     const file = event.files[0];
     this.documentService.setFile(file); 
     this.messageService.add({severity: 'success', summary: 'Success', detail: 'File uploaded, opening preview...'});

      setTimeout(() => {
        this.router.navigate(['/preview']);
      }, 1500);
     
     console.log("File captured:", file);
  }
}