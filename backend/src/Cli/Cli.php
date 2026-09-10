<?php

declare(strict_types=1);

namespace KontrolaTiketu\Cli;

use KontrolaTiketu\Archiv;
use KontrolaTiketu\ChybaObdobi;
use KontrolaTiketu\Databaze;
use KontrolaTiketu\Json;
use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Model;
use KontrolaTiketu\Obdobi;
use KontrolaTiketu\Preparsovani;
use KontrolaTiketu\Publikace;
use KontrolaTiketu\Sit\Klient;
use KontrolaTiketu\Sit\Sit;
use KontrolaTiketu\Sit\SitHttp;
use KontrolaTiketu\Sit\ZakazanoRobots;
use KontrolaTiketu\Soubory;
use KontrolaTiketu\Tik;
use KontrolaTiketu\Vystup;
use KontrolaTiketu\Zdroj\AllwynVyherka;

/**
 * Příkazová řádka backendu. Spouští ji cron i člověk při nasazení.
 *
 * Návratové kódy jsou stejné jako u fetcheru: 0 v pořádku, 1 chyba, 2 špatné argumenty,
 * 3 zákaz v robots.txt.
 *
 * @phpstan-import-type Tyden from Obdobi
 */
final class Cli
{
    public const NAPOVEDA = <<<'TXT'
        Hlídání nových losování Allwyn a publikace výsledků pro aplikaci.

          vyherka tik                     jeden běh z cronu: rozvrh → stažení → publikace
          vyherka plan [--ted "RRRR-MM-DD HH:MM"]
                                          co by tik stáhl, bez sítě a bez zápisu
          vyherka obnov                   databáze z archivu, bez sítě (po nasazení)
          vyherka publikuj                znovu vyrobí soubory v public/v1
          vyherka stahni --od 2026-01 --do 2026-37 [--hra sportka] [--archiv CESTA]
          vyherka preparsuj --out vysledky.json [--od RRRR-TT] [--do RRRR-TT]
                            [--hra sportka] [--archiv CESTA] [--sazby CESTA]
          vyherka stav [--archiv CESTA]

        Týden se zadává jako RRRR-TT. Bez --hra se pracuje s oběma hrami.
        Týden, který už v archivu je, stahni znovu nestahuje.
        Výchozí cesty jsou v config/konfigurace.php.
        TXT;

    /** @var \Closure(string): void */
    private readonly \Closure $vystup;
    /** @var \Closure(string): void */
    private readonly \Closure $hlaseni;

    /**
     * @param \Closure(string): void|null $vystup Standardní výstup.
     * @param \Closure(string): void|null $hlaseni Chybový výstup — průběh a hlášky.
     */
    public function __construct(
        private readonly Konfigurace $konfigurace,
        ?\Closure $vystup = null,
        ?\Closure $hlaseni = null,
        private readonly Sit $sit = new SitHttp(),
        private readonly int $prodlevaMs = Klient::PRODLEVA_MS,
        private readonly ?\DateTimeImmutable $ted = null,
    ) {
        $this->vystup = $vystup ?? static function (string $radek): void {
            fwrite(STDOUT, $radek . "\n");
        };
        $this->hlaseni = $hlaseni ?? static function (string $radek): void {
            fwrite(STDERR, $radek . "\n");
        };
    }

    /** @param list<string> $argv Argumenty bez jména skriptu. */
    public function hlavni(array $argv): int
    {
        try {
            $a = Argumenty::rozeber($argv, ['od', 'do', 'hra', 'archiv', 'out', 'sazby', 'ted']);
            return match ($a->prikaz) {
                'tik' => $this->tik(),
                'plan' => $this->plan($a),
                'obnov' => $this->obnov(),
                'publikuj' => $this->publikuj(),
                'stahni' => $this->stahni($a),
                'preparsuj' => $this->preparsuj($a),
                'stav' => $this->stav($a),
                default => throw new ChybaArgumentu("Neznámý příkaz „{$a->prikaz}“."),
            };
        } catch (ChybaArgumentu | ChybaObdobi $chyba) {
            ($this->hlaseni)($chyba->getMessage() . "\n\n" . self::NAPOVEDA);
            return 2;
        } catch (ZakazanoRobots $chyba) {
            ($this->hlaseni)($chyba->getMessage());
            return 3;
        } catch (\Throwable $chyba) {
            ($this->hlaseni)($chyba->getMessage());
            return 1;
        }
    }

    private function tik(): int
    {
        return $this->seZamkem(fn (): int => $this->behy()->spust($this->ted()));
    }

    private function plan(Argumenty $a): int
    {
        $zapis = $a->volba('ted');
        $ted = $zapis === null ? $this->ted() : new \DateTimeImmutable($zapis, new \DateTimeZone('Europe/Prague'));
        $ukoly = $this->behy()->plan($ted);
        if ($ukoly === []) {
            ($this->vystup)('Rozvrh v ' . $ted->format('Y-m-d H:i') . ' nic nečeká.');
        }
        foreach ($ukoly as $u) {
            ($this->vystup)(sprintf('%s %d-%02d  (%s)', $u['hra'], $u['rok'], $u['tyden'], $u['duvod']));
        }
        return 0;
    }

    private function obnov(): int
    {
        return $this->seZamkem(function (): int {
            $vysledek = $this->behy()->obnov($this->ted());
            $this->ohlasNepovedene($vysledek['nepovedene']);
            $baliky = Publikace::publikuj($this->db(), $this->konfigurace, $this->ted());
            ($this->hlaseni)(sprintf(
                'Z archivu %d listin: %d nových nebo změněných tahů. Publikováno %d balíků do %s.',
                $vysledek['listin'],
                $vysledek['tahu'],
                count($baliky),
                $this->konfigurace->verejne,
            ));
            return 0;
        });
    }

    private function publikuj(): int
    {
        return $this->seZamkem(function (): int {
            $baliky = Publikace::publikuj($this->db(), $this->konfigurace, $this->ted());
            ($this->hlaseni)('Publikováno ' . count($baliky) . " balíků do {$this->konfigurace->verejne}.");
            return 0;
        });
    }

    /**
     * Běhy se nesmí překrývat. Cron na sdíleném hostingu umí spustit další běh dřív, než
     * doběhne předchozí (pomalá síť, prodlevy mezi dotazy), a dva souběžné by se ptaly dvakrát.
     *
     * @param \Closure(): int $prace
     */
    private function seZamkem(\Closure $prace): int
    {
        $cesta = dirname($this->konfigurace->databaze) . '/tik.lock';
        if (!is_dir(dirname($cesta))) {
            mkdir(dirname($cesta), 0o775, true);
        }
        $zamek = fopen($cesta, 'c');
        if ($zamek === false) {
            throw new \RuntimeException("Zámek {$cesta} nejde otevřít.");
        }
        try {
            if (!flock($zamek, LOCK_EX | LOCK_NB)) {
                ($this->hlaseni)('Předchozí běh ještě neskončil, tenhle se vynechává.');
                return 0;
            }
            return $prace();
        } finally {
            flock($zamek, LOCK_UN);
            fclose($zamek);
        }
    }

    private ?Databaze $databaze = null;

    private function db(): Databaze
    {
        return $this->databaze ??= Databaze::otevri($this->konfigurace->databaze);
    }

    private function behy(): Tik
    {
        return new Tik(
            $this->konfigurace,
            $this->db(),
            new Archiv($this->konfigurace->archiv),
            $this->sit,
            $this->prodlevaMs,
            $this->hlaseni,
        );
    }

    private function ted(): \DateTimeImmutable
    {
        return $this->ted ?? new \DateTimeImmutable('now', new \DateTimeZone('Europe/Prague'));
    }

    /**
     * Ruční stažení období do archivu — při prvním naplnění nebo po výpadku. Běžný provoz
     * obstarává `tik` z cronu.
     */
    private function stahni(Argumenty $a): int
    {
        $od = self::tyden($a->volba('od'));
        $doTydne = self::tyden($a->volba('do'));
        if ($od === null || $doTydne === null) {
            throw new ChybaArgumentu('Příkaz stahni potřebuje --od a --do.');
        }
        $tydny = Obdobi::tydnyOdDo($od, $doTydne);
        $archiv = $this->archiv($a);
        $klient = new Klient($this->sit, $this->prodlevaMs);

        ($this->hlaseni)('Ověřuji robots.txt na ' . AllwynVyherka::ZAKLADNI_URL . '…');
        $klient->nactiRobots(AllwynVyherka::ZAKLADNI_URL);

        $stazeno = 0;
        $preskoceno = 0;
        $prazdnych = 0;
        foreach ($this->hry($a) as $hra) {
            foreach ($tydny as $tyden) {
                $souradnice = ['hra' => $hra, 'rok' => $tyden['rok'], 'tyden' => $tyden['tyden']];
                if ($archiv->obsahuje($souradnice)) {
                    $preskoceno += 1;
                    continue;
                }
                $html = $klient->stahni(AllwynVyherka::sestavUrl($hra, $tyden['rok'], $tyden['tyden']));
                $archiv->uloz($souradnice, $html);
                $stazeno += 1;
                if (AllwynVyherka::jePrazdna($html)) {
                    $prazdnych += 1;
                } else {
                    ($this->hlaseni)("  {$hra} " . Obdobi::formatujTyden($tyden));
                }
            }
        }

        ($this->hlaseni)(
            "Hotovo: {$stazeno} staženo (z toho {$prazdnych} prázdných), {$preskoceno} už bylo v archivu. "
            . "Dotazů celkem: {$klient->pocetDotazu}.",
        );
        return 0;
    }

    private function preparsuj(Argumenty $a): int
    {
        $out = $a->volba('out') ?? throw new ChybaArgumentu('Příkaz preparsuj potřebuje --out.');
        $archiv = $this->archiv($a);
        $hry = $this->hry($a);
        $od = self::tyden($a->volba('od'));
        $doTydne = self::tyden($a->volba('do'));

        if ($archiv->seznam() === []) {
            throw new ChybaArgumentu("Archiv {$archiv->koren()} je prázdný. Nahraj do něj fetcher/.cache.");
        }
        $vysledek = Preparsovani::zArchivu($archiv, $hry, $od, $doTydne);
        $zaznamy = $vysledek['zaznamy'];
        if ($zaznamy === []) {
            throw new ChybaArgumentu(
                "V archivu {$archiv->koren()} není nic, co by odpovídalo zadanému období a hrám.",
            );
        }

        $this->ohlasNepovedene($vysledek['nepovedene']);

        $prvni = $zaznamy[0];
        $posledni = $zaznamy[count($zaznamy) - 1];
        $obdobi = $od !== null && $doTydne !== null
            ? ['od' => $od, 'do' => $doTydne]
            : [
                'od' => ['rok' => $prvni['rok'], 'tyden' => $prvni['tyden']],
                'do' => ['rok' => $posledni['rok'], 'tyden' => $posledni['tyden']],
            ];

        $sestaveny = Vystup::sestav(
            $vysledek['tahy'],
            Vystup::nactiSazby($a->volba('sazby') ?? $this->konfigurace->sazby),
            $obdobi,
            new \DateTimeImmutable(),
        );
        Soubory::zapisAtomicky($out, Json::zapis($sestaveny));

        ($this->hlaseni)(sprintf(
            'Zapsáno %d tahů do %s (%d listin, z toho %d prázdných). Bez jediného dotazu na síť.',
            count($sestaveny['tahy']),
            $out,
            count($zaznamy),
            $vysledek['prazdnych'],
        ));
        return 0;
    }

    private function stav(Argumenty $a): int
    {
        $archiv = $this->archiv($a);
        $zaznamy = $archiv->seznam();
        if ($zaznamy === []) {
            ($this->vystup)("Archiv {$archiv->koren()} je prázdný.");
            return 0;
        }
        if (is_file($this->konfigurace->databaze)) {
            $this->stavDatabaze();
        }
        foreach (Model::HRY as $hra) {
            $jeho = array_values(array_filter($zaznamy, static fn (array $z): bool => $z['hra'] === $hra));
            if ($jeho === []) {
                continue;
            }
            ($this->vystup)(sprintf(
                '%s: %d listin, %s až %s',
                $hra,
                count($jeho),
                Obdobi::formatujTyden($jeho[0]),
                Obdobi::formatujTyden($jeho[count($jeho) - 1]),
            ));
        }
        return 0;
    }

    private function stavDatabaze(): void
    {
        $db = $this->db();
        foreach ($db->posledniTahy() as $hra => $t) {
            ($this->vystup)("{$hra}: poslední tah {$t['datum']}" . ($t['uplny'] ? '' : ' (bez tabulky výher)'));
        }
        ($this->vystup)('Poslední běhy:');
        foreach ($db->posledniBehy(10) as $b) {
            ($this->vystup)(sprintf('  %s  %d dotazů  %s%s', $b['zacatek'], $b['dotazu'], $b['vysledek'] ?? 'běží',
                $b['zprava'] === null ? '' : '  ' . str_replace("\n", '; ', $b['zprava'])));
        }
        ($this->vystup)('Kdy byly tahy poprvé úplné (podle toho se ladí prvniDotaz v rozvrhu):');
        foreach ($db->casyZverejneni(10) as $c) {
            $mistni = (new \DateTimeImmutable($c['uplny_od']))->setTimezone(new \DateTimeZone('Europe/Prague'));
            ($this->vystup)("  {$c['hra']} {$c['datum']}: {$mistni->format('Y-m-d H:i')}");
        }
    }

    /** @param list<string> $nepovedene */
    private function ohlasNepovedene(array $nepovedene): void
    {
        if ($nepovedene === []) {
            return;
        }
        ($this->hlaseni)('Nepodařilo se přečíst ' . count($nepovedene) . ' listin:');
        foreach (array_slice($nepovedene, 0, 10) as $radek) {
            ($this->hlaseni)("  {$radek}");
        }
        if (count($nepovedene) > 10) {
            ($this->hlaseni)('  … a dalších ' . (count($nepovedene) - 10));
        }
    }

    private function archiv(Argumenty $a): Archiv
    {
        return new Archiv($a->volba('archiv') ?? $this->konfigurace->archiv);
    }

    /** @return list<string> */
    private function hry(Argumenty $a): array
    {
        $hra = $a->volba('hra');
        if ($hra === null) {
            return Model::HRY;
        }
        if (!in_array($hra, Model::HRY, true)) {
            throw new ChybaArgumentu("Neznámá hra „{$hra}“. Možnosti: " . implode(', ', Model::HRY) . '.');
        }
        return [$hra];
    }

    /** @return Tyden|null */
    private static function tyden(?string $zapis): ?array
    {
        return $zapis === null ? null : Obdobi::parsujTyden($zapis);
    }
}
