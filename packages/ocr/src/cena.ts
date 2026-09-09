/**
 * Čtení ceny tiketu.
 *
 * Na tiketu je vytištěná částka za vklad. Slouží jen k tomu, aby uživatel viděl, jak si
 * stojí — na vyhodnocení výhry nemá vliv, ta se počítá výhradně z tabulek tahů.
 *
 * Ověřeno na reálném tiketu Eurojackpotu (9. 9. 2026), kde stojí samostatně `400 Kč`.
 */

/**
 * Částka kdekoliv na řádku, zakončená „Kč“.
 *
 * Nekotví se na konec řádku: skládání řádků podle rámečků může cenu spojit s tím, co je
 * na tiketu vedle ní, a pak by „400 Kč“ uprostřed řádku propadlo.
 *
 * Podmínka, že částce nesmí předcházet číslice, tečka ani čárka, je podstatná. Bez ní
 * výraz na řádku „07.09.2026 400 Kč“ spolkne i letopočet a vyjde 2 026 400.
 *
 * Tisíce se smějí oddělovat mezerou i nedělitelnou mezerou (U+00A0), protože obojí se na
 * tisku i v rozpoznaném textu vyskytuje.
 */
const CENA = /(?<![\d.,])(\d{1,3}(?:[  ]\d{3})*)\s*Kč/;

/**
 * Najde cenu tiketu v přečtených řádcích, nebo vrátí `null`.
 *
 * Bere první nalezenou částku. Nevymýšlí: když se nic nenajde, uživatel cenu doplní ručně —
 * odhadnutá cena by zkreslila bilanci, kterou aplikace ukazuje.
 */
export function prectiCenu(radky: readonly string[]): number | null {
  for (const radek of radky) {
    const nalez = CENA.exec(radek);
    if (nalez === null) continue;

    const hodnota = Number(nalez[1]!.replace(/[  ]/g, ''));
    if (Number.isFinite(hodnota) && hodnota > 0) return hodnota;
  }
  return null;
}
