<?php

declare(strict_types=1);

namespace KontrolaTiketu\Zdroj;

use KontrolaTiketu\Model;

/**
 * Adaptér veřejné výherní listiny Allwyn.
 *
 * Port `fetcher/src/zdroje/allwyn-vyherka.ts` jedna k jedné — stejné kotvy, stejné kontroly,
 * stejné pořadí klíčů ve výsledku. Když se opravuje jedno, musí se opravit i druhé; že se
 * nerozešly, hlídá bajtová shoda výstupu v `tests/ShodaSFetcheremTest.php`.
 *
 * Podrobný popis zdroje a jeho pastí je v docs/data-source.md.
 *
 * @phpstan-import-type Tah from Model
 * @phpstan-import-type TahEurojackpot from Model
 * @phpstan-import-type TahSportka from Model
 * @phpstan-import-type SportkaTah from Model
 * @phpstan-import-type LosovaniSance from Model
 * @phpstan-import-type Poradi from Model
 * @phpstan-import-type PoradiSance from Model
 * @phpstan-type Sekce array{typ: string, den: string, obsah: string, tyden: int, rok: int}
 */
final class AllwynVyherka
{
    public const ZAKLADNI_URL = 'https://www.allwyn.cz/system/vyherka';

    private const DNY = [
        'PONDĚLÍ' => 'po',
        'ÚTERÝ' => 'ut',
        'STŘEDA' => 'st',
        'ČTVRTEK' => 'ct',
        'PÁTEK' => 'pa',
        'SOBOTA' => 'so',
        'NEDĚLE' => 'ne',
    ];

    private const SANCE_KLICE = [
        'šestičíslí' => 'sestecisli',
        'pětičíslí' => 'peticisli',
        'čtyřčíslí' => 'ctyrcisli',
        'trojčíslí' => 'trojcisli',
        'dvojčíslí' => 'dvojcisli',
        'koncové číslo' => 'koncove-cislo',
        'koncové číslo +/- 1' => 'sousedni-cislo',
    ];

    private const NADPIS_SEKCE =
        '/(SPORTKA|ŠANCE|EUROJACKPOT)[\s\x{00a0}]+(NEDĚLE|PONDĚLÍ|ÚTERÝ|STŘEDA|ČTVRTEK|PÁTEK|SOBOTA)/u';

    /**
     * Listina, u které Allwyn tabulku výher nezveřejnil.
     *
     * Není to chyba ani poškozený soubor — tažená čísla tam jsou, jen místo tabulky stojí tahle
     * věta. U starých tahů to zůstává natrvalo, u čerstvých jen chvíli po losování; backend
     * takový tah proto považuje za neúplný a zeptá se znovu (viz Rozvrh).
     */
    public const BEZ_TABULKY = 'Probíhá zpracování výsledků';

    private const NADPIS_TYDNE = '/(\d+)\. SÁZKOVÝ TÝDEN ROK (\d{4})/u';

    private const PORADI_EJ = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    private const PORADI_SPORTKA = ['bonus', 'I', 'II', 'III', 'IV', 'V'];

    private const KOTVA_2_TAHU = '<!-- vyhry 2 tah. -->';

    private function __construct()
    {
    }

    /** Sestaví adresu listiny. Jeden dotaz vrací všechny tahy daného týdne. */
    public static function sestavUrl(string $hra, int $rok, int $tyden): string
    {
        return self::ZAKLADNI_URL . '?' . http_build_query(['year' => $rok, 'week' => $tyden, 'game' => $hra]);
    }

    /**
     * Listina bez dat. Allwyn na neexistující rok, budoucí týden i neplatnou hru vrací HTTP 200
     * s prázdnou listinou, takže se to nepozná podle stavového kódu.
     */
    public static function jePrazdna(string $html): bool
    {
        return !str_contains(Html::dekodujEntity($html), 'Losování dne');
    }

    /**
     * Přečte celou listinu. Vrací tahy v pořadí, v jakém jsou v dokumentu, tedy chronologicky.
     * Šance se připojí ke slosování Sportky se shodným datem.
     *
     * @return list<Tah>
     */
    public static function parsujListinu(string $html): array
    {
        $sekce = self::najdiSekce($html);

        /** @var array<string, TahSportka> $sportky */
        $sportky = [];
        /** @var list<Tah> $tahy */
        $tahy = [];

        foreach ($sekce as $s) {
            if ($s['typ'] === 'EUROJACKPOT') {
                $tahy[] = self::parsujEurojackpot($s);
            } elseif ($s['typ'] === 'SPORTKA') {
                $tah = self::parsujSportku($s);
                $sportky[$tah['datum']] = $tah;
                $tahy[] = $tah;
            }
        }

        foreach ($sekce as $s) {
            if ($s['typ'] !== 'ŠANCE') {
                continue;
            }
            $sance = self::parsujSanci($s);
            if (!isset($sportky[$sance['datum']])) {
                throw new ChybaParsovani("Šance z {$sance['datum']} nemá odpovídající slosování Sportky.");
            }
            // Přiřazení do existujícího klíče drží jeho pozici — stejně jako `{ ...tah, sance }`.
            $sportky[$sance['datum']]['sance'] = $sance;
        }

        return array_map(
            static fn (array $t): array => $t['hra'] === 'sportka' ? ($sportky[$t['datum']] ?? $t) : $t,
            $tahy,
        );
    }

    /**
     * Rozdělí listinu na sekce a ke každé přiřadí sázkový týden z nejbližší hlavičky před ní.
     *
     * Týden se schválně nebere z parametrů dotazu: u roku 1994 vrací dotaz `week=10` listinu
     * nadepsanou jako 9. sázkový týden.
     *
     * @return list<Sekce>
     */
    private static function najdiSekce(string $html): array
    {
        $text = Html::dekodujEntity($html);

        $hlavicky = array_map(
            static fn (array $m): array => ['pozice' => $m[0][1], 'tyden' => (int) $m[1][0], 'rok' => (int) $m[2][0]],
            Regex::vsechnySPozici(self::NADPIS_TYDNE, $text),
        );

        $nadpisy = Regex::vsechnySPozici(self::NADPIS_SEKCE, $text);

        $sekce = [];
        foreach ($nadpisy as $i => $nadpis) {
            $zacatek = $nadpis[0][1];
            $konec = isset($nadpisy[$i + 1]) ? $nadpisy[$i + 1][0][1] : strlen($text);

            $hlavicka = null;
            foreach ($hlavicky as $h) {
                if ($h['pozice'] < $zacatek) {
                    $hlavicka = $h;
                }
            }
            if ($hlavicka === null) {
                throw new ChybaParsovani("Sekce „{$nadpis[0][0]}“ nemá před sebou hlavičku sázkového týdne.");
            }

            $sekce[] = [
                'typ' => $nadpis[1][0],
                'den' => self::DNY[$nadpis[2][0]] ?? throw new ChybaParsovani("Neznámý den „{$nadpis[2][0]}“."),
                'obsah' => substr($text, $zacatek, $konec - $zacatek),
                'tyden' => $hlavicka['tyden'],
                'rok' => $hlavicka['rok'],
            ];
        }
        return $sekce;
    }

    /**
     * @param non-empty-string $kotva
     * @return list<Poradi>
     */
    private static function radkyTabulky(string $usek, string $kotva, string $kde): array
    {
        $casti = explode($kotva, $usek);
        if (!isset($casti[1])) {
            // Chybějící kotva u listiny bez tabulky není chyba — tabulka prostě není.
            if (str_contains($usek, self::BEZ_TABULKY)) {
                return [];
            }
            throw new ChybaParsovani("{$kde}: v listině chybí kotva {$kotva}.");
        }
        $tabulka = explode('</table>', $casti[1])[0];

        $m = Regex::MEZERA;
        $vzor = "/<td class=\"ac b2\">{$m}*([-IVX]+){$m}*<\\/td>{$m}*<td class=\"ac b2\">{$m}*([^<]+?){$m}*<\\/td>"
            . "{$m}*<td class=\"ar b2\">{$m}*(\\d+){$m}*<\\/td>{$m}*<td class=\"ar b2\">{$m}*([\\d\\s\\x{00a0}]+){$m}*Kč{$m}*<\\/td>/u";

        return array_map(
            static fn (array $r): array => [
                'klic' => $r[1] === '-' ? 'bonus' : $r[1],
                'popis' => $r[2],
                'pocetVyher' => (int) $r[3],
                'vyseVyhryKc' => Html::naCastku($r[4]) ?? 0,
            ],
            Regex::vsechny($vzor, $tabulka),
        );
    }

    /**
     * @param Sekce $sekce
     * @return TahEurojackpot
     */
    private static function parsujEurojackpot(array $sekce): array
    {
        $datum = Html::datumLosovani($sekce['obsah']);
        if ($datum === null) {
            throw new ChybaParsovani('Sekce Eurojackpotu nemá datum losování.');
        }

        $losy = Html::vylosovanaCisla($sekce['obsah']);
        $hlavni = $losy[0] ?? null;
        $extra = $losy[1] ?? null;
        if ($hlavni === null || count($hlavni) !== 7) {
            $nalezeno = $hlavni === null ? 'undefined' : count($hlavni);
            throw new ChybaParsovani("{$datum}: čekáno 5 čísel a 2 euročísla, nalezeno {$nalezeno}.");
        }
        if ($extra === null || count($extra) !== 6) {
            $nalezeno = $extra === null ? 'undefined' : count($extra);
            throw new ChybaParsovani("{$datum}: Extra 6 nemá šest číslic ({$nalezeno}).");
        }

        $poradi = self::radkyTabulky($sekce['obsah'], '<!-- vyhry -->', $datum);
        $klice = array_column($poradi, 'klic');
        $bezTabulky = $poradi === [] && str_contains($sekce['obsah'], self::BEZ_TABULKY);

        // Prázdná tabulka se přijme, jen když to listina sama říká. Jinak by tichá změna
        // šablony vyrobila tahy bez částek a nikdo by si toho nevšiml.
        if (!$bezTabulky && $klice !== self::PORADI_EJ) {
            $nalezeno = implode(',', $klice);
            throw new ChybaParsovani("{$datum}: čekáno 12 pořadí I–XII, nalezeno {$nalezeno}.");
        }

        return [
            'hra' => 'eurojackpot',
            'datum' => $datum,
            'den' => $sekce['den'],
            'sazkovyTyden' => ['rok' => $sekce['rok'], 'tyden' => $sekce['tyden']],
            'vsazenoKc' => Html::castkaZa($sekce['obsah'], 'Vsazeno:') ?? 0,
            'naVyhryKc' => Html::castkaZa($sekce['obsah'], 'Na výhry:'),
            'cisla' => array_map('intval', array_slice($hlavni, 0, 5)),
            'eurocisla' => array_map('intval', array_slice($hlavni, 5)),
            'extra6' => implode('', $extra),
            'poradi' => $poradi,
            'jackpotKc' => Html::castkaZa($sekce['obsah'], 'JACKPOT:'),
        ];
    }

    /**
     * @param non-empty-string $kotva
     * @param list<string> $cisla
     * @return SportkaTah
     */
    private static function parsujTahSportky(string $usek, string $kotva, array $cisla, int $poradiTahu): array
    {
        $poradi = self::radkyTabulky($usek, $kotva, "Sportka, {$poradiTahu}. tah");
        $klice = array_column($poradi, 'klic');
        $bezTabulky = $poradi === [] && str_contains($usek, self::BEZ_TABULKY);

        if (!$bezTabulky && $klice !== self::PORADI_SPORTKA) {
            $nalezeno = implode(',', $klice);
            throw new ChybaParsovani("Sportka, {$poradiTahu}. tah: nečekaná pořadí {$nalezeno}.");
        }
        return [
            'poradiTahu' => $poradiTahu,
            'cisla' => array_map('intval', array_slice($cisla, 0, 6)),
            'dodatkove' => (int) $cisla[6],
            'poradi' => $poradi,
            'prevod1PoradiKc' => Html::castkaZa($usek, 'Převod 1. pořadí:'),
            'jackpot1PoradiKc' => Html::castkaZa($usek, 'JACKPOT 1. pořadí:'),
            'prevod2PoradiKc' => Html::castkaZa($usek, 'Převod 2. pořadí:'),
            'jackpot2PoradiKc' => Html::castkaZa($usek, 'JACKPOT 2. pořadí:'),
        ];
    }

    /**
     * @param Sekce $sekce
     * @return TahSportka
     */
    private static function parsujSportku(array $sekce): array
    {
        $datum = Html::datumLosovani($sekce['obsah']);
        if ($datum === null) {
            throw new ChybaParsovani('Sekce Sportky nemá datum losování.');
        }

        $losy = Html::vylosovanaCisla($sekce['obsah']);
        if (count($losy) !== 2 || count($losy[0]) !== 7 || count($losy[1]) !== 7) {
            throw new ChybaParsovani("{$datum}: čekány dva tahy po 6 číslech a dodatkovém.");
        }

        // Sekce druhého tahu začíná až u své kotvy, jinak by se převody obou tahů pletly.
        $casti = explode(self::KOTVA_2_TAHU, $sekce['obsah']);
        if (count($casti) < 2) {
            throw new ChybaParsovani("{$datum}: v listině chybí tabulka druhého tahu.");
        }
        $prvni = $casti[0];
        $druhy = self::KOTVA_2_TAHU . implode(self::KOTVA_2_TAHU, array_slice($casti, 1));

        return [
            'hra' => 'sportka',
            'datum' => $datum,
            'den' => $sekce['den'],
            'sazkovyTyden' => ['rok' => $sekce['rok'], 'tyden' => $sekce['tyden']],
            'vsazenoKc' => Html::castkaZa($sekce['obsah'], 'Vsazeno:') ?? 0,
            'naVyhryKc' => Html::castkaZa($sekce['obsah'], 'Na výhry:'),
            'tahy' => [
                self::parsujTahSportky($prvni, '<!-- vyhry 1 tah. -->', $losy[0], 1),
                self::parsujTahSportky($druhy, self::KOTVA_2_TAHU, $losy[1], 2),
            ],
            'sance' => null,
            'prevodBonusKc' => Html::castkaZa($druhy, 'Převod Bonus:'),
            'superJackpotKc' => Html::castkaZa($druhy, 'SuperJACKPOT:'),
        ];
    }

    /**
     * @param Sekce $sekce
     * @return LosovaniSance
     */
    private static function parsujSanci(array $sekce): array
    {
        $datum = Html::datumLosovani($sekce['obsah']);
        if ($datum === null) {
            throw new ChybaParsovani('Sekce Šance nemá datum losování.');
        }

        $losy = Html::vylosovanaCisla($sekce['obsah']);
        if (!isset($losy[0]) || count($losy[0]) !== 6) {
            throw new ChybaParsovani("{$datum}: Šance nemá šest vylosovaných číslic.");
        }

        $zaKotvou = explode('<!-- vyhry sance -->', $sekce['obsah'])[1] ?? null;
        $tabulka = $zaKotvou === null ? '' : explode('</table>', $zaKotvou)[0];

        $m = Regex::MEZERA;
        $vzor = "/<span class=\"spn vsazenol\">{$m}*([^<]+?){$m}*<\\/span>{$m}*"
            . "(?:<span class=\"spn vsazenor\">{$m}*(\\d*){$m}*<\\/span>)?{$m}*<\\/td>{$m}*"
            . "<td class=\"ar b2\">{$m}*(\\d+){$m}*<\\/td>{$m}*<td class=\"ar b2\">{$m}*([\\d\\s\\x{00a0}]+){$m}*Kč{$m}*<\\/td>/u";

        $poradi = [];
        foreach (Regex::vsechny($vzor, $tabulka) as $r) {
            $popis = $r[1];
            $klic = self::SANCE_KLICE[$popis] ?? null;
            if ($klic === null) {
                throw new ChybaParsovani("{$datum}: neznámé pořadí Šance „{$popis}“.");
            }
            $poradi[] = [
                'klic' => $klic,
                'popis' => $popis,
                // Nezúčastněná skupina je v PHP prázdný řetězec, v JS undefined — obojí je „bez vzoru“.
                'vzor' => ($r[2] ?? '') === '' ? null : $r[2],
                'pocetVyher' => (int) $r[3],
                'vyseVyhryKc' => Html::naCastku($r[4]) ?? 0,
            ];
        }

        // Sedmé pořadí přibylo až později; starší listiny jich mají jen šest.
        if (count($poradi) < 6 || count($poradi) > 7) {
            $pocet = count($poradi);
            throw new ChybaParsovani("{$datum}: Šance má {$pocet} pořadí, čekáno 6 nebo 7.");
        }

        return [
            'datum' => $datum,
            'cislice' => implode('', $losy[0]),
            'vsazenoKc' => Html::castkaZa($sekce['obsah'], 'Vsazeno:') ?? 0,
            'poradi' => $poradi,
        ];
    }
}
