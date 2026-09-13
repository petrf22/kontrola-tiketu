<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

/**
 * Cesty k testovacím datům. Backend je soběstačný — nečte nic mimo vlastní adresář.
 *
 * `tests/fixtures/` drží skutečné listiny Allwyn (viz PUVOD.md) a z nich vyrobený balík
 * výsledků, proti kterému se hlídá bajtová stabilita výstupu.
 */
final class Fixtury
{
    public const KOREN = __DIR__ . '/..';
    public const LISTINY = __DIR__ . '/fixtures';

    public static function listina(string $jmeno): string
    {
        $data = file_get_contents(self::LISTINY . "/{$jmeno}.html.gz");
        if ($data === false) {
            throw new \RuntimeException("Fixtura {$jmeno} chybí.");
        }
        $html = gzdecode($data);
        if ($html === false) {
            throw new \RuntimeException("Fixtura {$jmeno} není platný gzip.");
        }
        return $html;
    }

    public static function soubor(string $relativne): string
    {
        $obsah = file_get_contents(self::KOREN . '/' . $relativne);
        if ($obsah === false) {
            throw new \RuntimeException("Soubor {$relativne} chybí.");
        }
        return $obsah;
    }
}
