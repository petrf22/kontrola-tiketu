/**
 * Adresa lokálního backendu pro vývoj v prohlížeči (`ng serve`). Do sestavení aplikace
 * pro telefon se nedostane — nahrazuje se jen ve vývojové konfiguraci v angular.json.
 *
 *     cd backend && php -S localhost:8080 -t public tools/vyvojovy-server.php
 */
export const ZAKLADNI_URL = 'http://localhost:8080/v1/';
