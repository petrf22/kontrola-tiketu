<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

/**
 * Cesty ke sdíleným testovacím datům.
 *
 * Backend nemá vlastní kopii fixtur — čte tytéž skutečné listiny jako fetcher. Jeden korpus
 * pro oba parsery znamená, že se nemůžou potichu rozejít v tom, na čem se testují.
 */
final class Fixtury
{
    public const KOREN_REPA = __DIR__ . '/../..';
    public const LISTINY = self::KOREN_REPA . '/fetcher/test/fixtures';

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
        $obsah = file_get_contents(self::KOREN_REPA . '/' . $relativne);
        if ($obsah === false) {
            throw new \RuntimeException("Soubor {$relativne} chybí.");
        }
        return $obsah;
    }
}
