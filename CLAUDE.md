# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zdroj pravdy

**`zadani-kontrola-tiketu.md` je závazné zadání — přečti ho před jakoukoliv prací.** Tento soubor
je jen rychlá orientace; při rozporu platí zadání.

## Uspořádání repozitáře

Repozitář má tři nezávislé části. Každá má vlastní `CLAUDE.md` s podrobnostmi — přečti ho,
než v ní začneš pracovat.

```
backend/     PHP pro sdílený hosting — jediný zdroj výsledků pro aplikaci   → backend/CLAUDE.md
mobil/       Angular + Capacitor, jádro a OCR v mobil/knihovny/             → mobil/CLAUDE.md
nastroje/    podpůrné skripty: generátor verze, ikony, screenshoty (bez vlivu na chod)
VERSION, CHANGELOG.md, README.md, zadani-kontrola-tiketu.md, .claude/   společné
```

Pravidla uspořádání (13. 9. 2026):

- **Části na sobě nezávisí.** `mobil/` ani `backend/` nečtou, neimportují ani netestují nic
  mimo svůj adresář. Nástroje smějí sahat do obou (generátor verze, screenshoty), ale nic
  z aplikace ani backendu na nástrojích nezávisí.
- **Žádný duplicitní kód.** Parser listiny existuje jen v PHP, vyhodnocovací jádro jen v mobilu.
- **Jedinou smlouvou mezi backendem a mobilem je formát JSON** (`verzeFormatu`). Obě strany mají
  ve testech kopii téhož ukázkového balíku `vysledky-2026-35-az-37.json` — data, ne kód.
- **Testy patří do části, kterou testují:** PHPUnit v `backend/`, vitest v `mobil/`,
  `node:test` v `nastroje/`. V kořeni není `package.json` ani `node_modules`.

Desktopový fetcher v TypeScriptu byl 13. 9. 2026 smazán — backend umí `stahni` i `preparsuj`
sám. Ve starší historii gitu a v `CHANGELOG.md` se s ním ještě setkáš.

Ověřené příkazy:

```bash
cd backend && composer test && composer phpstan      # PHPUnit 93 testů, PHPStan level max
cd mobil && npm test && npm run typecheck            # vitest 421 testů, tsc strict
node --test 'nastroje/**/*.test.mjs'                 # generátor verze, 25 testů
node nastroje/verze/sync.mjs                         # přegeneruje verzi; musí projít bez změny souborů
```

## Stav

Hotové je **vyhodnocovací jádro**, **čtení tiketu**, **aplikace se šesti obrazovkami**
a **backend se stahováním výsledků do aplikace** (10.–11. 9. 2026).

**Euromiliony** (13. 9. 2026) jsou vydané ve verzi 0.2.0 a backend s nimi je nasazený, ale tiket
Euromilionů nikdo neviděl na papíře. Přinesly `verzeFormatu` 2 — aplikace do 0.1.1 ho odmítne,
takže ze serveru stahuje jen 0.2.0 a novější (`backend/docs/backend.md`, API).

**Verze 0.2.0 je v Google Play a běží na telefonu** (14. 9. 2026). Backend je nasazený na
`kontrolatiketu.petrf22.cz` (13. 9. 2026; Gigaserver, jen FTP — viz `backend/docs/backend.md`).
Na zařízení je ověřené stažení všech výsledků přes allowlist s prázdnými `<trust-anchors />`
i fotka a čárový kód bez odstraněného `datatransport`. Neověřené zůstává, že spojení na jinou
doménu selže — viz `mobil/docs/vydani.md`, „Co vydání ještě blokuje“.

## Účel a hlavní omezení

Offline kontrola papírových tiketů Allwyn (Eurojackpot, Sportka, od 13. 9. 2026 i Euromiliony) tak, aby se provozovatel
nedozvěděl, že konkrétní osoba sází nebo vyhrála. **Soukromí je primární požadavek** — každé
designové rozhodnutí se poměřuje proti němu, ne naopak.

Sekce „Tvrdé požadavky na soukromí" v zadání jsou akceptační kritéria, ne doporučení
(žádná telemetrie ani v dev buildu, `allowBackup="false"`, `FLAG_SECURE`, SQLCipher + Android
Keystore, snímky z kamery se neukládají). Kritérium „jediná permission `CAMERA`“ padlo
10. 9. 2026 s přechodem na stahování výsledků — viz Architektura.

## Architektura

1. **Backend** (`backend/`, PHP na sdíleném hostingu) — cronem hlídá výherní listinu podle
   rozvrhu, publikuje výsledky jako statické soubory (`manifest.json` + roční balíky). Za běhu
   žádné PHP kromě spouštěče cronu pod tajnou adresou (hosting umí cron jen voláním URL; tajné
   jméno do gitu nepatří). Je jediným zdrojem pravdy o výsledcích.
2. **Mobilní aplikace** (`mobil/`) — Angular + Capacitor. Stahuje od backendu **vždy všechny**
   balíky, pro všechny stejně (GET bez parametrů, bez cookies, pevný User-Agent). OCR běží
   on-device (ML Kit), vyhodnocení je lokální. Import souboru zůstává jako záloha.

Aplikace do 0.1.1 neměla `INTERNET` vůbec. Zadání síť připouští jen s tvrdým pravidlem, které
platí dál doslova: **nikdy nenavrhuj dotaz na server vázaný na konkrétní tiket nebo vsazená
čísla**, ani výběr balíků podle toho, co uživatel drží.

**Stack: Angular + Capacitor**, ne nativní Kotlin (uživatel je Angular vývojář).

## Pracovní postup

- Commity průběžně a tematicky, ne jeden velký na konec.
- **Částky v testech nikdy nevymýšlej** — vždy je opiš z fixtury, tedy z výherní listiny.
- Výherní částky Eurojackpotu jsou totalizátorové: **nikdy natvrdo v kódu**, vždy z tabulky
  konkrétního tahu.
- Testy vyhodnocovacího jádra piš proti reálným historickým tahům a ověřuj proti oficiálně
  publikované tabulce výher.
- Stahování z Allwynu: rozumný User-Agent, respektovat robots.txt, minimum dotazů. Co je
  v archivu listin, se znovu nestahuje.
- **Než cokoliv smažeš mimo git (archiv, databáze, `var/`), ověř, že to není symlink ani jediná
  kopie.** 13. 9. 2026 takhle zmizel archiv listin — `backend/var/archiv` byl symlink do
  smazaného adresáře a `diff -r` porovnal adresář sám se sebou.

## Konvence

Čeština všude — dokumentace, commit zprávy, komentáře v kódu i komunikace s uživatelem.

## Verze a vydání

**Zdroj pravdy o verzi je kořenový `VERSION` a `CHANGELOG.md`.** Čtyři soubory z nich generuje
`node nastroje/verze/sync.mjs` — `mobil/package.json`, `versionCode`/`versionName`
v `mobil/android/app/build.gradle`, `mobil/src/app/data/verze.generated.ts` pro obrazovku
„O aplikaci“ a `backend/src/Verze.php`. **Needituj je ručně**; že sedí se zdrojem, hlídá
`nastroje/verze/test/verze.test.mjs`.

`versionCode = major*10000 + minor*100 + patch`. Google Play už nikdy nepřijme nižší
versionCode, než naposledy nahraný — proto ten vzorec a proto skript padá při přetečení.

Vydání dělá projektový příkaz **`/vydat`**; celý postup a rozhodnutí kolem Play jsou
v `mobil/docs/vydani.md`. Globální `/release-gitlab` na tenhle projekt nesedí (hledá
`ClientApp/package.json` a `*.csproj`) — nepoužívej ho.
