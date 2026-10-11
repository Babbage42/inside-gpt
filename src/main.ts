import { bootstrapApplication } from '@angular/platform-browser';
import { LOCALE_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { appConfig } from './app/app.config';

const v2Config = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
  ],
};

if (window.location.pathname.startsWith('/v4')) {
  import('./app/v4/v4').then(({ V4Root }) => bootstrapApplication(V4Root, v2Config))
    .catch((err) => console.error(err));
} else if (window.location.pathname.startsWith('/v3')) {
  import('./app/v3/v3').then(({ V3Root }) => bootstrapApplication(V3Root, v2Config))
    .catch((err) => console.error(err));
} else if (window.location.pathname.startsWith('/v2')) {
  import('./app/v2/v2').then(({ V2Root }) => bootstrapApplication(V2Root, v2Config))
    .catch((err) => console.error(err));
} else {
  import('./app/app').then(({ App }) => bootstrapApplication(App, appConfig))
    .catch((err) => console.error(err));
}
