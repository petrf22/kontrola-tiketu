// Generováno tools/verze/sync.mjs z kořenového VERSION a CHANGELOG.md — needituj ručně.
// Zobrazuje obrazovka "O aplikaci" (app/src/app/obrazovky/o-aplikaci.ts). Jsou tu jen
// položky týkající se aplikace; změny fetcheru a jádra zůstávají v CHANGELOG.md.

export interface SekceZmen {
  readonly nazev: string;
  readonly polozky: readonly string[];
}

export interface Vydani {
  readonly verze: string;
  readonly datum: string;
  readonly sekce: readonly SekceZmen[];
}

export const VERZE = '0.1.0';

/** Nejnovější vydání první. */
export const HISTORIE: readonly Vydani[] = [
  {
    verze: '0.1.0',
    datum: '2026-09-09',
    sekce: [
      {
        nazev: 'Přidáno',
        polozky: [
          'Vyfocení tiketu: jedna fotka přečte čísla ve sloupcích, doplňkovou hru Extra 6 i sériové číslo z čárového kódu',
          'Sken samotného čárového kódu pro případ, že fotka kód nezachytí nebo snímek pořizovat nechceš',
          'Ruční zadání tiketu, když se ho nepodaří přečíst ani jedním způsobem',
          'Seznam tiketů se souhrnem výhry a detail s rozpisem po sloupcích a jednotlivých losováních',
          'Bilance tiketu: kolik stál a kolik zatím vynesl',
          'Import výsledků losování ze souboru — aplikace si o ně sama nikam nechodí',
          'Obrazovka „O aplikaci“ s číslem verze, historií změn a přehledem toho, co aplikace o uživateli neví',
          'Šifrovaná databáze SQLCipher s klíčem v Android Keystore',
          'Aplikace nemá oprávnění k síti, takže se provozovatel loterie nemá jak dozvědět, že zrovna ty sázíš nebo jsi vyhrál',
          'Snímek pořízený pro rozpoznání textu žije jen v privátní cache, maže se i při chybě a do galerie se nedostane',
          'Číslo klubové karty, které je v čárovém kódu čitelné, se rovnou zahazuje — neukládá se ani nezobrazuje',
        ],
      },
    ],
  },
];
