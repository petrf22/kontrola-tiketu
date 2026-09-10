# Vydání: verzování, podpis a cesta do Google Play

Stav k **9. 9. 2026**. Runbook i zápis rozhodnutí — když se tu něco tváří jako zbytečná
opatrnost, je to nejspíš zapsaná past, na kterou už někdo šlápl.

Předloha postupu je `~/pracovni/kvalita-cena` (`docs/vydani.md` tamtéž). Odchylky jsou
vyznačené.

---

## Verzování

**Zdroj pravdy je kořenový [`VERSION`](../VERSION) a [`CHANGELOG.md`](../CHANGELOG.md).**
Všechno ostatní se z nich generuje příkazem:

```bash
npm run verze
```

Skript `tools/verze/sync.mjs` přepíše osm commitovaných souborů:

| Soubor | Co |
|---|---|
| `package.json` | `"version"` |
| `app/package.json` | `"version"` |
| `fetcher/package.json` | `"version"` |
| `packages/jadro/package.json` | `"version"` |
| `packages/ocr/package.json` | `"version"` |
| `app/android/app/build.gradle` | `versionCode` + `versionName` |
| `app/src/app/data/verze.generated.ts` | verze a historie pro obrazovku „O aplikaci“ |
| `backend/src/Verze.php` | verze PHP backendu, kterou nese jeho User-Agent |

Ručně se needitují. Že sedí se zdrojem, hlídá `test/verze.test.ts` — předloha na to má CI
(`sync.mjs` + `git diff --exit-code`), tenhle projekt CI nemá, tak je pojistka v testech.

### versionCode

```
versionCode = major*10000 + minor*100 + patch
```

`0.1.0` → `100`, `1.0.0` → `10000`, `1.2.3` → `10203`. Roste monotónně s verzí, což je
podmínka Play: **jednou nahraný versionCode se už nikdy nesmí zopakovat ani snížit.** Skript
padá, když `minor` nebo `patch` přeteče přes 99 — `0.100.0` i `1.0.0` by daly `10000`
a Play by aktualizaci odmítl.

### Historie v aplikaci

Do `verze.generated.ts` jdou jen položky changelogu označené `(aplikace)` (a položky bez
suffixu). Změny fetcheru a jádra zůstávají v `CHANGELOG.md` — uživatele mobilu nezajímá, co
se změnilo v CLI na desktopu. *(Odchylka od předlohy, která posílá do appky všechno.)*

Generuje se **TypeScript modul**, ne JSON v assetech jako v předloze. Aplikace pak za běhu
nemusí nic číst ani stahovat, což u appky bez síťového oprávnění dává větší smysl.

---

## Podpisový klíč

Klíč je **trvalý artefakt**. Bez Play App Signing znamená jeho ztráta konec aktualizací —
aplikace se stejným `applicationId` už nikdy nepůjde vydat. Zálohuj ho mimo tenhle počítač.

```bash
mkdir -p ~/.keystores
keytool -genkeypair -v \
  -keystore ~/.keystores/kontrola-tiketu-release.jks \
  -alias kontrola-tiketu -keyalg RSA -keysize 4096 -validity 12000
```

Hesla a cesta patří do `~/.gradle/gradle.properties`, **nikdy do repozitáře**:

```properties
KONTROLA_TIKETU_STORE_FILE=/home/petr/.keystores/kontrola-tiketu-release.jks
KONTROLA_TIKETU_STORE_PASSWORD=…
KONTROLA_TIKETU_KEY_ALIAS=kontrola-tiketu
KONTROLA_TIKETU_KEY_PASSWORD=…
```

Otisk klíče (`keytool -list -v -keystore …`) si zapiš sem, ať jde kdykoli ověřit, že Play
podepisuje tím, čím má:

```
Alias:    kontrola-tiketu
Klíč:     4096-bit RSA, SHA384withRSA
SHA-256:  6B:36:88:46:F9:59:30:29:6D:F9:C0:A5:F3:9F:6B:7C:F4:0D:74:A9:1F:46:1A:B4:66:4E:A2:C7:4C:F3:C0:9D
Vytvořen: 10. 9. 2026, platí do 19. 7. 2059
```

`.gitignore` má `*.jks`, `*.keystore` i `keystore.properties` v kořeni i v `app/android/`.
Pravidla v kořenovém `.gitignore` jsou kvůli lomítku ukotvená na kořen a na `app/android/…`
nesedí — proto jsou i tam.

### Měkký podpis, tvrdá publikace

`app/android/app/build.gradle` založí `signingConfigs.release` **jen když jsou všechny čtyři
property k dispozici**; jinak release build spadne zpátky na ladicí klíč. Ověřit, že R8 nic
nerozbil, musí jít i na stroji, kde klíč není.

Tvrdé jsou až tyhle tasky — bez klíče selžou, a to **před** zdlouhavým R8 buildem:

```bash
cd app/android
./gradlew :app:publishableBundle    # AAB pro Play, ověřený jarsignerem
./gradlew :app:publishableApk       # APK pro sideload, ověřené apksignerem
```

Zvlášť, ne najednou — viz „Past: AAB a rozdělená APK se nesnesou“.

`jarsigner` se pouští bez `-strict` — klíč je self-signed a přísný režim by hlásil
`chainNotValidated`, i když je podpis v pořádku.

---

## Google Play

### applicationId

**`cz.petrf22.kontrolatiketu`.** Po prvním nahrání je nezměnitelné; jiné ID znamená novou
aplikaci a ztrátu všech instalací. Je zapsané v `capacitor.config.ts`, `build.gradle`
(`namespace` i `applicationId`), `strings.xml` (`package_name`, `custom_url_scheme`)
a v cestě `android/app/src/main/java/cz/petrf22/kontrolatiketu/`.

### Nahrávaný formát

Do Play jde **AAB** (`app/android/app/build/outputs/bundle/release/app-release.aab`).
Rozdělená APK zůstávají pro sideload mimo Play, kde na velkých APK vypršel Play Protect
(viz `CLAUDE.md`).

### Past: AAB a rozdělená APK se nesnesou

Se zapnutým `shrinkResources` vyrobí R8 zkrácené zdroje **zvlášť pro každou architekturu**
a sestavení bundlu pak spadne na:

```
Multiple shrunk-resources files found in directory '…/shrunk_resources_proto_format/release/minifyReleaseWithR8'
Please disable building multiple APKs when building an Android app bundle.
```

(AGP 8.13, [issuetracker 402800800](https://issuetracker.google.com/402800800).) Narazilo se
na to při prvním ostrém sestavení AAB 10. 9. 2026.

Řešení v `app/android/app/build.gradle`: `splits.abi.enable` se odvozuje od názvů požadovaných
tasků a pro bundle se rozdělení vypne. AAB si splity dělá sám, takže se tím nic neztrácí.

**Důsledek: AAB a APK se musí stavět dvěma oddělenými spuštěními Gradlu.** Když se zadají
najednou, build se zastaví hned v konfiguraci se srozumitelnou hláškou — bez té kontroly by
z toho tiše vyšlo jen univerzální APK (75 MB místo 26).

### Play App Signing

Doporučené zapnout: nahrávaný klíč zůstane u tebe, distribuční drží Google a ztráta
nahrávacího klíče se dá řešit. Bez něj je ztráta klíče neopravitelná.

### Herní politika — hlavní riziko celého vydání

Google Play má zvláštní pravidla pro **sázení, loterie a hazard**. Tahle aplikace pod ně
podle všeho nespadá, ale posuzovatel to musí poznat na první pohled, jinak hrozí zamítnutí:

- **neumožňuje sázet ani nic kupovat** — tiket si člověk koupil na pobočce, aplikace na něj
  jen kouká,
- **nepřijímá ani nevyplácí peníze**, nemá platby ani in-app nákupy,
- **nepropojuje se s provozovatelem** — nemá oprávnění k síti,
- **nesimuluje hazard**, nemá žádnou hru ani náhodu.

Do dlouhého popisu i do formulářů to musí být napsané výslovně. V popisu se vyhni formulacím,
které by šly číst jako slib výhry nebo jako nabídka sázení.

Content rating (IARC) se ptá mimo jiné na odkazy na hazard. Odpovědi si po prvním průchodu
zapiš sem, ať se příště nevymýšlejí znovu:

```
Kategorie: (doplnit)
Odkazy na hazard: (doplnit — aplikace hazard neumožňuje, ale odkazuje na reálnou loterii)
Výsledné hodnocení: (doplnit)
```

### Zásady ochrany osobních údajů

Play vyžaduje **veřejnou URL** se zásadami ochrany osobních údajů u každé aplikace, která
žádá o citlivé oprávnění — `CAMERA` mezi ně patří. Text je
v [`docs/zasady-ochrany-osobnich-udaju.md`](zasady-ochrany-osobnich-udaju.md).

Adresa do Play Console:

```
https://github.com/petrf22/kontrola-tiketu/blob/main/docs/zasady-ochrany-osobnich-udaju.md
```

Repozitář je veřejný a GitHub markdown vykresluje, takže je to použitelná stránka bez
zakládání webu. Odkaz míří na `main` schválně — zásady mají popisovat, co aplikace dělá teď,
ne co dělala v době vydání. **Když se repozitář kdykoli přepne na soukromý, přestane odkaz
fungovat a Play na to sáhne při první další aktualizaci.**

### Data safety

Odpověď je **„žádná data se neshromažďují ani nesdílejí“**. U téhle aplikace to není tvrzení,
ale ověřitelný fakt — v manifestu chybí `INTERNET` a kdokoli si to přečte v nahraném balíčku
(`aapt2 dump permissions`).

| Otázka | Odpověď |
|---|---|
| Shromažďuje aplikace data? | Ne |
| Sdílí aplikace data se třetími stranami? | Ne |
| Šifrování při přenosu | Neaplikovatelné — aplikace nekomunikuje po síti |
| Mazání dat na žádost | Data jsou jen na zařízení, smaže je odinstalace |

Fotoaparát se používá **výhradně na zařízení**: snímek pro rozpoznání textu žije v privátní
cache aplikace a maže se i při chybě (viz [`ocr-a-carovy-kod.md`](ocr-a-carovy-kod.md)).
Do galerie se nedostane a nikam se neodesílá. Číslo klubové karty, které je v čárovém kódu
tiketu čitelné, se zahazuje.

### Past: v manifestu je Googlí datatransport, a je to v pořádku

Kdo se podívá do manifestu sestaveného balíčku, najde tam komponenty, které tam nikdo
nepsal — zjištěno při vydání 0.1.1:

```
service  com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService
receiver androidx.profileinstaller.ProfileInstallReceiver
```

Vtahuje je **ML Kit** jako tranzitivní závislost; `datatransport` je Googlí přenosová vrstva
pro odesílání záznamů (Firelog). Zní to jako telemetrie, kterou zadání zakazuje.

**Odeslat ale nemá jak: aplikace nemá `INTERNET`.** Přesně kvůli tomuhle je absence síťového
oprávnění akceptační kritérium — je to záruka, kterou nejde obejít závislostí, na kterou se
zapomnělo. `android:permission="android.permission.BIND_JOB_SERVICE"` a `DUMP` u těchhle
komponent nejsou oprávnění, o která aplikace žádá; omezují, kdo je smí spouštět.

Ověřit je to na sestaveném balíčku takhle — musí vyjít jen `CAMERA` a vlastní
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`:

```bash
aapt2 dump permissions app-arm64-v8a-release.apk
```

Hlídá to `app/test/soukromi.test.ts`. **Kdyby někdo `INTERNET` kdy přidal, tahle komponenta
začne fungovat** — to je ten skutečný důvod, proč se oprávnění odstraňuje přes
`tools:node="remove"` a ne jen „nepřidává“.

### Texty pro store listing

Verzované tady, ne jen v Play Console.

**Krátký popis** (max 80 znaků):

```
Zkontroluj tiket Eurojackpotu a Sportky offline. Nic se nikam neodesílá.
```

**Dlouhý popis** (max 4000 znaků):

```
Zkontrolujte si papírový tiket Eurojackpotu nebo Sportky přímo v telefonu — bez toho, aby se
kdokoli dozvěděl, že sázíte nebo že jste vyhráli.

Aplikace nemá oprávnění k přístupu na internet. Není to opomenutí, ale záměr: bez něj nemůže
nic odeslat, ať by chtěla, nebo ne. Ověřit si to můžete v seznamu oprávnění aplikace.

CO APLIKACE UMÍ
• Vyfoťte tiket a aplikace z něj přečte vsazená čísla, doplňkovou hru i sériové číslo
• Nebo zadejte čísla ručně, když se fotka nepovede
• Vyhodnotí Eurojackpot i Sportku včetně Šance, Extra 6 a Bonusu
• Ukáže bilanci: kolik tiket stál a kolik zatím vynesl
• Drží tikety v šifrované databázi, klíč je v Android Keystore

JAK SE DOSTANOU DOVNITŘ VÝSLEDKY
Výsledky losování se do aplikace nahrají souborem, který si připravíte na počítači
z veřejně publikované výherní listiny. Aplikace si o ně sama nikam nechodí, takže se nikdo
nedozví, který tiket zrovna kontrolujete.

SOUKROMÍ
• Žádná analytika, žádný crash reporting, žádná telemetrie
• Nic se nedostane do cloudové zálohy
• Obrazovky jsou chráněné proti náhledům v přepínači aplikací
• Snímek pořízený kvůli rozpoznání čísel se hned maže a do galerie se nedostane
• Jediné oprávnění, o které aplikace žádá, je fotoaparát

CO APLIKACE NENÍ
Není to sázková aplikace. Nedá se v ní sázet, kupovat tikety ani platit. Nepropojuje se
s provozovatelem loterie a nemá k tomu ani technickou možnost. Pracuje jen s papírovým
tiketem, který už máte, a s veřejně publikovanými výsledky losování.

UPOZORNĚNÍ
Vyhodnocení je neoficiální a nezávazné. Aplikace nenahrazuje kontrolu tiketu — závazná je
vždy kontrola na terminálu provozovatele. Výhru lze uplatnit pouze tam, s platným papírovým
tiketem a ve stanovené lhůtě.
```

### Cesta do produkce

Nové vývojářské účty musí projít **uzavřeným testem: 12 testerů, kteří jsou přihlášení
souvisle 14 dní**, než Play pustí aplikaci do otevřené produkce. Počítej s tím při plánování.

---

## Postup vydání

Tenhle projekt je sólo a commituje se **přímo do `main`**, bez feature větví a bez PR.
*(Odchylka od předlohy, kde je `main` chráněná a release jde přes PR a CI.)*

1. Doplnit položky do `## [Nezveřejněno]` v `CHANGELOG.md` a přejmenovat sekci
   na `## [X.Y.Z] – RRRR-MM-DD`.
2. Zapsat `X.Y.Z` do `VERSION`.
3. `npm run verze` — přepíše osm generovaných souborů.
4. `git diff --stat` — musí ukázat právě těch osm plus `VERSION` a `CHANGELOG.md`.
   Cokoli navíc znamená, že skript sáhl, kam neměl; zastavit se.
5. `npm test` a `npm run typecheck`.
6. Commit a tag:
   ```bash
   git commit -am 'Vydat X.Y.Z'
   git tag -a vX.Y.Z -m 'Verze X.Y.Z'
   git push origin main
   git push origin vX.Y.Z
   ```
7. Sestavit AAB z tagu (níž) a nahrát do Play Console.

### Z čeho stavět

**Z tagu a v odděleném worktree**, ne z rozpracovaného hlavního checkoutu — jinak se do
vydaného balíčku snadno dostane něco, co v tagu není:

```bash
WORKDIR=$(mktemp -d -t kontrola-tiketu-vX.Y.Z-XXXX)
git worktree add "$WORKDIR" vX.Y.Z

# local.properties se negituje; bez něj build spadne na chybějící sdk.dir
cp app/android/local.properties "$WORKDIR/app/android/"

cd "$WORKDIR"
npm ci
export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd app && npx ng build && npx cap sync android
cd android
./gradlew :app:publishableBundle    # AAB pro Play
./gradlew :app:publishableApk       # APK na vyzkoušení na telefonu; zvlášť, ne najednou

mkdir -p ~/releases/kontrola-tiketu/vX.Y.Z
cp app/build/outputs/bundle/release/app-release.aab ~/releases/kontrola-tiketu/vX.Y.Z/
cp app/build/outputs/apk/release/app-arm64-v8a-release.apk ~/releases/kontrola-tiketu/vX.Y.Z/
```

Uklidit: `git worktree remove "$WORKDIR"`.

### Hotfix už vydané verze

```bash
git checkout -b oprava-X.Y.x vX.Y.Z
# oprava, VERSION → X.Y.(Z+1), npm run verze, commit
git tag -a vX.Y.(Z+1) -m 'Verze X.Y.(Z+1)'
```

---

## Kontrolní seznam před nahráním

- [ ] `npm test` prochází — hlavně `soukromi.test.ts`, který ověřuje i sestavené APK
      přes `aapt2`, že má jediné oprávnění `CAMERA`
- [ ] `npm run verze` nezmění žádný soubor
- [ ] `versionCode` v `output-metadata.json` je vyšší než naposledy nahraný do Play
- [ ] `publishableBundle` doběhl a vypsal „Podpis ověřen“
- [ ] aplikace nainstalovaná z release APK na telefonu funguje: fotka tiketu, import
      výsledků, vyhodnocení
- [ ] obrazovka „O aplikaci“ ukazuje správné číslo verze
- [ ] `AndroidManifest.xml` nemá `INTERNET` — zkontrolovat i v nahrávaném balíčku

## Co vydání ještě blokuje

- ~~Podpisový klíč~~ — vytvořen 10. 9. 2026, otisk výše. **Zálohovat mimo tenhle počítač;
  bez něj se aplikace se stejným `applicationId` už nikdy nevydá.**
- ~~Veřejná adresa se zásadami~~ — vyřešená, viz výše.
- **Šance u Sportky není ověřená na reálném tiketu.** Podoba Extra 6 u Eurojackpotu ověřená
  je, u Šance je vzor volnější a nikdo ho proti papíru neviděl. Proto je první verze `0.1.0`
  a míří na uzavřený test, ne rovnou do produkce.
