# Wijzigingslog

Versienummers volgen [semantisch versiebeheer](https://semver.org/lang/nl/):
`MAJOR.MINOR.PATCH`.

- **MAJOR** — grote wijziging, mogelijk niet meer compatibel met oudere
  werkbestanden of een fundamentele herbouw.
- **MINOR** — een nieuwe functie, achterwaarts compatibel. Bestaande
  werkbestanden blijven gewoon werken.
- **PATCH** — een bugfix of kleine verbetering, geen nieuwe functie.

Niet te verwarren met `DB_VERSION` in de broncode — dat is een apart getal
voor het opslagformaat van een werkbestand, en verandert enkel wanneer de
opbouw van dat bestand zelf wijzigt (voor migraties van oude bestanden).

## 1.19.1 · 28 september 2026

**Onderhoud van de code, geen zichtbare nieuwe functies.**

- `js/evaluations.js` (2500 regels) is opgesplitst volgens de bestaande
  secties: `js/rubric-model.js` (evaluatiedefinities, mappen,
  rubricversies, enkel gegevens), `js/evaluations.js` (Evalueren-scherm),
  `js/rubric-editor.js` (Rubrics-scherm) en `js/ai-rubric.js` (AI-hulp).
  Regel voor regel gecontroleerd: enkel commentaar is anders.
- De mapindeling van de evaluatie-keuzelijsten zit op één plek:
  `fillGroupedEvalSelect()` gebruikt `evaluationGroups()`, zowel bij
  Evalueren als bij Resultaten.
- Dubbele regels bij een klik in de dekkingstabel verwijderd.
- Bugfix: een klik op een vakje zonder resultaten in de dekkingstabel
  liet het veld "Klas" leeg; nu staat het op "Alle klassen".
- `build.js` schrijft standaard naar `dist/` naast de broncode, in
  plaats van naar het vaste pad `/mnt/user-data/outputs`. Een andere map
  kan als argument (`node build.js /mnt/user-data/outputs`) of via
  `STEM_OUT_DIR`.

## 1.19.0 · 28 september 2026

**Slimmer zoeken in de evaluatielijsten** (Evalueren en Resultaten).

- Zoeken negeert hoofdletters en accenten: "creme" vindt "Crème"
  (`searchKey()` in `js/ui.js`).
- Zoeken vindt ook mapnamen: typ "september" en je ziet alle evaluaties
  uit die map.
- Blijft er maar één evaluatie over, dan kiest Enter die meteen, zonder
  eerst een pijltje te moeten gebruiken.
- De evaluatie die nu gekozen is, staat vetgedrukt met een vinkje in de
  lijst.
- Toegankelijk voor schermlezers: het zoekveld is een ARIA-combobox
  (`role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`),
  het paneel een listbox met opties per map in een `role="group"`.
  De HTML van het paneel heeft daardoor een extra laag per map
  (`.eval-combo-section`), `.eval-combo-option` en `.eval-combo-group`
  blijven dezelfde klassen.

## 1.18.1 · 28 september 2026

**Veiliger opslaan: geen stil verlies van werk meer.**

- Kan de tool het werk in de browser niet meer lezen (beschadigde
  browseropslag), dan wordt die inhoud niet langer stil gewist. Ze wordt
  apart bewaard onder `STEM_EVAL_DB_V3_BESCHADIGD`, en een rode balk
  bovenaan zegt wat er aan de hand is, met knoppen om het werkbestand te
  openen of de onleesbare gegevens als reservekopie te downloaden. De balk
  blijft staan, ook na herladen, tot je hem zelf verbergt.
- "Opgeslagen" verschijnt pas als echt de laatste wijziging op schijf
  staat. Voorheen kon een wijziging tijdens het schrijven als opgeslagen
  getoond worden, en dan waarschuwde de browser niet bij het sluiten.
  Daarnaast lopen er nooit meer twee schrijfacties tegelijk
  (`writeHandle()` in `js/storage.js`, met `changeCount` uit
  `js/state.js`).
- Mislukt automatisch opslaan, dan blijft de status rood ("Niet
  opgeslagen!") en staat er een blijvende rode balk met "Opnieuw
  proberen" en "Opslaan als…", in plaats van één melding die snel uit
  beeld verdwijnt.

## 1.18.0 · 28 september 2026

**Resultaten: zoeken in de evaluatiekeuze, met mappen.**

- Het veld "Evaluatie" op het Resultaten-scherm is dezelfde zelfgetekende
  zoek-vervolgkeuzelijst geworden als "Evaluatiemoment" bij Evalueren:
  typen filtert op naam, pijltjes en Enter werken, en de evaluaties staan
  gegroepeerd per map in dezelfde volgorde als op het Rubrics-scherm.
- De code van die zoeklijst staat nu één keer in `makeSearchCombo()` in
  `js/ui.js`, en wordt door beide schermen gebruikt. De mapindeling komt
  uit het gedeelde `evaluationGroups(year)` in `js/evaluations.js`.
  Zelfde patroon als voorheen: de echte `<select id="resEval">` blijft
  werken (waarde, "change"-event, tests) maar is onzichtbaar.
- Mapkoppen in beide zoeklijsten zijn duidelijker: donkerder,
  vetgedrukt, met een scheidingslijn tussen mappen. Evaluaties in een map
  springen licht in.

## 1.17.0 — 17 september 2026

**Klaslijsten-scherm: klas aanklikken toont wie erin zit, "Leerling van
klas veranderen" is nu klapbaar onderaan.**

- Elke klas-chip bij "Wat er nu in de tool zit" is klikbaar geworden
  (`expandedRosterKlas` en de uitgebreide `renderRosterCurrent()` in
  `js/rosters.js`): een klik toont de volledige, alfabetisch gesorteerde
  leerlingenlijst van die klas eronder, nog eens aanklikken klapt ze weer
  dicht. Het kruisje om de klas te verwijderen blijft apart werken (eigen
  `stopPropagation()`), dat opent de lijst dus niet.
  **Bewuste keuze:** niet de bestaande `.chip-removable`-stijl hergebruikt
  (die kleurt de hele chip rood bij hover, wat verwarrend zou zijn voor
  een klik die niets verwijdert) — een eigen `.roster-klas-chip`-stijl in
  plaats daarvan.
- "Leerling van klas veranderen" stond eerst altijd open tussen de
  importsectie en de klassenlijst. Staat nu, ingeklapt via `<details>`,
  helemaal onderaan het Klaslijsten-scherm — zelfde patroon als "Of
  plakken vanuit Excel" hierboven.

## 1.16.0 — 17 september 2026

**Opgeslagen evaluaties verhuizen mee bij het veranderen van klas** —
vervolg op 1.15.0. `migrateStudentEvaluations()` in `js/rosters.js`
loopt bij het verplaatsen van een leerling over alle sessies van dat
leerjaar (elk evaluatiemoment), niet enkel het moment dat toevallig
open staat.

- Een individuele beoordeling (rij met enkel deze leerling) verhuist nu
  volledig: ze verdwijnt uit de sessie van de oude klas en komt terecht
  in de sessie van de nieuwe klas voor datzelfde evaluatiemoment. Staat
  die nieuwe-klas-sessie al open, dan zie je de rij daar meteen bij.
- Een groepsrij (samen met klasgenoten) kan niet zomaar fysiek verhuizen
  — de score is gedeeld met leerlingen die niet meeverhuizen. Die rij
  blijft dus bewerkbaar bij de oorspronkelijke sessie, maar
  `row.studentKlas` van deze ene leerling wordt wel bijgewerkt naar de
  nieuwe klas, zodat resultaten, export en de groeigrafiek per klas haar
  of hem vanaf nu bij de nieuwe klas tellen. Het bevestigingsvenster en
  de melding achteraf leggen dit onderscheid uit.
- Rijen van vóór 1.14.0 zonder `row.studentKlas` (toen altijd precies
  één echte klas per sessie) krijgen dat veld alsnog ingevuld voor alle
  leerlingen in de rij, vóór de klas van de verplaatste leerling
  verandert — zo blijven de klasgenoten in diezelfde rij correct bij hun
  eigen klas staan.

## 1.15.0 — 17 september 2026

**Leerling van klas veranderen zonder de klaslijst opnieuw in te lezen** —
in het begin van het schooljaar wisselen klasgroepen soms nog. Nieuw
onderdeel op het Klaslijsten-scherm (`js/rosters.js`,
`moveStudentToClass()` en de bijhorende `fillMove*Options()`-functies):
leerjaar, huidige klas, leerling en nieuwe klas kiezen, dan
**Verplaatsen**. Verplaatst enkel die ene naam tussen
`db.roster[year][klas].students`, in plaats van de hele klaslijst opnieuw
te moeten plakken of inlezen (wat de rest van de klas ook zou
overschrijven met wat op dat moment in het bestand staat). Bumpt
`updatedAt` van beide betrokken klassen, zodat de verplaatsing gewoon
meegaat bij de volgende synchronisatie. Waarschuwt vooraf als er al
opgeslagen evaluaties op naam van die leerling staan voor dat leerjaar —
die blijven bewust bij de klas waarvoor ze toen zijn ingevuld, enkel
nieuwe evaluaties gebeuren vanaf dan onder de nieuwe klas.

## 1.14.0 — 17 september 2026

**Meerdere klassen tegelijk selecteren op het Evalueren-scherm** — een
stem-les brengt vaak leerlingen van verschillende klasgroepen samen, en
een groepje kan dus leerlingen uit meer dan één klas bevatten. Het
klasveld is een zelfgetekende keuzelijst met aanvinkvakjes geworden
(`klasMultiInput`/`klasMultiPanel`/`toggleKlasOption()` in
`js/evaluations.js`), zelfde architecturaal patroon als de bestaande
evaluatiemoment-combo: de echte `<select id="classSelect" multiple>`
blijft volledig functioneel (waarde via `.selectedOptions`,
"change"-event, en dus ook voor tests) maar is onzichtbaar via
`opacity:0` (niet `display:none`).

- Eén of meer klassen aanvinken opent een gecombineerde sessie met de
  leerlingen van al die klassen samen, zodat een gemengde groep in één
  keer beoordeeld kan worden. Bij meer dan één klas krijgt elke
  leerling een klas-badge naast de naam, zodat duidelijk blijft uit
  welke klas die komt.
- Elke opgeslagen rij houdt nu ook de échte klas per leerling bij
  (`row.studentKlas`), niet enkel de sessie als geheel. Daardoor blijft
  het Resultatenscherm, de groeigrafiek per klas, en de export correct
  werken op klasniveau, ook voor leerlingen die in een combinatiegroep
  zijn beoordeeld — filteren op één echte klas toont die leerlingen dus
  gewoon mee. Oudere rijen zonder dat veld vallen terug op de klas van
  de sessie zelf (dat was toen altijd precies één echte klas).
- "Al beoordeeld"-detectie en de teamvoortgang kijken nu klas-overkoepelend
  binnen hetzelfde leerjaar en evaluatiemoment, zodat eenzelfde leerling
  niet per ongeluk twee keer beoordeeld wordt wanneer die soms solo en
  soms in een combinatie van klassen wordt gezet. Gelijknamige leerlingen
  in andere klassen lopen elkaar daarbij niet voor de voeten, dankzij de
  per-leerling klas.
- Teamtoewijzing (wie hoort bij welke klas) werkt nu over de gekozen
  klassen heen: `teamForKlassen()` neemt de unie van de teamleden van elke
  geselecteerde klas.

## 1.13.0 — 3 september 2026

**Jaaroverzicht afdrukken** — één PDF met alle rubrics van een leerjaar,
hun leerplandoelen-koppeling en de volledige dekking, in plaats van losse
afdrukfuncties bij elkaar te moeten zoeken. Handig bij een vakgroepoverleg
of doorlichting.

- Nieuwe knop **Jaaroverzicht afdrukken** op het Rubrics-scherm, drukt het
  daar gekozen leerjaar af.
- Toont eerst alle evaluaties van dat leerjaar, gegroepeerd per map (net
  zoals op het scherm zelf), met per evaluatie het aantal criteria, het
  maximum en de gekoppelde leerplandoelen.
- Daaronder de volledige dekkingstabel: elk leerplandoel, waar het aan
  gekoppeld is, en het behaalpercentage — dezelfde tabel als het bestaande
  losse leerplandoelen-overzicht, nu hergebruikt in plaats van gedupliceerd.
- Voor het 1ste jaar (waar nog geen leerplandoelen geladen zijn) toont de
  dekkingssectie gewoon een duidelijke uitleg in plaats van een lege of
  kapotte tabel.
- Kerncijfers bovenaan: aantal evaluaties, totaal aantal criteria, en
  hoeveel van de leerplandoelen al gekoppeld zijn.

## 1.12.1 — 3 september 2026

**Fix:** de zoekbalk bij het evaluatiemoment op het Evalueren-scherm zat
lelijk boven een grijze, uitgeschakeld ogende keuzelijst, en die keuzelijst
opende soms naar boven in plaats van naar beneden (een browser kiest dat
zelf, op basis van de beschikbare ruimte — daar valt met een gewone
keuzelijst niets aan te sturen).

- Vervangen door een zelfgetekende zoek-vervolgkeuzelijst: het zoekveld ís
  nu meteen het zichtbare veld zelf, geen apart element meer erboven.
- Het resultatenpaneel opent altijd naar **beneden**, ongeacht waar het
  veld op het scherm staat — dat ligt nu vast, niet meer aan de browser
  overgelaten.
- Pijltjestoetsen om door de lijst te lopen, Enter om te kiezen, Escape om
  te sluiten zonder iets te wijzigen, en klikken buiten het veld sluit het
  ook netjes.
- Onder de motorkap blijft de vertrouwde `<select>` gewoon bestaan (enkel
  onzichtbaar) — niets aan de opslag of aan hoe een evaluatie geopend
  wordt, is veranderd.

## 1.12.0 — 2 september 2026

Zoeken toegevoegd op twee plekken waar de lijst met evaluaties al snel lang
wordt, zeker met mappen erbij.

- **Rubrics-scherm**: een zoekveld naast "Leerjaar" filtert de evaluaties op
  naam. Een map zonder enkele match verdwijnt tijdens het zoeken (ook "Geen
  map"), zodat het overzicht duidelijk blijft. Geen enkele match geeft een
  melding met de zoekterm erin. Wisselen van leerjaar wist het zoekveld
  automatisch, want de lijst is dan toch een andere.
- **Evalueren-scherm**: een zoekveld boven de evaluatiemoment-keuzelijst.
  De bestaande keuzelijst zelf blijft ongewijzigd — het zoekveld verbergt en
  toont enkel de opties erin, inclusief de mapgroepen (die zelf ook
  verdwijnen als er geen enkele match in zit). Een actief zoekwoord blijft
  gewoon staan bij een achtergrondverversing (bijvoorbeeld na
  synchroniseren met een collega) — enkel een echte jaarwissel wist het.

## 1.11.0 — 1 september 2026

Sneller scoren tijdens de les: cijfertoetsen en automatisch doorschuiven
naar de volgende leerling.

- Typ **1 t.e.m. 9** om meteen dat niveau te kiezen op het criterium waar
  de focus op staat — springt automatisch door naar het volgende
  criterium. Na het laatste criterium landt de focus op "Opslaan". Zo
  scoor je een hele rubric zonder de muis aan te raken.
- Werkt nooit ongewenst tussendoor: staat de cursor in een tekstveld
  (feedback, feedforward, open vraag, …), dan typ je daar gewoon een
  cijfer zoals verwacht.
- Na het opslaan van **één** leerling schuift de tool automatisch door
  naar de eerstvolgende nog niet beoordeelde leerling in de klas, met de
  focus meteen op het eerste criterium. Bij groepswerk (meerdere
  leerlingen tegelijk) gebeurt dit bewust niet — daar is er geen
  eenduidige "volgende".
- Een korte uitleg staat nu boven elke rubric, naast "Korte weergave".

## 1.10.0 — 30 augustus 2026

Verwijderen van een klas, evaluatie/rubric of map vraagt voortaan: voor
iedereen, of enkel voor mezelf? Lost een echt probleem op: tot nu toe kon
een verwijderd onderdeel na synchroniseren met een collega gewoon
terugkomen, omdat de samenvoeglogica enkel kon toevoegen en bijwerken,
nooit doelbewust laten verdwijnen.

- **Verwijderen voor iedereen**: het onderdeel verdwijnt ook bij
  collega's zodra zij synchroniseren, ook al hadden zij het nog.
- **Verwijderen voor mezelf**: blijft weg bij jou, ook na latere
  synchronisatie met iemand die het nog heeft — maar collega's
  behouden gewoon hun eigen versie, niets verandert bij hen.
- Werkt via "tombstones": een onthouden verwijdermoment per onderdeel.
  Nieuwer werk (een collega die het item ná jouw verwijdering nog
  bewerkte) wint gewoon, net als overal elders in de tool.
- **Fix, tijdens het bouwen zelf gevonden via een echte twee-personen-
  proef**: een nooit-aangepast standaardonderdeel (tijdstip 0) werd
  eerst onterecht als "verwijderd" behandeld zodra er ergens een
  tombstone bestond, ook zonder dat er voor dát onderdeel een echte
  tombstone was. Rechtgezet.
- **Fix**: de mapregistratie zelf (namen, volgorde) werd sinds 1.7.0
  nooit meegestuurd bij synchroniseren — enkel de koppeling per
  evaluatie. Lege mappen en handmatige volgorde bereikten collega's dus
  nooit. Ook rechtgezet.
- Werkt voor klassen, evaluaties/rubrics én mappen, overal met
  hetzelfde keuzevenster.

## 1.9.0 — 30 augustus 2026

Eén klas verwijderen kan nu rechtstreeks vanuit "Wat er nu in de tool zit".

- Beweeg je muis over een klas-chip op het Klaslijsten-scherm en er
  verschijnt een kruisje om net die klas te verwijderen — niet meer
  enkel de optie om alles in één keer te wissen.
- Op een aanraakscherm (geen muis, dus geen hover) staat het kruisje
  gewoon altijd zichtbaar.
- Dezelfde beveiligingen als "Alle klaslijsten wissen": geblokkeerd in
  een archiefschooljaar, een duidelijke bevestiging met het aantal
  leerlingen en eventuele opgeslagen evaluaties — die laatste blijven
  gewoon bewaard, ook al is de klas zelf weg.

## 1.8.0 — 30 augustus 2026

Mappen op het Rubrics-scherm zijn nu ook van plaats te veranderen.

- Elke map heeft rechtsboven ↑/↓-knoppen, naast "Map verwijderen" —
  zelfde plek en stijl als de bestaande pijltjes om criteria binnen een
  rubric te herschikken.
- De eerste map heeft geen werkende "omhoog" meer, de laatste geen
  "omlaag" — net als bij criteria.
- "Geen map" staat altijd achteraan en is niet verplaatsbaar; dat is
  geen echte map, gewoon waar niet-ingedeelde evaluaties staan.
- De volgorde reist automatisch mee naar de evaluatiemoment-kiezer bij
  Evalueren, als volgorde van de groepen in de keuzelijst.
- Blijft bewaard na herladen, en gaat niet verloren bij synchronisatie
  met collega's.

## 1.7.0 — 30 augustus 2026

Rubrics/evaluaties kunnen voortaan in mappen ingedeeld worden, voor beter
overzicht.

- Nieuwe knop **+ Nieuwe map** op het Rubrics-scherm, per leerjaar.
- Elke evaluatie krijgt een keuzelijst om naar een map te verplaatsen —
  meteen zichtbaar in de gegroepeerde weergave op het Rubrics-scherm.
- Dezelfde mapindeling komt terug bij het kiezen van het evaluatiemoment
  op het Evalueren-scherm, als gegroepeerde koppen in de keuzelijst.
- **Map verwijderen laat de evaluaties zelf altijd met rust** — ze komen
  gewoon terug bij "Geen map", nooit verloren. Zelfde beveiligingspatroon
  als overal elders in de tool.
- Bewerken en dupliceren van een evaluatie behouden de mapindeling.
- Synchronisatie tussen collega's: mappen worden nooit verwijderd bij het
  samenvoegen, enkel toegevoegd — een map die een collega al had, blijft
  gewoon bestaan; een nieuwe map van een collega komt erbij.
- Bestaande evaluaties zonder mapindeling verschijnen gewoon onder "Geen
  map" — geen enkele wijziging nodig aan bestaande werkbestanden.

## 1.6.0 — 28 augustus 2026

Leerplandoelen koppelen gebeurt voortaan door de AI zelf, niet meer
door een offline trefwoordvergelijking.

- De knop "Voorstel op basis van tekst" (offline, op woordgebruik) is
  verwijderd — de matching was niet betrouwbaar genoeg, vooral door
  Nederlandse woordvormen die niet letterlijk overeenkwamen.
- Bij het genereren van de AI-prompt (2de jaar) krijgt de AI voortaan
  de volledige lijst leerplandoelen mee, met de uitdrukkelijke
  instructie om enkel te koppelen waar het echt past en niets te
  forceren. De AI geeft dat terug als onderdeel van hetzelfde
  JSON-antwoord.
- Bij het importeren worden enkel bestaande, geldige doelcodes
  overgenomen; een verzonnen of verkeerd getypte code wordt genegeerd
  en gemeld, zonder de rest van de import te laten mislukken.
- De gekoppelde doelen verschijnen gewoon in de bestaande doelenkiezer
  bij elk criterium — controleer en pas aan zoals altijd.

## 1.5.1 — 28 augustus 2026

- **Fix:** bij AI-import bleef het lege startcriterium van een nieuwe
  evaluatie ernaast staan, in plaats van vervangen te worden. Dat
  onaangeroerde criterium wordt nu automatisch verwijderd zodra je
  criteria importeert — maar alleen als het écht nog leeg is; heb je
  zelf al een naam of omschrijving ingevuld, dan blijft dat altijd
  staan, ook na een AI-import.

## 1.5.0 — 28 augustus 2026

AI-hulp bij het opstellen van een rubric — zonder sleutel, zonder
server.

- Nieuw paneel "AI-hulp: rubric genereren" bovenaan de evaluatie-editor.
  Beschrijf de opdracht in een paar zinnen, en de tool bouwt een
  volledige prompt die je naar een AI-gesprek kopieert (Claude,
  ChatGPT, Copilot, wat je toch al gebruikt).
- Plak het antwoord terug en de tool zet het om in echte, bewerkbare
  criteria — gewoon in de bestaande rubric-editor, met dezelfde velden
  die je al kent. Foutmeldingen zijn specifiek ("criterium X heeft geen
  naam") in plaats van een kale parsefout, en een JSON-blok tussen
  omringende AI-tekst wordt gewoon gevonden.
- Bewust géén rechtstreekse AI-aanroep vanuit de tool: dat zou een
  toegangssleutel vereisen die in het bestand zou moeten staan, en dus
  door iedereen die het bestand ooit in handen krijgt uitgelezen en
  misbruikt zou kunnen worden. Dit kopieer-plak-pad heeft dat risico
  niet.
- Los daarvan, voor het 2de jaar: een volledig offline knop "Voorstel
  op basis van tekst" bij elke doelenkiezer, die leerplandoelen
  voorstelt op basis van woordgebruik in naam en omschrijving van een
  criterium — geen AI, geen internet nodig.

## 1.4.0 — 28 augustus 2026

Groepsbeoordeling verbeterd: een individuele correctie bovenop de
groepsscore.

- Vink je meer dan één leerling aan, dan verschijnt na het scoren van de
  groep een blok "Individuele correctie (optioneel)" — per leerling een
  invoerveld om een punt bij of af te trekken, met een live voorbeeld
  van het resultaat.
- De groepsscore per criterium blijft gedeeld en telt zo mee voor
  klasgemiddelden, werkpunten en kalibratie tussen beoordelaars — enkel
  de eindscore van de individueel gecorrigeerde leerling verandert.
- Duidelijk zichtbaar overal waar het telt: een gekleurde badge met
  tooltip in de resultatentabel en op het evaluatiescherm, en op het
  gedrukte rapport een aparte regel "Groep X, +Y individueel".
- Een correctie kan de eindscore nooit onder 0 of boven het maximum
  duwen.
- CSV- en klembordexports hebben er een kolom "Correcties" bij
  gekregen.
- Bestaande groepsbeoordelingen blijven exact hetzelfde werken —
  zonder correctie is er niets veranderd aan het resultaat.

## 1.3.2 — 28 augustus 2026

- "Grafieken per criterium en spreiding" staat voortaan onder de tabel
  "Per leerling" (was ervoor), en is standaard ingeklapt — net als
  Dekking over het schooljaar, Groei over het jaar en Leerplandoelen.

## 1.3.1 — 28 augustus 2026

- Bij "Rapporten afdrukken" en het rapport van één leerling stelt de
  browser bij "Opslaan als PDF" nu automatisch een bruikbare
  bestandsnaam voor: `klas_evaluatie` voor het groepsrapport,
  `leerling_klas_evaluatie` voor één leerling.

## 1.3.0 — 28 augustus 2026

Schooljaren toegevoegd. Grootste wijziging tot nu toe aan het datamodel,
maar oudere werkbestanden blijven gewoon werken — ze worden automatisch
ingelezen als één schooljaar.

- Nieuwe keuzelijst bovenaan (onder "STEM Evaluatietool") om van
  schooljaar te wisselen.
- **Nieuw schooljaar toevoegen**: klaslijsten beginnen helemaal leeg;
  rubrics en team blijven behouden, want die zijn niet aan een
  schooljaar gebonden.
- Oudere schooljaren blijven volledig bewaard en te bekijken — inclusief
  klaslijsten en resultaten — maar zijn alleen-lezen. Een duidelijke
  balk toont wanneer je een archief bekijkt, met een knop terug naar
  het actieve schooljaar.
- Opslaan van evaluaties en klaslijstwijzigingen is geblokkeerd in een
  archiefschooljaar, zowel via de knoppen als met een harde controle in
  de code zelf.
- Synchronisatie tussen collega's neemt voortaan de volledige
  schooljaargeschiedenis mee, met dezelfde "nooit verwijderen, enkel
  toevoegen"-regel die al gold voor team en klaslijsten: een schooljaar
  dat een collega nog niet kent, komt er gewoon bij; een schooljaar dat
  jullie beiden kennen, wordt per klas en per evaluatierij samengevoegd.

## 1.2.0 — 28 augustus 2026

Nog een herindeling van het Resultatenscherm, geen nieuwe berekeningen.

- De leerjaar/evaluatie/klas-selectie met kerncijfers, grafieken en de
  tabel per leerling staat voortaan **bovenaan** de pagina — dat is wat
  je het vaakst nodig hebt bij het openen van dit scherm.
- Dekking over het schooljaar, Groei over het jaar en Leerplandoelen
  staan er nu onder, in diezelfde volgorde als voorheen (sinds 1.1.0).

## 1.1.0 — 28 augustus 2026

Herindeling van het Resultatenscherm, geen nieuwe berekeningen.

- Volgorde van de drie hoofdsecties gewijzigd naar: Dekking over het
  schooljaar → Groei over het jaar → Leerplandoelen.
- "Werkpunten voor de klas" staat voortaan binnen het paneel Groei over
  het jaar, als tweede onderdeel na de leerling-weergave — groei en
  werkpunten horen inhoudelijk bij elkaar.
- "Gemiddeld per criterium", "Verdeling per criterium" en "Spreiding van
  de totaalscores" staan voortaan samen onder één inklapbare titel
  ("Grafieken per criterium en spreiding"), zodat je die als groep kan
  open- en dichtklappen.

## 1.0.0 — 27 augustus 2026

Eerste versie met officieel versiebeheer. Vat de volledige, al werkende tool
samen zoals die op dit moment is — alles hieronder bestond al, dit is het
moment waarop we begonnen het bij te houden.

**Bevat onder meer:**
- Rubric-editor met Bloom-niveaus, leerplandoelen (2de jaar), rubricversies
- Resultatenscherm: kerncijfers, werkpunten, grafieken, kalibratie tussen
  beoordelaars, dekkingsraster, groei over het jaar
- Leerlingrapport en feed-up-blad (afdrukbaar)
- Formatieve modus (tussentijdse checks) en gesplitste feedback/feedforward
- Klaslijsten via plakken of Excel-import
- Gedeelde map (OneDrive/netwerkschijf) voor teamsynchronisatie, met
  optionele automatische netwerksynchronisatie op het schoolnetwerk
- Opstartwizard voor de eerste keer openen
- Testomgeving met verzonnen gegevens (`STEM-Evaluatietool-TESTOMGEVING.html`)

**Ook in deze release:**
- **Fix:** `mergeTeam` verving voorheen het volledige team bij het
  samenvoegen, gebaseerd op één tijdstempel. Een collega die de tool voor
  het eerst opende kon daardoor het volledige team en alle klasindelingen
  van iedereen wegvegen. Merget nu per teamlid en per klastoewijzing,
  net als klaslijsten en rubrics al deden — nooit meer een lid of
  toewijzing kwijt door samen te voegen.
- **Architectuur:** de broncode is opgesplitst van een platte verzameling
  bestanden naar een echte projectstructuur (`data/`, `js/`, `css/`),
  zonder functionaliteit te wijzigen. Zie `README.md`.
