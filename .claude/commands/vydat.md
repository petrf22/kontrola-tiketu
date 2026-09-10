---
description: Vydat novou verzi — povýšit VERSION a CHANGELOG, otagovat, odeslat a sestavit podepsaný AAB pro Google Play
argument-hint: [X.Y.Z|major|minor|patch]
arguments: [bump]
---

Vydej novou verzi projektu. Postup je popsaný v `docs/vydani.md`, sekce „Postup vydání“ —
při rozporu platí ten dokument.

## Aktuální stav

Verze: !`cat VERSION`
Poslední tagy: !`git tag --list | sort -V | tail -5`
Větev a čistota stromu: !`git status -sb`
Commity od posledního tagu: !`git log $(git tag --list | sort -V | tail -1)..HEAD --oneline --no-merges 2>/dev/null || git log --oneline --no-merges`
Sekce `[Nezveřejněno]` v CHANGELOG.md: !`grep -n "Nezveřejněno" CHANGELOG.md || echo "(žádná)"`
Dnešní datum: !`date +%Y-%m-%d`

## Krok 0: Předpoklady

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
a suffix `(aplikace)`, `(jádro)` nebo `(fetcher)` podle toho, čeho se změna týká.

## Krok 3: Generované soubory

```bash
echo "X.Y.Z" > VERSION
npm run verze
git diff --stat
```

Musí se změnit právě těch sedm generovaných souborů plus `VERSION` a `CHANGELOG.md`.
**Cokoli navíc — zastav se a zeptej.**

## Krok 4: Kontrola

```bash
npm test
npm run typecheck
```

Obojí musí projít. `soukromi.test.ts` je tu ta podstatná část — hlídá akceptační kritéria
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
cp app/android/local.properties "$WORKDIR/app/android/"
cd "$WORKDIR" && npm ci
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd app && npx ng build && npx cap sync android
cd android
./gradlew :app:publishableBundle    # AAB pro Play
./gradlew :app:publishableApk       # APK na vyzkoušení na telefonu
```

**Zvlášť, ne najednou** — rozdělení APK podle architektur se se sestavením bundlu nesnese
a build se v takovém případě zastaví už v konfiguraci. Viz `docs/vydani.md`, „Past: AAB
a rozdělená APK se nesnesou“.

`local.properties` se negituje — bez zkopírování build spadne na chybějící `sdk.dir`.
`publishableBundle` bez podpisového klíče selže; to je záměr, viz `docs/vydani.md`.

Artefakt ulož mimo worktree a worktree ukliď:

```bash
mkdir -p ~/releases/kontrola-tiketu/vX.Y.Z
cp "$WORKDIR/app/android/app/build/outputs/bundle/release/app-release.aab" ~/releases/kontrola-tiketu/vX.Y.Z/
cp "$WORKDIR/app/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk" ~/releases/kontrola-tiketu/vX.Y.Z/
git worktree remove "$WORKDIR"
```

## Krok 8: Shrnutí

Vypiš verzi, `versionCode`, cestu k `.aab` a připomeň, co musí udělat člověk ručně:

- projít kontrolní seznam v `docs/vydani.md`,
- nahrát AAB do Play Console a vyplnit „Co je nového“ z čerstvé sekce `CHANGELOG.md`,
- **do Play Console se nepřihlašuj a nic tam nenahrávej sám.**
