<?php

declare(strict_types=1);

/*
 * Vstupní bod pro cron hostingu, který umí jen zavolat URL (Gigaserver).
 *
 * Z webu přímo dostupný není. V document rootu leží jen jednořádkový soubor pod tajným jménem
 * cron/<32 hex znaků>.php, který sem odkáže — jméno je jediná ochrana, do gitu nepatří.
 * Postup je v docs/backend.md, oddíl „Gigaserver (jen FTP)“.
 */

require __DIR__ . '/../vendor/autoload.php';

use KontrolaTiketu\Cli\Cron;
use KontrolaTiketu\Konfigurace;

if (PHP_SAPI === 'cli') {
    fwrite(STDERR, "Z příkazové řádky spouštěj bin/vyherka tik.\n");
    exit(2);
}

date_default_timezone_set('Europe/Prague');
// Cron hostingu nemusí na odpověď čekat; běh se nesmí přerušit uprostřed publikace.
ignore_user_abort(true);
set_time_limit(300);

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

try {
    $kod = Cron::spust(Konfigurace::nacti());
} catch (\Throwable) {
    // Log nejde zapsat nebo nejde načíst konfigurace. Podrobnosti ven nepatří.
    $kod = 1;
}
http_response_code($kod === 0 ? 200 : 500);
echo $kod === 0 ? "ok\n" : "chyba\n";
