<?php

declare(strict_types=1);

namespace KontrolaTiketu;

/**
 * Stav backendu v SQLite.
 *
 * Zdrojem pravdy je archiv listin; databáze drží, co z něj vyšlo, a co se kdy dělo. Dá se
 * kdykoliv zahodit a znovu postavit příkazem `obnov`, aniž by se šlo na síť.
 *
 * SQLite proto, že na sdíleném hostingu nepotřebuje server ani přihlašovací údaje a záloha je
 * kopie jednoho souboru. Soubor musí ležet mimo document root.
 *
 * @phpstan-import-type Tah from Model
 */
final class Databaze
{
    private const SCHEMA = <<<'SQL'
        CREATE TABLE IF NOT EXISTS tah (
            hra TEXT NOT NULL,
            datum TEXT NOT NULL,
            rok INTEGER NOT NULL,
            uplny INTEGER NOT NULL,
            data TEXT NOT NULL,
            -- Kdy backend tah uviděl poprvé a kdy poprvé i s tabulkou výher. Z rozdílu oproti
            -- času losování se po pár týdnech změří, kdy Allwyn výsledky skutečně zveřejňuje.
            poprve_videno TEXT NOT NULL,
            uplny_od TEXT,
            zmeneno TEXT NOT NULL,
            PRIMARY KEY (hra, datum)
        );
        CREATE TABLE IF NOT EXISTS listina (
            hra TEXT NOT NULL,
            rok INTEGER NOT NULL,
            tyden INTEGER NOT NULL,
            stazeno TEXT NOT NULL,
            PRIMARY KEY (hra, rok, tyden)
        );
        CREATE TABLE IF NOT EXISTS beh (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zacatek TEXT NOT NULL,
            konec TEXT,
            dotazu INTEGER NOT NULL DEFAULT 0,
            vysledek TEXT,
            zprava TEXT
        );
        CREATE TABLE IF NOT EXISTS robots (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            nacteno TEXT NOT NULL,
            text TEXT NOT NULL
        );
        SQL;

    /** Běhy starší než tohle se mažou, ať databáze neroste donekonečna. */
    private const UCHOVAT_BEHY_DNU = 90;

    private function __construct(private readonly \PDO $pdo)
    {
    }

    public static function otevri(string $cesta): self
    {
        $adresar = dirname($cesta);
        if ($cesta !== ':memory:' && !is_dir($adresar) && !mkdir($adresar, 0o775, true) && !is_dir($adresar)) {
            throw new \RuntimeException("Adresář databáze {$adresar} nejde vytvořit.");
        }
        $pdo = new \PDO("sqlite:{$cesta}", null, null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        ]);
        // Na sdíleném hostingu může databáze ležet na síťovém disku, kde WAL nefunguje spolehlivě.
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec(self::SCHEMA);
        return new self($pdo);
    }

    /**
     * Uloží tahy z jedné listiny. Vrací klíče `hra|datum`, které přibyly nebo se změnily.
     *
     * Úplný tah se nikdy nepřepíše neúplným. Kdyby Allwyn tabulku výher na chvíli zase schoval,
     * aplikace nemá o částky přijít.
     *
     * @param list<Tah> $tahy
     * @return list<string>
     */
    public function ulozTahy(array $tahy, \DateTimeImmutable $ted): array
    {
        return $this->transakce(fn (): array => $this->ulozTahyBezTransakce($tahy, $ted));
    }

    /**
     * Provede práci v jedné transakci; vnořené volání se připojí k té vnější.
     *
     * Naplnění z archivu jsou tisíce listin — každá ve vlastní transakci by na disku
     * sdíleného hostingu znamenala tisíce synchronizací.
     *
     * @template T
     * @param \Closure(): T $prace
     * @return T
     */
    public function transakce(\Closure $prace): mixed
    {
        if ($this->pdo->inTransaction()) {
            return $prace();
        }
        $this->pdo->beginTransaction();
        try {
            $vysledek = $prace();
            $this->pdo->commit();
            return $vysledek;
        } catch (\Throwable $chyba) {
            $this->pdo->rollBack();
            throw $chyba;
        }
    }

    /**
     * @param list<Tah> $tahy
     * @return list<string>
     */
    private function ulozTahyBezTransakce(array $tahy, \DateTimeImmutable $ted): array
    {
        $cas = self::cas($ted);
        $zmenene = [];
        $cti = $this->pdo->prepare('SELECT data, uplny FROM tah WHERE hra = ? AND datum = ?');
        $vloz = $this->pdo->prepare(
            'INSERT INTO tah (hra, datum, rok, uplny, data, poprve_videno, uplny_od, zmeneno) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $uprav = $this->pdo->prepare(
            'UPDATE tah SET uplny = ?, data = ?, uplny_od = COALESCE(uplny_od, ?), zmeneno = ? WHERE hra = ? AND datum = ?',
        );

        foreach ($tahy as $tah) {
            $data = Json::kompaktne($tah);
            $uplny = Uplnost::jeUplny($tah);
            $cti->execute([$tah['hra'], $tah['datum']]);
            /** @var array{data: string, uplny: int}|false $puvodni */
            $puvodni = $cti->fetch();
            $cti->closeCursor();

            if ($puvodni === false) {
                $vloz->execute([
                    $tah['hra'], $tah['datum'], (int) substr($tah['datum'], 0, 4), (int) $uplny,
                    $data, $cas, $uplny ? $cas : null, $cas,
                ]);
            } elseif ($puvodni['data'] !== $data && !($puvodni['uplny'] === 1 && !$uplny)) {
                $uprav->execute([(int) $uplny, $data, $uplny ? $cas : null, $cas, $tah['hra'], $tah['datum']]);
            } else {
                continue;
            }
            $zmenene[] = "{$tah['hra']}|{$tah['datum']}";
        }
        return $zmenene;
    }

    /**
     * Úplnost tahů od daného data — vstup pro rozvrh.
     *
     * @return array<string, bool> `hra|datum` → úplný?
     */
    public function uplnostOd(string $datum): array
    {
        $dotaz = $this->pdo->prepare('SELECT hra, datum, uplny FROM tah WHERE datum >= ?');
        $dotaz->execute([$datum]);
        $vysledek = [];
        /** @var array{hra: string, datum: string, uplny: int} $radek */
        foreach ($dotaz as $radek) {
            $vysledek["{$radek['hra']}|{$radek['datum']}"] = $radek['uplny'] === 1;
        }
        return $vysledek;
    }

    /**
     * Tahy k publikaci, chronologicky.
     *
     * @return list<array{tah: Tah, zmeneno: string}>
     */
    public function tahyOdRoku(int $rok): array
    {
        $dotaz = $this->pdo->prepare('SELECT data, zmeneno FROM tah WHERE rok >= ? ORDER BY datum, hra');
        $dotaz->execute([$rok]);
        $vysledek = [];
        /** @var array{data: string, zmeneno: string} $radek */
        foreach ($dotaz as $radek) {
            /** @var Tah $tah Do databáze se dostane jen výstup parseru. */
            $tah = Json::cti($radek['data']);
            $vysledek[] = ['tah' => $tah, 'zmeneno' => $radek['zmeneno']];
        }
        return $vysledek;
    }

    /**
     * Nejnovější tah každé hry — pro manifest, ať aplikace ukáže, jestli kontrola proběhla.
     *
     * @return array<string, array{datum: string, uplny: bool}>
     */
    public function posledniTahy(): array
    {
        $vysledek = [];
        /** @var array{hra: string, datum: string, uplny: int} $radek */
        foreach ($this->pdo->query(
            'SELECT hra, datum, uplny FROM tah t WHERE datum = (SELECT MAX(datum) FROM tah WHERE hra = t.hra) ORDER BY hra',
        ) ?: [] as $radek) {
            $vysledek[$radek['hra']] = ['datum' => $radek['datum'], 'uplny' => $radek['uplny'] === 1];
        }
        return $vysledek;
    }

    public function zaznamenejStazeni(string $hra, int $rok, int $tyden, \DateTimeImmutable $kdy): void
    {
        $this->pdo->prepare(
            'INSERT INTO listina (hra, rok, tyden, stazeno) VALUES (?, ?, ?, ?)
             ON CONFLICT (hra, rok, tyden) DO UPDATE SET stazeno = excluded.stazeno',
        )->execute([$hra, $rok, $tyden, self::cas($kdy)]);
    }

    /**
     * Kdy se která listina stahovala naposledy — vstup pro rozvrh.
     *
     * @return array<string, \DateTimeImmutable> `hra|rok|týden` → čas
     */
    public function stazeniListin(): array
    {
        $vysledek = [];
        /** @var array{hra: string, rok: int, tyden: int, stazeno: string} $radek */
        foreach ($this->dotaz('SELECT hra, rok, tyden, stazeno FROM listina') as $radek) {
            $vysledek["{$radek['hra']}|{$radek['rok']}|{$radek['tyden']}"] = new \DateTimeImmutable($radek['stazeno']);
        }
        return $vysledek;
    }

    /** @return array{text: string, nacteno: \DateTimeImmutable}|null */
    public function robots(): ?array
    {
        /** @var array{text: string, nacteno: string}|false $radek */
        $radek = $this->dotaz('SELECT text, nacteno FROM robots WHERE id = 1')->fetch();
        return $radek === false ? null : ['text' => $radek['text'], 'nacteno' => new \DateTimeImmutable($radek['nacteno'])];
    }

    public function ulozRobots(string $text, \DateTimeImmutable $kdy): void
    {
        $this->pdo->prepare(
            'INSERT INTO robots (id, nacteno, text) VALUES (1, ?, ?)
             ON CONFLICT (id) DO UPDATE SET nacteno = excluded.nacteno, text = excluded.text',
        )->execute([self::cas($kdy), $text]);
    }

    public function zacniBeh(\DateTimeImmutable $kdy): int
    {
        $this->pdo->prepare('DELETE FROM beh WHERE zacatek < ?')
            ->execute([self::cas($kdy->modify('-' . self::UCHOVAT_BEHY_DNU . ' days'))]);
        $this->pdo->prepare('INSERT INTO beh (zacatek) VALUES (?)')->execute([self::cas($kdy)]);
        return (int) $this->pdo->lastInsertId();
    }

    public function dokonciBeh(int $id, \DateTimeImmutable $kdy, int $dotazu, string $vysledek, ?string $zprava): void
    {
        $this->pdo->prepare('UPDATE beh SET konec = ?, dotazu = ?, vysledek = ?, zprava = ? WHERE id = ?')
            ->execute([self::cas($kdy), $dotazu, $vysledek, $zprava, $id]);
    }

    /**
     * Kolik posledních běhů, které se na něco ptaly, skončilo chybou. Běhy bez dotazu se
     * nepočítají — hodina bez práce není důkaz, že se zdroj uzdravil.
     */
    public function neuspesnychVRade(): int
    {
        $pocet = 0;
        /** @var array{vysledek: ?string} $radek */
        foreach ($this->dotaz("SELECT vysledek FROM beh WHERE dotazu > 0 OR vysledek = 'chyba' ORDER BY id DESC LIMIT 20") as $radek) {
            if ($radek['vysledek'] !== 'chyba') {
                break;
            }
            $pocet += 1;
        }
        return $pocet;
    }

    /** Kdy se backend naposledy úspěšně zeptal Allwynu. */
    public function posledniDotaz(): ?\DateTimeImmutable
    {
        $cas = $this->dotaz("SELECT MAX(konec) FROM beh WHERE dotazu > 0 AND vysledek = 'ok'")->fetchColumn();
        return is_string($cas) ? new \DateTimeImmutable($cas) : null;
    }

    /**
     * Poslední běhy pro výpis stavu.
     *
     * @return list<array{zacatek: string, dotazu: int, vysledek: ?string, zprava: ?string}>
     */
    public function posledniBehy(int $kolik): array
    {
        $dotaz = $this->pdo->prepare('SELECT zacatek, dotazu, vysledek, zprava FROM beh ORDER BY id DESC LIMIT ?');
        $dotaz->execute([$kolik]);
        /** @var list<array{zacatek: string, dotazu: int, vysledek: ?string, zprava: ?string}> */
        return $dotaz->fetchAll();
    }

    /**
     * Kdy byl tah poprvé úplný — z toho se ladí `prvniDotaz` v rozvrhu.
     *
     * Bere jen tahy, které backend viděl do dvou dnů po losování; tahy naplněné z archivu
     * by čas zveřejnění jen předstíraly.
     *
     * @return list<array{hra: string, datum: string, uplny_od: string}>
     */
    public function casyZverejneni(int $kolik): array
    {
        $dotaz = $this->pdo->prepare(
            "SELECT hra, datum, uplny_od FROM tah
             WHERE uplny_od IS NOT NULL AND uplny_od < date(datum, '+2 days')
             ORDER BY datum DESC LIMIT ?",
        );
        $dotaz->execute([$kolik]);
        /** @var list<array{hra: string, datum: string, uplny_od: string}> */
        return $dotaz->fetchAll();
    }

    /** Dotaz bez parametrů. S ERRMODE_EXCEPTION PDO při chybě vyhodí výjimku, false je jen teorie. */
    private function dotaz(string $sql): \PDOStatement
    {
        $vysledek = $this->pdo->query($sql);
        if ($vysledek === false) {
            throw new \RuntimeException("Dotaz selhal: {$sql}");
        }
        return $vysledek;
    }

    /** Čas v UTC s pevným tvarem, aby se dal porovnávat i jako text. */
    private static function cas(\DateTimeImmutable $kdy): string
    {
        return $kdy->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }
}
