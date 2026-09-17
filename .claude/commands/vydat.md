---
description: Vydat novou verzi — povýšit VERSION a CHANGELOG, otagovat, odeslat a sestavit podepsaný AAB pro Google Play
argument-hint: [X.Y.Z|major|minor|patch]
arguments: [bump]
---

Vydej novou verzi projektu. Postup je popsaný v `mobil/docs/vydani.md`, sekce „Postup vydání“ —
při rozporu platí ten dokument.

## Aktuální stav

Kořen repozitáře: !`git rev-parse --show-toplevel`
Verze: !`cat "$(git rev-parse --show-toplevel)/VERSION"`
Poslední tagy: !`git tag --list | sort -V | tail -5`
Větev a čistota stromu: !`git status -sb`
Commity od posledního tagu: !`git log $(git tag --list | sort -V | tail -1)..HEAD --oneline --no-merges 2>/dev/null || git log --oneline --no-merges`
Sekce `[Nezveřejněno]` v CHANGELOG.md: !`grep -n "Nezveřejněno" "$(git rev-parse --show-toplevel)/CHANGELOG.md" || echo "(žádná)"`
Dnešní datum: !`date +%Y-%m-%d`

## Krok 0: Předpoklady

Všechny cesty v dalších krocích jsou relativní ke kořeni repozitáře (výše). Session může stát
v podadresáři, třeba v `mobil/` — příkazy proto spouštěj s absolutní cestou nebo z kořene.

Větev musí být `main` a `git status --short` prázdný. Tenhle projekt commituje přímo do
`main`, bez feature větví a bez PR. Když je něco rozdělaného, zastav se a řekni to.

## Krok 1: Určit novou verzi

`$bump` je buď rovnou `X.Y.Z`, nebo `major`/`minor`/`patch`. Když je prázdný, navrhni podle
povahy commitů od posledního tagu a zeptej se.

Verze pod `1.0.0` znamená, že aplikace míří na uzavřený test. Přechod na `1.0.0` je
rozhodnutí uživatele, nedělej ho sám.

## Krok 2: CHANGELOG.md

Sekci `## [Nezveřejněno]` přejmenuj na `## [X.Y.Z] – <dnešní datum>`. Když žádná není, sepiš
položky z commitů od posledního tagu — ale **uživatelsky**, ne přepisem commit zpráv: co
člověk uvidí, ne co se změnilo v kódu.

Pravidla formátu jsou v hlavičce `CHANGELOG.md`. Podstatné: každá položka na jednom řádku
a suffix `(aplikace)`, `(jádro)`, `(backend)` nebo `(build)` podle toho, čeho se změna týká.

## Krok 3: Generované soubory

```bash
echo "X.Y.Z" > VERSION
node nastroje/verze/sync.mjs
git diff --stat
```

Musí se změnit právě ty čtyři generované soubory (`mobil/package.json`,
`mobil/android/app/build.gradle`, `mobil/src/app/data/verze.generated.ts`,
`backend/src/Verze.php`) plus `VERSION` a `CHANGELOG.md`.
**Cokoli navíc — zastav se a zeptej.**

## Krok 4: Kontrola

```bash
(cd mobil && npm test && npm run typecheck)
(cd backend && composer test && composer phpstan)
node --test 'nastroje/**/*.test.mjs'
```

Všechno musí projít. `soukromi.test.ts` je tu ta podstatná část — hlídá akceptační kritéria
ze zadání.

## Krok 5: Commit a tag

```bash
git commit -am 'Vydat X.Y.Z'
git tag -a vX.Y.Z -m 'Verze X.Y.Z'
```

## Krok 6: ZASTAVIT SE a zeptat na push

Shrň: novou verzi, `versionCode`, co bude pushnuto. Zeptej se, jestli pushnout `main` a tag
na `origin`. **Bez výslovného souhlasu nepushuj.**

```bash
git push origin main
git push origin vX.Y.Z
```

## Krok 7: Sestavit AAB z tagu

Stavět se musí z tagu a v odděleném worktree, ne z hlavního checkoutu:

```bash
WORKDIR=$(mktemp -d -t kontrola-tiketu-vX.Y.Z-XXXX)
git worktree add "$WORKDIR" vX.Y.Z
cp mobil/android/local.properties "$WORKDIR/mobil/android/"
cd "$WORKDIR/mobil" && npm ci
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npx ng build && npx cap sync android
cd android
./gradlew :app:publishableBundle    # AAB pro Play
./gradlew :app:publishableApk       # APK na vyzkoušení na telefonu
```

**Zvlášť, ne najednou** — rozdělení APK podle architektur se se sestavením bundlu nesnese
a build se v takovém případě zastaví už v konfiguraci. Viz `mobil/docs/vydani.md`, „Past: AAB
a rozdělená APK se nesnesou“.

`local.properties` se negituje — bez zkopírování build spadne na chybějící `sdk.dir`.
`publishableBundle` bez podpisového klíče selže; to je záměr, viz `mobil/docs/vydani.md`.

Artefakt ulož mimo worktree a worktree ukliď:

```bash
mkdir -p ~/releases/kontrola-tiketu/vX.Y.Z
cp "$WORKDIR/mobil/android/app/build/outputs/bundle/release/app-release.aab" ~/releases/kontrola-tiketu/vX.Y.Z/
cp "$WORKDIR/mobil/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk" ~/releases/kontrola-tiketu/vX.Y.Z/
git worktree remove "$WORKDIR"
```

## Krok 8: Poznámky k vydání pro Google Play

Sepiš text do pole *Poznámky k vydání* podle `mobil/docs/vydani.md`, „Poznámky k vydání pro
Google Play“: položky `(aplikace)` z `CHANGELOG.md` od předchozího tagu, přepsané pro uživatele,
vykání, odrážky `•`, obalené `<cs-CZ>` a `</cs-CZ>`, **nejvýš 500 znaků** (spočítej, neodhaduj).
Ulož ho do `~/releases/kontrola-tiketu/vX.Y.Z/poznamky-k-vydani.txt`.

## Krok 9: Shrnutí

Vypiš verzi, `versionCode`, cestu k `.aab`, **celé poznámky k vydání v bloku kódu** (ať jdou
zkopírovat) s počtem znaků a od které verze počítají, a připomeň, co musí udělat člověk ručně:

- projít kontrolní seznam v `mobil/docs/vydani.md`,
- nahrát AAB do Play Console a vložit poznámky k vydání — když se některá verze od předchozího
  tagu do Play nenahrála, říct si o rozšíření poznámek,
- **do Play Console se nepřihlašuj a nic tam nenahrávej sám.**
