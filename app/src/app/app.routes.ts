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
    title: 'Zadat tiket ručně',
  },
  {
    path: 'sken',
    loadComponent: () => import('./obrazovky/sken.js').then((m) => m.Sken),
    title: 'Sken tiketu',
  },
  {
    path: 'sken-cisel',
    loadComponent: () => import('./obrazovky/sken-cisel.js').then((m) => m.SkenCisel),
    title: 'Vyfotit tiket',
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
  {
    path: 'o-aplikaci',
    loadComponent: () => import('./obrazovky/o-aplikaci.js').then((m) => m.OAplikaci),
    title: 'O aplikaci',
  },
  { path: '**', redirectTo: '' },
];
