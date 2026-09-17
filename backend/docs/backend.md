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
`eurojackpot` od `2015-01` a `euromiliony` od `2011-01` (~3100 dotazů po 2 s, necelé dvě hodiny).
Co v archivu je, se znovu nestahuje, takže přerušený běh stačí spustit znovu.

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
  "verzeFormatu": 2,
  "vygenerovano": "2026-09-08T20:05:00.000Z",
  "kontrola": {
    "posledniDotaz": "2026-09-08T20:05:00.000Z",
    "eurojackpot": { "posledniTah": "2026-09-08", "uplny": true },
    "sportka": { "posledniTah": "2026-09-06", "uplny": true },
    "euromiliony": { "posledniTah": "2026-09-08", "uplny": true }
  },
  "baliky": [
    { "soubor": "2026.json", "hash": "sha256:…", "od": "2026-01-02", "do": "2026-09-08", "tahu": 112 }
  ]
}
```

- `verzeFormatu` 2 (13. 9. 2026) přidala Euromiliony a `sazbyEurosance`. Aplikace do 0.1.1 zná
  jen verzi 1 a balík ve verzi 2 odmítne s výzvou k aktualizaci — backend a aplikaci s formátem 2
  je proto potřeba nasadit společně. Novější aplikace tah hry, kterou nezná, přeskočí, takže
  další hra už verzi formátu zvedat nemusí.
- Klíč `ceny` (ceník sázek, 16. 9. 2026) verzi formátu nezvedl: aplikace neznámé klíče balíku
  ignoruje (ověřeno až do 0.2.0) a novější aplikace si s balíkem bez `ceny` poradí.
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

`prvniDotaz` (Eurojackpot 22:00, Sportka 21:00, Euromiliony 21:00) je odhad. Nevadí to — v okně se backend ptá
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

Zjištěno diagnostikou (13. 9. 2026):

- PHP 8.5.10 (FPM) s `pdo_sqlite`, `zlib`, `mbstring` a `curl`. `allow_url_fopen` je vypnutý —
  nevadí, `SitHttp` používá cURL. Testy backendu procházejí i na 8.5
  (`docker run --rm -v "$PWD":/app -w /app php:8.5-cli vendor/bin/phpunit`).
- `max_execution_time` 120 s, `set_time_limit` funguje (spouštěč cronu si bere 300 s).
- `open_basedir` pouští celé `/www/petrf22.cz`. Docroot je `/www/petrf22.cz/kontrolatiketu.petrf22.cz`,
  takže sourozenecká složka s kódem je pro PHP dosažitelná.
- Zakázané jsou mimo jiné `exec`, `proc_open`, `symlink` a `readlink` — backend nic z toho nevolá.
- Hosting sám přidává `Cache-Control: max-age=2592000` a `Expires` o 30 dní. U JSON to
  `.htaccess` přebije (`no-cache`, `Header unset Expires`); ověřeno na hostingu.
- Kořen FTP je `/www/petrf22.cz`, hlavní web leží v `/petrf22.cz/`. Složka
  `kontrolatiketu-backend` tedy neodpovídá žádné doméně a web ji neservíruje (ověřeno: 404).
- **FTP server posílá neúplný řetěz certifikátů** vystavený na jméno stroje, ne na
  `ftp.petrf22.cz`. Ověření se kvůli tomu **nevypíná**: řetěz se doplní a jméno ověří zvlášť.
  Hosting certifikát mění i s vydavatelem: 13. 9. 2026 `vmm152.farma.gigaserver.cz` od Let's
  Encrypt (chyběl mezilehlý YR2), 16. 9. 2026 `wh54.farma.gigaserver.cz` od ZeroSSL (chybí
  mezilehlý „ZeroSSL RSA DV SSL CA 2“). Když ověření selže, podívat se, co server posílá
  (`openssl s_client … -showcerts`), a balík vyrobit znovu.

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

**FTPS s doplněným řetězem.** Jednou vyrobit balík autorit (mimo repozitář) a před každým
připojením ověřit certifikát i jméno, `lftp` pak smí vynechat jen kontrolu jména:

```bash
# mezilehlý certifikát podle „CA Issuers“ v certifikátu serveru (stav 16. 9. 2026)
curl -sS http://crt.sectigo.com/ZeroSSLRSADVSSLCA2.crt | openssl x509 -inform DER \
  | cat /etc/ssl/certs/ca-certificates.crt - > ~/.local/share/petrf22-ftp-ca.pem

echo QUIT | openssl s_client -connect ftp.petrf22.cz:21 -starttls ftp -brief -verify_return_error \
  -CAfile ~/.local/share/petrf22-ftp-ca.pem -verify_hostname wh54.farma.gigaserver.cz \
  2>&1 | grep -q 'Verification: OK' && echo certifikát v pořádku
```

Do skriptu pro `lftp -f` pak patří na začátek (přihlášení bere `lftp` z `~/.netrc`):

```
set ftp:ssl-force true
set ssl:ca-file ~/.local/share/petrf22-ftp-ca.pem
set ssl:check-hostname/ftp.petrf22.cz no
open ftp.petrf22.cz
```

Když Gigaserver certifikát opraví, `check-hostname` vrátit a ověření přes `openssl` zahodit.

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

**Aktualizace běžícího nasazení.** Server od nasazení žije vlastním životem: cron stahuje nové
listiny do archivu a zapisuje do databáze běhy a časy, kdy byl který tah poprvé úplný. Lokální
databázi proto **nikdy nenahrávat přes serverovou** — přišlo by se o to, co server mezitím
stáhl a naměřil. Postup z 13. 9. 2026:

1. Nahrávat hned po celé hodině, ať do dalšího běhu cronu zbývá dost času (běh trvá do minuty).
2. Stáhnout ze serveru `var/stav.sqlite` a listiny novější než minulé nasazení
   (`mirror --newer-than="…"`). HTML se mezi staženími liší v nonce Akamai, takže listiny
   porovnávat podle vyparsovaných tahů; ty, ve kterých má server víc, zkopírovat do lokálního
   archivu i s časem (`cp -p`).
3. Serverovou databázi dát do `var/`, `php bin/vyherka obnov` do ní doplní nové tahy a zachová
   ostatní záznamy; zároveň vyrobí `public/v1`.
4. `composer install --no-dev --optimize-autoloader` a nahrát v tomhle pořadí: kód (bez `var/`),
   `mirror -R --only-missing` archivu, databázi pod dočasným jménem a přejmenovat, nakonec
   `public/`. Nový kód musí být nahoře dřív než data, která starý kód nezná.
5. Ověřit hashe balíků proti manifestu a po dalším celé hodině stáhnout `var/tik.log`.

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

### Sazby Extra 6 a Eurošance

Listina pevné výhry doplňkových her nepublikuje. Částky z herního plánu drží
`config/sazby-extra6.json` (násobky sázky) a `config/sazby-eurosance.json` (přímo koruny —
násobky v plánu jsou zaokrouhlené) — jediný zdroj pravdy o sazbách. Backend je přibaluje ke
každému balíku jako `sazbyExtra6` a `sazbyEurosance`, aplikace je odtud dostává. Po změně sazeb:
upravit, nasadit, `php bin/vyherka publikuj`.

### Ceník sázek

`config/ceny.json` drží cenu sloupce a doplňkové hry (Šance, Extra 6, Eurošance) s datem
prvního slosování za tu cenu. Backend ho přibaluje ke každému balíku jako `ceny` a nevykládá ho.
Aplikace z něj počítá cenu tiketu: kontroluje jí přečtenou cenu, předvyplňuje ruční zadání
a u virtuálního tiketu bez ruční ceny počítá každé slosování za cenu platnou v jeho den.

Vklad na slosování = cena sloupce × počet sloupců + cena doplňkové hry, když je vsazená.
Předplatné je tento vklad krát počet slosování (herní plán, Sportka bod 14, EUROJACKPOT
bod 14, Euromiliony bod 10).

**Ceník se udržuje ručně.** Automaticky to nejde, viz `docs/data-source.md`, „Ceny sázek“.
Allwyn ceny mění zřídka (Sportka 2014 a 2024). Postup, když na `allwyn.cz/herni-plany`
přibude nový herní plán loterií:

```bash
curl -sO https://static.sazka.cz/kentico-media/sazka/media/content/herni-plany/<plán>.pdf
pdftotext -layout <plán>.pdf - | grep -E 'Sázky za jeden sloupec|jedné Sázky na jedno Slosování|Extra 6 činí|Sázky Eurošance činí'
```

Když se cena liší, přidat do `ceny.json` záznam s `platnostOd` = první slosování za novou cenu
(plán ho u změny pravidel uvádí v závěrečném bodu dané hry) a se zdrojem. Pak spustit
`composer test` (`CenyTest` hlídá i shodu se `sazkaKc` v sazbách), nasadit a spustit
`php bin/vyherka publikuj`.

Stav 16. 9. 2026 (dohledáno v plánech 2012–2015 a 2019 přes Wayback Machine a 2024–2026
z archivu Allwynu):

| Hra | Od slosování | Sloupec | Doplňková hra |
|---|---|---|---|
| Sportka | 2012-05-23 (nejstarší plán) | 16 Kč | Šance 10 Kč |
| Sportka | 2014-05-21 | 20 Kč | Šance 20 Kč |
| Sportka | 2024-10-02 | 30 Kč | Šance 30 Kč |
| Eurojackpot | 2014-10-10 (start v ČR) | 60 Kč | Extra 6 40 Kč |
| Euromiliony | 2012-05-23 (nejstarší plán) | 30 Kč | — |
| Euromiliony | 2013-06-16 | 30 Kč | Eurošance 30 Kč |

Starší ceny (podle zpráv Sportka 10 Kč v roce 1995, 12 Kč v roce 1999, 14 Kč v roce 2003) nejsou
doložené herním plánem ani přesným datem, a proto v ceníku nejsou. Aplikace je bere jako neznámé.

---

## Otevřené body

- **Nasazeno 13. 9. 2026** na `kontrolatiketu.petrf22.cz`: archiv 2317 listin (Sportka 1994–2026,
  Eurojackpot 2015–2026), databáze a publikace postavené lokálně příkazem `obnov`. Ruční zavolání
  spouštěče cronu vrátilo `ok` a zapsalo `var/tik.log`. Cron v administraci zadává uživatel —
  po prvním losování ověřit v logu a v `kontrola.posledniDotaz`, že opravdu běží každou hodinu.

- **Euromiliony nasazeny 13. 9. 2026 ve 23:15** (spolu s vydáním aplikace 0.2.0): kód, sazby
  Eurošance, 819 listin `euromiliony-*` a databáze sloučená se serverovou podle postupu
  „Aktualizace běžícího nasazení“. Server od té doby publikuje `verzeFormatu` 2 — aplikace
  do 0.1.1 ze serveru nestáhne nic. Serverová `konfigurace.lokalni.php` přepisuje jen `verejne`,
  rozvrh Euromilionů se tedy bere z výchozí konfigurace.

- **Ceník sázek nasazen 17. 9. 2026 v 5:16** (commit `1baf154`). Změna se týkala jen výstupu,
  takže databáze se nenahrávala: server byl přesně na `ce7d1ca`, nahrálo se 7 souborů `src/`
  a `config/` (`vendor/` beze změny) a `public/v1` vyrobený novým kódem ze stažené serverové
  databáze (`publikuj` ji nezměnil). Každý balík se od serverového lišil jen přidaným klíčem
  `ceny`, balíky šly pod dočasným jménem s přejmenováním a manifest poslední. Po HTTPS sedí
  hashe všech šesti balíků. Zbývá: po nejbližším běhu cronu zkontrolovat `var/tik.log`.

- **Doména backendu** (`kontrolatiketu.petrf22.cz`) je natvrdo v aplikaci (adresa API i síťový
  allowlist). Změna domény znamená novou verzi aplikace.
- **Časy zveřejnění** — viz Rozvrh, změří se provozem.
