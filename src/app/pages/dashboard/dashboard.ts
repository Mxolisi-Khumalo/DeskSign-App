import { Component } from '@angular/core';

import { DocumentUpload } from '../../components/document-upload/document-upload';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DocumentUpload],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
