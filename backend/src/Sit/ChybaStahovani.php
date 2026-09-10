<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

final class ChybaStahovani extends \RuntimeException
{
    public function __construct(string $zprava, public readonly ?int $stav = null)
    {
        parent::__construct($zprava);
    }
}
