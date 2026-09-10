<?php

declare(strict_types=1);

namespace KontrolaTiketu;

use KontrolaTiketu\Zdroj\AllwynVyherka;
use KontrolaTiketu\Zdroj\ChybaParsovani;

/**
 * Archiv → tahy, bez jediného dotazu na síť.
 *
 * Port jádra příkazu `preparsuj` z `fetcher/src/cli.ts`. Jedna vadná listina nesmí shodit celý
 * běh; nad archivem o tisících položek by to znamenalo, že se kvůli jednomu týdnu nedostaneš
 * k ničemu. Vadné listiny se proto vracejí zvlášť, aby je volající mohl ohlásit.
 *
 * @phpstan-import-type Tah from Model
 * @phpstan-import-type Tyden from Obdobi
 * @phpstan-import-type Souradnice from Archiv
 * @phpstan-type Vysledek array{tahy: list<Tah>, zaznamy: list<Souradnice>, prazdnych: int, nepovedene: list<string>}
 */
final class Preparsovani
{
    private function __construct()
    {
    }

    /**
     * @param list<string> $hry
     * @param Tyden|null $od
     * @param Tyden|null $doTydne
     * @return Vysledek
     */
    public static function zArchivu(Archiv $archiv, array $hry, ?array $od, ?array $doTydne): array
    {
        $zaznamy = self::vyber($archiv->seznam(), $hry, $od, $doTydne);

        $tahy = [];
        $prazdnych = 0;
        $nepovedene = [];
        foreach ($zaznamy as $zaznam) {
            $html = $archiv->nacti($zaznam);
            if ($html === null) {
                continue;
            }
            if (AllwynVyherka::jePrazdna($html)) {
                $prazdnych += 1;
                continue;
            }
            try {
                array_push($tahy, ...AllwynVyherka::parsujListinu($html));
            } catch (ChybaParsovani $chyba) {
                $nepovedene[] = "{$zaznam['hra']} " . Obdobi::formatujTyden($zaznam) . ": {$chyba->getMessage()}";
            }
        }

        return ['tahy' => $tahy, 'zaznamy' => $zaznamy, 'prazdnych' => $prazdnych, 'nepovedene' => $nepovedene];
    }

    /**
     * Které listiny z archivu se mají zpracovat podle zadaných her a období.
     *
     * @param list<Souradnice> $zaznamy
     * @param list<string> $hry
     * @param Tyden|null $od
     * @param Tyden|null $doTydne
     * @return list<Souradnice>
     */
    public static function vyber(array $zaznamy, array $hry, ?array $od, ?array $doTydne): array
    {
        return array_values(array_filter(
            $zaznamy,
            static fn (array $z): bool => in_array($z['hra'], $hry, true)
                && ($od === null || Obdobi::klic($z) >= Obdobi::klic($od))
                && ($doTydne === null || Obdobi::klic($z) <= Obdobi::klic($doTydne)),
        ));
    }
}
