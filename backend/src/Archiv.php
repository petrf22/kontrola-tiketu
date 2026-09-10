<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Archiv stažených výherních listin.
 *
 * Port `fetcher/src/archiv.ts` **ve stejném formátu souborů** — `<hra>-<rok>-<TT>.html.gz`,
 * gzip úrovně 9. Server se tak dá naplnit nahráním `fetcher/.cache` místo dvou tisíc dotazů
 * na Allwyn a archiv se dá předávat oběma směry.
 *
 * Není to dočasná cache, ale trvalý archiv. Pravděpodobnější než zmizení zdroje je chyba ve
 * vlastním parseru; se syrovou zálohou se přeparsuje offline během vteřin.
 *
 * @phpstan-type Souradnice array{hra: string, rok: int, tyden: int}
 */
final class Archiv
{
    private const NAZEV = '/^(eurojackpot|sportka)-(\d{4})-(\d{2})\.html\.gz$/';

    public function __construct(private readonly string $koren)
    {
    }

    public function koren(): string
    {
        return $this->koren;
    }

    /** @param Souradnice $s */
    public static function nazevSouboru(array $s): string
    {
        return sprintf('%s-%d-%02d.html.gz', $s['hra'], $s['rok'], $s['tyden']);
    }

    /** @param Souradnice $s */
    public function cesta(array $s): string
    {
        return $this->koren . '/' . self::nazevSouboru($s);
    }

    /** @param Souradnice $s */
    public function nacti(array $s): ?string
    {
        $cesta = $this->cesta($s);
        if (!is_file($cesta)) {
            return null;
        }
        $data = file_get_contents($cesta);
        $html = $data === false ? false : gzdecode($data);
        if ($html === false) {
            throw new \RuntimeException("Listinu {$cesta} se nepodařilo přečíst.");
        }
        return $html;
    }

    /** @param Souradnice $s */
    public function obsahuje(array $s): bool
    {
        return is_file($this->cesta($s));
    }

    /**
     * Uloží listinu. Na rozdíl od fetcheru přes dočasný soubor a přejmenování — cron může
     * doběhnout na limit hostingu uprostřed zápisu a useknutý gzip by archiv rozbil.
     *
     * @param Souradnice $s
     */
    public function uloz(array $s, string $html): void
    {
        if (!is_dir($this->koren) && !mkdir($this->koren, 0o775, true) && !is_dir($this->koren)) {
            throw new \RuntimeException("Adresář archivu {$this->koren} nejde vytvořit.");
        }
        $data = gzencode($html, 9);
        if ($data === false) {
            throw new \RuntimeException('Listinu se nepodařilo zabalit.');
        }
        Soubory::zapisAtomicky($this->cesta($s), $data);
    }

    /**
     * Co všechno archiv obsahuje, seřazeno chronologicky.
     *
     * @return list<Souradnice>
     */
    public function seznam(): array
    {
        if (!is_dir($this->koren)) {
            return [];
        }
        $soubory = scandir($this->koren);
        if ($soubory === false) {
            throw new \RuntimeException("Adresář archivu {$this->koren} nejde přečíst.");
        }

        $zaznamy = [];
        foreach ($soubory as $jmeno) {
            if (preg_match(self::NAZEV, $jmeno, $n) === 1) {
                $zaznamy[] = ['hra' => $n[1], 'rok' => (int) $n[2], 'tyden' => (int) $n[3]];
            }
        }
        usort(
            $zaznamy,
            static fn (array $a, array $b): int => [$a['rok'], $a['tyden'], $a['hra']] <=> [$b['rok'], $b['tyden'], $b['hra']],
        );
        return $zaznamy;
    }
}
