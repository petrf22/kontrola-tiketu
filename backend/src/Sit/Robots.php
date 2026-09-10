<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

/**
 * Vyhodnocení robots.txt. Port `fetcher/src/robots.ts`.
 *
 * Zadání ukládá respektovat robots.txt jako tvrdé pravidlo, a nejde o formalitu: právě kvůli
 * `Disallow: /api/` se nepoužívá JSON API, které web sám používá. Kontrola proto běží za chodu
 * — kdyby Allwyn pravidla zpřísnil, backend se má zastavit, ne to obejít.
 */
final class Robots
{
    /**
     * @param list<string> $disallow
     * @param list<string> $allow
     */
    public function __construct(
        public readonly array $disallow,
        public readonly array $allow,
    ) {
    }

    /** Načte pravidla pro daného robota; neznámý robot spadá pod `User-agent: *`. */
    public static function parsuj(string $text, string $robot = '*'): self
    {
        $disallow = [];
        $allow = [];
        $platiProNas = false;
        $predchoziBylUa = false;

        foreach (preg_split('/\r?\n/', $text) ?: [] as $radek) {
            $bezKomentare = trim(explode('#', $radek)[0]);
            if ($bezKomentare === '') {
                continue;
            }
            $delic = strpos($bezKomentare, ':');
            if ($delic === false) {
                continue;
            }
            $klic = strtolower(trim(substr($bezKomentare, 0, $delic)));
            $hodnota = trim(substr($bezKomentare, $delic + 1));

            if ($klic === 'user-agent') {
                // Několik po sobě jdoucích User-agent řádků sdílí jednu skupinu pravidel.
                $sedi = $hodnota === '*' || strtolower($hodnota) === strtolower($robot);
                $platiProNas = $predchoziBylUa ? $platiProNas || $sedi : $sedi;
                $predchoziBylUa = true;
                continue;
            }
            $predchoziBylUa = false;

            if (!$platiProNas) {
                continue;
            }
            if ($klic === 'disallow' && $hodnota !== '') {
                $disallow[] = $hodnota;
            }
            if ($klic === 'allow' && $hodnota !== '') {
                $allow[] = $hodnota;
            }
        }

        return new self($disallow, $allow);
    }

    /**
     * Smí se na cestu? Rozhoduje nejdelší odpovídající pravidlo, při shodné délce vyhrává Allow —
     * tak to dělají i vyhledávače.
     */
    public function jePovoleno(string $cesta): bool
    {
        return self::nejdelsi($this->allow, $cesta) >= self::nejdelsi($this->disallow, $cesta);
    }

    /** @param list<string> $vzory */
    private static function nejdelsi(array $vzory, string $cesta): int
    {
        $max = -1;
        foreach ($vzory as $vzor) {
            if (self::sedi($vzor, $cesta)) {
                $max = max($max, strlen($vzor));
            }
        }
        return $max;
    }

    private static function sedi(string $vzor, string $cesta): bool
    {
        $kotvenyKonec = str_ends_with($vzor, '$');
        $telo = $kotvenyKonec ? substr($vzor, 0, -1) : $vzor;
        $regularni = str_replace('\*', '.*', preg_quote($telo, '/'));
        return preg_match('/^' . $regularni . ($kotvenyKonec ? '$' : '') . '/', $cesta) === 1;
    }
}
