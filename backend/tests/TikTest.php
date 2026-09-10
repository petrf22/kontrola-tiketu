<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Archiv;
use KontrolaTiketu\Databaze;
use KontrolaTiketu\Json;
use KontrolaTiketu\Konfigurace;
use KontrolaTiketu\Publikace;
use KontrolaTiketu\Sit\Odpoved;
use KontrolaTiketu\Sit\ZakazanoRobots;
use KontrolaTiketu\Test\Sit\FalesnaSit;
use KontrolaTiketu\Test\Sit\RobotsTest;
use KontrolaTiketu\Tik;
use KontrolaTiketu\Zdroj\AllwynVyherka;
use PHPUnit\Framework\TestCase;

/**
 * Celý běh z cronu proti falešné síti: rozvrh → stažení → databáze → publikace.
 *
 * Výchozí stav: archiv naplněný listinami týdne 36 (jako po nahrání fetcher/.cache), starší
 * týdny uzavřené. Úterý 8. 9. 2026 večer se losuje Eurojackpot, jehož listina je ve fixturách.
 */
final class TikTest extends TestCase
{
    use DocasnyAdresar;

    private const ROBOTS = 'https://www.allwyn.cz/robots.txt';

    private Konfigurace $konfigurace;
    private Databaze $db;
    private Archiv $archiv;
    private FalesnaSit $sit;

    protected function setUp(): void
    {
        $koren = $this->docasny();
        $vychozi = require Konfigurace::KOREN . '/config/konfigurace.php';
        self::assertIsArray($vychozi);
        $this->konfigurace = Konfigurace::zPole([
            ...$vychozi,
            'archiv' => "{$koren}/archiv",
            'databaze' => "{$koren}/stav.sqlite",
            'verejne' => "{$koren}/public/v1",
        ]);
        $this->db = Databaze::otevri($this->konfigurace->databaze);
        $this->archiv = new Archiv($this->konfigurace->archiv);
        $this->sit = new FalesnaSit([self::ROBOTS => new Odpoved(200, RobotsTest::ALLWYN)]);

        foreach (['eurojackpot-2026-36', 'sportka-2026-36'] as $jmeno) {
            [$hra, $rok, $tyden] = explode('-', $jmeno);
            $this->archiv->uloz(['hra' => $hra, 'rok' => (int) $rok, 'tyden' => (int) $tyden], Fixtury::listina($jmeno));
        }
        $this->tik()->obnov(self::cas('2026-09-08 12:00'));
        // Starší týdny uzavřené, ať se do testu nemíchá jejich uzavírání.
        foreach (range(32, 36) as $tyden) {
            foreach (['eurojackpot', 'sportka'] as $hra) {
                $this->db->zaznamenejStazeni($hra, 2026, $tyden, self::cas('2026-09-07 11:00'));
            }
        }
    }

    private function tik(): Tik
    {
        return new Tik($this->konfigurace, $this->db, $this->archiv, $this->sit, 0);
    }

    private static function cas(string $mistni): \DateTimeImmutable
    {
        return new \DateTimeImmutable($mistni, new \DateTimeZone('Europe/Prague'));
    }

    private function odpovez(string $hra, int $tyden, string $html): void
    {
        $this->sit->odpovedi[AllwynVyherka::sestavUrl($hra, 2026, $tyden)] = new Odpoved(200, $html);
    }

    /** @return array<string, mixed> */
    private function manifest(): array
    {
        $obsah = Json::cti((string) file_get_contents("{$this->konfigurace->verejne}/" . Publikace::MANIFEST));
        self::assertIsArray($obsah);
        /** @var array<string, mixed> $obsah */
        return $obsah;
    }

    /** @return array<string, mixed> */
    private function kontrola(): array
    {
        $kontrola = $this->manifest()['kontrola'] ?? null;
        self::assertIsArray($kontrola);
        /** @var array<string, mixed> $kontrola */
        return $kontrola;
    }

    public function testMimoLosovaniNejdeNaSitVubec(): void
    {
        self::assertSame(0, $this->tik()->spust(self::cas('2026-09-08 15:05')));
        self::assertSame([], $this->sit->dotazy, 'Ani robots.txt se nemá stahovat.');
    }

    public function testPoLosovaniStahneTydenAPublikuje(): void
    {
        $this->odpovez('eurojackpot', 37, Fixtury::listina('eurojackpot-2026-37'));

        self::assertSame(0, $this->tik()->spust(self::cas('2026-09-08 22:05')));

        self::assertSame([self::ROBOTS, AllwynVyherka::sestavUrl('eurojackpot', 2026, 37)], $this->sit->adresy());
        self::assertNotNull($this->archiv->nacti(['hra' => 'eurojackpot', 'rok' => 2026, 'tyden' => 37]));

        self::assertSame(['posledniTah' => '2026-09-08', 'uplny' => true], $this->kontrola()['eurojackpot'] ?? null);
        self::assertSame('2026-09-08T20:05:00.000Z', $this->kontrola()['posledniDotaz'] ?? null);

        $balik = Json::cti((string) file_get_contents("{$this->konfigurace->verejne}/2026.json"));
        self::assertIsArray($balik);
        self::assertIsArray($balik['tahy']);
        self::assertContains('2026-09-08', array_column($balik['tahy'], 'datum'));
    }

    public function testPoNacteniVysledkuSeUzNeptaAniDalsiHodinu(): void
    {
        $this->odpovez('eurojackpot', 37, Fixtury::listina('eurojackpot-2026-37'));
        $this->tik()->spust(self::cas('2026-09-08 22:05'));
        $this->sit->dotazy = [];

        $this->tik()->spust(self::cas('2026-09-08 23:05'));
        self::assertSame([], $this->sit->dotazy);
    }

    public function testListinaBezTabulkyVyhrySeUloziAleZkousiSeZnovu(): void
    {
        $bezTabulky = (string) preg_replace(
            '/<!-- vyhry -->[\s\S]*?<\/table>/',
            '<!-- vyhry --> Probíhá zpracování výsledků. </table>',
            Fixtury::listina('eurojackpot-2026-37'),
            1,
        );
        $this->odpovez('eurojackpot', 37, $bezTabulky);
        $this->tik()->spust(self::cas('2026-09-08 22:05'));
        self::assertSame(['posledniTah' => '2026-09-08', 'uplny' => false], $this->kontrola()['eurojackpot'] ?? null);

        // Za hodinu už Allwyn tabulku zveřejnil.
        $this->odpovez('eurojackpot', 37, Fixtury::listina('eurojackpot-2026-37'));
        $this->sit->dotazy = [];
        $this->tik()->spust(self::cas('2026-09-08 23:05'));
        self::assertSame([AllwynVyherka::sestavUrl('eurojackpot', 2026, 37)], $this->sit->adresy(), 'robots.txt se bere z databáze');
        self::assertSame(['posledniTah' => '2026-09-08', 'uplny' => true], $this->kontrola()['eurojackpot'] ?? null);
    }

    public function testUplnyTahNeprepiseListinaKteraTabulkuZaseSchovala(): void
    {
        $this->odpovez('eurojackpot', 37, Fixtury::listina('eurojackpot-2026-37'));
        $this->tik()->spust(self::cas('2026-09-08 22:05'));

        $bezTabulky = (string) preg_replace('/<!-- vyhry -->[\s\S]*?<\/table>/', '<!-- vyhry --> Probíhá zpracování výsledků. </table>', Fixtury::listina('eurojackpot-2026-37'), 1);
        self::assertSame([], $this->db->ulozTahy(AllwynVyherka::parsujListinu($bezTabulky), self::cas('2026-09-09 10:05')));
        self::assertTrue($this->db->uplnostOd('2026-09-08')['eurojackpot|2026-09-08'] ?? false);
    }

    public function testPrazdnaListinaNeprepiseArchivovanouPlnou(): void
    {
        // Uzavírání týdne 36 v pondělí dostane (hypoteticky) prázdnou odpověď.
        $this->db->zaznamenejStazeni('sportka', 2026, 36, self::cas('2026-09-06 23:00'));
        $this->odpovez('sportka', 36, Fixtury::listina('prazdna'));
        $this->odpovez('eurojackpot', 37, Fixtury::listina('prazdna'));
        $this->tik()->spust(self::cas('2026-09-07 10:05'));

        self::assertContains(AllwynVyherka::sestavUrl('sportka', 2026, 36), $this->sit->adresy());
        self::assertSame(Fixtury::listina('sportka-2026-36'), $this->archiv->nacti(['hra' => 'sportka', 'rok' => 2026, 'tyden' => 36]));
    }

    public function testZakazVRobotsZastaviBehDriveNezSahneNaListinu(): void
    {
        $this->sit->odpovedi[self::ROBOTS] = new Odpoved(200, "User-agent: *\nDisallow: /system/");
        try {
            $this->tik()->spust(self::cas('2026-09-08 22:05'));
            self::fail('Zákaz v robots.txt prošel.');
        } catch (ZakazanoRobots) {
            self::assertSame([self::ROBOTS], $this->sit->adresy());
        }
    }

    public function testVypadekAllwynuSeZapiseJakoChybaAPoTrechSeHodinoveOknoUtlumi(): void
    {
        // Listina vrací 503; robots.txt je v databázi.
        $this->sit->odpovedi[AllwynVyherka::sestavUrl('eurojackpot', 2026, 37)] = new Odpoved(503, '');
        foreach (['22:05', '23:05', '2026-09-09 00:05'] as $i => $kdy) {
            $cas = str_contains($kdy, '-') ? $kdy : "2026-09-08 {$kdy}";
            self::assertSame(1, $this->tik()->spust(self::cas($cas)), "běh {$i}");
        }
        self::assertSame(3, $this->db->neuspesnychVRade());

        $this->sit->dotazy = [];
        $this->tik()->spust(self::cas('2026-09-09 01:05'));
        self::assertSame([], $this->sit->dotazy, 'V útlumu se v okně nečeká každou hodinu.');
    }

    public function testBalikySeMeniJenKdyzSeZmeniData(): void
    {
        Publikace::publikuj($this->db, $this->konfigurace, self::cas('2026-09-08 12:00'));
        $prvni = $this->manifest()['baliky'] ?? null;

        Publikace::publikuj($this->db, $this->konfigurace, self::cas('2026-09-08 13:00'));
        self::assertSame($prvni, $this->manifest()['baliky'] ?? null, 'Publikace beze změny dat nesmí změnit hash.');

        $this->odpovez('eurojackpot', 37, Fixtury::listina('eurojackpot-2026-37'));
        $this->tik()->spust(self::cas('2026-09-08 22:05'));
        self::assertNotSame($prvni, $this->manifest()['baliky'] ?? null);
    }

    public function testManifestOdkazujeJenNaSouboryKtereLeziVedleAHashSedi(): void
    {
        Publikace::publikuj($this->db, $this->konfigurace, self::cas('2026-09-08 12:00'));
        $baliky = $this->manifest()['baliky'] ?? [];
        self::assertIsArray($baliky);
        self::assertNotEmpty($baliky);
        foreach ($baliky as $b) {
            self::assertIsArray($b);
            self::assertIsString($b['soubor']);
            self::assertMatchesRegularExpression('/^[a-z0-9-]+\.json$/', $b['soubor'], 'Klient jiná jména odmítne.');
            self::assertSame($b['hash'], 'sha256:' . hash_file('sha256', "{$this->konfigurace->verejne}/{$b['soubor']}"));
        }
    }

    public function testBalikJeTentyzFormatJakoSouborOdFetcheru(): void
    {
        // Aplikace ho čte stejným kódem jako import souboru — tahy musí sedět do bajtu.
        $this->archiv->uloz(['hra' => 'eurojackpot', 'rok' => 2026, 'tyden' => 37], Fixtury::listina('eurojackpot-2026-37'));
        $this->tik()->obnov(self::cas('2026-09-09 12:00'));
        Publikace::publikuj($this->db, $this->konfigurace, self::cas('2026-09-09 12:00'));

        $balik = Json::cti((string) file_get_contents("{$this->konfigurace->verejne}/2026.json"));
        $fetcher = Json::cti(Fixtury::soubor('app/test/fixtures/vysledky-2026-35-az-37.json'));
        self::assertIsArray($balik);
        self::assertIsArray($fetcher);
        self::assertSame(Json::zapis($fetcher['tahy']), Json::zapis($balik['tahy']));
        self::assertSame($fetcher['sazbyExtra6'], $balik['sazbyExtra6']);
        self::assertSame(1, $balik['verzeFormatu']);
    }
}
