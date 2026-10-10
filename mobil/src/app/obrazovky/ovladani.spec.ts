import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ImportVysledku } from './import-vysledku';
import { NovyTiket } from './novy-tiket';
import { Seznam } from './seznam';
import { Stav } from '../data/stav';
import { Dialogy } from './dialog';

describe('Zpětná vazba a přístupné ovládání', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('formulář nového tiketu odkládá dialog výhry po dobu zadávání', async () => {
    const dialogy = TestBed.inject(Dialogy);
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    expect(dialogy.upravuje()).toBe(true);
    f.destroy();
    expect(dialogy.upravuje()).toBe(false);
  });

  it('záložky ovládá šipkami a propojuje aktivní záložku s panelem', async () => {
    const f = TestBed.createComponent(ImportVysledku);
    await f.whenStable();
    const tab = f.nativeElement.querySelector('#karta-prehled') as HTMLElement;
    tab.focus();
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await f.whenStable();
    expect(document.activeElement?.id).toBe('karta-sprava');
    const aktivni = f.nativeElement.querySelector('[role=tab][aria-selected=true]') as HTMLElement;
    const panel = f.nativeElement.querySelector('[role=tabpanel]') as HTMLElement;
    expect(aktivni.getAttribute('aria-controls')).toBe(panel.id);
    // Neaktivní panel se nevykresluje, odkaz na něj by vedl na neexistující id.
    expect(tab.hasAttribute('aria-controls')).toBe(false);
    expect(panel.getAttribute('aria-labelledby')).toBe(aktivni.id);
    expect(aktivni.tabIndex).toBe(0);
    expect(tab.tabIndex).toBe(-1);
    aktivni.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await f.whenStable();
    expect(document.activeElement?.id).toBe('karta-prehled');
  });

  it('chyba čtení importu zůstane viditelná a soubor lze znovu vybrat', async () => {
    const f = TestBed.createComponent(ImportVysledku);
    await f.whenStable();
    f.nativeElement.querySelector('#karta-sprava').click();
    await f.whenStable();
    const input = f.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ text: () => Promise.reject(new Error('čtení selhalo')) }] });
    input.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('nepodařilo přečíst');
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('');
    const zprava = f.nativeElement.querySelector('[role=alert]').textContent;
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toBe(zprava);
  });

  it('validační chyba je propojená s konkrétním polem', async () => {
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    const datum = f.nativeElement.querySelector('[data-cesta="slosovani.prvni"]') as HTMLInputElement;
    datum.value = ''; datum.dispatchEvent(new Event('input'));
    f.nativeElement.querySelector('button.ulozit').click();
    await f.whenStable();
    const prvni = f.nativeElement.querySelector('[data-cesta="slosovani.prvni"]') as HTMLElement;
    expect(prvni.getAttribute('aria-invalid')).toBe('true');
    const chyba = f.nativeElement.querySelector('#' + prvni.getAttribute('aria-describedby'));
    expect(chyba.textContent).toContain('datum');
    const sloupec = f.nativeElement.querySelector('[data-cesta="sloupce[0].cisla"]') as HTMLElement;
    expect(sloupec.getAttribute('aria-invalid')).toBe('true');
    expect(f.nativeElement.querySelector('#' + sloupec.getAttribute('aria-describedby')).textContent.trim()).not.toBe('');
  });

  it('prázdný filtrovaný seznam nabízí zrušení filtrů', async () => {
    const stav = TestBed.inject(Stav);
    await stav.ulozFiltrSeznamu({ typ: 'virtualni' });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const button = [...f.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent === 'Zrušit filtry') as HTMLButtonElement;
    expect(button).toBeDefined();
    button.click(); await f.whenStable();
    expect(stav.filtrSeznamu().typ).toBe('vsechny');
    expect(stav.filtrSeznamu().nazev).toBe('*');
  });
});
