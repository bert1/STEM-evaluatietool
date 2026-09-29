# Werkafspraken voor dit project

Lees eerst `HANDOFF.md` voor de opbouw en de geschiedenis van de tool.

## Bij elke wijziging aan de tool

1. **Versie ophogen** in `stem-evaluatietool/js/state.js` (`APP_VERSION`),
   volgens semantisch versiebeheer (nieuwe functie: MINOR, bugfix: PATCH).
2. **`stem-evaluatietool/CHANGELOG.md`** aanvullen.
3. **`README.md` bijwerken**: dat is de handleiding voor de leerkrachten.
   - Pas het versienummer bovenaan aan ("Huidige versie: X.Y.Z"). Een test
     in `tests/opstarten.spec.js` controleert dat het overeenkomt met
     `APP_VERSION`.
   - Beschrijf nieuwe of gewijzigde knoppen, schermen en werkwijzen in het
     juiste hoofdstuk, met de namen zoals ze in de tool staan.
   - Verwijderde functies ook uit de handleiding halen.
   - De README staat ook in de tool zelf, bij Instellingen, Help
     (sinds 1.34.0). `build.js` plakt ze bij elke build in het bestand,
     dus de README bijwerken is genoeg; een test in `tests/help.spec.js`
     controleert dat de Help letterlijk de huidige README is. Alles vanaf
     het hoofdstuk "Voor ontwikkelaars" blijft uit de Help: zet
     technische uitleg daar, en schrijf de rest voor leerkrachten.
   - De Help kent enkel eenvoudige opmaak (koppen, lijsten, tabellen,
     citaten, vet, `code`, links naar een kop). Kijk na een grotere
     wijziging even in de tool of alles goed staat.
   - Schrijf voor leerkrachten die niet technisch zijn: korte stappen,
     geen vaktermen.
4. **`HANDOFF.md`** bijwerken voor een volgende ontwikkelsessie.
5. **`npm test`** moet slagen (in de Claude-cloudomgeving met
   `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Nieuwe functies krijgen
   testen in `tests/`.
6. Het gebouwde bestand `STEM-Evaluatietool-vX.Y.Z.html` in de hoofdmap
   vervangen door de nieuwe versie.

## Je eigen bestand: nooit blind overschrijven (sinds 1.32.0)

Zie `js/koppelen.js` en "Koppelen" in `HANDOFF.md`.

- Koppelen is verplicht. Geen omweg in de productiecode, ook niet voor
  testen: `openTool()` in `tests/helpers.js` koppelt via de echte wizard
  aan een nagemaakte map (`tests/schijf.js`).
- Vóór elke schrijfactie naar het eigen bestand vergelijkt
  `pullOwnFile()` het tijdstip (`lastModified`) met het laatst gelezen of
  geschreven tijdstip. Gewijzigd: eerst reservekopie, dan `mergeDb()`
  (nooit verwijderen, `isTombstoned()`), dan pas schrijven.
- Een onleesbaar eigen bestand (`ownFileProblem`) blokkeert elke
  schrijfactie. Nooit een lege start die het bestand overschrijft.
- Vóór elke inlees-, samenvoeg-, herstel- of ophaalstap een reservekopie
  (`makeBackup()`, `backupRawText()` in `js/backups.js`).
- Bestaande initialen in de map: nooit overschrijven aanbieden; ophalen is
  de standaardkeuze.
- Nieuwe wijzigingen hieraan: altijd toetsen met twee browsercontexten die
  dezelfde map delen (`tweedeToestel()`), en de oplossing tijdelijk
  uitschakelen om te zien dat de test rood wordt.

## Schrijfstijl

- Alle teksten voor de gebruiker in het Nederlands (Vlaams).
- Gebruik nooit een gedachtestreep "—" in teksten die de gebruiker leest.
- Eenvoud voor collega's gaat boven ontwikkelaarsgemak.

## Omgeving

- De school deelt werk enkel via OneDrive (gedeelde map). Geen NAS of
  eigen server.
- Punten worden met de hand in Skore (Smartschool) overgetypt; plakken kan
  daar niet.
