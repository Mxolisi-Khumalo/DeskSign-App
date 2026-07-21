import { mapFieldToPdf } from './pdf-signing';

describe('mapFieldToPdf', () => {
  const field = { x: 0.1, y: 0.1, w: 0.4, h: 0.05 };

  it('scales normalized size to PDF units', () => {
    const rect = mapFieldToPdf(field, 600, 800);
    expect(rect.w).toBeCloseTo(240);
    expect(rect.h).toBeCloseTo(40);
    expect(rect.x).toBeCloseTo(60);
  });

  it('flips the Y axis to the PDF bottom-left origin', () => {
    const rect = mapFieldToPdf(field, 600, 800);
    // y = pdfHeight - (y*H) - h = 800 - 80 - 40
    expect(rect.y).toBeCloseTo(680);
  });

  it('places a top-left field near the top of the page', () => {
    const rect = mapFieldToPdf({ x: 0, y: 0, w: 0.5, h: 0.1 }, 1000, 1000);
    expect(rect.x).toBe(0);
    expect(rect.y).toBeCloseTo(900); // 1000 - 0 - 100
    expect(rect.w).toBe(500);
    expect(rect.h).toBeCloseTo(100);
  });
});
