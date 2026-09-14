# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/), text je česky (konvence
repa, viz `CLAUDE.md`). Postup vydání popisuje [`mobil/docs/vydani.md`](mobil/docs/vydani.md).

Tenhle soubor a kořenový `VERSION` jsou **zdroj pravdy o verzi**. Čísla verzí v `package.json`,
`versionCode`/`versionName` v `mobil/android/app/build.gradle` i historie zobrazená v aplikaci
z nich vznikají přes `node nastroje/verze/sync.mjs` — needituj je ručně.

**Každá položka musí být na jednom řádku** — parser víceřádkové položky neumí a raději spadne,
než by je tiše uřízl. Dlouhý řádek je tu žádoucí kompromis za jednoduchost skriptu.

Suffix v závorce na konci položky říká, čeho se změna týká: `(aplikace)`, `(jádro)`,
`(backend)`, `(build)`; `(fetcher)` zůstává jen ve starých položkách. Do historie v aplikaci se
dostanou jen položky označené `aplikace` — uživatele mobilu nezajímá, co se změnilo na serveru
ani v sestavování. Vydání, ve kterém
pro uživatele nic není, se v aplikaci neukáže vůbec.

## [Nezveřejněno]

### Přidáno
- Rozsah kontroly tiketu: začátek jde posunout do minulosti a konec smazat, takže se tiket se stejnými čísly kontroluje zpětně i s každým dalším losováním; takový tiket nese štítek „virtuální“ (aplikace)
- Kontrolu bez konce jde v detailu tiketu ukončit k vybranému datu, znovu pustit nebo rozsah upravit; slosování bez výhry jsou u virtuálního tiketu sbalená (aplikace)
- Když se stejná sázka kontroluje dvěma tikety na stejná slosování, aplikace upozorní, že se výhry i vsazené částky započítají dvakrát (aplikace)
- Obrazovka Přehled s koláčovými grafy vsazeno × vyhráno — celkem a zvlášť pro Eurojackpot, Sportku a Euromiliony (aplikace)

## [0.2.1] – 2026-09-14

### Opraveno
- Ruční zadání tiketu už po otevření nehlásí chyby prázdného sloupce; chyba pole se ukáže až po jeho opuštění nebo po stisku „Zkontrolovat tiket“ a řekne, ve kterém sloupci je (aplikace)
- Čísla, která rozpoznávač z fotky slepí dohromady (třeba euročísla „0203“ nebo „03NT“), se rozdělí po dvojicích místo toho, aby se ztratila; jednociferné číslo se označí k ověření, protože na tiketu je vždy dvojice číslic (aplikace)
- Datum losování se z fotky přečte i s běžnými záměnami písmen za číslice a bere se z řádku SLOSOVÁNÍ, ne z jiného data na tiketu (aplikace)
- Když se datum z fotky nepřečte, formulář už nepředvyplní dnešek, ale upozorní na to — tiket by se jinak vyhodnotil proti jinému tahu (aplikace)

### Přidáno
- Ve formuláři po focení jde rozbalit, co rozpoznávač z fotky přečetl mimo sloupce; zůstává jen na obrazovce a nikam se neukládá (aplikace)

## [0.2.0] – 2026-09-13

### Přidáno
- Backend v PHP pro levný sdílený hosting: sám hlídá nová losování a vystavuje výsledky jako statické soubory, které si aplikace stáhne celé — bez jediné informace o tom, jaké tikety kdo drží (backend)
- Rozvrh dotazů na Allwyn: v den losování se backend ptá každou hodinu, jen dokud výsledek i s tabulkou výher nemá; v den bez losování neudělá jediný dotaz (backend)
- Parser výherní listiny přepsaný do PHP; backend je jediný zdroj výsledků a desktopový fetcher v TypeScriptu končí (backend)
- Výsledky losování se po otevření aplikace stáhnou samy a na obrazovce výsledků je tlačítko „Stáhnout výsledky“; import souboru zůstává jako záloha (aplikace)
- Aplikace stahuje vždy všechny výsledky, pro každého stejně — na server nejde žádné vsazené číslo, sériové číslo tiketu ani nic, podle čeho by se dalo poznat, kdo se ptá (aplikace)
- V patičce je vidět, kdy server naposledy kontroloval losování a jestli se u některé hry ještě čeká na tabulku výher (aplikace)
- Euromiliony: tiket jde vyfotit i zadat ručně (7 čísel z 35 a 1 z 5) a aplikace ho vyhodnotí včetně Eurošance proti tabulce výher konkrétního tahu (aplikace)
- Backend čte a publikuje Euromiliony včetně archivu listin od roku 2013 a pevných výher Eurošance; formát výsledků je ve verzi 2 (backend)
- Při zadání tiketu jde vybrat, na které dny losování platí — Sportka středa, pátek, neděle, Eurojackpot úterý, pátek, Euromiliony úterý, sobota; tiket jen na neděle se tak vyhodnotí proti nedělním tahům, ne proti všem po sobě (aplikace)

### Změněno
- Aplikace žádá o přístup k internetu, ale spojit se umí jedině se serverem výsledků — jinam systém šifrované spojení nepustí; Googlí vrstva pro odesílání záznamů z ML Kitu je z aplikace odstraněná (aplikace)
- Import výsledků ukládá jen nové tahy místo přepisu celého seznamu (aplikace)
- Výsledky hry, kterou aplikace nezná, se při stažení přeskočí a zbytek se načte — přidání další hry na serveru už aplikaci nerozbije (aplikace)
- Import souboru počítá s ročním balíkem ze serveru výsledků; hlášky už neodkazují na desktopový fetcher (aplikace)
- Repozitář rozdělený na tři nezávislé části — `backend/`, `mobil/` a `nastroje/` — bez sdíleného kódu a s vlastními testy (build)

### Opraveno
- Výhra v Šanci nebo v Extra 6 se popisuje česky („trojčíslí“) místo klíčem z modelu („pořadí trojcisli“) (aplikace)
- V seznamu tiketů je zase název hry vlevo a částka vpravo; mřížka je stavěla obráceně (aplikace)
- Počet sloupců se skloňuje — „1 sloupec“, „3 sloupce“, „5 sloupců“ (aplikace)

## [0.1.1] – 2026-09-10

### Opraveno
- Balíček AAB pro Google Play jde vůbec sestavit: rozdělení APK podle architektur se se sestavením bundlu nesnese a build na něm padal (build)

## [0.1.0] – 2026-09-09

### Přidáno
- Vyfocení tiketu: jedna fotka přečte čísla ve sloupcích, doplňkovou hru Extra 6 i sériové číslo z čárového kódu (aplikace)
- Sken samotného čárového kódu pro případ, že fotka kód nezachytí nebo snímek pořizovat nechceš (aplikace)
- Ruční zadání tiketu, když se ho nepodaří přečíst ani jedním způsobem (aplikace)
- Vyhodnocení Eurojackpotu a Sportky včetně doplňkových her Extra 6 a Šance (jádro)
- Výherní částky Eurojackpotu se berou z tabulky konkrétního tahu, protože jsou totalizátorové a nedají se spočítat dopředu (jádro)
- Seznam tiketů se souhrnem výhry a detail s rozpisem po sloupcích a jednotlivých losováních (aplikace)
- Bilance tiketu: kolik stál a kolik zatím vynesl (aplikace, jádro)
- Import výsledků losování ze souboru — aplikace si o ně sama nikam nechodí (aplikace)
- Obrazovka „O aplikaci“ s číslem verze, historií změn a přehledem toho, co aplikace o uživateli neví (aplikace)
- Šifrovaná databáze SQLCipher s klíčem v Android Keystore (aplikace)
- Aplikace nemá oprávnění k síti, takže se provozovatel loterie nemá jak dozvědět, že zrovna ty sázíš nebo jsi vyhrál (aplikace)
- Snímek pořízený pro rozpoznání textu žije jen v privátní cache, maže se i při chybě a do galerie se nedostane (aplikace)
- Číslo klubové karty, které je v čárovém kódu čitelné, se rovnou zahazuje — neukládá se ani nezobrazuje (aplikace)
- Fetcher: stahování veřejných výherních listin Allwyn za období a převod na JSON pro import do aplikace (fetcher)
- Výsledky losování za roky 2021 až 2026, celkem 1190 tahů, verzované přímo v repozitáři (fetcher)
