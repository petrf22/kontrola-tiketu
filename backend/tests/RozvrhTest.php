<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Rozvrh;
use PHPUnit\Framework\TestCase;

/**
 * Rozvrh na skutečném kalendáři září 2026: týden 37 je 7.–13. 9., Eurojackpot se losuje
 * v úterý 8. a v pátek 11., Sportka ve středu 9., v pátek 11. a v neděli 13.
 *
 * Výchozí stav každého testu je „všechno hotové“: tahy z posledních dní jsou úplné a minulé
 * týdny uzavřené. Každý test pak rozbije jen to, co zkoumá — jinak by se mezi úkoly míchalo
 * dohánění, které s tématem testu nesouvisí.
 */
final class RozvrhTest extends TestCase
{
    private static function konfigurace(): Konfigurace
    {
        return Konfigurace::nacti();
    }

    private static function cas(string $mistni): \DateTimeImmutable
    {
        return new \DateTimeImmutable($mistni, new \DateTimeZone('Europe/Prague'));
    }

    /**
     * Všechna plánovaná losování od srpna do konce září jako úplná.
     *
     * @return array<string, bool>
     */
    private static function hotoveTahy(): array
    {
        $tahy = [];
        $den = self::cas('2026-08-01');
        while ($den < self::cas('2026-10-01')) {
            $dvt = (int) $den->format('N');
            if ($dvt === 2 || $dvt === 5) {
                $tahy['eurojackpot|' . $den->format('Y-m-d')] = true;
            }
            if ($dvt === 3 || $dvt === 5 || $dvt === 7) {
                $tahy['sportka|' . $den->format('Y-m-d')] = true;
            }
            $den = $den->modify('+1 day');
        }
        return $tahy;
    }

    /**
     * Týdny uzavřené hned po svém konci.
     *
     * @return array<string, \DateTimeImmutable>
     */
    private static function uzavreneTydny(): array
    {
        $stazeno = [];
        foreach (range(30, 36) as $tyden) {
            $pondeli = (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Prague')))
                ->setISODate(2026, $tyden + 1)->setTime(11, 0);
            foreach (['eurojackpot', 'sportka'] as $hra) {
                $stazeno["{$hra}|2026|{$tyden}"] = $pondeli;
            }
        }
        return $stazeno;
    }

    /**
     * @param array<string, bool> $tahy
     * @param array<string, \DateTimeImmutable> $stazeno
     * @return list<string> Úkoly jako `hra týden: důvod`, ať se v chybě čtou.
     */
    private static function ukoly(string $ted, array $tahy, array $stazeno = [], int $neuspechu = 0): array
    {
        return array_map(
            static fn (array $u): string => sprintf('%s %d-%02d: %s', $u['hra'], $u['rok'], $u['tyden'], $u['duvod']),
            Rozvrh::coStahnout(self::cas($ted), $tahy, $stazeno + self::uzavreneTydny(), $neuspechu, self::konfigurace()),
        );
    }

    /** @return array<string, bool> */
    private static function bez(string ...$klice): array
    {
        return array_diff_key(self::hotoveTahy(), array_flip($klice));
    }

    public function testKdyzJeVsechnoHotoveNeptaSeNicemu(): void
    {
        self::assertSame([], self::ukoly('2026-09-08 22:05', self::hotoveTahy()));
        self::assertSame([], self::ukoly('2026-09-10 15:00', self::hotoveTahy()));
    }

    public function testVDenLosovaniPredPrvnimDotazemCeka(): void
    {
        self::assertSame([], self::ukoly('2026-09-08 21:30', self::bez('eurojackpot|2026-09-08')));
    }

    public function testVOkneSePtaNaTydenLosovani(): void
    {
        self::assertSame(
            ['eurojackpot 2026-37: losování 2026-09-08'],
            self::ukoly('2026-09-08 22:05', self::bez('eurojackpot|2026-09-08')),
        );
    }

    public function testNeuplnyTahProbihaZpracovaniSeOpakuje(): void
    {
        $tahy = self::hotoveTahy();
        $tahy['eurojackpot|2026-09-08'] = false;
        self::assertSame(['eurojackpot 2026-37: losování 2026-09-08'], self::ukoly('2026-09-08 23:05', $tahy));
    }

    public function testKazdouHodinuNeCasteji(): void
    {
        $stazeno = ['eurojackpot|2026|37' => self::cas('2026-09-08 22:05')];
        $tahy = self::bez('eurojackpot|2026-09-08');

        // Cron pouštěný po pěti minutách nesmí vést k dotazu po pěti minutách.
        self::assertSame([], self::ukoly('2026-09-08 22:30', $tahy, $stazeno));
        self::assertSame(['eurojackpot 2026-37: losování 2026-09-08'], self::ukoly('2026-09-08 23:05', $tahy, $stazeno));
    }

    public function testPoOkneCekaNaDenniDohaneniAToJenJednou(): void
    {
        $tahy = self::bez('eurojackpot|2026-09-08');

        self::assertSame([], self::ukoly('2026-09-09 03:05', $tahy, ['eurojackpot|2026|37' => self::cas('2026-09-09 01:05')]));
        self::assertSame(
            ['eurojackpot 2026-37: dohánění 2026-09-08'],
            self::ukoly('2026-09-09 10:05', $tahy, ['eurojackpot|2026|37' => self::cas('2026-09-09 01:05')]),
        );
        self::assertSame([], self::ukoly('2026-09-09 16:05', $tahy, ['eurojackpot|2026|37' => self::cas('2026-09-09 10:05')]));
    }

    public function testDohaneniKonciPoSedmiDnech(): void
    {
        // Losování, které se nekonalo, nesmí vést k dotazům navždy.
        $tahy = self::bez('eurojackpot|2026-09-08');
        self::assertSame([], self::ukoly('2026-09-16 10:05', $tahy, self::uzavreno37()));
    }

    public function testVPondeliSeJednouUzavreMinulyTyden(): void
    {
        // Tak se chytí losování mimo rozvrh — v archivu je Sportka v úterý — i opravené listiny.
        $stazeno = ['eurojackpot|2026|37' => self::cas('2026-09-11 23:05'), 'sportka|2026|37' => self::cas('2026-09-13 22:05')];

        self::assertSame([], self::ukoly('2026-09-14 09:05', self::hotoveTahy(), $stazeno));
        self::assertSame(
            ['eurojackpot 2026-37: uzavření týdne 2026-37', 'sportka 2026-37: uzavření týdne 2026-37'],
            self::ukoly('2026-09-14 10:05', self::hotoveTahy(), $stazeno),
        );
        self::assertSame([], self::ukoly('2026-09-14 11:05', self::hotoveTahy(), self::uzavreno37()));
    }

    public function testPoVypadkuUzavreIStarsiTydny(): void
    {
        $stazeno = self::uzavreneTydny();
        unset($stazeno['sportka|2026|35'], $stazeno['sportka|2026|36']);
        $ukoly = Rozvrh::coStahnout(self::cas('2026-09-14 10:05'), self::hotoveTahy(), $stazeno + self::uzavreno37(), 0, self::konfigurace());
        self::assertSame(
            ['sportka|2026|36', 'sportka|2026|35'],
            array_map(static fn (array $u): string => "{$u['hra']}|{$u['rok']}|{$u['tyden']}", $ukoly),
        );
    }

    public function testJedenDotazNaTydenIKdyzChybiVicTahu(): void
    {
        // Pátek 11. 9.: Sportka ze středy chybí, páteční teprve přijde — obojí je týden 37.
        $tahy = self::bez('sportka|2026-09-09', 'sportka|2026-09-11', 'eurojackpot|2026-09-11');
        self::assertSame(
            ['eurojackpot 2026-37: losování 2026-09-11', 'sportka 2026-37: losování 2026-09-11'],
            self::ukoly('2026-09-11 22:05', $tahy, ['sportka|2026|37' => self::cas('2026-09-11 10:05')]),
        );
    }

    public function testPoOpakovanychChybachZkousiJenJednouDenne(): void
    {
        // Místo každé hodiny v okně jen jeden pokus za den — ten večer a pak zase ráno.
        $tahy = self::bez('eurojackpot|2026-09-08');
        self::assertSame(['eurojackpot 2026-37: dohánění 2026-09-08'], self::ukoly('2026-09-08 22:05', $tahy, [], 3));
        $stazeno = ['eurojackpot|2026|37' => self::cas('2026-09-08 22:05')];
        self::assertSame([], self::ukoly('2026-09-08 23:05', $tahy, $stazeno, 3));
        self::assertSame([], self::ukoly('2026-09-09 03:05', $tahy, $stazeno, 3));
        self::assertSame(['eurojackpot 2026-37: dohánění 2026-09-08'], self::ukoly('2026-09-09 10:05', $tahy, $stazeno, 3));
    }

    public function testCasJeVzdyPrazskyIKdyzCronBeziVUtc(): void
    {
        // 25. 10. 2026 končí letní čas. 19:30 UTC je 20:30 v Praze — před prvním dotazem Sportky
        // ve 21:00. Kdyby se počítalo s letním posunem, vyšlo by 21:30 a rozvrh by se zeptal.
        $utc = new \DateTimeZone('UTC');
        $tahy = [
            'sportka|2026-10-18' => true, 'sportka|2026-10-21' => true, 'sportka|2026-10-23' => true, 'sportka|2026-10-25' => false,
            'eurojackpot|2026-10-20' => true, 'eurojackpot|2026-10-23' => true,
        ];
        $stazeno = [];
        foreach (range(39, 42) as $t) {
            foreach (['eurojackpot', 'sportka'] as $hra) {
                $stazeno["{$hra}|2026|{$t}"] = new \DateTimeImmutable('2026-10-19 12:00', $utc);
            }
        }
        $ukoly = static fn (string $ted): array => array_column(
            Rozvrh::coStahnout(new \DateTimeImmutable($ted, $utc), $tahy, $stazeno, 0, self::konfigurace()),
            'duvod',
        );

        self::assertSame([], $ukoly('2026-10-25 19:30'));
        self::assertSame(['losování 2026-10-25'], $ukoly('2026-10-25 20:05'));
    }

    /** @return array<string, \DateTimeImmutable> */
    private static function uzavreno37(): array
    {
        return [
            'eurojackpot|2026|37' => self::cas('2026-09-14 10:05'),
            'sportka|2026|37' => self::cas('2026-09-14 10:05'),
        ];
    }
}
