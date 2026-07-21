# DeskSign

**DeskSign** is a modern, frontend-only document-signing application built with **Angular 21**. Upload a PDF, drag signature/initials/text/date fields onto it, sign by drawing or typing, and download a flattened PDF with everything embedded — all in the browser, with no backend.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PrimeNG](https://img.shields.io/badge/PrimeNG-21-2ca44b?style=for-the-badge&logo=primeng&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## Features

- **PDF upload & preview** — high-fidelity rendering via `ngx-extended-pdf-viewer`.
- **Drag & drop fields** — signature, initials, text and date placeholders, positioned with Angular CDK.
- **Interactive signing** — draw with the pointer (`signature_pad`) or type a name rendered in a cursive font.
- **100% client-side** — all PDF manipulation happens locally with `pdf-lib`; nothing is uploaded.
- **Flattened output** — signatures are burned into the page coordinates, producing a secure, flattened `signed_document.pdf`.
- **Modern UI** — Tailwind CSS v4 + PrimeNG (Aura theme), with toast notifications for feedback.

## Tech stack

- **Framework:** Angular 21 (standalone components, signals, lazy-loaded routes)
- **Styling:** Tailwind CSS v4, PrimeNG, PrimeIcons
- **PDF rendering:** `ngx-extended-pdf-viewer`
- **PDF manipulation:** `pdf-lib`, `@pdf-lib/fontkit`
- **Drag & drop:** `@angular/cdk`
- **Signature canvas:** `signature_pad`
- **Tooling:** ESLint (angular-eslint, flat config), Prettier, Vitest

## Getting started

### Prerequisites

- **Node.js** 20 or higher
- **npm** 10 or higher

### Install & run

```bash
npm install
npm start          # dev server at http://localhost:4200/
```

### Scripts

| Script                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm start`            | Run the dev server                           |
| `npm run build`        | Production build (bundle budgets enforced)   |
| `npm test`             | Run the unit tests (Vitest)                  |
| `npm run lint`         | Lint TypeScript + templates (ESLint)         |
| `npm run format`       | Format the codebase with Prettier            |
| `npm run format:check` | Verify formatting without writing changes    |

## How to use

1. **Upload** a PDF on the dashboard.
2. **Prepare:** drag a **Signature**, **Initials**, **Text** or **Date** field from the sidebar onto the page. Reposition by dragging; remove with the red ✕.
3. **Sign:** click a Signature/Initials field, then **Draw** or **Type**, and **Apply**.
4. **Finish:** click **Finish** to download `signed_document.pdf` with everything embedded.

## Architecture

```
src/app/
├── models/
│   └── signature-field.ts     # domain types + field size constants
├── services/
│   ├── document.ts            # signal-based holder for the selected file
│   └── pdf-signing.ts         # all pdf-lib embedding + coordinate mapping (testable)
├── components/
│   └── document-upload/       # PrimeNG file upload
├── pages/
│   ├── dashboard/             # landing page (lazy-loaded)
│   └── document-preview/      # viewer, field placement, signing dialog (lazy-loaded)
└── app.routes.ts              # lazy routes
```

Design notes:

- **Signals** drive component state; DI uses the `inject()` function throughout.
- **Lazy routes** keep the heavy PDF stack out of the initial bundle (initial ≈ 470 kB; the preview page and fontkit load on demand).
- **`PdfSigningService`** isolates PDF/coordinate logic from the UI, with pure, unit-tested coordinate mapping (`mapFieldToPdf`).
- The cursive signature font (**Great Vibes**, OFL) is bundled under `public/assets/fonts/` and loaded locally — no runtime dependency on an external CDN.

## Testing

```bash
npm test
```

Vitest runs in a jsdom environment; `src/test-setup.ts` polyfills the browser APIs (`ResizeObserver`, `IntersectionObserver`, `matchMedia`) that PrimeNG and the PDF viewer expect.

## Roadmap

- Keyboard-accessible field placement (currently pointer-only; a11y lint rules are relaxed to warnings for the drag surface).
- Resize handles for placed fields.
- Multi-file / document history.

## Credits

- Cursive font: [Great Vibes](https://fonts.google.com/specimen/Great+Vibes) by TypeSETit, licensed under the SIL Open Font License (see `public/assets/fonts/OFL.txt`).
- Inspired by the classic e-signature tools (DocuSign, Adobe Sign).
