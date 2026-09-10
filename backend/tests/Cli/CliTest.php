<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Cli;

use KontrolaTiketu\Archiv;
use KontrolaTiketu\Cli\Cli;
use KontrolaTiketu\Json;
use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Sit\Odpoved;
use KontrolaTiketu\Test\DocasnyAdresar;
use KontrolaTiketu\Test\Fixtury;
use KontrolaTiketu\Test\Sit\FalesnaSit;
use KontrolaTiketu\Test\Sit\RobotsTest;
use KontrolaTiketu\Zdroj\AllwynVyherka;
use PHPUnit\Framework\TestCase;

final class CliTest extends TestCase
{
    use DocasnyAdresar;

    /** @var list<string> */
    private array $hlaseni = [];

    private function cli(FalesnaSit $sit = new FalesnaSit()): Cli
    {
        return new Cli(
            Konfigurace::nacti(),
            function (string $r): void {
                $this->hlaseni[] = $r;
            },
            function (string $r): void {
                $this->hlaseni[] = $r;
            },
            $sit,
            0,
        );
    }

    public function testStahniUlozeListinyDoArchivuAToCoUzJeZnovuNestahuje(): void
    {
        $archiv = $this->docasny() . '/archiv';
        $url36 = AllwynVyherka::sestavUrl('sportka', 2026, 36);
        $url37 = AllwynVyherka::sestavUrl('sportka', 2026, 37);
        $sit = new FalesnaSit([
            'https://www.allwyn.cz/robots.txt' => new Odpoved(200, RobotsTest::ALLWYN),
            $url36 => new Odpoved(200, Fixtury::listina('sportka-2026-36')),
            $url37 => new Odpoved(200, Fixtury::listina('prazdna')),
        ]);

        $kod = $this->cli($sit)->hlavni(['stahni', '--od', '2026-36', '--do', '2026-37', '--hra', 'sportka', '--archiv', $archiv]);
        self::assertSame(0, $kod, implode("\n", $this->hlaseni));
        self::assertSame(
            Fixtury::listina('sportka-2026-36'),
            (new Archiv($archiv))->nacti(['hra' => 'sportka', 'rok' => 2026, 'tyden' => 36]),
        );

        $sit->dotazy = [];
        $this->cli($sit)->hlavni(['stahni', '--od', '2026-36', '--do', '2026-37', '--hra', 'sportka', '--archiv', $archiv]);
        self::assertSame(['https://www.allwyn.cz/robots.txt'], $sit->adresy());
    }

    public function testZakazVRobotsUkonciBehKodem3(): void
    {
        $sit = new FalesnaSit([
            'https://www.allwyn.cz/robots.txt' => new Odpoved(200, "User-agent: *\nDisallow: /system/"),
        ]);
        $kod = $this->cli($sit)->hlavni(['stahni', '--od', '2026-36', '--do', '2026-36', '--archiv', $this->docasny()]);
        self::assertSame(3, $kod);
        self::assertCount(1, $sit->dotazy);
    }

    public function testPreparsujZapiseSouborKteryAplikaceUmiPrecist(): void
    {
        $cil = $this->docasny() . '/vysledky.json';
        $kod = $this->cli()->hlavni([
            'preparsuj', '--archiv', Fixtury::LISTINY, '--od', '2026-35', '--do', '2026-37', '--out', $cil,
        ]);
        self::assertSame(0, $kod, implode("\n", $this->hlaseni));

        $obsah = Json::cti((string) file_get_contents($cil));
        self::assertIsArray($obsah);
        self::assertSame(1, $obsah['verzeFormatu']);
        self::assertSame(['od' => '2026-35', 'do' => '2026-37'], $obsah['obdobi']);
        self::assertIsArray($obsah['tahy']);
        self::assertCount(6, $obsah['tahy']);
    }

    public function testSpatnyArgumentVratiKod2SNapovedou(): void
    {
        self::assertSame(2, $this->cli()->hlavni(['preparsuj']));
        self::assertStringContainsString('vyherka stahni', implode("\n", $this->hlaseni));
        self::assertSame(2, $this->cli()->hlavni(['stahni', '--od', '2026-99', '--do', '2026-99']));
        self::assertSame(2, $this->cli()->hlavni(['nezname']));
        self::assertSame(2, $this->cli()->hlavni(['stav', '--neznama', 'x']));
    }
}
