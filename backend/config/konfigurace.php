<?php

declare(strict_types=1);

/*
 * Výchozí nastavení backendu. Na hostingu se jednotlivé hodnoty přepisují
 * v config/konfigurace.lokalni.php, který se do gitu nedává.
 *
 * Obsah je ve vlastní funkci: soubor se načítá přes require a proměnná tady by jinak přepsala
 * stejnojmennou proměnnou u volajícího.
 */

return (static function (): array {
    $koren = dirname(__DIR__);

    return [
        // Archiv listin ve formátu fetcher/.cache — naplní se nahráním archivu z desktopu.
        'archiv' => "{$koren}/var/archiv",
        'databaze' => "{$koren}/var/stav.sqlite",
        // Web servíruje tenhle adresář jako /v1/. Musí ležet v document rootu, var/ naopak mimo něj.
        'verejne' => "{$koren}/public/v1",
        // Kopie data/sazby-extra6.json z repozitáře; že sedí, hlídá SazbyTest.
        'sazby' => "{$koren}/config/sazby-extra6.json",
        // Stejné období jako dosavadní data/vysledky.json.
        'odRoku' => 2021,

        /*
         * Dny losování zjištěné z archivu (1190 tahů 2021–2026). Nejsou dogma: jeden tah Sportky
         * se v archivu losoval v úterý. Takové výjimky chytá uzavírání týdne.
         *
         * Časy prvního dotazu jsou odhad, ne ověřený údaj. Nevadí to, rozvrh se v okně ptá každou
         * hodinu, dokud výsledek nemá. Databáze si u tahu zapisuje, kdy byl poprvé úplný — podle
         * toho se časy po pár týdnech upraví na změřené (`bin/vyherka stav` je vypíše).
         *
         * Okno je omezené schválně: kdyby se v plánovaný den nelosovalo, „ptej se, dokud to není“
         * by bez omezení znamenalo dotaz každou hodinu po celý týden. Co okno nestihne, dožene
         * jedno denní stažení.
         */
        'rozvrh' => [
            'eurojackpot' => ['dny' => ['ut', 'pa'], 'prvniDotaz' => '22:00', 'oknoHodin' => 4],
            'sportka' => ['dny' => ['st', 'pa', 'ne'], 'prvniDotaz' => '21:00', 'oknoHodin' => 4],
        ],
        // Jednou denně se zkusí, co okno nestihlo, a v pondělí se uzavře minulý týden.
        'denniDohaneni' => '10:00',
        // Pojistka proti bušení do zdroje, kdyby se rozvrh někdy zbláznil. Počítá i robots.txt.
        'maxDotazuNaBeh' => 6,
    ];
})();
