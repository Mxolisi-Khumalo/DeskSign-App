import { Injectable } from '@angular/core';
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';

import { FieldType, FIELD_HEIGHT, FIELD_WIDTH, SignatureField } from '../models/signature-field';

/** Rendered geometry of a single PDF page, measured from the DOM. */
export interface PageGeometry {
  /** clientWidth of the rendered page element, in px. */
  renderedWidth: number;
}

/** A placement mapped from screen space into PDF (bottom-left origin) space. */
export interface PdfPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

const CURSIVE_FONT_URL = 'assets/fonts/GreatVibes-Regular.ttf';

/**
 * Map a field's rendered (top-left origin, screen px) position onto a PDF
 * page's coordinate system (bottom-left origin, PDF units). Pure and
 * unit-tested — no DOM or pdf-lib dependency.
 */
export function mapFieldToPdf(
  field: SignatureField,
  pdfWidth: number,
  pdfHeight: number,
  renderedWidth: number,
): PdfPlacement {
  const scaleFactor = pdfWidth / renderedWidth;
  const x = field.x * scaleFactor;
  const y = pdfHeight - field.y * scaleFactor - FIELD_HEIGHT * scaleFactor;
  return {
    x,
    y,
    width: FIELD_WIDTH * scaleFactor,
    height: FIELD_HEIGHT * scaleFactor,
    scaleFactor,
  };
}

function isImageValue(value: string): boolean {
  return value.startsWith('data:image');
}

function isPlainText(type: FieldType): boolean {
  return type === 'text' || type === 'date';
}

/**
 * Burns placed fields into a PDF, producing a flattened document. All pdf-lib
 * interaction lives here so components stay thin and this logic is testable.
 */
@Injectable({ providedIn: 'root' })
export class PdfSigningService {
  /**
   * @param pdfBytes       original document bytes
   * @param fields         fields to embed (empty/valueless fields are skipped)
   * @param geometryByPage rendered geometry per 1-based page number
   * @returns the signed PDF bytes
   */
  async sign(
    pdfBytes: Uint8Array,
    fields: readonly SignatureField[],
    geometryByPage: ReadonlyMap<number, PageGeometry>,
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const fontkit = await import('@pdf-lib/fontkit').then((m) => m.default);
    pdfDoc.registerFontkit(fontkit);

    const cursiveFont = await this.loadCursiveFont(pdfDoc);
    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const field of fields) {
      if (!field.value) continue;

      const pdfPage = pages[field.page - 1];
      const geometry = geometryByPage.get(field.page);
      if (!pdfPage || !geometry || geometry.renderedWidth <= 0) continue;

      const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
      const placement = mapFieldToPdf(field, pdfWidth, pdfHeight, geometry.renderedWidth);

      if (field.type === 'signature' && isImageValue(field.value)) {
        const png = await pdfDoc.embedPng(field.value);
        pdfPage.drawImage(png, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        });
        continue;
      }

      const plain = isPlainText(field.type);
      const font: PDFFont = plain ? standardFont : cursiveFont;
      const fontSize = plain ? 12 : 24;
      const yOffset = plain ? 35 : 15;
      pdfPage.drawText(field.value, {
        x: placement.x + 10 * placement.scaleFactor,
        y: placement.y + yOffset * placement.scaleFactor,
        size: fontSize * placement.scaleFactor,
        font,
        color: rgb(0, 0, 0),
      });
    }

    return pdfDoc.save();
  }

  /** Embed the bundled cursive font, falling back to Helvetica if unavailable. */
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
