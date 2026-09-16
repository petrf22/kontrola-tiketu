<?php

declare(strict_types=1);

namespace KontrolaTiketu;

use KontrolaTiketu\Zdroj\AllwynVyherka;

/**
 * Sestavení souboru s výsledky — balíku, který čte aplikace (stažením i importem souboru).
 *
 * @phpstan-import-type Tah from Model
 * @phpstan-import-type Tyden from Obdobi
 * @phpstan-type SazbyExtra6 array<string, mixed>
 * @phpstan-type SazbyEurosance array<string, mixed>
 * @phpstan-type CenikHry array<string, mixed>
 * @phpstan-type VystupniSoubor array{
 *     verzeFormatu: int,
 *     vygenerovano: string,
 *     zdroj: string,
 *     obdobi: array{od: string, do: string}|null,
 *     sazbyExtra6: list<SazbyExtra6>,
 *     sazbyEurosance: list<SazbyEurosance>,
 *     ceny: list<CenikHry>,
 *     tahy: list<Tah>
 * }
 */
final class Vystup
{
    private function __construct()
    {
    }

    /**
     * @param list<Tah> $tahy
     * @param list<SazbyExtra6> $sazbyExtra6
     * @param list<SazbyEurosance> $sazbyEurosance
     * @param list<CenikHry> $ceny
     * @param array{od: Tyden, do: Tyden}|null $obdobi
     * @return VystupniSoubor
     */
    public static function sestav(
        array $tahy,
        array $sazbyExtra6,
        array $sazbyEurosance,
        array $ceny,
        ?array $obdobi,
        \DateTimeImmutable $vygenerovano,
    ): array {
        return [
            'verzeFormatu' => Model::VERZE_FORMATU,
            'vygenerovano' => self::isoCas($vygenerovano),
            'zdroj' => AllwynVyherka::ZAKLADNI_URL,
            'obdobi' => $obdobi === null
                ? null
                : ['od' => Obdobi::formatujTyden($obdobi['od']), 'do' => Obdobi::formatujTyden($obdobi['do'])],
            'sazbyExtra6' => $sazbyExtra6,
            'sazbyEurosance' => $sazbyEurosance,
            'ceny' => $ceny,
            'tahy' => self::serad($tahy),
        ];
    }

    /**
     * Seřadí tahy chronologicky a zahodí duplicity. Při duplicitě vítězí pozdější záznam.
     *
     * Klíčem je dvojice hra a datum — číslo tahu výherní listina neuvádí a jeden den se může
     * losovat víc her. Přepsání existujícího klíče drží jeho pozici, stejně jako `Map.set`.
     *
     * @param list<Tah> $tahy
     * @return list<Tah>
     */
    public static function serad(array $tahy): array
    {
        $podleKlice = [];
        foreach ($tahy as $tah) {
            $podleKlice["{$tah['hra']}|{$tah['datum']}"] = $tah;
        }
        $vysledek = array_values($podleKlice);
        usort(
            $vysledek,
            static fn (array $a, array $b): int => strcmp($a['datum'], $b['datum']) ?: strcmp($a['hra'], $b['hra']),
        );
        return $vysledek;
    }

    /** Stejný tvar jako `Date.prototype.toISOString()`: UTC, milisekundy, `Z`. */
    public static function isoCas(\DateTimeImmutable $cas): string
    {
        return $cas->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    /**
     * Načte sazby doplňkové hry ze souboru ve tvaru `config/sazby-extra6.json`
     * nebo `config/sazby-eurosance.json`. Obsah sazeb backend nevykládá, jen je předá aplikaci.
     *
     * @return list<array<string, mixed>>
     */
    public static function nactiSazby(string $cesta): array
    {
        return self::nactiSeznam($cesta, 'sazby');
    }

    /**
     * Načte ceník sázek z `config/ceny.json`. Stejně jako sazby ho backend nevykládá,
     * jen ho předá aplikaci.
     *
     * @return list<array<string, mixed>>
     */
    public static function nactiCeny(string $cesta): array
    {
        return self::nactiSeznam($cesta, 'ceny');
    }

    /** @return list<array<string, mixed>> */
    private static function nactiSeznam(string $cesta, string $klic): array
    {
        $text = file_get_contents($cesta);
        if ($text === false) {
            throw new \RuntimeException("Soubor {$cesta} nejde přečíst.");
        }
        $obsah = Json::cti($text);
        if (!is_array($obsah) || !isset($obsah[$klic]) || !is_array($obsah[$klic]) || !array_is_list($obsah[$klic])) {
            throw new \RuntimeException("Soubor {$cesta} nemá pole „{$klic}“.");
        }
        $polozky = [];
        foreach ($obsah[$klic] as $polozka) {
            if (!is_array($polozka)) {
                throw new \RuntimeException("Soubor {$cesta} obsahuje v poli „{$klic}“ něco, co není objekt.");
            }
            /** @var array<string, mixed> $polozka */
            $polozky[] = $polozka;
        }
        return $polozky;
    }
}
