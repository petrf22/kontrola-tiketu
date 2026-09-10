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

/** Komponenty Googlí přenosové vrstvy, které si vtahuje ML Kit (docs/vydani.md). */
const DATATRANSPORT = [
  'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
  'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
  'com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver',
];

describe('Android manifest', () => {
  const manifest = cti(MANIFEST);

  /** Požadovaná oprávnění — řádky s tools:node="remove" je naopak odstraňují. */
  const pozadovana = () =>
    // Musí se brát celá značka, ne jen kus po android:name — jinak by se do porovnání
    // nedostalo tools:node="remove", které je až za ním.
    [...manifest.matchAll(/<uses-permission\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((znacka) => !znacka.includes('tools:node="remove"'))
      .map((znacka) => /android:name="([^"]+)"/.exec(znacka)?.[1]);

  it('žádá právě o kameru a o internet, nic víc', () => {
    // INTERNET je tu kvůli stažení výsledků (docs/backend.md). Kam smí spojení vést,
    // hlídá blok „síťový allowlist“ níž.
    expect(pozadovana()).toEqual(['android.permission.CAMERA', 'android.permission.INTERNET']);
  });

  it('stav sítě aktivně odstraňuje, aby ho nepřidala závislost oklikou', () => {
    for (const opravneni of ['ACCESS_NETWORK_STATE', 'ACCESS_WIFI_STATE']) {
      expect(manifest).toMatch(
        new RegExp(`<uses-permission[^>]*android\\.permission\\.${opravneni}[^>]*tools:node="remove"`),
      );
    }
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

/**
 * Síťový allowlist — náhrada za záruku, kterou dřív dávala absence oprávnění INTERNET.
 *
 * V závislostech je Googlí přenosová vrstva pro odesílání záznamů (datatransport z ML Kitu).
 * Dokud aplikace neměla INTERNET, nemohla nic odeslat. Teď to drží dvě věci: TLS projde
 * jedině na server výsledků a ta vrstva je z manifestu odstraněná.
 */
describe('síťový allowlist', () => {
  const manifest = cti(MANIFEST);
  const konfigurace = cti('android/app/src/main/res/xml/network_security_config.xml').replace(
    /<!--[\s\S]*?-->/g,
    '',
  );

  it('manifest se na něj odkazuje', () => {
    expect(manifest).toMatch(/android:networkSecurityConfig="@xml\/network_security_config"/);
  });

  it('základ nedůvěřuje žádné certifikační autoritě', () => {
    const zaklad = /<base-config\b[^>]*>([\s\S]*?)<\/base-config>/.exec(konfigurace);
    expect(zaklad?.[0]).toMatch(/cleartextTrafficPermitted="false"/);
    expect(zaklad?.[1]).toMatch(/<trust-anchors\s*\/>/);
    expect(zaklad?.[1]).not.toMatch(/<certificates/);
  });

  it('výjimka je právě jedna, bez subdomén, a jen se systémovými autoritami', () => {
    const domeny = [...konfigurace.matchAll(/<domain\b([^>]*)>([^<]+)<\/domain>/g)];
    expect(domeny).toHaveLength(1);
    expect(domeny[0]![1]).toMatch(/includeSubdomains="false"/);
    expect(konfigurace).not.toMatch(/src="user"/);
    expect(konfigurace).not.toMatch(/cleartextTrafficPermitted="true"/);
    expect(konfigurace).not.toMatch(/<debug-overrides/);
  });

  it('výjimka je přesně ta doména, na kterou aplikace posílá dotazy', () => {
    const adresa = /ZAKLADNI_URL = '([^']+)'/.exec(cti('src/app/data/adresa-backendu.ts'))?.[1] ?? '';
    const domena = /<domain\b[^>]*>([^<]+)<\/domain>/.exec(konfigurace)?.[1]?.trim();
    expect(new URL(adresa).protocol).toBe('https:');
    expect(domena).toBe(new URL(adresa).hostname);
  });

  it('Googlí vrstva pro odesílání záznamů je ze sloučeného manifestu odstraněná', () => {
    for (const komponenta of DATATRANSPORT) {
      expect(manifest, komponenta).toMatch(
        new RegExp(`android:name="${komponenta.replace(/\./g, '\\.')}"\\s*tools:node="remove"`),
      );
    }
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

describe('sken nesahá na síť', () => {
  const obrazovka = cti('src/app/obrazovky/sken.ts');

  it('používá proudový režim, ne modul stahovaný z Google Play', () => {
    // BarcodeScanner.scan() jede přes play-services-code-scanner, který se stahuje ze sítě.
    expect(obrazovka).toMatch(/startScan\(/);
    expect(obrazovka).not.toMatch(/BarcodeScanner\.scan\(/);
    expect(obrazovka).not.toMatch(/installGoogleBarcodeScannerModule/);
  });

  it('čtečka má model přibalený v aplikaci, ne stahovaný z Play', () => {
    const gradle = readFileSync(
      join(KOREN, '../node_modules/@capacitor-mlkit/barcode-scanning/android/build.gradle'),
      'utf8',
    );
    expect(gradle).toMatch(/com\.google\.mlkit:barcode-scanning/);
    expect(gradle).not.toMatch(/play-services-mlkit-barcode-scanning/);
  });

});

/**
 * Ukládání snímku do privátní cache je vědomá odchylka od původního zadání
 * (viz docs/ocr-a-carovy-kod.md). Podmínkou bylo, že snímek nikdy neskončí v galerii
 * a vždycky se smaže. Tyhle testy z té podmínky dělají něco vymahatelného.
 */
describe('snímek tiketu se neukládá natrvalo', () => {
  it('focení nikdy neukládá do galerie', () => {
    const napojeni = cti('src/app/data/snimekTiketu-capacitor.ts');
    expect(napojeni).toMatch(/saveToGallery:\s*false/);
    expect(napojeni).not.toMatch(/saveToGallery:\s*true/);
  });

  it('bere snímek z kamery, ne z galerie', () => {
    const napojeni = cti('src/app/data/snimekTiketu-capacitor.ts');
    expect(napojeni).toMatch(/CameraSource\.Camera/);
    expect(napojeni).not.toMatch(/CameraSource\.(Photos|Prompt)/);
  });

  it('úklid dočasného souboru je ve finally, ne na šťastné cestě', () => {
    // Chování hlídají testy v snimekTiketu.test.ts; tohle drží tvar, na kterém stojí.
    const postup = cti('src/app/data/snimekTiketu.ts');
    expect(postup).toMatch(/finally\s*\{/);
    expect(postup).toMatch(/ukliď/);
  });
});

/**
 * Kontrola nad sestavenou aplikací. Manifest ve zdrojácích může být v pořádku a přesto se
 * do APK dostane oprávnění ze závislosti, takže tohle je ta skutečná záruka. Když APK
 * sestavené není, test se přeskočí — nechceme nutit build při každém běhu testů.
 */
describe('sestavené APK', () => {
  // Po rozdělení podle architektur vzniká víc APK; ověří se to, které je po ruce.
  // Sáhne se i po release, protože právě ten se instaluje na telefon.
  const apk = ['release', 'debug']
    .flatMap((varianta) => {
      const adresar = join(KOREN, `android/app/build/outputs/apk/${varianta}`);
      return existsSync(adresar)
        ? readdirSync(adresar)
            .filter((j) => j.endsWith('.apk'))
            .map((j) => join(adresar, j))
        : [];
    })
    .find(existsSync) ?? '';
  const buildTools = join(homedir(), 'Android/Sdk/build-tools');
  const aapt2 = existsSync(buildTools)
    ? readdirSync(buildTools).sort().reverse().map((v) => join(buildTools, v, 'aapt2')).find(existsSync)
    : undefined;

  const lzeOverit = apk !== '' && existsSync(apk) && aapt2 !== undefined;

  /**
   * Kontroluje se přesný seznam oprávnění — ne jen že chybí ty nežádoucí.
   *
   * Původní volnější verze tohohle testu prošla i ve chvíli, kdy si SQLite plugin přitáhl
   * USE_BIOMETRIC a USE_FINGERPRINT. Ať to test hlídá doslova.
   */
  it.skipIf(!lzeOverit)('má právě dvě oprávnění: kameru a internet', () => {
    const vypis = execFileSync(aapt2!, ['dump', 'permissions', apk], { encoding: 'utf8' });

    const balik = /package: (\S+)/.exec(vypis)?.[1] ?? '';
    const pozadovana = [...vypis.matchAll(/uses-permission: name='([^']+)'/g)]
      .map((m) => m[1]!)
      // Capacitor si generuje vlastní podpisové oprávnění pro interní broadcast,
      // není systémové a nic nezpřístupňuje ven.
      .filter((p) => !p.startsWith(balik));

    expect(pozadovana).toEqual(['android.permission.CAMERA', 'android.permission.INTERNET']);
  });

  it.skipIf(!lzeOverit)('nese síťový allowlist a nemá Googlí vrstvu pro odesílání záznamů', () => {
    const strom = execFileSync(aapt2!, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], {
      encoding: 'utf8',
    });
    expect(strom).toMatch(/networkSecurityConfig/);
    for (const komponenta of DATATRANSPORT) {
      expect(strom, komponenta).not.toContain(komponenta);
    }
  });
});
