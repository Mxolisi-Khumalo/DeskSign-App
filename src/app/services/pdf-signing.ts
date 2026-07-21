import { Injectable } from '@angular/core';
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

import { FieldType, isTextInput, SignatureField } from '../models/signature-field';

/** A field placement mapped into PDF space (bottom-left origin, PDF units). */
export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Metadata shown on the completion certificate. */
export interface SignMetadata {
  documentName: string;
  signerName?: string;
  signerEmail?: string;
}

/** Result of a signing operation. */
export interface SignResult {
  bytes: Uint8Array;
  envelopeId: string;
  signedAt: Date;
}

const CURSIVE_FONT_URL = 'assets/fonts/GreatVibes-Regular.ttf';
const INK = rgb(0.06, 0.09, 0.16);

/**
 * Map a field's normalized (0..1, top-left origin) rect onto a PDF page's
 * coordinate system (bottom-left origin, PDF units). Pure and unit-tested.
 */
export function mapFieldToPdf(
  field: Pick<SignatureField, 'x' | 'y' | 'w' | 'h'>,
  pdfWidth: number,
  pdfHeight: number,
): PdfRect {
  const w = field.w * pdfWidth;
  const h = field.h * pdfHeight;
  return {
    x: field.x * pdfWidth,
    y: pdfHeight - field.y * pdfHeight - h,
    w,
    h,
  };
}

function isImageValue(value: string | undefined): value is string {
  return !!value && value.startsWith('data:image');
}

function useCursive(type: FieldType): boolean {
  return type === 'signature' || type === 'initials';
}

/**
 * Burns placed fields into a PDF and appends a completion certificate,
 * producing a flattened document. All pdf-lib interaction lives here.
 */
@Injectable({ providedIn: 'root' })
export class PdfSigningService {
  async sign(
    pdfBytes: Uint8Array,
    fields: readonly SignatureField[],
    meta: SignMetadata,
  ): Promise<SignResult> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const fontkit = await import('@pdf-lib/fontkit').then((m) => m.default);
    pdfDoc.registerFontkit(fontkit);

    const cursiveFont = await this.loadCursiveFont(pdfDoc);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    for (const field of fields) {
      const page = pages[field.page - 1];
      if (!page) continue;
      const { width, height } = page.getSize();
      const rect = mapFieldToPdf(field, width, height);

      if (useCursive(field.type) && isImageValue(field.value)) {
        const png = await pdfDoc.embedPng(field.value);
        page.drawImage(png, { x: rect.x, y: rect.y, width: rect.w, height: rect.h });
      } else {
        this.drawField(page, field, rect, cursiveFont, font);
      }
    }

    const envelopeId = this.generateEnvelopeId();
    const signedAt = new Date();
    this.drawCertificate(pdfDoc, font, bold, fields, meta, envelopeId, signedAt);

    const bytes = await pdfDoc.save();
    return { bytes, envelopeId, signedAt };
  }

  private drawField(
    page: PDFPage,
    field: SignatureField,
    rect: PdfRect,
    cursiveFont: PDFFont,
    font: PDFFont,
  ): void {
    if (field.type === 'checkbox') {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        borderColor: INK,
        borderWidth: 1,
      });
      if (field.checked) {
        const s = Math.min(rect.w, rect.h);
        page.drawText('X', {
          x: rect.x + s * 0.22,
          y: rect.y + s * 0.2,
          size: s * 0.72,
          font,
          color: INK,
        });
      }
      return;
    }

    if (!field.value) return;

    const glyphFont = useCursive(field.type) ? cursiveFont : font;
    const size = Math.min(rect.h * 0.6, isTextInput(field.type) ? 14 : rect.h * 0.6);
    page.drawText(field.value, {
      x: rect.x + 4,
      y: rect.y + (rect.h - size) / 2 + size * 0.18,
      size,
      font: glyphFont,
      color: INK,
    });
  }

  private generateEnvelopeId(): string {
    const rand = (n: number) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16))
        .join('')
        .toUpperCase();
    return `DS-${rand(8)}-${rand(4)}`;
  }

  private drawCertificate(
    pdfDoc: PDFDocument,
    font: PDFFont,
    bold: PDFFont,
    fields: readonly SignatureField[],
    meta: SignMetadata,
    envelopeId: string,
    signedAt: Date,
  ): void {
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let y = height - 64;

    page.drawText('Certificate of Completion', { x: 48, y, size: 22, font: bold, color: INK });
    y -= 12;
    page.drawLine({
      start: { x: 48, y },
      end: { x: width - 48, y },
      thickness: 1,
      color: rgb(0.8, 0.83, 0.9),
    });
    y -= 28;

    const line = (label: string, value: string): void => {
      page.drawText(label, { x: 48, y, size: 11, font: bold, color: INK });
      page.drawText(value, { x: 180, y, size: 11, font, color: INK });
      y -= 20;
    };

    line('Envelope ID:', envelopeId);
    line('Document:', meta.documentName);
    if (meta.signerName) line('Signer:', meta.signerName);
    if (meta.signerEmail) line('Email:', meta.signerEmail);
    line('Completed:', signedAt.toUTCString());
    line('Fields placed:', String(fields.length));

    y -= 12;
    page.drawText('Field summary', { x: 48, y, size: 13, font: bold, color: INK });
    y -= 22;
    page.drawText('Type', { x: 48, y, size: 10, font: bold, color: INK });
    page.drawText('Page', { x: 240, y, size: 10, font: bold, color: INK });
    page.drawText('Status', { x: 320, y, size: 10, font: bold, color: INK });
    y -= 16;

    for (const field of fields) {
      if (y < 60) break;
      const filled = field.type === 'checkbox' ? !!field.checked : !!field.value;
      page.drawText(field.type, { x: 48, y, size: 10, font, color: INK });
      page.drawText(String(field.page), { x: 240, y, size: 10, font, color: INK });
      page.drawText(filled ? 'Completed' : 'Empty', {
        x: 320,
        y,
        size: 10,
        font,
        color: filled ? rgb(0.09, 0.6, 0.3) : rgb(0.7, 0.4, 0.1),
      });
      y -= 15;
    }

    page.drawText('Signed with DeskSign — signed in the browser, no data uploaded.', {
      x: 48,
      y: 40,
      size: 9,
      font,
      color: rgb(0.5, 0.55, 0.62),
    });
  }

  private async loadCursiveFont(pdfDoc: PDFDocument): Promise<PDFFont> {
    try {
      const response = await fetch(CURSIVE_FONT_URL);
      if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
      const fontBytes = await response.arrayBuffer();
      return await pdfDoc.embedFont(fontBytes);
    } catch {
      return pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  }
}
