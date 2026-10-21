/**
 * Napojení pořízení snímku na Capacitor.
 *
 * Oddělené od `snimekTiketu.ts` schválně: tam je postup a záruka úklidu, tady jen tenká
 * vrstva k pluginům. Díky tomu jde ta záruka otestovat bez zařízení.
 */

import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Camera, CameraErrorCode, CameraResultType, CameraSource, type ImageOptions, type Photo } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import type { MlKitVysledek } from '@kontrola-tiketu/ocr';
import type { Zavislosti } from './snimekTiketu.js';

export const zavislostiCapacitor: Zavislosti = {
  /**
   * Pořídí snímek kamerou.
   *
   * `saveToGallery: false` je podstatné — snímek tiketu nemá co dělat v galerii, odkud by
   * se dostal do cloudové zálohy i do jiných aplikací. Zůstane jen v privátní cache
   * aplikace a hned se maže.
   */
  poriz: async () => {
    const foto = await vyfot('Snímek se nepodařilo pořídit.', {
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      saveToGallery: false,
      correctOrientation: true,
      quality: 90,
    });
    if (foto.path === undefined) {
      throw new Error('Snímek se nepodařilo pořídit.');
    }
    return foto.path;
  },

  rozpoznej: async (cesta): Promise<MlKitVysledek> => {
    // Latinka stačí — na tiketu jsou číslice a česká slova.
    try {
      return await TextRecognition.processImage({ path: cesta });
    } catch {
      throw new Error('Text na snímku se nepodařilo rozpoznat. Zkus to znovu.');
    }
  },

  /**
   * Přečte čárový kód z téhož snímku, aby se nemuselo skenovat zvlášť.
   * Omezeno na PDF417 — jiné kódy na tiketu nejsou a užší filtr je rychlejší.
   */
  prectiKody: async (cesta) => {
    const vysledek = await BarcodeScanner.readBarcodesFromImage({
      path: cesta,
      formats: [BarcodeFormat.Pdf417],
    });
    return vysledek.barcodes;
  },

  ukliď: async (cesta) => {
    await Filesystem.deleteFile({ path: cesta });
  },
};

/**
 * Totéž, jen snímek nepochází z kamery, ale uživatel ho vybere z galerie.
 *
 * Plugin jde přes systémový Photo Picker, takže aplikace nepotřebuje přístup ke galerii
 * a vidí jen vybraný obrázek. Vrátí cestu ke **kopii** v privátní cache aplikace — tu pak
 * `ukliď` smaže a originál v galerii zůstane, kde byl.
 */
export const zavislostiGalerie: Zavislosti = {
  ...zavislostiCapacitor,
  poriz: async () => {
    const foto = await vyfot('Obrázek se nepodařilo načíst.', {
      source: CameraSource.Photos,
      resultType: CameraResultType.Uri,
      correctOrientation: true,
      quality: 90,
    });
    if (foto.path === undefined) {
      throw new Error('Obrázek se nepodařilo načíst.');
    }
    return overKopiiVCache(foto.path);
  },
};

/** Uživatel zavřel fotoaparát nebo výběr obrázku. Není to chyba, obrazovka nic nehlásí. */
export class FoceniZruseno extends Error {
  constructor() {
    super('Focení zrušeno.');
    this.name = 'FoceniZruseno';
  }
}

async function vyfot(jinaChyba: string, volby: ImageOptions): Promise<Photo> {
  try {
    return await Camera.getPhoto(volby);
  } catch (potiz) {
    throw chybaFotaku(potiz, jinaChyba);
  }
}

/**
 * Česká chyba místo anglické hlášky pluginu kamery.
 *
 * `getPhoto` na Androidu jde starým tokem (`LegacyCameraFlow`), který kód chyby neposílá —
 * proto se rozhoduje i podle zprávy.
 */
export function chybaFotaku(potiz: unknown, jinaChyba: string): Error {
  const { code, message } = (potiz ?? {}) as { code?: string; message?: string };
  if (code === CameraErrorCode.TakePhotoCancelled || code === CameraErrorCode.ChooseMediaCancelled
    || message === 'User cancelled photos app') {
    return new FoceniZruseno();
  }
  if (code === CameraErrorCode.CameraPermissionDenied || message === 'User denied access to camera') {
    return new Error('Bez přístupu k fotoaparátu focení nepůjde. Povol ho v nastavení telefonu, nebo zadej čísla ručně.');
  }
  return new Error(jinaChyba);
}

/**
 * Pojistka, že úklid nesmaže uživatelův originál.
 *
 * Plugin dnes výběr z galerie vždy zkopíruje do cache aplikace. Kdyby ale někdy vrátil
 * cestu k původnímu souboru, `nactiTiketZeSnimku` by ji po rozpoznání smazal. Chyba tady
 * padá ještě před rozpoznáním, takže se v tom případě nesmaže nic.
 */
export function overKopiiVCache(cesta: string): string {
  if (!cesta.startsWith('file://') || !cesta.includes('/cache/')) {
    throw new Error('Obrázek se nepodařilo načíst.');
  }
  return cesta;
}
