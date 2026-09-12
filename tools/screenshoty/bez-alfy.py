#!/usr/bin/env python3
"""Převede snímky na 24bitové PNG bez alfa kanálu a zkontroluje rozměr.

Google Play průhlednost u screenshotů odmítá. Chrome ji do PNG dává vždycky, i když je
obrázek neprůhledný, takže se sem musí sáhnout po každém generování.
"""

from pathlib import Path

from PIL import Image

OCEKAVANY_ROZMER = (1080, 1920)

zde = Path(__file__).parent
for soubor in sorted(zde.glob("*.png")):
    with Image.open(soubor) as obraz:
        rozmer, rezim = obraz.size, obraz.mode
        if rezim != "RGB":
            obraz.convert("RGB").save(soubor)
    stav = "ok" if rozmer == OCEKAVANY_ROZMER else f"POZOR: čekal jsem {OCEKAVANY_ROZMER}"
    print(f"{soubor.name}: {rozmer[0]}×{rozmer[1]} {rezim} → RGB, {stav}")
