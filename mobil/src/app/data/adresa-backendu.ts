/**
 * Adresa backendu s výsledky.
 *
 * Je zapsaná i v `android/app/src/main/res/xml/network_security_config.xml`, kde tvoří jedinou
 * výjimku, kam smí aplikace navázat TLS spojení. Obě místa musí sedět — hlídá to
 * `test/soukromi.test.ts`. Změna domény proto znamená novou verzi aplikace.
 *
 * Při `ng serve` ji nahrazuje `adresa-backendu.vyvoj.ts` (lokální backend, viz backend/docs/backend.md).
 */
export const ZAKLADNI_URL = 'https://kontrolatiketu.petrf22.cz/v1/';
