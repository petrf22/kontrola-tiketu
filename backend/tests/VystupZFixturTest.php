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
 * Hlavní pojistka formátu: ze skutečných listin ve fixturách musí vyjít **bajt po bajtu**
 * tentýž balík jako `tests/fixtures/vysledky-2026-35-az-37.json`.
 *
 * Porovnává se text, ne struktura. Strukturální shoda by propustila přehozené pořadí klíčů
 * nebo jinak zapsané číslo — a na obojím stojí hash, kterým aplikace balík ověřuje. Liší se
 * jen čas vygenerování, ten se převezme.
 *
 * Tentýž balík má jako ukázku i mobilní aplikace ve svých testech. Kdo tady záměrně změní
 * formát, musí zvednout `verzeFormatu` a ukázku v aplikaci vyměnit.
 */
final class VystupZFixturTest extends TestCase
{
    public function testZFixturVyjdeUkazkovyBalik(): void
    {
        $ocekavany = Fixtury::soubor('tests/fixtures/vysledky-2026-35-az-37.json');
        $puvodni = Json::cti($ocekavany);
        self::assertIsArray($puvodni);
        self::assertIsString($puvodni['vygenerovano']);

        $od = Obdobi::parsujTyden('2026-35');
        $doTydne = Obdobi::parsujTyden('2026-37');
        $vysledek = Preparsovani::zArchivu(new Archiv(Fixtury::LISTINY), Model::HRY, $od, $doTydne);
        self::assertSame([], $vysledek['nepovedene']);

        self::assertStejnyText($ocekavany, Json::zapis(Vystup::sestav(
            $vysledek['tahy'],
            Vystup::nactiSazby(Fixtury::KOREN . '/config/sazby-extra6.json'),
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
