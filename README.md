# kontrola-tiketu

Offline kontrola papírových tiketů Allwyn (Eurojackpot, Sportka, Euromiliony) na vlastním zařízení —
bez toho, aby se provozovatel dozvěděl, že sázíte nebo že jste vyhráli.

Aplikace pro Android ke stažení: **[petrf22.cz](https://petrf22.cz/)** (odkaz do Google Play a QR kód).

> [!WARNING]
> **Vyhodnocení je neoficiální a nezávazné.** Aplikace nenahrazuje kontrolu tiketu.
> Závazná je vždy kontrola na terminálu Allwyn. Výhru lze uplatnit pouze tam a pouze
> s platným papírovým tiketem ve stanovené lhůtě.

## Proč

Oficiální aplikace i webový formulář odesílají na server provozovatele buď sériové číslo
tiketu, nebo přímo vsazená čísla. Provozovatel tak ví, kdo kontroluje jaký tiket a s jakým
výsledkem. Tenhle projekt ten únik odstraňuje.

Ochrana soukromí je primární požadavek, ne doplněk — každé designové rozhodnutí se poměřuje
proti němu.

## Jak to funguje

Dvě části. Žádná z nich nikdy neposílá vsazená čísla ani nic, co by identifikovalo tiket:

1. **Backend** — PHP na levném sdíleném hostingu ([`backend/docs/backend.md`](backend/docs/backend.md)).
   Cronem hlídá veřejnou výherní listinu Allwyn, ale jen když to dává smysl: v den losování
   se ptá každou hodinu, dokud výsledky nemá, v den bez losování vůbec. Z listin staví
   soubory s výsledky a vystavuje je jako statické soubory. Allwyn se dozví jen to, že si
   někdo zobrazil veřejné výsledky.

2. **Mobilní aplikace** — Angular + Capacitor. Po otevření si od backendu stáhne **všechny**
   výsledky (pro každého stejně, bez parametrů a identifikátorů), čísla z tiketu rozpozná OCR
   přímo na zařízení a vyhodnocení proběhne lokálně. Spojit se umí jedině se serverem
   výsledků — jinam systém TLS spojení nepustí. Výsledky jdou naimportovat i souborem.

Dřív aplikace neměla oprávnění k síti vůbec a výsledky se nosily jen souborem z desktopového
fetcheru. Pro kontrolu
dvakrát týdně to bylo nepoužitelné, a zadání pro takový případ síť připouští s tvrdým
pravidlem: stahuje se vždy všechno, nikdy dotaz vázaný na konkrétní tiket.

## Soukromí

- žádná analytika, crash reporting ani telemetrie — ani ve vývojovém buildu
- nic se nedostane do cloudové zálohy (`allowBackup="false"`)
- obrazovky jsou chráněné proti screenshotům a náhledům v přepínači aplikací
- lokální databáze je šifrovaná, klíč je v Android Keystore
- čárový kód se čte ve streamu, snímek se nikam neukládá
- snímek pro rozpoznání čísel jde do privátní cache aplikace a hned se maže; do galerie se
  nedostane nikdy ([proč tahle výjimka](mobil/docs/ocr-a-carovy-kod.md))
- oprávnění jsou jen dvě: kamera a internet kvůli výsledkům
- síťový allowlist: TLS spojení projde jedině na server výsledků, takže ani knihovny třetích
  stran (ML Kit vtahuje Googlí vrstvu pro odesílání záznamů, ta je navíc odstraněná) nemají
  kam posílat
- na síť sahá jediný modul aplikace a ten o tiketech neví — hlídá to test
- číslo klubové karty, které je v čárovém kódu tiketu čitelné, se zahazuje

## Stav

**Verze 0.1.0** — hotové a ověřené na skutečném telefonu (Xiaomi 14T Pro, Android 16).
Historie změn je v [`CHANGELOG.md`](CHANGELOG.md), postup vydání
v [`mobil/docs/vydani.md`](mobil/docs/vydani.md).

Repozitář má tři nezávislé části, každá s vlastními testy:

```
backend/     PHP backend — jediný zdroj výsledků pro aplikaci
mobil/       mobilní aplikace, vyhodnocovací jádro a čtení tiketu
nastroje/    generátor verze, ikony a screenshoty pro Google Play
```

- **Zdroj dat** — [`backend/docs/data-source.md`](backend/docs/data-source.md). Výsledky se čtou
  z veřejné výherní listiny na `allwyn.cz`; jeden dotaz pokryje celý týden a archiv sahá do
  roku 1994.
- **Backend** — `backend`. PHP 8.2 bez běhových závislostí: rozvrh dotazů, archiv surových
  listin, parser, SQLite a publikace do statických souborů.
- **Vyhodnocovací jádro** — `mobil/knihovny/jadro`. Čistá knihovna bez UI, I/O a sítě. Umí
  Eurojackpot, Sportku i Euromiliony včetně Šance, Extra 6, Eurošance a Bonusu. Testy jedou
  proti reálným tahům z let 2015 a 2026 a ověřují se proti oficiálně publikované tabulce výher.
- **Čtení tiketu** — `mobil/knihovny/ocr`. Skládá rozpoznaný text na sloupce (páruje levou
  a pravou část řádku podle rámečků, snese nakloněný snímek) a čte sériové číslo z čárového
  kódu. Nezávisí na ML Kitu, takže jde otestovat bez zařízení.
- **Aplikace** — `mobil`. Angular + Capacitor. Seznam tiketů, sken čárového kódu, ruční zadání,
  stažení i import výsledků a detail vyhodnocení. Data drží šifrovaná databáze (SQLCipher,
  klíč v Android Keystore). Android projekt je zatvrzený podle požadavků na soukromí —
  sestavené APK má právě `CAMERA` a `INTERNET` se síťovým allowlistem, ověřeno testem.

```bash
cd mobil && npm install && npm test                    # aplikace, jádro, OCR
cd backend && composer install && composer test       # backend

# backend: stažení listin za období do archivu a převod na soubor pro import (bez sítě)
cd backend
php bin/vyherka stahni --od 2026-35 --do 2026-37
php bin/vyherka preparsuj --out vysledky.json --od 2026-35 --do 2026-37
```

Backend stahuje jeden dotaz na hru a týden, posílá poctivý User-Agent, drží dvousekundovou
prodlevu a respektuje `robots.txt` — právě kvůli němu se nepoužívá JSON API, které web sám
používá. Co je jednou v archivu, se znovu nestahuje.

### Co ještě chybí

Aby nevznikl mylný dojem, že je všechno vyzkoušené:

- **Šance u Sportky není ověřená na reálném tiketu.** Podoba Extra 6 u Eurojackpotu ověřená
  je, u Šance je vzor volnější a nikdo ho proti papíru neviděl. Proto je první verze `0.1.0`
  a míří na uzavřený test, ne rovnou do produkce.
- **Tiket Euromilionů není ověřený na papíře.** Server výsledků je publikuje od 13. 9. 2026.
- **Na Google Play je aplikace zatím ve veřejném testování**, ne v produkci — viz
  [`mobil/docs/vydani.md`](mobil/docs/vydani.md).
- **Stahování výsledků se ještě neověřovalo na telefonu.** Backend běží na
  `kontrolatiketu.petrf22.cz` (od 13. 9. 2026), ale síťový allowlist se na zařízení nezkoušel.
  Do té doby je jistý import souboru.

Zadání a postup jsou v [`zadani-kontrola-tiketu.md`](zadani-kontrola-tiketu.md).

## Co projekt nedělá

Nereverzuje oficiální aplikaci Allwyn ani její API, nepokouší se dešifrovat obsah čárového
kódu na tiketu a nesahá na endpointy za přihlášením. Pracuje se pouze s veřejně
publikovanými výsledky losování.
