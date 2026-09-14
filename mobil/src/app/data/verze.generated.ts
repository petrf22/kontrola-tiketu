// Generováno nastroje/verze/sync.mjs z kořenového VERSION a CHANGELOG.md — needituj ručně.
// Zobrazuje obrazovka "O aplikaci" (mobil/src/app/obrazovky/o-aplikaci.ts). Jsou tu jen
// položky týkající se aplikace; ostatní změny zůstávají v CHANGELOG.md.

export interface SekceZmen {
  readonly nazev: string;
  readonly polozky: readonly string[];
}

export interface Vydani {
  readonly verze: string;
  readonly datum: string;
  readonly sekce: readonly SekceZmen[];
}

export const VERZE = '0.3.0';

/** Nejnovější vydání první. */
export const HISTORIE: readonly Vydani[] = [
  {
    verze: '0.3.0',
    datum: '2026-09-14',
    sekce: [
      {
        nazev: 'Přidáno',
        polozky: [
          'Rozsah kontroly tiketu: začátek jde posunout do minulosti a konec smazat, takže se tiket se stejnými čísly kontroluje zpětně i s každým dalším losováním; takový tiket nese štítek „virtuální“',
          'Kontrolu bez konce jde v detailu tiketu ukončit k vybranému datu, znovu pustit nebo rozsah upravit; slosování bez výhry jsou u virtuálního tiketu sbalená',
          'Když se stejná sázka kontroluje dvěma tikety na stejná slosování, aplikace upozorní, že se výhry i vsazené částky započítají dvakrát',
          'Obrazovka Přehled s koláčovými grafy vsazeno × vyhráno — celkem a zvlášť pro Eurojackpot, Sportku a Euromiliony',
        ],
      },
    ],
  },
  {
    verze: '0.2.1',
    datum: '2026-09-14',
    sekce: [
      {
        nazev: 'Opraveno',
        polozky: [
          'Ruční zadání tiketu už po otevření nehlásí chyby prázdného sloupce; chyba pole se ukáže až po jeho opuštění nebo po stisku „Zkontrolovat tiket“ a řekne, ve kterém sloupci je',
          'Čísla, která rozpoznávač z fotky slepí dohromady (třeba euročísla „0203“ nebo „03NT“), se rozdělí po dvojicích místo toho, aby se ztratila; jednociferné číslo se označí k ověření, protože na tiketu je vždy dvojice číslic',
          'Datum losování se z fotky přečte i s běžnými záměnami písmen za číslice a bere se z řádku SLOSOVÁNÍ, ne z jiného data na tiketu',
          'Když se datum z fotky nepřečte, formulář už nepředvyplní dnešek, ale upozorní na to — tiket by se jinak vyhodnotil proti jinému tahu',
        ],
      },
      {
        nazev: 'Přidáno',
        polozky: [
          'Ve formuláři po focení jde rozbalit, co rozpoznávač z fotky přečetl mimo sloupce; zůstává jen na obrazovce a nikam se neukládá',
        ],
      },
    ],
  },
  {
    verze: '0.2.0',
    datum: '2026-09-13',
    sekce: [
      {
        nazev: 'Přidáno',
        polozky: [
          'Výsledky losování se po otevření aplikace stáhnou samy a na obrazovce výsledků je tlačítko „Stáhnout výsledky“; import souboru zůstává jako záloha',
          'Aplikace stahuje vždy všechny výsledky, pro každého stejně — na server nejde žádné vsazené číslo, sériové číslo tiketu ani nic, podle čeho by se dalo poznat, kdo se ptá',
          'V patičce je vidět, kdy server naposledy kontroloval losování a jestli se u některé hry ještě čeká na tabulku výher',
          'Euromiliony: tiket jde vyfotit i zadat ručně (7 čísel z 35 a 1 z 5) a aplikace ho vyhodnotí včetně Eurošance proti tabulce výher konkrétního tahu',
          'Při zadání tiketu jde vybrat, na které dny losování platí — Sportka středa, pátek, neděle, Eurojackpot úterý, pátek, Euromiliony úterý, sobota; tiket jen na neděle se tak vyhodnotí proti nedělním tahům, ne proti všem po sobě',
        ],
      },
      {
        nazev: 'Změněno',
        polozky: [
          'Aplikace žádá o přístup k internetu, ale spojit se umí jedině se serverem výsledků — jinam systém šifrované spojení nepustí; Googlí vrstva pro odesílání záznamů z ML Kitu je z aplikace odstraněná',
          'Import výsledků ukládá jen nové tahy místo přepisu celého seznamu',
          'Výsledky hry, kterou aplikace nezná, se při stažení přeskočí a zbytek se načte — přidání další hry na serveru už aplikaci nerozbije',
          'Import souboru počítá s ročním balíkem ze serveru výsledků; hlášky už neodkazují na desktopový fetcher',
        ],
      },
      {
        nazev: 'Opraveno',
        polozky: [
          'Výhra v Šanci nebo v Extra 6 se popisuje česky („trojčíslí“) místo klíčem z modelu („pořadí trojcisli“)',
          'V seznamu tiketů je zase název hry vlevo a částka vpravo; mřížka je stavěla obráceně',
          'Počet sloupců se skloňuje — „1 sloupec“, „3 sloupce“, „5 sloupců“',
        ],
      },
    ],
  },
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
