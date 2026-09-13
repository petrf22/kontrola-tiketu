# Původ fixtur

Skutečné výherní listiny stažené z veřejné adresy Allwyn, uložené jako `.html.gz`.
Slouží jako regresní korpus parseru — díky nim se dá parser opravovat a měnit bez jediného
dotazu na síť.

| soubor | dotaz | co obsahuje |
|---|---|---|
| `eurojackpot-2026-37.html.gz` | `year=2026&week=37&game=eurojackpot` | jeden tah (úterý), týden ještě nedoběhl |
| `eurojackpot-2026-36.html.gz` | `year=2026&week=36&game=eurojackpot` | dva tahy (úterý, pátek) |
| `sportka-2026-36.html.gz` | `year=2026&week=36&game=sportka` | tři tahy (st, pá, ne) + Šance se sedmi pořadími |
| `sportka-2015-10.html.gz` | `year=2015&week=10&game=sportka` | starší éra: dva tahy (st, ne), Šance jen se šesti pořadími |
| `euromiliony-2026-37.html.gz` | `year=2026&week=37&game=euromiliony` | dva tahy (úterý, sobota), Eurošance, prázdná buňka Druhé šance |
| `euromiliony-2026-36.html.gz` | `year=2026&week=36&game=euromiliony` | dva tahy (úterý, sobota) |
| `prazdna.html.gz` | neplatná hra | prázdná listina, kterou Allwyn vrací s HTTP 200 |

Eurojackpot a Sportka staženy 9. 9. 2026, Euromiliony 13. 9. 2026 (`bin/vyherka stahni`).
Adresu a strukturu popisuje `docs/data-source.md`.

## Ukázkový balík

`vysledky-2026-35-az-37.json` je skutečný výstup z těchto listin, ne ručně psaný soubor:

```bash
php bin/vyherka preparsuj --archiv tests/fixtures --od 2026-35 --do 2026-37 \
  --out tests/fixtures/vysledky-2026-35-az-37.json
```

Vznikl ještě desktopovým fetcherem v TypeScriptu (9. 9. 2026), 13. 9. 2026 ho backend vyrobil
znovu ve formátu 2 s Euromiliony. Že ho vyrobí bajtově stejně, hlídá `VystupZFixturTest`. Tentýž soubor má mobilní aplikace jako ukázku balíku
v `mobil/test/fixtures/` — je to smlouva o formátu mezi oběma stranami.
