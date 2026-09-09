/**
 * Čtení ceny tiketu.
 *
 * Na tiketu je vytištěná částka za vklad. Slouží jen k tomu, aby uživatel viděl, jak si
 * stojí — na vyhodnocení výhry nemá vliv, ta se počítá výhradně z tabulek tahů.
 *
 * Ověřeno na reálném tiketu Eurojackpotu (9. 9. 2026), kde stojí samostatně `400 Kč`.
 */

/** Částka na samostatném řádku, případně s popiskem před sebou. */
const CENA = /(?:^|\s)(\d[\d\s ]{0,8})\s*Kč\s*$/;

/**
 * Najde cenu tiketu v přečtených řádcích, nebo vrátí `null`.
 *
 * Bere první nalezenou částku. Nevymýšlí: když se nic nenajde, uživatel cenu doplní ručně —
 * odhadnutá cena by zkreslila bilanci, kterou aplikace ukazuje.
 */
export function prectiCenu(radky: readonly string[]): number | null {
  for (const radek of radky) {
    const nalez = CENA.exec(radek.trim());
    if (nalez === null) continue;

    const hodnota = Number(nalez[1]!.replace(/[\s ]/g, ''));
    if (Number.isFinite(hodnota) && hodnota > 0) return hodnota;
  }
  return null;
}
