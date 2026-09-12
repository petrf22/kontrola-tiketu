#!/usr/bin/env python3
"""Generátor ikony, splash screenu a grafiky pro Google Play.

Spouští se ručně: `python3 tools/ikony/generuj.py` (potřebuje Pillow).

Motiv je vykreslený kódem, ne exportovaný z editoru — díky tomu jde kdykoli změnit barva
nebo proporce a znovu rozgenerovat všechny velikosti, aniž by se hledal zdrojový soubor.
Stejný důvod má `tools/icons/generate.py` v projektu kvalita-cena.

Symbol: bílý tiket se sloupcem vsazených čísel a zeleným zaškrtnutím. Musí být čitelný
i na 48 px, proto žádné jemné detaily — na malé ikoně splynou v šum.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

KOREN = Path(__file__).resolve().parents[2]
RES = KOREN / "app/android/app/src/main/res"

# Tmavě zelená: „zkontrolováno“. Musí být dost tmavá, aby na ní bílý tiket držel kontrast
# i na světlém pozadí seznamu aplikací.
POZADI = (11, 93, 59)
TIKET = (255, 255, 255)
NEVYPLNENE = (198, 214, 205)

# Kreslí se ve zvětšení a pak zmenšuje — Pillow neumí vyhlazování hran přímo.
NASOBEK = 8


def _kruh(kresba, stred, polomer, barva):
    x, y = stred
    kresba.ellipse([x - polomer, y - polomer, x + polomer, y + polomer], fill=barva)


def _tlusta_cara(kresba, body, sirka, barva):
    """Čára se zakulacenými konci i ohybem — samotné `line` nechává useknuté rohy."""
    kresba.line(body, fill=barva, width=int(sirka))
    for bod in body:
        _kruh(kresba, bod, sirka / 2, barva)


def symbol(velikost: int, podil: float = 1.0) -> Image.Image:
    """Průhledný čtverec `velikost` px se symbolem zabírajícím `podil` jeho šířky."""
    plocha = velikost * NASOBEK
    obraz = Image.new("RGBA", (plocha, plocha), (0, 0, 0, 0))
    kresba = ImageDraw.Draw(obraz)

    # Vnitřní souřadnice jsou v setinách plochy symbolu, ať se dá motiv popsat nezávisle
    # na výsledné velikosti.
    strana = plocha * podil
    posun = (plocha - strana) / 2
    j = lambda h: posun + strana * h / 100.0
    d = lambda h: strana * h / 100.0

    kresba.rounded_rectangle([j(6), j(18), j(94), j(82)], radius=d(9), fill=TIKET)

    # Sloupec vsazených čísel: dvě odškrtnutá, jedno ne.
    for poradi, y in enumerate((32, 50, 68)):
        _kruh(kresba, (j(26), j(y)), d(6.5), POZADI if poradi != 1 else NEVYPLNENE)

    _tlusta_cara(kresba, [(j(48), j(58)), (j(60), j(71)), (j(84), j(33))], d(11), POZADI)

    return obraz.resize((velikost, velikost), Image.LANCZOS)


def na_pozadi(velikost: int, podil: float, kulate: bool = False) -> Image.Image:
    """Symbol na plném zeleném podkladu — čtvercovém, nebo kruhovém."""
    plocha = velikost * NASOBEK
    obraz = Image.new("RGBA", (plocha, plocha), (0, 0, 0, 0))
    kresba = ImageDraw.Draw(obraz)
    if kulate:
        kresba.ellipse([0, 0, plocha - 1, plocha - 1], fill=POZADI)
    else:
        kresba.rounded_rectangle([0, 0, plocha - 1, plocha - 1], radius=plocha * 0.17, fill=POZADI)
    obraz = obraz.resize((velikost, velikost), Image.LANCZOS)
    obraz.alpha_composite(symbol(velikost, podil))
    return obraz


def uloz(obraz: Image.Image, cesta: Path) -> None:
    cesta.parent.mkdir(parents=True, exist_ok=True)
    obraz.save(cesta, "PNG")
    print(f"  {cesta.relative_to(KOREN)}  {obraz.size[0]}×{obraz.size[1]}")


# --- Ikona aplikace ---------------------------------------------------------------------

# mdpi je základ, ostatní jsou jeho násobky.
HUSTOTY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def ikony() -> None:
    print("Ikona aplikace:")
    for nazev, nasobek in HUSTOTY.items():
        adresar = RES / f"mipmap-{nazev}"

        # Starší Android bere ikonu tak, jak je — proto rovnou s podkladem.
        uloz(na_pozadi(int(48 * nasobek), 0.68), adresar / "ic_launcher.png")
        uloz(na_pozadi(int(48 * nasobek), 0.62, kulate=True), adresar / "ic_launcher_round.png")

        # Adaptivní ikona (Android 8+): podklad je barva z values/ic_launcher_background.xml
        # a tohle je jen popředí. Systém z něj ořízne libovolný tvar a při animacích s ním
        # hýbe, takže symbol smí zabrat jen vnitřních 66 ze 108 dílů plochy.
        uloz(symbol(int(108 * nasobek), 66 / 108 * 0.92), adresar / "ic_launcher_foreground.png")

    barva = "#%02X%02X%02X" % POZADI
    cesta = RES / "values/ic_launcher_background.xml"
    cesta.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{barva}</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    print(f"  {cesta.relative_to(KOREN)}  {barva}")


# --- Splash screen ----------------------------------------------------------------------

SPLASH = {
    "mdpi": (320, 480),
    "hdpi": (480, 800),
    "xhdpi": (720, 1280),
    "xxhdpi": (960, 1600),
    "xxxhdpi": (1280, 1920),
}


def splash_obraz(sirka: int, vyska: int) -> Image.Image:
    obraz = Image.new("RGBA", (sirka, vyska), (*POZADI, 255))
    strana = int(min(sirka, vyska) * 0.34)
    obraz.alpha_composite(symbol(strana), ((sirka - strana) // 2, (vyska - strana) // 2))
    return obraz


def splashe() -> None:
    print("Splash screen:")
    for nazev, (sirka, vyska) in SPLASH.items():
        uloz(splash_obraz(sirka, vyska), RES / f"drawable-port-{nazev}/splash.png")
        uloz(splash_obraz(vyska, sirka), RES / f"drawable-land-{nazev}/splash.png")
    # Záloha bez kvalifikátoru, kdyby zařízení nesedělo do žádné kategorie.
    uloz(splash_obraz(480, 320), RES / "drawable/splash.png")


# --- Grafika pro Google Play ------------------------------------------------------------

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Dřív tu stálo „Offline. Nic se nikam neodesílá.“ Od stahování výsledků aplikace offline
# není; co platí dál, je že z telefonu neodchází nic o tiketech.
NADPIS = "Kontrola tiketu"
PODNADPIS = "Tikety nikam neodesílá."


def _font_do_sirky(text: str, max_sirka: int, max_velikost: int):
    """Největší velikost písma, při které se text ještě vejde. None, když font chybí."""
    for velikost in range(max_velikost, 9, -1):
        try:
            pismo = ImageFont.truetype(FONT, velikost)
        except OSError:
            return None
        if pismo.getbbox(text)[2] <= max_sirka:
            return pismo
    return None


def play() -> None:
    print("Google Play:")
    zde = Path(__file__).parent

    # Ikona listingu: 512×512, bez průhlednosti — rohy si Play zaobluje sám.
    ikona = Image.new("RGB", (512, 512), POZADI)
    ikona.paste(symbol(512, 0.72), (0, 0), symbol(512, 0.72))
    uloz(ikona.convert("RGBA"), zde / "play-ikona-512.png")

    # Feature grafika: 1024×500, symbol vlevo, název vpravo. Play grafiku na některých
    # místech ořezává od krajů, proto se text drží uvnitř bezpečného pruhu.
    feature = Image.new("RGBA", (1024, 500), (*POZADI, 255))
    feature.alpha_composite(symbol(280), (90, 110))
    kresba = ImageDraw.Draw(feature)

    text_x, sirka_textu = 430, 1024 - 430 - 70
    nadpis = _font_do_sirky(NADPIS, sirka_textu, 80)
    podnadpis = _font_do_sirky(PODNADPIS, sirka_textu, 34)
    if nadpis is None or podnadpis is None:
        print(f"  (font {FONT} nenalezen, feature grafika bude bez textu)")
    else:
        kresba.text((text_x, 210), NADPIS, font=nadpis, fill=TIKET, anchor="ls")
        kresba.text((text_x, 280), PODNADPIS, font=podnadpis, fill=NEVYPLNENE, anchor="ls")
    uloz(feature, zde / "play-feature-1024x500.png")


if __name__ == "__main__":
    ikony()
    splashe()
    play()
    print("\nHotovo. Ikonu i splash si prohlédni na zařízení — na 48 px vypadá všechno jinak.")
