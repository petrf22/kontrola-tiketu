<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Cli;

use KontrolaTiketu\Cli\Cron;
use KontrolaTiketu\Json;
use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Sit\Odpoved;
use KontrolaTiketu\Test\DocasnyAdresar;
use KontrolaTiketu\Test\Sit\FalesnaSit;
use KontrolaTiketu\Test\Sit\RobotsTest;
use PHPUnit\Framework\TestCase;

final class CronTest extends TestCase
{
    use DocasnyAdresar;

    public function testHlaskyTikuJdouDoLoguSCasemANaVystupNic(): void
    {
        $koren = $this->docasny();
        $vychozi = require Konfigurace::KOREN . '/config/konfigurace.php';
        self::assertIsArray($vychozi);
        $konfigurace = Konfigurace::zPole([
            ...$vychozi,
            'archiv' => "{$koren}/var/archiv",
            'databaze' => "{$koren}/var/stav.sqlite",
            'verejne' => "{$koren}/public/v1",
        ]);
        $sit = new FalesnaSit(['https://www.allwyn.cz/robots.txt' => new Odpoved(200, RobotsTest::ALLWYN)]);
        $ted = new \DateTimeImmutable('2026-09-08 22:05', new \DateTimeZone('Europe/Prague'));

        $this->expectOutputString('');
        $kod = Cron::spust($konfigurace, $sit, 0, $ted);
        Cron::spust($konfigurace, $sit, 0, $ted->modify('+1 hour'));

        $log = (string) file_get_contents("{$koren}/var/tik.log");
        self::assertStringContainsString("[2026-09-08 22:05:00] tik skončil s kódem {$kod}\n", $log);
        self::assertStringContainsString('[2026-09-08 23:05:00] tik skončil s kódem', $log, 'druhý běh log připisuje');
        self::assertFileExists("{$koren}/public/v1/manifest.json", 'tik publikuje stejně jako z příkazové řádky');
        self::assertIsArray(Json::cti((string) file_get_contents("{$koren}/public/v1/manifest.json")));
    }
}
