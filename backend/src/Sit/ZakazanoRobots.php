<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

final class ZakazanoRobots extends \RuntimeException
{
    public function __construct(public readonly string $cesta)
    {
        parent::__construct(
            "robots.txt zakazuje cestu {$cesta}. Backend končí — zadání respektování robots.txt ukládá jako tvrdé pravidlo.",
        );
    }
}
