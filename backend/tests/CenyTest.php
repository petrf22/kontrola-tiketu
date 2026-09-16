<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Model;
use KontrolaTiketu\Vystup;
use PHPUnit\Framework\TestCase;

/**
 * Ceník sázek v `config/ceny.json` je ruční opis z herních plánů. Tady se hlídá, aby opis
 * nebyl vnitřně rozporný. Že částky sedí s plánem, test ověřit neumí; to hlídá pole `zdroj`.
 */
final class CenyTest extends TestCase
{
    public function testVychoziKonfiguraceNaCenikUkazuje(): void
    {
        self::assertSame(
            realpath(Fixtury::KOREN . '/config/ceny.json'),
            realpath(Konfigurace::nacti()->ceny),
        );
    }

    public function testKazdaHraMaCenikSeVzestupnymiDatyAKladnymiCenami(): void
    {
        $podleHry = [];
        foreach (self::ceny() as $cena) {
            self::assertSame(['hra', 'platnostOd', 'sloupecKc', 'doplnkovaHraKc', 'zdroj'], array_keys($cena));
            self::assertIsString($cena['hra']);
            self::assertContains($cena['hra'], Model::HRY);
            self::assertIsString($cena['platnostOd']);
            self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $cena['platnostOd']);
            self::assertIsInt($cena['sloupecKc']);
            self::assertGreaterThan(0, $cena['sloupecKc']);
            if ($cena['doplnkovaHraKc'] !== null) {
                self::assertIsInt($cena['doplnkovaHraKc']);
                self::assertGreaterThan(0, $cena['doplnkovaHraKc']);
            }
            self::assertIsString($cena['zdroj']);
            self::assertNotSame('', $cena['zdroj']);
            $podleHry[$cena['hra']][] = $cena['platnostOd'];
        }

        foreach (Model::HRY as $hra) {
            self::assertArrayHasKey($hra, $podleHry, "Ceník nezná hru {$hra}.");
            $serazene = $podleHry[$hra];
            sort($serazene);
            self::assertSame($serazene, $podleHry[$hra], "Ceník hry {$hra} není seřazený podle data.");
            self::assertSame(array_unique($podleHry[$hra]), $podleHry[$hra], "Ceník hry {$hra} má dvakrát totéž datum.");
        }
    }

    /**
     * Cena doplňkové hry je zapsaná dvakrát: v ceníku a jako `sazkaKc` u sazeb, ze kterých
     * se počítají výhry. Kde se období překrývají, musí se shodovat.
     */
    public function testCenaDoplnkoveHrySediSeSazbami(): void
    {
        $sazby = [
            'eurojackpot' => Vystup::nactiSazby(Fixtury::KOREN . '/config/sazby-extra6.json'),
            'euromiliony' => Vystup::nactiSazby(Fixtury::KOREN . '/config/sazby-eurosance.json'),
        ];
        foreach ($sazby as $hra => $seznam) {
            foreach ($seznam as $sazba) {
                self::assertIsString($sazba['platnostOd']);
                $cena = self::platnaCena($hra, $sazba['platnostOd']);
                self::assertNotNull($cena, "Ceník nezná cenu {$hra} k {$sazba['platnostOd']}.");
                self::assertSame($sazba['sazkaKc'], $cena['doplnkovaHraKc'], "Cena doplňkové hry {$hra} k {$sazba['platnostOd']}.");
            }
        }
    }

    /** @return list<array<string, mixed>> */
    private static function ceny(): array
    {
        return Vystup::nactiCeny(Fixtury::KOREN . '/config/ceny.json');
    }

    /** @return array<string, mixed>|null */
    private static function platnaCena(string $hra, string $datum): ?array
    {
        $platna = null;
        foreach (self::ceny() as $cena) {
            if ($cena['hra'] === $hra && $cena['platnostOd'] <= $datum) {
                $platna = $cena;
            }
        }
        return $platna;
    }
}
