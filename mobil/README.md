# mobil

Mobilní aplikace — Angular 22 + Capacitor 8. Samostatný projekt: vlastní závislosti i testy,
nic mimo tenhle adresář nečte. Výsledky si stahuje z backendu, nebo je dostane importem
souboru.

Popis projektu je v [kořenovém README](../README.md), závazné zadání
v [`zadani-kontrola-tiketu.md`](../zadani-kontrola-tiketu.md) a postup vydání
v [`docs/vydani.md`](docs/vydani.md).

```bash
npm install          # potom npm approve-scripts esbuild
npm test             # vitest: aplikace, jádro i OCR
npm run typecheck
npx ng serve         # vývoj v prohlížeči (úložiště je jen v paměti, po zavření je pryč)
npx ng build         # web do dist/

export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npx cap sync android
cd android && ./gradlew :app:assembleDebug
```

- `knihovny/jadro` — vyhodnocovací jádro, čistá knihovna bez UI, I/O a sítě
- `knihovny/ocr` — skládání rozpoznaného textu na sloupce a čtení čárového kódu
- `src/` — aplikace, `test/` — testy aplikace, `android/` — nativní projekt

`test/soukromi.test.ts` hlídá akceptační kritéria ze zadání a kontroluje i sestavené APK.

**Nesahej na `android/app/src/main/AndroidManifest.xml` bez rozmyslu.** Právě dvě oprávnění
(`CAMERA`, `INTERNET`), síťový allowlist, `allowBackup="false"` a `FLAG_SECURE`
v `MainActivity` jsou akceptační kritéria.
