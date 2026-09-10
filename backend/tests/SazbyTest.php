<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use PHPUnit\Framework\TestCase;

/**
 * Na hosting se nahrává jen `backend/`, takže sazby Extra 6 musí mít vlastní kopii.
 * Zdrojem pravdy zůstává `data/sazby-extra6.json` — kdo ho změní, musí změnit i kopii,
 * jinak by aplikace z backendu dostala jiné sazby než ze souboru od fetcheru.
 */
final class SazbyTest extends TestCase
{
    public function testKopieSazebVBackenduSediSeZdrojem(): void
    {
        self::assertSame(
            Fixtury::soubor('data/sazby-extra6.json'),
            Fixtury::soubor('backend/config/sazby-extra6.json'),
            'Zkopíruj data/sazby-extra6.json do backend/config/.',
        );
    }

    public function testVychoziKonfiguraceNaKopiiUkazuje(): void
    {
        $konfigurace = Konfigurace::nacti();
        self::assertSame(
            realpath(Fixtury::KOREN_REPA . '/backend/config/sazby-extra6.json'),
            realpath($konfigurace->sazby),
        );
    }
}
