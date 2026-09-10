# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zdroj pravdy

**`zadani-kontrola-tiketu.md` je závazné zadání — přečti ho před jakoukoliv prací.** Tento soubor
je jen rychlá orientace; při rozporu platí zadání.

## Stav repozitáře

Hotový je **zdroj dat**, **vyhodnocovací jádro**, **fetcher**, **čtení tiketu** a **kostra
aplikace se šesti obrazovkami**.

**Ověřené na skutečném telefonu** (Xiaomi 14T Pro, Android 16, 9. 9. 2026):

- instalace release buildu s R8, jediné oprávnění `CAMERA`,
- otevření šifrované databáze (`Database keying operation returned:0`),
- **jedna fotka** dá šest sloupců, euročísla, `Extra 6`, cenu i sériové číslo z čárového kódu,
- sériové číslo sedí na to vytištěné na tiketu,
- import výsledků a vyhodnocení proti reálným tahům,
- dočasný snímek žije půl sekundy a maže se i při chybě.

Na telefonu běží **release build s R8** — ladicí přeposílá konzoli do logcatu a plugin čtečky
tam loguje celý obsah kódu včetně čísla klubové karty.

Snímání je sjednocené: **jedna fotka dá čísla, `Extra 6` i sériové číslo z kódu**
(`readBarcodesFromImage` vrací tentýž typ `Barcode` včetně `bytes`). Obrazovka „Jen kód“
zůstává pro případ, že fotka kód nezachytí nebo uživatel nechce pořizovat snímek vůbec.

Podoba doplňkové hry na tiketu Eurojackpotu: `Extra 6: 845991`, cena `400 Kč`. Podoba Šance
u Sportky ověřená není — vzor je proto volnější.

**Pozor u čtení částek:** skládání řádků podle rámečků může cenu spojit s okolím, takže se
nesmí kotvit na konec řádku. Zároveň částka nesmí začít uprostřed jiného čísla — jinak
z `07.09.2026 400 Kč` vyjde 2 026 400.

**Starší listiny nemusí mít tabulku výher.** Místo ní stojí „Probíhá zpracování výsledků“ —
v archivu je takových tahů 32, převážně z roku 2016. Parser je přečte s prázdnou tabulkou,
ale jen když to listina sama říká; `preparsuj` navíc vadnou listinu přeskočí místo aby skončil.

**Instalace přes `adb install` na Xiaomi** projde jen u ladicího buildu; release blokuje
HyperOS (`INSTALL_FAILED_USER_RESTRICTED`) a je nutné ho otevřít ve správci souborů. Play
Protect navíc u velkých APK vypršel — proto jsou APK rozdělené podle architektur
(arm64-v8a ~25 MB).

**Ladicí build přeposílá konzoli do logcatu**, a plugin čtečky si tam loguje celý obsah
načteného kódu včetně čísla klubové karty. V release buildu je to vypnuté. Na ostrý provoz
používej release.

**Věci, na které se nesmí zapomenout:**

1. **Sken kódu je ověřený na reálném tiketu** (9. 9. 2026). Čtečka vrací `rawValue` jako
   `undefined`, ale `bytes` dodá — a ty na offsety ze zadání sedí přesně. Bajty jsou
   znaménkové, takže se musí maskovat `& 0xff`.
2. **Snímek pro OCR se ukládá do privátní cache** — vědomá odchylka od zadání, odsouhlasená
   9. 9. 2026. Podmínkou je, že vždycky zmizí a nikdy neskončí v galerii. **Nesahej na
   `snimekTiketu.ts` tak, abys porušil `finally`**; ta záruka je celý důvod, proč je ten
   postup oddělený od napojení na pluginy. Viz `docs/ocr-a-carovy-kod.md`.

```
packages/jadro/src/    model.ts, validace.ts, koncoveCislice.ts, slucovani.ts,
                       eurojackpot.ts, sportka.ts, sance.ts, extra6.ts, vyhodnoceni.ts
packages/ocr/src/      radky.ts (párování podle rámečků), cisla.ts, tiket.ts, carovyKod.ts
fetcher/src/           zdroje/allwyn-vyherka.ts (parser), zdroje/html.ts,
                       archiv.ts, robots.ts, stahovani.ts, obdobi.ts, vystup.ts, cli.ts, bin.ts
fetcher/test/fixtures/ skutečné listiny v .html.gz — regresní korpus parseru
app/src/app/data/      import.ts, uloziste.ts, stav.ts, tokeny.ts
app/src/app/obrazovky/ seznam.ts, novy-tiket.ts, sken.ts, sken-cisel.ts, detail.ts,
                       import-vysledku.ts, o-aplikaci.ts
app/android/           nativní projekt, zatvrzený manifest
data/sazby-extra6.json pevné částky Extra 6 (listina je nepublikuje)
data/vysledky.json     výsledky k importu, verzované v gitu (teď 2021–2026, 1190 tahů)
docs/data-source.md    výstup fáze 0
docs/vydani.md         podpis, Google Play, postup vydání — runbook i zápis rozhodnutí
tools/verze/sync.mjs   generátor verze z VERSION + CHANGELOG.md
tools/ikony/generuj.py generátor ikony, splashe a grafiky pro Play
```

Ověřené příkazy (npm workspace, Node 24):

```bash
npm install          # po instalaci je potřeba npm approve-scripts esbuild
npm test             # vitest, 427 testů (jádro, ocr, fetcher, soukromí aplikace i verze)
npm run typecheck    # tsc --build, strict
npm run verze        # přegeneruje verzi ze zdroje; musí projít bez změny souborů

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

## Verze a vydání

**Zdroj pravdy o verzi je kořenový `VERSION` a `CHANGELOG.md`.** Osm souborů z nich generuje
`npm run verze` — pět `package.json`, `versionCode`/`versionName` v `app/android/app/build.gradle`,
`app/src/app/data/verze.generated.ts` pro obrazovku „O aplikaci“ a `backend/src/Verze.php`. **Needituj je ručně**;
že sedí se zdrojem, hlídá `test/verze.test.ts`.

`versionCode = major*10000 + minor*100 + patch`. Google Play už nikdy nepřijme nižší
versionCode, než naposledy nahraný — proto ten vzorec a proto skript padá při přetečení.

Vydání dělá projektový příkaz **`/vydat`**; celý postup a rozhodnutí kolem Play jsou
v `docs/vydani.md`. Globální `/release-gitlab` na tenhle projekt nesedí (hledá
`ClientApp/package.json` a `*.csproj`) — nepoužívej ho.

Release build se podepisuje vlastním klíčem, když jsou v `~/.gradle/gradle.properties`
property `KONTROLA_TIKETU_*`; jinak spadne na ladicí klíč, aby šel R8 ověřit i bez klíče.
Artefakt pro Play dělá `./gradlew :app:publishableBundle`, který bez klíče **selže**.

**AAB a rozdělená APK se musí stavět dvěma spuštěními Gradlu**, ne jedním. Rozdělení podle ABI
se se `shrinkResources` a `bundleRelease` nesnese (AGP 8.13), takže se pro bundle vypíná —
`splits.abi.enable` se odvozuje z názvů požadovaných tasků. Při souběhu se build zastaví
už v konfiguraci. Viz `docs/vydani.md`, „Past: AAB a rozdělená APK se nesnesou“.
