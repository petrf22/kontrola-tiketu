<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Vystup;
use PHPUnit\Framework\TestCase;

/**
 * Sazby Extra 6 ani Eurošance výherní listina nepublikuje, takže je backend drží
 * v `config/sazby-extra6.json` a `config/sazby-eurosance.json` a přibaluje je ke každému balíku.
 * Ty soubory jsou jediný zdroj pravdy o sazbách.
 */
final class SazbyTest extends TestCase
{
    public function testVychoziKonfiguraceNaSazbyUkazuje(): void
    {
        $konfigurace = Konfigurace::nacti();
        self::assertSame(
            realpath(Fixtury::KOREN . '/config/sazby-extra6.json'),
            realpath($konfigurace->sazby),
        );
        self::assertSame(
            realpath(Fixtury::KOREN . '/config/sazby-eurosance.json'),
            realpath($konfigurace->sazbyEurosance),
        );
    }

    public function testEurosanceMaVsechnaPoradiHernihoPlanuABezSousednihoCisla(): void
    {
        // Herní plán, Euromiliony bod 10: pětičíslí až koncové číslo, sedmé pořadí Eurošance nezná.
        foreach (Vystup::nactiSazby(Fixtury::KOREN . '/config/sazby-eurosance.json') as $sazba) {
            self::assertIsArray($sazba['vyhryKc']);
            self::assertSame(
                ['peticisli', 'ctyrcisli', 'trojcisli', 'dvojcisli', 'koncove-cislo'],
                array_keys($sazba['vyhryKc']),
            );
        }
    }
}
