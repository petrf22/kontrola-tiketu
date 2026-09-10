<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Kdy a na co se zeptat Allwynu. Čistá funkce: nečte hodiny, databázi ani síť.
 *
 * Cílem je ptát se jen tehdy, když to dává smysl — v den losování chvíli po něm, a jen dokud
 * výsledek není. V den bez losování a po načtení výsledků vyjde prázdný seznam, takže běh
 * z cronu neudělá jediný dotaz.
 *
 * Pravidla:
 *
 * 1. **Okno po losování.** V plánovaný den losování od `prvniDotaz` po dobu `oknoHodin` se týden
 *    stahuje každou hodinu, dokud tah není v databázi úplný (i s tabulkou výher).
 * 2. **Denní dohánění.** Plánovaný tah z posledních sedmi dní, který pořád není úplný, se
 *    zkusí jednou denně od `denniDohaneni`. Chytá opožděné tabulky i výpadek serveru.
 * 3. **Uzavření týdne.** Každý z posledních čtyř dokončených týdnů se jednou stáhne po svém
 *    konci (v pondělí od `denniDohaneni`). Tím se chytí losování mimo rozvrh — archiv jedno
 *    takové obsahuje, Sportku v úterý — i opravené listiny. Pak je týden uzavřený a z webu se
 *    už nestahuje (pravidlo z docs/data-source.md).
 * 4. **Pojistky.** Týden se znovu stáhne nejdřív za {@see self::ODSTUP_MINUT} minut, ať cron
 *    pouštěný častěji než po hodině nevede k častějším dotazům. Po třech neúspěšných bězích
 *    v řadě se hodinové okno vynechává, aby rozbitý parser nebo výpadek Allwynu nevedl
 *    k bušení každou hodinu.
 *
 * Jeden dotaz vrací celý týden jedné hry, proto se úkoly slučují podle (hra, rok, týden).
 * Pořadí úkolů odpovídá důležitosti — když volající kvůli pojistce udělá jen část, udělá tu
 * podstatnou.
 *
 * @phpstan-type Ukol array{hra: string, rok: int, tyden: int, duvod: string}
 */
final class Rozvrh
{
    public const ODSTUP_MINUT = 55;
    public const DNU_ZPETNE = 7;
    public const UZAVIRANYCH_TYDNU = 4;
    public const NEUSPECHU_DO_UTLUMU = 3;

    private const DNY = ['po', 'ut', 'st', 'ct', 'pa', 'so', 'ne'];

    private function __construct()
    {
    }

    /**
     * @param \DateTimeImmutable $ted Aktuální čas; převede se do Europe/Prague.
     * @param array<string, bool> $tahy Úplnost tahů z databáze: `hra|RRRR-MM-DD` → úplný?
     * @param array<string, \DateTimeImmutable> $stazeno Kdy se listina naposledy stáhla: `hra|rok|týden` → čas.
     * @param int $neuspesnychVRade Kolik posledních běhů s dotazy skončilo chybou.
     * @return list<Ukol>
     */
    public static function coStahnout(
        \DateTimeImmutable $ted,
        array $tahy,
        array $stazeno,
        int $neuspesnychVRade,
        Konfigurace $konfigurace,
    ): array {
        $zona = new \DateTimeZone('Europe/Prague');
        $ted = $ted->setTimezone($zona);
        $dnes = $ted->setTime(0, 0);
        $dohaneniDnes = self::vCase($dnes, $konfigurace->denniDohaneni);

        $ukoly = [];
        $pridej = static function (string $hra, int $rok, int $tyden, string $duvod) use (&$ukoly, $stazeno, $ted): void {
            $klic = "{$hra}|{$rok}|{$tyden}";
            if (isset($ukoly[$klic])) {
                return;
            }
            $naposledy = $stazeno[$klic] ?? null;
            if ($naposledy !== null && $naposledy > $ted->modify('-' . self::ODSTUP_MINUT . ' minutes')) {
                return;
            }
            $ukoly[$klic] = ['hra' => $hra, 'rok' => $rok, 'tyden' => $tyden, 'duvod' => $duvod];
        };
        $stazenoOd = static function (string $hra, int $rok, int $tyden, \DateTimeImmutable $od) use ($stazeno): bool {
            $naposledy = $stazeno["{$hra}|{$rok}|{$tyden}"] ?? null;
            return $naposledy !== null && $naposledy >= $od;
        };

        foreach ($konfigurace->rozvrh as $hra => $nastaveni) {
            for ($zpet = self::DNU_ZPETNE; $zpet >= 0; $zpet--) {
                $den = $dnes->modify("-{$zpet} days");
                if (!in_array(self::DNY[(int) $den->format('N') - 1], $nastaveni['dny'], true)) {
                    continue;
                }
                $datum = $den->format('Y-m-d');
                if (($tahy["{$hra}|{$datum}"] ?? false) === true) {
                    continue;
                }
                $prvniDotaz = self::vCase($den, $nastaveni['prvniDotaz']);
                if ($ted < $prvniDotaz) {
                    continue;
                }
                $tyden = Obdobi::tydenData($den);

                // 1. Okno po losování.
                $konecOkna = $prvniDotaz->modify("+{$nastaveni['oknoHodin']} hours");
                if ($ted < $konecOkna && $neuspesnychVRade < self::NEUSPECHU_DO_UTLUMU) {
                    $pridej($hra, $tyden['rok'], $tyden['tyden'], "losování {$datum}");
                    continue;
                }

                // 2. Denní dohánění — jednou denně, jen dokud je tah čerstvý.
                if ($ted >= $dohaneniDnes && !$stazenoOd($hra, $tyden['rok'], $tyden['tyden'], $dohaneniDnes)) {
                    $pridej($hra, $tyden['rok'], $tyden['tyden'], "dohánění {$datum}");
                }
            }
        }

        // 3. Uzavření dokončených týdnů.
        $pondeli = $dnes->modify('-' . ((int) $dnes->format('N') - 1) . ' days');
        foreach (array_keys($konfigurace->rozvrh) as $hra) {
            for ($i = 1; $i <= self::UZAVIRANYCH_TYDNU; $i++) {
                $konecTydne = $pondeli->modify('-' . (7 * ($i - 1)) . ' days');
                $uzavreni = self::vCase($konecTydne, $konfigurace->denniDohaneni);
                if ($ted < $uzavreni) {
                    continue;
                }
                $tyden = Obdobi::tydenData($konecTydne->modify('-1 day'));
                if (!$stazenoOd($hra, $tyden['rok'], $tyden['tyden'], $uzavreni)) {
                    $pridej($hra, $tyden['rok'], $tyden['tyden'], 'uzavření týdne ' . Obdobi::formatujTyden($tyden));
                }
            }
        }

        return array_values($ukoly);
    }

    private static function vCase(\DateTimeImmutable $den, string $cas): \DateTimeImmutable
    {
        if (preg_match('/^(\d{1,2}):(\d{2})$/', $cas, $m) !== 1) {
            throw new \InvalidArgumentException("Čas „{$cas}“ není ve tvaru HH:MM.");
        }
        return $den->setTime((int) $m[1], (int) $m[2]);
    }
}
