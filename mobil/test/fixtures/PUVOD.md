# Původ fixtury

`vysledky-2026-35-az-37.json` je **skutečný balík výsledků**, ne ručně psaný soubor. Vyrábí ho
backend ze skutečných listin Allwyn a tentýž soubor leží v backendu jako
`backend/tests/fixtures/vysledky-2026-35-az-37.json`:

```bash
cd backend
php bin/vyherka preparsuj --archiv tests/fixtures --od 2026-35 --do 2026-37 \
  --out tests/fixtures/vysledky-2026-35-az-37.json
```

Aplikace nečte nic mimo `mobil/`, proto má vlastní kopii. Je to smlouva o formátu: díky ní
testy v `test/tok.test.ts` a `test/stahovani.test.ts` ověřují, že aplikace rozumí tomu, co
backend publikuje. Kdyby byl soubor psaný ručně, testoval by jen sám sebe. Když backend změní
formát (`verzeFormatu`), kopie se tady vymění.
