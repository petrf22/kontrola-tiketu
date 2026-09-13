import { describe, expect, it } from 'vitest';
import {
  chybiVTabulce,
  delkaShodnehoKonce,
  sousedniCislice,
  urciPoradiKoncoveCislice,
  vyhodnotSance,
} from '../src/index.js';
import { SP_2015_03_04, SP_2026_09_02, VSECHNY_TAHY_SPORTKA } from './fixtures/sportka.js';

describe('delkaShodnehoKonce', () => {
  it('počítá shodu od konce, ne od začátku', () => {
    expect(delkaShodnehoKonce('236412', '236412')).toBe(6);
    expect(delkaShodnehoKonce('936412', '236412')).toBe(5);
    expect(delkaShodnehoKonce('236412', '999999')).toBe(0);
    // Shodný začátek bez shodného konce se nepočítá vůbec.
    expect(delkaShodnehoKonce('236499', '236412')).toBe(0);
  });

  it('zvládne vedoucí nuly', () => {
    expect(delkaShodnehoKonce('000012', '236412')).toBe(2);
    expect(delkaShodnehoKonce('057739', '057739')).toBe(6);
  });
});

describe('sousedniCislice', () => {
  it('bere sousedy cyklicky podle herního plánu', () => {
    expect(sousedniCislice('5')).toEqual(['6', '4']);
    expect(sousedniCislice('0')).toEqual(['1', '9']);
    expect(sousedniCislice('9')).toEqual(['0', '8']);
  });
});

describe('urciPoradiKoncoveCislice', () => {
  it('mapuje délku shody na pořadí', () => {
    const tazene = '236412';
    expect(urciPoradiKoncoveCislice('236412', tazene)).toBe('sestecisli');
    expect(urciPoradiKoncoveCislice('936412', tazene)).toBe('peticisli');
    expect(urciPoradiKoncoveCislice('996412', tazene)).toBe('ctyrcisli');
    expect(urciPoradiKoncoveCislice('999412', tazene)).toBe('trojcisli');
    expect(urciPoradiKoncoveCislice('999912', tazene)).toBe('dvojcisli');
    expect(urciPoradiKoncoveCislice('999992', tazene)).toBe('koncove-cislo');
  });

  it('vyplácí se nejvyšší dosažené pořadí — delší shoda přebije kratší', () => {
    // 236412 se shoduje na šest číslic; nesmí spadnout do dvojčíslí.
    expect(urciPoradiKoncoveCislice('236412', '236412')).toBe('sestecisli');
  });

  it('sousední číslo se uplatní, jen když koncové číslo nesedí', () => {
    // Tažené 236412 → koncové 2, sousedi sázenky s koncovým 1 jsou 2 a 0.
    expect(urciPoradiKoncoveCislice('999991', '236412')).toBe('sousedni-cislo');
    expect(urciPoradiKoncoveCislice('999993', '236412')).toBe('sousedni-cislo');
    // Trefené koncové číslo je vyšší pořadí, sousední se neuplatní.
    expect(urciPoradiKoncoveCislice('999992', '236412')).toBe('koncove-cislo');
  });

  it('sousední číslo funguje i přes přechod 9 na 0', () => {
    expect(urciPoradiKoncoveCislice('111119', '236410')).toBe('sousedni-cislo');
    expect(urciPoradiKoncoveCislice('111110', '236419')).toBe('sousedni-cislo');
  });

  it('vzdálené koncové číslo nevyhrává', () => {
    expect(urciPoradiKoncoveCislice('999995', '236412')).toBeNull();
  });
});

describe('vyhodnotSance proti oficiální tabulce výher', () => {
  const losovani = SP_2026_09_02.sance!; // vylosováno 236412

  it('sedí ve všech pořadích, která listina uvádí', () => {
    for (const radek of losovani.poradi) {
      if (radek.vzor === null) continue; // sousední číslo listina vzorem nepopisuje
      const kod = ('999999' + radek.vzor).slice(-6);
      const vysledek = vyhodnotSance(kod, losovani);
      expect(vysledek.poradi, radek.klic).toBe(radek.klic);
      expect(vysledek.vyseVyhryKc, radek.klic).toBe(radek.vyseVyhryKc);
    }
  });

  it('konkrétní kontrola: čtyřčíslí 6412 dává 10 000 Kč', () => {
    const vysledek = vyhodnotSance('996412', losovani);
    expect(vysledek.poradi).toBe('ctyrcisli');
    expect(vysledek.vzor).toBe('6412');
    expect(vysledek.vyseVyhryKc).toBe(10000);
  });

  it('sousední číslo dává 30 Kč', () => {
    const vysledek = vyhodnotSance('999991', losovani);
    expect(vysledek.poradi).toBe('sousedni-cislo');
    expect(vysledek.vyseVyhryKc).toBe(30);
  });

  it('nevýherní kód nemá pořadí ani částku', () => {
    const vysledek = vyhodnotSance('999995', losovani);
    expect(vysledek.poradi).toBeNull();
    expect(vysledek.vyseVyhryKc).toBeNull();
  });
});

describe('starší pravidla Šance', () => {
  const losovani2015 = SP_2015_03_04.sance!; // vylosováno 713201, jen šest pořadí

  it('v roce 2015 nebylo první pořadí pevnou částkou', () => {
    const vysledek = vyhodnotSance('713201', losovani2015);
    expect(vysledek.poradi).toBe('sestecisli');
    expect(vysledek.vyseVyhryKc).toBe(2575470);
    // Dnes je stejné pořadí pevných 1 000 000 Kč — proto se částky berou z listiny.
    expect(vysledek.vyseVyhryKc).not.toBe(1000000);
  });

  it('sedmé pořadí v roce 2015 neexistovalo a pozná se to', () => {
    const kod = '111110'; // tažené koncové 1, sousedi sázenky s koncovým 0 jsou 1 a 9
    const vysledek = vyhodnotSance(kod, losovani2015);
    expect(vysledek.poradi).toBe('sousedni-cislo');
    expect(vysledek.vyseVyhryKc).toBeNull();
    expect(chybiVTabulce(vysledek)).toBe(true);
  });

  it('chybiVTabulce nehlásí nic u běžné výhry ani u prohry', () => {
    expect(chybiVTabulce(vyhodnotSance('713201', losovani2015))).toBe(false);
    expect(chybiVTabulce(vyhodnotSance('999995', losovani2015))).toBe(false);
  });
});

describe('fixtury Šance', () => {
  it('každé slosování Sportky má Šanci se šesti vylosovanými číslicemi', () => {
    for (const slosovani of VSECHNY_TAHY_SPORTKA) {
      expect(slosovani.sance, slosovani.datum).not.toBeNull();
      expect(slosovani.sance?.cislice, slosovani.datum).toMatch(/^[0-9]{6}$/);
      expect(slosovani.sance?.datum, slosovani.datum).toBe(slosovani.datum);
    }
  });

  it('vzory v listině jsou skutečné konce vylosovaného šestičíslí', () => {
    for (const slosovani of VSECHNY_TAHY_SPORTKA) {
      for (const radek of slosovani.sance?.poradi ?? []) {
        if (radek.vzor === null) continue;
        expect(slosovani.sance?.cislice.endsWith(radek.vzor), `${slosovani.datum} ${radek.klic}`)
          .toBe(true);
      }
    }
  });
});
