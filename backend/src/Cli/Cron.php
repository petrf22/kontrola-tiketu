<?php

declare(strict_types=1);

namespace KontrolaTiketu\Cli;

use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Sit\Klient;
use KontrolaTiketu\Sit\Sit;
use KontrolaTiketu\Sit\SitHttp;

/**
 * Běh `tik` z cronu hostingu, který umí jen zavolat URL (Gigaserver, viz docs/backend.md).
 *
 * Je to přesně `bin/vyherka tik` včetně zámku, jen hlášky nejdou na výstup, ale do `tik.log`
 * vedle databáze. Z webu tak není vidět nic víc než „ok“ nebo „chyba“.
 */
final class Cron
{
    public static function spust(
        Konfigurace $konfigurace,
        Sit $sit = new SitHttp(),
        int $prodlevaMs = Klient::PRODLEVA_MS,
        ?\DateTimeImmutable $ted = null,
    ): int {
        $ted ??= new \DateTimeImmutable('now', new \DateTimeZone('Europe/Prague'));
        $adresar = dirname($konfigurace->databaze);
        if (!is_dir($adresar)) {
            mkdir($adresar, 0o775, true);
        }
        $log = "{$adresar}/tik.log";
        $zapis = static function (string $radek) use ($log, $ted): void {
            file_put_contents($log, '[' . $ted->format('Y-m-d H:i:s') . "] {$radek}\n", FILE_APPEND | LOCK_EX);
        };

        $kod = (new Cli($konfigurace, $zapis, $zapis, $sit, $prodlevaMs, $ted))->hlavni(['tik']);
        $zapis("tik skončil s kódem {$kod}");
        return $kod;
    }
}
