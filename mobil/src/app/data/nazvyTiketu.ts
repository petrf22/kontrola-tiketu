import type { Tiket } from '@kontrola-tiketu/jadro';

export function upravNazev(nazev: string | null | undefined): string | null {
  return nazev?.normalize('NFC').trim().replace(/\s+/gu, ' ') || null;
}

/** Prázdný klíč patří nepojmenovaným tiketům; hvězdička ve filtru znamená všechny. */
export function klicNazvu(nazev: string | null | undefined): string {
  const upraveny = upravNazev(nazev);
  return upraveny === null ? '' : `nazev:${upraveny.toLocaleLowerCase('cs')}`;
}

export function odpovidaNazvu(tiket: Tiket, filtr: string): boolean {
  return filtr === '*' || klicNazvu(tiket.nazev) === filtr;
}

export interface SkupinaNazvu<T> {
  readonly klic: string;
  readonly nazev: string;
  readonly polozky: T[];
}

/** Zachová pořadí položek uvnitř skupiny; nepojmenované patří na konec. */
export function seskupPodleNazvu<T>(polozky: readonly T[], nazev: (polozka: T) => string | null | undefined): SkupinaNazvu<T>[] {
  const skupiny = new Map<string, SkupinaNazvu<T>>();
  for (const polozka of polozky) {
    const jmeno = upravNazev(nazev(polozka));
    const klic = klicNazvu(jmeno);
    let skupina = skupiny.get(klic);
    if (!skupina) {
      skupina = { klic, nazev: jmeno ?? 'Bez názvu', polozky: [] };
      skupiny.set(klic, skupina);
    }
    skupina.polozky.push(polozka);
  }
  return [...skupiny.values()].sort((a, b) =>
    a.klic === '' ? 1 : b.klic === '' ? -1 : a.nazev.localeCompare(b.nazev, 'cs'),
  );
}
