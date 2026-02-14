***

# DeskSign App

**DeskSign** is a modern, frontend-only document signing application built with **Angular**. It allows users to upload PDF documents, drag-and-drop signature fields, sign electronically (via drawing or typing), and download the finalized, flattened PDF with the signatures embedded.

It mimics the core functionality of tools like DocuSign or Adobe Sign, running entirely in the browser without a backend server for document processing.

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PrimeNG](https://img.shields.io/badge/PrimeNG-2ca44b?style=for-the-badge&logo=primeng&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## Features

*   ** PDF Upload & Preview:** High-fidelity PDF rendering using `ngx-extended-pdf-viewer`.
*   **point_of_interaction Drag & Drop Interface:** Drag signature and date placeholders from the sidebar onto the document using Angular CDK.
*   ** Interactive Signing:**
    *   **Draw:** Use the mouse/touchpad to draw a signature (powered by `signature_pad`).
    *   **Type:** Type a name and automatically convert it to a cursive signature style.
*   ** Client-Side Processing:** No server required. All PDF manipulation happens in the browser using `pdf-lib`.
*   ** PDF Embedding:** "Burns" images and text directly into the PDF coordinates upon finishing, creating a flattened, secure document.
*   ** Modern UI:** Styled with Tailwind CSS and PrimeNG components (Aura theme).

## Tech Stack

*   **Framework:** Angular 17+ (Standalone Components)
*   **Styling:** Tailwind CSS, PrimeNG, PrimeIcons
*   **PDF Rendering:** `ngx-extended-pdf-viewer`
*   **PDF Manipulation:** `pdf-lib`, `@pdf-lib/fontkit`
*   **Drag & Drop:** `@angular/cdk`
*   **Signature Canvas:** `signature_pad` (Native implementation)

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

*   **Node.js** (v18 or higher recommended)
*   **Angular CLI** (`npm install -g @angular/cli`)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/DeskSign-App.git
    cd DeskSign-App
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    ng serve
    ```

4.  **Open your browser:**
    Navigate to `http://localhost:4200/`.

## Configuration Notes

### Asset Configuration
This project relies on `ngx-extended-pdf-viewer` which requires specific assets to be copied to the build folder. This is already configured in `angular.json` under `architect > build > options > assets`:

```json
"assets": [
  {
    "glob": "**/*",
    "input": "public"
  },
  {
    "glob": "**/*",
    "input": "node_modules/ngx-extended-pdf-viewer/assets/",
    "output": "/assets/"
  }
]
```

If you encounter 404 errors regarding `pdf.worker.mjs`, ensure this configuration exists.

## How to Use

1.  **Upload:** Click "Choose PDF" on the dashboard to upload a document.
2.  **Prepare:**
    *   Drag the **"Signature"** or **"Date"** block from the left sidebar.
    *   Drop it anywhere on the PDF page.
    *   (Optional) Click the Red 'X' to remove a field.
3.  **Sign:**
    *   Click on a placed **Signature** block.
    *   A dialog will open. Choose to **Draw** your signature or **Type** it.
    *   Click "Apply".
4.  **Finish:**
    *   Click the green **"Finish"** button in the top right.
    *   The app will process the document and automatically download `signed_document.pdf` with your signatures embedded.

## Future Improvements

*   Support for Multi-page Drag & Drop (Currently optimized for Page 1).
*   Resize handles for signature blocks.
*   Backend integration for saving document history.
*   Authentication for user accounts.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
