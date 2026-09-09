import { InjectionToken } from '@angular/core';
import { UlozisteVPameti, type Uloziste } from './uloziste.js';

/**
 * Úložiště se vstřikuje, aby šlo vyměnit za šifrované, aniž by se sáhlo na obrazovky.
 * Výchozí je paměťové — nic nezapisuje na disk, dokud není hotové šifrované.
 */
export const ULOZISTE = new InjectionToken<Uloziste>('uloziste', {
  providedIn: 'root',
  factory: () => new UlozisteVPameti(),
});
