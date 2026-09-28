# STEM Evaluatietool — broncode

Dit is de echte, leesbare broncode van de tool: aparte bestanden per onderwerp,
geen enkel bestand groter dan wat in één keer te overzien is. Wat leerkrachten
uiteindelijk krijgen — één HTML-bestand dat je kan dubbelklikken, zonder
installatie — wordt hieruit **gebouwd**, niet met de hand onderhouden.

## Twee lagen

**Ontwikkeling** (deze map): losse bestanden, geladen via gewone
`<script src="...">`-tags. Open `index.html` rechtstreeks vanaf schijf om te
testen — dat werkt zonder server, precies zoals het uiteindelijke bestand.

**Uitlevering**: `node build.js` plakt alles samen tot één bestand in
`dist/STEM-Evaluatietool.html`. Dat is wat leerkrachten
openen. Zij zien deze mapstructuur nooit.

Waarom niet gewoon overal losse bestanden gebruiken? Omdat `type="module"`
(echte `import`/`export`) niet werkt wanneer iemand een bestand vanaf zijn
bureaublad opent — browsers blokkeren dat met een CORS-fout. Klassieke
`<script src>`-tags werken wel, maar delen allemaal dezelfde globale ruimte
zonder expliciete import/export tussen bestanden. Die beperking is bewust
geaccepteerd: het is de enige manier om zowel leesbare, losse bestanden te
hebben als het "gewoon dubbelklikken, geen server nodig"-gedrag te behouden
waar de hele tool op gebouwd is (offline werking, teamsynchronisatie via een
gedeelde map, geen installatie voor niet zo computervaardige collega's).

## Mapstructuur

```
stem-evaluatietool/
├── index.html          het enige HTML-bronbestand
├── build.js             bouwt het bestand voor leerkrachten
│
├── css/
│   ├── base.css          kleuren, basistypografie
│   ├── components.css    knoppen, kaarten, tabellen, navigatie, schermen
│   ├── evaluation.css    het evaluatieformulier zelf
│   └── print.css         leerlingrapport en feed-up-blad
│
├── js/
│   ├── ui.js              $() en el(), plus de zoeklijst makeSearchCombo()
│   ├── state.js           het db-object, opslaan/laden, rijen samenvoegen
│   ├── storage.js         bestand opslaan/openen, File System Access API
│   ├── rosters.js         klaslijsten, Excel-import
│   ├── rubric-model.js    evaluatiedefinities, mappen, rubricversies (enkel gegevens)
│   ├── evaluations.js     Evalueren-scherm: selectie, leerlingen, scores geven
│   ├── rubric-editor.js   Rubrics-scherm: evaluaties en criteria bewerken
│   ├── ai-rubric.js       AI-hulp bij het opstellen van rubrics
│   ├── results.js         statistieken, grafieken, kalibratie, dekking
│   ├── reports.js         leerlingrapport, feed-up-blad afdrukken
│   ├── goals.js           leerplandoelen, drempels, groei over het jaar
│   ├── sync.js            gedeelde map (bv. in OneDrive), team
│   ├── skore.js           tabblad Skore: punten per rapportperiode
│   └── app.js             opstarten, wizard, schermnavigatie
│
└── data/
    ├── curriculum.js      leerplandoelen (2de jaar)
    └── roster-seed.js     standaard klaslijsten/rubrics bij een lege installatie
```

## Versiebeheer

Vanaf nu krijgt elke wijziging een versienummer volgens
[semantisch versiebeheer](https://semver.org/lang/nl/): `MAJOR.MINOR.PATCH`.

- Nieuwe functie, achterwaarts compatibel → **MINOR** ophogen (1.0.0 → 1.1.0)
- Bugfix, geen nieuwe functie → **PATCH** ophogen (1.0.0 → 1.0.1)
- Grote, mogelijk niet-compatibele wijziging → **MAJOR** ophogen (1.x.x → 2.0.0)

Het versienummer staat in `js/state.js` als `APP_VERSION`, en is zichtbaar
bovenaan de tool zelf. Elke wijziging krijgt een regel in `CHANGELOG.md`.

`build.js` schrijft **twee** bestanden: een met vaste
naam (`STEM-Evaluatietool.html`) waar de testreeks naar verwijst — die moet
bij elke versie bruikbaar blijven zonder alle testbestanden aan te passen —
en een kopie met het versienummer erin (`STEM-Evaluatietool-v1.0.0.html`).
Die laatste is wat je aan collega's geeft: zo zien zij meteen welke versie
ze hebben, zonder de tool te moeten openen.

Verwar dit niet met `DB_VERSION` in hetzelfde bestand — dat is een apart
getal voor het opslagformaat van een werkbestand, voor migraties van oude
bestanden. Dat verandert veel minder vaak dan `APP_VERSION`.

## Bouwen

```bash
node build.js         # de tool
```

Standaard schrijft het naar `dist/` naast de broncode (staat in
`.gitignore`). Een andere map kan als eerste argument of via
`STEM_OUT_DIR`, bijvoorbeeld `node build.js ../uit`.

## Testen

Vanuit de hoofdmap van de repository: `npm test`. Dat bouwt eerst en draait
dan de Playwright-testen in `tests/`. Op GitHub gebeurt dit automatisch bij
elke push.

## Belangrijk om te weten voor je hierin werkt

- **Geen `import`/`export`.** Alle bestanden delen één globale ruimte, zoals
  vóór ES-modules gebruikelijk was. Een functie in `results.js` kan zomaar
  een functie uit `goals.js` aanroepen zonder die te importeren — dat werkt,
  maar de afhankelijkheid is niet zichtbaar in de code zelf. Wees voorzichtig
  met namen: twee gelijknamige functies in verschillende bestanden overschrijven
  elkaar stilzwijgend.
- **`js/ui.js` (met `$` en `el`) moet altijd als eerste JS-bestand geladen
  worden** in `index.html` — bijna elk ander bestand gebruikt die twee
  functies. `js/app.js` hoort als laatste te staan, want dat start de tool op.
- **`build.js` gebruikt `String.replace()` met een functie als tweede
  argument, nooit met een kale string.** Reden: sommige functies in de
  broncode bevatten zelf tekst als `"\\$&"` (bijvoorbeeld in `cssEscape`).
  Geef je die tekst als kale string aan `.replace()`, dan interpreteert
  JavaScript `$&` als "voeg de oorspronkelijke match opnieuw in" — met een
  kapotte build tot gevolg. Dit kostte tijd om te vinden; laat de fix staan.
- **Test na elke wijziging.** De testreeks in `../build/` (de oude
  ontwikkelmap, met alle Playwright-tests) test het **eindresultaat** van
  `build.js`, niet deze bestanden rechtstreeks. Bouw dus eerst opnieuw, test
  daarna.
