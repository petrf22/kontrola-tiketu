# Backend: hlídání losování a výsledky pro aplikaci

Runbook i zápis rozhodnutí. Stav k **11. 9. 2026**.

---

## Proč vůbec backend

Aplikace dřív dostávala výsledky jedině importem souboru, který se musel vyrobit fetcherem na
desktopu a ručně přenést do telefonu. Pro kontrolu dvakrát týdně je to nepoužitelné.
Zadání tuhle variantu předvídá (`zadani-kontrola-tiketu.md`, sekce Architektura): síťové
oprávnění je přípustné, pokud se **stahují vždy všechny tahy za období, nikdy dotaz vázaný na
konkrétní tiket.**

Backend proto:

- sám hlídá Allwyn a stahuje výherní listiny, jen když to dává smysl (viz Rozvrh),
- staví z nich **tentýž JSON**, jaký vyrábí fetcher,
- vystavuje ho jako statické soubory, které si aplikace stáhne celé.

Allwyn se o uživateli nedozví nic — mluví jen s backendem, a to o veřejných listinách.
Backend nedostane nic nad rámec toho, co vidí každý webový server (IP adresa a čas stažení).

---

## Rozhodnutí

### Za běhu žádné PHP

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

### Parser existuje dvakrát — a hlídá se to

Parser listiny je přepsaný z `fetcher/src/zdroje/allwyn-vyherka.ts` do PHP jedna k jedné,
protože sdílený hosting nemá Node. Aby se oba nerozešly:

1. PHPUnit čte **tytéž fixtury** jako fetcher (`fetcher/test/fixtures/`), backend žádnou kopii nemá.
2. `backend/tests/ShodaSFetcheremTest.php`: z fixtur vyjde **bajt po bajtu** tentýž soubor jako
   `app/test/fixtures/vysledky-2026-35-az-37.json`.
3. `test/backend.test.ts` (běží v `npm test`): oba parsery nad **celým archivem**
   (`fetcher/.cache`, 1994–2026) musí vyrobit bajtově stejný výstup. Bez PHP nebo bez archivu
   se přeskočí.

**Kdo opravuje parser, opravuje oba.** `npm test` rozejití zachytí.

Pasti při portu, na které se narazilo:

- `\s` v PCRE podle verze knihovny nemusí chytat nedělitelnou mezeru (U+00A0), v JS ano. Vzory
  ji proto píšou výslovně (`Regex::MEZERA`).
- `preg_match` při chybě enginu vrací `false`, které se v podmínce tváří jako „nenalezeno“.
  Všechna volání jdou přes `Regex`, který chybu vyhodí.
- Pořadí klíčů v poli určuje bajtovou shodu JSON — tahy se staví ve stejném pořadí jako v TS.
- Listina obsahuje `nonce` skriptu Akamai, který se mění při každém stažení. Změnu listiny proto
  **nejde poznat podle hashe surového HTML** — porovnávají se vyparsované tahy.

### Archiv ve formátu fetcheru

`var/archiv/<hra>-<rok>-<TT>.html.gz` — stejně jako `fetcher/.cache`. Server se naplní nahráním
archivu z desktopu místo dvou tisíc dotazů na Allwyn a archiv jde předávat oběma směry.

### SQLite

`var/stav.sqlite`: vyparsované tahy, kdy se která listina stahovala, běhy cronu a robots.txt.
Nepotřebuje server ani přihlašovací údaje, záloha je kopie souboru. Je odvozená z archivu —
dá se zahodit a znovu postavit příkazem `obnov`.

---

## API

Kořen `https://<doména>/v1/`. Jen `GET`, bez parametrů, bez cookies, bez autentizace.

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
- Balík je přesně `VystupniSoubor` z `fetcher/src/vystup.ts`; jde i ručně naimportovat.
- Balík je **deterministický**: `vygenerovano` v něm je čas poslední změny dat daného roku.
  Hash se tak mění jen se změnou dat a aplikace nestahuje zbytečně.
- Klient stahuje **všechny** balíky z manifestu (nezměněné přeskočí podle hashe) a po stažení
  ověří SHA-256 těla. Manifest se zapisuje až po balících, takže nikdy neodkazuje na soubor,
  který ještě neleží na disku.
- Jména balíků odpovídají `^[a-z0-9-]+\.json$`; klient jiná odmítne.

`public/.htaccess` pouští ven jen `v1/*.json` a `robots.txt` (`Disallow: /`), zakazuje výpis
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
cd backend && composer install
npm run backend:test          # PHPUnit
npm run backend:phpstan       # statická analýza, level max

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
   Nahrát `backend/` bez `tests/` (SFTP nebo rsync). Po nahrání vrátit vývojové závislosti
   (`composer install`).
3. **Lokální konfigurace** `config/konfigurace.lokalni.php`, jen pokud se liší cesty:
   ```php
   <?php
   return ['archiv' => '/home/ucet/data/archiv', 'databaze' => '/home/ucet/data/stav.sqlite'];
   ```
4. **Naplnění archivem** z desktopu — místo stahování z Allwynu:
   ```bash
   rsync -av fetcher/.cache/ ucet@hosting:backend/var/archiv/
   ssh ucet@hosting 'cd backend && php bin/vyherka obnov && php bin/vyherka plan'
   ```
5. **Cron** každou hodinu (minuta 5 dává Allwynu čas po celé hodině):
   ```
   5 * * * * cd ~/backend && php bin/vyherka tik >> var/tik.log 2>&1
   ```
   Když hosting pouští cron častěji, nevadí to (pojistka 55 minut).
6. **Kontrola po nasazení:**
   ```bash
   curl -sI https://vysledky.<doména>/v1/manifest.json   # 200, text/plain; charset=utf-8, no-cache, HSTS, bez Set-Cookie
   curl -sI https://vysledky.<doména>/                   # 403
   curl -sI https://vysledky.<doména>/v1/.htaccess       # 403
   ```
7. **Access log.** Jediné místo, kde vzniká stopa (IP a čas stažení, nic víc). Když to panel
   umožní, vypnout ho nebo zkrátit uchovávání.

### Záloha

`var/` (archiv a databáze) patří do zálohy stejně jako `fetcher/.cache`. Databáze se dá z archivu
kdykoliv postavit znovu (`obnov`), archiv ne — bez něj by se muselo znovu stahovat.

### Sazby Extra 6

Na hosting jde jen `backend/`, proto má backend kopii `data/sazby-extra6.json` v
`config/sazby-extra6.json`. Zdrojem pravdy zůstává `data/`; že kopie sedí, hlídá
`tests/SazbyTest.php`. Po změně sazeb: zkopírovat, nasadit, `php bin/vyherka publikuj`.

---

## Otevřené body

- **Doména backendu** je natvrdo v aplikaci (adresa API i síťový allowlist). Změna domény
  znamená novou verzi aplikace.
- **Cron voláním URL.** Některé hostingy neumí cron z příkazové řádky. Pak by byl potřeba
  `public/cron.php` s tajným klíčem — jediný kus PHP za běhu. Řešit, až když to bude nutné.
- **Časy zveřejnění** — viz Rozvrh, změří se provozem.
