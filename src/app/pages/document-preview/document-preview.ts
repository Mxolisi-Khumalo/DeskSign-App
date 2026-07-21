import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgxExtendedPdfViewerModule, PagesLoadedEvent } from 'ngx-extended-pdf-viewer';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import SignaturePad from 'signature_pad';

import { DocumentService } from '../../services/document';
import { PdfSigningService, SignResult } from '../../services/pdf-signing';
import {
  FIELD_META,
  FIELD_TYPES,
  FieldType,
  MIN_FIELD_NORM,
  SignatureField,
  isTextInput,
} from '../../models/signature-field';

type DialogTab = 'draw' | 'type' | 'upload';
type FieldStyle = Record<string, string>;

interface SavedState {
  fields: SignatureField[];
  signerName: string;
  signerEmail: string;
}

const STORAGE_PREFIX = 'desksign:v2:';
const HISTORY_LIMIT = 50;

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
    TooltipModule,
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

  readonly fieldTypes = FIELD_TYPES;
  readonly fieldMeta = FIELD_META;

  // ---- Document + viewer state -------------------------------------------
  readonly pdfSrc = signal<Uint8Array | null>(null);
  readonly isLoading = signal(true);
  readonly fileName = signal('document.pdf');
  readonly totalPages = signal(1);
  readonly currentPage = signal(1);
  readonly zoom = signal<string>('page-width');
  readonly sidebarVisible = signal(false);
  readonly darkMode = signal(false);

  readonly zoomText = computed(() => {
    const z = this.zoom();
    return z.endsWith('%') ? z : 'Fit';
  });

  // ---- Fields + history --------------------------------------------------
  readonly fields = signal<SignatureField[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly highlightedId = signal<number | null>(null);
  private past: SignatureField[][] = [];
  private future: SignatureField[][] = [];
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  readonly requiredTotal = computed(() => this.fields().filter((f) => f.required).length);
  readonly requiredDone = computed(
    () => this.fields().filter((f) => f.required && this.isFilled(f)).length,
  );
  readonly allRequiredDone = computed(() => this.requiredDone() === this.requiredTotal());

  // ---- Signer identity ---------------------------------------------------
  signerName = '';
  signerEmail = '';

  // ---- Signing dialog ----------------------------------------------------
  readonly showSignDialog = signal(false);
  readonly dialogTab = signal<DialogTab>('draw');
  readonly dialogField = signal<SignatureField | null>(null);
  typedValue = '';
  private signaturePad: SignaturePad | null = null;
  readonly adoptedSignature = signal<string | null>(null);
  readonly adoptedInitials = signal<string | null>(null);

  // ---- Completion summary ------------------------------------------------
  readonly showSummary = signal(false);
  private lastSigned: SignResult | null = null;
  readonly envelopeId = signal('');

  private originalPdfBytes: Uint8Array | null = null;
  private storageKey = '';
  readonly isResizing = signal(false);
  private resizing: { id: number; startX: number; startY: number; w: number; h: number } | null =
    null;

  constructor() {
    const file = this.documentService.getFile();
    if (!file) {
      this.router.navigate(['/']);
      return;
    }
    this.fileName.set(file.name);
    this.storageKey = `${STORAGE_PREFIX}${file.name}:${file.size}`;
    this.restore();

    file
      .arrayBuffer()
      .then((buffer) => {
        const bytes = new Uint8Array(buffer);
        // Independent copy: the viewer transfers (detaches) its buffer to a worker.
        this.originalPdfBytes = bytes.slice();
        this.pdfSrc.set(bytes);
      })
      .catch(() => this.showError('Could not read the selected document.'));

    // Autosave field layout + signer identity per document.
    effect(() => {
      const state: SavedState = {
        fields: this.fields(),
        signerName: this.signerName,
        signerEmail: this.signerEmail,
      };
      this.persist(state);
    });
  }

  ngAfterViewInit(): void {
    this.attachScrollListener();
    this.destroyRef.onDestroy(() => this.signaturePad?.off());
  }

  private attachScrollListener(): void {
    let cancelled = false;
    const tryAttach = (): void => {
      if (cancelled) return;
      const viewer = document.querySelector('#viewerContainer');
      if (viewer) {
        const handler = (): void => this.cdr.detectChanges();
        viewer.addEventListener('scroll', handler, { passive: true });
        this.destroyRef.onDestroy(() => viewer.removeEventListener('scroll', handler));
      } else {
        setTimeout(tryAttach, 300);
      }
    };
    this.destroyRef.onDestroy(() => (cancelled = true));
    tryAttach();
  }

  // ---- Viewer callbacks + navigation -------------------------------------
  onPagesLoaded(event: PagesLoadedEvent): void {
    this.isLoading.set(false);
    this.totalPages.set(event.pagesCount ?? 1);
    this.cdr.detectChanges();
  }

  prevPage(): void {
    this.currentPage.set(Math.max(1, this.currentPage() - 1));
  }

  nextPage(): void {
    this.currentPage.set(Math.min(this.totalPages(), this.currentPage() + 1));
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  zoomIn(): void {
    this.stepZoom(10);
  }

  zoomOut(): void {
    this.stepZoom(-10);
  }

  fitWidth(): void {
    this.zoom.set('page-width');
    this.cdr.detectChanges();
  }

  private stepZoom(delta: number): void {
    const current = this.zoom().endsWith('%') ? parseInt(this.zoom(), 10) : 100;
    const next = Math.min(250, Math.max(50, current + delta));
    this.zoom.set(`${next}%`);
    this.cdr.detectChanges();
  }

  toggleSidebar(): void {
    this.sidebarVisible.update((v) => !v);
  }

  toggleDark(): void {
    this.darkMode.update((v) => !v);
    document.documentElement.classList.toggle('my-app-dark', this.darkMode());
  }

  // ---- Field placement ---------------------------------------------------
  onSidebarDrop(event: CdkDragEnd, type: FieldType): void {
    const placement = this.pageFromPoint(event.dropPoint);
    event.source.reset();
    if (!placement) return;

    const { page, rect, relX, relY } = placement;
    const meta = FIELD_META[type];
    const w = meta.defaultPx.w / rect.width;
    const h = meta.defaultPx.h / rect.height;
    const field: SignatureField = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type,
      page,
      x: this.clampNorm(relX / rect.width, w),
      y: this.clampNorm(relY / rect.height, h),
      w,
      h,
      required: meta.requiredByDefault,
      value: this.defaultValue(type),
      checked: type === 'checkbox' ? false : undefined,
    };
    this.commit([...this.fields(), field]);
    this.selectedId.set(field.id);
  }

  onFieldMoved(event: CdkDragEnd, field: SignatureField): void {
    const placement = this.pageFromPoint(event.dropPoint);
    event.source.reset();
    if (!placement) {
      this.cdr.detectChanges();
      return;
    }
    const { page, rect, relX, relY } = placement;
    this.commit(
      this.fields().map((f) =>
        f.id === field.id
          ? {
              ...f,
              page,
              x: this.clampNorm(relX / rect.width, f.w),
              y: this.clampNorm(relY / rect.height, f.h),
            }
          : f,
      ),
    );
    setTimeout(() => this.cdr.detectChanges(), 60);
  }

  private pageFromPoint(point: {
    x: number;
    y: number;
  }): { page: number; rect: DOMRect; relX: number; relY: number } | null {
    const pageEl = document
      .elementsFromPoint(point.x, point.y)
      .find((el): el is HTMLElement => el.classList.contains('page'));
    if (!pageEl) return null;
    const rect = pageEl.getBoundingClientRect();
    return {
      page: Number(pageEl.getAttribute('data-page-number') ?? '1'),
      rect,
      relX: point.x - rect.left,
      relY: point.y - rect.top,
    };
  }

  private clampNorm(value: number, size: number): number {
    return Math.max(0, Math.min(value, 1 - size));
  }

  private defaultValue(type: FieldType): string | undefined {
    if (type === 'date') return new Date().toISOString().split('T')[0];
    if (type === 'name') return this.signerName || undefined;
    if (type === 'email') return this.signerEmail || undefined;
    return undefined;
  }

  // ---- Resize ------------------------------------------------------------
  startResize(event: PointerEvent, field: SignatureField): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = {
      id: field.id,
      startX: event.clientX,
      startY: event.clientY,
      w: field.w,
      h: field.h,
    };
    this.isResizing.set(true);
    const move = (e: PointerEvent): void => this.onResizeMove(e);
    const up = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (this.resizing) {
        this.commit(this.fields()); // snapshot final size for undo
        this.resizing = null;
      }
      this.isResizing.set(false);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.resizing) return;
    const field = this.fields().find((f) => f.id === this.resizing!.id);
    if (!field) return;
    const rect = this.pageEl(field.page)?.getBoundingClientRect();
    if (!rect) return;
    const dw = (event.clientX - this.resizing.startX) / rect.width;
    const dh = (event.clientY - this.resizing.startY) / rect.height;
    const w = Math.max(MIN_FIELD_NORM, Math.min(this.resizing.w + dw, 1 - field.x));
    const h = Math.max(MIN_FIELD_NORM, Math.min(this.resizing.h + dh, 1 - field.y));
    this.fields.update((fields) => fields.map((f) => (f.id === field.id ? { ...f, w, h } : f)));
    this.cdr.detectChanges();
  }

  // ---- Field interaction -------------------------------------------------
  onFieldClick(field: SignatureField): void {
    if (this.resizing) return;
    this.selectedId.set(field.id);
    if (field.type === 'checkbox') {
      this.setField(field.id, { checked: !field.checked });
      return;
    }
    if (field.type === 'signature' || field.type === 'initials') {
      this.openSignDialog(field);
    }
  }

  setFieldValue(id: number, value: string): void {
    this.setField(id, { value });
  }

  /** Live inline-text update without pushing an undo step per keystroke. */
  updateText(id: number, value: string): void {
    this.fields.update((fields) => fields.map((f) => (f.id === id ? { ...f, value } : f)));
  }

  showTextInput(field: SignatureField): boolean {
    return isTextInput(field.type) || field.type === 'date';
  }

  inputType(field: SignatureField): string {
    if (field.type === 'date') return 'date';
    if (field.type === 'email') return 'email';
    return 'text';
  }

  deleteField(id: number): void {
    this.commit(this.fields().filter((f) => f.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  toggleRequired(field: SignatureField): void {
    this.setField(field.id, { required: !field.required });
  }

  isFilled(field: SignatureField): boolean {
    if (field.type === 'checkbox') return !!field.checked;
    return !!field.value;
  }

  isImage(value: string | undefined): boolean {
    return !!value && value.startsWith('data:image');
  }

  fieldClasses(field: SignatureField): string {
    const parts = ['field-box'];
    if (this.selectedId() === field.id) parts.push('field-selected');
    if (this.highlightedId() === field.id) parts.push('field-highlight');
    if (this.isFilled(field)) parts.push('field-filled');
    else if (field.required) parts.push('field-required');
    return parts.join(' ');
  }

  getFieldStyle(field: SignatureField): FieldStyle {
    const pageEl = this.pageEl(field.page);
    if (!pageEl) return { display: 'none' };
    const container = this.mainContainer().nativeElement.getBoundingClientRect();
    const rect = pageEl.getBoundingClientRect();
    const offTop = rect.top - container.top;
    const offLeft = rect.left - container.left;
    return {
      position: 'absolute',
      left: `${offLeft + field.x * rect.width}px`,
      top: `${offTop + field.y * rect.height}px`,
      width: `${field.w * rect.width}px`,
      height: `${field.h * rect.height}px`,
      '--accent': FIELD_META[field.type].accent,
    };
  }

  private pageEl(page: number): HTMLElement | null {
    return document.querySelector(`.page[data-page-number="${page}"]`);
  }

  // ---- Signer identity ---------------------------------------------------
  onSignerChanged(): void {
    // Backfill empty name/email fields with the signer identity.
    this.fields.update((fields) =>
      fields.map((f) => {
        if (f.type === 'name' && !f.value) return { ...f, value: this.signerName || undefined };
        if (f.type === 'email' && !f.value) return { ...f, value: this.signerEmail || undefined };
        return f;
      }),
    );
  }

  // ---- Signing dialog ----------------------------------------------------
  private openSignDialog(field: SignatureField): void {
    this.dialogField.set(field);
    this.typedValue = field.type === 'initials' ? this.initialsFromName() : this.signerName;
    this.dialogTab.set(field.type === 'initials' ? 'type' : 'draw');
    this.showSignDialog.set(true);
  }

  quickAdopt(field: SignatureField): void {
    // Apply a previously adopted signature/initials without opening the dialog.
    const adopted = field.type === 'initials' ? this.adoptedInitials() : this.adoptedSignature();
    if (adopted) {
      this.setField(field.id, { value: adopted });
    } else {
      this.openSignDialog(field);
    }
  }

  private initialsFromName(): string {
    const matches = this.signerName.match(/\b(\w)/g);
    return matches ? matches.join('').toUpperCase() : '';
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
      this.signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255,255,255,0)',
        penColor: 'black',
      });
    });
  }

  clearPad(): void {
    this.signaturePad?.clear();
  }

  applyDrawn(): void {
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      this.applyToField(this.signaturePad.toDataURL(), true);
    }
  }

  applyTyped(): void {
    if (this.typedValue.trim()) this.applyToField(this.typedValue.trim(), false);
  }

  onUploadImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showError('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.applyToField(String(reader.result), true);
    reader.readAsDataURL(file);
  }

  private applyToField(value: string, isImage: boolean): void {
    const field = this.dialogField();
    if (!field) return;
    this.setField(field.id, { value });
    // Adopt for reuse across the document.
    if (field.type === 'initials') this.adoptedInitials.set(value);
    else this.adoptedSignature.set(value);
    this.signaturePad = null;
    this.showSignDialog.set(false);
    this.messageService.add({
      severity: 'success',
      summary: field.type === 'initials' ? 'Initials applied' : 'Signature applied',
      detail: isImage ? 'Saved for reuse on other fields.' : 'Saved for reuse on other fields.',
    });
  }

  applyAdoptedToAll(): void {
    const sig = this.adoptedSignature();
    const ini = this.adoptedInitials();
    this.commit(
      this.fields().map((f) => {
        if (f.type === 'signature' && !f.value && sig) return { ...f, value: sig };
        if (f.type === 'initials' && !f.value && ini) return { ...f, value: ini };
        return f;
      }),
    );
    this.messageService.add({
      severity: 'info',
      summary: 'Applied',
      detail: 'Your adopted signature was applied to remaining fields.',
    });
  }

  // ---- Guided signing + finish -------------------------------------------
  goToNextRequired(): void {
    const target = this.fields().find((f) => f.required && !this.isFilled(f));
    if (!target) {
      this.messageService.add({
        severity: 'success',
        summary: 'All set',
        detail: 'Every required field is complete.',
      });
      return;
    }
    this.currentPage.set(target.page);
    this.highlightedId.set(target.id);
    this.selectedId.set(target.id);
    setTimeout(
      () => this.pageEl(target.page)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      50,
    );
    setTimeout(() => this.highlightedId.set(null), 2000);
  }

  async finish(): Promise<void> {
    if (!this.originalPdfBytes) return;
    const fields = this.fields();
    if (fields.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nothing to sign',
        detail: 'Add at least one field first.',
      });
      return;
    }
    if (!this.allRequiredDone()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Required fields incomplete',
        detail: 'Complete the highlighted required field to continue.',
      });
      this.goToNextRequired();
      return;
    }

    this.isLoading.set(true);
    try {
      const result = await this.signingService.sign(this.originalPdfBytes, fields, {
        documentName: this.fileName(),
        signerName: this.signerName || undefined,
        signerEmail: this.signerEmail || undefined,
      });
      this.lastSigned = result;
      this.envelopeId.set(result.envelopeId);
      this.triggerDownload(result.bytes, this.signedName());
      this.showSummary.set(true);
    } catch (error) {
      console.error('Failed to sign document', error);
      this.showError('Something went wrong while creating the PDF.');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  downloadAgain(): void {
    if (this.lastSigned) this.triggerDownload(this.lastSigned.bytes, this.signedName());
  }

  startNewDocument(): void {
    this.clearSaved();
    this.documentService.clear();
    this.router.navigate(['/']);
  }

  private signedName(): string {
    return this.fileName().replace(/\.pdf$/i, '') + '-signed.pdf';
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

  // ---- Undo / redo -------------------------------------------------------
  private commit(next: SignatureField[]): void {
    this.past.push(this.fields());
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.fields.set(next);
    this.syncHistoryFlags();
  }

  private setField(id: number, patch: Partial<SignatureField>): void {
    this.commit(this.fields().map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.fields());
    this.fields.set(prev);
    this.syncHistoryFlags();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.fields());
    this.fields.set(next);
    this.syncHistoryFlags();
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.past.length > 0);
    this.canRedo.set(this.future.length > 0);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if (
      ctrl &&
      (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))
    ) {
      event.preventDefault();
      this.redo();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedId() != null) {
      event.preventDefault();
      this.deleteField(this.selectedId()!);
    } else if (event.key === 'Escape') {
      this.selectedId.set(null);
    }
  }

  // ---- Persistence -------------------------------------------------------
  private persist(state: SavedState): void {
    if (!this.storageKey) return;
    try {
      const json = JSON.stringify(state);
      if (json.length < 4_000_000) localStorage.setItem(this.storageKey, json);
    } catch {
      /* quota exceeded — skip autosave */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as SavedState;
      if (Array.isArray(state.fields) && state.fields.length) {
        this.fields.set(state.fields);
        this.signerName = state.signerName ?? '';
        this.signerEmail = state.signerEmail ?? '';
        this.messageService.add({
          severity: 'info',
          summary: 'Progress restored',
          detail: 'Your previous fields for this document were restored.',
        });
      }
    } catch {
      /* ignore corrupt state */
    }
  }

  private clearSaved(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }

  protected readonly isTextInput = isTextInput;
}
