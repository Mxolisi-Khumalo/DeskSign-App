/**
 * Global test environment setup.
 *
 * jsdom does not implement several browser APIs that PrimeNG and
 * ngx-extended-pdf-viewer rely on (ResizeObserver, IntersectionObserver,
 * matchMedia). Polyfill them so components can be instantiated under test.
 */

class MockObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = MockObserver;
}

if (!('IntersectionObserver' in globalThis)) {
  (globalThis as any).IntersectionObserver = MockObserver;
}

if (!globalThis.matchMedia) {
  (globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
