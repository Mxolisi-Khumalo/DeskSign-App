import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { DocumentPreview } from './pages/document-preview/document-preview';

export const routes: Routes = [
  { path: '', component: Dashboard },
  {path: 'preview', component: DocumentPreview},
  { path: '**', redirectTo: '' }
];