import { Injectable, signal } from '@angular/core';

/** Holds the document selected on the dashboard for the preview page to consume. */
@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly currentFile = signal<File | null>(null);

  /** Readonly signal of the currently selected file. */
  readonly file = this.currentFile.asReadonly();

  setFile(file: File): void {
    this.currentFile.set(file);
  }

  getFile(): File | null {
    return this.currentFile();
  }

  clear(): void {
    this.currentFile.set(null);
  }
}
