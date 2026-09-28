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
   - Schrijf voor leerkrachten die niet technisch zijn: korte stappen,
     geen vaktermen.
4. **`HANDOFF.md`** bijwerken voor een volgende ontwikkelsessie.
5. **`npm test`** moet slagen (in de Claude-cloudomgeving met
   `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Nieuwe functies krijgen
   testen in `tests/`.
6. Het gebouwde bestand `STEM-Evaluatietool-vX.Y.Z.html` in de hoofdmap
   vervangen door de nieuwe versie.

## Schrijfstijl

- Alle teksten voor de gebruiker in het Nederlands (Vlaams).
- Gebruik nooit een gedachtestreep "—" in teksten die de gebruiker leest.
- Eenvoud voor collega's gaat boven ontwikkelaarsgemak.

## Omgeving

- De school deelt werk enkel via OneDrive (gedeelde map). Geen NAS of
  eigen server.
- Punten worden met de hand in Skore (Smartschool) overgetypt; plakken kan
  daar niet.
