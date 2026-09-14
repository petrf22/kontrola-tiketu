/**
 * Čtení čísel z rozpoznaného textu.
 *
 * Termotisk na tiketu je pravidelný, ale rozpoznávač na něm dělá pořád stejnou hrstku
 * záměn — nulu za písmeno O, jedničku za I nebo l. Opravují se jen tam, kde je záměna
 * jednoznačná, a vždy se to pozná ve výsledku: uživatel čísla stejně potvrzuje a opravená
 * má smysl mu zvýraznit.
 *
 * Nikdy se nevymýšlí. Když z útržku nezbude číslo, prostě to není číslo.
 */

/**
 * Záměny, které rozpoznávač na termotisku dělá. Jen jednoznačné, žádné odhady.
 *
 * Sdílí je všechno, co z tiketu čte číslice — čísla sloupců, datum i kód doplňkové hry.
 */
export const ZAMENY: Readonly<Record<string, string>> = {
  O: '0',
  o: '0',
  Q: '0',
  D: '0',
  I: '1',
  l: '1',
  '|': '1',
  i: '1',
  S: '5',
  s: '5',
  B: '8',
  Z: '2',
  z: '2',
  G: '6',
};

export interface NactenaHodnota {
  readonly hodnota: number;
  /** Útržek tak, jak ho vrátil rozpoznávač. */
  readonly puvodni: string;
  /** Bylo potřeba opravit záměnu písmene za číslici? */
  readonly opraveno: boolean;
}

/**
 * Přečte jeden útržek jako jedno- nebo dvouciferné číslo, nebo vrátí `null`.
 *
 * Oprava se povolí, jen když v útržku byla aspoň jedna skutečná číslice. Jinak by se
 * z „NT“ nebo „OZ“ stalo číslo a tiket by se přečetl jako něco, co na něm nestojí.
 */
export function prectiCislo(utrzek: string): NactenaHodnota | null {
  const ocisteny = ocisti(utrzek);
  if (ocisteny === '') return null;

  if (/^\d{1,2}$/.test(ocisteny)) {
    return { hodnota: Number(ocisteny), puvodni: utrzek, opraveno: false };
  }

  if (!/\d/.test(ocisteny)) return null;

  const opraveny = [...ocisteny].map((z) => ZAMENY[z] ?? z).join('');
  if (!/^\d{1,2}$/.test(opraveny)) return null;

  return { hodnota: Number(opraveny), puvodni: utrzek, opraveno: true };
}

/** Ořízne interpunkci kolem útržku. Svislítko zůstává — bývá to přečtená jednička. */
function ocisti(utrzek: string): string {
  return utrzek.trim().replace(/^[^\p{L}\p{N}|]+|[^\p{L}\p{N}|]+$/gu, '');
}

/** Přečte všechna čísla v řádku, v pořadí zleva doprava. Nečíselné útržky přeskočí. */
export function prectiCisla(text: string): NactenaHodnota[] {
  return text
    .split(/\s+/)
    .map(prectiCislo)
    .filter((c): c is NactenaHodnota => c !== null);
}

/**
 * Přečte čísla sloupce tiketu — jen pro text z rozpoznávače, ne pro ruční zadání.
 *
 * Na tiketu je každé číslo vytištěné jako dvojice číslic (`02`, nikdy `2`). Z toho plyne,
 * co s útržkem, který dvojicí není:
 *
 * - **sudý počet číslic** (`0203`) — rozpoznávač slepil sousední čísla; rozdělí se po dvou,
 * - **jedna číslice** — rozpoznávač jednu ztratil; číslo projde, ale označené k ověření,
 * - **lichý počet od tří** — nedá se poznat, kde je chyba, takže se nehádá a chybějící číslo
 *   odhalí kontrola počtu.
 *
 * `NT` za sloupcem znamená náhodný tip — čísla vybral terminál, ne sázející. Pro vyhodnocení
 * nic neznamená, jen ho rozpoznávač občas přilepí k poslednímu číslu (`03NT`). Odřízne se;
 * hodnota před ním je jistá, takže se neoznačuje.
 */
export function prectiCislaSloupce(text: string): NactenaHodnota[] {
  return text.split(/\s+/).flatMap(prectiUtrzekSloupce);
}

function prectiUtrzekSloupce(utrzek: string): NactenaHodnota[] {
  const ocisteny = ocisti(ocisti(utrzek).replace(/NT$/, ''));
  // Oprava záměn jen tam, kde je aspoň jedna skutečná číslice — jinak by z „NT“ bylo číslo.
  if (!/\d/.test(ocisteny)) return [];

  const cislice = [...ocisteny].map((z) => ZAMENY[z] ?? z).join('');
  if (!/^\d+$/.test(cislice)) return [];

  const opravenaZamena = cislice !== ocisteny;
  const hodnota = (text: string, opraveno: boolean): NactenaHodnota => ({
    hodnota: Number(text),
    puvodni: utrzek,
    opraveno,
  });

  if (cislice.length === 2) return [hodnota(cislice, opravenaZamena)];
  if (cislice.length === 1) return [hodnota(cislice, true)];
  if (cislice.length % 2 === 1) return [];

  return (cislice.match(/\d{2}/g) ?? []).map((dvojice) => hodnota(dvojice, true));
}
