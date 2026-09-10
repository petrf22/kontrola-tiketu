<?php

declare(strict_types=1);

namespace KontrolaTiketu\Zdroj;

/**
 * Minimální pomůcky pro čtení výherní listiny.
 *
 * Port `fetcher/src/zdroje/html.ts` jedna k jedné. Listina je legacy tiskové HTML, ne dokument,
 * na který má smysl pouštět DOM parser; kotvíme se na značky popsané v docs/data-source.md.
 */
final class Html
{
    /** V listině se vyskytuje jen `&nbsp;` a číselné entity; pět standardních přidáváme pro jistotu. */
    private const POJMENOVANE = [
        'nbsp' => "\u{00a0}",
        'amp' => '&',
        'lt' => '<',
        'gt' => '>',
        'quot' => '"',
        'apos' => "'",
    ];

    private function __construct()
    {
    }

    /**
     * Dekóduje HTML entity.
     *
     * Bez tohohle kroku nesedne nic — diakritika je v listině zapsaná číselně, takže v surových
     * bajtech stojí `SPORTKA ST&#x158;EDA`, ne `SPORTKA STŘEDA`.
     *
     * Schválně to není `html_entity_decode`: ten zná stovky pojmenovaných entit a výsledek by se
     * mohl rozejít s fetcherem. Neznámou entitu nechává být, stejně jako předloha.
     */
    public static function dekodujEntity(string $text): string
    {
        $vysledek = preg_replace_callback(
            '/&(#[xX][0-9A-Fa-f]+|#[0-9]+|[a-zA-Z]+);/',
            static function (array $m): string {
                $telo = $m[1];
                if (str_starts_with($telo, '#x') || str_starts_with($telo, '#X')) {
                    return self::znak((int) hexdec(substr($telo, 2)), $m[0]);
                }
                if (str_starts_with($telo, '#')) {
                    return self::znak((int) substr($telo, 1), $m[0]);
                }
                return self::POJMENOVANE[$telo] ?? $m[0];
            },
            $text,
        );
        if ($vysledek === null) {
            throw new ChybaParsovani('Dekódování entit selhalo: ' . preg_last_error_msg());
        }
        return $vysledek;
    }

    private static function znak(int $kod, string $puvodni): string
    {
        // Náhradní páry (surrogates) ani kódy za U+10FFFF nejsou znaky; mb_chr by vrátil false.
        if ($kod > 0x10FFFF || ($kod >= 0xD800 && $kod <= 0xDFFF)) {
            throw new ChybaParsovani("Entita {$puvodni} neodpovídá platnému znaku.");
        }
        return mb_chr($kod, 'UTF-8');
    }

    /**
     * Převede částku z listiny na číslo.
     *
     * Oddělovačem tisíců je nedělitelná mezera, desetinným oddělovačem čárka
     * (`263 731 922,00 Kč`). Haléře se zahazují — listina je uvádí jen u součtů, ne u výher.
     *
     * Chování kopíruje `Number.parseFloat` + `Math.round` z předlohy: bere se číselný začátek
     * řetězce a zaokrouhluje se polovina nahoru.
     */
    public static function naCastku(string $text): ?int
    {
        $ocistene = Regex::nahrad('/' . Regex::MEZERA . '/u', '', $text);
        $ocistene = Regex::nahrad('/,/', '.', $ocistene, 1);
        if ($ocistene === '') {
            return null;
        }
        $zacatek = Regex::shoda('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/', $ocistene);
        if ($zacatek === null) {
            return null;
        }
        $hodnota = (float) $zacatek[0];
        if (!is_finite($hodnota)) {
            return null;
        }
        return (int) floor($hodnota + 0.5);
    }

    /**
     * Najde částku uvedenou za popiskem.
     *
     * Mezi popiskem a číslem jsou HTML tagy, jejichž třídy samy obsahují číslice (`b2`, `s18b`),
     * takže se nedá jen přeskočit „nečíslice“ — kotvíme se až na „Kč“ za částkou.
     */
    public static function castkaZa(string $usek, string $popisek): ?int
    {
        $m = Regex::MEZERA;
        $nalez = Regex::shoda(
            '/' . preg_quote($popisek, '/') . "[\\s\\S]*?([\\d\\s\\x{00a0}]+(?:,\\d+)?){$m}*Kč/u",
            $usek,
        );
        return $nalez === null || !isset($nalez[1]) ? null : self::naCastku($nalez[1]);
    }

    /**
     * Vrátí čísla z řádků `<tr class="loscisla">`. Prázdné řádky (hlavičky) vynechává.
     *
     * @return list<list<string>>
     */
    public static function vylosovanaCisla(string $usek): array
    {
        $m = Regex::MEZERA;
        $vysledek = [];
        foreach (Regex::vsechny('/<tr class="loscisla[^"]*">([\s\S]*?)<\/tr>/u', $usek) as $radek) {
            $cisla = array_map(
                static fn (array $bunka): string => $bunka[1],
                Regex::vsechny("/<td class=\"b2 s32b\">{$m}*(\\d+){$m}*<\\/td>/u", $radek[1]),
            );
            if ($cisla !== []) {
                $vysledek[] = $cisla;
            }
        }
        return $vysledek;
    }

    /** Datum losování v ISO tvaru. */
    public static function datumLosovani(string $usek): ?string
    {
        $m = Regex::MEZERA;
        $nalez = Regex::shoda("/Losování dne:{$m}*(\\d{2})\\.{$m}*(\\d{2})\\.{$m}*(\\d{4})/u", $usek);
        if ($nalez === null) {
            return null;
        }
        return "{$nalez[3]}-{$nalez[2]}-{$nalez[1]}";
    }
}
