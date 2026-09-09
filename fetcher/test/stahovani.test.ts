import { describe, expect, it, vi } from 'vitest';
import {
  ChybaStahovani,
  Klient,
  USER_AGENT,
  ZakazanoRobots,
  type Odpoved,
  type Sit,
} from '../src/stahovani.js';

const ROBOTS = `User-agent: *
Disallow: /api/`;

function falesnaSit(odpovedi: Record<string, Odpoved>) {
  const dotazy: { url: string; hlavicky: Record<string, string> }[] = [];
  const sit: Sit = async (url, hlavicky) => {
    dotazy.push({ url, hlavicky });
    return odpovedi[url] ?? { stav: 404, telo: '' };
  };
  return { sit, dotazy };
}

function klient(odpovedi: Record<string, Odpoved>) {
  const { sit, dotazy } = falesnaSit(odpovedi);
  const spanek = vi.fn(async () => {});
  return { k: new Klient({ sit, spanek, prodlevaMs: 2000 }), dotazy, spanek };
}

const ZAKLAD = {
  'https://priklad.cz/robots.txt': { stav: 200, telo: ROBOTS },
  'https://priklad.cz/system/vyherka?x=1': { stav: 200, telo: '<html>listina</html>' },
};

describe('Klient', () => {
  it('posílá poctivý User-Agent s odkazem na projekt', async () => {
    const { k, dotazy } = klient(ZAKLAD);
    await k.nactiRobots('https://priklad.cz');
    expect(dotazy[0]?.hlavicky['user-agent']).toBe(USER_AGENT);
    expect(USER_AGENT).toContain('github.com/petrf22/kontrola-tiketu');
  });

  it('bez načteného robots.txt odmítne stahovat', async () => {
    const { k } = klient(ZAKLAD);
    await expect(k.stahni('https://priklad.cz/system/vyherka?x=1')).rejects.toThrow(
      ChybaStahovani,
    );
  });

  it('zakázanou cestu odmítne místo obejití', async () => {
    const { k } = klient({
      ...ZAKLAD,
      'https://priklad.cz/api/draw-games': { stav: 200, telo: '{}' },
    });
    await k.nactiRobots('https://priklad.cz');
    await expect(k.stahni('https://priklad.cz/api/draw-games')).rejects.toThrow(ZakazanoRobots);
  });

  it('zakázanou cestu ani nezkusí stáhnout', async () => {
    const { k, dotazy } = klient(ZAKLAD);
    await k.nactiRobots('https://priklad.cz');
    const predtim = dotazy.length;
    await expect(k.stahni('https://priklad.cz/api/x')).rejects.toThrow(ZakazanoRobots);
    expect(dotazy).toHaveLength(predtim);
  });

  it('nedostupný robots.txt zastaví běh — nedá se předpokládat, že je vše povolené', async () => {
    const { k } = klient({ 'https://priklad.cz/robots.txt': { stav: 503, telo: '' } });
    await expect(k.nactiRobots('https://priklad.cz')).rejects.toThrow(/503/);
  });

  it('čeká mezi dotazy, ale ne před prvním', async () => {
    const { k, spanek } = klient(ZAKLAD);
    await k.nactiRobots('https://priklad.cz');
    expect(spanek).not.toHaveBeenCalled();
    await k.stahni('https://priklad.cz/system/vyherka?x=1');
    expect(spanek).toHaveBeenCalledTimes(1);
    expect(spanek).toHaveBeenCalledWith(2000);
  });

  it('počítá dotazy, aby bylo vidět, kolik běh stál', async () => {
    const { k } = klient(ZAKLAD);
    await k.nactiRobots('https://priklad.cz');
    await k.stahni('https://priklad.cz/system/vyherka?x=1');
    expect(k.pocetDotazu).toBe(2);
  });

  it('chybový stav hlásí i s kódem', async () => {
    const { k } = klient(ZAKLAD);
    await k.nactiRobots('https://priklad.cz');
    await expect(k.stahni('https://priklad.cz/neexistuje')).rejects.toThrow(/404/);
  });
});

describe('kontrola robots.txt zahrnuje query', () => {
  it('zákaz mířený na parametr se uplatní, i když je cesta povolená', async () => {
    const { sit } = falesnaSit({
      'https://priklad.cz/robots.txt': {
        stav: 200,
        telo: 'User-agent: *\nDisallow: /*searchtext*',
      },
    });
    const k = new Klient({ sit, spanek: async () => {} });
    await k.nactiRobots('https://priklad.cz');
    await expect(k.stahni('https://priklad.cz/loterie?searchtext=x')).rejects.toThrow(
      ZakazanoRobots,
    );
  });

  it('adresa výherní listiny s parametry projde', async () => {
    const url = 'https://priklad.cz/system/vyherka?year=2026&week=36&game=sportka';
    const { sit } = falesnaSit({
      'https://priklad.cz/robots.txt': { stav: 200, telo: ROBOTS },
      [url]: { stav: 200, telo: 'listina' },
    });
    const k = new Klient({ sit, spanek: async () => {} });
    await k.nactiRobots('https://priklad.cz');
    await expect(k.stahni(url)).resolves.toBe('listina');
  });
});
