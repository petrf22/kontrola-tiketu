# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zdroj pravdy

**`zadani-kontrola-tiketu.md` je závazné zadání — přečti ho před jakoukoliv prací.** Tento soubor
je jen rychlá orientace; při rozporu platí zadání.

## Stav repozitáře

Zatím bez kódu — pouze `README.md`, `.gitignore` a zadání. Projekt je ve **fázi 0** (průzkum
zdroje dat). Až vznikne kód, doplň sem skutečnou architekturu a ověřené příkazy.

Pozor: `.gitignore` je šablona pro Android Studio / Gradle a **neodpovídá zvolenému stacku** —
při scaffoldingu doplň `node_modules/`, `dist/`, `www/`, `.angular/`.

## Účel a hlavní omezení

Offline kontrola papírových tiketů Allwyn (Eurojackpot, Sportka) tak, aby se provozovatel
nedozvěděl, že konkrétní osoba sází nebo vyhrála. **Soukromí je primární požadavek** — každé
designové rozhodnutí se poměřuje proti němu, ne naopak.

Sekce „Tvrdé požadavky na soukromí" v zadání jsou akceptační kritéria, ne doporučení
(žádná telemetrie ani v dev buildu, `allowBackup="false"`, `FLAG_SECURE`, SQLCipher + Android
Keystore, snímky z kamery se neukládají, jediná permission `CAMERA`).

## Architektura

Dvě komponenty, které spolu **nekomunikují po síti**:

1. **Fetcher výsledků** — CLI na desktopu. Stahuje výsledky losování a tabulky výher hromadně
   za období, nezávisle na tom, jaké tikety uživatel drží. Výstup: JSON.
2. **Mobilní aplikace** — Angular + Capacitor, **bez `INTERNET` permission**. JSON se importuje
   souborem, OCR běží on-device (ML Kit), vyhodnocení je lokální.

Absence síťové permission v manifestu je ověřitelná záruka — je to funkce, ne opomenutí.
Nikdy nenavrhuj dotaz na server vázaný na konkrétní tiket nebo vsazená čísla.

**Stack: Angular + Capacitor**, ne nativní Kotlin (uživatel je Angular vývojář). Pluginy
`@capacitor-mlkit/barcode-scanning` a `@capacitor-mlkit/text-recognition`.

## Co je zjištěné — neověřuj znovu

Čárový kód tiketu je **PDF417** (ne QR). Struktura payloadu je popsaná v zadání. Podstatné:

- **Vsazená čísla v kódu čitelná nejsou** — jsou v šifrovaném bloku. Ověřeno.
- Kód slouží **pouze** jako zdroj lokálního ID tiketu (sériové číslo → deduplikace).
- Šifrovaný blok se **neláme**, oficiální aplikace se **nereverzuje**, za přihlášení se nechodí.
- Číslo klubové karty je v payloadu v plaintextu — **zahazuje se**, neukládá ani nezobrazuje.

## Pracovní postup

- **Před psaním kódu ve fázi 1 předlož datový model a počkej na potvrzení.**
- Commit po každé dokončené fázi, ne jeden velký na konec.
- Fáze 0 končí zápisem do `docs/data-source.md` — teprve pak kód.
- Výherní částky Eurojackpotu jsou totalizátorové: **nikdy natvrdo v kódu**, vždy z tabulky
  konkrétního tahu.
- Testy vyhodnocovacího jádra piš proti reálným historickým tahům a ověřuj proti oficiálně
  publikované tabulce výher.
- Fetcher: rozumný User-Agent, respektovat robots.txt, minimum dotazů.

## Konvence

Čeština všude — dokumentace, commit zprávy, komentáře v kódu i komunikace s uživatelem.

## Release

Uživatelský příkaz `/release-gitlab` je psaný pro GitLab, ale `origin` je GitHub
(`git@github.com:petrf22/kontrola-tiketu.git`). Před použitím ověř kroky, jinak použij `gh`.
