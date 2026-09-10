<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Výroba souborů, které servíruje web jako `/v1/` — tohle je celé REST API.
 *
 * - `manifest.json`: seznam balíků s hashi a stav poslední kontroly.
 * - `RRRR.json`: tahy jednoho kalendářního roku, přesně ve formátu souboru od fetcheru.
 *
 * Klient stahuje vždy **všechny** balíky z manifestu, jen ty nezměněné přeskočí podle hashe.
 * Dotaz je tak pro všechny uživatele stejný a nenese žádnou informaci o tom, jaké kdo drží
 * tikety — to je tvrdá podmínka ze zadání pro variantu se síťovým oprávněním.
 *
 * Balík musí být **deterministický**: `vygenerovano` v něm je čas poslední změny dat daného
 * roku, ne čas publikace. Jinak by se hash všech let měnil s každým během a aplikace by
 * pokaždé stahovala všechno.
 *
 * @phpstan-import-type Tah from Model
 * @phpstan-type PolozkaManifestu array{soubor: string, hash: string, od: string, do: string, tahu: int}
 */
final class Publikace
{
    public const MANIFEST = 'manifest.json';
    public const VERZE_MANIFESTU = 1;

    private function __construct()
    {
    }

    /**
     * Zapíše změněné balíky a nový manifest. Manifest jde až poslední, takže nikdy neodkazuje
     * na balík, který ještě neleží na disku.
     *
     * @return list<PolozkaManifestu>
     */
    public static function publikuj(Databaze $db, Konfigurace $k, \DateTimeImmutable $ted): array
    {
        $sazby = Vystup::nactiSazby($k->sazby);

        /** @var array<string, array{tahy: list<Tah>, zmeneno: string}> $roky */
        $roky = [];
        foreach ($db->tahyOdRoku($k->odRoku) as ['tah' => $tah, 'zmeneno' => $zmeneno]) {
            $rok = substr($tah['datum'], 0, 4);
            $roky[$rok]['tahy'][] = $tah;
            $roky[$rok]['zmeneno'] = max($roky[$rok]['zmeneno'] ?? '', $zmeneno);
        }

        $baliky = [];
        foreach ($roky as $rok => ['tahy' => $tahy, 'zmeneno' => $zmeneno]) {
            $prvni = $tahy[0];
            $posledni = $tahy[count($tahy) - 1];
            $text = Json::zapis(Vystup::sestav(
                $tahy,
                $sazby,
                ['od' => $prvni['sazkovyTyden'], 'do' => $posledni['sazkovyTyden']],
                new \DateTimeImmutable($zmeneno),
            ));
            $soubor = "{$rok}.json";
            $hash = 'sha256:' . hash('sha256', $text);
            $cesta = "{$k->verejne}/{$soubor}";
            if (!is_file($cesta) || 'sha256:' . hash_file('sha256', $cesta) !== $hash) {
                Soubory::zapisAtomicky($cesta, $text);
            }
            $baliky[] = [
                'soubor' => $soubor,
                'hash' => $hash,
                'od' => $prvni['datum'],
                'do' => $posledni['datum'],
                'tahu' => count($tahy),
            ];
        }

        self::zapisManifest($db, $k, $ted, $baliky);
        self::uklid($k, $baliky);
        return $baliky;
    }

    /** @param list<PolozkaManifestu> $baliky */
    private static function zapisManifest(Databaze $db, Konfigurace $k, \DateTimeImmutable $ted, array $baliky): void
    {
        $kontrola = ['posledniDotaz' => ($cas = $db->posledniDotaz()) === null ? null : Vystup::isoCas($cas)];
        foreach ($db->posledniTahy() as $hra => ['datum' => $datum, 'uplny' => $uplny]) {
            $kontrola[$hra] = ['posledniTah' => $datum, 'uplny' => $uplny];
        }

        Soubory::zapisAtomicky("{$k->verejne}/" . self::MANIFEST, Json::zapis([
            'verzeManifestu' => self::VERZE_MANIFESTU,
            'verzeFormatu' => Model::VERZE_FORMATU,
            'vygenerovano' => Vystup::isoCas($ted),
            'kontrola' => $kontrola,
            'baliky' => $baliky,
        ]));
    }

    /**
     * Smaže balíky, které už manifest nezná (třeba po zvýšení `odRoku`). Až po zápisu manifestu,
     * aby na ně žádný platný manifest neodkazoval.
     *
     * @param list<PolozkaManifestu> $baliky
     */
    private static function uklid(Konfigurace $k, array $baliky): void
    {
        $platne = array_column($baliky, 'soubor');
        foreach (glob("{$k->verejne}/*.json") ?: [] as $cesta) {
            $jmeno = basename($cesta);
            if ($jmeno !== self::MANIFEST && !in_array($jmeno, $platne, true)) {
                unlink($cesta);
            }
        }
    }
}
