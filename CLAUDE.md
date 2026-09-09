# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zdroj pravdy

**`zadani-kontrola-tiketu.md` je závazné zadání — přečti ho před jakoukoliv prací.** Tento soubor
je jen rychlá orientace; při rozporu platí zadání.

## Stav repozitáře

Hotový je **zdroj dat**, **vyhodnocovací jádro**, **fetcher**, **čtení tiketu** a **kostra
aplikace se čtyřmi obrazovkami**.

**Dvě věci ze zadání ale hotové nejsou a nesmí se na ně zapomenout:**

1. **Nic se neukládá.** Aplikace používá `UlozisteVPameti` — po zavření je pryč všechno.
   Zadání žádá SQLCipher s klíčem v Android Keystore. Rozhraní `Uloziste` na to čeká,
   obrazovky se měnit nebudou. Do té doby je aplikace jen ukázka.
2. **Kamera a OCR nejsou zapojené.** Logika je hotová a otestovaná v `packages/ocr`,
   ale pluginy `@capacitor-mlkit/*` nainstalované nejsou a obrazovka skenu neexistuje.
   Ověřit to půjde jen na zařízení.

```
packages/jadro/src/    model.ts, validace.ts, koncoveCislice.ts, slucovani.ts,
                       eurojackpot.ts, sportka.ts, sance.ts, extra6.ts, vyhodnoceni.ts
packages/ocr/src/      radky.ts (párování podle rámečků), cisla.ts, tiket.ts, carovyKod.ts
fetcher/src/           zdroje/allwyn-vyherka.ts (parser), zdroje/html.ts,
                       archiv.ts, robots.ts, stahovani.ts, obdobi.ts, vystup.ts, cli.ts, bin.ts
fetcher/test/fixtures/ skutečné listiny v .html.gz — regresní korpus parseru
app/src/app/data/      import.ts, uloziste.ts, stav.ts, tokeny.ts
app/src/app/obrazovky/ seznam.ts, novy-tiket.ts, detail.ts, import-vysledku.ts
app/android/           nativní projekt, zatvrzený manifest
data/sazby-extra6.json pevné částky Extra 6 (listina je nepublikuje)
docs/data-source.md    výstup fáze 0
```

Ověřené příkazy (npm workspace, Node 24):

```bash
npm install          # po instalaci je potřeba npm approve-scripts esbuild
npm test             # vitest, 318 testů (jádro, ocr, fetcher i soukromí aplikace)
npm run typecheck    # tsc --build, strict

npm run vyherka -- stav
npm run vyherka -- stahni --od 2026-35 --do 2026-37 [--hra sportka]
npm run vyherka -- preparsuj --out vysledky.json --sazby "$PWD/data/sazby-extra6.json"
```

Pozor: přes npm workspace běží CLI s cwd ve `fetcher/`, takže **relativní cesty v argumentech
míří tam**. Výchozí archiv je proti tomu odolný (odvozuje se od umístění zdrojáku), u vlastních
cest použij absolutní.

Jádro je čistá knihovna: bez UI, bez I/O, bez sítě, bez běhových závislostí. Hlídá to
`packages/jadro/test/bezIO.test.ts` — když do `src/` přidáš import z `node:`, `fetch`,
`document` nebo `@angular`, test spadne. To je záměr, ne překážka.

Fetcher má dva oddělené režimy: `stahni` je **jediné místo v projektu, které chodí na síť**,
`preparsuj` nesahá na síť vůbec. Když opravuješ parser, pracuj vždy proti archivu nebo fixturám —
nikdy nestahuj znovu to, co už je stažené.

Aplikace (Angular 22 + Capacitor 8, balík `app`):

```bash
cd app && npx ng serve                    # vývoj v prohlížeči
cd app && npx ng build                    # web do dist/
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd app && npx cap sync android
cd app/android && ./gradlew :app:assembleDebug
```

Knihovny `jadro` a `ocr` vidí aplikace přes `paths` v `app/tsconfig.json` jako vlastní zdrojáky,
takže není potřeba mezikrok se sestavením knihoven.

**Nesahej na `app/android/app/src/main/AndroidManifest.xml` bez rozmyslu.** Odstranění INTERNET
přes `tools:node="remove"`, `allowBackup="false"` a FLAG_SECURE v `MainActivity` jsou akceptační
kritéria ze zadání. Hlídá je `app/test/soukromi.test.ts`, který navíc kontroluje sestavené APK
přes `aapt2`, když existuje.

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
