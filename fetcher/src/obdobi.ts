/** Práce se sázkovými týdny. Číslo týdne odpovídá ISO týdnu (viz docs/data-source.md). */

export interface Tyden {
  readonly rok: number;
  readonly tyden: number;
}

export class ChybaObdobi extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = 'ChybaObdobi';
  }
}

/** ISO rok má 53 týdnů, pokud na čtvrtek připadá 1. leden, nebo u přestupného roku 31. prosinec. */
export function tydnuVRoce(rok: number): number {
  const den = (datum: Date) => (datum.getUTCDay() + 6) % 7; // 0 = pondělí
  const prestupny = (r: number) => (r % 4 === 0 && r % 100 !== 0) || r % 400 === 0;
  const prvniLeden = den(new Date(Date.UTC(rok, 0, 1)));
  return prvniLeden === 3 || (prestupny(rok) && prvniLeden === 2) ? 53 : 52;
}

/** Přečte zápis `RRRR-TT`. */
export function parsujTyden(zapis: string): Tyden {
  const nalez = /^(\d{4})-(\d{1,2})$/.exec(zapis.trim());
  if (nalez === null) {
    throw new ChybaObdobi(`„${zapis}“ není týden ve tvaru RRRR-TT, například 2026-36.`);
  }
  const rok = Number(nalez[1]);
  const tyden = Number(nalez[2]);
  if (tyden < 1 || tyden > tydnuVRoce(rok)) {
    throw new ChybaObdobi(`Rok ${rok} má ${tydnuVRoce(rok)} týdnů, ale zadán je ${tyden}.`);
  }
  return { rok, tyden };
}

export function formatujTyden({ rok, tyden }: Tyden): string {
  return `${rok}-${String(tyden).padStart(2, '0')}`;
}

/** Vyjmenuje všechny týdny od `od` do `do` včetně, přes hranice roků. */
export function tydnyOdDo(od: Tyden, doTydne: Tyden): Tyden[] {
  if (od.rok > doTydne.rok || (od.rok === doTydne.rok && od.tyden > doTydne.tyden)) {
    throw new ChybaObdobi(
      `Období končí dřív, než začíná: ${formatujTyden(od)} až ${formatujTyden(doTydne)}.`,
    );
  }

  const tydny: Tyden[] = [];
  let { rok, tyden } = od;
  while (rok < doTydne.rok || (rok === doTydne.rok && tyden <= doTydne.tyden)) {
    tydny.push({ rok, tyden });
    tyden += 1;
    if (tyden > tydnuVRoce(rok)) {
      rok += 1;
      tyden = 1;
    }
  }
  return tydny;
}
