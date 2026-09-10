<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Sit;

use KontrolaTiketu\Sit\Robots;
use PHPUnit\Framework\TestCase;

/** Kopíruje `fetcher/test/robots.test.ts`. */
final class RobotsTest extends TestCase
{
    /** Doslovný obsah https://www.allwyn.cz/robots.txt k 9. 9. 2026. */
    public const ALLWYN = "User-agent: *\nDisallow: /vyhledavani*\nDisallow: /moje-sazky/\n"
        . "Disallow: /*searchtext*\nDisallow: /api/\nSitemap: https://www.allwyn.cz/sitemap-index.xml";

    public function testVyherniListinaJePovolena(): void
    {
        self::assertTrue(Robots::parsuj(self::ALLWYN)->jePovoleno('/system/vyherka'));
        self::assertTrue(Robots::parsuj(self::ALLWYN)->jePovoleno('/system/vyherka?year=2026&week=36&game=sportka'));
    }

    public function testJsonApiKterePouzivaJejichWebPovoleneNeni(): void
    {
        // Tohle je důvod, proč se čte listina a ne /api/draw-games.
        $pravidla = Robots::parsuj(self::ALLWYN);
        self::assertFalse($pravidla->jePovoleno('/api/draw-games'));
        self::assertFalse($pravidla->jePovoleno('/api/'));
    }

    public function testRespektujeHvezdickuUprostredINaKonciVzoru(): void
    {
        $pravidla = Robots::parsuj(self::ALLWYN);
        self::assertFalse($pravidla->jePovoleno('/vyhledavani'));
        self::assertFalse($pravidla->jePovoleno('/vyhledavani/cokoliv'));
        // Vzory se podle specifikace porovnávají včetně query, takže tenhle spadne pod zákaz.
        self::assertFalse($pravidla->jePovoleno('/loterie?searchtext=abc'));
        self::assertFalse($pravidla->jePovoleno('/neco/searchtext/dal'));
    }

    public function testNezakazaneCestyJsouPovolene(): void
    {
        $pravidla = Robots::parsuj(self::ALLWYN);
        self::assertTrue($pravidla->jePovoleno('/'));
        self::assertTrue($pravidla->jePovoleno('/loterie/sportka/kontrola-a-vysledky'));
    }

    public function testBereJenSkupinuKteraNaNasSedi(): void
    {
        $pravidla = Robots::parsuj("User-agent: SemrushBot\nDisallow: /\n\nUser-agent: *\nDisallow: /api/", 'kontrola-tiketu/0.1');
        self::assertTrue($pravidla->jePovoleno('/system/vyherka'));
        self::assertFalse($pravidla->jePovoleno('/api/x'));
    }

    public function testNekolikUserAgentRadkuZaSebouSdiliJednuSkupinu(): void
    {
        self::assertFalse(Robots::parsuj("User-agent: A\nUser-agent: *\nDisallow: /tajne/")->jePovoleno('/tajne/x'));
    }

    public function testIgnorujeKomentareAPrazdneHodnoty(): void
    {
        $pravidla = Robots::parsuj("User-agent: *   # všichni\nDisallow:            # prázdný Disallow\nDisallow: /api/");
        self::assertSame(['/api/'], $pravidla->disallow);
        self::assertTrue($pravidla->jePovoleno('/cokoliv'));
    }

    public function testAllowPrebijeDisallowKdyzJeVzorDelsi(): void
    {
        $pravidla = Robots::parsuj("User-agent: *\nDisallow: /api/\nAllow: /api/verejne/");
        self::assertFalse($pravidla->jePovoleno('/api/tajne'));
        self::assertTrue($pravidla->jePovoleno('/api/verejne/x'));
    }

    public function testKotvaDolarOmezujeShoduNaPresnyKonecCesty(): void
    {
        $pravidla = Robots::parsuj("User-agent: *\nDisallow: /soubor.pdf$");
        self::assertFalse($pravidla->jePovoleno('/soubor.pdf'));
        self::assertTrue($pravidla->jePovoleno('/soubor.pdf.html'));
    }

    public function testPrazdnyRobotsNicNezakazuje(): void
    {
        self::assertTrue(Robots::parsuj('')->jePovoleno('/cokoliv'));
    }
}
