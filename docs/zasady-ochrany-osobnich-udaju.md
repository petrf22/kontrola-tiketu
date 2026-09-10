# Zásady ochrany osobních údajů

Aplikace **Kontrola tiketu** (`cz.petrf22.kontrolatiketu`)

Platné od 11. 9. 2026.

## Shrnutí

**Aplikace neshromažďuje, neodesílá ani nesdílí žádné osobní údaje.** Všechno, co do ní
zadáte nebo vyfotíte — vsazená čísla, sériová čísla tiketů i výsledek vyhodnocení —
zůstává na vašem zařízení.

Na internet aplikace chodí jen pro jednu věc: **stáhnout veřejné výsledky losování**.
Stahuje je celé, pro všechny uživatele stejně, a tikety vyhodnotí až v telefonu. Podrobnosti
jsou v části [Stahování výsledků losování](#stahování-výsledků-losování).

Není to slib, který byste museli brát na dobrou víru: systém Android aplikaci dovolí navázat
šifrované spojení **jedině se serverem výsledků** — k jakékoli jiné adrese spojení nepustí.
Je to zapsané v instalačním balíčku a dá se to tam ověřit.

## Jaké údaje aplikace zpracovává

Všechny níže uvedené údaje se zpracovávají **výhradně na vašem zařízení**:

| Údaj | Odkud | Kde končí |
|---|---|---|
| Vsazená čísla, hra, termíny losování, cena tiketu | z fotky tiketu, ze skenu čárového kódu, nebo je zadáte ručně | šifrovaná databáze v aplikaci |
| Sériové číslo tiketu | z čárového kódu na tiketu | šifrovaná databáze; slouží k rozpoznání už zadaného tiketu |
| Výsledky losování | stažené ze serveru výsledků, nebo ze souboru, který sami naimportujete | šifrovaná databáze |

Databáze je šifrovaná (SQLCipher) a klíč k ní je uložený v Android Keystore, tedy v hardwarově
chráněném úložišti telefonu.

## Fotoaparát

Aplikace žádá o **přístup k fotoaparátu** (a o přístup k internetu kvůli výsledkům, viz níže).
Fotoaparát se používá ke dvěma věcem: k načtení čísel z tiketu a k načtení čárového kódu.

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

## Stahování výsledků losování

Aplikace si po otevření a na požádání stáhne výsledky losování ze serveru, který provozuje
autor aplikace. Server je získává z veřejných výherních listin provozovatele loterie; aplikace
sama s provozovatelem loterie **nijak nekomunikuje**.

- Stahuje se **vždy všechno**: seznam balíků a pak celé balíky výsledků po letech. Aplikace
  nevybírá podle toho, jaké tikety máte, a nic takového serveru ani nemá jak sdělit.
- Požadavek je **pro všechny uživatele stejný**: žádné vsazené číslo, žádné sériové číslo
  tiketu, žádný identifikátor zařízení nebo uživatele, žádné cookies, žádné přihlášení.
  Aplikace posílá i stejné označení prohlížeče, takže server nevidí ani model telefonu.
- Co server vidí: jako u každé webové stránky může hosting do provozního záznamu zapsat
  **IP adresu a čas požadavku**. S žádným tiketem to spojit nejde, protože se o tiketech
  nic neposílá.
- Spojení je vždy šifrované (HTTPS) a systém ho nepustí k žádné jiné adrese než k serveru
  výsledků.

Když server není dostupný, dají se výsledky do aplikace dostat i souborem.

## Co aplikace nedělá

- neodesílá vsazená čísla, sériová čísla tiketů ani výsledky vyhodnocení — nikomu a nikam
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

Protože se z vašich dat nic neodesílá, neexistuje žádná kopie, o jejíž smazání by bylo nutné
někoho žádat. Provozní záznamy serveru výsledků (IP adresa a čas stažení) spravuje hosting
a maže je podle svých pravidel; s dotazem na ně se můžete obrátit na kontakt níže.

## Děti

Aplikace není určena dětem. Nesbírá žádné osobní údaje, tedy ani údaje o dětech.

## Změny těchto zásad

Případné změny budou zveřejněné v tomto souboru spolu s datem platnosti a shrnuté
v [historii změn](../CHANGELOG.md).

## Kontakt

Petr Franta — petr.franta@gmail.com
