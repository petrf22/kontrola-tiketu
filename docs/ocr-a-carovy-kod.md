# Čtení tiketu: co jde, co nejde a proč

Stav k **9. 9. 2026**. Logika čtení tiketu je hotová a otestovaná v `packages/ocr`, ale její
napojení na zařízení naráží na dvě věci, které se nedají obejít bez rozhodnutí.

---

## Shrnutí

| | stav |
|---|---|
| Skládání řádků, čtení čísel, čtení kódu | **hotové**, otestované bez zařízení |
| Sken čárového kódu (PDF417) | **zapojený**, ale neověřený na reálném tiketu |
| Rozpoznávání čísel z tiketu (OCR) | **zapojené** s vědomou odchylkou od zadání — viz níže |

---

## Rozhodnutí: rozpoznávání textu chce uložený soubor

> **Rozhodnuto 9. 9. 2026: povolen dočasný soubor v privátní cache aplikace.**
> Je to změna akceptačního kritéria ze zadání, ne jeho obejití. Zbytek téhle sekce popisuje,
> proč k tomu došlo a co se místo toho zvažovalo.
>
> Podmínkou je, že snímek **vždycky** zmizí — při úspěchu, při chybě rozpoznávání i při
> výjimce — a že se nikdy nedostane do galerie. Postup je proto v jedné funkci
> (`app/src/app/data/snimekTiketu.ts`) s `finally` a s vyměnitelnými závislostmi, aby na to
> šel napsat test. Hlídají to `app/test/snimekTiketu.test.ts` a `app/test/soukromi.test.ts`.
>
> Co to znamená v praxi, ověřeno na zařízení 9. 9. 2026: snímek vznikne v adresáři
> `Android/data/cz.petrf22.kontrolatiketu/files/Pictures/`, tedy v prostoru privátním pro
> aplikaci, a **do sekundy je smazaný** (`Camera.getPhoto` v 19:13:34,6 →
> `Filesystem.deleteFile` v 19:13:35,1). Do cloudové zálohy se nedostane
> (`allowBackup="false"` a pravidla bez výjimek), do galerie ani do MediaStore taky ne
> (`saveToGallery: false` a odpověď pluginu potvrzuje `"saved": false`).

### Původní rozpor

`@capacitor-mlkit/text-recognition` má jedinou metodu:

```ts
processImage(options: { path: string }): Promise<ProcessImageResult>
```

Vyžaduje **cestu k souboru na disku**. Snímek se tedy musí nejdřív uložit.

Zadání to ale zakazuje jako akceptační kritérium:

> snímky z kamery se zpracovávají ve streamu, nikdy se neukládají do MediaStore ani do cache

Plugin proto zapojený **není** a je odinstalovaný — nemá smysl vozit v aplikaci modely,
které se nepoužívají.

### Možnosti

1. **Ponechat ruční zadání čísel.** Sken kódu dá sériové číslo, čísla se opíší z papíru.
   Plně v souladu se zadáním, méně pohodlné. Ruční zadání zůstává plnohodnotnou cestou
   bez ohledu na tohle rozhodnutí.
2. **Vlastní plugin nad `InputImage.fromMediaImage`.** ML Kit umí zpracovat snímek přímo
   z proudu kamery, bez souboru. Znamená to ~150 řádků Javy nebo Kotlinu v projektu.
   Zadání odmítá psát v nativním kódu *aplikaci*; malý plugin je něco jiného, ale pořád
   je to nativní kód k údržbě.
3. **Povolit dočasný soubor v privátní cache aplikace** a hned ho mazat. ← **zvoleno**

Vyhodnocovací část je na tom nezávislá: `packages/ocr` přijímá útržky textu s rámečky
(`zMlKit`) a je jedno, odkud přijdou. Až se způsob pořízení snímku vyřeší, napojení je
otázka několika řádků.

---

## Vyřešeno: čtečka syrové bajty vrací

**Původně jsem tvrdil, že `@capacitor-mlkit/barcode-scanning` vrací jen `rawValue: string`,
a postavil na tom obcházení, které sériové číslo hledalo vzorem místo na pevném offsetu.
Byl to omyl** — vznikl z neúplného hledání v typech pluginu (`rawBytes` místo `bytes`).

Skutečnost, ověřená 9. 9. 2026 na reálném tiketu Eurojackpotu:

| pole | co obsahuje |
|---|---|
| `rawValue` | **`undefined`** — payload není platný text, ML Kit ho jako řetězec nevrátí |
| `bytes` | **celý payload**, `number[]` se znaménkovými Java bajty |
| `format` | `PDF_417` |

Bajty na strukturu ze zadání sedí **přesně**:

```
délka          121 bajtů        ← zadání uvádí 121
offset   0     "RBF16M"
offset   6     13 00 02 00 01
offset  11     72 bajtů šifrovaného bloku
offset  83     02 01 00 16 01 00
offset  89     20 číslic ASCII  ← sériové číslo
offset 109     0b 01
offset 111     10 číslic ASCII  ← číslo klubové karty, zahazuje se
```

Používá se tedy `prectiCarovyKod`, který pracuje s bajty a offsety podle zadání. Obcházení
vzorem bylo odstraněno — dead code postavený na špatném předpokladu je horší než žádný.

**Pozor na jednu věc:** bajty přicházejí jako **znaménkové** Java hodnoty, takže se musí
maskovat (`b & 0xff`). Bez toho se šifrovaný blok rozsype a offsety přestanou sedět.

## Co je při skenu dodržené

- Používá se **proudový režim** `startScan()`, ne pohodlnější `scan()`. Ten jede přes modul
  Google Play, který se **stahuje ze sítě** — a aplikace síť nemá a mít nemá.
- Použitá závislost je `com.google.mlkit:barcode-scanning` (model přibalený v aplikaci),
  ne `play-services-mlkit-barcode-scanning` (model stahovaný z Play). Sken tedy funguje
  offline hned po instalaci.
- Sken nepřidal do aplikace žádné oprávnění navíc. Ověřeno na sestaveném APK: jediné
  oprávnění je `CAMERA`.

---

## Poznámka k velikosti APK

Debug APK má ~78 MB, protože obsahuje nativní knihovny pro **všechny čtyři ABI**:

| knihovna | k čemu | napříč ABI |
|---|---|---|
| `libbarhopper_v3.so` | rozpoznávání čárových kódů (ML Kit) | ~20 MB |
| `libsqlcipher.so` | šifrování databáze | ~7,6 MB |

Zařízení si při instalaci z App Bundle stáhne jen svou architekturu, takže reálná instalace
je zhruba třetina. Není to problém k řešení, jen se toho nelekni při ručním sideloadu.
