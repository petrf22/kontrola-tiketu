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

1. **Fetcher výsledků** — CLI nástroj na desktopu. Stáhne výsledky losování a tabulky výher
   hromadně za zadané období, bez ohledu na to, jaké tikety držíte. Výstupem je JSON soubor.
   Server se tak dozví jen to, že si někdo zobrazil veřejné výsledky.

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

Projekt je na začátku — probíhá průzkum zdroje dat, kód zatím neexistuje.
Zadání a postup jsou v [`zadani-kontrola-tiketu.md`](zadani-kontrola-tiketu.md).

## Co projekt nedělá

Nereverzuje oficiální aplikaci Allwyn ani její API, nepokouší se dešifrovat obsah čárového
kódu na tiketu a nesahá na endpointy za přihlášením. Pracuje se pouze s veřejně
publikovanými výsledky losování.
