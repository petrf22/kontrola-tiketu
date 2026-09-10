<?php

declare(strict_types=1);

/*
 * Router pro vestavěný server PHP při vývoji:
 *
 *     php -S localhost:8080 -t public tools/vyvojovy-server.php
 *
 * Vestavěný server .htaccess nečte, takže tady se napodobí to podstatné: ven jen /v1/*.json
 * a robots.txt, JSON jako text/plain (viz docs/backend.md) a CORS pro aplikaci v prohlížeči.
 * Na hosting nepatří — tam to dělá public/.htaccess.
 */

$adresa = $_SERVER['REQUEST_URI'] ?? '/';
$cesta = parse_url(is_string($adresa) ? $adresa : '/', PHP_URL_PATH);
$cesta = is_string($cesta) ? $cesta : '/';

if ($cesta === '/robots.txt') {
    return false;
}
if (preg_match('#^/v1/[a-z0-9-]+\.json$#', $cesta) !== 1) {
    http_response_code(403);
    return true;
}

$soubor = __DIR__ . '/../public' . $cesta;
if (!is_file($soubor)) {
    http_response_code(404);
    return true;
}

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
readfile($soubor);
return true;
