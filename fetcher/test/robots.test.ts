import { describe, expect, it } from 'vitest';
import { jePovoleno, parsujRobots } from '../src/robots.js';

/** Doslovný obsah https://www.allwyn.cz/robots.txt k 9. 9. 2026. */
const ALLWYN = `User-agent: *
Disallow: /vyhledavani*
Disallow: /moje-sazky/
Disallow: /*searchtext*
Disallow: /api/
Sitemap: https://www.allwyn.cz/sitemap-index.xml`;

describe('robots.txt Allwynu', () => {
  const pravidla = parsujRobots(ALLWYN);

  it('výherní listina je povolená', () => {
    expect(jePovoleno(pravidla, '/system/vyherka')).toBe(true);
  });

  it('JSON API, které používá jejich web, povolené není', () => {
    // Tohle je důvod, proč fetcher čte listinu a ne /api/draw-games.
    expect(jePovoleno(pravidla, '/api/draw-games')).toBe(false);
    expect(jePovoleno(pravidla, '/api/')).toBe(false);
  });

  it('respektuje hvězdičku uprostřed i na konci vzoru', () => {
    expect(jePovoleno(pravidla, '/vyhledavani')).toBe(false);
    expect(jePovoleno(pravidla, '/vyhledavani/cokoliv')).toBe(false);
    // Vzory se podle specifikace porovnávají včetně query, takže tenhle spadne pod zákaz.
    expect(jePovoleno(pravidla, '/loterie?searchtext=abc')).toBe(false);
    expect(jePovoleno(pravidla, '/neco/searchtext/dal')).toBe(false);
  });

  it('nezakázané cesty jsou povolené', () => {
    expect(jePovoleno(pravidla, '/')).toBe(true);
    expect(jePovoleno(pravidla, '/loterie/sportka/kontrola-a-vysledky')).toBe(true);
  });
});

describe('parsujRobots', () => {
  it('bere jen skupinu, která na nás sedí', () => {
    const text = `User-agent: SemrushBot
Disallow: /

User-agent: *
Disallow: /api/`;
    const pravidla = parsujRobots(text, 'kontrola-tiketu/0.1');
    expect(jePovoleno(pravidla, '/system/vyherka')).toBe(true);
    expect(jePovoleno(pravidla, '/api/x')).toBe(false);
  });

  it('několik User-agent řádků za sebou sdílí jednu skupinu pravidel', () => {
    const text = `User-agent: A
User-agent: *
Disallow: /tajne/`;
    expect(jePovoleno(parsujRobots(text), '/tajne/x')).toBe(false);
  });

  it('ignoruje komentáře a prázdné hodnoty', () => {
    const text = `User-agent: *   # všichni
Disallow:            # prázdný Disallow znamená „nic nezakazuji“
Disallow: /api/`;
    const pravidla = parsujRobots(text);
    expect(pravidla.disallow).toEqual(['/api/']);
    expect(jePovoleno(pravidla, '/cokoliv')).toBe(true);
  });

  it('Allow přebije Disallow, když je vzor delší', () => {
    const text = `User-agent: *
Disallow: /api/
Allow: /api/verejne/`;
    const pravidla = parsujRobots(text);
    expect(jePovoleno(pravidla, '/api/tajne')).toBe(false);
    expect(jePovoleno(pravidla, '/api/verejne/x')).toBe(true);
  });

  it('kotva $ omezuje shodu na přesný konec cesty', () => {
    const text = `User-agent: *
Disallow: /soubor.pdf$`;
    const pravidla = parsujRobots(text);
    expect(jePovoleno(pravidla, '/soubor.pdf')).toBe(false);
    expect(jePovoleno(pravidla, '/soubor.pdf.html')).toBe(true);
  });

  it('prázdný robots.txt nic nezakazuje', () => {
    expect(jePovoleno(parsujRobots(''), '/cokoliv')).toBe(true);
  });
});
