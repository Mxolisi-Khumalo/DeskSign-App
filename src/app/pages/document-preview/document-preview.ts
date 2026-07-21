import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import SignaturePad from 'signature_pad';

import { DocumentService } from '../../services/document';
import { PageGeometry, PdfSigningService } from '../../services/pdf-signing';
import { FIELD_HEIGHT, FIELD_WIDTH, FieldType, SignatureField } from '../../models/signature-field';

type DialogMode = 'signature' | 'initials';
type FieldStyle = Record<string, string>;

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

@Component({
  selector: 'app-document-preview',
  standalone: true,
  imports: [
    ButtonModule,
    NgxExtendedPdfViewerModule,
    DragDropModule,
    FormsModule,
    DialogModule,
    TabsModule,
    InputTextModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
})
export class DocumentPreview implements AfterViewInit {
  private readonly documentService = inject(DocumentService);
  private readonly signingService = inject(PdfSigningService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly mainContainer = viewChild.required<ElementRef<HTMLElement>>('mainContainer');
  private readonly signatureCanvas = viewChild<ElementRef<HTMLCanvasElement>>('signatureCanvas');

  // ---- Reactive state -----------------------------------------------------
  readonly pdfSrc = signal<Uint8Array | null>(null);
  readonly isLoading = signal(true);
  readonly isDragging = signal(false);
  readonly zoom = signal(100);
  readonly zoomLabel = computed(() => `${this.zoom()}%`);
  readonly fields = signal<SignatureField[]>([]);

  readonly displaySignDialog = signal(false);
  readonly dialogMode = signal<DialogMode>('signature');
  typedSignature = '';
  initialsText = '';

  readonly fieldWidth = FIELD_WIDTH;
  readonly fieldHeight = FIELD_HEIGHT;

  /** Sidebar tools available to drag onto the document. */
  readonly tools: readonly {
    type: FieldType;
    label: string;
    icon: string;
    color: string;
    borderColor: string;
  }[] = [
    {
      type: 'signature',
      label: 'Signature',
      icon: 'pi-pencil',
      color: 'text-blue-500',
      borderColor: 'border-blue-500',
    },
    {
      type: 'initials',
      label: 'Initials',
      icon: 'pi-verified',
      color: 'text-purple-500',
      borderColor: 'border-purple-500',
    },
    {
      type: 'text',
      label: 'Text',
      icon: 'pi-align-left',
      color: 'text-green-500',
      borderColor: 'border-green-500',
    },
    {
      type: 'date',
      label: 'Date Signed',
      icon: 'pi-calendar',
      color: 'text-orange-500',
      borderColor: 'border-orange-500',
    },
  ];

  private originalPdfBytes: Uint8Array | null = null;
  private activeFieldId: number | null = null;
  private signaturePadInstance: SignaturePad | null = null;
  private readonly pagePositionCache = new Map<number, { top: number; left: number }>();

  constructor() {
    const file = this.documentService.getFile();
    if (!file) {
      this.router.navigate(['/']);
      return;
    }
    file
      .arrayBuffer()
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        // Keep an independent copy for signing: the PDF viewer passes its bytes
        // to a pdf.js worker, which transfers (detaches) the ArrayBuffer. A
        // shared view would become empty and break signing at "Finish".
        this.originalPdfBytes = bytes.slice();
        this.pdfSrc.set(bytes);
      })
      .catch(() => this.showError('Could not read the selected document.'));
  }

  // ---- Lifecycle ----------------------------------------------------------
  ngAfterViewInit(): void {
    this.attachScrollListener();
    this.destroyRef.onDestroy(() => this.signaturePadInstance?.off());
  }

  private attachScrollListener(): void {
    let cancelled = false;
    const tryAttach = (): void => {
      if (cancelled) return;
      const viewerContainer = document.querySelector('#viewerContainer');
      if (viewerContainer) {
        const handler = (): void => this.cdr.detectChanges();
        viewerContainer.addEventListener('scroll', handler, { passive: true });
        this.destroyRef.onDestroy(() => viewerContainer.removeEventListener('scroll', handler));
      } else {
        setTimeout(tryAttach, 300);
      }
    };
    this.destroyRef.onDestroy(() => (cancelled = true));
    tryAttach();
  }

  // ---- Viewer + zoom ------------------------------------------------------
  onPdfLoaded(): void {
    this.isLoading.set(false);
    this.cdr.detectChanges();
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - ZOOM_STEP);
  }

  private setZoom(value: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    if (clamped === this.zoom()) return;
    this.zoom.set(clamped);
    this.pagePositionCache.clear();
    this.cdr.detectChanges();
  }

  // ---- Field placement ----------------------------------------------------
  onDragEnded(event: CdkDragEnd, type: FieldType, fieldId?: number): void {
    const { x, y } = event.dropPoint;
    const pageElement = document
      .elementsFromPoint(x, y)
      .find((el): el is HTMLElement => el.classList.contains('page'));

    if (!pageElement) {
      event.source.reset();
      this.isDragging.set(false);
      return;
    }

    const pageNumber = Number(pageElement.getAttribute('data-page-number') ?? '1');
    const pageRect = pageElement.getBoundingClientRect();
    const relativeX = x - pageRect.left;
    const relativeY = y - pageRect.top;

    if (fieldId != null) {
      this.moveField(fieldId, relativeX, relativeY, pageNumber, pageRect);
    } else {
      this.addField(type, relativeX, relativeY, pageNumber);
    }

    event.source.reset();
    setTimeout(() => {
      this.isDragging.set(false);
      this.cdr.detectChanges();
    }, 100);
  }

  private moveField(fieldId: number, x: number, y: number, page: number, pageRect: DOMRect): void {
    this.fields.update((fields) =>
      fields.map((f) => (f.id === fieldId ? { ...f, x, y, page } : f)),
    );
    const containerRect = this.mainContainer().nativeElement.getBoundingClientRect();
    this.pagePositionCache.set(page, {
      top: pageRect.top - containerRect.top,
      left: pageRect.left - containerRect.left,
    });
  }

  private addField(type: FieldType, x: number, y: number, page: number): void {
    const value = type === 'date' ? new Date().toISOString().split('T')[0] : '';
    this.fields.update((fields) => [...fields, { id: Date.now(), type, x, y, page, value }]);
  }

  deleteField(id: number): void {
    this.fields.update((fields) => fields.filter((f) => f.id !== id));
  }

  /** Updates a field's value while preserving referential change for the signal. */
  setFieldValue(id: number, value: string): void {
    this.fields.update((fields) => fields.map((f) => (f.id === id ? { ...f, value } : f)));
  }

  getFieldStyle(field: SignatureField): FieldStyle {
    const base: FieldStyle = {
      width: `${FIELD_WIDTH}px`,
      height: `${FIELD_HEIGHT}px`,
      position: 'absolute',
    };
    const pageElement = document.querySelector(
      `.page[data-page-number="${field.page}"]`,
    ) as HTMLElement | null;

    if (!pageElement) {
      const cached = this.pagePositionCache.get(field.page);
      if (cached) {
        return { ...base, top: `${cached.top + field.y}px`, left: `${cached.left + field.x}px` };
      }
      return { display: 'none' };
    }

    const containerRect = this.mainContainer().nativeElement.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    const offsetTop = pageRect.top - containerRect.top;
    const offsetLeft = pageRect.left - containerRect.left;
    this.pagePositionCache.set(field.page, { top: offsetTop, left: offsetLeft });

    return {
      ...base,
      top: `${offsetTop + field.y}px`,
      left: `${offsetLeft + field.x}px`,
    };
  }

  isImage(value: string | undefined): boolean {
    return !!value && value.startsWith('data:image');
  }

  fieldClasses(field: SignatureField): string {
    if (field.type === 'text') return 'bg-transparent border-transparent hover:border-blue-400';
    if (field.value) return 'bg-transparent border-transparent';
    return 'bg-yellow-100 border-yellow-400 border-dashed';
  }

  // ---- Signing dialog -----------------------------------------------------
  openSignDialog(field: SignatureField): void {
    if (this.isDragging()) return;
    if (field.type !== 'signature' && field.type !== 'initials') return;

    this.activeFieldId = field.id;
    this.dialogMode.set(field.type);
    this.typedSignature = '';
    this.initialsText = '';
    this.displaySignDialog.set(true);
  }

  updateInitialsPreview(): void {
    const matches = this.initialsText.match(/\b(\w)/g);
    this.typedSignature = matches ? matches.join('').toUpperCase() : '';
  }

  initSignaturePad(): void {
    requestAnimationFrame(() => {
      const canvasRef = this.signatureCanvas();
      if (!canvasRef) return;
      const canvas = canvasRef.nativeElement;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      this.signaturePadInstance = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'black',
      });
    });
  }

  clearPad(): void {
    this.signaturePadInstance?.clear();
  }

  applyDrawing(): void {
    if (this.activeFieldId == null) return;
    if (this.signaturePadInstance && !this.signaturePadInstance.isEmpty()) {
      this.applyValue(this.signaturePadInstance.toDataURL());
    }
  }

  applyTyping(): void {
    if (this.activeFieldId != null && this.typedSignature) {
      this.applyValue(this.typedSignature);
    }
  }

  private applyValue(value: string): void {
    if (this.activeFieldId != null) {
      this.setFieldValue(this.activeFieldId, value);
    }
    this.signaturePadInstance = null;
    this.displaySignDialog.set(false);
  }

  // ---- Finish / export ----------------------------------------------------
  async finishSigning(): Promise<void> {
    if (!this.originalPdfBytes) return;

    const fields = this.fields();
    if (!fields.some((f) => f.value)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nothing to sign',
        detail: 'Add and fill at least one field before finishing.',
      });
      return;
    }

    this.isLoading.set(true);
    try {
      const geometry = this.collectPageGeometry(fields);
      const signed = await this.signingService.sign(this.originalPdfBytes, fields, geometry);
      this.triggerDownload(signed, 'signed_document.pdf');
      this.messageService.add({
        severity: 'success',
        summary: 'Document signed',
        detail: 'Your signed PDF has been downloaded.',
      });
    } catch (error) {
      console.error('Failed to sign document', error);
      this.showError('Something went wrong while creating the PDF.');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  private collectPageGeometry(fields: readonly SignatureField[]): Map<number, PageGeometry> {
    const geometry = new Map<number, PageGeometry>();
    const fallback = document.querySelector('.page') as HTMLElement | null;
    for (const page of new Set(fields.map((f) => f.page))) {
      const el =
        (document.querySelector(`.page[data-page-number="${page}"]`) as HTMLElement | null) ??
        fallback;
      if (el) geometry.set(page, { renderedWidth: el.clientWidth });
    }
    return geometry;
  }

  private triggerDownload(data: Uint8Array, filename: string): void {
    const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }
}
