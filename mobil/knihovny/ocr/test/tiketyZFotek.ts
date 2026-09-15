/**
 * Přepisy tří skutečných tiketů vyfocených 14. 9. 2026 — po řádcích a útržcích, jak je na
 * papíře rozděluje mezera.
 *
 * Rozvržení, popisky, hlavičky, reklamní řádky i ceny jsou opsané. **Vsazená čísla, kódy
 * doplňkových her, licence a sériová čísla jsou nahrazené vymyšlenými**, ať v gitu neleží
 * cizí sázka.
 */

const REKLAMA = [
  ['EXTRA ŠANCE NA VÝHRU S ALLWYN KLUBEM.'],
  ['NAVÍC JOKER NÁSOBÍ VÝHRY NA KOLE ŠTĚSTÍ.'],
];

const CARA = ['------------------------------------------------'];

export const EUROJACKPOT_14_9: readonly string[][] = [
  ['EUROJACKPOT'],
  ...REKLAMA,
  ['SLOSOVÁNÍ: 4 (ÚT,PÁ)', '15.09.2026-25.09.2026'],
  CARA,
  ['1: 03 11 24 36 48', '02 09 NT'],
  ['2: 05 17 29 33 41', '04 10 NT'],
  CARA,
  ['Extra 6:  123456', 'ANO'],
  ['14.09.2026  640 Kč', '11:20:36'],
  CARA,
  ['ČÍSLO OBSTARAVATELSKÉ LICENCE:', '11111111'],
  ['01ABCDE', '12345-000000000-000001'],
];

export const SPORTKA_14_9: readonly string[][] = [
  ['sportka'],
  ['allwyn'],
  ...REKLAMA,
  ['SLOSOVÁNÍ: 6 (ST,PA,NE) 16.09.2026-27.09.2026'],
  CARA,
  ['1:  01 09 18 26 38 44  NT'],
  ['2:  06 12 21 30 39 45  NT'],
  ['3:  07 14 20 28 35 49  NT'],
  CARA,
  ['Šance:  654321', 'ANO'],
  ['14.09.2026  720 Kč', '11:21:14'],
  CARA,
  ['ČÍSLO OBSTARAVATELSKÉ LICENCE:', '11111111'],
  ['01ABCDE', '12345-000000000-000002'],
];

export const EUROMILIONY_14_9: readonly string[][] = [
  ['Euromiliony'],
  ...REKLAMA,
  ['SLOSOVÁNÍ: 4', '15.09.2026-26.09.2026'],
  CARA,
  ['1: 02 06 13 19 24 30 34  -  04 NT'],
  ['2: 03 08 10 17 21 26 31  -  02 NT'],
  CARA,
  ['Eurošance:  24680', 'ANO'],
  ['14.09.2026  360 Kč', '11:20:53'],
  CARA,
  ['ČÍSLO OBSTARAVATELSKÉ LICENCE:', '11111111'],
  ['01ABCDE', '12345-000000000-000003'],
];

/**
 * Starší tiket Sazky na jedno slosování, vyfocený 15. 9. 2026. Jiná hlavička (`POČET
 * SLOSOVÁNÍ: 1` bez závorky), rok dvěma číslicemi, sloupce bez `NT`, cena na vlastním řádku
 * a maskované číslo klubové karty. 28. 5. 2021 byl pátek.
 */
export const EUROJACKPOT_SAZKA_2021: readonly string[][] = [
  ['sazka'],
  ['POUŽÍVEJTE PŘI SÁZENÍ SAZKA KARTU A'],
  ['MŮŽETE VYHRÁT ŠKODU FABIA V KOLE ŠTĚSTÍ.'],
  ['EUROJACKPOT'],
  ['OBNOVENÍ SÁZKY'],
  ['POČET SLOSOVÁNÍ: 1', '28.05.21'],
  CARA,
  ['1: 03 09 17 26 44', '01 08'],
  ['2: 06 13 21 38 45', '03 10'],
  ['3: 02 11 27 32 48', '02 05'],
  ['4: 07 15 23 30 41', '04 09'],
  ['5: 10 19 25 36 47', '06 11'],
  CARA,
  ['EXTRA 6:  112233', 'ANO'],
  ['340 Kč'],
  ['ČÍSLO KARTY KLUBU SAZKA:', '1*****000'],
  ['25.05.21', '12:06:40'],
  CARA,
  ['ČÍSLO OBSTARAVATELSKÉ LICENCE:', '11111111'],
  ['000000', '123-0000000000-00004'],
];

/**
 * Přepis nemá úhly řádků, takže se sklon při skládání zadává. Odhad hlasováním je na pravidelné
 * mřížce s mnoha jednodílnými řádky nejednoznačný; na zařízení úhel dodává ML Kit.
 */
export const ROVNE = { sklonStupnu: 0 } as const;
