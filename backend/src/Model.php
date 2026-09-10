<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Tvar dat, která backend čte z listiny a publikuje aplikaci.
 *
 * Předlohou je `packages/jadro/src/model.ts` a tvar musí sedět do posledního klíče — aplikace
 * výstup backendu čte stejným kódem jako soubor od fetcheru. Tahy jsou proto obyčejná
 * asociativní pole, ne objekty: na **pořadí klíčů** stojí bajtová shoda s výstupem fetcheru,
 * kterou hlídá `tests/ShodaSFetcheremTest.php`.
 *
 * @phpstan-type SazkovyTyden array{rok: int, tyden: int}
 * @phpstan-type Poradi array{klic: string, popis: string, pocetVyher: int, vyseVyhryKc: int}
 * @phpstan-type PoradiSance array{klic: string, popis: string, vzor: ?string, pocetVyher: int, vyseVyhryKc: int}
 * @phpstan-type TahEurojackpot array{
 *     hra: 'eurojackpot',
 *     datum: string,
 *     den: string,
 *     sazkovyTyden: SazkovyTyden,
 *     vsazenoKc: int,
 *     naVyhryKc: ?int,
 *     cisla: list<int>,
 *     eurocisla: list<int>,
 *     extra6: string,
 *     poradi: list<Poradi>,
 *     jackpotKc: ?int
 * }
 * @phpstan-type SportkaTah array{
 *     poradiTahu: int,
 *     cisla: list<int>,
 *     dodatkove: int,
 *     poradi: list<Poradi>,
 *     prevod1PoradiKc: ?int,
 *     jackpot1PoradiKc: ?int,
 *     prevod2PoradiKc: ?int,
 *     jackpot2PoradiKc: ?int
 * }
 * @phpstan-type LosovaniSance array{datum: string, cislice: string, vsazenoKc: int, poradi: list<PoradiSance>}
 * @phpstan-type TahSportka array{
 *     hra: 'sportka',
 *     datum: string,
 *     den: string,
 *     sazkovyTyden: SazkovyTyden,
 *     vsazenoKc: int,
 *     naVyhryKc: ?int,
 *     tahy: array{SportkaTah, SportkaTah},
 *     sance: ?LosovaniSance,
 *     prevodBonusKc: ?int,
 *     superJackpotKc: ?int
 * }
 * @phpstan-type Tah TahEurojackpot|TahSportka
 */
final class Model
{
    /** Verze formátu JSON. Musí sedět s `VERZE_FORMATU` v `packages/jadro/src/model.ts`. */
    public const VERZE_FORMATU = 1;

    /** @var list<string> */
    public const HRY = ['eurojackpot', 'sportka'];

    private function __construct()
    {
    }
}
