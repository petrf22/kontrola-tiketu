import type { RozpoznanyText } from '../src/index.js';

/**
 * Postaví vstup, jaký by dal rozpoznávač nad tiketem Eurojackpotu.
 *
 * Levá část řádku (pořadí a pět čísel) a pravá (euročísla) jsou schválně oddělené útržky
 * a vracejí se v zamíchaném pořadí — přesně tak, jak to dělá ML Kit, protože je mezi nimi
 * na papíře velká mezera.
 */
export function tiketEJ(
  radky: readonly string[][],
  moznosti: { sklonStupnu?: number; vyskaTextu?: number; rozteč?: number } = {},
): RozpoznanyText[] {
  const vyska = moznosti.vyskaTextu ?? 20;
  const roztec = moznosti.rozteč ?? 40;
  const tangens = Math.tan(((moznosti.sklonStupnu ?? 0) * Math.PI) / 180);

  const utrzky: RozpoznanyText[] = [];
  radky.forEach((casti, i) => {
    // Levá část začíná na x=40, pravá až na x=400 — mezi nimi je mezera jako na tiketu.
    const pozice = [40, 400];
    casti.forEach((text, j) => {
      const x = pozice[j] ?? 40 + j * 120;
      const sirka = text.length * 12;
      // Náklon se musí odvíjet od STŘEDU rámečku, ne od levého okraje. Skládání řádků
      // pracuje se středy, takže jinak by si útržky různé šířky v jednom řádku neseděly
      // a fixtura by testovala něco, co na papíře nenastane.
      const stredY = 100 + i * roztec + (x + sirka / 2) * tangens;
      utrzky.push({ text, ramecek: { x, y: stredY - vyska / 2, sirka, vyska } });
    });
  });

  // Zamícháme deterministicky, ať se pořadí ve vstupu nedá zneužít.
  return utrzky.filter((_, i) => i % 2 === 1).concat(utrzky.filter((_, i) => i % 2 === 0));
}
