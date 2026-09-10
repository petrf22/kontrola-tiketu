<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

final class Odpoved
{
    public function __construct(
        public readonly int $stav,
        public readonly string $telo,
    ) {
    }
}
