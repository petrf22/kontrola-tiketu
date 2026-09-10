<?php

declare(strict_types=1);

namespace KontrolaTiketu;

use KontrolaTiketu\Zdroj\AllwynVyherka;

/**
 * Sestavení souboru s výsledky — přesně toho, co dnes vyrábí fetcher a čte aplikace.
 *
 * Port `fetcher/src/vystup.ts` a `serad` z `packages/jadro/src/slucovani.ts`.
 *
 * @phpstan-import-type Tah from Model
 * @phpstan-import-type Tyden from Obdobi
 * @phpstan-type SazbyExtra6 array<string, mixed>
 * @phpstan-type VystupniSoubor array{
 *     verzeFormatu: int,
 *     vygenerovano: string,
 *     zdroj: string,
 *     obdobi: array{od: string, do: string}|null,
 *     sazbyExtra6: list<SazbyExtra6>,
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
     * @param array{od: Tyden, do: Tyden}|null $obdobi
     * @return VystupniSoubor
     */
    public static function sestav(
        array $tahy,
        array $sazbyExtra6,
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
     * Načte sazby Extra 6 ze souboru ve tvaru `data/sazby-extra6.json`.
     *
     * @return list<SazbyExtra6>
     */
    public static function nactiSazby(string $cesta): array
    {
        $text = file_get_contents($cesta);
        if ($text === false) {
            throw new \RuntimeException("Sazby Extra 6 v {$cesta} nejdou přečíst.");
        }
        $obsah = Json::cti($text);
        if (!is_array($obsah) || !isset($obsah['sazby']) || !is_array($obsah['sazby']) || !array_is_list($obsah['sazby'])) {
            throw new \RuntimeException("Soubor {$cesta} nemá pole „sazby“.");
        }
        $sazby = [];
        foreach ($obsah['sazby'] as $sazba) {
            if (!is_array($sazba)) {
                throw new \RuntimeException("Soubor {$cesta} obsahuje sazbu, která není objekt.");
            }
            /** @var SazbyExtra6 $sazba */
            $sazby[] = $sazba;
        }
        return $sazby;
    }
}
