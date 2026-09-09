# Čtení tiketu: co jde, co nejde a proč

Stav k **9. 9. 2026**. Logika čtení tiketu je hotová a otestovaná v `packages/ocr`, ale její
napojení na zařízení naráží na dvě věci, které se nedají obejít bez rozhodnutí.

---

## Shrnutí

| | stav |
|---|---|
| Skládání řádků, čtení čísel, čtení kódu | **hotové**, otestované bez zařízení |
| Sken čárového kódu (PDF417) | **zapojený**, ale neověřený na reálném tiketu |
| Rozpoznávání čísel z tiketu (OCR) | **zablokované** — viz níže |

---

## Blokátor 1: rozpoznávání textu chce uložený soubor

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
   Plně v souladu se zadáním, hotové dnes, méně pohodlné.
2. **Vlastní plugin nad `InputImage.fromMediaImage`.** ML Kit umí zpracovat snímek přímo
   z proudu kamery, bez souboru. Znamená to ~150 řádků Javy nebo Kotlinu v projektu.
   Zadání odmítá psát v nativním kódu *aplikaci*; malý plugin je něco jiného, ale pořád
   je to nativní kód k údržbě.
3. **Povolit dočasný soubor v privátní cache aplikace** a hned ho mazat. Je to jednodušší,
   ale je to doslovné porušení akceptačního kritéria. Bez výslovné změny zadání ne.

Vyhodnocovací část je na tom nezávislá: `packages/ocr` přijímá útržky textu s rámečky
(`zMlKit`) a je jedno, odkud přijdou. Až se způsob pořízení snímku vyřeší, napojení je
otázka několika řádků.

---

## Blokátor 2: čtečka kódů nevrací syrové bajty

`@capacitor-mlkit/barcode-scanning` vrací v `Barcode` jen `rawValue: string`, ne `rawBytes`.
Payload tiketu je přitom binární — 72 bajtů šifrovaného bloku s vysokou entropií.

Důsledek: **na offsety popsané v zadání se nedá spolehnout.** Při převodu bajtů na řetězec
se blok může rozpadnout na jiný počet znaků a sériové číslo pak neleží na offsetu 89.

Řešení v `prectiSerioveCisloZTextu`: sériové číslo se hledá **vzorem** — právě dvacet číslic
za magickou hlavičkou `RBF16M`, ohraničených nečíslicemi. Číslo klubové karty má deset číslic,
takže se nezamění.

> **Neověřeno na reálném tiketu.** Dokud se sken nevyzkouší, ber výsledek jako návrh.
> Obrazovka skenu proto sériové číslo jen předává do formuláře, kde ho jde zkontrolovat
> proti tomu, co je vytištěné na papíře.

Funkce `prectiCarovyKod` pracující s bajty zůstává — je přesnější a použije se, kdyby se
objevil plugin, který bajty vrací.

---

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
