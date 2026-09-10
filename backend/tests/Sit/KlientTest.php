<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Sit;

use KontrolaTiketu\Sit\ChybaStahovani;
use KontrolaTiketu\Sit\Klient;
use KontrolaTiketu\Sit\Odpoved;
use KontrolaTiketu\Sit\ZakazanoRobots;
use PHPUnit\Framework\TestCase;

/** Kopíruje `fetcher/test/stahovani.test.ts`. */
final class KlientTest extends TestCase
{
    private const ROBOTS = "User-agent: *\nDisallow: /api/";

    /** @var list<int> */
    private array $spanky = [];

    private function klient(FalesnaSit $sit): Klient
    {
        return new Klient($sit, 2000, function (int $ms): void {
            $this->spanky[] = $ms;
        });
    }

    private static function zaklad(): FalesnaSit
    {
        return new FalesnaSit([
            'https://priklad.cz/robots.txt' => new Odpoved(200, self::ROBOTS),
            'https://priklad.cz/system/vyherka?x=1' => new Odpoved(200, '<html>listina</html>'),
        ]);
    }

    public function testPosilaPoctivyUserAgentSOdkazemNaProjekt(): void
    {
        $sit = self::zaklad();
        $this->klient($sit)->nactiRobots('https://priklad.cz');
        self::assertSame(Klient::userAgent(), $sit->dotazy[0]['hlavicky']['User-Agent'] ?? null);
        self::assertStringContainsString('github.com/petrf22/kontrola-tiketu', Klient::userAgent());
    }

    public function testUserAgentJeCisteAscii(): void
    {
        // Hlavička s diakritikou je na hraně specifikace; některé servery ji odmítnou.
        self::assertMatchesRegularExpression('/^[\x20-\x7e]+$/', Klient::userAgent());
    }

    public function testBezNactenehoRobotsOdmitneStahovat(): void
    {
        $this->expectException(ChybaStahovani::class);
        $this->klient(self::zaklad())->stahni('https://priklad.cz/system/vyherka?x=1');
    }

    public function testZakazanouCestuOdmitneAniJiNezkusi(): void
    {
        $sit = self::zaklad();
        $klient = $this->klient($sit);
        $klient->nactiRobots('https://priklad.cz');
        try {
            $klient->stahni('https://priklad.cz/api/draw-games');
            self::fail('Zakázaná cesta prošla.');
        } catch (ZakazanoRobots) {
            self::assertCount(1, $sit->dotazy);
        }
    }

    public function testNedostupnyRobotsZastaviBeh(): void
    {
        $sit = new FalesnaSit(['https://priklad.cz/robots.txt' => new Odpoved(503, '')]);
        $this->expectExceptionMessageMatches('/503/');
        $this->klient($sit)->nactiRobots('https://priklad.cz');
    }

    public function testRobotsZDatabazeUsetriDotaz(): void
    {
        $sit = self::zaklad();
        $klient = $this->klient($sit);
        $klient->pouzijRobots(self::ROBOTS);
        self::assertSame('<html>listina</html>', $klient->stahni('https://priklad.cz/system/vyherka?x=1'));
        self::assertSame(['https://priklad.cz/system/vyherka?x=1'], $sit->adresy());
    }

    public function testCekaMeziDotazyAleNePredPrvnim(): void
    {
        $klient = $this->klient(self::zaklad());
        $klient->nactiRobots('https://priklad.cz');
        self::assertSame([], $this->spanky);
        $klient->stahni('https://priklad.cz/system/vyherka?x=1');
        self::assertSame([2000], $this->spanky);
    }

    public function testPocitaDotazy(): void
    {
        $klient = $this->klient(self::zaklad());
        $klient->nactiRobots('https://priklad.cz');
        $klient->stahni('https://priklad.cz/system/vyherka?x=1');
        self::assertSame(2, $klient->pocetDotazu);
    }

    public function testChybovyStavHlasiISKodem(): void
    {
        $klient = $this->klient(self::zaklad());
        $klient->nactiRobots('https://priklad.cz');
        $this->expectExceptionMessageMatches('/404/');
        $klient->stahni('https://priklad.cz/neexistuje');
    }

    public function testZakazMirenyNaParametrSeUplatni(): void
    {
        $sit = new FalesnaSit(['https://priklad.cz/robots.txt' => new Odpoved(200, "User-agent: *\nDisallow: /*searchtext*")]);
        $klient = $this->klient($sit);
        $klient->nactiRobots('https://priklad.cz');
        $this->expectException(ZakazanoRobots::class);
        $klient->stahni('https://priklad.cz/loterie?searchtext=x');
    }
}
