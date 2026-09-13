# CLAUDE.md — mobilní aplikace

Angular 22 + Capacitor 8. Samostatný projekt: vlastní `package.json`, lockfile a testy.
**Nečte ani neimportuje nic mimo `mobil/`** — výsledky zná jen z backendu (stažením) nebo ze
souboru (importem). Společná pravidla repozitáře jsou v kořenovém `CLAUDE.md`.

## Ověřené příkazy

```bash
npm install          # po instalaci je potřeba npm approve-scripts esbuild
npm test             # vitest, 395 testů (jádro, OCR, soukromí aplikace, síť, tok dat)
npm run typecheck    # tsc strict nad knihovnami a testy
npx ng serve         # vývoj v prohlížeči
npx ng build         # web do dist/

export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npx cap sync android
cd android && ./gradlew :app:assembleDebug
```

## Struktura

```
knihovny/jadro/src/    model.ts, validace.ts, koncoveCislice.ts, slucovani.ts,
                       eurojackpot.ts, sportka.ts, sance.ts, extra6.ts,
                       euromiliony.ts, eurosance.ts, vyhodnoceni.ts
knihovny/ocr/src/      radky.ts (párování podle rámečků), cisla.ts, tiket.ts, carovyKod.ts
src/app/data/          import.ts, stahovani.ts, uloziste.ts, stav.ts, tokeny.ts
src/app/obrazovky/     seznam.ts, novy-tiket.ts, sken.ts, sken-cisel.ts, detail.ts,
                       import-vysledku.ts, o-aplikaci.ts
test/                  testy aplikace; fixtures/ má ukázkový balík od backendu
android/               nativní projekt, zatvrzený manifest
docs/                  vydani.md (podpis, Play, postup vydání), ocr-a-carovy-kod.md,
                       zasady-ochrany-osobnich-udaju.md
```

Knihovny `jadro` a `ocr` nejsou npm balíky. Aplikace i testy je vidí přes aliasy
`@kontrola-tiketu/jadro` a `@kontrola-tiketu/ocr` — `paths` v `tsconfig.json` a `resolve.alias`
ve `vitest.config.ts`. Knihovny mají přísnější tsconfig (`tsconfig.knihovny.json`).

Jádro je čistá knihovna: bez UI, bez I/O, bez sítě, bez závislostí. Hlídá to
`knihovny/jadro/test/bezIO.test.ts` — když do `src/` přidáš import z `node:`, `fetch`,
`document`, `@angular` nebo cizí balík, test spadne. To je záměr, ne překážka.

Ukázkový balík `test/fixtures/vysledky-2026-35-az-37.json` je skutečný výstup backendu
a zároveň smlouva o formátu. Sazby Extra 6 berou testy jádra z něj.

## Ověřené na skutečném telefonu

Xiaomi 14T Pro, Android 16, 9. 9. 2026:

- instalace release buildu s R8 (tehdy s jediným oprávněním `CAMERA`),
- otevření šifrované databáze (`Database keying operation returned:0`),
- **jedna fotka** dá šest sloupců, euročísla, `Extra 6`, cenu i sériové číslo z čárového kódu,
- sériové číslo sedí na to vytištěné na tiketu,
- import výsledků a vyhodnocení proti reálným tahům,
- dočasný snímek žije půl sekundy a maže se i při chybě.

Na telefonu běží **release build s R8** — ladicí přeposílá konzoli do logcatu a plugin čtečky
tam loguje celý obsah kódu včetně čísla klubové karty. Na ostrý provoz používej release.

Snímání je sjednocené: **jedna fotka dá čísla, `Extra 6` i sériové číslo z kódu**
(`readBarcodesFromImage` vrací tentýž typ `Barcode` včetně `bytes`). Obrazovka „Jen kód“
zůstává pro případ, že fotka kód nezachytí nebo uživatel nechce pořizovat snímek vůbec.

Podoba doplňkové hry na tiketu Eurojackpotu: `Extra 6: 845991`, cena `400 Kč`. Podoba Šance
u Sportky ověřená není — vzor je proto volnější. **Tiket Euromilionů neviděl nikdo vůbec**:
rozvržení (7 čísel + 1 z druhého osudí), popisek Eurošance (pět číslic) i čárový kód jsou
předpoklad, viz `docs/ocr-a-carovy-kod.md`.

**Pozor u čtení částek:** skládání řádků podle rámečků může cenu spojit s okolím, takže se
nesmí kotvit na konec řádku. Zároveň částka nesmí začít uprostřed jiného čísla — jinak
z `07.09.2026 400 Kč` vyjde 2 026 400.

**Instalace přes `adb install` na Xiaomi** projde jen u ladicího buildu; release blokuje
HyperOS (`INSTALL_FAILED_USER_RESTRICTED`) a je nutné ho otevřít ve správci souborů. Play
Protect navíc u velkých APK vypršel — proto jsou APK rozdělené podle architektur
(arm64-v8a ~25 MB).

## Věci, na které se nesmí zapomenout

1. **Sken kódu je ověřený na reálném tiketu** (9. 9. 2026). Čtečka vrací `rawValue` jako
   `undefined`, ale `bytes` dodá — a ty na offsety ze zadání sedí přesně. Bajty jsou
   znaménkové, takže se musí maskovat `& 0xff`.
2. **Snímek pro OCR se ukládá do privátní cache** — vědomá odchylka od zadání, odsouhlasená
   9. 9. 2026. Podmínkou je, že vždycky zmizí a nikdy neskončí v galerii. **Nesahej na
   `snimekTiketu.ts` tak, abys porušil `finally`**; ta záruka je celý důvod, proč je ten
   postup oddělený od napojení na pluginy. Viz `docs/ocr-a-carovy-kod.md`.
3. **Nesahej na `android/app/src/main/AndroidManifest.xml` bez rozmyslu.** Právě dvě oprávnění
   (`CAMERA`, `INTERNET`), `network_security_config` (TLS jen na server výsledků), odstraněný
   Googlí `datatransport`, `allowBackup="false"` a FLAG_SECURE v `MainActivity` jsou akceptační
   kritéria. Hlídá je `test/soukromi.test.ts`, který navíc kontroluje sestavené APK přes
   `aapt2`, když existuje. **Doména backendu je na dvou místech** — `src/app/data/adresa-backendu.ts`
   a `network_security_config.xml` — a test hlídá, že sedí.
4. **Na síť sahá jediný modul**, `src/app/data/stahovani.ts`, a ten nesmí importovat nic, co zná
   tikety. Hlídá to `test/sit.test.ts` — když přidáš `fetch`, `HttpClient` nebo `CapacitorHttp`
   jinam, test spadne. To je záměr, ne překážka.

## Co je zjištěné — neověřuj znovu

Čárový kód tiketu je **PDF417** (ne QR). Struktura payloadu je popsaná v zadání. Podstatné:

- **Vsazená čísla v kódu čitelná nejsou** — jsou v šifrovaném bloku. Ověřeno.
- Kód slouží **pouze** jako zdroj lokálního ID tiketu (sériové číslo → deduplikace).
- Šifrovaný blok se **neláme**, oficiální aplikace se **nereverzuje**, za přihlášení se nechodí.
- Číslo klubové karty je v payloadu v plaintextu — **zahazuje se**, neukládá ani nezobrazuje.

Pluginy: `@capacitor-mlkit/barcode-scanning` a `@capacitor-mlkit/text-recognition`.

## Sestavení pro Play

Release build se podepisuje vlastním klíčem, když jsou v `~/.gradle/gradle.properties`
property `KONTROLA_TIKETU_*`; jinak spadne na ladicí klíč, aby šel R8 ověřit i bez klíče.
Artefakt pro Play dělá `./gradlew :app:publishableBundle`, který bez klíče **selže**.

**AAB a rozdělená APK se musí stavět dvěma spuštěními Gradlu**, ne jedním. Rozdělení podle ABI
se se `shrinkResources` a `bundleRelease` nesnese (AGP 8.13), takže se pro bundle vypíná —
`splits.abi.enable` se odvozuje z názvů požadovaných tasků. Při souběhu se build zastaví
už v konfiguraci. Viz `docs/vydani.md`, „Past: AAB a rozdělená APK se nesnesou“.
