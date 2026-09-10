<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

use KontrolaTiketu\Verze;

/**
 * Slušný HTTP klient pro veřejné listiny. Port `fetcher/src/stahovani.ts`.
 *
 * Pravidla ze zadání: poctivý User-Agent, respektovat robots.txt, nedělat víc dotazů, než je
 * nutné. Prodleva a kontrola robots.txt jsou proto součástí klienta, ne něčím, na co se dá
 * na volajícím místě zapomenout.
 */
final class Klient
{
    /** Sekundy mezi dotazy. Listiny se stahují po týdnech, takže na spěch není důvod. */
    public const PRODLEVA_MS = 2000;

    public int $pocetDotazu = 0;

    private ?Robots $pravidla = null;
    private bool $prvniDotazProbehl = false;

    /** @var \Closure(int): void */
    private readonly \Closure $spanek;

    /** @param (\Closure(int): void)|null $spanek Čekání v milisekundách; testy ho nahrazují. */
    public function __construct(
        private readonly Sit $sit = new SitHttp(),
        private readonly int $prodlevaMs = self::PRODLEVA_MS,
        ?\Closure $spanek = null,
    ) {
        $this->spanek = $spanek ?? static function (int $ms): void {
            usleep($ms * 1000);
        };
    }

    public static function userAgent(): string
    {
        return 'kontrola-tiketu-server/' . Verze::VERZE
            . ' (verejne vysledky pro osobni kontrolu tiketu; +https://github.com/petrf22/kontrola-tiketu)';
    }

    /** Stáhne robots.txt daného webu. Musí proběhnout před prvním stahováním. */
    public function nactiRobots(string $puvod): string
    {
        $cast = parse_url($puvod);
        $url = ($cast['scheme'] ?? 'https') . '://' . ($cast['host'] ?? '') . '/robots.txt';
        $odpoved = $this->posli($url);
        if ($odpoved->stav !== 200) {
            throw new ChybaStahovani(
                "robots.txt vrátil {$odpoved->stav}; bez něj se nedá ověřit, co je povolené.",
                $odpoved->stav,
            );
        }
        $this->pouzijRobots($odpoved->telo);
        return $odpoved->telo;
    }

    /**
     * Použije robots.txt načtený dřív. Backend ho drží v databázi nejvýš den, ať každý hodinový
     * běh nestojí dotaz navíc.
     */
    public function pouzijRobots(string $text): void
    {
        $this->pravidla = Robots::parsuj($text, self::userAgent());
    }

    public function stahni(string $url): string
    {
        if ($this->pravidla === null) {
            throw new ChybaStahovani('Nejdřív je potřeba načíst robots.txt.');
        }
        // Vzory v robots.txt se podle specifikace porovnávají i s query, ne jen s cestou —
        // a adresa listiny má parametry právě v query.
        $cast = parse_url($url);
        $cesta = ($cast['path'] ?? '/') . (isset($cast['query']) ? "?{$cast['query']}" : '');
        if (!$this->pravidla->jePovoleno($cesta)) {
            throw new ZakazanoRobots($cesta);
        }

        $odpoved = $this->posli($url);
        if ($odpoved->stav !== 200) {
            throw new ChybaStahovani("{$url} vrátil {$odpoved->stav}.", $odpoved->stav);
        }
        return $odpoved->telo;
    }

    private function posli(string $url): Odpoved
    {
        // Prodleva patří před dotaz, ne za něj, aby se nečekalo zbytečně po tom posledním.
        if ($this->prvniDotazProbehl) {
            ($this->spanek)($this->prodlevaMs);
        }
        $this->prvniDotazProbehl = true;
        $this->pocetDotazu += 1;
        return $this->sit->get($url, ['User-Agent' => self::userAgent(), 'Accept' => 'text/html']);
    }
}
