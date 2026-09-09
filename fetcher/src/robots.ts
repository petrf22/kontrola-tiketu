/**
 * Vyhodnocení robots.txt.
 *
 * Zadání ukládá respektovat robots.txt jako tvrdé pravidlo, a nejde o formalitu: právě kvůli
 * `Disallow: /api/` se nepoužívá JSON API, které web sám používá. Kontrola proto běží za chodu
 * — kdyby Allwyn pravidla zpřísnil, fetcher se má zastavit, ne to obejít.
 */

export interface PravidlaRobots {
  readonly disallow: readonly string[];
  readonly allow: readonly string[];
}

/** Načte pravidla pro daného robota; neznámý robot spadá pod `User-agent: *`. */
export function parsujRobots(text: string, robot = '*'): PravidlaRobots {
  const disallow: string[] = [];
  const allow: string[] = [];
  let platiProNas = false;
  let predchoziBylUa = false;

  for (const radek of text.split(/\r?\n/)) {
    const bezKomentare = radek.split('#')[0]!.trim();
    if (bezKomentare === '') continue;

    const delic = bezKomentare.indexOf(':');
    if (delic === -1) continue;
    const klic = bezKomentare.slice(0, delic).trim().toLowerCase();
    const hodnota = bezKomentare.slice(delic + 1).trim();

    if (klic === 'user-agent') {
      // Několik po sobě jdoucích User-agent řádků sdílí jednu skupinu pravidel.
      const sedi = hodnota === '*' || hodnota.toLowerCase() === robot.toLowerCase();
      platiProNas = predchoziBylUa ? platiProNas || sedi : sedi;
      predchoziBylUa = true;
      continue;
    }
    predchoziBylUa = false;

    if (!platiProNas) continue;
    if (klic === 'disallow' && hodnota !== '') disallow.push(hodnota);
    if (klic === 'allow' && hodnota !== '') allow.push(hodnota);
  }

  return { disallow, allow };
}

function sedi(vzor: string, cesta: string): boolean {
  const kotvenyKonec = vzor.endsWith('$');
  const telo = kotvenyKonec ? vzor.slice(0, -1) : vzor;
  const regularni = telo
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${regularni}${kotvenyKonec ? '$' : ''}`).test(cesta);
}

/**
 * Smí se na cestu? Rozhoduje nejdelší odpovídající pravidlo, při shodné délce vyhrává Allow —
 * tak to dělají i vyhledávače.
 */
export function jePovoleno(pravidla: PravidlaRobots, cesta: string): boolean {
  const delka = (vzory: readonly string[]) =>
    vzory.filter((v) => sedi(v, cesta)).reduce((max, v) => Math.max(max, v.length), -1);

  return delka(pravidla.allow) >= delka(pravidla.disallow);
}
