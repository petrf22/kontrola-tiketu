# Původ fixtury

`vysledky-2026-35-az-37.json` je **skutečný výstup fetcheru**, ne ručně psaný soubor:

```bash
npm run vyherka -- preparsuj --od 2026-35 --do 2026-37 \
  --out app/test/fixtures/vysledky-2026-35-az-37.json \
  --sazby "$PWD/data/sazby-extra6.json"
```

Díky tomu test v `app/test/tok.test.ts` ověřuje, že spolu fetcher a aplikace doopravdy mluví.
Kdyby byl soubor psaný ručně, testoval by jen sám sebe.
