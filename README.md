# DeskSign

**DeskSign** is a modern, frontend-only document-signing application built with **Angular 21**. Upload a PDF, drag signature/initials/text/date fields onto it, sign by drawing or typing, and download a flattened PDF with everything embedded — all in the browser, with no backend.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PrimeNG](https://img.shields.io/badge/PrimeNG-21-2ca44b?style=for-the-badge&logo=primeng&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## Features

- **PDF upload & preview** — high-fidelity rendering via `ngx-extended-pdf-viewer`.
- **Seven field types** — signature, initials, full name, email, date, text and checkbox, dragged from the sidebar with Angular CDK.
- **Resizable, movable fields** — drag to reposition (across any page), drag the corner to resize. Positions are stored **normalized per page**, so they stay correct across zoom levels.
- **Full multi-page support** — place fields on any page; page navigator, thumbnail panel, and fit-to-width zoom.
- **Signature adoption** — draw, type, or upload a signature image once; it's adopted and reusable across every signature field ("apply to all").
- **Signer identity autofill** — enter your name/email once to auto-fill name/email fields.
- **Required fields & guided signing** — mark fields required, see live progress, and jump to the next unfilled field; Finish is blocked until all required fields are complete.
- **Completion certificate** — a "Certificate of Completion" page (envelope ID, signer, timestamp, field summary) is appended to the signed PDF.
- **Undo / redo** — full history of field edits (Ctrl+Z / Ctrl+Y), plus keyboard delete.
- **Autosave** — field layout and signer details are saved locally per document, so a refresh doesn't lose your work.
- **Dark mode** — class-based light/dark theme toggle.
- **100% client-side** — all PDF manipulation happens locally with `pdf-lib`; nothing is uploaded.
- **Flattened output** — everything is burned into the page coordinates, producing a secure, flattened `<name>-signed.pdf`.

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
2. **(Optional)** enter your name/email in the sidebar to auto-fill name/email fields.
3. **Prepare:** drag any field (Signature, Initials, Full Name, Email, Date, Text, Checkbox) onto any page. Drag to move, drag the corner to resize, toggle Required, or delete (✕ / Del key).
4. **Sign:** click a Signature/Initials field, then **Draw**, **Type**, or **Upload** an image, and **Apply & adopt** (reused on other signature fields).
5. **Finish:** progress shows how many required fields remain; **Next required field** jumps you to the next one. Click **Finish** to download the flattened PDF with an appended Certificate of Completion.

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
- **Normalized coordinates** — fields store position/size as fractions (0..1) of their page, so they render correctly at any zoom and map directly into PDF space (no live DOM measurement at signing time).
- **Lazy routes** keep the heavy PDF stack out of the initial bundle (initial ≈ 470 kB; the preview page and fontkit load on demand).
- **`PdfSigningService`** isolates PDF/coordinate logic from the UI, with pure, unit-tested coordinate mapping (`mapFieldToPdf`) and certificate generation.
- The cursive signature font (**Great Vibes**, OFL) is bundled under `public/assets/fonts/` and loaded locally — no runtime dependency on an external CDN.

## Testing

```bash
npm test
```

Vitest runs in a jsdom environment; `src/test-setup.ts` polyfills the browser APIs (`ResizeObserver`, `IntersectionObserver`, `matchMedia`) that PrimeNG and the PDF viewer expect.

## Roadmap

- Keyboard-accessible field placement (currently pointer-driven; a11y lint rules are relaxed to warnings for the drag surface).
- Multiple recipients / signing order (needs a backend).
- Reusable document templates and multi-document history.

## Credits

- Cursive font: [Great Vibes](https://fonts.google.com/specimen/Great+Vibes) by TypeSETit, licensed under the SIL Open Font License (see `public/assets/fonts/OFL.txt`).
- Inspired by the classic e-signature tools (DocuSign, Adobe Sign).
