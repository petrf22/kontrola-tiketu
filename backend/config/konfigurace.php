<?php

declare(strict_types=1);

/*
 * Výchozí nastavení backendu. Na hostingu se jednotlivé hodnoty přepisují
 * v config/konfigurace.lokalni.php, který se do gitu nedává.
 */

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
     * se v archivu losoval v úterý. Takové výjimky chytá denní dohánění.
     *
     * Časy prvního dotazu jsou odhad, ne ověřený údaj. Nevadí to, rozvrh se ptá každou hodinu,
     * dokud výsledek nemá. Databáze si u tahu zapisuje, kdy ho viděla poprvé — podle toho se
     * časy po pár týdnech upraví na změřené.
     */
    'rozvrh' => [
        'eurojackpot' => ['dny' => ['ut', 'pa'], 'prvniDotaz' => '22:00'],
        'sportka' => ['dny' => ['st', 'pa', 'ne'], 'prvniDotaz' => '21:00'],
    ],
    'denniDohaneni' => '10:00',
    'maxDotazuNaBeh' => 6,
];
