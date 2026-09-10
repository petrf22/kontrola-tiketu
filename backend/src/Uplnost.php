<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Je tah hotový, nebo se na něj má backend ptát dál?
 *
 * Čerstvě po losování může listina nést tažená čísla a místo tabulky výher větu „Probíhá
 * zpracování výsledků“. Parser takový tah přečte (u starých tahů to tak zůstává natrvalo),
 * ale pro rozvrh je neúplný: bez tabulky se nedá spočítat výhra, takže se má zeptat znovu.
 *
 * @phpstan-import-type Tah from Model
 */
final class Uplnost
{
    private function __construct()
    {
    }

    /** @param Tah $tah */
    public static function jeUplny(array $tah): bool
    {
        if ($tah['hra'] === 'eurojackpot') {
            return $tah['poradi'] !== [];
        }
        return $tah['tahy'][0]['poradi'] !== []
            && $tah['tahy'][1]['poradi'] !== []
            && $tah['sance'] !== null
            && $tah['sance']['poradi'] !== [];
    }
}
