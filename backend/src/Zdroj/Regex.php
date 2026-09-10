<?php

declare(strict_types=1);

namespace KontrolaTiketu\Zdroj;

/**
 * Regulární výrazy, které se nesmí tiše splést.
 *
 * `preg_match` při chybě enginu (neplatné UTF-8, přetečený `pcre.backtrack_limit`) nevyhodí
 * výjimku, ale vrátí `false` — a to se v podmínce chová stejně jako „nenalezeno“. U parseru by
 * to znamenalo tah bez částek místo chyby. Všechna volání proto jdou tudy.
 *
 * Pozor na bílé znaky: `\s` v JavaScriptu chytá i nedělitelnou mezeru (U+00A0), kterou je
 * listina prošpikovaná. V PCRE to závisí na verzi knihovny, a tedy i na hostingu. Vzory v tomhle
 * balíku proto píšou nedělitelnou mezeru výslovně, viz {@see self::MEZERA}.
 */
final class Regex
{
    /** Bílý znak tak, jak ho chápe `\s` v JavaScriptu — pro účely listiny. */
    public const MEZERA = '[\s\x{00a0}]';

    private function __construct()
    {
    }

    /**
     * První shoda, nebo `null`.
     *
     * @return array<string>|null
     */
    public static function shoda(string $vzor, string $text): ?array
    {
        $vysledek = preg_match($vzor, $text, $nalez);
        self::zkontroluj($vysledek, $vzor);
        return $vysledek === 1 ? $nalez : null;
    }

    /**
     * Všechny shody v pořadí dokumentu.
     *
     * @return list<array<string>>
     */
    public static function vsechny(string $vzor, string $text): array
    {
        $vysledek = preg_match_all($vzor, $text, $nalezy, PREG_SET_ORDER);
        self::zkontroluj($vysledek, $vzor);
        return $nalezy;
    }

    /**
     * Všechny shody i s bajtovou pozicí začátku.
     *
     * @return list<array{0: array{string, int}, 1: array{string, int}, 2: array{string, int}}>
     */
    public static function vsechnySPozici(string $vzor, string $text): array
    {
        $vysledek = preg_match_all($vzor, $text, $nalezy, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        self::zkontroluj($vysledek, $vzor);
        /** @var list<array{0: array{string, int}, 1: array{string, int}, 2: array{string, int}}> $nalezy */
        return $nalezy;
    }

    public static function nahrad(string $vzor, string $nahrada, string $text, int $limit = -1): string
    {
        $vysledek = preg_replace($vzor, $nahrada, $text, $limit);
        if ($vysledek === null) {
            throw new ChybaParsovani("Regulární výraz {$vzor} selhal: " . preg_last_error_msg());
        }
        return $vysledek;
    }

    private static function zkontroluj(int|false $vysledek, string $vzor): void
    {
        if ($vysledek === false || preg_last_error() !== PREG_NO_ERROR) {
            throw new ChybaParsovani("Regulární výraz {$vzor} selhal: " . preg_last_error_msg());
        }
    }
}
