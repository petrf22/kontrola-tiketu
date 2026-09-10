<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use PHPUnit\Framework\TestCase;

/**
 * Pravidla webu, na kterých závisí aplikace. Apache se v testech spustit nedá, tak se hlídá
 * aspoň to, že v souboru jsou — jejich skutečné chování se ověří po nasazení (docs/backend.md).
 */
final class HtaccessTest extends TestCase
{
    private static function htaccess(): string
    {
        return Fixtury::soubor('backend/public/.htaccess');
    }

    public function testJsonJdeVenJakoTextPlain(): void
    {
        // S application/json by Capacitor odpověď rozparsoval a aplikace by neověřila hash.
        self::assertMatchesRegularExpression('/AddType "text\/plain; charset=utf-8" \.json/', self::htaccess());
        self::assertDoesNotMatchRegularExpression('/AddType\s+"?application\/json/', self::htaccess());
    }

    public function testVenPoustiJenBalikyARobots(): void
    {
        self::assertStringContainsString('RewriteRule ^(robots\.txt|v1/[a-z0-9-]+\.json)$ - [L]', self::htaccess());
        self::assertStringContainsString('RewriteRule ^ - [F]', self::htaccess());
        self::assertStringContainsString('Options -Indexes', self::htaccess());
    }

    public function testDocasneSouboryPublikaceVenNesmi(): void
    {
        self::assertMatchesRegularExpression('/<FilesMatch "\^\\\\\.">\s*Require all denied/', self::htaccess());
    }

    public function testNeposilaCookies(): void
    {
        self::assertStringContainsString('Header always unset Set-Cookie', self::htaccess());
    }

    public function testVyhledavaceNemajCoIndexovat(): void
    {
        self::assertSame("User-agent: *\nDisallow: /\n", Fixtury::soubor('backend/public/robots.txt'));
    }
}
