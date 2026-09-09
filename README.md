# kontrola-tiketu

Offline kontrola papírových tiketů Allwyn (Eurojackpot, Sportka) na vlastním zařízení —
bez toho, aby se provozovatel dozvěděl, že sázíte nebo že jste vyhráli.

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

Dvě oddělené komponenty, které spolu nekomunikují po síti:

1. **Fetcher výsledků** — CLI nástroj na desktopu. Čte veřejnou výherní listinu Allwyn
   a stáhne výsledky losování i tabulky výher hromadně za zadané období, bez ohledu na to, jaké
   tikety držíte. Výstupem je JSON soubor. Server se tak dozví jen to, že si někdo zobrazil
   veřejné výsledky — jeden dotaz na hru a týden, stejný pro kohokoliv.

2. **Mobilní aplikace** — Angular + Capacitor, **bez oprávnění k síti**. JSON s výsledky se
   načte importem souboru, čísla z tiketu se rozpoznají OCR přímo na zařízení a vyhodnocení
   proběhne lokálně.

Absence síťového oprávnění v manifestu je ověřitelná záruka, že aplikace nemůže nic vynést.

## Soukromí

- žádná analytika, crash reporting ani telemetrie — ani ve vývojovém buildu
- nic se nedostane do cloudové zálohy (`allowBackup="false"`)
- obrazovky jsou chráněné proti screenshotům a náhledům v přepínači aplikací
- lokální databáze je šifrovaná, klíč je v Android Keystore
- snímky z kamery se zpracovávají ve streamu a nikam se neukládají
- jediné oprávnění je přístup ke kameře
- číslo klubové karty, které je v čárovém kódu tiketu čitelné, se zahazuje

## Stav

**Hotový je průzkum zdroje dat a vyhodnocovací jádro.** Fetcher ani mobilní aplikace zatím
neexistují.

- **Zdroj dat** — [`docs/data-source.md`](docs/data-source.md). Výsledky se čtou z veřejné
  výherní listiny na `allwyn.cz`; jeden dotaz pokryje celý týden a archiv sahá do roku 1994.
- **Vyhodnocovací jádro** — `packages/jadro`. Čistá knihovna bez UI, I/O a sítě. Umí
  Eurojackpot i Sportku včetně Šance, Extra 6 a Bonusu. Testy jedou proti reálným tahům
  z let 2015 a 2026 a ověřují se proti oficiálně publikované tabulce výher.
- **Fetcher** — `fetcher`. CLI, které stáhne veřejné výherní listiny do lokálního archivu
  a převede je na JSON pro aplikaci.
- **Čtení tiketu** — `packages/ocr`. Skládá rozpoznaný text na sloupce (páruje levou a pravou
  část řádku podle rámečků, snese nakloněný snímek) a čte sériové číslo z čárového kódu.
  Nezávisí na ML Kitu, takže jde otestovat bez zařízení.
- **Aplikace** — `app`. Angular + Capacitor. Seznam tiketů, sken čárového kódu, ruční zadání,
  import výsledků a detail vyhodnocení. Data drží šifrovaná databáze (SQLCipher, klíč
  v Android Keystore). Android projekt je zatvrzený podle požadavků na soukromí — sestavené
  APK má jediné oprávnění `CAMERA`, ověřeno testem.

```bash
npm install
npm test

# stažení výsledků za období do archivu (jediné, co chodí na síť)
npm run vyherka -- stahni --od 2026-35 --do 2026-37

# převod archivu na JSON pro aplikaci (bez sítě)
npm run vyherka -- preparsuj --out vysledky.json --sazby "$PWD/data/sazby-extra6.json"
```

Fetcher stahuje jeden dotaz na hru a týden, posílá poctivý User-Agent, drží dvousekundovou
prodlevu a respektuje `robots.txt` — právě kvůli němu se nepoužívá JSON API, které web sám
používá. Co je jednou v archivu, se znovu nestahuje.

### Co ještě chybí

Aby nevznikl mylný dojem, že je aplikace hotová:

- **Sken kódu není ověřený na reálném tiketu.** Čtečka vrací payload jako řetězec, ne jako
  bajty, takže se sériové číslo hledá vzorem místo na pevném offsetu. Obrazovka ho proto
  jen předá do formuláře, kde ho zkontroluješ proti papíru.
- **Rozpoznávání čísel z tiketu (OCR) je zablokované.** Dostupný plugin ML Kitu vyžaduje
  snímek uložený na disk, což jde proti požadavku zpracovávat snímky jen ve streamu.
  Čísla se zatím opisují ručně. Sken čárového kódu zapojený je a sériové číslo z něj
  vyplní identifikátor tiketu. Podrobnosti a možnosti řešení jsou
  v [`docs/ocr-a-carovy-kod.md`](docs/ocr-a-carovy-kod.md).

Zadání a postup jsou v [`zadani-kontrola-tiketu.md`](zadani-kontrola-tiketu.md).

## Co projekt nedělá

Nereverzuje oficiální aplikaci Allwyn ani její API, nepokouší se dešifrovat obsah čárového
kódu na tiketu a nesahá na endpointy za přihlášením. Pracuje se pouze s veřejně
publikovanými výsledky losování.
