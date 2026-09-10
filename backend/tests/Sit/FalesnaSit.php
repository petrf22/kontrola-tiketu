<?php

declare(strict_types=1);

namespace KontrolaTiketu\Test\Sit;

use KontrolaTiketu\Sit\Odpoved;
use KontrolaTiketu\Sit\Sit;

/** Síť, která nikam nechodí: vrací připravené odpovědi a pamatuje si dotazy. */
final class FalesnaSit implements Sit
{
    /** @var list<array{url: string, hlavicky: array<string, string>}> */
    public array $dotazy = [];

    /** @param array<string, Odpoved> $odpovedi */
    public function __construct(public array $odpovedi = [])
    {
    }

    public function get(string $url, array $hlavicky): Odpoved
    {
        $this->dotazy[] = ['url' => $url, 'hlavicky' => $hlavicky];
        return $this->odpovedi[$url] ?? new Odpoved(404, '');
    }

    /** @return list<string> */
    public function adresy(): array
    {
        return array_column($this->dotazy, 'url');
    }
}
