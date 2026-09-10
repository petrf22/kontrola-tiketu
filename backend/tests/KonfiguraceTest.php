<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use PHPUnit\Framework\TestCase;

final class KonfiguraceTest extends TestCase
{
    public function testNacteniNeprepisePromenneVolajiciho(): void
    {
        // Stalo se: konfigurace si založila $koren a test si tím přepsal cestu k dočasnému
        // adresáři — databáze a archiv se pak zapisovaly do zdrojáků backendu.
        $koren = '/dočasný/adresář';
        $data = require Konfigurace::KOREN . '/config/konfigurace.php';
        self::assertIsArray($data);
        self::assertSame('/dočasný/adresář', $koren);
    }

    public function testDataLeziMimoDocumentRoot(): void
    {
        $k = Konfigurace::nacti();
        $public = realpath(Konfigurace::KOREN) . '/public';
        foreach ([$k->archiv, $k->databaze, $k->sazby] as $cesta) {
            self::assertStringStartsNotWith($public, $cesta);
        }
        self::assertStringStartsWith(realpath(Konfigurace::KOREN) . '/public/', (string) realpath(dirname($k->verejne)) . '/');
    }

    public function testRozvrhZnaObeHry(): void
    {
        self::assertSame(['eurojackpot', 'sportka'], array_keys(Konfigurace::nacti()->rozvrh));
    }
}
