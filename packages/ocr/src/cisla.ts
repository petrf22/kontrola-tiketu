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

/** Záměny, které rozpoznávač na termotisku dělá. Jen jednoznačné, žádné odhady. */
const ZAMENY: Readonly<Record<string, string>> = {
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
  const ocisteny = utrzek.trim().replace(/^[^\p{L}\p{N}|]+|[^\p{L}\p{N}|]+$/gu, '');
  if (ocisteny === '') return null;

  if (/^\d{1,2}$/.test(ocisteny)) {
    return { hodnota: Number(ocisteny), puvodni: utrzek, opraveno: false };
  }

  if (!/\d/.test(ocisteny)) return null;

  const opraveny = [...ocisteny].map((z) => ZAMENY[z] ?? z).join('');
  if (!/^\d{1,2}$/.test(opraveny)) return null;

  return { hodnota: Number(opraveny), puvodni: utrzek, opraveno: true };
}

/** Přečte všechna čísla v řádku, v pořadí zleva doprava. Nečíselné útržky přeskočí. */
export function prectiCisla(text: string): NactenaHodnota[] {
  return text
    .split(/\s+/)
    .map(prectiCislo)
    .filter((c): c is NactenaHodnota => c !== null);
}
