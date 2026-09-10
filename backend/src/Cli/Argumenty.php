<?php

declare(strict_types=1);

namespace KontrolaTiketu\Cli;

/**
 * Rozbor příkazové řádky ve tvaru `prikaz --klic hodnota --klic=hodnota`.
 *
 * Záměrně bez závislosti — backend nemá běhové závislosti, stejně jako jádro aplikace.
 */
final class Argumenty
{
    /**
     * @param array<string, string> $volby
     */
    private function __construct(
        public readonly ?string $prikaz,
        private readonly array $volby,
    ) {
    }

    /**
     * @param list<string> $argv Argumenty bez jména skriptu.
     * @param list<string> $povolene Jména voleb, které příkaz zná.
     */
    public static function rozeber(array $argv, array $povolene): self
    {
        $prikaz = null;
        $volby = [];
        for ($i = 0; $i < count($argv); $i++) {
            $arg = $argv[$i];
            if (!str_starts_with($arg, '--')) {
                if ($prikaz !== null) {
                    throw new ChybaArgumentu("Nečekaný argument „{$arg}“.");
                }
                $prikaz = $arg;
                continue;
            }
            $telo = substr($arg, 2);
            if (str_contains($telo, '=')) {
                [$klic, $hodnota] = explode('=', $telo, 2);
            } else {
                $klic = $telo;
                $hodnota = $argv[$i + 1] ?? null;
                if ($hodnota === null || str_starts_with($hodnota, '--')) {
                    throw new ChybaArgumentu("Volba --{$klic} potřebuje hodnotu.");
                }
                $i++;
            }
            if (!in_array($klic, $povolene, true)) {
                throw new ChybaArgumentu("Neznámá volba --{$klic}.");
            }
            $volby[$klic] = $hodnota;
        }
        return new self($prikaz, $volby);
    }

    public function volba(string $klic): ?string
    {
        return $this->volby[$klic] ?? null;
    }
}
