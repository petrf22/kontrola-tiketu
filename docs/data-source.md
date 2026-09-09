# Zdroj dat: výsledky losování a tabulky výher

Výstup fáze 0. Stav k **9. 9. 2026**. Všechna tvrzení v dokumentu byla ověřena reálnými dotazy;
u každého je uvedeno, jak se ověření zopakuje.

---

## Závěr

Fetcher bude číst **tiskovou výherní listinu** na adrese:

```
https://www.allwyn.cz/system/vyherka?year=<rok>&week=<týden>&game=<eurojackpot|sportka>
```

Je to server-rendered HTML, robots.txt ji nezakazuje, obsahuje kompletní tabulky výher
a **jeden dotaz pokryje všechny tahy daného týdne**. Archiv sahá do roku 1994.

---

## Rebranding: sazka.cz → allwyn.cz

`www.sazka.cz` už jen 301 přesměrovává na `www.allwyn.cz`, včetně `robots.txt`. V kódu
i dokumentaci používat výhradně `www.allwyn.cz`. Statická média zůstávají na `static.sazka.cz`
a titulek stránek pořád nese `Sazka.cz` — to je zbytek po rebrandingu, ne jiný web.

```bash
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://www.sazka.cz/robots.txt
```

---

## Prozkoumané cesty a proč nevyhověly

### JSON API — zakázané v robots.txt

Stránka `/loterie/eurojackpot/kontrola-a-vysledky` je Vue SPA. V doručeném HTML **nejsou žádná
data** — ani tažená čísla, ani tabulka výher; v sitemapě nejsou URL jednotlivých tahů. Data se
dotahují až XHR. V `/frontend/web/js/app.js` je axios klient:

```js
const r = { baseURL: "/api/draw-games", … }
```

Jenže `robots.txt` obsahuje `Disallow: /api/`. Jediná strojově čitelná cesta přes SPA tedy leží
přesně pod zakázanou cestou a parsování HTML téhle stránky ji nenahradí, protože v HTML nic není.

**`/api/draw-games` se nepoužije.** Ne kvůli technické překážce, ale protože zadání ukládá
respektování robots.txt jako tvrdé pravidlo.

Web navíc běží za Akamai Bot Managerem (obfuskovaný sensor skript, cookies `_abck`, `bm_sz`),
takže i kdyby cesta zakázaná nebyla, spolehlivost přímých dotazů by byla nejistá.

### Zahraniční zdroje — nepoužitelné pro české částky

`eurojackpot.com` publikuje kvóty pro německý trh v eurech, ne české částky v korunách; Sportka
tam pochopitelně není vůbec. Eurojackpotové výhry jsou totalizátorové a přepočtené do Kč
provozovatelem, takže **Allwyn je jediný zdroj pravdy** a záložní zdroj neexistuje. To je hlavní
argument pro vlastní archiv (viz níže).

---

## Specifikace endpointu

| Vlastnost | Zjištění |
|---|---|
| Metoda | `GET`, bez přihlášení, bez cookies |
| robots.txt | **Nezakázáno** — `/system/` v Disallow listu není |
| Renderování | Server-side HTML, žádný JS |
| Bot protection | Neblokuje; obyčejný `curl` s vlastním User-Agentem vrací 200 |
| `Content-Type` | `text/html; charset=utf-8` |
| Velikost odpovědi | 13–59 kB |
| `game=` | `eurojackpot`, `sportka` |
| `week=` | Číslo týdne, od roku 1998 odpovídá ISO týdnu (výhrada níže) |
| Pokrytí | **Jeden dotaz = všechny tahy daného týdne** |
| Prázdná data | HTTP 200, tělo o velikosti **přesně 2537 B**, bez řetězce `Losování dne` |

Prázdnou listinou se projeví neexistující rok, budoucí týden i neplatná hra — vždy HTTP 200,
nikdy chybový kód. Fetcher takový týden přeskočí bez chyby.

```bash
# platný týden — 58929 B, po dekódování entit obsahuje 3 tahy Sportky a 3 losování Šance
curl -s "https://www.allwyn.cz/system/vyherka?year=2026&week=36&game=sportka" \
  | python3 -c 'import sys,html,re; h=html.unescape(sys.stdin.read()); \
      print(re.findall(r"(?:SPORTKA|ŠANCE) (?:STŘEDA|PÁTEK|NEDĚLE)", h))'

# prázdný týden — přesně 2537 B, bez řetězce "Losování dne"
curl -s "https://www.allwyn.cz/system/vyherka?year=2026&week=45&game=sportka" | wc -c
```

### Hloubka archivu

| Hra | Nejstarší ověřený týden | Nejbližší starší = prázdný |
|---|---|---|
| Sportka | **1994**, týden 10 | 1993 |
| Eurojackpot | **2015**, týden 20 | 2014 (ČR do Eurojackpotu vstoupila až 2015) |

### Frekvence losování se v čase mění

| Období | Sportka | Eurojackpot |
|---|---|---|
| 1994–2010 | neděle, středa | — |
| dnes (2026) | **středa, pátek, neděle** | úterý, pátek |

Sportka tedy dnes losuje **třikrát týdně**, ne dvakrát. Každý tah Sportky má vlastní losování
Šance. Fetcher ani model nesmí počet tahů v týdnu předpokládat — sekce se prostě vyčtou všechny,
kolik jich v listině je.

### ⚠️ Číslo týdne v dotazu nemusí odpovídat týdnu v listině

Pro roky 1998 a novější platí `week` v dotazu = číslo v listině = ISO týden (ověřeno na 1998,
2005, 2010, 2013, 2015, 2026). **Pro rok 1994 to neplatí:** dotaz `week=10` vrátí listinu
nadepsanou `9. SÁZKOVÝ TÝDEN ROK 1994` s losováním v neděli 6. 3. 1994 (což je ISO týden 9).

**Důsledek pro parser: identita tahu se bere výhradně z obsahu listiny — z hlavičky sekce
(`N. SÁZKOVÝ TÝDEN ROK RRRR`) a z `Losování dne:` — nikdy z parametrů dotazu.** Primárním klíčem
tahu je datum losování.

---

## Co listina obsahuje

### Eurojackpot

Ověřeno na 2026/36 a 2026/37. Dvě sekce (úterý, pátek), v každé:

- `EUROJACKPOT ÚTERÝ` / `PÁTEK`, `Losování dne: DD. MM. RRRR`
- 1. osudí: 5 čísel (1–50), 2. osudí: 2 euročísla (1–12), v pořadí vylosování
- `Extra 6`: 6 číslic
- `Vsazeno`, `Na výhry`
- **Kompletní tabulka všech 12 pořadí** — pořadí, počet uhodnutých čísel, počet výher, výše výher
- `JACKPOT`, případně věcné ceny (`Kód sázky` / `Hlavní výhra`)

Ukázka (2026, týden 37, úterý 8. 9. 2026):

```
EUROJACKPOT ÚTERÝ      Losování dne: 08. 09. 2026
1. osudí: 47 14 27 34 36     2. osudí: 4 3     Extra 6: 9 1 2 7 9 9
Vsazeno: 25 604 400 Kč       Na výhry: 11 415 295,00 Kč

Pořadí  Uhodnuto  Počet výher  Výše výher
I       5+2                 0           0 Kč
II      5+1                 0  15 070 584 Kč
III     5+0                 0   2 663 542 Kč
IV      4+2                 0      80 932 Kč
V       4+1                16       5 780 Kč
VI      3+2                21       3 692 Kč
VII     4+0                35       2 279 Kč
VIII    2+2               443         612 Kč
IX      3+1               652         416 Kč
X       3+0              1249         406 Kč
XI      1+2              2292         309 Kč
XII     2+1              8739         222 Kč
JACKPOT: 968 000 000 Kč
```

> **Pozor:** listina uvádí nenulovou výši výhry i tam, kde je počet výher nula (viz pořadí II
> a III výše). Vyhodnocení se proto musí řídit jen shodou čísel; `počet výher` je informativní
> údaj, ne podmínka výhry.

### Sportka

Ověřeno na 2026/36, 2015/10, 2005/10, 1994/10. Pro každý tah v týdnu dvě sekce — Sportka a Šance:

- `SPORTKA STŘEDA` / `PÁTEK` / `NEDĚLE`, `Losování dne:`
- 1. tah a 2. tah: 6 čísel (1–49) + dodatkové číslo
- Pro každý tah tabulka: `Bonus`, `I`–`V` (`6`, `5+dodatkové`, `5`, `4`, `3`)
- `Převod 1./2. pořadí`, `JACKPOT 1./2. pořadí` u každého tahu
- Za oběma tahy: `Převod Bonus`, `SuperJACKPOT`

Ukázka (2026, týden 36, středa 2. 9. 2026):

```
SPORTKA STŘEDA         Losování dne: 02. 09. 2026
1. tah: 21 5 37 18 34 19    dodatkové 42
2. tah: 40 15 34 32 24 22   dodatkové 20
Vsazeno: 35 817 510 Kč      Na výhry: 263 731 922,00 Kč

1. tah                              2. tah
-  Bonus            0        0 Kč   -  Bonus            0        0 Kč
I  6                0        0 Kč   I  6                0        0 Kč
II 5+dodatkové      1  985 862 Kč   II 5+dodatkové      0        0 Kč
III 5              33   18 994 Kč   III 5              23   27 252 Kč
IV 4             1208      889 Kč   IV 4             1037    1 036 Kč
V  3            21719      170 Kč   V  3            19966      185 Kč
Převod Bonus: 241 714 387 Kč        SuperJACKPOT: 251 000 000 Kč
```

### Šance

Samostatná sekce s vlastním losováním a vlastní tabulkou. Vylosováno je šest číslic; jednotlivá
pořadí se určují shodou koncového podřetězce. Ukázka (středa 2. 9. 2026, vylosováno `236412`):

```
ŠANCE STŘEDA           Losování dne: 02. 09. 2026
Vylosovaná čísla: 2 3 6 4 1 2        Vsazeno: 4 889 970 Kč

                        vzor   Počet výher   Výše výher
šestičíslí            236412             0         0 Kč
pětičíslí              36412             2   100 000 Kč
čtyřčíslí               6412            12    10 000 Kč
trojčíslí                412           138     1 000 Kč
dvojčíslí                 12          1445       100 Kč
koncové číslo              2         14637        50 Kč
koncové číslo +/- 1        —         32484        30 Kč
```

Na rozdíl od Extra 6 publikuje listina u Šance i částky, takže se nikde nemusí doplňovat.

---

## Kotvy pro parser

Legacy tiskový template. Ověřeno, že **stejné kotvy nese listina z roku 1994 i z roku 2026** —
struktura je pozoruhodně stabilní.

**HTML komentáře jako oddělovače sekcí** (nejspolehlivější vodítko):

```
<!-- losovana cisla -->     <!-- Extra 6 -->        <!-- vsazeno -->
<!-- vyhry -->              <!-- vyhry 1 tah. -->   <!-- vyhry 2 tah. -->
<!-- vyhry sance -->        <!-- prevod -->         <!-- Vecne ceny -->
```

**Třídy:** `frame0`, `frame2` (rámce sekcí), `loscisla` (řádek s taženými čísly),
`b2 s32b` (buňka jednoho čísla), `vyhry1`–`vyhry4` (sloupce tabulky výher), `hlavicka`.

**Formát částek:** `1&nbsp;234&nbsp;567&nbsp;Kč` — oddělovačem tisíců je nedělitelná mezera
(`&nbsp;`, U+00A0), desetinným oddělovačem čárka. Před převodem na číslo normalizovat.

### Pasti

1. **`id` sekcí jsou nespolehlivé.** Na stránce Eurojackpotu mají **obě** sekce — úterní i páteční
   — `id="emlPatek"`. Sekce dělit podle textu hlavičky (`EUROJACKPOT ÚTERÝ|PÁTEK`), ne podle `id`.
2. **Nedůvěřovat parametrům dotazu** při určování identity tahu (viz výhrada u roku 1994).
3. **Nepředpokládat počet sekcí.** Sportka měla historicky 2 tahy týdně, dnes 3.
4. **Historická data mohou být neúplná** — u roku 1994 je `Na výhry: 0,00 Kč`.
5. **Vedoucí nuly** u Extra 6 a Šance jsou významné — ukládat jako řetězec, nikdy jako číslo.
6. **Diakritika je v HTML jako číselné entity** — v surových bajtech stojí `SPORTKA ST&#x158;EDA`,
   ne `SPORTKA STŘEDA`. Před jakýmkoliv hledáním v textu je nutné entity dekódovat, jinak
   nadpisy sekcí nikdy nesednou:

   ```bash
   # nenajde nic:
   curl -s "…&game=sportka" | grep -c 'SPORTKA STŘEDA'
   # najde:
   curl -s "…&game=sportka" | python3 -c 'import sys,html; print(html.unescape(sys.stdin.read()).count("SPORTKA STŘEDA"))'
   ```

---

## Podmínky užití

### robots.txt

Doslovný obsah `https://www.allwyn.cz/robots.txt` k 9. 9. 2026:

```
User-agent: *
Disallow: /vyhledavani*
Disallow: /moje-sazky/
Disallow: /*searchtext*
Disallow: /api/
Sitemap: https://www.allwyn.cz/sitemap-index.xml
```

`/system/vyherka` mezi zakázanými cestami **není**. `/api/` ano — proto se nepoužije.

### Všeobecné podmínky herního portálu

Prošly `/obchodni-podminky/vseobecne-podminky-herniho-portalu-allwyn-cz`. Dvě relevantní pasáže:

- Zákaz robotů se týká výslovně **uzavírání sázek** přes Můj účet („automatický software, který
  nahrazuje vůli Účastníka tím, že se přihlašuje do Mého účtu, vybírá Sázkové příležitosti,
  automaticky uzavírá sázky").
- Zákaz přebírání se týká **kurzů sázkových příležitostí** a jen „pro účely vlastního podnikání
  bez souhlasu Allwyn".

Ani jedno se nevztahuje na odběr veřejně publikovaných výsledků loterií pro osobní potřebu.
Obecný zákaz automatizovaného čtení veřejných stránek podmínky neobsahují.

### Pravidla pro fetcher

- Za běhu stáhnout a vyhodnotit `robots.txt`; při zákazu cílové cesty **skončit chybou, ne obejít**.
- User-Agent:
  `kontrola-tiketu/0.1 (osobni offline kontrola tiketu; +https://github.com/petrf22/kontrola-tiketu)`
- Prodleva ≥ 2 s mezi dotazy, sekvenčně, nikdy paralelně.
- Uzavřený týden se z webu **nikdy nestahuje podruhé** — slouží archiv.
- Prázdný týden se přeskočí bez chyby a bez opakování.

---

## Odolnost zdroje

Adresa se může změnit a stránky mohou být omezeny. Záložní zdroj pro české částky neexistuje,
takže pojistkou je **vlastní archiv**, ne alternativní web.

### Rozpočet archivu (spočteno na reálně stažených listinách)

| | dotazů | surové HTML | gzip |
|---|---|---|---|
| Sportka 1994–2026 (~1700 týdnů) | 1700 | 100 MB | **5,4 MB** |
| Eurojackpot 2015–2026 (~620 týdnů) | 620 | 14 MB | **1,4 MB** |
| **celkem** | **~2320** | ~114 MB | **~6,8 MB** |

Jednorázové naplnění při prodlevě 2 s trvá **~1,3 hodiny**. Průběžný provoz je pak
**2 dotazy týdně** (jeden na hru), tedy ~104 za rok.

### Velikost výstupního JSON (změřeno, ne odhadnuto)

Změřeno na vzorku osmi reálných tahů (3 Eurojackpot, 5 Sportka včetně Šance):

| | na tah | celá historie (~5 400 tahů) |
|---|---|---|
| přehledně (odsazeně) | 3 525 B | **~19 MB** |
| kompaktně | 1 695 B | ~9 MB |
| gzip | 324 B | ~1,8 MB |

Celá historie v jednom přehledném souboru je tedy na git i na import do telefonu zbytečně
velká. Proto `preparsuj` umí omezit období — pro běžné použití stačí posledních pár měsíců,
což jsou desítky kilobajtů.

### Archivuje se surové HTML, ne jen vyparsovaná data

Pravděpodobnější než zmizení zdroje je chyba ve vlastním parseru. Se syrovou zálohou se přeparsuje
offline během vteřin; bez ní by se muselo ~2320krát stahovat znovu, což by už slušné chování
nebylo. Vedlejší přínos: hotový regresní korpus pro testy vyhodnocovacího jádra.

Fetcher proto bude mít dva režimy: `stahni` (síť → archiv) a `preparsuj` (archiv → JSON, bez sítě).

### Změna adresy nevyžaduje aktualizaci aplikace

Aplikace žádnou URL nezná — jejím jediným vstupem je importovaný JSON. Když Allwyn adresu změní
nebo stránky zavře, **mění se jen fetcher na desktopu**. URL a parsovací kotvy proto žijí v jednom
adaptéru, ne rozeseté po kódu.

---

## Otevřené body

1. **Pevné částky Extra 6.** Listina Eurojackpotu publikuje tažené číslice Extra 6, ale
   **tabulku výher pro ni ne** — Extra 6 má pevné částky uvedené v herním plánu. Zadání zakazuje
   mít částky natvrdo v kódu, takže se jednorázově vytáhnou z herního plánu
   (`static.sazka.cz/kentico-media/sazka/media/content/herni-plany/hp-sazka-5-9-25-sazka.pdf`)
   do verzovaného datového souboru `data/sazby-extra6.json` s polem `platnostOd`. Kód sazby nezná,
   jen je čte. Šance tenhle problém nemá.
2. **Přesná hranice archivu Sportky.** Ověřeno: 1994 ano, 1993 ne. Uvnitř roku 1993 nedohledáno —
   nepodstatné, backfill prostě začne prvním týdnem, který vrátí data.
3. **Chování číslování týdnů mezi 1994 a 1998.** Posun ověřen u 1994, nepřítomnost posunu u 1998.
   Roky 1995–1997 nedohledány. Nemá dopad, protože parser bere identitu tahu z obsahu listiny.
