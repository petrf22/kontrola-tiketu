#!/usr/bin/env node
/*
 * Generátor screenshotů pro Google Play.
 *
 * Fotí se aplikace běžící v prohlížeči (`cd app && npx ng serve`), ne na telefonu: tam je
 * systémový snímek černý kvůli FLAG_SECURE, což je akceptační kritérium soukromí a kvůli
 * obrázkům se obcházet nebude. V prohlížeči běží tentýž kód i HTML jako ve webview.
 *
 * Chrome se ovládá přes DevTools Protocol, který Node obslouží vestavěným WebSocketem —
 * schválně bez Playwrightu a jiných závislostí.
 *
 * Předpoklady:
 *   cd app && npx ng serve                                    (aplikace na :4200)
 *   cd backend && php -S localhost:8080 -t public tools/vyvojovy-server.php
 *
 * Postup je v docs/vydani.md, sekce „Screenshoty“.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZDE = dirname(fileURLToPath(import.meta.url));
const ADRESA = process.env.ADRESA_APLIKACE ?? 'http://localhost:4200';
const PORT = Number(process.env.PORT_CHROME ?? 9222);

/*
 * 432×768 při hustotě 2,5 dá snímek 1080×1920. Play chce delší stranu nejvýš dvojnásobek
 * kratší, takže 9:16 projde; 1080 px je zároveň minimum pro propagaci.
 *
 * Šířka 432 px odpovídá dnešnímu telefonu (Xiaomi 14T Pro má 443). Při užších 360 px se
 * nabídka lámala na dva řádky a obsah vypadal zvětšeně.
 */
const SIRKA = 432;
const VYSKA = 768;
const HUSTOTA = 2.5;

/*
 * Ukázkové tikety. Čísla jsou vymyšlená — žádný skutečný tiket uživatele — ale vyhodnocují
 * se proti reálným tahům z data/vysledky.json, takže všechny částky spočítá jádro z tabulky
 * výher konkrétního tahu. Nic se nevypisuje natvrdo.
 *
 * Eurojackpot 4. 9. 2026 (14 43 33 5 31 + 4 3, Extra 6 057739)
 *             8. 9. 2026 (47 14 27 34 36 + 4 3, Extra 6 912799)
 * Sportka     6. 9. 2026 (I. 35 28 15 13 37 11, II. 3 43 4 19 21 44, Šance 229511)
 *
 * Cena 400 Kč je částka ověřená na reálném tiketu (packages/ocr/test/cena.test.ts).
 */
const TIKETY = [
  {
    nazev: 'eurojackpot',
    hra: 'eurojackpot',
    prvni: '2026-09-04',
    pocet: 2,
    cena: '400',
    doplnkova: '384519', // koncová devítka padne v obou tazích
    sloupce: [
      { cisla: '8 14 27 34 47', euro: '4 11' }, // 8. 9.: čtyři čísla a jedno euročíslo
      { cisla: '5 21 31 38 43', euro: '7 11' }, // 4. 9.: tři čísla
      { cisla: '2 9 16 22 45', euro: '6 10' }, // bez výhry
      { cisla: '8 27 34 41 49', euro: '3 12' }, // 8. 9.: dvě čísla a jedno euročíslo
    ],
  },
  {
    nazev: 'sportka',
    hra: 'sportka',
    prvni: '2026-09-06',
    pocet: 1,
    cena: '',
    doplnkova: '486511', // trojčíslí proti vylosovanému 229511
    sloupce: [
      { cisla: '11 13 15 28 40 47', euro: '' }, // I. tah: čtyři čísla
      { cisla: '3 19 21 25 30 49', euro: '' }, // II. tah: tři čísla
      { cisla: '7 9 18 24 32 45', euro: '' }, // bez výhry
    ],
  },
];

/** Klient DevTools Protocolu. Jen tolik, kolik je potřeba: požadavek, odpověď, chyba. */
class Chrome {
  #ws;
  #posledniId = 0;
  #cekajici = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (zprava) => {
      const data = JSON.parse(zprava.data);
      const cekajici = this.#cekajici.get(data.id);
      if (cekajici === undefined) return;
      this.#cekajici.delete(data.id);
      if (data.error) cekajici.zamitni(new Error(JSON.stringify(data.error)));
      else cekajici.splni(data.result);
    });
  }

  static async pripoj(url) {
    const ws = new WebSocket(url);
    await new Promise((splni, zamitni) => {
      ws.addEventListener('open', splni, { once: true });
      ws.addEventListener('error', () => zamitni(new Error('Chrome nepřijal spojení.')), { once: true });
    });
    return new Chrome(ws);
  }

  posli(metoda, params = {}, sessionId) {
    const id = ++this.#posledniId;
    this.#ws.send(JSON.stringify({ id, method: metoda, params, sessionId }));
    return new Promise((splni, zamitni) => this.#cekajici.set(id, { splni, zamitni }));
  }
}

const pockej = (ms) => new Promise((splni) => setTimeout(splni, ms));

async function main() {
  const profil = mkdtempSync(join(tmpdir(), 'kontrola-tiketu-screenshoty-'));
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const adresaLadeni = await pockejNaChrome();
    const cdp = await Chrome.pripoj(adresaLadeni);
    const { targetId } = await cdp.posli('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.posli('Target.attachToTarget', { targetId, flatten: true });
    const posli = (metoda, params) => cdp.posli(metoda, params, sessionId);

    await posli('Page.enable');
    await posli('Runtime.enable');
    await posli('Emulation.setDeviceMetricsOverride', {
      width: SIRKA, height: VYSKA, deviceScaleFactor: HUSTOTA, mobile: true,
    });
    // Listing bude jednotný ve světlém režimu, i když aplikace umí i tmavý.
    await posli('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });

    await nafot(posli);
  } finally {
    // Nejdřív počkat, až Chrome opravdu skončí — jinak ještě dopisuje do profilu a úklid spadne.
    chrome.kill();
    await new Promise((splni) => chrome.once('exit', splni));
    rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

async function pockejNaChrome() {
  for (let pokus = 0; pokus < 100; pokus++) {
    try {
      const odpoved = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const { webSocketDebuggerUrl } = await odpoved.json();
      if (typeof webSocketDebuggerUrl === 'string') return webSocketDebuggerUrl;
    } catch {
      // Chrome ještě nenaběhl.
    }
    await pockej(100);
  }
  throw new Error('Chrome nenaběhl do deseti sekund.');
}

async function nafot(posli) {
  const vyhodnot = async (vyraz) => {
    const odpoved = await posli('Runtime.evaluate', {
      expression: vyraz, awaitPromise: true, returnByValue: true,
    });
    if (odpoved.exceptionDetails) {
      throw new Error(`${odpoved.exceptionDetails.text}\n${vyraz}`);
    }
    return odpoved.result.value;
  };

  const cekejNa = async (vyraz, popis, limitMs = 30_000) => {
    for (let cas = 0; cas < limitMs; cas += 100) {
      if (await vyhodnot(`!!(${vyraz})`)) return;
      await pockej(100);
    }
    throw new Error(`Nedočkal jsem se: ${popis}`);
  };

  const klikni = async (selektor) => {
    await vyhodnot(`document.querySelector(${JSON.stringify(selektor)}).click()`);
    await pockej(250);
  };

  const nastav = async (selektor, hodnota) => vyhodnot(`(() => {
    const prvek = document.querySelector(${JSON.stringify(selektor)});
    prvek.value = ${JSON.stringify(hodnota)};
    prvek.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

  const snimek = async (soubor) => {
    const { data } = await posli('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(ZDE, soubor), Buffer.from(data, 'base64'));
    console.log(`  ${soubor}`);
  };

  await posli('Page.navigate', { url: ADRESA });
  await cekejNa('document.querySelector("app-root nav")', 'načtení aplikace');

  /*
   * Varování „Běžíš v prohlížeči, kde se nic neukládá“ se na telefonu nikdy neobjeví —
   * maTrvaleUloziste() je tam true. Na screenshotu by lhalo, tak se skryje.
   */
  await vyhodnot(`(() => {
    const styl = document.createElement('style');
    styl.textContent = '.poplach { display: none !important; }';
    document.head.append(styl);
    return true;
  })()`);

  await cekejNa(
    'document.querySelector("footer")?.textContent.includes("Výsledky mám do")',
    'stažení výsledků z backendu',
  );

  console.log('Snímky:');
  for (const tiket of TIKETY) {
    await zalozTiket(tiket, { klikni, nastav, vyhodnot, cekejNa });
    await snimek(tiket.hra === 'eurojackpot' ? '02-detail-eurojackpot.png' : '03-detail-sportka.png');
  }

  await klikni('nav a[href="/"]');
  await cekejNa('document.querySelectorAll(".tikety li").length === 2', 'seznam obou tiketů');
  await snimek('01-seznam.png');

  await klikni('nav a[href="/import"]');
  await cekejNa('document.querySelector("button.stahnout")', 'obrazovka výsledků');
  await snimek('04-vysledky.png');

  await klikni('nav a[href="/o-aplikaci"]');
  await cekejNa('document.querySelector(".verze")', 'obrazovka o aplikaci');
  await snimek('05-o-aplikaci.png');
}

/** Projde ruční zadání tiketu stejnou cestou jako uživatel: vyplní formulář a odešle ho. */
async function zalozTiket(tiket, { klikni, nastav, vyhodnot, cekejNa }) {
  await klikni('nav a[href="/tiket/novy"]');
  await cekejNa('document.querySelector("form .sloupec")', 'formulář ručního zadání');

  if (tiket.hra === 'sportka') await klikni('input[name="hra"][value="sportka"]');

  await nastav('form input[type="date"]', tiket.prvni);
  await nastav('form .dvojice input[type="number"]', String(tiket.pocet));
  if (tiket.cena !== '') await nastav('form input[placeholder="např. 400"]', tiket.cena);
  await nastav('form input[maxlength="6"]', tiket.doplnkova);

  for (let i = 1; i < tiket.sloupce.length; i++) await klikni('button.pridat');

  await vyhodnot(`(() => {
    const sloupce = ${JSON.stringify(tiket.sloupce)};
    const radky = [...document.querySelectorAll('form .sloupec')];
    if (radky.length !== sloupce.length) throw new Error('Řádků je ' + radky.length);
    radky.forEach((radek, i) => {
      const zapis = (prvek, hodnota) => {
        prvek.value = hodnota;
        prvek.dispatchEvent(new Event('input', { bubbles: true }));
      };
      zapis(radek.querySelector('input[type="text"]:not(.euro)'), sloupce[i].cisla);
      const euro = radek.querySelector('input.euro');
      if (euro !== null) zapis(euro, sloupce[i].euro);
    });
    return true;
  })()`);

  await cekejNa('!document.querySelector("button.ulozit").disabled', 'tiket bez chyb');
  await vyhodnot('document.querySelector("form").requestSubmit()');
  await cekejNa('location.pathname.startsWith("/tiket/")', 'detail tiketu');
  await cekejNa('document.querySelector(".soucet")', 'vyhodnocení tiketu');
}

await main();

/*
 * Play odmítá průhlednost, takže se snímky převedou na 24bitové PNG — stejně jako ikona
 * listingu v tools/ikony/generuj.py.
 */
execFileSync('python3', [join(ZDE, 'bez-alfy.py')], { stdio: 'inherit' });
