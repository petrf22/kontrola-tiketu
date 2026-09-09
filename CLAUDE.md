# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zdroj pravdy

**`zadani-kontrola-tiketu.md` je závazné zadání — přečti ho před jakoukoliv prací.** Tento soubor
je jen rychlá orientace; při rozporu platí zadání.

## Stav repozitáře

Fáze 0 a 1 hotové. Hotový je **zdroj dat** (`docs/data-source.md`) a **vyhodnocovací jádro**
(`packages/jadro`). Fetcher ani aplikace zatím neexistují.

```
packages/jadro/src/    model.ts, validace.ts, koncoveCislice.ts,
                       eurojackpot.ts, sportka.ts, sance.ts, extra6.ts, vyhodnoceni.ts
packages/jadro/test/   testy + fixtures/ s reálnými tahy z výherních listin
data/sazby-extra6.json pevné částky Extra 6 (listina je nepublikuje)
docs/data-source.md    výstup fáze 0
```

Ověřené příkazy (npm workspace, Node 24):

```bash
npm install          # po instalaci je potřeba npm approve-scripts esbuild
npm test             # vitest, 115 testů
npm run typecheck    # tsc --build, strict
```

Jádro je čistá knihovna: bez UI, bez I/O, bez sítě, bez běhových závislostí. Hlídá to
`packages/jadro/test/bezIO.test.ts` — když do `src/` přidáš import z `node:`, `fetch`,
`document` nebo `@angular`, test spadne. To je záměr, ne překážka.

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

- Commity průběžně a tematicky, ne jeden velký na konec.
- **Částky v testech nikdy nevymýšlej** — vždy je opiš z fixtury, tedy z výherní listiny.
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
