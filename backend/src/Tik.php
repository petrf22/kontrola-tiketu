<?php

declare(strict_types=1);

namespace KontrolaTiketu;

use KontrolaTiketu\Sit\ChybaStahovani;
use KontrolaTiketu\Sit\Klient;
use KontrolaTiketu\Sit\Sit;
use KontrolaTiketu\Zdroj\AllwynVyherka;
use KontrolaTiketu\Zdroj\ChybaParsovani;

/**
 * Jeden běh z cronu: zeptat se rozvrhu, stáhnout, přečíst, uložit, publikovat.
 *
 * Když rozvrh nic nechce, běh skončí bez jediného dotazu — ani na robots.txt. To je běžný
 * stav většiny hodin v týdnu.
 *
 * @phpstan-import-type Ukol from Rozvrh
 */
final class Tik
{
    /** robots.txt se znovu čte nejdřív po dni. */
    private const ROBOTS_PLATI_HODIN = 24;

    /** @var \Closure(string): void */
    private readonly \Closure $hlaseni;

    /** @param (\Closure(string): void)|null $hlaseni */
    public function __construct(
        private readonly Konfigurace $konfigurace,
        private readonly Databaze $db,
        private readonly Archiv $archiv,
        private readonly Sit $sit,
        private readonly int $prodlevaMs = Klient::PRODLEVA_MS,
        ?\Closure $hlaseni = null,
    ) {
        $this->hlaseni = $hlaseni ?? static function (string $radek): void {
        };
    }

    /**
     * Co by běh v daném čase stáhl — bez sítě a bez zápisu.
     *
     * @return list<Ukol>
     */
    public function plan(\DateTimeImmutable $ted): array
    {
        return Rozvrh::coStahnout(
            $ted,
            $this->db->uplnostOd($ted->modify('-' . (Rozvrh::DNU_ZPETNE + 1) . ' days')->format('Y-m-d')),
            $this->db->stazeniListin(),
            $this->db->neuspesnychVRade(),
            $this->konfigurace,
        );
    }

    /** @return int Návratový kód: 0 v pořádku, 1 chyba, 3 zákaz v robots.txt. */
    public function spust(\DateTimeImmutable $ted): int
    {
        $ukoly = $this->plan($ted);
        if ($ukoly === []) {
            ($this->hlaseni)('Rozvrh teď nic nečeká, na Allwyn se nechodí.');
            return 0;
        }

        $beh = $this->db->zacniBeh($ted);
        $klient = new Klient($this->sit, $this->prodlevaMs);
        $chyby = [];
        $zmenene = [];

        try {
            $this->pripravRobots($klient, $ted);

            foreach ($ukoly as $ukol) {
                if ($klient->pocetDotazu >= $this->konfigurace->maxDotazuNaBeh) {
                    $chyby[] = 'Dosažen limit dotazů na běh, zbytek počká na příští.';
                    break;
                }
                try {
                    $zmenene = [...$zmenene, ...$this->zpracuj($klient, $ukol, $ted)];
                } catch (ChybaStahovani | ChybaParsovani $chyba) {
                    $chyby[] = "{$ukol['hra']} {$ukol['rok']}-{$ukol['tyden']}: {$chyba->getMessage()}";
                }
            }
        } catch (\Throwable $chyba) {
            // Zákaz v robots.txt i cokoliv nečekaného běh ukončí; volající rozhodne o kódu.
            $this->db->dokonciBeh($beh, $ted, $klient->pocetDotazu, 'chyba', $chyba->getMessage());
            throw $chyba;
        }

        $zprava = implode("\n", [...array_map(static fn (string $k): string => "nové nebo změněné: {$k}", $zmenene), ...$chyby]);
        $this->db->dokonciBeh($beh, $ted, $klient->pocetDotazu, $chyby === [] ? 'ok' : 'chyba', $zprava === '' ? null : $zprava);

        // Publikuje se i bez změny dat: manifest nese čas poslední kontroly, a právě ten
        // aplikace ukazuje, když se uživatel ptá, jestli už výsledky jsou.
        Publikace::publikuj($this->db, $this->konfigurace, $ted);

        foreach ([...$zmenene, ...$chyby] as $radek) {
            ($this->hlaseni)($radek);
        }
        ($this->hlaseni)("Hotovo: {$klient->pocetDotazu} dotazů, " . count($zmenene) . ' nových nebo změněných tahů.');
        return $chyby === [] ? 0 : 1;
    }

    private function pripravRobots(Klient $klient, \DateTimeImmutable $ted): void
    {
        $ulozeny = $this->db->robots();
        if ($ulozeny !== null && $ulozeny['nacteno'] > $ted->modify('-' . self::ROBOTS_PLATI_HODIN . ' hours')) {
            $klient->pouzijRobots($ulozeny['text']);
            return;
        }
        $this->db->ulozRobots($klient->nactiRobots(AllwynVyherka::ZAKLADNI_URL), $ted);
    }

    /**
     * @param Ukol $ukol
     * @return list<string> Nové nebo změněné tahy.
     */
    private function zpracuj(Klient $klient, array $ukol, \DateTimeImmutable $ted): array
    {
        $souradnice = ['hra' => $ukol['hra'], 'rok' => $ukol['rok'], 'tyden' => $ukol['tyden']];
        $html = $klient->stahni(AllwynVyherka::sestavUrl($ukol['hra'], $ukol['rok'], $ukol['tyden']));
        $this->db->zaznamenejStazeni($ukol['hra'], $ukol['rok'], $ukol['tyden'], $ted);

        if (AllwynVyherka::jePrazdna($html)) {
            // Prázdnou listinou se nesmí přepsat plná — týden se stahuje i před prvním losováním.
            $puvodni = $this->archiv->nacti($souradnice);
            if ($puvodni === null || AllwynVyherka::jePrazdna($puvodni)) {
                $this->archiv->uloz($souradnice, $html);
            }
            return [];
        }

        // Archiv je zdroj pravdy: listina se uloží dřív, než se čte, i kdyby čtení selhalo.
        $this->archiv->uloz($souradnice, $html);
        return $this->db->ulozTahy(AllwynVyherka::parsujListinu($html), $ted);
    }

    /**
     * Naplní databázi z archivu — po nasazení nebo když se databáze zahodí. Bez sítě.
     *
     * Čas stažení listiny se vezme z data souboru, aby rozvrh znovu nestahoval týdny, které
     * archiv už uzavřené má.
     *
     * @return array{listin: int, tahu: int, nepovedene: list<string>}
     */
    public function obnov(\DateTimeImmutable $ted): array
    {
        $listin = 0;
        $tahu = 0;
        $nepovedene = [];
        $this->db->transakce(function () use ($ted, &$listin, &$tahu, &$nepovedene): void {
            foreach ($this->archiv->seznam() as $s) {
                $listin += 1;
                $cas = filemtime($this->archiv->cesta($s));
                $this->db->zaznamenejStazeni($s['hra'], $s['rok'], $s['tyden'], (new \DateTimeImmutable())->setTimestamp($cas === false ? $ted->getTimestamp() : $cas));
                $html = $this->archiv->nacti($s);
                if ($html === null || AllwynVyherka::jePrazdna($html)) {
                    continue;
                }
                try {
                    $tahu += count($this->db->ulozTahy(AllwynVyherka::parsujListinu($html), $ted));
                } catch (ChybaParsovani $chyba) {
                    $nepovedene[] = "{$s['hra']} " . Obdobi::formatujTyden($s) . ": {$chyba->getMessage()}";
                }
            }
        });
        return ['listin' => $listin, 'tahu' => $tahu, 'nepovedene' => $nepovedene];
    }
}
