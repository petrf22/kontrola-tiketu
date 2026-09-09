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
| `prazdna.html.gz` | neplatná hra | prázdná listina, kterou Allwyn vrací s HTTP 200 |

Staženo 9. 9. 2026. Adresu a strukturu popisuje `docs/data-source.md`.
