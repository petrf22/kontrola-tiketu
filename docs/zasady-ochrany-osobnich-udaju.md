# Zásady ochrany osobních údajů

Aplikace **Kontrola tiketu** (`cz.petrf22.kontrolatiketu`)

Platné od 9. 9. 2026.

## Shrnutí

**Aplikace neshromažďuje, neodesílá ani nesdílí žádné osobní údaje.** Všechno, co do ní
zadáte nebo vyfotíte, zůstává na vašem zařízení.

Není to slib, který byste museli brát na dobrou víru. Aplikace **nemá oprávnění k přístupu
na internet** — v systému Android o něj vůbec nežádá a bez něj nemůže navázat žádné síťové
spojení. Ověřit si to můžete v nastavení telefonu v seznamu oprávnění aplikace, nebo přímo
v instalačním balíčku.

## Jaké údaje aplikace zpracovává

Všechny níže uvedené údaje se zpracovávají **výhradně na vašem zařízení**:

| Údaj | Odkud | Kde končí |
|---|---|---|
| Vsazená čísla, hra, termíny losování, cena tiketu | z fotky tiketu, ze skenu čárového kódu, nebo je zadáte ručně | šifrovaná databáze v aplikaci |
| Sériové číslo tiketu | z čárového kódu na tiketu | šifrovaná databáze; slouží k rozpoznání už zadaného tiketu |
| Výsledky losování | soubor, který do aplikace sami naimportujete | šifrovaná databáze |

Databáze je šifrovaná (SQLCipher) a klíč k ní je uložený v Android Keystore, tedy v hardwarově
chráněném úložišti telefonu.

## Fotoaparát

Jediné oprávnění, o které aplikace žádá, je **přístup k fotoaparátu**. Používá se ke dvěma
věcem: k načtení čísel z tiketu a k načtení čárového kódu.

- Čárový kód se čte přímo z obrazu kamery a **žádný snímek nevzniká**.
- Pro načtení čísel je potřeba snímek pořídit. Ukládá se do **privátní cache aplikace**, kam
  jiné aplikace nevidí, zpracuje se přímo v telefonu a **smaže se hned potom** — i v případě,
  že se rozpoznání nepovede nebo skončí chybou.
- Snímek se **nikdy nedostane do galerie** a nikam se neodesílá.

Rozpoznávání textu i čárového kódu běží na zařízení (ML Kit, on-device). Nic se kvůli němu
neposílá na server.

## Číslo klubové karty

V čárovém kódu tiketu je čitelně obsažené číslo klubové karty, pokud jste ji při sázení
použili. Aplikace ho **zahazuje ihned po přečtení kódu** — neukládá ho a nezobrazuje.

## Co aplikace nedělá

- neobsahuje analytiku, měření používání ani telemetrii — ani ve vývojové verzi
- neobsahuje hlášení pádů
- neobsahuje reklamu ani reklamní identifikátory
- nesdílí nic se třetími stranami
- nepoužívá účet Google ani žádné přihlášení
- nepovoluje zálohování do cloudu (`allowBackup="false"`), takže se data nedostanou ani do
  zálohy Google

## Vaše data a jejich smazání

Data existují pouze na vašem zařízení. Smazat je můžete kdykoli přímo v aplikaci, vymazáním
dat aplikace v nastavení systému, nebo odinstalací — tím zmizí všechna.

Protože se nic neodesílá, neexistuje žádná kopie, o jejíž smazání by bylo nutné někoho žádat.

## Děti

Aplikace není určena dětem. Nesbírá žádné údaje, tedy ani údaje o dětech.

## Změny těchto zásad

Případné změny budou zveřejněné v tomto souboru spolu s datem platnosti a shrnuté
v [historii změn](../CHANGELOG.md).

## Kontakt

Petr Franta — petr.franta@gmail.com
