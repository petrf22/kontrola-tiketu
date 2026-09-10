# Zadání: Offline kontrola loterijních tiketů Allwyn

## Cíl

Android aplikace, která zkontroluje papírové tikety Allwyn (Eurojackpot, Sportka) proti výsledkům losování tak, aby se **provozovatel ani nikdo jiný nedozvěděl, že konkrétní osoba sází nebo vyhrála**. Ochrana soukromí je primární požadavek, ne doplněk — každé designové rozhodnutí se poměřuje proti němu.

## Co už je zjištěné (neověřuj znovu, stav k 9/2026)

### Čárový kód na tiketu

Je to **PDF417**, ne QR. Payload z reálného tiketu Eurojackpotu měl 121 bajtů a tuto strukturu:

```
offset 0    "RBF16M"                    magic
offset 6    13 00 02 00 01              hlavička / verze
offset 11   72 bajtů vysoké entropie    šifrovaný blok (sázka + MAC)
offset 83   02 01 00 16 01 00           oddělovače, vypadá to na TLV
offset 89   20 číslic ASCII             sériové číslo tiketu (shodné s tištěným)
offset 109  0b 01 + 10 číslic ASCII     číslo karty Allwyn Klub, plaintext
```

Důsledky:

- **Vsazená čísla v kódu čitelná nejsou.** Ověřeno: žádná z vsazených pětic se v payloadu nevyskytuje jako sekvence bajtů, kód doplňkové hry se tam nevyskytuje jako ASCII. Sázka je uvnitř šifrovaného bloku.
- Dekódování kódu má smysl **pouze** jako zdroj lokálního identifikátoru tiketu (sériové číslo → deduplikace, párování s naOCRovanými čísly).
- **Nepokoušej se ten šifrovaný blok lámat.** Není to cíl projektu.
- Číslo klubové karty je v kódu nešifrované — aplikace ho nesmí nikam ukládat ani zobrazovat.

### Oficiální cesty a proč nevyhovují

Aplikace Allwyn Klub i webový formulář posílají buď sériové číslo tiketu, nebo vsazená čísla na server provozovatele. To je přesně ten únik, který má tenhle projekt odstranit.

## Architektura

Dvě oddělené komponenty, které spolu nekomunikují po síti:

**1. Fetcher výsledků** (CLI, běží na desktopu)
Stáhne výsledky losování a tabulky výher hromadně za zadané období, bez ohledu na to, jaké tikety uživatel drží. Výstup je JSON soubor. Server se tak dozví jen to, že si někdo zobrazil veřejné výsledky.

**2. Android aplikace** (bez `INTERNET` permission)
Načte JSON s výsledky přes import souboru, čísla z tiketu získá OCR na zařízení, vyhodnocení proběhne lokálně. Absence síťové permission v manifestu je ověřitelná záruka, že aplikace nemůže nic vynést.

Pokud se ukáže, že import souboru je v praxi neúnosně nepohodlný, navrhni variantu se síťovou permission, ale s tvrdým pravidlem: stahují se **vždy všechny tahy za období**, nikdy dotaz vázaný na konkrétní tiket.

> **Uplatněno 10. 9. 2026.** Import souboru se pro kontrolu dvakrát týdně ukázal jako nepoužitelný. Výsledky teď hlídá a publikuje backend v PHP a aplikace si je stahuje celé, pro všechny stejně (`docs/backend.md`). Kritérium „jediná permission je `CAMERA`“ tím padá. Je to slabší záruka než žádná síť vůbec, a proto ji nahrazují vymahatelné pojistky: oprávnění jsou právě `CAMERA` a `INTERNET`, TLS projde jedině na server výsledků, Googlí `datatransport` z ML Kitu je z manifestu odstraněný a na síť sahá jediný modul, který o tiketech neví. Hlídají to `app/test/soukromi.test.ts` a `app/test/sit.test.ts`.

## Fáze

### Fáze 0 — průzkum zdroje dat

Zjisti, v jaké podobě Allwyn publikuje výsledky losování a tabulky výher (částky podle pořadí). Hledáš JSON endpoint, který používá jejich web; pokud neexistuje, půjde o parsování HTML. Zjisti taky, jestli je dostupný archiv starších tahů, nebo jen poslední losování — od toho se odvíjí, jak často musí fetcher běžet.

Ověř podmínky užití webu a napiš do README, co jsi zjistil. Fetcher musí posílat rozumný User-Agent, respektovat robots.txt a nedělat víc dotazů, než je nutné.

**Výstup fáze:** krátký zápis do `docs/data-source.md` s tím, co jsi našel, než začneš psát kód.

### Fáze 1 — datový model a vyhodnocovací jádro

Čistá knihovna bez závislosti na UI a bez I/O, plně pokrytá unit testy.

Model musí unést:
- tah: hra, číslo tahu, datum, tažená čísla, doplňková čísla, tabulka výher po pořadích
- tiket: hra, seznam sloupců, počet slosování (tiket může platit na víc tahů dopředu), kód doplňkové hry, lokální ID ze sériového čísla
- Eurojackpot: 5 čísel z 1–50 + 2 euročísla z 1–12, 12 výherních pořadí, částky jsou totalizátorové, takže se **musí** brát z tabulky konkrétního tahu, nikdy nesmí být natvrdo v kódu
- Sportka: dva tahy, dodatkové číslo, Šance jako samostatné losování se svou vlastní logikou

Testy piš proti reálným historickým tahům — u každého ověř, že vyhodnocení sedí na oficiálně publikovanou tabulku výher.

### Fáze 2 — OCR

On-device ML Kit Text Recognition. Žádné cloudové OCR, žádné posílání snímku kamkoliv.

Layout tiketu Eurojackpotu vypadá takto (thermal print, pravidelný, monospace):

```
SLOSOVÁNÍ: 1 (ÚT)                    08.09.2026
------------------------------------------------
 1: 23 30 33 37 47                    02 03 NT
 2: 02 22 37 39 40                    02 12 NT
 3: 04 06 07 12 33                    01 11 NT
------------------------------------------------
```

Vlevo je pořadí sloupce a pět čísel, vpravo dvě euročísla. **Pozor:** ML Kit vrátí levý a pravý sloupec pravděpodobně jako dva oddělené textové bloky, protože je mezi nimi velká mezera. Řádky se proto musí párovat podle y-souřadnic bounding boxů, ne podle pořadí v textovém výstupu. Napiš to tak, aby to sneslo mírně nakloněný snímek.

Po rozpoznání vždy nech uživatele čísla potvrdit v editovatelné formě. K tomu validace: rozsah čísel, počet čísel ve sloupci, žádné duplicity ve sloupci. Ruční zadání musí být plnohodnotná alternativa, ne nouzovka.

### Fáze 3 — aplikace

Angular + Capacitor (uživatel je Angular vývojář, nativní Kotlin nechceme). Pluginy `@capacitor-mlkit/barcode-scanning` a `@capacitor-mlkit/text-recognition`.

Obrazovky: seznam uložených tiketů, sken nového tiketu, potvrzení rozpoznaných čísel, import JSON s výsledky, detail vyhodnocení.

## Tvrdé požadavky na soukromí

Tohle jsou akceptační kritéria, ne doporučení:

- žádné analytics, crash reporting ani telemetrie, ani v dev buildu
- `android:allowBackup="false"`, `android:dataExtractionRules` bez výjimek — nic do cloudové zálohy
- `FLAG_SECURE` na aktivitách, aby nešly dělat screenshoty a náhledy v přepínači aplikací
- lokální DB šifrovaná (SQLCipher), klíč v Android Keystore
- snímky z kamery se zpracovávají ve streamu, nikdy se neukládají do MediaStore ani do cache
- jediná permission je `CAMERA`, ve fázi 3 žádná síťová *(nahrazeno, viz Architektura: `CAMERA` a `INTERNET` se síťovým allowlistem)*
- notifikace nesmí obsahovat obsah tiketu ani výsledek vyhodnocení
- číslo klubové karty z payloadu čárového kódu se zahazuje, neukládá se ani nezobrazuje

## Co explicitně nedělat

- nereverzuj oficiální aplikaci Allwyn ani její API
- nepokoušej se dešifrovat blok v čárovém kódu
- nesahej na endpointy za přihlášením
- nedávej do kódu natvrdo výherní částky

## Ostatní

- README musí obsahovat viditelné upozornění, že vyhodnocení je neoficiální a závazná je kontrola na terminálu Allwyn
- commit po každé dokončené fázi, ne jeden velký na konec
- před psaním kódu ve fázi 1 mi předlož navržený datový model a počkej na potvrzení
