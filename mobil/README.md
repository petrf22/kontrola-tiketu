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
npm run test:angular -- --watch=false  # navigace, formuláře a správa tiketů
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

## Ovládání a archiv

Spodní lišta nabízí Tikety, Přehled a Další. Přidání tiketu je v seznamu; výsledky a informace
o aplikaci jsou pod Další. Detail ukazuje cenu, výhru a bilanci, rozbalovací obsah tiketu
a historii od nejnovějšího, po dvaceti slosováních.

V nabídce Akce tiketu lze upravit cenu a rozsah kontroly, archivovat nebo smazat tiket.
Archivované tikety jsou v části Archiv a jdou vrátit mezi aktuální; poslední přesun lze
vrátit tlačítkem Zpět, dokud neodejdeš z detailu nebo tiket znovu nezměníš. Archivace nemění
bilanci ani nezastavuje kontrolu virtuálního tiketu. K tomu slouží Ukončit kontrolu.

Příznak `archivovany` je nepovinnou součástí uloženého JSON tiketu. Starší tikety bez příznaku
jsou aktuální; SQL schéma se nemění. Neznámá cena se zobrazuje výslovně, ručně zadaná nula je
platná cena. Prázdné pole ceny použije ceník.

## Pojmenování a skupiny

Při přidání tiketu lze vyplnit nepovinný název, například „kolega“ nebo „práce“.
Existující tiket pojmenuješ přes Akce tiketu → Pojmenovat tiket. Pole nabízí už použité
názvy; prázdné pole název odstraní. Úprava mění jen vybraný tiket.

Stejný název seskupuje tikety napříč hrami. Velikost písmen ani nadbytečné mezery nerozhodují,
diakritika se rozlišuje. Seznam lze přepnout mezi seskupením podle názvu a řazením podle data;
filtr názvu funguje současně s archivem a typem tiketu. Nepojmenované tikety jsou pod „Bez názvu“.

Přehled ukazuje vsazené částky, výhry a bilanci za jednotlivé názvy včetně archivovaných
tiketů. Výběr názvu omezí také celkový souhrn, grafy podle her a upozornění na překryvy.
Odkaz „Zobrazit tikety skupiny“ otevře seznam vyfiltrovaný na daný název; skupinu, která je
celá v archivu, otevře rovnou v archivu.
Částky jsou za celé tikety skupiny; název neurčuje počet sázejících ani jejich podíly.

Nepovinné pole `nazev` se ukládá v dosavadním šifrovaném JSON tiketu, bez migrace SQL
a bez odesílání na server. Starší tikety patří mezi nepojmenované. Opětovný sken bez změny
názvu zachová dosavadní pojmenování; explicitní `null` nebo prázdný text ho odstraní.

**Nesahej na `android/app/src/main/AndroidManifest.xml` bez rozmyslu.** Právě dvě oprávnění
(`CAMERA`, `INTERNET`), síťový allowlist, `allowBackup="false"` a `FLAG_SECURE`
v `MainActivity` jsou akceptační kritéria.
