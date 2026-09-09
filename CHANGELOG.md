# Změny

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/), text je česky (konvence
repa, viz `CLAUDE.md`). Postup vydání popisuje [`docs/vydani.md`](docs/vydani.md).

Tenhle soubor a kořenový `VERSION` jsou **zdroj pravdy o verzi**. Čísla verzí v `package.json`,
`versionCode`/`versionName` v `app/android/app/build.gradle` i historie zobrazená v aplikaci
z nich vznikají přes `npm run verze` — needituj je ručně.

**Každá položka musí být na jednom řádku** — parser víceřádkové položky neumí a raději spadne,
než by je tiše uřízl. Dlouhý řádek je tu žádoucí kompromis za jednoduchost skriptu.

Suffix v závorce na konci položky říká, čeho se změna týká: `(aplikace)`, `(jádro)`, `(fetcher)`.
Do historie v aplikaci se dostanou jen položky označené `aplikace` — uživatele mobilu nezajímá,
co se změnilo v CLI na desktopu.

## [0.1.0] – 2026-09-09

### Přidáno
- Vyfocení tiketu: jedna fotka přečte čísla ve sloupcích, doplňkovou hru Extra 6 i sériové číslo z čárového kódu (aplikace)
- Sken samotného čárového kódu pro případ, že fotka kód nezachytí nebo snímek pořizovat nechceš (aplikace)
- Ruční zadání tiketu, když se ho nepodaří přečíst ani jedním způsobem (aplikace)
- Vyhodnocení Eurojackpotu a Sportky včetně doplňkových her Extra 6 a Šance (jádro)
- Výherní částky Eurojackpotu se berou z tabulky konkrétního tahu, protože jsou totalizátorové a nedají se spočítat dopředu (jádro)
- Seznam tiketů se souhrnem výhry a detail s rozpisem po sloupcích a jednotlivých losováních (aplikace)
- Bilance tiketu: kolik stál a kolik zatím vynesl (aplikace, jádro)
- Import výsledků losování ze souboru — aplikace si o ně sama nikam nechodí (aplikace)
- Obrazovka „O aplikaci“ s číslem verze, historií změn a přehledem toho, co aplikace o uživateli neví (aplikace)
- Šifrovaná databáze SQLCipher s klíčem v Android Keystore (aplikace)
- Aplikace nemá oprávnění k síti, takže se provozovatel loterie nemá jak dozvědět, že zrovna ty sázíš nebo jsi vyhrál (aplikace)
- Snímek pořízený pro rozpoznání textu žije jen v privátní cache, maže se i při chybě a do galerie se nedostane (aplikace)
- Číslo klubové karty, které je v čárovém kódu čitelné, se rovnou zahazuje — neukládá se ani nezobrazuje (aplikace)
- Fetcher: stahování veřejných výherních listin Allwyn za období a převod na JSON pro import do aplikace (fetcher)
- Výsledky losování za roky 2021 až 2026, celkem 1190 tahů, verzované přímo v repozitáři (fetcher)
