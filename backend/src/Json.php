<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Zápis JSON bajt po bajtu shodný s `JSON.stringify(data, null, 2) + '\n'` fetcheru.
 *
 * Shoda není kosmetika: díky ní se dá výstup backendu přímo porovnat s výstupem fetcheru
 * a každé rozejití parserů je vidět jako rozdíl v souboru, ne až jako špatně vyhodnocený tiket.
 *
 * Rozdíly mezi PHP a JavaScriptem, které tu jsou ošetřené:
 * - PHP odsazuje čtyřmi mezerami, JS dvěma — odsazení se půlí. Řetězce nikdy neobsahují
 *   syrový konec řádku (JSON ho escapuje), takže úvodní mezery řádku jsou vždy odsazení.
 * - PHP ve výchozím stavu escapuje lomítka, znaky mimo ASCII i U+2028/U+2029; JS nic z toho.
 *
 * Pozor na prázdný objekt: `json_decode(..., true)` z `{}` udělá prázdné pole a zpátky vyjde
 * `[]`. Ve formátu výsledků žádný prázdný objekt není; kdyby přibyl, tady se to rozbije.
 */
final class Json
{
    private const PRIZNAKY = JSON_PRETTY_PRINT
        | JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_LINE_TERMINATORS
        | JSON_THROW_ON_ERROR;

    private function __construct()
    {
    }

    public static function zapis(mixed $data): string
    {
        $ctyri = json_encode($data, self::PRIZNAKY);
        $dve = preg_replace_callback(
            '/^( +)/m',
            static fn (array $m): string => str_repeat(' ', intdiv(strlen($m[1]), 2)),
            $ctyri,
        );
        if ($dve === null) {
            throw new \RuntimeException('Úprava odsazení JSON selhala: ' . preg_last_error_msg());
        }
        return $dve . "\n";
    }

    /** Kompaktní zápis bez odsazení — pro ukládání do databáze. */
    public static function kompaktne(mixed $data): string
    {
        return json_encode($data, self::PRIZNAKY & ~JSON_PRETTY_PRINT);
    }

    public static function cti(string $text): mixed
    {
        return json_decode($text, true, 512, JSON_THROW_ON_ERROR);
    }
}
