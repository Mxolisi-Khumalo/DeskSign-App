import { FIELD_HEIGHT, FIELD_WIDTH, SignatureField } from '../models/signature-field';
import { mapFieldToPdf } from './pdf-signing';

describe('mapFieldToPdf', () => {
  const field: SignatureField = { id: 1, type: 'signature', x: 100, y: 50, page: 1 };

  it('scales screen coordinates to PDF units by the width ratio', () => {
    // Rendered page 500px wide, PDF page 1000pt wide => scale factor 2.
    const placement = mapFieldToPdf(field, 1000, 800, 500);

    expect(placement.scaleFactor).toBe(2);
    expect(placement.x).toBe(200);
    expect(placement.width).toBe(FIELD_WIDTH * 2);
    expect(placement.height).toBe(FIELD_HEIGHT * 2);
  });

  it('flips the Y axis to PDFs bottom-left origin', () => {
    const placement = mapFieldToPdf(field, 1000, 800, 500);
    // y = pdfHeight - (y*scale) - (FIELD_HEIGHT*scale) = 800 - 100 - 120
    expect(placement.y).toBe(800 - 50 * 2 - FIELD_HEIGHT * 2);
  });

  it('is identity when rendered width equals PDF width', () => {
    const placement = mapFieldToPdf(field, 500, 700, 500);
    expect(placement.scaleFactor).toBe(1);
    expect(placement.x).toBe(field.x);
  });
});
