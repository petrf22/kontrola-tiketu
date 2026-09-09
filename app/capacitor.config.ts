import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Konfigurace Capacitoru.
 *
 * `server` se tu záměrně nevyskytuje. Jakékoliv nastavení, které by aplikaci pustilo na
 * síť, jde proti smyslu projektu — aplikace nemá mít ani oprávnění k internetu.
 */
const config: CapacitorConfig = {
  appId: 'cz.petrf22.kontrolatiketu',
  appName: 'Kontrola tiketu',
  webDir: 'dist/kontrola-tiketu-app/browser',
  android: {
    // Prohlížeč uvnitř aplikace nesmí nic dotahovat zvenčí.
    allowMixedContent: false,
  },
};

export default config;
