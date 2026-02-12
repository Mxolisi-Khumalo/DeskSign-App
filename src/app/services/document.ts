import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private currentFile = signal<File | null>(null);

  constructor() { }

  setFile(file: File) {
    this.currentFile.set(file);
  }

  getFile() {
    return this.currentFile();
  }
}