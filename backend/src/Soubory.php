<?php

declare(strict_types=1);

namespace KontrolaTiketu;

final class Soubory
{
    private function __construct()
    {
    }

    /**
     * Zapíše soubor tak, aby ho nikdo nikdy neviděl napůl: nejdřív vedle do dočasného souboru,
     * pak přejmenováním, které je v rámci jednoho souborového systému atomické.
     *
     * U publikovaných výsledků to znamená, že aplikace stáhne buď starý, nebo nový balík —
     * nikdy useknutý.
     */
    public static function zapisAtomicky(string $cesta, string $obsah): void
    {
        $adresar = dirname($cesta);
        if (!is_dir($adresar) && !mkdir($adresar, 0o775, true) && !is_dir($adresar)) {
            throw new \RuntimeException("Adresář {$adresar} nejde vytvořit.");
        }
        $docasny = $adresar . '/.' . basename($cesta) . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($docasny, $obsah) !== strlen($obsah)) {
            @unlink($docasny);
            throw new \RuntimeException("Zápis do {$docasny} selhal.");
        }
        if (!rename($docasny, $cesta)) {
            @unlink($docasny);
            throw new \RuntimeException("Přejmenování na {$cesta} selhalo.");
        }
    }
}
