import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — generátor je záměrně prostý .mjs bez typů, aby šel spustit holým node.
import { CASTI, generuj, parsujChangelog, rozborVerze } from '../tools/verze/sync.mjs';

/**
 * Kořenový VERSION a CHANGELOG.md jsou zdroj pravdy o verzi; ostatní soubory z nich generuje
 * `npm run verze`. V předloze (~/pracovni/kvalita-cena) hlídá jejich soulad CI přes
 * `git diff --exit-code`. Tenhle projekt CI nemá, tak je pojistka tady — jinak by stačilo
 * zapomenout skript spustit a do Play by šel bundle s verzí, kterou nikdo nečekal.
 */

const KOREN = new URL('../', import.meta.url).pathname;
const cti = (relativni: string) => readFileSync(join(KOREN, relativni), 'utf8');

const GENEROVANE: Map<string, string> = generuj();

describe('generované soubory sedí se zdrojem', () => {
  it('generuje se právě osm souborů', () => {
    expect([...GENEROVANE.keys()].sort()).toEqual([
      'app/android/app/build.gradle',
      'app/package.json',
      'app/src/app/data/verze.generated.ts',
      'backend/src/Verze.php',
      'fetcher/package.json',
      'package.json',
      'packages/jadro/package.json',
      'packages/ocr/package.json',
    ]);
  });

  for (const [relativni, ocekavany] of GENEROVANE) {
    it(`${relativni} odpovídá VERSION a CHANGELOG.md`, () => {
      // Když tenhle test spadne, spusť `npm run verze` a výsledek commitni.
      expect(cti(relativni), `${relativni} — spusť \`npm run verze\``).toBe(ocekavany);
    });
  }

  it('versionName i versionCode v Android buildu odpovídají VERSION', () => {
    const verze = cti('VERSION').trim();
    const { versionCode } = rozborVerze(verze);
    const gradle = cti('app/android/app/build.gradle');
    expect(gradle).toContain(`versionCode ${versionCode}`);
    expect(gradle).toContain(`versionName "${verze}"`);
  });
});

describe('versionCode', () => {
  it('je major*10000 + minor*100 + patch', () => {
    expect(rozborVerze('0.1.0').versionCode).toBe(100);
    expect(rozborVerze('1.0.0').versionCode).toBe(10000);
    expect(rozborVerze('1.2.3').versionCode).toBe(10203);
  });

  it('roste monotónně s verzí — Play nikdy nepřijme nižší než naposledy nahraný', () => {
    const rada = ['0.1.0', '0.1.1', '0.2.0', '0.99.99', '1.0.0', '1.0.1', '2.0.0'];
    const kody = rada.map((v) => rozborVerze(v).versionCode);
    expect(kody).toEqual([...kody].sort((a, b) => a - b));
    expect(new Set(kody).size).toBe(kody.length);
  });

  it('padne na přetečení místo aby tiše vyrobil kolizi', () => {
    // 0.100.0 i 0.1.100 by daly 10000, tedy totéž co 1.0.0 — a Play by aktualizaci odmítl.
    expect(() => rozborVerze('0.100.0')).toThrow(/přetéká/);
    expect(() => rozborVerze('0.1.100')).toThrow(/přetéká/);
  });

  it('nepřijme něco, co není SemVer', () => {
    for (const spatne of ['1.0', 'v1.0.0', '1.0.0-beta', '']) {
      expect(() => rozborVerze(spatne), spatne).toThrow(/SemVer/);
    }
  });
});

describe('parser CHANGELOG.md', () => {
  const zaklad = [
    '## [0.2.0] – 2026-10-01',
    '',
    '### Přidáno',
    '- Něco nového (aplikace)',
    '',
    '## [0.1.0] – 2026-09-09',
    '',
    '### Opraveno',
    '- Něco opraveného (jádro)',
    '',
  ].join('\n');

  it('vrací vydání od nejnovějšího', () => {
    const vydani = parsujChangelog(zaklad);
    expect(vydani.map((v: { verze: string }) => v.verze)).toEqual(['0.2.0', '0.1.0']);
    expect(vydani[0].datum).toBe('2026-10-01');
    expect(vydani[0].sekce[0].nazev).toBe('Přidáno');
  });

  it('odděluje dotčené části od textu položky', () => {
    const [vydani] = parsujChangelog('## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Bilance (aplikace, jádro)\n');
    expect(vydani.sekce[0].polozky[0]).toEqual({ text: 'Bilance', casti: ['aplikace', 'jádro'] });
  });

  it('závorku s něčím jiným než názvy částí nechá být textem věty', () => {
    // Jinak by se z "(Eurojackpot, Sportka)" staly neexistující části a text by se uřízl.
    const [vydani] = parsujChangelog(
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Vyhodnocení obou her (Eurojackpot, Sportka)\n',
    );
    expect(vydani.sekce[0].polozky[0]).toEqual({
      text: 'Vyhodnocení obou her (Eurojackpot, Sportka)',
      casti: [],
    });
  });

  it('přeskočí rozpracovanou sekci Nezveřejněno', () => {
    const vydani = parsujChangelog(
      '## [Nezveřejněno]\n\n### Přidáno\n- Rozdělaná věc (aplikace)\n\n' + zaklad,
    );
    expect(vydani.map((v: { verze: string }) => v.verze)).toEqual(['0.2.0', '0.1.0']);
  });

  it('padne na víceřádkové položce místo aby ji uřízl', () => {
    const text = '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- První řádek\n  pokračování (aplikace)\n';
    expect(() => parsujChangelog(text)).toThrow(/víceřádková/);
  });

  it('nechá závorku být, když je v ní jen část neznámá', () => {
    const [vydani] = parsujChangelog(
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Něco (aplikace, marketing)\n',
    );
    expect(vydani.sekce[0].polozky[0].casti).toEqual([]);
  });

  it('padne, když v souboru není žádné vydání', () => {
    expect(() => parsujChangelog('# Změny\n\nZatím nic.\n')).toThrow(/žádné vydání/);
  });
});

describe('CHANGELOG.md tohoto repozitáře', () => {
  const vydani = parsujChangelog(cti('CHANGELOG.md'));

  it('má nejnovější vydání shodné s VERSION', () => {
    expect(vydani[0].verze).toBe(cti('VERSION').trim());
  });

  it('používá jen známé názvy částí', () => {
    for (const v of vydani) {
      for (const sekce of v.sekce) {
        for (const polozka of sekce.polozky) {
          for (const cast of polozka.casti) {
            expect(CASTI, `${v.verze}: "${polozka.text}"`).toContain(cast);
          }
        }
      }
    }
  });

  it('nemá dvě vydání se stejným číslem', () => {
    const verze = vydani.map((v: { verze: string }) => v.verze);
    expect(new Set(verze).size).toBe(verze.length);
  });
});

describe('generátor proti podvrženému kořeni', () => {
  /** Zkopíruje osm generovaných souborů do dočasného adresáře a podstrčí vlastní zdroj. */
  function docasnyKoren(verze: string, changelog: string): string {
    const koren = mkdtempSync(join(tmpdir(), 'verze-test-'));
    for (const relativni of GENEROVANE.keys()) {
      const cil = join(koren, relativni);
      mkdirSync(dirname(cil), { recursive: true });
      cpSync(join(KOREN, relativni), cil);
    }
    writeFileSync(join(koren, 'VERSION'), `${verze}\n`);
    writeFileSync(join(koren, 'CHANGELOG.md'), changelog);
    return koren;
  }

  const changelog = (verze: string) =>
    `# Změny\n\n## [${verze}] – 2026-09-09\n\n### Přidáno\n- Něco (aplikace)\n`;

  it('zapíše novou verzi do všech osmi souborů', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.2.3'));
    const soubory: Map<string, string> = generuj(koren);
    for (const [relativni, obsah] of soubory) {
      if (relativni.endsWith('.json')) {
        expect(JSON.parse(obsah).version, relativni).toBe('1.2.3');
      }
    }
    expect(soubory.get('app/android/app/build.gradle')).toContain('versionCode 10203');
    expect(soubory.get('app/android/app/build.gradle')).toContain('versionName "1.2.3"');
    expect(soubory.get('app/src/app/data/verze.generated.ts')).toContain("VERZE = '1.2.3'");
    expect(soubory.get('backend/src/Verze.php')).toContain("VERZE = '1.2.3'");
  });

  it('přepíše hlášku o generování, nezdvojí ji', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.2.3'));
    const jednou: Map<string, string> = generuj(koren);
    writeFileSync(
      join(koren, 'app/android/app/build.gradle'),
      jednou.get('app/android/app/build.gradle')!,
    );
    const podruhe: Map<string, string> = generuj(koren);
    const gradle = podruhe.get('app/android/app/build.gradle')!;
    expect(gradle.match(/Generováno tools\/verze\/sync\.mjs/g)).toHaveLength(1);
    expect(gradle).toBe(jednou.get('app/android/app/build.gradle'));
  });

  it('vydání beze změn pro uživatele se do aplikace vůbec nedostane', () => {
    // Oprava sestavování je pro uživatele neviditelná; prázdný nadpis pod „Co je nového“
    // by vypadal jako chyba.
    const changelog =
      '# Změny\n\n' +
      '## [0.2.0] – 2026-10-01\n\n### Opraveno\n- Něco v buildu (build)\n\n' +
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Něco viditelného (aplikace)\n';
    const koren = docasnyKoren('0.2.0', changelog);
    const ts: string = generuj(koren).get('app/src/app/data/verze.generated.ts')!;

    expect(ts).toContain("VERZE = '0.2.0'");
    expect(ts).not.toContain("verze: '0.2.0'");
    expect(ts).toContain("verze: '0.1.0'");
    expect(ts).not.toContain('Něco v buildu');
  });

  it('do aplikace nepustí změny fetcheru ani jádra', () => {
    const changelog =
      '# Změny\n\n## [0.3.0] – 2026-11-01\n\n### Přidáno\n' +
      '- Viditelná věc (aplikace)\n- Věc v CLI (fetcher)\n- Věc ve výpočtu (jádro)\n';
    const koren = docasnyKoren('0.3.0', changelog);
    const ts: string = generuj(koren).get('app/src/app/data/verze.generated.ts')!;

    expect(ts).toContain('Viditelná věc');
    expect(ts).not.toContain('Věc v CLI');
    expect(ts).not.toContain('Věc ve výpočtu');
  });

  it('padne, když CHANGELOG.md nemá sekci pro verzi z VERSION', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.0.0'));
    expect(() => generuj(koren)).toThrow(/nemá sekci pro 1\.2\.3/);
  });
});
