import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tah } from '@kontrola-tiketu/jadro';
import { nactiZArchivu, seznamArchivu } from '../fetcher/src/archiv.js';
import { jePrazdna, parsujListinu } from '../fetcher/src/zdroje/allwyn-vyherka.js';
import { sestavVystup } from '../fetcher/src/vystup.js';

/**
 * Most mezi `npm test` a PHP backendem.
 *
 * Parser listiny existuje dvakrát — v TypeScriptu (fetcher) a v PHP (backend na hostingu).
 * Kdyby se testy backendu pouštěly jen ručně, oprava parseru ve fetcheru by se s PHP potichu
 * rozešla a první, kdo by si toho všiml, by byl uživatel se špatně vyhodnoceným tiketem.
 *
 * Bez PHP nebo bez `composer install` v `backend/` se testy přeskočí — stejně jako kontrola
 * APK v `app/test/soukromi.test.ts`, když APK není sestavené.
 */

const KOREN = new URL('../', import.meta.url).pathname;
const BACKEND = join(KOREN, 'backend');
const ARCHIV = join(KOREN, 'fetcher/.cache');

const maPhp = spawnSync('php', ['--version']).status === 0;
const lzeTestovat = maPhp && existsSync(join(BACKEND, 'vendor/autoload.php'));

describe('PHP backend', () => {
  it.skipIf(!lzeTestovat)('prochází vlastními testy', () => {
    const beh = spawnSync('php', ['vendor/bin/phpunit', '--colors=never'], {
      cwd: BACKEND,
      encoding: 'utf8',
    });
    expect(beh.status, `${beh.stdout}\n${beh.stderr}`).toBe(0);
  }, 120_000);

  /**
   * Nejsilnější kontrola portu: oba parsery nad **stejným** archivem musí vyrobit bajt po bajtu
   * stejný soubor. Archiv je v `.gitignore`, bez něj se test přeskočí.
   */
  it.skipIf(!lzeTestovat || !existsSync(ARCHIV))(
    'ze stejného archivu vyrobí bajt po bajtu totéž co fetcher',
    async () => {
      const tahy: Tah[] = [];
      for (const zaznam of await seznamArchivu(ARCHIV)) {
        const html = await nactiZArchivu(ARCHIV, zaznam);
        if (html === null || jePrazdna(html)) continue;
        tahy.push(...parsujListinu(html));
      }
      const sazby = JSON.parse(readFileSync(join(KOREN, 'data/sazby-extra6.json'), 'utf8')).sazby;

      const docasny = mkdtempSync(join(tmpdir(), 'kontrola-tiketu-'));
      try {
        const cil = join(docasny, 'php.json');
        execFileSync(
          'php',
          ['bin/vyherka', 'preparsuj', '--archiv', ARCHIV, '--sazby', join(KOREN, 'data/sazby-extra6.json'), '--out', cil],
          { cwd: BACKEND, stdio: ['ignore', 'ignore', 'pipe'] },
        );
        const php = readFileSync(cil, 'utf8');

        const zaznamy = await seznamArchivu(ARCHIV);
        const prvni = zaznamy[0]!;
        const posledni = zaznamy.at(-1)!;
        const ts = sestavVystup(
          tahy,
          sazby,
          { od: prvni, do: posledni },
          new Date(JSON.parse(php).vygenerovano),
        );
        const tsText = `${JSON.stringify(ts, null, 2)}\n`;

        expect(tahy.length).toBeGreaterThan(1000);
        // Přes toBe(), ne toEqual(): jde o bajty, včetně pořadí klíčů a zápisu čísel.
        // Rozdíl se hlásí prvním rozdílným řádkem, diff megabajtových řetězců by nikdo nečetl.
        if (php !== tsText) {
          const a = tsText.split('\n');
          const b = php.split('\n');
          const radek = a.findIndex((r, i) => r !== b[i]);
          expect(b[radek], `řádek ${radek + 1}`).toBe(a[radek]);
        }
      } finally {
        rmSync(docasny, { recursive: true, force: true });
      }
    },
    180_000,
  );

  it('fixtury backendu jsou tytéž listiny jako fixtury fetcheru', () => {
    // Backend žádné vlastní kopie nemá; kdyby nějaké přibyly, rozejdou se.
    expect(existsSync(join(BACKEND, 'tests/fixtures'))).toBe(false);
    expect(readdirSync(join(KOREN, 'fetcher/test/fixtures')).some((j) => j.endsWith('.html.gz'))).toBe(true);
  });
});
