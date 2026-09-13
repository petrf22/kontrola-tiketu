# CLAUDE.md — backend

PHP 8.2+ pro sdílený hosting, bez běhových závislostí. **Jediný zdroj výsledků pro aplikaci**:
cronem hlídá výherní listinu Allwyn, archivuje surové HTML, parsuje tahy do SQLite a publikuje
statické soubory `public/v1/manifest.json` + roční balíky. Samostatný — nečte ani netestuje nic
mimo `backend/`. Společná pravidla repozitáře jsou v kořenovém `CLAUDE.md`.

Rozhodnutí, API, rozvrh a nasazení (Gigaserver, jen FTP): `docs/backend.md`.
Zdroj dat a jeho pasti: `docs/data-source.md`.

## Ověřené příkazy

```bash
composer install
composer test        # PHPUnit, 86 testů
composer phpstan     # statická analýza, level max

php bin/vyherka stav
php bin/vyherka plan [--ted "2026-09-11 22:05"]          # co by tik stáhl, bez sítě
php bin/vyherka stahni --od 2026-35 --do 2026-37 [--hra sportka]
php bin/vyherka preparsuj --out vysledky.json [--od …] [--do …]   # soubor pro ruční import
php bin/vyherka obnov                                    # databáze a publikace z archivu, bez sítě

php -S localhost:8080 -t public tools/vyvojovy-server.php   # lokální server s hlavičkami jako .htaccess
```

`stahni` chodí na síť, `preparsuj`, `obnov` a `plan` nesahají na síť vůbec. Když opravuješ
parser, pracuj vždy proti archivu nebo fixturám — nikdy nestahuj znovu to, co už je stažené.

## Struktura

```
src/Zdroj/             AllwynVyherka.php (parser listiny), Html.php
src/                   Rozvrh.php, Tik.php, Archiv.php, Publikace.php, Vystup.php, Json.php, Model.php
src/Cli/               Cli.php (bin/vyherka), Cron.php (spouštěč cronu voláním URL)
config/                konfigurace.php, sazby-extra6.json (pevné částky Extra 6 — listina je nepublikuje)
public/                document root: .htaccess, robots.txt, v1/ (generované, mimo git)
var/                   archiv/ (surové listiny), stav.sqlite — mimo git, patří do zálohy
tests/fixtures/        skutečné listiny v .html.gz + ukázkový balík — regresní korpus parseru
```

## Na co pozor

- **Ukázkový balík `tests/fixtures/vysledky-2026-35-az-37.json` je smlouva s aplikací.**
  `VystupZFixturTest` hlídá, že z fixtur vyjde bajt po bajtu. Aplikace má jeho kopii
  v `mobil/test/fixtures/`. Záměrná změna formátu = zvednout `Model::VERZE_FORMATU` a vyměnit
  obě kopie.
- **Pořadí klíčů v tazích je součást formátu** — na bajtech stojí hash, podle kterého aplikace
  pozná změnu balíku.
- **Starší listiny nemusí mít tabulku výher.** Místo ní stojí „Probíhá zpracování výsledků“ —
  v archivu je takových tahů 32, převážně z roku 2016. Parser je přečte s prázdnou tabulkou,
  ale jen když to listina sama říká; `preparsuj` navíc vadnou listinu přeskočí místo aby skončil.
- **`var/archiv` je nenahraditelný bez dvou tisíc dotazů na Allwyn.** Nesmí to být symlink
  a nikdy ho nemaž. 13. 9. 2026 se musel stahovat znovu.
- **Žádné PHP za běhu** kromě spouštěče cronu pod tajným jménem v `public/cron/` — tajné jméno
  do gitu nepatří, hlídá to `HtaccessTest`.
- **JSON jde ven jako `text/plain`**, ne `application/json` — jinak by Capacitor v aplikaci
  odpověď rozparsoval a aplikace by neověřila hash. Viz `docs/backend.md`, API.
- Pravidla ze zadání pro Allwyn: poctivý User-Agent, respektovat robots.txt (zákaz = konec
  s kódem 3, ne obejít), prodleva 2 s, minimum dotazů.
- Výherní částky Eurojackpotu jsou totalizátorové: **nikdy natvrdo v kódu**, vždy z listiny.
