import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  // We use a Signal to hold the file. 
  // This allows any component to reactively update if the file changes.
  private currentFile = signal<File | null>(null);

  constructor() { }

  setFile(file: File) {
    this.currentFile.set(file);
  }

  getFile() {
    return this.currentFile();
  }
}