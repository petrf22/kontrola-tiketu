# Backend: hlídání losování a výsledky pro aplikaci

Runbook i zápis rozhodnutí. Stav k **13. 9. 2026**.

---

## Proč vůbec backend

Aplikace dřív dostávala výsledky jedině importem souboru, který se musel vyrobit desktopovým
fetcherem a ručně přenést do telefonu. Pro kontrolu dvakrát týdně je to nepoužitelné.
Zadání tuhle variantu předvídá (`zadani-kontrola-tiketu.md`, sekce Architektura): síťové
oprávnění je přípustné, pokud se **stahují vždy všechny tahy za období, nikdy dotaz vázaný na
konkrétní tiket.**

Backend proto:

- sám hlídá Allwyn a stahuje výherní listiny, jen když to dává smysl (viz Rozvrh),
- staví z nich JSON s tahy a tabulkami výher (stejný formát, jaký jde do aplikace importovat),
- vystavuje ho jako statické soubory, které si aplikace stáhne celé.

Allwyn se o uživateli nedozví nic — mluví jen s backendem, a to o veřejných listinách.
Backend nedostane nic nad rámec toho, co vidí každý webový server (IP adresa a čas stažení).

---

## Rozhodnutí

### Za běhu žádné PHP (až na spouštěč cronu)

REST API tvoří **statické soubory** v `public/v1/`, které servíruje přímo Apache hostingu.
PHP běží jen v cronu. Důvody:

- nic neběží, takže není co zneužít ani co omylem zapsat do logu,
- odpověď je z principu stejná pro všechny — nemá kde vzniknout větev „tomuhle klientovi
  něco jiného“,
- statické soubory sdílený hosting zvládá nejlépe,
- když backend nepoběží, poslední publikovaná data dál leží na webu.

Kód v cronu je čisté PHP 8.2+ s Composerem a **bez běhových závislostí** (vývojové: PHPUnit
a PHPStan na nejvyšší úrovni). Kdyby jednou bylo potřeba API, které za běhu něco počítá,
nejlepší volba je **Slim 4**. Laravel, Symfony i Nette jsou na dva soubory JSON zbytečně těžké.

**Výjimka: cron voláním URL.** Gigaserver umí cron jen jako zavolání URL, a to bez parametrů
(12. 9. 2026). Z webu je proto dostupný jediný skript: `cron/<32 hex znaků>.php` v docrootu,
jednořádkový odkaz do `bin/cron.php` mimo docroot. Pravidla:

- **Jméno souboru je tajný klíč** (128 bitů náhody). Do gitu nepatří — existuje jen na serveru,
  `.gitignore` ho hlídá a `HtaccessTest` kontroluje, že jiné PHP ven nepustí.
- Spouštěč nic nepřijímá. Běh je přesně `bin/vyherka tik` včetně zámku, takže ani vyzrazené jméno
  nevede k více dotazům na Allwyn, než dovolí rozvrh (pojistka 55 minut, `maxDotazuNaBeh`).
- Odpověď je jen `ok` (200) nebo `chyba` (500), podrobnosti jdou do `var/tik.log`.
- S aplikací nemá nic společného — aplikace chodí jen na `v1/*.json`.

### Backend je jediný zdroj výsledků

Parser listiny vznikl jako port desktopového fetcheru v TypeScriptu (sdílený hosting nemá Node).
Po dobu souběhu testy hlídaly, že oba parsery vyrábějí nad celým archivem bajtově totéž.
13. 9. 2026 byl fetcher smazán a **parser existuje jen tady**. Pojistky dnes:

1. `tests/fixtures/` — skutečné listiny (viz `PUVOD.md`), regresní korpus parseru.
2. `tests/VystupZFixturTest.php`: z fixtur vyjde **bajt po bajtu** ukázkový balík
   `tests/fixtures/vysledky-2026-35-az-37.json`. Tentýž soubor má aplikace v `mobil/test/fixtures/`
   — je to smlouva o formátu. Kdo formát záměrně změní, zvedne `verzeFormatu` a vymění obě kopie.

Pasti při portu z JavaScriptu, na které se narazilo:

- `\s` v PCRE podle verze knihovny nemusí chytat nedělitelnou mezeru (U+00A0), v JS ano. Vzory
  ji proto píšou výslovně (`Regex::MEZERA`).
- `preg_match` při chybě enginu vrací `false`, které se v podmínce tváří jako „nenalezeno“.
  Všechna volání jdou přes `Regex`, který chybu vyhodí.
- Pořadí klíčů v poli určuje bajtovou shodu JSON — je součástí formátu, ne náhoda.
- Listina obsahuje `nonce` skriptu Akamai, který se mění při každém stažení. Změnu listiny proto
  **nejde poznat podle hashe surového HTML** — porovnávají se vyparsované tahy.

### Archiv listin

`var/archiv/<hra>-<rok>-<TT>.html.gz`, surové HTML každé listiny. Server se naplní nahráním
archivu z desktopu místo dvou tisíc dotazů na Allwyn a archiv jde předávat oběma směry.
Naplnění od nuly: `php bin/vyherka stahni --hra sportka --od 1994-01 --do <týden>` a totéž pro
`eurojackpot` od `2015-01` (~2300 dotazů po 2 s, asi hodina a půl). Co v archivu je, se
znovu nestahuje, takže přerušený běh stačí spustit znovu.

**`var/archiv` je skutečný adresář, ne symlink.** 13. 9. 2026 vedl symlinkem do adresáře fetcheru
a smazáním fetcheru archiv zmizel — musel se stáhnout znovu.

### SQLite

`var/stav.sqlite`: vyparsované tahy, kdy se která listina stahovala, běhy cronu a robots.txt.
Nepotřebuje server ani přihlašovací údaje, záloha je kopie souboru. Je odvozená z archivu —
dá se zahodit a znovu postavit příkazem `obnov`.

---

## API

Kořen `https://kontrolatiketu.petrf22.cz/v1/`. Jen `GET`, bez parametrů, bez cookies, bez autentizace.

| Cesta | Obsah |
|---|---|
| `manifest.json` | seznam balíků s hashi a stav poslední kontroly, < 2 kB |
| `RRRR.json` | tahy jednoho kalendářního roku, 0,6–0,9 MB (gzipem ~50 kB) |

```json
{
  "verzeManifestu": 1,
  "verzeFormatu": 1,
  "vygenerovano": "2026-09-08T20:05:00.000Z",
  "kontrola": {
    "posledniDotaz": "2026-09-08T20:05:00.000Z",
    "eurojackpot": { "posledniTah": "2026-09-08", "uplny": true },
    "sportka": { "posledniTah": "2026-09-06", "uplny": true }
  },
  "baliky": [
    { "soubor": "2026.json", "hash": "sha256:…", "od": "2026-01-02", "do": "2026-09-08", "tahu": 112 }
  ]
}
```

- `kontrola` odpovídá na otázku „proběhla už kontrola?“ — `uplny: false` znamená, že čísla
  jsou známá, ale Allwyn ještě nezveřejnil tabulku výher.
- Balík jde v aplikaci i ručně naimportovat jako soubor (záloha, když server není dostupný).
- Balík je **deterministický**: `vygenerovano` v něm je čas poslední změny dat daného roku.
  Hash se tak mění jen se změnou dat a aplikace nestahuje zbytečně.
- Klient stahuje **všechny** balíky z manifestu (nezměněné přeskočí podle hashe) a po stažení
  ověří SHA-256 těla. Manifest se zapisuje až po balících, takže nikdy neodkazuje na soubor,
  který ještě neleží na disku.
- Jména balíků odpovídají `^[a-z0-9-]+\.json$`; klient jiná odmítne.

`public/.htaccess` pouští ven jen `v1/*.json`, `robots.txt` (`Disallow: /`) a existující
`cron/<32 hex>.php` (viz Výjimka výše), zakazuje výpis
adresářů a soubory s tečkou na začátku (dočasné soubory publikace), posílá HSTS, `nosniff`,
`no-referrer`, `Cache-Control: no-cache` a u JSON `Access-Control-Allow-Origin: *`.

**Soubory `.json` jdou ven jako `text/plain; charset=utf-8`, ne `application/json`.** Capacitor
v aplikaci odpověď s JSON typem sám rozparsuje (na webu i na Androidu, bez ohledu na požadovaný
typ odpovědi) a Android navíc čte text po řádcích a zahodí koncový nový řádek. Aplikace by pak
nedostala bajty, ze kterých se ověřuje hash. S `text/plain` si vezme surové bajty. Kdyby hosting
typ přepisoval, aplikace to ohlásí hláškou o nečekaném typu obsahu.

---

## Rozvrh

Implementace `src/Rozvrh.php`, testy na kalendáři září 2026 v `tests/RozvrhTest.php`.

1. **Okno po losování.** V plánovaný den od `prvniDotaz` po `oknoHodin` hodin se týden stahuje
   každou hodinu, dokud tah není úplný (i s tabulkou výher, u Sportky i se Šancí).
2. **Denní dohánění.** Plánovaný tah z posledních 7 dní, který pořád není úplný, se zkusí jednou
   denně od `denniDohaneni`.
3. **Uzavření týdne.** Každý ze 4 posledních dokončených týdnů se jednou stáhne po svém konci
   (v pondělí od `denniDohaneni`). Tak se chytí losování mimo rozvrh — archiv obsahuje Sportku
   v úterý — a opravené listiny. Pak se týden z webu už nestahuje.
4. **Pojistky.** Týden se znovu stáhne nejdřív za 55 minut, takže nezáleží, jak často hosting
   cron pouští. Po třech neúspěšných bězích v řadě se hodinové okno vynechá (zbude jeden pokus
   denně). Nejvýš `maxDotazuNaBeh` dotazů na běh včetně robots.txt, který se čte nejvýš jednou
   za 24 hodin.

Jeden dotaz vrací celý týden jedné hry. V běžném týdnu tak backend udělá zhruba jeden až dva
dotazy na každé losování a dva v pondělí. **V den bez losování nevznikne žádný.**

Úplný tah se nikdy nepřepíše neúplným a plná listina v archivu se nepřepíše prázdnou.

### Časy zveřejnění zatím nejsou ověřené

`prvniDotaz` (Eurojackpot 22:00, Sportka 21:00) je odhad. Nevadí to — v okně se backend ptá
každou hodinu, dokud výsledek nemá. Databáze si ale u každého tahu zapisuje, **kdy byl poprvé
úplný**, a `bin/vyherka stav` to vypíše. Po pár týdnech provozu podle toho upravit
`config/konfigurace.lokalni.php`.

---

## Příkazy

```bash
php bin/vyherka tik                          # jeden běh z cronu
php bin/vyherka plan [--ted "2026-09-11 22:05"]   # co by tik stáhl — bez sítě, bez zápisu
php bin/vyherka obnov                        # databáze z archivu a publikace, bez sítě
php bin/vyherka publikuj                     # znovu vyrobí public/v1
php bin/vyherka stav                         # poslední tahy, běhy a časy zveřejnění
php bin/vyherka stahni --od 2026-01 --do 2026-37 [--hra sportka]
php bin/vyherka preparsuj --out vysledky.json [--od …] [--do …]
```

Návratové kódy: 0 v pořádku, 1 chyba, 2 špatné argumenty, 3 zákaz v robots.txt.
`tik`, `obnov` a `publikuj` drží zámek `var/tik.lock` — souběžný běh se vynechá.

Vývoj:

```bash
composer install
composer test                 # PHPUnit
composer phpstan              # statická analýza, level max

# lokální server se stejnými hlavičkami jako .htaccess (vestavěný server PHP .htaccess nečte)
php -S localhost:8080 -t public tools/vyvojovy-server.php
```

---

## Nasazení na sdílený hosting

Předpoklady: PHP 8.2+ s `pdo_sqlite`, `zlib`, `mbstring` a buď `curl`, nebo `allow_url_fopen`;
cron z příkazové řádky; subdoména s vlastním document rootem a HTTPS.

1. **Subdoména** (např. `vysledky.<doména>`), document root na `backend/public`, HTTPS
   z panelu (Let's Encrypt). Když hosting docroot přesměrovat nedovolí, musí `var/`, `src/`,
   `vendor/` a `config/` ležet mimo veřejný adresář a cesty se nastaví v lokální konfiguraci.
2. **Balík** lokálně:
   ```bash
   cd backend && composer install --no-dev --optimize-autoloader
   ```
   Nahrát `backend/` bez `tests/` a `docs/` (SFTP nebo rsync). Po nahrání vrátit vývojové závislosti
   (`composer install`).
3. **Lokální konfigurace** `config/konfigurace.lokalni.php`, jen pokud se liší cesty:
   ```php
   <?php
   return ['archiv' => '/home/ucet/data/archiv', 'databaze' => '/home/ucet/data/stav.sqlite'];
   ```
4. **Naplnění archivem** z desktopu — místo stahování z Allwynu:
   ```bash
   rsync -av var/archiv/ ucet@hosting:backend/var/archiv/
   ssh ucet@hosting 'cd backend && php bin/vyherka obnov && php bin/vyherka plan'
   ```
5. **Cron** každou hodinu (minuta 5 dává Allwynu čas po celé hodině):
   ```
   5 * * * * cd ~/backend && php bin/vyherka tik >> var/tik.log 2>&1
   ```
   Když hosting pouští cron častěji, nevadí to (pojistka 55 minut).
6. **Kontrola po nasazení:**
   ```bash
   curl -sI https://kontrolatiketu.petrf22.cz/v1/manifest.json   # 200, text/plain; charset=utf-8, no-cache, HSTS, bez Set-Cookie
   curl -sI https://kontrolatiketu.petrf22.cz/                   # 403
   curl -sI https://kontrolatiketu.petrf22.cz/v1/.htaccess       # 403
   ```
7. **Access log.** Jediné místo, kde vzniká stopa (IP a čas stažení, nic víc). Když to panel
   umožní, vypnout ho nebo zkrátit uchovávání.

### Gigaserver (jen FTP)

Ostrý backend běží na **`kontrolatiketu.petrf22.cz`** u Gigaserveru. Hosting se od obecného
postupu výše liší ve třech věcech:

- **Subdoména je složka** `kontrolatiketu.petrf22.cz` v kořeni FTP a ta je rovnou document
  rootem — přesměrovat ho na `backend/public` nejde.
- **Není SSH.** Neprojde `rsync`, `ssh … obnov` ani cron jako příkazová řádka.
- **Cron** se zadává v administraci (sekce „Ostatní“) jako URL bez parametrů a schvaluje ho
  technik.

Rozložení na FTP — kód leží vedle docrootu, ne v něm:

```
/kontrolatiketu.petrf22.cz/      ← obsah backend/public (.htaccess, robots.txt, v1/) + cron/<tajné>.php
/kontrolatiketu-backend/         ← bin, src, config, vendor (--no-dev), var
```

`config/konfigurace.lokalni.php` (mimo git) přesměruje jen veřejný adresář:

```php
<?php
return ['verejne' => dirname(__DIR__, 2) . '/kontrolatiketu.petrf22.cz/v1'];
```

Databáze a publikace se bez SSH na serveru nestaví — vyrobí se lokálně a nahrají hotové:

```bash
cd backend && composer install --no-dev --optimize-autoloader
php bin/vyherka obnov                  # var/stav.sqlite a public/v1 z archivu
# FTPS
lftp -u <ucet> <ftp-server> -e '   # údaje z administrace Gigaserveru
  set ftp:ssl-force true;
  mirror -R --exclude-glob .phpunit* public/ /kontrolatiketu.petrf22.cz/;
  mirror -R --exclude tests/ --exclude docs/ --exclude-glob tik.lock --exclude-glob "*.log" \
    --exclude-glob "*.zaloha-*" --exclude public/ --exclude tools/ ./ /kontrolatiketu-backend/;
  bye'
composer install                       # vrátit vývojové závislosti
```

Heslo k FTP do repozitáře nepatří — `lftp` si ho vyžádá, nebo ho vezme z `~/.netrc`.
Kontrola po nasazení je stejná jako v bodě 6 výše. **`mirror` do docrootu nikdy s `--delete`** —
smazal by spouštěč cronu, který v `backend/public` není.

**Cron.** Spouštěč s tajným jménem se vyrobí jednou a nahraje jen na server:

```bash
jmeno=$(openssl rand -hex 16)
mkdir -p ~/kontrolatiketu-cron/cron
printf '<?php require __DIR__ . %s;\n' "'/../../kontrolatiketu-backend/bin/cron.php'" \
  > ~/kontrolatiketu-cron/cron/$jmeno.php
echo "https://kontrolatiketu.petrf22.cz/cron/$jmeno.php"   # tuhle URL zadat do cronu, každou hodinu
lftp -u <ucet> <ftp-server> -e 'set ftp:ssl-force true; mirror -R ~/kontrolatiketu-cron/ /kontrolatiketu.petrf22.cz/; bye'
```

Adresu si uschovat mimo repozitář (správce hesel). Když unikne, vyrobit nové jméno, starý soubor
smazat a cron přenastavit. Po prvních bězích stáhnout `var/tik.log` a v manifestu zkontrolovat
`kontrola.posledniDotaz`.

### Záloha

`var/` (archiv a databáze) patří do domácí zálohy — v gitu není. Databáze se dá z archivu
kdykoliv postavit znovu (`obnov`), archiv ne — bez něj by se muselo znovu stahovat.

### Sazby Extra 6

Listina sazby Extra 6 nepublikuje, pevné částky z herního plánu drží `config/sazby-extra6.json`
— jediný zdroj pravdy o sazbách. Backend je přibaluje ke každému balíku, aplikace je odtud
dostává. Po změně sazeb: upravit, nasadit, `php bin/vyherka publikuj`.

---

## Otevřené body

- **Doména backendu** (`kontrolatiketu.petrf22.cz`) je natvrdo v aplikaci (adresa API i síťový
  allowlist). Změna domény znamená novou verzi aplikace.
- **Časy zveřejnění** — viz Rozvrh, změří se provozem.
