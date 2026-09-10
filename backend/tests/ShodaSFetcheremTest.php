<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Archiv;
use KontrolaTiketu\Json;
use KontrolaTiketu\Model;
use KontrolaTiketu\Obdobi;
use KontrolaTiketu\Preparsovani;
use KontrolaTiketu\Vystup;
use PHPUnit\Framework\TestCase;

/**
 * Hlavní pojistka portu: backend musí ze stejných listin vyrobit **bajt po bajtu** stejný
 * soubor jako fetcher.
 *
 * Porovnává se text, ne struktura. Strukturální shoda by propustila přehozené pořadí klíčů
 * nebo jinak zapsané číslo — a to jsou přesně ty rozdíly, které vzniknou při portu z JS do PHP
 * a o kterých by se jinak nikdo nedozvěděl. Liší se jen čas vygenerování, ten se převezme.
 *
 * Srovnání nad celým archivem (TS a PHP nad týmiž listinami) je v `test/backend.test.ts`,
 * protože potřebuje oba běhy najednou.
 */
final class ShodaSFetcheremTest extends TestCase
{
    /**
     * `app/test/fixtures/vysledky-2026-35-az-37.json` je skutečný výstup fetcheru z listin,
     * které jsou ve fixturách (viz jeho PUVOD.md), takže test běží vždy, i bez archivu.
     */
    public function testZFixturVyjdeTyzSouborJakoOdFetcheru(): void
    {
        $ocekavany = Fixtury::soubor('app/test/fixtures/vysledky-2026-35-az-37.json');
        $puvodni = Json::cti($ocekavany);
        self::assertIsArray($puvodni);
        self::assertIsString($puvodni['vygenerovano']);

        $od = Obdobi::parsujTyden('2026-35');
        $doTydne = Obdobi::parsujTyden('2026-37');
        $vysledek = Preparsovani::zArchivu(new Archiv(Fixtury::LISTINY), Model::HRY, $od, $doTydne);
        self::assertSame([], $vysledek['nepovedene']);

        self::assertStejnyText($ocekavany, Json::zapis(Vystup::sestav(
            $vysledek['tahy'],
            Vystup::nactiSazby(Fixtury::KOREN_REPA . '/data/sazby-extra6.json'),
            ['od' => $od, 'do' => $doTydne],
            new \DateTimeImmutable($puvodni['vygenerovano']),
        )));
    }

    /**
     * Porovná texty a při neshodě ukáže první rozdílný řádek.
     *
     * `assertSame` by u rozdílu počítal diff celých souborů — u megabajtových výstupů to trvá
     * minuty a výsledek stejně nikdo nepřečte.
     */
    public static function assertStejnyText(string $ocekavany, string $skutecny): void
    {
        if ($ocekavany === $skutecny) {
            return;
        }
        $a = explode("\n", $ocekavany);
        $b = explode("\n", $skutecny);
        $radek = 0;
        while (($a[$radek] ?? null) === ($b[$radek] ?? null)) {
            $radek += 1;
        }
        self::fail(sprintf(
            "Texty se liší na řádku %d:\n  čekáno: %s\n  je:     %s",
            $radek + 1,
            $a[$radek] ?? '(konec souboru)',
            $b[$radek] ?? '(konec souboru)',
        ));
    }
}
