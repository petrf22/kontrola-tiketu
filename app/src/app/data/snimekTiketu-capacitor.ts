/**
 * Napojení pořízení snímku na Capacitor.
 *
 * Oddělené od `snimekTiketu.ts` schválně: tam je postup a záruka úklidu, tady jen tenká
 * vrstva k pluginům. Díky tomu jde ta záruka otestovat bez zařízení.
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
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
    const foto = await Camera.getPhoto({
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
    return TextRecognition.processImage({ path: cesta });
  },

  ukliď: async (cesta) => {
    await Filesystem.deleteFile({ path: cesta });
  },
};
