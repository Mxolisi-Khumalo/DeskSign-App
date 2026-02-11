// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura'; // Import the new Aura theme

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    // Add the PrimeNG provider here with the theme configuration
    providePrimeNG({
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: '.my-app-dark', // Optional: prevents auto dark mode if not wanted yet
            }
        }
    })
  ]
};