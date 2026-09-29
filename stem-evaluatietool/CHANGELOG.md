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

## 1.26.0 · 29 september 2026

**Automatische reservekopieën en een vorige versie terugzetten**

- Met een gedeelde map bewaart de tool automatisch een kopie van je werk in
  de submap `backups`, met initialen, datum en uur in de naam
  (`evaluaties-BB-2026-09-29-14u05.json`). Een kopie bij het verbinden met
  de map en daarna hoogstens één per uur na een geslaagde opslag; geen
  nieuwe kopie als er niets veranderde (`js/backups.js`).
- Opruimen: alles van de laatste 14 dagen blijft, daarna één per week, na
  365 dagen weg; de 10 nieuwste blijven altijd. Enkel je eigen kopieën.
- Nieuw onderdeel **Reservekopieën** op het Teamscherm: lijst met datum en
  uur, knop **Terugzetten** per kopie en **Nu een reservekopie maken**.
- Terugzetten maakt eerst een kopie van de huidige stand. Alles wat in de
  teruggezette versie anders is dan nu, krijgt een nieuw tijdstip, zodat
  "Team bijwerken" de fout niet terugbrengt uit het bestand van een
  collega. De datum van een beoordeling (Skore-periode) blijft gelijk.
- De kopieën tellen niet mee bij "Team bijwerken".

## 1.25.3 · 28 september 2026

**Eén vertrouwenszin vervangen**

- "Ik ben benieuwd naar je volgende poging." is vervangen door "Elke keer
  dat je iets probeert, leer je iets bij." (`CONFIDENCE_SENTENCES`).

## 1.25.2 · 28 september 2026

**Vertrouwenszinnen zonder druk**

- De zeven vaste zinnen bij een werkpunt (`CONFIDENCE_SENTENCES`) zijn
  herschreven. Zinnen als "Ik verwacht veel van je", "Ik leg de lat hoog"
  en "Ik ben streng voor je werk" legden te veel druk. De nieuwe zinnen
  zeggen dat de leerling het kan leren, dat fouten erbij horen en dat de
  leerkracht graag helpt. Een test bewaakt dat er geen drukwoorden in
  staan.

## 1.25.1 · 28 september 2026

**Feedback in Skore is duidelijk zonder de rubric erbij**

- De feedbacktekst begint nu met "Dit is je feedback bij "opdracht"." in
  plaats van een lijst met criterianamen. Namen als "Meten" of
  "Voorspellen" zeggen een leerling weken later niets meer.
- De volgende stap staat als gewone zin, zonder "Bij ...": ze hoort bij
  het werkpunt net erboven.
- De AI-prompt vraagt criterianamen die zeggen wat de leerling in de
  opdracht maakte of deed ("Je voorspellingen vooraf" in plaats van
  "Voorspellen"), en feedbackzinnen die zonder de rubric duidelijk zijn.
  De zelfcontrole vraagt of een leerling elke naam en zin ook weken later
  begrijpt. Na "Bij" wordt een naam die met "Je" begint "je".
- Te lange tekst: enkel nog het sterke punt valt weg (de kortere
  criterialijst bestaat niet meer).
- Tests aangepast aan de nieuwe aanhef; de volledige flow gebruikt nu een
  rubric zoals de AI hem moet schrijven.

## 1.25.0 · 28 september 2026

**Rubrics in leerlingentaal en persoonlijkere feedback in Skore**

- De AI-prompt (`buildAiRubricPrompt()`) noemt nu ook de leeftijd van het
  leerjaar (`AGE_BY_YEAR`: 1ste jaar 12 tot 13 jaar, 2de jaar 13 tot 14
  jaar) en heeft een nieuwe sectie LEERLINGENTAAL: naam van een criterium
  hoogstens vijf woorden, beschrijving in één zin, niveaus in de je-vorm,
  hoogstens 15 woorden per zin, gewone woorden, actief schrijven. De
  zelfcontrole vraagt of een leerling van die leeftijd elk niveau begrijpt.
- Nieuwe sectie FEEDBACKZINNEN (vervangt VOLGENDE STAP): per niveau een
  `feedbackZin` (nieuw veld `option.say`), een `volgendeStap` en op het
  hoogste niveau een `uitdaging` (bewaard in `option.next` van het
  hoogste niveau). Het nakijken herschrijft een rubric in leerlingentaal
  en vult ontbrekende zinnen aan; elke nieuwe zin is een aparte wijziging
  om aan te vinken.
- De AI-hulp biedt enkel nog 4 of 5 niveaus aan. Rubrics en antwoorden met
  3 niveaus blijven werken.
- Editor: per criterium een inklapbaar deel "Feedbackzinnen voor
  leerlingen" met per niveau de feedbackzin en de volgende stap of de
  uitdaging. Staat een rubric nog niet in de je-vorm of ontbreken zinnen,
  dan één melding met de knop "Laat AI deze rubric nakijken".
- Nieuwe tips bij het nakijken (nooit blokkerend): een rubric die nog niet
  in de je-vorm staat (één melding per rubric), en voor een rubric in de
  je-vorm: zinnen van meer dan 20 woorden, moeilijke woorden
  (`DIFFICULT_WORDS`) en ontbrekende feedbackzinnen.
- Feedbacktekst in Skore (`buildSkoreFeedback()`): nieuwe opbouw zonder
  naam, in de je-vorm, met de labels "Dit ging goed:", "Hier kan je
  groeien:", "Zo pak je het de volgende keer aan:" en, voor wie overal het
  hoogste niveau haalt, "Een uitdaging voor de volgende keer:". Elke regel
  noemt het criterium en gebruikt de feedbackzin (anders de omschrijving).
  Bij een werkpunt komt een vaste vertrouwenszin van de leerkracht
  (`CONFIDENCE_SENTENCES`, wise feedback). Nieuwe zin bij groepswerk.
  `FEEDBACK_MAX_CHARS` is 500 (was 700), zonder de eigen tekst van de
  leerkracht mee te tellen.
- Zinnen die na een beoordeling aangevuld worden, gelden ook voor die
  beoordeling, zonder nieuwe rubricversie.
- Skore: een klein "i" in de kolomkop bij een rubric zonder
  feedbackzinnen, met de uitleg dat de feedback persoonlijker wordt na het
  nakijken door de AI.
- Tests: bewust aangepast zijn de letterlijke feedbackteksten in
  `tests/feedback.spec.js` (nieuwe opbouw) en de test op de ingebouwde
  rubrics in `tests/ai-rubric.spec.js`. Die verwachtte geen enkele
  waarschuwing, maar alle ingebouwde rubrics staan in de derde persoon en
  krijgen nu terecht precies één melding "nog niet in leerlingentaal".
  Nieuwe tests voor de prompt, het inlezen, de waarschuwingen, de
  feedbacktekst, de editor, de kolomkop en de volledige flow.

## 1.24.1 · 28 september 2026

**Knoppen bij Rubrics staan bovenaan**

- De knoppen "Nieuwe evaluatie", "+ Nieuwe map" en "Jaaroverzicht
  afdrukken" staan nu boven de lijst met evaluaties in plaats van eronder
  (`index.html`). Bij een lange lijst hoef je niet meer te scrollen.

## 1.24.0 · 28 september 2026

**De AI-rubriekhulp maakt correctere rubrics**

- Nieuwe schermindeling (`js/ai-rubric.js`, `index.html`): kiezen tussen
  "Nieuwe criteria laten maken" en "Deze rubric laten nakijken", het
  aantal niveaus (3, 4 of 5, standaard 5) met de vaste labels en het
  niveau "doel behaald", en zes optionele contextvragen met keuzeknoppen
  (wat je wil evalueren, wat ze afleveren, individueel of in groep,
  lestijd, voorkennis, andere criteria toegestaan). Enkel beantwoorde
  vragen gaan mee in de prompt.
- Nieuwe prompt (`buildAiRubricPrompt(opts)`): context, vast aantal
  niveaus met labels uit de tool, de lat (doelniveau = het leerplandoel op
  zijn Bloom-niveau, dat in de doelenlijst staat), kwaliteitsregels, een
  volgende stap per niveau in je-vorm, "ookPassend" en "zonderDoel", en
  een zelfcontrole. Geen gedachtestreep in de prompt.
- Inlezen (`parseAiRubricResponse()`): nieuw formaat met `volgendeStap`,
  `ookPassend` en `zonderDoel`; het oude formaat blijft leesbaar. Labels
  komen altijd uit de tool. Na het inlezen: gekoppelde doelen per
  criterium, "Ook passend" met Koppelen en Negeren, "Zonder doel" en tips.
- Knop "Laat AI deze rubric nakijken": prompt met de huidige rubric,
  voorstel per criterium ("Was" en "Wordt") met een vinkje, niets
  verandert zonder bevestiging (`buildAiReview()`). Aantal criteria en
  niveaus blijft gelijk. Opslaan volgt het bestaande versiebeheer.
- Kwaliteitscontrole `rubricWarnings()` (`js/rubric-model.js`) na het
  inlezen en live in de editor ("Nakijken"): ander of gemengd aantal
  niveaus, lege of zeer korte omschrijving, enkel vage woorden, bijna
  dezelfde tekst als het volgende niveau, geen leerplandoel, gedachtestreep.
  Blokkeert nooit.
- Datamodel, optioneel en achterwaarts compatibel (`DB_VERSION` blijft 4):
  `rubric.targetScore` (niveau "doel behaald") en `option.next` (volgende
  stap in je-vorm). Bewaard door `saveDraft()`, dupliceren, `normaliseDb()`,
  samenvoegen en synchroniseren. Tellen bewust niet mee in
  `rubricsDiffer()`, zodat zinnen aanvullen geen nieuwe rubricversie maakt.
- Rubric-editor: per niveau een keuzerondje "doel" en een regel "Volgende
  stap" (niet bij het hoogste niveau). Nieuwe standaardlabels
  (`LEVEL_TEMPLATES`): 3 = Onvoldoende, Voldoende, Sterk; 4 = Onvoldoende,
  Bijna, Voldoende, Sterk; 5 = Onvoldoende, Bijna, Voldoende, Sterk,
  Uitstekend. Bestaande rubrics veranderen niet.
- Feedback in Skore: "Wat is je volgende stap?" gebruikt eerst de eigen
  feedforward, dan de volgende stap van het behaalde niveau (uit de huidige
  rubric als de oude versie die zin nog niet had), dan het niveau erboven.
  Een sterk punt vraagt het doelniveau als dat gekozen is.
- Nieuwe tests: `tests/ai-rubric.spec.js`.

## 1.23.0 · 28 september 2026

**Feedback per leerling kopiëren vanuit het tabblad Skore**

- Naast elk punt in de Skore-tabel staat een kopieerknop (altijd zichtbaar,
  ook op een touchscreen). Eén klik zet een feedbacktekst op het klembord
  om bij het resultaat in Smartschool te plakken, met een korte melding
  onderaan (`showToast()` in `js/ui.js`) en een vinkje in de cel. Het
  vinkje geldt enkel voor deze sessie (`skoreCopied`), wordt niet bewaard
  of gesynchroniseerd en verdwijnt als de beoordeling daarna wijzigt.
  Werkt ook in een gearchiveerd schooljaar. Cellen zonder punt of met
  "vrijgesteld" krijgen geen knop.
- De tekst komt uit `buildSkoreFeedback()` in het nieuwe `js/feedback.js`:
  volledig offline, zonder AI, altijd dezelfde tekst voor dezelfde
  beoordeling. Opbouw volgens Hattie en Timperley: "Waar ga je naartoe?",
  "Waar sta je nu?" (sterk punt en werkpunt uit de rubric, daarna de eigen
  feedback) en "Wat is je volgende stap?" (de eigen feedforward, anders
  de beschrijving van het niveau boven het werkpunt). Geen punten,
  percentages of niveaulabels. Richtwaarde 700 tekens; te lang, dan eerst
  een kortere criterialijst en daarna geen sterk punt. De eigen tekst van
  de leerkracht wordt nooit ingekort.
- Bugfix: Skore rekende het punt met de huidige rubric in plaats van de
  rubricversie waarmee beoordeeld werd. Nu de juiste versie, zoals het
  rapport; had die een ander maximum, dan wordt het punt omgerekend naar
  het maximum van de kolom (met uitleg bij de cel).
- Eén klembordhulp `copyText()` (met `legacyCopy()` als terugvaloptie) in
  `js/ui.js`, gebruikt door Kopieer tabel, de AI-rubriekhulp en Skore. De
  AI-rubriekhulp meldt nu ook als kopiëren mislukt.
- Geen gedachtestreep meer in zichtbare teksten (labels Feedback en
  Feedforward, uitleg, meldingen, de AI-prompt, het rapport). Lege cellen
  tonen overal "–", zoals in Skore. Een datumbereik in Skore toont "t/m".
- Nieuwe tests: `tests/feedback.spec.js`.

## 1.22.0 · 28 september 2026

**Het tabblad Resultaten is nu "Controle": wat ontbreekt er nog?**

- Bugfix eerst: `coverageMatrix()` telde enkel sessies met exact één
  klas. Leerlingen uit een combinatiesessie of leerlingen die van klas
  veranderden telden daardoor als niet beoordeeld. Nu gebruikt het de
  echte klas per leerling (`row.studentKlas`), zoals `collectResults()`.
- Nieuw scherm (`js/controle.js`): filters leerjaar, klas, map en periode
  (Skore-periodes plus "Hele schooljaar"). Blok "Openstaand" per map, met
  per evaluatie en klas wat er mis is en de namen erbij: niet beoordeeld,
  onvolledig, enkel tussentijds, dubbel, niet in de klaslijst, vrijgesteld
  maar toch beoordeeld, en ter info een oudere rubricversie. Knoppen "Nu
  beoordelen" (`openEvaluationFor()` in `js/evaluations.js`, hergebruikt
  de gewone keuzelogica) en "Details" met de klaslijst en een status per
  leerling, plus "Rapport" en "Rapporten afdrukken". Opmerkingen per
  evaluatie: criteria zonder leerplandoel ("Naar Rubrics") en een
  opvallend verschil tussen beoordelaars (`calibration()`, vanaf 15
  procentpunt) als tekst. Ingeklapte blokken "In orde", "Nog niet
  gestart" en "Leerplandoelen". Is alles in orde, dan staat er één zin.
- Dubbel beoordeeld telt enkel eindbeoordelingen: een tussentijdse check
  naast een eindbeoordeling is geen dubbel.
- Nieuw: een leerling achteraf vrijstellen van een evaluatie ("Niet te
  beoordelen"), enkel op het Controle-tabblad, met bevestiging en een
  optionele reden. Altijd ongedaan te maken. Gedeeld met collega's,
  samengevoegd volgens de vaste regel (nieuwste wint, nooit verwijderen)
  en ongedaan maken via het tombstone-patroon (`isTombstoned()`). Verhuist
  mee bij klasverandering (`migrateStudentEvaluations()` kreeg een vierde
  parameter `fromKlas`). Structuur:
  `db.schoolYears[schooljaar].exemptions["leerjaar||evaluatie||klas||leerling"]
  = { reason, by, updatedAt }` en
  `db.tombstones.exemptions["schooljaar||leerjaar||evaluatie||klas||leerling"]`.
  `DB_VERSION` blijft 4: de velden zijn optioneel en oude bestanden openen
  gewoon.
- Bugfix Skore, periodes aanpassen: bij het openklappen van "Periodes van
  dit schooljaar" tekende de editor zich een fractie later opnieuw (via
  het toggle-event). Op een trage computer kon dat een net ingevulde
  datum wissen, waarna de oude data stilletjes opgeslagen werden. Gevonden
  doordat de test één keer faalde op GitHub, nagemaakt met een vertraagd
  toggle-event. Nu vervallen niet-bewaarde wijzigingen bij het
  dichtklappen in plaats van bij het openklappen, en de datumvelden
  luisteren ook naar "input". Twee nieuwe testen.
- Skore toont een vrijgestelde leerling als "vrijgesteld" in plaats van
  "–" (met de reden als tooltip), en de kolom Beoordeeld wordt
  bijvoorbeeld "22/24, 2 vrijgesteld". Is iedereen beoordeeld of
  vrijgesteld, dan kleurt die kolom niet meer oranje.
- Blok Leerplandoelen: per rubriek drie toestanden (niet gekoppeld,
  gekoppeld maar nog niet beoordeeld, beoordeeld met de evaluaties). De
  balkjes, stat-kaarten en de instelling van de drempels zijn weg; de
  standaarddrempels blijven gelden voor "Overzicht afdrukken" en het
  jaaroverzicht (`buildGoalCoverageTable()` ongewijzigd).
- Verwijderd van dit tabblad: kerncijfers, scoretabel per leerling,
  grafieken per criterium en spreiding, kalibratiegrafiek,
  dekkingsmatrix, groeiblok en "Kopieer deze tabel". Verwijderde functies:
  `renderSummary`, `renderWorkPoints`, `weakPoints`, `strugglingOn`,
  `renderCriterionChart`, `renderDistributionChart`, `renderLegend`,
  `renderSpreadChart`, `renderStudentTable`, `copyResultTable`,
  `renderCalibration`, `renderCoverage`, `levelColor`, `renderThresholds`
  en de zoeklijst `resEvalCombo`, plus hun CSS.
- **Bewust blijven staan, maar niet meer op het scherm:** de groeigrafiek
  (`renderGrowthPanel`, `renderGrowthWorkpoints`, `renderGrowthChart`,
  `goalTrendSeries`, `goalTrendComparison` in `js/goals.js`) en haar CSS
  (`.chart`, `.chart-box`, `.legend`). Om ze terug te zetten zijn de
  elementen `#growthBody` en `#growthWorkpoints` nodig, en de velden
  `#resYear`, `#resEval` en `#resKlas` die ze lezen.
- `printReports()` leest leerjaar en evaluatie nu uit het resultaat van
  `collectResults()` (dat nu ook `year`, `evaluation` en `klas` teruggeeft),
  niet meer uit filtervelden.
- De interne namen `btnResults`, `resultsCard2`, view `results`, `#resYear`
  en `#resKlas` blijven: hernoemen levert niets op en raakt app.js,
  storage.js, goals.js, reports.js en de testen.
- Testen: `tests/controle.spec.js` (14 testen, waaronder een echte
  twee-personen-simulatie voor de vrijstelling). De zoeklijsttesten
  verhuisden naar de zoeklijst bij Evalueren (dezelfde code).

## 1.21.0 · 28 september 2026

**Nieuw tabblad Skore: punten per rapportperiode, klaar om over te zetten
naar Skore (Smartschool).**

- Kies leerjaar, klas en periode (GE1 tot GE4). Standaard staat de
  periode van vandaag open; met ‹ en › blader je naar andere periodes.
- Bovenaan een lijst van de evaluaties in die periode, in de volgorde
  waarin ze gebeurden: map, datum, hoeveel leerlingen beoordeeld zijn,
  maximum en een vinkje "Overgezet naar Skore" (gedeeld met collega's).
  Een kopieerknop is bewust weggelaten: plakken kan niet in Skore.
- Daaronder een tabel: leerlingen alfabetisch en genummerd zoals in
  Skore, per evaluatie een kolom met de punten (komma als decimaalteken). Groepsscores tellen met
  de individuele correctie. Tussentijdse checks tellen niet mee.
- "Punten op": zoals in de rubric, of omgerekend naar 10, 20 of 100.
- Periodes zijn per schooljaar aan te passen onder "Periodes van dit
  schooljaar" en worden gedeeld met je collega's. Voor 2026-2027 staan
  standaard: GE1 vanaf 1 september, GE2 vanaf 11 oktober, GE3 vanaf 13
  december, GE4 vanaf 28 februari, tot en met 13 juni. Een periode loopt
  tot de dag vóór de volgende.
- Elke beoordeling onthoudt nu de datum waarop ze gebeurde
  (`row.createdAt`), ook als ze later bewerkt wordt. Oudere beoordelingen
  gebruiken de datum van hun laatste wijziging.
- Samenvoegen volgt het vaste patroon: de nieuwste periode-indeling wint,
  en "overgezet"-vinkjes gaan nooit verloren (nieuwste per evaluatie
  wint).
- Nieuwe code in `js/skore.js`; 8 nieuwe testen in `tests/skore.spec.js`.
- `README.md` in de hoofdmap is nu een volledige handleiding voor
  leerkrachten, per tabblad. Ze wordt bij elke wijziging mee bijgewerkt
  (afspraak in `CLAUDE.md`; een test controleert het versienummer erin).

## 1.20.0 · 28 september 2026

**Opgeruimd en automatisch getest.**

- De NAS-netwerksynchronisatie is verwijderd: de school werkt enkel met
  OneDrive (gedeelde map). Weg zijn het netwerkdeel van `js/sync.js`, de
  netwerkstatus bovenaan, het netwerkblok in de opstartwizard en het
  inbakken van `NETWORK_SYNC` in `build.js`. Werkbestanden blijven gewoon
  werken; de gedeelde map verandert niet. Nog terug te vinden in de
  git-historie (tot en met 1.19.1).
- De ongebruikte demo-omgeving is verwijderd (`build-demo.js`, `IS_DEMO`,
  `DEMO_SEED`, de demo-balk en bijbehorende stijlen).
- Nieuwe testreeks in `tests/` (Playwright, 27 testen) met
  `npm test`, en automatische controle op GitHub bij elke push
  (`.github/workflows/controle.yml`). Het gebouwde HTML-bestand is na
  elke geslaagde run te downloaden onder "Artifacts".

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
