import type { Tiket, VysledekSlosovani } from '@kontrola-tiketu/jadro';

export type FiltrHistorie = 'vsechna' | 'vyherni' | 'neuplna';
export function neuplneSlosovani(s: VysledekSlosovani): boolean {
  return s.nejistychVyher > 0 || s.vyhry.some(v => v.vyhrada !== null);
}
export function historieTiketu(slosovani: readonly VysledekSlosovani[], filtr: FiltrHistorie): VysledekSlosovani[] {
  return slosovani.filter(s => filtr === 'vsechna' || (filtr === 'vyherni' ? s.vyhry.length > 0 : neuplneSlosovani(s)))
    .sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Prázdná cena použije ceník; neplatná hodnota se nesmí tiše změnit na ceník. */
export function sUpravenouCenou(tiket: Tiket, text: string): Tiket {
  const hodnota = text.trim().replace(',', '.');
  const cena = hodnota === '' ? null : Number(hodnota);
  if (hodnota !== '' && (!/^\d+(?:\.\d+)?$/.test(hodnota) || !Number.isFinite(cena) || cena! < 0)) {
    throw new Error('Zadej nezápornou částku, nebo pole nech prázdné pro cenu podle ceníku.');
  }
  return tiket.kontrola
    ? { ...tiket, kontrola: { ...tiket.kontrola, cenaZaSlosovaniKc: cena } }
    : { ...tiket, cenaKc: cena };
}
