# Dialogy a upozornění

Nabídka akcí tiketu, potvrzení smazání a souhrn výher používají společný HTML dialog
uvnitř WebView, tedy pod ochranou FLAG_SECURE. Otevřený dialog zamyká posouvání stránky
i fokus. Android Zpět nejprve zavře dialog. Při ukládání se čeká na dokončení operace.

Nová slosování a změny výsledků se evidují lokálně podle tiketu a data. Výherní shoda
bez konečné částky je také upozornění na výhru, ale s výslovně uvedenou nejistotou.
První zavedení evidence neoznamuje historii. Archivace pokračující kontrolu nevypíná.

Nepřečtené položky, otisky výsledků a preference dialogu jsou v existující šifrované
tabulce nastavení pod klíčem `oznameniVysledku`. V prohlížeči zůstávají jen v paměti.
Zápisy evidence jsou serializované; potvrzení odkazuje na konkrétní revize položek,
takže nesmaže později příchozí opravu téhož slosování. Selhání zápisu potvrzení ponechá
položky nepřečtené. Restart porovná uloženou evidenci s aktuálními výsledky a dožene
přerušenou aktualizaci.

Výhry se výchozím nastavením otevírají v souhrnném dialogu. Během zadávání, úprav,
skenování a kontroly bez uložení se otevření odloží. Escape, Zpět nebo „Později“
ponechají výsledky v horním panelu a stejná revize v tomto spuštění znovu nevyskočí.
„Rozumím“, označení v panelu a otevření detailu označí příslušné položky jako přečtené.

Volba „Příště jen upozornit v panelu“ ihned uloží vypnutí automatických dialogů.
Vrátit ji lze v Další → Nastavení → Výhry zobrazovat v dialogu. Panel nemá časový limit.
Žádná z těchto funkcí neposílá systémové notifikace ani nemění síťové požadavky.

## Ověření při dalších změnách

- `npm run test:angular -- --watch=false`: evidence, souběh, restart, nejisté výhry,
  odložení dialogů, formuláře, import a klávesnicové ovládání.
- Ve skutečném prohlížeči ověřit `:modal`, zamčené pozadí, fokus, Escape, obnovu scrollu
  a dlouhé názvy při šířce 360 px, ve světlém i tmavém režimu a se zvětšeným textem.
- Na Androidu ověřit gesto Zpět, dotykové posouvání uvnitř dlouhého dialogu, softwarovou
  klávesnici, návrat z fotoaparátu a TalkBack. Tyto vlastnosti jsdom nenapodobuje.

Při implementaci byly ověřené automatické testy a Chrome. Android nebyl připojený;
kontrola na telefonu zůstává před vydáním nutná.
