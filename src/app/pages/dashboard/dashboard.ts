import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DocumentUpload } from "../../components/document-upload/document-upload";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ButtonModule, DocumentUpload],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

}
