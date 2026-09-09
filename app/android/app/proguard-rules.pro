# Pravidla pro R8.
#
# Zásada: nic plošného. `-keep class **` sice spraví každý pád, ale fakticky vypne
# minifikaci a ověření release buildu by pak nedokazovalo nic. Každé pravidlo níž má
# vedle sebe důvod, proč tam je.

# --- Capacitor -------------------------------------------------------------------
# Pluginy se instancují reflexí podle jmen tříd z konfigurace a metody označené
# @PluginMethod hledá most z JavaScriptu podle jména. Bez tohohle by se přejmenovaly
# a most by je nenašel.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# Pluginy tohoto projektu, taky hledané podle jména.
-keep class com.getcapacitor.community.database.sqlite.** { *; }
-keep class io.capawesome.capacitorjs.plugins.mlkit.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# --- SQLCipher -------------------------------------------------------------------
# Nativní vrstva volá zpět do Javy podle jmen (JNI), takže přejmenování rozbije vazbu.
-keep class net.zetetic.database.** { *; }
-keep class net.sqlcipher.** { *; }

# --- ML Kit ----------------------------------------------------------------------
# Modely a jejich zavaděče se hledají reflexí; anotace @KeepName na to R8 upozorňuje.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep @com.google.android.gms.common.annotation.KeepName class *
-keepclassmembers class * {
    @com.google.android.gms.common.annotation.KeepName *;
}

# --- Ostatní ---------------------------------------------------------------------
# WebView most předává JavaScriptu objekty přes @JavascriptInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Čitelné stack trace z release buildu. Bez tohohle je hlášení pádu k ničemu.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
