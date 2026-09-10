<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Práce se sázkovými týdny. Číslo týdne odpovídá ISO týdnu (viz docs/data-source.md).
 *
 * Port `fetcher/src/obdobi.ts`, navíc s převodem data na sázkový týden, který potřebuje rozvrh.
 *
 * @phpstan-type Tyden array{rok: int, tyden: int}
 */
final class Obdobi
{
    private function __construct()
    {
    }

    /** ISO rok má 53 týdnů, pokud na čtvrtek připadá 1. leden, nebo u přestupného roku 31. prosinec. */
    public static function tydnuVRoce(int $rok): int
    {
        $prvniLeden = (int) (new \DateTimeImmutable("{$rok}-01-01", new \DateTimeZone('UTC')))->format('N') - 1; // 0 = pondělí
        $prestupny = ($rok % 4 === 0 && $rok % 100 !== 0) || $rok % 400 === 0;
        return $prvniLeden === 3 || ($prestupny && $prvniLeden === 2) ? 53 : 52;
    }

    /**
     * Přečte zápis `RRRR-TT`.
     *
     * @return Tyden
     */
    public static function parsujTyden(string $zapis): array
    {
        if (preg_match('/^(\d{4})-(\d{1,2})$/', trim($zapis), $nalez) !== 1) {
            throw new ChybaObdobi("„{$zapis}“ není týden ve tvaru RRRR-TT, například 2026-36.");
        }
        $rok = (int) $nalez[1];
        $tyden = (int) $nalez[2];
        $pocet = self::tydnuVRoce($rok);
        if ($tyden < 1 || $tyden > $pocet) {
            throw new ChybaObdobi("Rok {$rok} má {$pocet} týdnů, ale zadán je {$tyden}.");
        }
        return ['rok' => $rok, 'tyden' => $tyden];
    }

    /** @param Tyden $tyden */
    public static function formatujTyden(array $tyden): string
    {
        return sprintf('%d-%02d', $tyden['rok'], $tyden['tyden']);
    }

    /**
     * Vyjmenuje všechny týdny od `od` do `do` včetně, přes hranice roků.
     *
     * @param Tyden $od
     * @param Tyden $doTydne
     * @return list<Tyden>
     */
    public static function tydnyOdDo(array $od, array $doTydne): array
    {
        if (self::klic($od) > self::klic($doTydne)) {
            throw new ChybaObdobi(sprintf(
                'Období končí dřív, než začíná: %s až %s.',
                self::formatujTyden($od),
                self::formatujTyden($doTydne),
            ));
        }

        $tydny = [];
        ['rok' => $rok, 'tyden' => $tyden] = $od;
        while (self::klic(['rok' => $rok, 'tyden' => $tyden]) <= self::klic($doTydne)) {
            $tydny[] = ['rok' => $rok, 'tyden' => $tyden];
            $tyden += 1;
            if ($tyden > self::tydnuVRoce($rok)) {
                $rok += 1;
                $tyden = 1;
            }
        }
        return $tydny;
    }

    /**
     * Sázkový týden, do kterého datum patří. Od roku 1998 je to ISO týden.
     *
     * @return Tyden
     */
    public static function tydenData(\DateTimeImmutable $datum): array
    {
        return ['rok' => (int) $datum->format('o'), 'tyden' => (int) $datum->format('W')];
    }

    /**
     * Pořadové číslo týdne pro porovnávání rozsahů.
     *
     * @param Tyden $tyden
     */
    public static function klic(array $tyden): int
    {
        return $tyden['rok'] * 100 + $tyden['tyden'];
    }
}
