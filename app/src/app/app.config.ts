import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Parametry cesty se vážou rovnou na vstupy komponent (detail tiketu bere id).
    provideRouter(routes, withComponentInputBinding()),
  ],
};
