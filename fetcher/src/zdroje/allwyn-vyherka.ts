/**
 * Adaptér veřejné výherní listiny Allwyn.
 *
 * Jediné místo v projektu, které ví, na jaké adrese listina leží a jak vypadá. Když Allwyn
 * adresu změní nebo přeskládá šablonu, opravuje se tenhle soubor a nic jiného — aplikace
 * žádnou URL nezná.
 *
 * Podrobný popis zdroje a jeho pastí je v docs/data-source.md.
 */

import type {
  Den,
  Hra,
  LosovaniSance,
  Poradi,
  PoradiEurojackpot,
  PoradiKoncoveCislice,
  PoradiSance,
  PoradiSportka,
  SportkaTah,
  Tah,
  TahEurojackpot,
  TahSportka,
} from '@kontrola-tiketu/jadro';
import { castkaZa, datumLosovani, dekodujEntity, naCastku, vylosovanaCisla } from './html.js';

export const ZAKLADNI_URL = 'https://www.allwyn.cz/system/vyherka';

export class ChybaParsovani extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = 'ChybaParsovani';
  }
}

const DNY: Readonly<Record<string, Den>> = {
  PONDĚLÍ: 'po',
  ÚTERÝ: 'ut',
  STŘEDA: 'st',
  ČTVRTEK: 'ct',
  PÁTEK: 'pa',
  SOBOTA: 'so',
  NEDĚLE: 'ne',
};

const SANCE_KLICE: Readonly<Record<string, PoradiKoncoveCislice>> = {
  šestičíslí: 'sestecisli',
  pětičíslí: 'peticisli',
  čtyřčíslí: 'ctyrcisli',
  trojčíslí: 'trojcisli',
  dvojčíslí: 'dvojcisli',
  'koncové číslo': 'koncove-cislo',
  'koncové číslo +/- 1': 'sousedni-cislo',
};

const NADPIS_SEKCE = /(SPORTKA|ŠANCE|EUROJACKPOT)\s+(NEDĚLE|PONDĚLÍ|ÚTERÝ|STŘEDA|ČTVRTEK|PÁTEK|SOBOTA)/g;

/**
 * Listina, u které Allwyn tabulku výher nezveřejnil.
 *
 * Není to chyba ani poškozený soubor — tažená čísla tam jsou, jen místo tabulky stojí tahle
 * věta. U starých tahů to zůstává natrvalo. Tah se proto přečte s prázdnou tabulkou; jádro
 * pak umí říct „tohle pořadí jsi trefil, ale částku neznám“, což je pravdivější než tah
 * zahodit a tvářit se, že se nelosovalo.
 */
const BEZ_TABULKY = 'Probíhá zpracování výsledků';
const NADPIS_TYDNE = /(\d+)\. SÁZKOVÝ TÝDEN ROK (\d{4})/g;

/** Sestaví adresu listiny. Jeden dotaz vrací všechny tahy daného týdne. */
export function sestavUrl(hra: Hra, rok: number, tyden: number): string {
  const parametry = new URLSearchParams({
    year: String(rok),
    week: String(tyden),
    game: hra,
  });
  return `${ZAKLADNI_URL}?${parametry.toString()}`;
}

/**
 * Listina bez dat. Allwyn na neexistující rok, budoucí týden i neplatnou hru vrací HTTP 200
 * s prázdnou listinou, takže se to nepozná podle stavového kódu.
 */
export function jePrazdna(html: string): boolean {
  return !dekodujEntity(html).includes('Losování dne');
}

interface Sekce {
  readonly typ: 'SPORTKA' | 'ŠANCE' | 'EUROJACKPOT';
  readonly den: Den;
  readonly obsah: string;
  readonly tyden: number;
  readonly rok: number;
}

/**
 * Rozdělí listinu na sekce a ke každé přiřadí sázkový týden z nejbližší hlavičky před ní.
 *
 * Týden se schválně nebere z parametrů dotazu: u roku 1994 vrací dotaz `week=10` listinu
 * nadepsanou jako 9. sázkový týden.
 */
function najdiSekce(html: string): Sekce[] {
  const text = dekodujEntity(html);

  const hlavicky = [...text.matchAll(NADPIS_TYDNE)].map((m) => ({
    pozice: m.index,
    tyden: Number(m[1]),
    rok: Number(m[2]),
  }));

  const nadpisy = [...text.matchAll(NADPIS_SEKCE)];

  return nadpisy.map((nadpis, i) => {
    const zacatek = nadpis.index;
    const konec = nadpisy[i + 1]?.index ?? text.length;
    const hlavicka = hlavicky.filter((h) => h.pozice < zacatek).at(-1);
    if (hlavicka === undefined) {
      throw new ChybaParsovani(`Sekce „${nadpis[0]}“ nemá před sebou hlavičku sázkového týdne.`);
    }
    return {
      typ: nadpis[1] as Sekce['typ'],
      den: DNY[nadpis[2]!]!,
      obsah: text.slice(zacatek, konec),
      tyden: hlavicka.tyden,
      rok: hlavicka.rok,
    };
  });
}

function radkyTabulky(usek: string, kotva: string, kde: string): Poradi[] {
  const zaKotvou = usek.split(kotva)[1];
  if (zaKotvou === undefined) {
    // Chybějící kotva u listiny bez tabulky není chyba — tabulka prostě není.
    if (usek.includes(BEZ_TABULKY)) return [];
    throw new ChybaParsovani(`${kde}: v listině chybí kotva ${kotva}.`);
  }
  const tabulka = zaKotvou.split('</table>')[0] ?? '';
  const vzor =
    /<td class="ac b2">\s*([-IVX]+)\s*<\/td>\s*<td class="ac b2">\s*([^<]+?)\s*<\/td>\s*<td class="ar b2">\s*(\d+)\s*<\/td>\s*<td class="ar b2">\s*([\d\s ]+)\s*Kč\s*<\/td>/g;

  return [...tabulka.matchAll(vzor)].map((m) => ({
    klic: m[1] === '-' ? 'bonus' : m[1]!,
    popis: m[2]!,
    pocetVyher: Number(m[3]),
    vyseVyhryKc: naCastku(m[4]!) ?? 0,
  }));
}

const PORADI_EJ: readonly PoradiEurojackpot[] = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
];
const PORADI_SPORTKA: readonly PoradiSportka[] = ['bonus', 'I', 'II', 'III', 'IV', 'V'];

function parsujEurojackpot(sekce: Sekce): TahEurojackpot {
  const datum = datumLosovani(sekce.obsah);
  if (datum === null) throw new ChybaParsovani('Sekce Eurojackpotu nemá datum losování.');

  const losy = vylosovanaCisla(sekce.obsah);
  const hlavni = losy[0];
  const extra = losy[1];
  if (hlavni?.length !== 7) {
    throw new ChybaParsovani(`${datum}: čekáno 5 čísel a 2 euročísla, nalezeno ${hlavni?.length}.`);
  }
  if (extra?.length !== 6) {
    throw new ChybaParsovani(`${datum}: Extra 6 nemá šest číslic (${extra?.length}).`);
  }

  const poradi = radkyTabulky(sekce.obsah, '<!-- vyhry -->', datum);
  const klice = poradi.map((p) => p.klic);
  const bezTabulky = poradi.length === 0 && sekce.obsah.includes(BEZ_TABULKY);

  // Prázdná tabulka se přijme, jen když to listina sama říká. Jinak by tichá změna
  // šablony vyrobila tahy bez částek a nikdo by si toho nevšiml.
  if (!bezTabulky && klice.join(',') !== PORADI_EJ.join(',')) {
    throw new ChybaParsovani(`${datum}: čekáno 12 pořadí I–XII, nalezeno ${klice.join(',')}.`);
  }

  return {
    hra: 'eurojackpot',
    datum,
    den: sekce.den,
    sazkovyTyden: { rok: sekce.rok, tyden: sekce.tyden },
    vsazenoKc: castkaZa(sekce.obsah, 'Vsazeno:') ?? 0,
    naVyhryKc: castkaZa(sekce.obsah, 'Na výhry:'),
    cisla: hlavni.slice(0, 5).map(Number),
    eurocisla: hlavni.slice(5).map(Number),
    extra6: extra.join(''),
    poradi: poradi as Poradi<PoradiEurojackpot>[],
    jackpotKc: castkaZa(sekce.obsah, 'JACKPOT:'),
  };
}

function parsujTahSportky(usek: string, kotva: string, cisla: string[], poradiTahu: 1 | 2): SportkaTah {
  const poradi = radkyTabulky(usek, kotva, `Sportka, ${poradiTahu}. tah`);
  const klice = poradi.map((p) => p.klic);
  const bezTabulky = poradi.length === 0 && usek.includes(BEZ_TABULKY);

  if (!bezTabulky && klice.join(',') !== PORADI_SPORTKA.join(',')) {
    throw new ChybaParsovani(`Sportka, ${poradiTahu}. tah: nečekaná pořadí ${klice.join(',')}.`);
  }
  return {
    poradiTahu,
    cisla: cisla.slice(0, 6).map(Number),
    dodatkove: Number(cisla[6]),
    poradi: poradi as Poradi<PoradiSportka>[],
    prevod1PoradiKc: castkaZa(usek, 'Převod 1. pořadí:'),
    jackpot1PoradiKc: castkaZa(usek, 'JACKPOT 1. pořadí:'),
    prevod2PoradiKc: castkaZa(usek, 'Převod 2. pořadí:'),
    jackpot2PoradiKc: castkaZa(usek, 'JACKPOT 2. pořadí:'),
  };
}

function parsujSportku(sekce: Sekce): TahSportka {
  const datum = datumLosovani(sekce.obsah);
  if (datum === null) throw new ChybaParsovani('Sekce Sportky nemá datum losování.');

  const losy = vylosovanaCisla(sekce.obsah);
  if (losy.length !== 2 || losy.some((l) => l.length !== 7)) {
    throw new ChybaParsovani(`${datum}: čekány dva tahy po 6 číslech a dodatkovém.`);
  }

  // Sekce druhého tahu začíná až u své kotvy, jinak by se převody obou tahů pletly.
  const casti = sekce.obsah.split('<!-- vyhry 2 tah. -->');
  if (casti.length < 2) {
    throw new ChybaParsovani(`${datum}: v listině chybí tabulka druhého tahu.`);
  }
  const prvni = casti[0]!;
  const druhy = `<!-- vyhry 2 tah. -->${casti.slice(1).join('<!-- vyhry 2 tah. -->')}`;

  return {
    hra: 'sportka',
    datum,
    den: sekce.den,
    sazkovyTyden: { rok: sekce.rok, tyden: sekce.tyden },
    vsazenoKc: castkaZa(sekce.obsah, 'Vsazeno:') ?? 0,
    naVyhryKc: castkaZa(sekce.obsah, 'Na výhry:'),
    tahy: [
      parsujTahSportky(prvni, '<!-- vyhry 1 tah. -->', losy[0]!, 1),
      parsujTahSportky(druhy, '<!-- vyhry 2 tah. -->', losy[1]!, 2),
    ],
    sance: null,
    prevodBonusKc: castkaZa(druhy, 'Převod Bonus:'),
    superJackpotKc: castkaZa(druhy, 'SuperJACKPOT:'),
  };
}

function parsujSanci(sekce: Sekce): LosovaniSance {
  const datum = datumLosovani(sekce.obsah);
  if (datum === null) throw new ChybaParsovani('Sekce Šance nemá datum losování.');

  const losy = vylosovanaCisla(sekce.obsah);
  if (losy[0]?.length !== 6) {
    throw new ChybaParsovani(`${datum}: Šance nemá šest vylosovaných číslic.`);
  }

  const tabulka = sekce.obsah.split('<!-- vyhry sance -->')[1]?.split('</table>')[0] ?? '';
  const vzor =
    /<span class="spn vsazenol">\s*([^<]+?)\s*<\/span>\s*(?:<span class="spn vsazenor">\s*(\d*)\s*<\/span>)?\s*<\/td>\s*<td class="ar b2">\s*(\d+)\s*<\/td>\s*<td class="ar b2">\s*([\d\s ]+)\s*Kč\s*<\/td>/g;

  const poradi: PoradiSance[] = [...tabulka.matchAll(vzor)].map((m) => {
    const popis = m[1]!;
    const klic = SANCE_KLICE[popis];
    if (klic === undefined) {
      throw new ChybaParsovani(`${datum}: neznámé pořadí Šance „${popis}“.`);
    }
    return {
      klic,
      popis,
      vzor: m[2] === undefined || m[2] === '' ? null : m[2],
      pocetVyher: Number(m[3]),
      vyseVyhryKc: naCastku(m[4]!) ?? 0,
    };
  });

  // Sedmé pořadí přibylo až později; starší listiny jich mají jen šest.
  if (poradi.length < 6 || poradi.length > 7) {
    throw new ChybaParsovani(`${datum}: Šance má ${poradi.length} pořadí, čekáno 6 nebo 7.`);
  }

  return {
    datum,
    cislice: losy[0].join(''),
    vsazenoKc: castkaZa(sekce.obsah, 'Vsazeno:') ?? 0,
    poradi,
  };
}

/**
 * Přečte celou listinu. Vrací tahy v pořadí, v jakém jsou v dokumentu, tedy chronologicky.
 * Šance se připojí ke slosování Sportky se shodným datem.
 */
export function parsujListinu(html: string): Tah[] {
  const sekce = najdiSekce(html);

  const sportky = new Map<string, TahSportka>();
  const tahy: Tah[] = [];

  for (const s of sekce) {
    if (s.typ === 'EUROJACKPOT') {
      tahy.push(parsujEurojackpot(s));
    } else if (s.typ === 'SPORTKA') {
      const tah = parsujSportku(s);
      sportky.set(tah.datum, tah);
      tahy.push(tah);
    }
  }

  for (const s of sekce) {
    if (s.typ !== 'ŠANCE') continue;
    const sance = parsujSanci(s);
    const tah = sportky.get(sance.datum);
    if (tah === undefined) {
      throw new ChybaParsovani(`Šance z ${sance.datum} nemá odpovídající slosování Sportky.`);
    }
    sportky.set(sance.datum, { ...tah, sance });
  }

  return tahy.map((t) => (t.hra === 'sportka' ? sportky.get(t.datum) ?? t : t));
}
