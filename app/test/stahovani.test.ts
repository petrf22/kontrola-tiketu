import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  adresaBaliku,
  NecekanyTypObsahu,
  prectiManifest,
  sha256,
  stahniVysledky,
  ZAKLADNI_URL,
  type Odpoved,
  type Sit,
} from '../src/app/data/stahovani.js';
import { nactiVysledky } from '../src/app/data/import.js';

/**
 * Stahování proti atrapě sítě. Balík je skutečný výstup fetcheru — přesně tentýž formát
 * publikuje backend, takže test ověřuje, že spolu obě strany doopravdy mluví.
 */
const BALIK = readFileSync(new URL('fixtures/vysledky-2026-35-az-37.json', import.meta.url));
const HASH = `sha256:${createHash('sha256').update(BALIK).digest('hex')}`;

const bajty = (text: string) => new TextEncoder().encode(text);

function manifest(baliky: { soubor: string; hash: string }[], navic: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      verzeManifestu: 1,
      verzeFormatu: 1,
      vygenerovano: '2026-09-08T20:05:00.000Z',
      kontrola: {
        posledniDotaz: '2026-09-08T20:05:00.000Z',
        eurojackpot: { posledniTah: '2026-09-08', uplny: true },
        sportka: { posledniTah: '2026-09-06', uplny: false },
      },
      baliky: baliky.map((b) => ({ ...b, od: '2026-09-01', do: '2026-09-08', tahu: 6 })),
      ...navic,
    },
    null,
    2,
  )}\n`;
}

function sit(odpovedi: Record<string, Odpoved>) {
  const dotazy: string[] = [];
  const s: Sit = async (url) => {
    dotazy.push(url);
    const odpoved = odpovedi[url];
    if (odpoved === undefined) return { stav: 404, telo: new Uint8Array() };
    return odpoved;
  };
  return { s, dotazy };
}

const URL_MANIFESTU = `${ZAKLADNI_URL}manifest.json`;
const URL_BALIKU = `${ZAKLADNI_URL}2026.json`;

describe('stahniVysledky', () => {
  it('stáhne manifest a nový balík, který jde přečíst jako soubor z importu', async () => {
    const { s, dotazy } = sit({
      [URL_MANIFESTU]: { stav: 200, telo: bajty(manifest([{ soubor: '2026.json', hash: HASH }])) },
      [URL_BALIKU]: { stav: 200, telo: new Uint8Array(BALIK) },
    });

    const vysledek = await stahniVysledky(s, new Map());
    expect(vysledek.stav).toBe('ok');
    if (vysledek.stav !== 'ok') return;

    expect(dotazy).toEqual([URL_MANIFESTU, URL_BALIKU]);
    expect(vysledek.nove).toHaveLength(1);
    const precteno = nactiVysledky(vysledek.nove[0]!.text);
    expect(precteno.stav).toBe('ok');
    expect(vysledek.manifest.kontrola.sportka).toEqual({ posledniTah: '2026-09-06', uplny: false });
  });

  it('balík se známým hashem znovu nestahuje', async () => {
    const { s, dotazy } = sit({
      [URL_MANIFESTU]: { stav: 200, telo: bajty(manifest([{ soubor: '2026.json', hash: HASH }])) },
    });
    const vysledek = await stahniVysledky(s, new Map([['2026.json', HASH]]));
    expect(vysledek).toMatchObject({ stav: 'ok', nove: [] });
    expect(dotazy).toEqual([URL_MANIFESTU]);
  });

  it('balík, který nesedí na hash z manifestu, odmítne', async () => {
    const { s } = sit({
      [URL_MANIFESTU]: { stav: 200, telo: bajty(manifest([{ soubor: '2026.json', hash: HASH }])) },
      [URL_BALIKU]: { stav: 200, telo: bajty('{"podvrzeno":true}') },
    });
    const vysledek = await stahniVysledky(s, new Map());
    expect(vysledek).toMatchObject({ stav: 'chyba' });
    if (vysledek.stav === 'chyba') expect(vysledek.duvod).toMatch(/nesouhlasí/);
  });

  it('i koncový nový řádek je součást hashe — Capacitor ho nesmí zahodit', async () => {
    // Přesně tohle by udělal Android při čtení jako text. Proto se berou surové bajty.
    const bezKonce = new Uint8Array(BALIK.subarray(0, BALIK.length - 1));
    const { s } = sit({
      [URL_MANIFESTU]: { stav: 200, telo: bajty(manifest([{ soubor: '2026.json', hash: HASH }])) },
      [URL_BALIKU]: { stav: 200, telo: bezKonce },
    });
    expect((await stahniVysledky(s, new Map())).stav).toBe('chyba');
  });

  it('bez sítě vrátí větu pro uživatele, nevyhodí výjimku', async () => {
    const s: Sit = async () => {
      throw new Error('offline');
    };
    const vysledek = await stahniVysledky(s, new Map());
    expect(vysledek).toMatchObject({ stav: 'chyba' });
    if (vysledek.stav === 'chyba') expect(vysledek.duvod).toMatch(/není dostupný/);
  });

  it('přepsaný typ obsahu na serveru ohlásí srozumitelně', async () => {
    const s: Sit = async () => {
      throw new NecekanyTypObsahu();
    };
    const vysledek = await stahniVysledky(s, new Map());
    if (vysledek.stav === 'chyba') expect(vysledek.duvod).toMatch(/text\/plain/);
  });

  it('chybový stav serveru ohlásí s kódem', async () => {
    const { s } = sit({ [URL_MANIFESTU]: { stav: 503, telo: new Uint8Array() } });
    const vysledek = await stahniVysledky(s, new Map());
    if (vysledek.stav === 'chyba') expect(vysledek.duvod).toMatch(/503/);
  });
});

describe('manifest z cizích rukou', () => {
  it('jméno balíku mimo povolený tvar odmítne dřív, než z něj složí adresu', () => {
    for (const zle of ['../tajne.json', 'https://jinam.cz/x.json', '2026.json?tiket=123', '2026.JSON', '.htaccess']) {
      expect(() => adresaBaliku(zle), zle).toThrow();
      expect(prectiManifest(manifest([{ soubor: zle, hash: HASH }])), zle).toMatch(/neplatnou/);
    }
  });

  it('každá adresa balíku zůstane na serveru výsledků a bez parametrů', () => {
    const adresa = new URL(adresaBaliku('2026.json'));
    expect(adresa.origin).toBe(new URL(ZAKLADNI_URL).origin);
    expect(adresa.pathname.startsWith(new URL(ZAKLADNI_URL).pathname)).toBe(true);
    expect(adresa.search).toBe('');
    expect(adresa.hash).toBe('');
  });

  it('novější formát manifestu nečte naslepo', () => {
    expect(prectiManifest(manifest([], { verzeManifestu: 2 }))).toMatch(/Aktualizuj aplikaci/);
    expect(prectiManifest('<html>')).toMatch(/platný/);
  });

  it('hash má stejný tvar, jaký píše backend', async () => {
    expect(await sha256(new Uint8Array(BALIK))).toBe(HASH);
  });
});
