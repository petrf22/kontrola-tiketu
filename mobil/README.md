# app

Mobilní aplikace — Angular 22 + Capacitor 8, **bez oprávnění k síti**.

Popis projektu je v [kořenovém README](../README.md), závazné zadání
v [`zadani-kontrola-tiketu.md`](../zadani-kontrola-tiketu.md) a postup vydání
v [`docs/vydani.md`](../docs/vydani.md).

```bash
npx ng serve     # vývoj v prohlížeči (úložiště je jen v paměti, po zavření je pryč)
npx ng build     # web do dist/

export ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npx cap sync android
cd android && ./gradlew :app:assembleDebug
```

Testy se pouštějí z kořene repozitáře (`npm test`), ne odsud — `app/test/soukromi.test.ts`
hlídá akceptační kritéria ze zadání a kontroluje i sestavené APK.

**Nesahej na `android/app/src/main/AndroidManifest.xml` bez rozmyslu.** Odstranění `INTERNET`,
`allowBackup="false"` a `FLAG_SECURE` v `MainActivity` jsou akceptační kritéria.
