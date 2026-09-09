/**
 * Minimální pomůcky pro čtení výherní listiny.
 *
 * Listina je legacy tiskové HTML, ne dokument, na který má smysl pouštět DOM parser.
 * Kotvíme se na značky popsané v docs/data-source.md a vystačíme si s regulárními výrazy,
 * takže fetcher nepotřebuje žádnou závislost navíc.
 */

/** V listině se vyskytuje jen `&nbsp;` a číselné entity; pět standardních přidáváme pro jistotu. */
const POJMENOVANE: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Dekóduje HTML entity.
 *
 * Bez tohohle kroku nesedne nic — diakritika je v listině zapsaná číselně, takže v surových
 * bajtech stojí `SPORTKA ST&#x158;EDA`, ne `SPORTKA STŘEDA`.
 */
export function dekodujEntity(text: string): string {
  return text.replace(/&(#[xX][0-9A-Fa-f]+|#[0-9]+|[a-zA-Z]+);/g, (cele, telo: string) => {
    if (telo.startsWith('#x') || telo.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(telo.slice(2), 16));
    }
    if (telo.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(telo.slice(1), 10));
    }
    return POJMENOVANE[telo] ?? cele;
  });
}

/**
 * Převede částku z listiny na číslo.
 *
 * Oddělovačem tisíců je nedělitelná mezera, desetinným oddělovačem čárka
 * (`263 731 922,00 Kč`). Haléře se zahazují — listina je uvádí jen u součtů, ne u výher.
 */
export function naCastku(text: string): number | null {
  const ocistene = text.replace(/[\s ]/g, '').replace(',', '.');
  if (ocistene === '') return null;
  const hodnota = Number.parseFloat(ocistene);
  return Number.isFinite(hodnota) ? Math.round(hodnota) : null;
}

/**
 * Najde částku uvedenou za popiskem.
 *
 * Mezi popiskem a číslem jsou HTML tagy, jejichž třídy samy obsahují číslice (`b2`, `s18b`),
 * takže se nedá jen přeskočit „nečíslice“ — kotvíme se až na „Kč“ za částkou.
 */
export function castkaZa(usek: string, popisek: string): number | null {
  const vzor = new RegExp(
    `${popisek.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?([\\d\\s\\u00a0]+(?:,\\d+)?)\\s*Kč`,
  );
  const nalez = vzor.exec(usek);
  return nalez?.[1] === undefined ? null : naCastku(nalez[1]);
}

/** Vrátí čísla z řádků `<tr class="loscisla">`. Prázdné řádky (hlavičky) vynechává. */
export function vylosovanaCisla(usek: string): string[][] {
  const radky = [...usek.matchAll(/<tr class="loscisla[^"]*">([\s\S]*?)<\/tr>/g)];
  return radky
    .map((r) => [...(r[1] ?? '').matchAll(/<td class="b2 s32b">\s*(\d+)\s*<\/td>/g)].map((m) => m[1]!))
    .filter((cisla) => cisla.length > 0);
}

/** Datum losování v ISO tvaru. */
export function datumLosovani(usek: string): string | null {
  const nalez = /Losování dne:\s*(\d{2})\.\s*(\d{2})\.\s*(\d{4})/.exec(usek);
  if (nalez === null) return null;
  return `${nalez[3]}-${nalez[2]}-${nalez[1]}`;
}
