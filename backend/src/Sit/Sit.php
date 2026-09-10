<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

/** Vrstva sítě je vyměnitelná, aby testy nemusely nikam chodit. */
interface Sit
{
    /** @param array<string, string> $hlavicky */
    public function get(string $url, array $hlavicky): Odpoved;
}
