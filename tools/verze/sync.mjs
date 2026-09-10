#!/usr/bin/env node
// Sjednocené verzování celého repozitáře (docs/vydani.md, sekce "Postup vydání").
// Kořenové VERSION + CHANGELOG.md jsou jediný zdroj pravdy — tenhle skript z nich přepisuje
// osm commitovaných výstupů (pět package.json, versionCode/versionName v Android buildu,
// historii změn pro obrazovku "O aplikaci" a verzi PHP backendu). Spouští se `npm run verze`.
//
// Že generované soubory skutečně sedí se zdrojem, hlídá test/verze.test.ts. V předloze
// (~/pracovni/kvalita-cena) to dělá CI přes `git diff --exit-code`; tenhle projekt CI nemá,
// tak je pojistka v testech — stejně jako bezIO.test.ts a soukromi.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const KOREN = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const HLASKA = '// Generováno tools/verze/sync.mjs z kořenového VERSION — needituj ručně.';

/**
 * Části projektu, které smí stát v závorce na konci položky changelogu.
 * `build` je pro změny sestavování a vydávání — do repa patří, ale uživatel aplikace je
 * nemá jak poznat, tak se do historie v aplikaci nedostanou.
 */
export const CASTI = ['aplikace', 'jádro', 'fetcher', 'backend', 'build'];

/** package.json soubory, ve kterých se drží jedno společné číslo verze. */
const BALICKY = [
  'package.json',
  'app/package.json',
  'fetcher/package.json',
  'packages/jadro/package.json',
  'packages/ocr/package.json',
];

const GRADLE = 'app/android/app/build.gradle';
const HISTORIE_TS = 'app/src/app/data/verze.generated.ts';
const VERZE_PHP = 'backend/src/Verze.php';

const cti = (koren, relativni) => readFileSync(path.join(koren, relativni), 'utf8');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- Verze ---------------------------------------------------------------------------------

/** Rozloží "X.Y.Z" na složky a spočítá versionCode. Padá na čemkoli, co není SemVer. */
export function rozborVerze(verze) {
  const shoda = /^(\d+)\.(\d+)\.(\d+)$/.exec(verze);
  if (!shoda) {
    throw new Error(`VERSION musí být SemVer X.Y.Z, je: "${verze}"`);
  }
  const [major, minor, patch] = [shoda[1], shoda[2], shoda[3]].map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `versionCode = major*10000 + minor*100 + patch přetéká pro ${verze} — minor i patch musí být < 100`,
    );
  }
  // Google Play už nikdy nepřijme nižší versionCode než ten naposledy nahraný, takže musí
  // růst monotónně s verzí. Tenhle vzorec to zaručuje a zároveň je čitelný: 100 = 0.1.0.
  return { major, minor, patch, versionCode: major * 10000 + minor * 100 + patch };
}

// --- CHANGELOG.md --------------------------------------------------------------------------

const HLAVICKA_VYDANI = /^## \[(\d+\.\d+\.\d+)\] [–-] (\d{4}-\d{2}-\d{2})$/;
const HLAVICKA_SEKCE = /^### (.+)$/;
const POLOZKA = /^- (.+)$/;
const SUFFIX_CASTI = /^(.*?)\s*\(([^()]+)\)\s*$/;

/**
 * Naparsuje CHANGELOG.md na seznam vydání, nejnovější první. Sekce `## [Nezveřejněno]`
 * se přeskakuje — rozpracované změny do vydané aplikace nepatří.
 */
export function parsujChangelog(text) {
  const vydani = [];
  let vydaniAktualni = null;
  let sekce = null;
  let nezverejneno = false;

  for (const radek of text.split('\n')) {
    if (radek.trim() === '## [Nezveřejněno]') {
      nezverejneno = true;
      vydaniAktualni = null;
      sekce = null;
      continue;
    }
    const hlavicka = HLAVICKA_VYDANI.exec(radek);
    if (hlavicka) {
      nezverejneno = false;
      vydaniAktualni = { verze: hlavicka[1], datum: hlavicka[2], sekce: [] };
      vydani.push(vydaniAktualni);
      sekce = null;
      continue;
    }
    if (nezverejneno || !vydaniAktualni) continue;

    const hlavickaSekce = HLAVICKA_SEKCE.exec(radek);
    if (hlavickaSekce) {
      sekce = { nazev: hlavickaSekce[1].trim(), polozky: [] };
      vydaniAktualni.sekce.push(sekce);
      continue;
    }

    const polozka = POLOZKA.exec(radek);
    if (polozka && sekce) {
      sekce.polozky.push(rozdelPolozku(polozka[1]));
      continue;
    }

    // Cokoli neprázdného uvnitř vydání, co není hlavička ani položka, je nejspíš omylem
    // zalomená víceřádková položka — raději spadnout, než ji tiše uříznout.
    if (radek.trim() !== '') {
      throw new Error(
        `CHANGELOG.md: nerozpoznaný řádek uvnitř vydání ${vydaniAktualni.verze} — víceřádková ` +
          `položka? Každá položka musí být na jednom řádku. Řádek: "${radek}"`,
      );
    }
  }

  if (vydani.length === 0) {
    throw new Error('CHANGELOG.md neobsahuje žádné vydání ("## [X.Y.Z] – YYYY-MM-DD")');
  }
  return vydani;
}

/**
 * Oddělí od položky suffix se seznamem dotčených částí. Závorka na konci se bere jako
 * suffix jen tehdy, když je celá složená ze známých názvů částí — jinak je to obyčejný
 * text věty ("… (Eurojackpot, Sportka)") a rozdělit ho by byl tichý nesmysl.
 */
function rozdelPolozku(text) {
  const shoda = SUFFIX_CASTI.exec(text);
  if (!shoda) return { text: text.trim(), casti: [] };
  const kandidati = shoda[2].split(',').map((c) => c.trim());
  if (kandidati.length === 0 || !kandidati.every((c) => CASTI.includes(c))) {
    return { text: text.trim(), casti: [] };
  }
  return { text: shoda[1].trim(), casti: kandidati };
}

// --- Generování ----------------------------------------------------------------------------

/**
 * Spočítá obsah všech generovaných souborů. Nic nezapisuje — díky tomu se dá stejná funkce
 * použít při vydání i v testu, který jen porovnává výsledek proti disku.
 *
 * @returns {Map<string, string>} cesta relativní ke kořeni → celý obsah souboru
 */
export function generuj(koren = KOREN) {
  const verze = cti(koren, 'VERSION').trim();
  const { versionCode } = rozborVerze(verze);

  const vydani = parsujChangelog(cti(koren, 'CHANGELOG.md'));
  if (vydani[0].verze !== verze) {
    throw new Error(
      `CHANGELOG.md nemá sekci pro ${verze} — nejnovější vydání v CHANGELOG.md je ${vydani[0].verze}. ` +
        `Zapiš "## [${verze}] – YYYY-MM-DD" do CHANGELOG.md, nebo oprav VERSION.`,
    );
  }

  const vystup = new Map();

  // JSON nesnese komentář, takže se verze přepisuje bez doprovodné hlášky.
  for (const relativni of BALICKY) {
    const obsah = cti(koren, relativni);
    const pole = /^(\s*"version":\s*")[^"]*(",?)$/m;
    if (!pole.test(obsah)) {
      throw new Error(`${relativni}: nenašel jsem pole "version"`);
    }
    vystup.set(relativni, obsah.replace(pole, `$1${verze}$2`));
  }

  // Groovy, ne Kotlin DSL — mezi jménem a hodnotou není "=".
  {
    const obsah = cti(koren, GRADLE);
    const vzor = new RegExp(
      `(?:^( *)${escapeRegExp(HLASKA)}\\n)?^( *)versionCode \\d+\\n( *)versionName "[^"]*"$`,
      'm',
    );
    const shoda = vzor.exec(obsah);
    if (!shoda) {
      throw new Error(`${GRADLE}: nenašel jsem dvojici "versionCode"/"versionName"`);
    }
    const odsazeni = shoda[2] ?? shoda[1];
    vystup.set(
      GRADLE,
      obsah.replace(
        vzor,
        `${odsazeni}${HLASKA}\n${odsazeni}versionCode ${versionCode}\n${odsazeni}versionName "${verze}"`,
      ),
    );
  }

  vystup.set(HISTORIE_TS, historieProAplikaci(verze, vydani));
  vystup.set(VERZE_PHP, verzeBackendu(verze));
  return vystup;
}

/**
 * Historie pro obrazovku "O aplikaci". Generuje se jako TypeScript modul, ne jako JSON
 * v assetech (tak to dělá předloha) — aplikace pak nemusí za běhu nic číst ani stahovat,
 * což u appky bez síťového oprávnění dává větší smysl.
 */
function historieProAplikaci(verze, vydani) {
  // Prettier v app/ je nastavený na jednoduché uvozovky (app/.prettierrc), ať generovaný
  // soubor nevyčnívá a nesvádí někoho ho "opravit" ručně.
  const l = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

  const telo = vydani
    .map((v) => ({
      ...v,
      sekce: v.sekce
        .map((s) => ({
          nazev: s.nazev,
          // Uživatele mobilu nezajímá, co se změnilo v CLI na desktopu ani v buildu.
          polozky: s.polozky.filter((p) => p.casti.length === 0 || p.casti.includes('aplikace')),
        }))
        .filter((s) => s.polozky.length > 0),
    }))
    // Vydání, ve kterém se pro uživatele nezměnilo nic, se v aplikaci vůbec neukazuje —
    // prázdný nadpis pod "Co je nového" vypadá jako chyba.
    .filter((v) => v.sekce.length > 0)
    .map((v) => {
      const sekce = v.sekce
        .map(
          (s) =>
            `      {\n        nazev: ${l(s.nazev)},\n        polozky: [\n` +
            s.polozky.map((p) => `          ${l(p.text)},`).join('\n') +
            `\n        ],\n      },`,
        )
        .join('\n');
      return (
        `  {\n    verze: ${l(v.verze)},\n    datum: ${l(v.datum)},\n    sekce: [\n` +
        `${sekce}\n` +
        `    ],\n  },`
      );
    })
    .join('\n');

  return (
    '// Generováno tools/verze/sync.mjs z kořenového VERSION a CHANGELOG.md — needituj ručně.\n' +
    '// Zobrazuje obrazovka "O aplikaci" (app/src/app/obrazovky/o-aplikaci.ts). Jsou tu jen\n' +
    '// položky týkající se aplikace; změny fetcheru a jádra zůstávají v CHANGELOG.md.\n' +
    '\n' +
    'export interface SekceZmen {\n' +
    '  readonly nazev: string;\n' +
    '  readonly polozky: readonly string[];\n' +
    '}\n' +
    '\n' +
    'export interface Vydani {\n' +
    '  readonly verze: string;\n' +
    '  readonly datum: string;\n' +
    '  readonly sekce: readonly SekceZmen[];\n' +
    '}\n' +
    '\n' +
    `export const VERZE = ${l(verze)};\n` +
    '\n' +
    '/** Nejnovější vydání první. */\n' +
    'export const HISTORIE: readonly Vydani[] = [\n' +
    `${telo}\n` +
    '];\n'
  );
}

/**
 * Verze PHP backendu. Composer pole "version" nedoporučuje, a backend verzi potřebuje
 * za běhu — nese ji v User-Agentu, kterým se představuje Allwynu.
 */
function verzeBackendu(verze) {
  return (
    '<?php\n' +
    '\n' +
    '// Generováno tools/verze/sync.mjs z kořenového VERSION — needituj ručně.\n' +
    '\n' +
    'declare(strict_types=1);\n' +
    '\n' +
    'namespace KontrolaTiketu;\n' +
    '\n' +
    'final class Verze\n' +
    '{\n' +
    `    public const VERZE = '${verze}';\n` +
    '}\n'
  );
}

// --- Spuštění ------------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const soubory = generuj();
  for (const [relativni, obsah] of soubory) {
    writeFileSync(path.join(KOREN, relativni), obsah);
  }
  const { versionCode } = rozborVerze(cti(KOREN, 'VERSION').trim());
  console.log(
    `Verze synchronizována: ${cti(KOREN, 'VERSION').trim()} (versionCode ${versionCode}), ` +
      `${soubory.size} souborů.`,
  );
}
