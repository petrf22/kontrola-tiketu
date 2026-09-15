# Čtení tiketu: co jde, co nejde a proč

Stav k **14. 9. 2026**. Logika čtení tiketu je v `knihovny/ocr`, zapojená a vyzkoušená na
reálných tiketech Eurojackpotu; tikety všech tří her jsou ověřené na fotkách. Historická část níž popisuje rozhodnutí, která k zapojení vedla.

---

## Shrnutí

| | stav |
|---|---|
| Skládání řádků, čtení čísel, čtení kódu | **hotové**, otestované bez zařízení |
| Sken čárového kódu (PDF417) | **ověřený** na reálném tiketu (9. 9. 2026, znovu z Play 14. 9.) |
| Rozpoznávání čísel z tiketu (OCR) | **zapojené** s vědomou odchylkou od zadání — viz níže; na reálném tiketu funguje, ale ne na první fotku |
| Rozpoznání hry | **hotové** (14. 9. 2026), otestované na přepisech fotek; na telefonu neověřené |

---

## Rozhodnutí: rozpoznávání textu chce uložený soubor

> **Rozhodnuto 9. 9. 2026: povolen dočasný soubor v privátní cache aplikace.**
> Je to změna akceptačního kritéria ze zadání, ne jeho obejití. Zbytek téhle sekce popisuje,
> proč k tomu došlo a co se místo toho zvažovalo.
>
> Podmínkou je, že snímek **vždycky** zmizí — při úspěchu, při chybě rozpoznávání i při
> výjimce — a že se nikdy nedostane do galerie. Postup je proto v jedné funkci
> (`src/app/data/snimekTiketu.ts`) s `finally` a s vyměnitelnými závislostmi, aby na to
> šel napsat test. Hlídají to `test/snimekTiketu.test.ts` a `test/soukromi.test.ts`.
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

Vyhodnocovací část je na tom nezávislá: `knihovny/ocr` přijímá útržky textu s rámečky
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

Používá se tedy `prectiCarovyKod`, který pracuje s bajty. Obcházení vzorem bylo odstraněno —
dead code postavený na špatném předpokladu je horší než žádný.

### Upřesnění 14. 9. 2026: blok má proměnnou délku a hlavička nese hru

**Pevné offsety platily jen pro první tiket.** Kódy tří dalších tiketů, dekódované z fotek
(zxing-cpp na počítači, vypsaná jen délka, hlavička a oddělovače — nikdy číslo karty):

| | Eurojackpot | Sportka | Euromiliony | Eurojackpot 9. 9. |
|---|---|---|---|---|
| délka | 69 | 77 | 61 | 121 |
| bajty 0–5 | `RBF1 16 25` | `RBF1 16 2d` | `RBF1 16 1d` | `RBF16M` |
| hlavička 6–10 | **`13`** 00 02 00 01 | **`0f`** 00 01 00 01 | **`0c`** 00 01 00 01 | **`13`** 00 02 00 01 |
| šifrovaný blok | 32 | 40 | 24 | 72 |
| sériové číslo od | 49 | 57 | 41 | 89 |
| klubová karta | ne | ne | ne | ano |

- Na pevném offsetu 89 a s minimem 109 bajtů **čtení na všech třech tiketech padalo**:
  fotka potichu nedala sériové číslo a obrazovka „Jen kód“ skončila chybou. Sériové číslo
  se teď hledá za značkou `02 01 00 16 01 00` a magic je jen `RBF1`.
- **První bajt hlavičky odpovídá hře.** `0x13` sedí na dvou tiketech Eurojackpotu s různým
  počtem sloupců i slosování; Sportka a Euromiliony mají zatím po jednom vzorku. Neznámý bajt
  proto není chyba, jen hru neurčí.
- Bajt 5 je u všech čtyř tiketů konec sériového čísla − 32. Nic se na tom nestaví.
- Bajty jsou z zxing-cpp, ne z ML Kitu. Že je telefon vrací stejně, zbývá ověřit.

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

## Ostré použití z Play (14. 9. 2026)

Dva tikety Eurojackpotu, verze 0.2.0 z Google Play. Čárový kód i fotka fungují, ale:

- na „skoro všechno“ byly potřeba **zhruba tři fotky**,
- při prvním pokusu chyběla **poslední dvě čísla sloupce**, tedy euročísla,
- **datum losování se nepřečetlo** — hlavička přitom vypadá přesně jako v zadání
  (`SLOSOVÁNÍ: 1 (ÚT)   08.09.2026`) a formulář tehdy potichu předvyplnil dnešek.

Syrový výstup rozpoznávače k dispozici nebyl (release build nic neloguje a tak to má zůstat),
takže opravy míří na záměny, které se z kódu daly vyčíst:

- **Čísla sloupce jsou na tiketu vždy dvojice číslic** (`02`, nikdy `2`). `prectiCislaSloupce`
  proto slepený útržek se sudým počtem číslic rozdělí po dvou, jednu číslici označí k ověření
  a lichý počet od tří nehádá. Dřív se útržek jako `0203` nebo `03NT` tiše zahodil. Pravidlo
  platí jen pro text z fotky; ruční zadání dál bere i `2 3`.
- **`NT` za sloupcem znamená náhodný tip** — čísla vybral terminál, ne sázející. Pro
  vyhodnocení nic neznamená; když ho rozpoznávač přilepí k číslu, odřízne se.
- **Datum** se čte se záměnami písmen za číslice, s čárkou i mezerami kolem teček, musí to být
  skutečné datum a rozhoduje řádek `SLOSOVÁNÍ` (nebo datum nejblíž k němu), ne první datum
  na tiketu. Nepřečtené datum formulář nechá prázdné s upozorněním.

### Z diagnostiky test

Formulář po focení má sbalený blok „Co rozpoznávač z fotky přečetl“: řádky mimo sloupce
a sloupce k ověření, tak jak je vrátil rozpoznávač. Zobrazuje se jen na obrazovce
(`FLAG_SECURE`), neukládá se ani neloguje. Když čtení selže, opiš odtud řádky — čísla sázek
můžeš nahradit jinými dvojicemi — a z nich vznikne test v `knihovny/ocr/test/tiket.test.ts`
podle skutečného tiketu místo odhadu.

---

## Jak tikety vypadají (fotky 14. 9. 2026)

Tikety všech tří her, vyfocené a přepsané. Na telefonu je zatím vyzkoušený jen Eurojackpot.
Přepisy s vymyšlenými čísly jsou v `knihovny/ocr/test/tiketyZFotek.ts`.

| | Eurojackpot | Sportka | Euromiliony |
|---|---|---|---|
| logo | `EUROJACKPOT` (tečkované písmo) | `sportka` (místo o míč) + `allwyn` | `Euromiliony` |
| hlavička | `SLOSOVÁNÍ: 4 (ÚT,PÁ)  15.09.2026-25.09.2026` | `SLOSOVÁNÍ: 6 (ST,PA,NE) 16.09.2026-27.09.2026` | `SLOSOVÁNÍ: 4   15.09.2026-26.09.2026` |
| sloupec | `1: 01 06 07 35 49` … `01 12 NT` | `1:  02 08 27 34 43 46  NT` | `1: 01 07 15 22 23 25 29  -  05 NT` |
| doplňková hra | `Extra 6:  895373  ANO` | `Šance:  229087  ANO` | `Eurošance:  18546  ANO` |
| pod ní | `14.09.2026  640 Kč  11:20:36` | `14.09.2026  720 Kč  11:21:14` | `14.09.2026  360 Kč  11:20:53` |

Nad hlavičkou mají **všechny tři** reklamu `EXTRA ŠANCE NA VÝHRU S ALLWYN KLUBEM.` a `NAVÍC
JOKER NÁSOBÍ VÝHRY NA KOLE ŠTĚSTÍ.` Starý nekotvený vzor Šance na ni seděl.

- **Hlavička** má rozsah dat a v závorce dny, na které tiket platí — Sportka `6 (ST,PA,NE)`
  od 16. do 27. 9. vychází přesně na šest slosování. Euromiliony závorku netisknou, proto se
  počet slosování čte za popiskem `SLOSOVÁNÍ`, ne před závorkou.
- **Dny ze závorky se předvyplní do formuláře, jen když dokazují výběr** (`vsazeneDny`,
  15. 9. 2026). Tiket na málo slosování vypíše jen pokryté dny: Eurojackpot `1 (ÚT)` mohl být
  vsazený na všechny dny i jen na úterý. Pro slosování z papíru je to jedno, virtuální tiket
  by ale s úterkem vynechal pátky. Výběr se proto bere, jen když je v závorce méně dnů, než by
  `pocet` slosování pokrylo při sázce na všechny (`min(pocet, dnů hry)`). Tiket se skutečným
  výběrem dnů zatím nikdo nevyfotil; pravidlo platí, ať závorka znamená výběr, nebo pokryté dny.
- **Sloupec Euromilionů** je jeden blok, číslo z druhého osudí odděluje pomlčka.
- **Eurošance** má pět číslic, Šance a Extra 6 šest.

## Rozpoznání hry

`knihovny/ocr/src/hra.ts`. Hru prozrazuje víc věcí a každá se dá přečíst špatně, takže se
žádné nevěří slepě. Každý signál **zužuje množinu her**; hra se určí, jen když zbude jedna.

| signál | kandidáti |
|---|---|
| první bajt hlavičky čárového kódu | jedna hra |
| popisek `Extra 6` / `Šance` / `Eurošance` (ne v reklamě, Eurošanci ani Druhé šanci) | jedna hra |
| název z loga, se znaky navíc (tečkované písmo, míč, stylizované i) | jedna hra |
| každý den v závorce hlavičky | hry, které ten den losují — `(ÚT,PÁ)` tak dá Eurojackpot, `(PÁ)` nic |
| pomlčka mezi čísly sloupce | Euromiliony |

**Rozpor ani žádný signál se nedomýšlí.** Špatně určená hra by čísla ve sloupci rozdělila
jinak (5+2 × 6 × 7+1). Obrazovka se pak po fotce zeptá „Je to…“ a tentýž snímek přečte znovu
z textu v paměti — soubor je v tu chvíli smazaný. Formulář ukáže, podle čeho se hra poznala.
Po samotném skenu kódu formulář předvybere hru z hlavičky.

Na syntetických přepisech bez úhlů řádků se sklon při skládání zadává napevno. Odhad hlasováním
je na pravidelné mřížce s mnoha jednodílnými řádky nejednoznačný (posun pravých útržků o celý
řádek dá stejné skóre). Na zařízení úhel dodává ML Kit z rohů řádku.

---

## Poznámka k velikosti APK

Debug APK má ~78 MB, protože obsahuje nativní knihovny pro **všechny čtyři ABI**:

| knihovna | k čemu | napříč ABI |
|---|---|---|
| `libbarhopper_v3.so` | rozpoznávání čárových kódů (ML Kit) | ~20 MB |
| `libsqlcipher.so` | šifrování databáze | ~7,6 MB |

Zařízení si při instalaci z App Bundle stáhne jen svou architekturu, takže reálná instalace
je zhruba třetina. Není to problém k řešení, jen se toho nelekni při ručním sideloadu.
