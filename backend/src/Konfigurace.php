<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Nastavení backendu.
 *
 * Výchozí hodnoty jsou v `config/konfigurace.php` (v gitu), cesty a nastavení konkrétního
 * hostingu v `config/konfigurace.lokalni.php` (mimo git). Lokální soubor přepisuje jen to,
 * co uvede.
 */
final class Konfigurace
{
    public const KOREN = __DIR__ . '/..';

    /**
     * @param string $archiv Adresář s listinami ve formátu fetcher/.cache.
     * @param string $databaze Soubor SQLite se stavem.
     * @param string $verejne Adresář, ze kterého web servíruje `/v1/`.
     * @param string $sazby Soubor se sazbami Extra 6.
     * @param int $odRoku Od kterého roku se výsledky publikují.
     * @param array<string, array{dny: list<string>, prvniDotaz: string, oknoHodin: int}> $rozvrh Dny losování, čas prvního dotazu a délka hodinového okna podle hry.
     * @param string $denniDohaneni Kdy se jednou denně projdou otevřené týdny.
     * @param int $maxDotazuNaBeh Pojistka proti bušení do zdroje.
     */
    public function __construct(
        public readonly string $archiv,
        public readonly string $databaze,
        public readonly string $verejne,
        public readonly string $sazby,
        public readonly int $odRoku,
        public readonly array $rozvrh,
        public readonly string $denniDohaneni,
        public readonly int $maxDotazuNaBeh,
    ) {
    }

    public static function nacti(string $adresar = self::KOREN . '/config'): self
    {
        $data = self::soubor("{$adresar}/konfigurace.php");
        if (is_file("{$adresar}/konfigurace.lokalni.php")) {
            $data = array_replace($data, self::soubor("{$adresar}/konfigurace.lokalni.php"));
        }
        return self::zPole($data);
    }

    /** @param array<mixed> $d */
    public static function zPole(array $d): self
    {
        $rozvrh = $d['rozvrh'] ?? null;
        if (!is_array($rozvrh)) {
            throw new \RuntimeException('Konfigurace nemá „rozvrh“.');
        }
        $vycisteny = [];
        foreach ($rozvrh as $hra => $nastaveni) {
            if (!is_string($hra) || !is_array($nastaveni) || !is_array($nastaveni['dny'] ?? null)) {
                throw new \RuntimeException('Rozvrh hry musí mít „dny“, „prvniDotaz“ a „oknoHodin“.');
            }
            $vycisteny[$hra] = [
                'dny' => array_values(array_map(self::retezec(...), $nastaveni['dny'])),
                'prvniDotaz' => self::retezec($nastaveni['prvniDotaz'] ?? null),
                'oknoHodin' => self::cislo($nastaveni['oknoHodin'] ?? null),
            ];
        }

        return new self(
            archiv: self::retezec($d['archiv'] ?? null),
            databaze: self::retezec($d['databaze'] ?? null),
            verejne: self::retezec($d['verejne'] ?? null),
            sazby: self::retezec($d['sazby'] ?? null),
            odRoku: self::cislo($d['odRoku'] ?? null),
            rozvrh: $vycisteny,
            denniDohaneni: self::retezec($d['denniDohaneni'] ?? null),
            maxDotazuNaBeh: self::cislo($d['maxDotazuNaBeh'] ?? null),
        );
    }

    /** @return array<mixed> */
    private static function soubor(string $cesta): array
    {
        $data = require $cesta;
        if (!is_array($data)) {
            throw new \RuntimeException("Konfigurace {$cesta} musí vracet pole.");
        }
        return $data;
    }

    private static function retezec(mixed $hodnota): string
    {
        if (!is_string($hodnota) || $hodnota === '') {
            throw new \RuntimeException('Konfigurace obsahuje prázdnou nebo chybějící hodnotu.');
        }
        return $hodnota;
    }

    private static function cislo(mixed $hodnota): int
    {
        if (!is_int($hodnota)) {
            throw new \RuntimeException('Konfigurace obsahuje hodnotu, která není celé číslo.');
        }
        return $hodnota;
    }
}
