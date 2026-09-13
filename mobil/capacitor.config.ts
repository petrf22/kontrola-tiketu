import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Konfigurace Capacitoru.
 *
 * `server` se tu záměrně nevyskytuje — webview se nesmí načítat odjinud než z balíčku.
 * Na síť smí jen stažení výsledků přes nativní HTTP (`src/app/data/stahovani.ts`), a to jen
 * na doménu povolenou v `network_security_config.xml`.
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
