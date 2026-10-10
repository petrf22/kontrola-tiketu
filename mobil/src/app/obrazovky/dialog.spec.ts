import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Dialog, Dialogy } from './dialog';

@Component({ imports: [Dialog], template: '<app-dialog nadpis="Zkouška"><button>Ponechat</button></app-dialog>' })
class Ukazka {}

describe('Společný dialog', () => {
  it('zamkne pozadí, systémové Zpět zavře dialog a obnoví původní styly', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(Ukazka);
    await f.whenStable();
    const d = f.debugElement.children[0]!.componentInstance as Dialog;
    const okno = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    okno.showModal = () => okno.setAttribute('open', '');
    okno.close = () => okno.removeAttribute('open');
    const puvodni = document.body.style.position;
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    expect(d.otevri()).toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(TestBed.inject(Dialogy).zpet()).toBe(true);
    expect(okno.open).toBe(false);
    expect(document.body.style.position).toBe(puvodni);
    expect(TestBed.inject(Dialogy).zpet()).toBe(false);
    d.otevri();
    f.destroy();
    expect(document.body.style.position).toBe(puvodni);
    expect(TestBed.inject(Dialogy).otevreny()).toBeNull();
    scroll.mockRestore();
  });
});
