import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { CASTI, generuj, parsujChangelog, rozborVerze } from '../sync.mjs';

// Kořenový VERSION a CHANGELOG.md jsou zdroj pravdy o verzi; ostatní soubory z nich generuje
// `node nastroje/verze/sync.mjs`. V předloze (~/pracovni/kvalita-cena) hlídá jejich soulad CI
// přes `git diff --exit-code`. Tenhle projekt CI nemá, tak je pojistka tady — jinak by stačilo
// zapomenout skript spustit a do Play by šel bundle s verzí, kterou nikdo nečekal.
//
// Schválně `node:test` bez závislostí: nástroje nemají vlastní node_modules. Spouští se
// `node --test 'nastroje/**/*.test.mjs'` z kořene repozitáře.

const KOREN = new URL('../../../', import.meta.url).pathname;
const cti = (relativni) => readFileSync(join(KOREN, relativni), 'utf8');

const GENEROVANE = generuj();

describe('generované soubory sedí se zdrojem', () => {
  it('generují se právě čtyři soubory', () => {
    assert.deepEqual([...GENEROVANE.keys()].sort(), [
      'backend/src/Verze.php',
      'mobil/android/app/build.gradle',
      'mobil/package.json',
      'mobil/src/app/data/verze.generated.ts',
    ]);
  });

  for (const [relativni, ocekavany] of GENEROVANE) {
    it(`${relativni} odpovídá VERSION a CHANGELOG.md`, () => {
      // Když tenhle test spadne, spusť `node nastroje/verze/sync.mjs` a výsledek commitni.
      assert.equal(cti(relativni), ocekavany, `${relativni} — spusť \`node nastroje/verze/sync.mjs\``);
    });
  }

  it('versionName i versionCode v Android buildu odpovídají VERSION', () => {
    const verze = cti('VERSION').trim();
    const { versionCode } = rozborVerze(verze);
    const gradle = cti('mobil/android/app/build.gradle');
    assert.ok(gradle.includes(`versionCode ${versionCode}`));
    assert.ok(gradle.includes(`versionName "${verze}"`));
  });
});

describe('versionCode', () => {
  it('je major*10000 + minor*100 + patch', () => {
    assert.equal(rozborVerze('0.1.0').versionCode, 100);
    assert.equal(rozborVerze('1.0.0').versionCode, 10000);
    assert.equal(rozborVerze('1.2.3').versionCode, 10203);
  });

  it('roste monotónně s verzí — Play nikdy nepřijme nižší než naposledy nahraný', () => {
    const rada = ['0.1.0', '0.1.1', '0.2.0', '0.99.99', '1.0.0', '1.0.1', '2.0.0'];
    const kody = rada.map((v) => rozborVerze(v).versionCode);
    assert.deepEqual(kody, [...kody].sort((a, b) => a - b));
    assert.equal(new Set(kody).size, kody.length);
  });

  it('padne na přetečení místo aby tiše vyrobil kolizi', () => {
    // 0.100.0 i 0.1.100 by daly 10000, tedy totéž co 1.0.0 — a Play by aktualizaci odmítl.
    assert.throws(() => rozborVerze('0.100.0'), /přetéká/);
    assert.throws(() => rozborVerze('0.1.100'), /přetéká/);
  });

  it('nepřijme něco, co není SemVer', () => {
    for (const spatne of ['1.0', 'v1.0.0', '1.0.0-beta', '']) {
      assert.throws(() => rozborVerze(spatne), /SemVer/, spatne);
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
    assert.deepEqual(vydani.map((v) => v.verze), ['0.2.0', '0.1.0']);
    assert.equal(vydani[0].datum, '2026-10-01');
    assert.equal(vydani[0].sekce[0].nazev, 'Přidáno');
  });

  it('odděluje dotčené části od textu položky', () => {
    const [vydani] = parsujChangelog('## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Bilance (aplikace, jádro)\n');
    assert.deepEqual(vydani.sekce[0].polozky[0], { text: 'Bilance', casti: ['aplikace', 'jádro'] });
  });

  it('závorku s něčím jiným než názvy částí nechá být textem věty', () => {
    // Jinak by se z "(Eurojackpot, Sportka)" staly neexistující části a text by se uřízl.
    const [vydani] = parsujChangelog(
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Vyhodnocení obou her (Eurojackpot, Sportka)\n',
    );
    assert.deepEqual(vydani.sekce[0].polozky[0], {
      text: 'Vyhodnocení obou her (Eurojackpot, Sportka)',
      casti: [],
    });
  });

  it('přeskočí rozpracovanou sekci Nezveřejněno', () => {
    const vydani = parsujChangelog(
      '## [Nezveřejněno]\n\n### Přidáno\n- Rozdělaná věc (aplikace)\n\n' + zaklad,
    );
    assert.deepEqual(vydani.map((v) => v.verze), ['0.2.0', '0.1.0']);
  });

  it('padne na víceřádkové položce místo aby ji uřízl', () => {
    const text = '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- První řádek\n  pokračování (aplikace)\n';
    assert.throws(() => parsujChangelog(text), /víceřádková/);
  });

  it('nechá závorku být, když je v ní jen část neznámá', () => {
    const [vydani] = parsujChangelog(
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Něco (aplikace, marketing)\n',
    );
    assert.deepEqual(vydani.sekce[0].polozky[0].casti, []);
  });

  it('padne, když v souboru není žádné vydání', () => {
    assert.throws(() => parsujChangelog('# Změny\n\nZatím nic.\n'), /žádné vydání/);
  });
});

describe('CHANGELOG.md tohoto repozitáře', () => {
  const vydani = parsujChangelog(cti('CHANGELOG.md'));

  it('má nejnovější vydání shodné s VERSION', () => {
    assert.equal(vydani[0].verze, cti('VERSION').trim());
  });

  it('používá jen známé názvy částí', () => {
    for (const v of vydani) {
      for (const sekce of v.sekce) {
        for (const polozka of sekce.polozky) {
          for (const cast of polozka.casti) {
            assert.ok(CASTI.includes(cast), `${v.verze}: "${polozka.text}" — neznámá část ${cast}`);
          }
        }
      }
    }
  });

  it('nemá dvě vydání se stejným číslem', () => {
    const verze = vydani.map((v) => v.verze);
    assert.equal(new Set(verze).size, verze.length);
  });
});

describe('generátor proti podvrženému kořeni', () => {
  /** Zkopíruje generované soubory do dočasného adresáře a podstrčí vlastní zdroj. */
  function docasnyKoren(verze, changelog) {
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

  const changelog = (verze) =>
    `# Změny\n\n## [${verze}] – 2026-09-09\n\n### Přidáno\n- Něco (aplikace)\n`;

  it('zapíše novou verzi do všech čtyř souborů', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.2.3'));
    const soubory = generuj(koren);
    for (const [relativni, obsah] of soubory) {
      if (relativni.endsWith('.json')) {
        assert.equal(JSON.parse(obsah).version, '1.2.3', relativni);
      }
    }
    assert.ok(soubory.get('mobil/android/app/build.gradle').includes('versionCode 10203'));
    assert.ok(soubory.get('mobil/android/app/build.gradle').includes('versionName "1.2.3"'));
    assert.ok(soubory.get('mobil/src/app/data/verze.generated.ts').includes("VERZE = '1.2.3'"));
    assert.ok(soubory.get('backend/src/Verze.php').includes("VERZE = '1.2.3'"));
  });

  it('přepíše hlášku o generování, nezdvojí ji', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.2.3'));
    const jednou = generuj(koren);
    writeFileSync(join(koren, 'mobil/android/app/build.gradle'), jednou.get('mobil/android/app/build.gradle'));
    const podruhe = generuj(koren);
    const gradle = podruhe.get('mobil/android/app/build.gradle');
    assert.equal(gradle.match(/Generováno nastroje\/verze\/sync\.mjs/g)?.length, 1);
    assert.equal(gradle, jednou.get('mobil/android/app/build.gradle'));
  });

  it('vydání beze změn pro uživatele se do aplikace vůbec nedostane', () => {
    // Oprava sestavování je pro uživatele neviditelná; prázdný nadpis pod „Co je nového“
    // by vypadal jako chyba.
    const changelog =
      '# Změny\n\n' +
      '## [0.2.0] – 2026-10-01\n\n### Opraveno\n- Něco v buildu (build)\n\n' +
      '## [0.1.0] – 2026-09-09\n\n### Přidáno\n- Něco viditelného (aplikace)\n';
    const koren = docasnyKoren('0.2.0', changelog);
    const ts = generuj(koren).get('mobil/src/app/data/verze.generated.ts');

    assert.ok(ts.includes("VERZE = '0.2.0'"));
    assert.ok(!ts.includes("verze: '0.2.0'"));
    assert.ok(ts.includes("verze: '0.1.0'"));
    assert.ok(!ts.includes('Něco v buildu'));
  });

  it('do aplikace nepustí změny backendu ani jádra', () => {
    const changelog =
      '# Změny\n\n## [0.3.0] – 2026-11-01\n\n### Přidáno\n' +
      '- Viditelná věc (aplikace)\n- Věc na serveru (backend)\n- Věc ve výpočtu (jádro)\n';
    const koren = docasnyKoren('0.3.0', changelog);
    const ts = generuj(koren).get('mobil/src/app/data/verze.generated.ts');

    assert.ok(ts.includes('Viditelná věc'));
    assert.ok(!ts.includes('Věc na serveru'));
    assert.ok(!ts.includes('Věc ve výpočtu'));
  });

  it('padne, když CHANGELOG.md nemá sekci pro verzi z VERSION', () => {
    const koren = docasnyKoren('1.2.3', changelog('1.0.0'));
    assert.throws(() => generuj(koren), /nemá sekci pro 1\.2\.3/);
  });
});
