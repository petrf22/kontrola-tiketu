<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Zdroj;

use KontrolaTiketu\Test\Fixtury;
use KontrolaTiketu\Zdroj\AllwynVyherka;
use KontrolaTiketu\Zdroj\ChybaParsovani;
use KontrolaTiketu\Zdroj\Html;
use PHPUnit\Framework\TestCase;

/**
 * Případ po případu kopíruje `fetcher/test/parser.test.ts`. Když tam přibude test, patří
 * i sem — port parseru má smysl jen tehdy, když se chová stejně.
 */
final class ParserTest extends TestCase
{
    public function testSestaviAdresuPodleDokumentaceZdroje(): void
    {
        self::assertSame(
            'https://www.allwyn.cz/system/vyherka?year=2026&week=36&game=sportka',
            AllwynVyherka::sestavUrl('sportka', 2026, 36),
        );
    }

    public function testDekodujeCiselneEntityKterymiJePsanaDiakritika(): void
    {
        self::assertSame('SPORTKA STŘEDA', Html::dekodujEntity('SPORTKA ST&#x158;EDA'));
        self::assertSame('ŠANCE', Html::dekodujEntity('&#x160;ANCE'));
    }

    public function testNedelitelnouMezeruZachovaJakoU00A0(): void
    {
        // Dekódování nemá ztrácet informaci; obyčejnou mezeru z ní dělá až naCastku.
        self::assertSame("1\u{00a0}234\u{00a0}Kč", Html::dekodujEntity('1&nbsp;234&nbsp;Kč'));
        self::assertSame(1234, Html::naCastku(Html::dekodujEntity('1&nbsp;234')));
    }

    public function testNeznamouEntituNechaByt(): void
    {
        self::assertSame('&nezname;', Html::dekodujEntity('&nezname;'));
    }

    public function testNaCastkuZvladneNedelitelneMezery(): void
    {
        self::assertSame(15070584, Html::naCastku("15\u{00a0}070\u{00a0}584"));
    }

    public function testNaCastkuZahodiHalere(): void
    {
        self::assertSame(263731922, Html::naCastku("263\u{00a0}731\u{00a0}922,00"));
    }

    public function testNaCastkuZaokrouhlujePolovinuNahoruJakoMathRound(): void
    {
        // Port z JS: Math.round, ne PHP round(). U kladných částek se to neliší, u záporných ano.
        self::assertSame(3, Html::naCastku('2,50'));
        self::assertSame(2, Html::naCastku('2,49'));
    }

    public function testPrazdnyVstupJeNullNeNula(): void
    {
        self::assertNull(Html::naCastku(''));
    }

    public function testCastkaZaSeNenechaZmastCislicemiVeTridachTagu(): void
    {
        $usek = "Na výhry: </td><td class=\"ar b2\"><span class=\"s18b\">9\u{00a0}641\u{00a0}556,00 Kč</span>";
        self::assertSame(9641556, Html::castkaZa($usek, 'Na výhry:'));
    }

    public function testPrazdnaListinaSePoznaPodleChybejicihoLosovaniDne(): void
    {
        self::assertTrue(AllwynVyherka::jePrazdna(Fixtury::listina('prazdna')));
        self::assertFalse(AllwynVyherka::jePrazdna(Fixtury::listina('sportka-2026-36')));
    }

    public function testPrazdnaListinaSeParsujeNaPrazdnySeznam(): void
    {
        self::assertSame([], AllwynVyherka::parsujListinu(Fixtury::listina('prazdna')));
    }

    public function testEurojackpotZJednohoDotazuPrecteVsechnyTahyTydne(): void
    {
        $tahy = AllwynVyherka::parsujListinu(Fixtury::listina('eurojackpot-2026-36'));
        self::assertSame(['2026-09-01', '2026-09-04'], array_column($tahy, 'datum'));
        self::assertSame(['ut', 'pa'], array_column($tahy, 'den'));
    }

    public function testNerozdelenyTydenMaJenJedenTah(): void
    {
        $tahy = AllwynVyherka::parsujListinu(Fixtury::listina('eurojackpot-2026-37'));
        self::assertCount(1, $tahy);
        self::assertSame('2026-09-08', $tahy[0]['datum']);
    }

    public function testTahZ8Zari2026SediNaListinuDoPoslednihoRadku(): void
    {
        [$tah] = AllwynVyherka::parsujListinu(Fixtury::listina('eurojackpot-2026-37'));
        // assertSame hlídá i pořadí klíčů, na kterém stojí bajtová shoda s fetcherem.
        self::assertSame([
            'hra' => 'eurojackpot',
            'datum' => '2026-09-08',
            'den' => 'ut',
            'sazkovyTyden' => ['rok' => 2026, 'tyden' => 37],
            'vsazenoKc' => 25604400,
            'naVyhryKc' => 11415295,
            'cisla' => [47, 14, 27, 34, 36],
            'eurocisla' => [4, 3],
            'extra6' => '912799',
            'poradi' => [
                ['klic' => 'I', 'popis' => '5+2', 'pocetVyher' => 0, 'vyseVyhryKc' => 0],
                ['klic' => 'II', 'popis' => '5+1', 'pocetVyher' => 0, 'vyseVyhryKc' => 15070584],
                ['klic' => 'III', 'popis' => '5+0', 'pocetVyher' => 0, 'vyseVyhryKc' => 2663542],
                ['klic' => 'IV', 'popis' => '4+2', 'pocetVyher' => 0, 'vyseVyhryKc' => 80932],
                ['klic' => 'V', 'popis' => '4+1', 'pocetVyher' => 16, 'vyseVyhryKc' => 5780],
                ['klic' => 'VI', 'popis' => '3+2', 'pocetVyher' => 21, 'vyseVyhryKc' => 3692],
                ['klic' => 'VII', 'popis' => '4+0', 'pocetVyher' => 35, 'vyseVyhryKc' => 2279],
                ['klic' => 'VIII', 'popis' => '2+2', 'pocetVyher' => 443, 'vyseVyhryKc' => 612],
                ['klic' => 'IX', 'popis' => '3+1', 'pocetVyher' => 652, 'vyseVyhryKc' => 416],
                ['klic' => 'X', 'popis' => '3+0', 'pocetVyher' => 1249, 'vyseVyhryKc' => 406],
                ['klic' => 'XI', 'popis' => '1+2', 'pocetVyher' => 2292, 'vyseVyhryKc' => 309],
                ['klic' => 'XII', 'popis' => '2+1', 'pocetVyher' => 8739, 'vyseVyhryKc' => 222],
            ],
            'jackpotKc' => 968000000,
        ], $tah);
    }

    public function testDrziVedouciNuluVExtra6(): void
    {
        $tahy = AllwynVyherka::parsujListinu(Fixtury::listina('eurojackpot-2026-36'));
        $patek = array_values(array_filter($tahy, static fn (array $t): bool => $t['datum'] === '2026-09-04'));
        self::assertSame('057739', $patek[0]['extra6'] ?? null);
    }

    public function testSportkaPrecteTriTahyAKKazdemuPripojiJehoSanci(): void
    {
        $tahy = self::sportky('sportka-2026-36');
        self::assertSame(['2026-09-02', '2026-09-04', '2026-09-06'], array_column($tahy, 'datum'));
        self::assertSame(['st', 'pa', 'ne'], array_column($tahy, 'den'));
        foreach ($tahy as $tah) {
            self::assertSame($tah['datum'], $tah['sance']['datum'] ?? null, $tah['datum']);
        }
    }

    public function testSportkaZ2Zari2026SediNaListinu(): void
    {
        $tah = self::sportky('sportka-2026-36')[0];
        self::assertSame(35817510, $tah['vsazenoKc']);
        self::assertSame(263731922, $tah['naVyhryKc']);
        self::assertSame(241714387, $tah['prevodBonusKc']);
        self::assertSame(251000000, $tah['superJackpotKc']);

        self::assertSame([21, 5, 37, 18, 34, 19], $tah['tahy'][0]['cisla']);
        self::assertSame(42, $tah['tahy'][0]['dodatkove']);
        self::assertSame([40, 15, 34, 32, 24, 22], $tah['tahy'][1]['cisla']);
        self::assertSame(20, $tah['tahy'][1]['dodatkove']);
    }

    public function testNeprehodiPrevodyMeziPrvnimADruhymTahem(): void
    {
        // Listina uvádí u obou tahů „Převod 1. pořadí“; kdyby se sekce nerozdělily,
        // druhý tah by dostal hodnoty prvního.
        $tah = self::sportky('sportka-2026-36')[0];
        self::assertSame(0, $tah['tahy'][0]['prevod2PoradiKc']);
        self::assertSame(2686755, $tah['tahy'][1]['prevod2PoradiKc']);
        self::assertSame(600000, $tah['tahy'][0]['jackpot2PoradiKc']);
        self::assertSame(1000000, $tah['tahy'][1]['jackpot2PoradiKc']);
    }

    public function testTabulkaVyherObouTahuSediNaListinu(): void
    {
        $tah = self::sportky('sportka-2026-36')[0];
        self::assertSame([
            ['klic' => 'bonus', 'popis' => 'Bonus', 'pocetVyher' => 0, 'vyseVyhryKc' => 0],
            ['klic' => 'I', 'popis' => '6', 'pocetVyher' => 0, 'vyseVyhryKc' => 0],
            ['klic' => 'II', 'popis' => '5+dodatkové', 'pocetVyher' => 1, 'vyseVyhryKc' => 985862],
            ['klic' => 'III', 'popis' => '5', 'pocetVyher' => 33, 'vyseVyhryKc' => 18994],
            ['klic' => 'IV', 'popis' => '4', 'pocetVyher' => 1208, 'vyseVyhryKc' => 889],
            ['klic' => 'V', 'popis' => '3', 'pocetVyher' => 21719, 'vyseVyhryKc' => 170],
        ], $tah['tahy'][0]['poradi']);
    }

    public function testSanceZ2Zari2026SediVcetneVzoru(): void
    {
        $sance = self::sportky('sportka-2026-36')[0]['sance'];
        self::assertNotNull($sance);
        self::assertSame('236412', $sance['cislice']);
        self::assertSame(4889970, $sance['vsazenoKc']);
        self::assertSame([
            ['klic' => 'sestecisli', 'popis' => 'šestičíslí', 'vzor' => '236412', 'pocetVyher' => 0, 'vyseVyhryKc' => 0],
            ['klic' => 'peticisli', 'popis' => 'pětičíslí', 'vzor' => '36412', 'pocetVyher' => 2, 'vyseVyhryKc' => 100000],
            ['klic' => 'ctyrcisli', 'popis' => 'čtyřčíslí', 'vzor' => '6412', 'pocetVyher' => 12, 'vyseVyhryKc' => 10000],
            ['klic' => 'trojcisli', 'popis' => 'trojčíslí', 'vzor' => '412', 'pocetVyher' => 138, 'vyseVyhryKc' => 1000],
            ['klic' => 'dvojcisli', 'popis' => 'dvojčíslí', 'vzor' => '12', 'pocetVyher' => 1445, 'vyseVyhryKc' => 100],
            ['klic' => 'koncove-cislo', 'popis' => 'koncové číslo', 'vzor' => '2', 'pocetVyher' => 14637, 'vyseVyhryKc' => 50],
            ['klic' => 'sousedni-cislo', 'popis' => 'koncové číslo +/- 1', 'vzor' => null, 'pocetVyher' => 32484, 'vyseVyhryKc' => 30],
        ], $sance['poradi']);
    }

    public function testStarsiListinaZvladneDvaTahyASanciSeSestiPoradimi(): void
    {
        $tahy = self::sportky('sportka-2015-10');
        self::assertSame(['st', 'ne'], array_column($tahy, 'den'));
        $poradi = $tahy[0]['sance']['poradi'] ?? [];
        self::assertCount(6, $poradi);
        self::assertNotContains('sousedni-cislo', array_column($poradi, 'klic'));
    }

    public function testPrvniPoradiSanceTehdyNebyloPevnouCastkou(): void
    {
        $poradi = self::sportky('sportka-2015-10')[0]['sance']['poradi'] ?? [];
        $sestecisli = array_values(array_filter($poradi, static fn (array $p): bool => $p['klic'] === 'sestecisli'));
        self::assertSame(2575470, $sestecisli[0]['vyseVyhryKc'] ?? null);
    }

    public function testSazkovyTydenSeBereZHlavickyNeZParametruDotazu(): void
    {
        foreach (AllwynVyherka::parsujListinu(Fixtury::listina('sportka-2015-10')) as $tah) {
            self::assertSame(['rok' => 2015, 'tyden' => 10], $tah['sazkovyTyden']);
        }
    }

    public function testChybejiciTabulkaDruhehoTahuShodiParser(): void
    {
        $poskozena = str_replace('<!-- vyhry 2 tah. -->', '', Fixtury::listina('sportka-2026-36'));
        $this->expectException(ChybaParsovani::class);
        AllwynVyherka::parsujListinu($poskozena);
    }

    public function testUseknutaTabulkaEurojackpotuSePoznaPodlePoctuPoradi(): void
    {
        $poskozena = (string) preg_replace(
            '/<td class="ac b2">\s*XII\s*<\/td>/',
            '<td class="ac b2">XIII</td>',
            Fixtury::listina('eurojackpot-2026-37'),
            1,
        );
        $this->expectException(ChybaParsovani::class);
        $this->expectExceptionMessageMatches('/12 pořadí/');
        AllwynVyherka::parsujListinu($poskozena);
    }

    /**
     * Skutečný stav z archivu: 5. 2. 2016 má tažená čísla, ale místo tabulky výher větu
     * „Probíhá zpracování výsledků.“ U starých tahů to zůstává natrvalo.
     */
    public function testTahSePrecteIBezTabulky(): void
    {
        $bezTabulky = (string) preg_replace(
            '/<!-- vyhry -->[\s\S]*?<\/table>/',
            '<!-- vyhry --> Probíhá zpracování výsledků. </table>',
            Fixtury::listina('eurojackpot-2026-37'),
            1,
        );
        $tahy = AllwynVyherka::parsujListinu($bezTabulky);
        self::assertCount(1, $tahy);
        self::assertSame([47, 14, 27, 34, 36], $tahy[0]['cisla'] ?? null);
        self::assertSame([], $tahy[0]['poradi']);
    }

    public function testPrazdnaTabulkaSePrijmeJenKdyzToListinaSamaRika(): void
    {
        // Kdyby se přijímala vždy, tichá změna šablony by vyrobila tahy bez částek
        // a nikdo by si toho nevšiml.
        $podezrele = (string) preg_replace(
            '/<!-- vyhry -->[\s\S]*?<\/table>/',
            '<!-- vyhry --> </table>',
            Fixtury::listina('eurojackpot-2026-37'),
            1,
        );
        $this->expectException(ChybaParsovani::class);
        $this->expectExceptionMessageMatches('/12 pořadí/');
        AllwynVyherka::parsujListinu($podezrele);
    }

    /**
     * @return list<array{datum: string, den: string, sazkovyTyden: array{rok: int, tyden: int}, vsazenoKc: int,
     *     naVyhryKc: ?int, tahy: array{0: array<string, mixed>, 1: array<string, mixed>}, sance: ?array{datum: string,
     *     cislice: string, vsazenoKc: int, poradi: list<array{klic: string, popis: string, vzor: ?string,
     *     pocetVyher: int, vyseVyhryKc: int}>}, prevodBonusKc: ?int, superJackpotKc: ?int}>
     */
    private static function sportky(string $jmeno): array
    {
        $tahy = [];
        foreach (AllwynVyherka::parsujListinu(Fixtury::listina($jmeno)) as $tah) {
            if ($tah['hra'] === 'sportka') {
                $tahy[] = $tah;
            }
        }
        return $tahy;
    }
}
