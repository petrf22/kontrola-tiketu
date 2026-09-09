import { describe, expect, it } from 'vitest';
import { serad, sloucTahy, type Tah } from '../src/index.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';
import { SP_2026_09_02, SP_2026_09_04 } from './fixtures/sportka.js';

describe('serad', () => {
  it('řadí chronologicky napříč hrami', () => {
    const tahy: Tah[] = [EJ_2026_09_08, SP_2026_09_02, EJ_2026_09_01];
    expect(serad(tahy).map((t) => t.datum)).toEqual(['2026-09-01', '2026-09-02', '2026-09-08']);
  });

  it('nespojí dvě hry ze stejného dne', () => {
    const stejnyDen = serad([EJ_2026_09_04, SP_2026_09_04]);
    expect(stejnyDen).toHaveLength(2);
    expect(stejnyDen.map((t) => t.hra).sort()).toEqual(['eurojackpot', 'sportka']);
  });

  it('zahodí duplicity', () => {
    expect(serad([EJ_2026_09_01, EJ_2026_09_01, EJ_2026_09_01])).toHaveLength(1);
  });

  it('prázdný vstup dá prázdný výstup', () => {
    expect(serad([])).toEqual([]);
  });
});

describe('sloucTahy', () => {
  it('přidá nové tahy ke známým', () => {
    const vysledek = sloucTahy([EJ_2026_09_01], [EJ_2026_09_04, EJ_2026_09_08]);
    expect(vysledek.map((t) => t.datum)).toEqual(['2026-09-01', '2026-09-04', '2026-09-08']);
  });

  it('opravená listina přepíše tu dřívější', () => {
    // Opravený import má přednost — jinak by uživatel nedostal opravu nikdy.
    const opraveny: Tah = { ...EJ_2026_09_01, vsazenoKc: 99 };
    expect(sloucTahy([EJ_2026_09_01], [opraveny])[0]?.vsazenoKc).toBe(99);
  });

  it('opakovaný import téhož souboru nic nezdvojí', () => {
    const jednou = sloucTahy([], [EJ_2026_09_01, EJ_2026_09_04]);
    const dvakrát = sloucTahy(jednou, [EJ_2026_09_01, EJ_2026_09_04]);
    expect(dvakrát).toEqual(jednou);
  });

  it('import do prázdna funguje', () => {
    expect(sloucTahy([], [EJ_2026_09_01])).toHaveLength(1);
  });
});
