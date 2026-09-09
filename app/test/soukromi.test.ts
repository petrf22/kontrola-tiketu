import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tvrdé požadavky na soukromí jsou podle zadání akceptační kritéria, ne doporučení.
 * Tenhle test je drží. Není to formalita: většina z nich se dá porušit jedním nedopatřením
 * — přidanou závislostí, znovuvygenerovaným manifestem po `cap add`, vypnutým FLAG_SECURE
 * kvůli ladění — a bez testu by si toho nikdo nevšiml až do vydání.
 */

const KOREN = new URL('../', import.meta.url).pathname;
const cti = (cesta: string) => readFileSync(join(KOREN, cesta), 'utf8');

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';

describe('Android manifest', () => {
  const manifest = cti(MANIFEST);

  it('nemá žádné síťové oprávnění', () => {
    // Řádky s tools:node="remove" oprávnění naopak odstraňují, ty se nepočítají.
    const pozadovana = [...manifest.matchAll(/<uses-permission[^>]*>/g)]
      .map((m) => m[0])
      .filter((r) => !r.includes('tools:node="remove"'));

    for (const radek of pozadovana) {
      expect(radek).not.toMatch(/INTERNET|ACCESS_NETWORK_STATE|ACCESS_WIFI_STATE/);
    }
  });

  it('INTERNET aktivně odstraňuje, aby ho nepřidala závislost oklikou', () => {
    expect(manifest).toMatch(
      /<uses-permission[^>]*android\.permission\.INTERNET[^>]*tools:node="remove"/,
    );
  });

  it('žádá jen o kameru', () => {
    // Musí se brát celá značka, ne jen kus po android:name — jinak by se do porovnání
    // nedostalo tools:node="remove", které je až za ním.
    const pozadovana = [...manifest.matchAll(/<uses-permission\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((znacka) => !znacka.includes('tools:node="remove"'))
      .map((znacka) => /android:name="([^"]+)"/.exec(znacka)?.[1]);
    expect(pozadovana).toEqual(['android.permission.CAMERA']);
  });

  it('zakazuje zálohování', () => {
    expect(manifest).toMatch(/android:allowBackup="false"/);
    expect(manifest).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
    expect(manifest).toMatch(/android:fullBackupContent="@xml\/backup_rules"/);
  });

  it('nepovoluje nešifrovaný provoz', () => {
    expect(manifest).toMatch(/android:usesCleartextTraffic="false"/);
  });

  it('nevystavuje FileProvider ven', () => {
    expect(manifest).toMatch(/FileProvider[\s\S]{0,200}android:exported="false"/);
  });
});

describe('pravidla zálohování', () => {
  it('nemají jedinou výjimku — nic nesmí do cloudové zálohy', () => {
    for (const soubor of ['res/xml/data_extraction_rules.xml', 'res/xml/backup_rules.xml']) {
      const obsah = cti(join('android/app/src/main', soubor));
      expect(obsah, soubor).not.toMatch(/<include\b/);
      expect(obsah, soubor).toMatch(/<exclude\b/);
    }
  });

  it('vylučují i databázi, kde budou tikety', () => {
    const pravidla = cti('android/app/src/main/res/xml/data_extraction_rules.xml');
    for (const domena of ['root', 'database', 'sharedpref', 'file', 'external']) {
      expect(pravidla, domena).toMatch(new RegExp(`domain="${domena}"`));
    }
  });
});

describe('ochrana obrazovky', () => {
  it('aktivita nastavuje FLAG_SECURE ještě před vykreslením', () => {
    const aktivita = cti('android/app/src/main/java/cz/petrf22/kontrolatiketu/MainActivity.java');
    expect(aktivita).toMatch(/FLAG_SECURE/);
    // Musí být před super.onCreate, jinak stihne problikne obsah.
    expect(aktivita.indexOf('FLAG_SECURE')).toBeLessThan(aktivita.indexOf('super.onCreate'));
  });
});

describe('žádná telemetrie', () => {
  const balik = JSON.parse(cti('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const vsechny = Object.keys({ ...balik.dependencies, ...balik.devDependencies });

  it('ani v závislostech, ani ve vývojových', () => {
    const podezrele = /analytics|firebase|crashlytics|sentry|bugsnag|amplitude|mixpanel|posthog|gtag|datadog/i;
    for (const zavislost of vsechny) {
      expect(zavislost, zavislost).not.toMatch(podezrele);
    }
  });

  it('Angular CLI má vypnuté odesílání statistik', () => {
    const angular = JSON.parse(cti('angular.json')) as { cli?: { analytics?: unknown } };
    expect(angular.cli?.analytics).toBe(false);
  });

  it('Capacitor nemá nastavený server — to by aplikaci pustilo na síť', () => {
    expect(cti('capacitor.config.ts')).not.toMatch(/^\s*server\s*:/m);
  });
});

/**
 * Kontrola nad sestavenou aplikací. Manifest ve zdrojácích může být v pořádku a přesto se
 * do APK dostane oprávnění ze závislosti, takže tohle je ta skutečná záruka. Když APK
 * sestavené není, test se přeskočí — nechceme nutit build při každém běhu testů.
 */
describe('sestavené APK', () => {
  const apk = join(KOREN, 'android/app/build/outputs/apk/debug/app-debug.apk');
  const buildTools = join(homedir(), 'Android/Sdk/build-tools');
  const aapt2 = existsSync(buildTools)
    ? readdirSync(buildTools).sort().reverse().map((v) => join(buildTools, v, 'aapt2')).find(existsSync)
    : undefined;

  const lzeOverit = existsSync(apk) && aapt2 !== undefined;

  it.skipIf(!lzeOverit)('neobsahuje jedinou síťovou permission', () => {
    const vypis = execFileSync(aapt2!, ['dump', 'permissions', apk], { encoding: 'utf8' });
    expect(vypis).not.toMatch(/INTERNET|ACCESS_NETWORK_STATE|ACCESS_WIFI_STATE/);
    expect(vypis).toMatch(/android\.permission\.CAMERA/);
  });
});
