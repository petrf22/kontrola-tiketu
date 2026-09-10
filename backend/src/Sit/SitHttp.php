<?php

declare(strict_types=1);

namespace KontrolaTiketu\Sit;

/**
 * Skutečná síť.
 *
 * Sdílené hostingy mívají buď cURL, nebo `allow_url_fopen`, výjimečně jen jedno z nich —
 * proto obě cesty.
 *
 * Přesměrování se **nenásleduje**. Adresa listiny je kanonická; kdyby ji Allwyn přesunul,
 * má to backend ohlásit jako chybu, ne potichu stahovat odjinud.
 */
final class SitHttp implements Sit
{
    private const TIMEOUT_S = 30;

    public function get(string $url, array $hlavicky): Odpoved
    {
        return function_exists('curl_init') ? $this->curl($url, $hlavicky) : $this->stream($url, $hlavicky);
    }

    /** @param array<string, string> $hlavicky */
    private function curl(string $url, array $hlavicky): Odpoved
    {
        $spojeni = curl_init($url);
        if ($spojeni === false) {
            throw new ChybaStahovani("cURL nejde inicializovat pro {$url}.");
        }
        curl_setopt_array($spojeni, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => self::TIMEOUT_S,
            CURLOPT_TIMEOUT => self::TIMEOUT_S,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => self::hlavicky($hlavicky),
        ]);
        $telo = curl_exec($spojeni);
        if (!is_string($telo)) {
            $chyba = curl_error($spojeni);
            throw new ChybaStahovani("{$url} se nepodařilo stáhnout: {$chyba}");
        }
        return new Odpoved((int) curl_getinfo($spojeni, CURLINFO_RESPONSE_CODE), $telo);
    }

    /** @param array<string, string> $hlavicky */
    private function stream(string $url, array $hlavicky): Odpoved
    {
        $kontext = stream_context_create(['http' => [
            'method' => 'GET',
            'header' => implode("\r\n", self::hlavicky($hlavicky)),
            'follow_location' => 0,
            'ignore_errors' => true,
            'timeout' => self::TIMEOUT_S,
        ]]);
        $telo = @file_get_contents($url, false, $kontext);
        if ($telo === false) {
            throw new ChybaStahovani("{$url} se nepodařilo stáhnout.");
        }
        /** @var list<string> $http_response_header Naplní ho file_get_contents. */
        $stav = preg_match('#^HTTP/\S+\s+(\d{3})#', $http_response_header[0] ?? '', $m) === 1 ? (int) $m[1] : 0;
        return new Odpoved($stav, $telo);
    }

    /**
     * @param array<string, string> $hlavicky
     * @return list<string>
     */
    private static function hlavicky(array $hlavicky): array
    {
        $radky = [];
        foreach ($hlavicky as $jmeno => $hodnota) {
            $radky[] = "{$jmeno}: {$hodnota}";
        }
        return $radky;
    }
}
