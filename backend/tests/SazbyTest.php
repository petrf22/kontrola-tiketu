<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use KontrolaTiketu\Konfigurace;
use PHPUnit\Framework\TestCase;

/**
 * Sazby Extra 6 výherní listina nepublikuje, takže je backend drží v `config/sazby-extra6.json`
 * a přibaluje je ke každému balíku. Ten soubor je jediný zdroj pravdy o sazbách.
 */
final class SazbyTest extends TestCase
{
    public function testVychoziKonfiguraceNaSazbyUkazuje(): void
    {
        $konfigurace = Konfigurace::nacti();
        self::assertSame(
            realpath(Fixtury::KOREN . '/config/sazby-extra6.json'),
            realpath($konfigurace->sazby),
        );
    }
}
