import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./obrazovky/seznam.js').then((m) => m.Seznam),
    title: 'Tikety',
  },
  {
    path: 'tiket/novy',
    loadComponent: () => import('./obrazovky/novy-tiket.js').then((m) => m.NovyTiket),
    title: 'Nový tiket',
  },
  {
    path: 'tiket/:id',
    loadComponent: () => import('./obrazovky/detail.js').then((m) => m.Detail),
    title: 'Vyhodnocení tiketu',
  },
  {
    path: 'import',
    loadComponent: () => import('./obrazovky/import-vysledku.js').then((m) => m.ImportVysledku),
    title: 'Výsledky losování',
  },
  { path: '**', redirectTo: '' },
];
