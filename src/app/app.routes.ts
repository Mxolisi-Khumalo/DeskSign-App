import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'preview',
    loadComponent: () =>
      import('./pages/document-preview/document-preview').then((m) => m.DocumentPreview),
  },
  { path: '**', redirectTo: '' },
];
