<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test;

use PHPUnit\Framework\Attributes\After;

/** Dočasný adresář pro test, který se po testu smaže. */
trait DocasnyAdresar
{
    /** @var list<string> */
    private array $docasneAdresare = [];

    private function docasny(): string
    {
        $cesta = sys_get_temp_dir() . '/kontrola-tiketu-test-' . bin2hex(random_bytes(6));
        if (!mkdir($cesta, 0o700, true)) {
            throw new \RuntimeException("Dočasný adresář {$cesta} nejde vytvořit.");
        }
        $this->docasneAdresare[] = $cesta;
        return $cesta;
    }

    #[After]
    protected function smazDocasne(): void
    {
        foreach ($this->docasneAdresare as $adresar) {
            self::smazStrom($adresar);
        }
        $this->docasneAdresare = [];
    }

    private static function smazStrom(string $cesta): void
    {
        if (!is_dir($cesta) || is_link($cesta)) {
            @unlink($cesta);
            return;
        }
        foreach (scandir($cesta) ?: [] as $jmeno) {
            if ($jmeno !== '.' && $jmeno !== '..') {
                self::smazStrom("{$cesta}/{$jmeno}");
            }
        }
        rmdir($cesta);
    }
}
