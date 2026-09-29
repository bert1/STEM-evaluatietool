# HANDOFF — STEM Evaluatietool

Laatst bijgewerkt: 29 september 2026, versie **1.31.1**.

Dit document vat samen waar het project staat, zodat een nieuwe sessie hiermee
kan starten zonder de volledige geschiedenis opnieuw te moeten meegeven. Geef
dit bestand mee, samen met `stem-evaluatietool-broncode.zip` en (optioneel)
`stem-evaluatietool-tests.zip`.

## Wat dit is

Een volledig offline evaluatietool voor STEM-leerkrachten secundair onderwijs
in Vlaanderen (2de jaar). Eén HTML-bestand, dubbelklikken, geen server, geen
installatie — bewust zo ontworpen voor collega's die niet computervaardig
zijn. Rubrics met Bloom-niveaus, koppeling aan leerplandoelen, resultaten en
grafieken, teamsynchronisatie via een gedeelde map, en sinds kort AI-hulp bij
het opstellen van rubrics.

De belangrijkste, terugkerende ontwerpregel doorheen dit hele project:
**eenvoud voor de eindgebruiker weegt zwaarder dan elegantie voor de
ontwikkelaar.** Bijna elke architecturale keuze hieronder is daaruit te
verklaren.

## Waar alles staat

Sinds 28 september 2026 staat alles in de GitHub-repository
`bert1/STEM-evaluatietool`:

- **Broncode, dé bron van waarheid:** `stem-evaluatietool/`
- **Testreeks:** `tests/*.spec.js` (Playwright), instellingen in
  `playwright.config.js`, afhankelijkheden in `package.json`
- **Automatische controle:** `.github/workflows/controle.yml` bouwt en test
  bij elke push; het gebouwde HTML-bestand staat bij elke geslaagde run
  onder "Artifacts"
- **Handleiding voor leerkrachten:** `README.md` (bij elke wijziging bijwerken)
- **Werkafspraken voor ontwikkelsessies:** `CLAUDE.md`
- **Laatst gebouwde versie voor collega's:** `STEM-Evaluatietool-vX.Y.Z.html`
  in de hoofdmap van de repository

### Starten in een nieuwe sessie

1. `npm ci`
2. `npm test` (bouwt naar `stem-evaluatietool/dist/` en draait de testreeks;
   in de Claude-cloudomgeving met `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)
3. Pas daarna wijzigen, en na elke wijziging opnieuw `npm test`

## Architectuur

**Twee lagen**, bewust zo opgesplitst na een grondige, geverifieerde migratie:

- **Ontwikkeling:** losse, leesbare bestanden in `data/`, `js/`, `css/`,
  geladen via gewone `<script src>`-tags in `index.html` (géén `import`/
  `export` — dat werkt niet vanaf `file://`, zie `README.md` in de broncode
  voor de volledige uitleg met bewijs).
- **Uitlevering:** `node build.js` plakt alles samen tot het ene bestand dat
  de leerkracht krijgt. `build.js` leest `index.html` zelf en vervangt
  `<link>`/`<script src>` door hun inhoud — er is dus maar één HTML-bronbestand,
  geen apart "shell"-sjabloon.

**Modules** (`js/`, sinds 1.19.1 is `evaluations.js` opgesplitst, zie
boven): `ui.js` ($/el-hulpfuncties, `makeSearchCombo`, klembord `copyText()`
en `legacyCopy()`, melding `showToast()`; moet als eerste laden),
`state.js` (db-model, opslaan/laden, mergeDb, schooljaren), `storage.js`
(bestand openen/opslaan, File System Access API), `rosters.js` (klaslijsten,
Excel-import), `subjects.js` (vakken, sinds 1.28.0), `evaluations.js` (rubric-editor, scores, AI-rubriekhulp),
`results.js` (statistieken, grafieken, kalibratie), `reports.js` (rapport,
feed-up-blad), `goals.js` (leerplandoelen-UI, groeigrafiek), `sync.js`
(gedeelde map, team), `backups.js` (reservekopieën, sinds 1.26.0), `feedback.js` (feedbacktekst voor Smartschool, sinds
1.23.0), `skore.js`, `controle.js`, `app.js` (opstart, wizard,
navigatie, moet als laatste laden).

**Belangrijke valkuil, al één keer misgegaan:** `build.js` gebruikt
`String.replace()` met een **functie** als tweede argument, nooit een kale
string. Reden: sommige functies in de broncode bevatten zelf tekst als
`"\\$&"` (bijvoorbeeld `cssEscape`), en JavaScript interpreteert `$&` in een
kale vervangstring speciaal — dat brak de build ooit stilzwijgend.

## Versiebeheer

Semantisch (`MAJOR.MINOR.PATCH`), sinds versie 1.0.0 (afgesproken met de
gebruiker, niet automatisch). `APP_VERSION` in `js/state.js` — **niet** te
verwarren met `DB_VERSION` (huidig: 4), dat is het opslagformaat van een
werkbestand, voor migraties. `CHANGELOG.md` in de broncode heeft de volledige
geschiedenis per versie.

- **PATCH**: bugfix, geen nieuwe functie
- **MINOR**: nieuwe functie, oude bestanden blijven werken
- **MAJOR**: nog niet gebruikt; zou een breuk met oude bestanden betekenen

`build.js` schrijft altijd **twee** bestanden: een vaste naam (voor de
testreeks) en een versie-benoemde kopie (voor de gebruiker).

## Volledige featurelijst (huidige stand, 1.31.1)

- **Bugfix klaspaneel en vak** (1.31.1), gemeld door de gebruiker:
  `renderKlasMultiPanel()` in `js/evaluations.js` gebruikte
  `classesFor()` en toonde dus alle klassen, ook met een vak gekozen. Nu
  `classesForSubject(db, year, selectedSubject())`. **Les:** het
  Evalueren-scherm heeft onzichtbare `<select>`s (`#classSelect`,
  `#evalSelect`) met een zelfgetekend paneel erboven. Test een filter
  altijd op het zichtbare paneel (`#klasMultiPanel`, `#evalComboPanel`),
  niet enkel op de onzichtbare lijst. Let op: `.klas-multi-option` staat
  in hoofdletters via CSS, gebruik `allTextContents()`.


- **Vak verplicht bij een nieuwe evaluatie** (1.31.0), gevraagd door de
  gebruiker. `validateEvaluation(draft, db, originalName)` in
  `js/rubric-model.js` geeft een probleem als `originalName` leeg is
  (nieuw of Dupliceer) en `draft.subject` leeg is; zonder vakken in het
  leerjaar verwijst de melding naar Instellingen, Vakken. Bewust enkel bij
  nieuwe evaluaties: bestaande zonder vak blijven bewerkbaar (anders zou
  een tikfout verbeteren in een oude rubric onmogelijk zijn tot je ze
  indeelt). `fillDraftSubjectOptions()` toont bij nieuw "Kies een vak"
  en de uitleg "Verplicht". De testhulpen `nieuweEvaluatie()` in
  `tests/ai-rubric.spec.js` en `tests/omzetten.spec.js` maken daarom eerst
  een vak "STEM" en kiezen het.


- **Vakken als eigen onderdeel** (1.30.0): op vraag van de gebruiker een
  vierde onderdeel onder Instellingen, `#btnSubjects` (view `subjects`,
  kaart `#subjectsCard`, `openSubjects()` in `js/subjects.js`). Volgorde:
  Algemeen, Klaslijsten, Vakken, Team. `#subjectSection` staat niet meer
  in `#rosterCard`; `refreshAll()` tekent het opnieuw als die view open
  staat. README: eigen hoofdstuk 5, de rest schoof op.


- **Tab Instellingen** (1.29.0, `js/app.js`, `index.html`). Gevraagd door
  de gebruiker: de bovenste rij moet overzichtelijk blijven als er
  instellingen bijkomen. Bovenaan `#btnSettings`; daaronder de rij
  `#settingsTabs` met `#btnSettingsGeneral` (Algemeen, nieuw scherm
  `#generalCard`, view `general`), `#btnRoster`, `#btnSubjects` (sinds
  1.30.0) en `#btnTeam` (zelfde ids,
  zelfde schermen als vroeger). `SETTINGS_VIEWS` in `js/app.js` bepaalt
  welke views onder Instellingen vallen: `showView()` toont dan de rij en
  zet `#btnSettings` actief. `openSettings()` opent `lastSettingsView`.
  **Een nieuw onderdeel toevoegen:** knop in `#settingsTabs`, kaart in
  `index.html`, en de naam in `VIEWS`, `NAV`, `SETTINGS_VIEWS` en
  `openSettingsView()`. **Algemeen** bevat `#btnAddSchoolYear` (verhuisd
  uit de kop; `#schoolYearSelect` bleef in de kop) en het versienummer.
  Testen die `#btnRoster` of `#btnTeam` aanklikken, klikken eerst
  `#btnSettings` (die knoppen zijn anders onzichtbaar).


- **Vakken** (1.28.0, `js/subjects.js`, laadt na `rosters.js`). Gevraagd
  door de gebruiker: 2STa en 2TWa mogen niet dezelfde evaluaties zien,
  anders wordt de lijst te lang. Vakken toevoegen bij
  Instellingen, Vakken (tot 1.29.0 op het Klaslijsten-scherm), kiezen bij een rubric, en bij Evalueren eerst het
  vak kiezen.
  **Opslag:** `db.subjects[leerjaar] = [{name, classes, updatedAt}]`,
  niet per schooljaar (zoals rubrics en mappen), en `ev.subject` (leeg =
  geen vak). `normaliseDb()` kopieert `subject` (anders ging het verloren,
  die functie neemt enkel bekende velden van een evaluatie over) en
  `normaliseSubjects()`. `dbBlob()` en `backupData()` nemen `subjects` mee.
  **Samenvoegen:** `mergeSubjects()`, nieuwste `updatedAt` wint (de
  klassen), nieuwe tombstone-soort `subjects` met sleutel
  `leerjaar||vak`. `deleteSubject()` zet `subject` van de evaluaties leeg
  en verhoogt hun `updatedAt`. `refreshRestoredTimes()` kent de vakken.
  **Klassen:** een vak zonder klassen toont alle klassen
  (`classesForSubject()`); namen van klassen die dit schooljaar niet
  bestaan, worden gewoon genegeerd.
  **Evalueren:** `#subjectWrap`/`#subjectSelect` tussen leerjaar en klas,
  verborgen als het leerjaar geen vakken heeft. `fillClassAndEvalOptions()`
  roept `fillSubjectOptions()` aan en filtert klassen en evaluaties;
  `evaluationGroups(year, subject)` en `fillGroupedEvalSelect(..., subject)`
  hebben een optioneel vak. Keuze per leerjaar in localStorage
  (`SUBJECT_CHOICE_KEY`), niet in het werkbestand. `closeSessionIfHidden()`
  sluit een open beoordeling die door de filter verborgen raakt (ook in
  `refreshAll()`). `openEvaluationFor()` (Nu beoordelen) zet het vak van
  de evaluatie, of "Alle vakken" als de klas niet bij dat vak hoort.
  `makeSearchCombo()` kreeg een optionele `emptyTextFn`.
  **Rubrics:** `#draftSubject` in de editor (`fillDraftSubjectOptions()`,
  uitgeschakeld zonder vakken, volgt `#draftYear`), `.eval-subject-select`
  per rij en de filter `#evalListSubject` (waarde `NO_SUBJECT` = " geen"
  voor evaluaties zonder vak). Controle en Skore filteren niet op vak:
  die werken al per klas.
  **Testen:** `tests/vakken.spec.js`. Getoetst door de filter uit te
  schakelen: drie testen faalden.


- **Bestaande evaluatie omzetten** (1.27.0, `js/ai-source.js`, stand
  `aiMode = "omzetten"` in `js/ai-rubric.js`). Gevraagd door de
  gebruiker: oude evaluatiefiches (Excel, voorbeelden in
  `tests/fixtures/`) of stukken cursus invoegen en met de AI omzetten
  naar een rubric volgens het huidige systeem.
  **Inlezen:** `readSourceFile(file)` geeft een Promise met tekst. Excel
  via `readXlsx()` uit `js/rosters.js`, dat sindsdien per tabblad ook
  `merges` (`sheetMerges()`) en `rowNumbers` (`sheetRowNumbers()`, want
  lege rijen ontbreken in de XML) teruggeeft; de klaslijsten negeren die.
  `xlsxSheetText()` is puur: een samengevoegde cel over kolommen staat er
  één keer met "(over N kolommen)" (`sourceSpanText()`), over rijen
  herhaald in elke rij; lege rijen, invulstreepjes en een regel die gelijk
  is aan de vorige vallen weg. Word: `word/document.xml`, alinea's en
  tabellen (`gridSpan` ook als "(over N kolommen)"). PowerPoint: dia's op
  nummer gesorteerd. Tekstbestanden rechtstreeks. PDF, .doc, .xls en
  andere: foutmelding met uitleg om te kopiëren en te plakken (bewust
  geen pdf.js: te groot voor het ene HTML-bestand).
  **Scherm:** knop "Bestaande evaluatie omzetten" (`#aiModeConvert`),
  vak `#aiSource` dat de leerkracht kan nakijken en inkorten, knop "Bestand
  kiezen" (meerdere bestanden, voegt toe), melding in `#aiSourceState`, tip
  vanaf `SOURCE_LONG_CHARS` (30 000). Zichtbaarheid per stand gaat nu met
  `data-ai-modes="nieuw omzetten"` in plaats van de klassen
  `ai-new-only`/`ai-review-only`. De beschrijving is bij omzetten
  optioneel, het materiaal verplicht; de vraag "ook andere criteria" staat
  enkel bij nieuw.
  **Prompt:** zelfde opbouw als "nieuw" (vaste niveaus en labels, de lat,
  kwaliteitsregels, leerlingentaal, feedbackzinnen, leerplandoelen), plus
  een sectie OMZETTEN (`aiConvertRules(levels)`) en het materiaal onderaan
  in BESTAAND MATERIAAL, vóór de zelfcontrole. `sourceForPrompt()` maakt
  van gedachtestreepjes een dubbelpunt (de fiches hebben "4 – Uitstekend")
  en van ``` twee backticks. Geen vast aantal criteria bij een fiche (een
  fiche met 15 criteria blijft er 15); 4 tot 7 bij cursusmateriaal.
  **Antwoord:** zelfde formaat, plus `nietOvergenomen[]` (`onderdeel`,
  `reden`), ingelezen als `notTaken` en getoond onder "Niet overgenomen".
  Het inlezen gebruikt verder gewoon `parseAiRubricResponse()`.
  **Meegenomen bugfix:** `#aiPromptBlock` kreeg `form-group`, anders was
  het promptvak maar ongeveer 220 pixels breed.
  **Testen:** `tests/omzetten.spec.js`, met twee echte fiches van de
  school (lege sjablonen) en kleine zelfgemaakte .docx, .pptx en .pdf.

- **Reservekopieën en terugzetten** (1.26.0, `js/backups.js`, laadt na
  `sync.js`). Gevraagd door de gebruiker: bij een fout van een leerkracht
  moet er een vorige versie bestaan, in een OneDrive-map "backups", met
  datum en uur in de naam, en terug te zetten.
  **Waar:** `folderHandle.getDirectoryHandle("backups")`, dus enkel met een
  gedeelde map (een los werkbestand geeft via de File System Access API
  geen toegang tot zijn map). Naam `evaluaties-BB-JJJJ-MM-DD-UUuMM.json`
  in lokale tijd (`backupFileName()`, `parseBackupName()`). Iedereen ziet
  en ruimt enkel zijn eigen kopieën op. `readTeamFolder()` leest enkel
  bestanden in de hoofdmap, dus kopieën tellen nooit mee bij synchroniseren
  (test).
  **Wanneer:** `writeHandle()` roept na elke geslaagde opslag
  `maybeBackup()` aan: hoogstens één per `BACKUP_INTERVAL_MS` (1 uur),
  en geen nieuwe als de inhoud (zonder tijdstip) gelijk is aan de
  nieuwste kopie (`lastBackupContent`, bij de eerste keer in een sessie
  gelezen uit de nieuwste kopie op schijf). De eerste opslag van een
  sessie is die van `attachOwnFile()` bij het verbinden, dus er is altijd
  een kopie van vóór je iets verandert. De kopie bevat ook
  `localTombstones` (anders dan `dbBlob()`).
  **Opruimen:** `backupsToRemove(list, now)`, puur: alles jonger dan 14
  dagen, daarna de nieuwste per week (maandag tot zondag), ouder dan 365
  dagen weg, de 10 nieuwste altijd behouden.
  **Terugzetten** (`restoreBackup()`): bevestiging met aantallen, eerst
  `makeBackup()` van de huidige stand, dan `db` vervangen. Belangrijk:
  `refreshRestoredTimes(restored, current, now)` geeft alles wat in de
  kopie anders is dan nu (rijen op id, klassen, rubrics, mappen,
  vrijstellingen, periodes, Skore-vinkjes) een tijdstip dat strikt later
  is dan de huidige versie én dan een tombstone. Zonder dat zou "Team
  bijwerken" de fout meteen terugbrengen uit het bestand van een collega
  die ze al overnam (nieuwste wint). Een test bewaakt dat, en faalt als je
  de functie uitschakelt. Rijen zonder `createdAt` krijgen eerst hun oude
  `updatedAt` als `createdAt`, zodat de Skore-periode niet verschuift.
  **Bewuste grens:** wat na de kopie nieuw bijkwam (ook door de fout, bv.
  een verkeerd toegevoegde rij) komt terug bij "Team bijwerken" als een
  collega het al heeft. Er zijn geen tombstones voor rijen, en nieuw werk
  van collega's mag niet verdwijnen. Uitgelegd in de README.
  **UI:** `#backupSection` op het Teamscherm (verborgen zonder map),
  `renderBackupList()` wordt aangeroepen vanuit `renderFolderSection()`.
  **Testen:** `tests/reservekopie.spec.js` met een nagemaakte map in het
  geheugen (OPFS, `navigator.storage.getDirectory()`, geeft een
  SecurityError vanaf `file://`) en `page.clock.setFixedTime()` voor de
  uren.


- **Vertrouwenszinnen zonder druk** (1.25.2). De gebruiker vond "Ik geef
  je deze tip omdat ik veel van je verwacht" te veel druk voor 12 tot 14
  jaar. Alle zeven zinnen in `CONFIDENCE_SENTENCES` herschreven: vertrouwen
  dat de leerling het kan leren, hulp aanbieden, fouten horen bij leren.
  Geen "verwacht", "lat hoog", "streng", "zeker van" of "moet" (een test
  bewaakt dat). In 1.25.3 werd "Ik ben benieuwd naar je volgende poging"
  vervangen door "Elke keer dat je iets probeert, leer je iets bij." (de
  gebruiker vond die zin niet goed). Niet terugdraaien naar de oorspronkelijke formulering van
  Yeager ("hoge verwachtingen") zonder de gebruiker te vragen.

- **Feedback duidelijk zonder de rubric** (1.25.1). De gebruiker vond
  "Bij Meten: ..." onduidelijk: een leerling weet weken later niet meer
  wat "Meten" of "Voorspellen" betekent. Gekozen (uit twee voorstellen;
  het andere was de beschrijving van het criterium tussen haakjes):
  concrete namen en zinnen. De prompt vraagt nu criterianamen die zeggen
  wat de leerling in deze opdracht maakte of deed ("Je voorspellingen
  vooraf", "Je filmpjes van het ei") en feedbackzinnen die zonder rubric
  duidelijk zijn, met een extra vraag in de zelfcontrole. De aanhef heeft
  geen lijst met criterianamen meer: "Dit is je feedback bij "opdracht"."
  De volgende stap van het werkpunt staat zonder "Bij ..." (ze hoort bij
  het werkpunt net erboven). `criterionName()` maakt van "Je ..." na
  "Bij" een kleine letter. Inkorten: enkel nog het sterke punt weglaten.

- **Rubrics in leerlingentaal en feedbackzinnen per niveau** (1.25.0,
  `js/ai-rubric.js`, `js/rubric-model.js`, `js/rubric-editor.js`,
  `js/feedback.js`, `js/skore.js`). Leerlingen van 12 tot 14 jaar lezen
  de rubric zelf (feed-up-blad, rapport, feedback in Skore).
  **Prompt:** `AGE_BY_YEAR` (1ste jaar 12 tot 13, 2de jaar 13 tot 14;
  een ander leerjaar krijgt geen leeftijd) in de openingszin; nieuwe
  secties LEERLINGENTAAL (`aiLanguageRules(hasPrior)`: naam hoogstens vijf
  woorden, beschrijving één zin, je-vorm, hoogstens 15 woorden per zin,
  alledaagse woorden met een verwijzing naar "vooraf geleerd" enkel als
  die contextvraag ingevuld is, actief schrijven) en FEEDBACKZINNEN (was
  VOLGENDE STAP). Zelfcontrole met de leeftijd erin. Bij "nakijken" vraagt
  de prompt ook herschrijven in leerlingentaal en ontbrekende zinnen
  aanvullen; id, aantal niveaus en labels blijven vast.
  **Velden per niveau:** `option.say` (json `feedbackZin`, nieuw,
  optioneel): wat de leerling op dit niveau toonde, je-vorm, zonder naam,
  punten of niveaunaam. `option.next` (json `volgendeStap`) zoals in
  1.24.0, en **op het hoogste niveau de uitdaging** (json `uitdaging`),
  zodat er geen extra veld nodig was. Daarvoor zijn weggehaald: het
  wissen van `next` op het hoogste niveau in `saveDraft()`,
  `parseAiRubricResponse()` en `buildAiReview()`, en het verbergen in de
  editor. `rubricsForAiReview()` stuurt `feedbackZin` mee en `uitdaging`
  in plaats van `volgendeStap` bij het hoogste niveau.
  **Opslag en versies:** `say` en `next` tellen niet mee in
  `rubricsDiffer()`, dus zinnen aanvullen maakt geen nieuwe rubricversie
  en geeft geen melding "oudere versie" op Controle (die kijkt enkel naar
  het versienummer). `scoredCriteria()` haalt ontbrekende zinnen uit de
  huidige rubric (zelfde criterium-id en score, `levelText()`).
  `normaliseDb()` kopieert `ev.rubrics` volledig, dus `say` overleeft
  opslaan, samenvoegen en synchroniseren (test). `DB_VERSION` blijft 4.
  **Editor:** per criterium een inklapbaar deel "Feedbackzinnen voor
  leerlingen" (`renderFeedbackSentences()`, standaard dicht, open blijft
  open via `feedbackSentencesOpen[rubric.id]`) met per niveau `.level-say`
  en `.level-next` (aria-label "Volgende stap" of "Uitdaging"). Onder de
  tips één melding `.feedback-tip` met de knop "Laat AI deze rubric
  nakijken" zolang de rubric niet in de je-vorm staat of zinnen mist. De
  editor filtert `PUPIL_LANGUAGE_WARNING` en `FEEDBACK_SENTENCES_WARNING`
  uit de gewone tips, zodat de melding er maar één keer staat; bij het
  inlezen van een AI-antwoord staan ze wel in de gewone tips.
  **Waarschuwingen** (`rubricWarnings()`, nooit blokkerend):
  `rubricInPupilLanguage()` = minstens de helft van de ingevulde
  omschrijvingen bevat je, jij, jou, jouw of jullie. Zo niet: één melding
  voor de hele rubric (`PUPIL_LANGUAGE_WARNING`), en dan bewust **geen**
  meldingen over lange zinnen of moeilijke woorden (de ingebouwde rubrics
  hebben er tientallen, en het nakijken door de AI lost ze samen op).
  Staat ze wel in de je-vorm: zin van meer dan `LONG_SENTENCE_WORDS` (20)
  woorden, woorden uit `DIFFICULT_WORDS` (alle vormen uitgeschreven), en
  één melding als niet elk niveau een feedbackzin en een volgende stap of
  uitdaging heeft (`rubricHasFeedbackSentences()`). De test op de
  ingebouwde rubrics verwacht nu precies één je-vorm-melding per rubric.
  **Aantal niveaus in de AI-hulp:** enkel nog 4 of 5 (knop 3 weg uit
  `index.html`). `LEVEL_TEMPLATES[3]` blijft, zodat rubrics en antwoorden
  met 3 niveaus blijven werken.
  **Feedbacktekst:** zie "Feedback kopiëren vanuit Skore" hieronder.
  **Voornaam bewust niet:** voorgesteld (aparte voornaam per leerling in
  de klaslijst), maar de gebruiker koos ervoor de naam weg te laten. De
  Smartschool-export heeft één naamkolom "Achternaam Voornaam", dus de
  voornaam is niet betrouwbaar te bepalen. De tekst is persoonlijk door de
  je-vorm. Niet opnieuw voorstellen zonder dat de gebruiker erom vraagt.

- **Knoppenrij bij Rubrics bovenaan** (1.24.1, `index.html`): "Nieuwe
  evaluatie", "+ Nieuwe map" en "Jaaroverzicht afdrukken" staan boven de
  filters en de lijst in `#evalListView`.

- **AI-rubriekhulp herwerkt** (1.24.0, `js/ai-rubric.js`, controle in
  `js/rubric-model.js`). Blijft kopiëren en plakken zonder sleutel.
  **Scherm:** stand "nieuw" of "nakijken" (`aiMode`), aantal niveaus
  (sinds 1.25.0 enkel 4/5, standaard `DEFAULT_LEVEL_COUNT` = 5) met labels, beschrijving
  (enkel verplicht bij "nieuw"), zes optionele contextvragen
  (keuzeknoppen `.chip-toggle` met `aria-pressed`; bij één keuze kan je
  opnieuw klikken om uit te zetten). `aiContextLines()` zet enkel
  beantwoorde vragen in de prompt; "andere criteria toegestaan" enkel als
  "Wat wil je evalueren?" ingevuld is.
  **Labels en lat:** `LEVEL_TEMPLATES` (3 = Onvoldoende, Voldoende, Sterk;
  4 = Onvoldoende, Bijna, Voldoende, Sterk; 5 = Onvoldoende, Bijna,
  Voldoende, Sterk, Uitstekend) en `LEVEL_TARGETS` (doelniveau 2, 3, 3),
  ook voor "Criterium toevoegen" in de editor. De AI schrijft enkel
  omschrijvingen; labels komen altijd uit de tool (ook bij het oude
  antwoordformaat; enkel een aantal zonder reeks valt terug op het label
  van de AI). Reden: de score is het niveaunummer, dus een gemengd aantal
  niveaus laat criteria ongewild zwaarder wegen.
  **Waarom de prompt zo is:** (1) het doelniveau beschrijft het gekoppelde
  leerplandoel op zijn Bloom-niveau (staat bij elk doel in de lijst als
  "SW01 [toepassen]: ..."), erboven gaat verder, eronder toont wat
  ontbreekt; zonder doelen (1ste jaar) "wat je minimaal verwacht";
  (2) kwaliteitsregels: één aspect per criterium, concreet en waarneembaar
  (geen vage woorden zonder uitleg), elk niveau zegt wat er wél is, ook
  het laagste, parallelle niveaus met dezelfde zinsbouw, geen criteria
  over de persoon (inzet, houding, motivatie) maar wel over het proces,
  minstens één procescriterium bij een ontwerp- of onderzoekscyclus,
  1 of 2 zinnen, geen gedachtestreep; (3) een volgende stap per niveau
  (behalve het hoogste) in je-vorm; (4) "ookPassend" (doelen die passen
  maar door geen criterium gedekt worden, met uitleg) en "zonderDoel";
  (5) een zelfcontrole vóór het antwoord. Geen gedachtestreep in de prompt
  zelf: modellen nemen de stijl van de vraag over.
  **Antwoordformaat:** `criteria[]` met `naam`, `beschrijving`,
  `leerplandoelen`, `niveaus[]` (`omschrijving`, `volgendeStap`), en `id`
  bij nakijken; daarnaast `ookPassend[]` (`doel`, `uitleg`) en
  `zonderDoel[]`. `parseAiRubricResponse(text, year, takenIds)` geeft
  `{criteria, alsoFitting, withoutGoal, goalsSkipped}`.
  **Nakijken:** `buildAiReview()` koppelt op id (anders plaats), behoudt
  scores, labels en aantal niveaus, en geeft per criterium de wijzigingen.
  Niets verandert zonder "Gekozen wijzigingen overnemen"; daarna volgt
  opslaan het gewone versiebeheer. Bewust geen criteria toevoegen of
  schrappen (afgesproken): dat zou het maximum en bestaande beoordelingen
  raken.
  **Controle:** `rubricWarnings(rubrics, year, chosenLevels)`, enkel
  waarschuwingen. Vaag = na het weglaten van vulwoorden enkel woorden uit
  `VAGUE_WORDS`; kort = minder dan 4 woorden; bijna gelijk =
  `textSimilarity()` van minstens 0,9 met het volgende niveau (afgesteld
  zodat de bestaande rubrics geen valse meldingen geven, een test bewaakt
  dat). Live onder de criteria (`#draftChecks`) en na het inlezen.
  **Datamodel:** `rubric.targetScore` en `option.next`, optioneel.
  `DB_VERSION` bleef 4. Geen velden op het niveau van de evaluatie:
  `normaliseDb()` kopieert criteria volledig, maar niet onbekende velden
  van de evaluatie. `saveDraft()` en `duplicateEvaluation()` nemen ze mee.
  Ze tellen NIET mee in `rubricsDiffer()`, zodat zinnen aanvullen geen
  nieuwe rubricversie maakt (anders melding "oudere rubricversie" bij
  Controle voor alle eerdere beoordelingen).
  **Feedback in Skore:** volgende stap = eigen feedforward, anders
  `option.next` van het behaalde niveau van het werkpunt (valt terug op de
  huidige rubric, zelfde id en score), anders de omschrijving van het
  niveau erboven. Sterk punt vraagt `targetScore` als die er is.

- **Feedback kopiëren vanuit Skore** (1.23.0, `js/feedback.js` en
  `buildSkoreCopyButton()` in `js/skore.js`): naast elk punt een
  kopieerknop die een feedbacktekst voor Smartschool op het klembord zet
  (tekst plakken kan daar wel, punten niet).
  **Welke beoordeling:** dezelfde als het punt. `collectSkore()` bewaart
  de gekozen rij in `byStudent[naam].row` (recentste bij dubbel, geen
  tussentijdse checks, binnen de periode). Er is dus één plek die bepaalt
  welke beoordeling telt. `buildSkoreFeedback(dbObj, year, evaluation,
  row, student)` is puur en krijgt die rij mee (bewust niet zelf zoeken).
  **Theorie: feedback voor leerlingen van 12 tot 14 jaar** (aangevuld in
  1.25.0, ook in het commentaarblok van `js/feedback.js`):
  - Hattie en Timperley (2007): feed-up, feedback, feed-forward. Tot
    1.24.1 als drie vragen in de kopjes; sinds 1.25.0 korte labels in
    leerlingentaal ("Dit ging goed:", "Hier kan je groeien:", "Zo pak je
    het de volgende keer aan:"), omdat de vragen te abstract zijn.
  - Kluger en DeNisi (1996): feedback die de aandacht op de persoon
    richt, verlaagt de prestatie; taak, aanpak en zelfsturing werken.
  - Wisniewski, Zierer en Hattie (2020): informatierijke feedback werkt
    het sterkst. Daarom altijd het criterium erbij ("Bij X: ...").
  - Mueller en Dweck (1998): prijs de aanpak, niet het talent.
  - Yeager en collega's (2014), wise feedback: leerlingen van 12 à 13
    jaar gebruiken feedback veel vaker als de leerkracht hoge
    verwachtingen uitspreekt en zegt dat de leerling die kan halen. Sinds
    1.25.2 enkel het vertrouwen en de hulp, zonder de hoge verwachtingen:
    die legden volgens de gebruiker te veel druk.
  - Butler (1988): geen cijfer naast de commentaar.
  - Shute (2008): kort, concreet, eenvoudige woorden; hoogstens één sterk
    punt, één werkpunt, één uitvoerbare volgende stap.
  - Ook een sterke leerling krijgt een concrete volgende stap: de
    uitdaging uit de rubric.
  De tool leidt enkel taak en proces af uit de rubric; regulatie en
  persoon komen enkel uit de eigen tekst van de leerkracht.
  **Opbouw sinds 1.25.0:** zonder naam, in de je-vorm. Aanhef "Dit is je
  feedback bij "opdracht"." (sinds 1.25.1, was een lijst met
  criterianamen; plus bij groepswerk "Dit
  was een groepsopdracht, de feedback gaat over het werk van jullie
  groep."), dan "Dit ging goed:" (sterk punt), "Hier kan je groeien:"
  (werkpunt, dan een vertrouwenszin, dan `row.feedback`), en "Zo pak je
  het de volgende keer aan:" (eigen feedforward, anders `next` van het
  werkpunt als losse zin zonder "Bij ...", anders `desc` van het niveau
  erboven). Zonder werkpunt: "Een
  uitdaging voor de volgende keer:" met de uitdaging van het eerste
  criterium dat er een heeft, tenzij er een eigen feedforward is. Zonder
  werkpunt komt `row.feedback` onder "Dit ging goed:". Per regel "Bij
  criterium: zin", met `say` en anders `desc` als terugval; na het
  dubbelpunt altijd een kleine letter (`feedbackSentence()`), behalve bij
  een woord met nog een hoofdletter erin (LED).
  **Vertrouwenszinnen:** vaste lijst `CONFIDENCE_SENTENCES` (zeven zinnen
  in de ik-vorm van de leerkracht, niet door de AI geschreven), enkel bij
  een werkpunt. Keuze met `feedbackHash(leerling + "|" + evaluatie)`: vast
  voor dezelfde beoordeling, verschillend tussen klasgenoten. De naam
  wordt enkel daarvoor gebruikt, nooit in de tekst.
  **Kolomkop in Skore:** een klein "i" (`.skore-th-hint`) als de huidige
  rubric nog geen enkele feedbackzin heeft
  (`evaluationHasFeedbackSentences()`), met de uitleg "De feedback wordt
  persoonlijker als je deze rubric laat nakijken door de AI."
  **Keuzes van 1.23.0 die blijven:**
  **Keuzes (afgesproken met de gebruiker):** positie van een niveau =
  (score - laagste) / (hoogste - laagste). Werkpunt = laagste positie,
  bij gelijke stand het eerste criterium van de rubric, niet als het al
  het hoogste niveau is. Sterk punt = hoogste positie, enkel vanaf 0,5
  ("Voldoende" telt mee) en hoger dan het werkpunt. Volgende stap = eigen
  feedforward, anders de `desc` van het niveau boven het werkpunt ("Om een
  niveau hoger te komen bij X: ..."). Geen punten, percentages,
  niveaulabels. De individuele correctie bij groepswerk wordt niet
  vermeld. Richtwaarde `FEEDBACK_MAX_CHARS` = 500 sinds 1.25.0 (was 700),
  **zonder** de eigen tekst van de leerkracht mee te tellen: te lang, dan
  geen sterk punt (enkel als er een werkpunt is). De stap met een kortere
  criterialijst verviel in 1.25.1, samen met de lijst. Werkpunt, volgende stap en eigen tekst
  blijven altijd, dus bij een oude rubric met lange omschrijvingen kan de
  tekst toch langer zijn.
  **Vinkje:** `skoreCopied` in het geheugen, sleutel rij-id + `updatedAt`
  + leerling; niet in db, niet gesynchroniseerd.
  **Bugfix meegenomen:** `collectSkore()` rekent het punt nu met
  `rubricsForVersion()`; een ander maximum in die versie wordt omgerekend
  naar het kolommaximum (`skoreCellScore()`).
  De eigen volgende-stapzin per niveau kwam er in 1.24.0 (zie hierboven).

- **Tabblad Controle** (1.22.0, `js/controle.js`, was Resultaten): toont
  enkel wat ontbreekt of niet klopt, zonder punten of grafieken. Interne
  namen bleven (`btnResults`, `resultsCard2`, view `results`, `#resYear`,
  `#resKlas`). Kern: `controleScan(year)` (één keer over alle sessies,
  met de echte klas per leerling), `controleCheck()` (status per
  leerling en de controlepunten), `controleEvalNotes()` (criteria zonder
  doel, kalibratie vanaf 15 procentpunt), `collectControle()` (filters
  klas, map, periode; een evaluatie valt in een periode als minstens één
  beoordeling voor die klas erin valt). "Nu beoordelen" gebruikt
  `openEvaluationFor()` in `js/evaluations.js`.
  **Vrijstellingen:** `db.schoolYears[schooljaar].exemptions[
  "leerjaar||evaluatie||klas||leerling"] = {reason, by, updatedAt}`;
  ongedaan maken via `db.tombstones.exemptions["schooljaar||…"]` en
  `isTombstoned()` (nieuwe soort in `TOMBSTONE_KINDS`). Samenvoegen in
  `mergeExemptions()` (nieuwste wint). Verhuist mee via
  `migrateExemptions()`, aangeroepen door `migrateStudentEvaluations(year,
  student, toKlas, fromKlas)`. `DB_VERSION` bleef 4. Skore toont een
  vrijgestelde leerling als "vrijgesteld" (`getExemption()` in
  `buildSkoreTable()` en `buildSkoreEvalList()`).
  **Groeigrafiek** staat niet meer op het scherm, de functies in
  `js/goals.js` bleven (zie CHANGELOG 1.22.0). De drempelinstelling voor
  leerplandoelen is weg; de standaarddrempels gelden nog voor het
  afgedrukte overzicht.

- **Tabblad Skore** (1.21.0, `js/skore.js`): per leerjaar, klas en
  rapportperiode de punten om over te typen in Skore (Smartschool; punten
  plakken kan daar niet, dus geen kopieerknop voor punten; sinds 1.23.0
  wel een kopieerknop voor de feedbacktekst, zie hierboven).
  Periodes per schooljaar in `db.schoolYears[label].periods`
  (`{list: [{name, start}], end, updatedAt}`, een periode loopt tot de dag
  vóór de volgende start; zonder eigen periodes geldt `defaultPeriods()`,
  de indeling van 2026-2027). "Overgezet"-vinkjes in
  `db.schoolYears[label].skoreDone`. Beide worden bewaard in
  `normaliseDb()` en samengevoegd in `mergeDb()` via `mergePeriods()` en
  `mergeSkoreDone()`. Rijen hebben nu `createdAt` (datum van de
  beoordeling, blijft bij bewerken), oudere rijen vallen terug op
  `updatedAt`. Tussentijdse checks (`row.formative`) tellen niet mee.

- **Opgeruimd en automatisch getest** (1.20.0): demo-omgeving
  (`build-demo.js`, `IS_DEMO`, `DEMO_SEED`, `#demoBanner`) en
  NAS-netwerksynchronisatie (`NETWORK_SYNC`, `netSync*`, `#netSyncStatus`,
  `#wizardNetSyncGroup`) verwijderd. Nieuwe testreeks in `tests/` met
  GitHub Actions, zie "Testinfrastructuur".
- **Code opgesplitst** (1.19.1): `js/evaluations.js` is nu vier bestanden,
  in deze laadvolgorde: `rubric-model.js`, `evaluations.js`,
  `rubric-editor.js`, `ai-rubric.js` (en sinds 1.27.0 `ai-source.js`
direct daarna). `build.js` schrijft naar `dist/`
  (of het eerste argument / `STEM_OUT_DIR`). De testreeks verwacht
  `/mnt/user-data/outputs/STEM-Evaluatietool.html`: bouw dan met
  `node build.js /mnt/user-data/outputs`.

- **Slimmer zoeken in de evaluatielijsten** (1.19.0): in
  `makeSearchCombo()` (`js/ui.js`) zonder accenten/hoofdletters via
  `searchKey()`, ook op mapnaam, Enter kiest bij één resultaat, huidige
  keuze krijgt `.current`, ARIA-combobox. Paneelstructuur:
  `.eval-combo-section` > `.eval-combo-group` + `.eval-combo-items` >
  `.eval-combo-option`.

- **Veiliger opslaan** (1.18.1): onleesbare browseropslag wordt bewaard
  onder `STEM_EVAL_DB_V3_BESCHADIGD` (`STORAGE_RESCUE_KEY`) in plaats van
  stil gewist, met een rode balk in `updateSafetyBar()`. `writeHandle()`
  schrijft nooit twee keer tegelijk en zet de status enkel op opgeslagen
  als `changeCount` (verhoogd in `markDirty()`) intussen niet veranderde.
  Een mislukte opslag zet `saveError`: rode status en blijvende balk tot
  een volgende opslag lukt. `writeHandle()` geeft nu altijd een Promise
  terug.

- **Resultaten: evaluatie zoeken, gegroepeerd per map** (1.18.0): het
  veld "Evaluatie" op het Resultaten-scherm gebruikt dezelfde
  zoek-vervolgkeuzelijst als het evaluatiemoment bij Evalueren. De
  combo-logica zit nu één keer in `makeSearchCombo(cfg)` in `js/ui.js`
  (moet daar staan: `results.js` en `evaluations.js` maken er bij het
  laden al een instantie mee). Mapindeling komt uit
  `evaluationGroups(year)` in `js/evaluations.js`. `openEvalCombo()`,
  `closeEvalCombo()` en `syncEvalComboDisplay()` bestaan nog als dunne
  omhulsels. De echte `<select id="resEval">` blijft werken maar is
  onzichtbaar (`.eval-select-hidden`), dus `goals.js`/`reports.js` lezen
  gewoon verder `$("resEval").value`. Mapkoppen zijn in beide lijsten
  donkerder en vetgedrukt, met een scheidingslijn tussen mappen.

- **Klaslijsten-scherm: klas aanklikken toont wie erin zit, "Leerling
  van klas veranderen" is klapbaar onderaan** (1.17.0): elke klas-chip
  bij "Wat er nu in de tool zit" is klikbaar (`expandedRosterKlas` in
  `js/rosters.js`) en toont/verbergt de leerlingenlijst van die klas.
  Bewust een eigen `.roster-klas-chip`-stijl in plaats van de bestaande
  `.chip-removable` (die kleurt rood bij hover — verwarrend voor een
  klik die niets verwijdert). "Leerling van klas veranderen" is een
  `<details>` geworden, ingeklapt, onderaan het scherm — zelfde patroon
  als "Of plakken vanuit Excel".

- **Opgeslagen evaluaties verhuizen mee bij het veranderen van klas**
  (1.16.0): vervolg op de klasverandering hieronder.
  `migrateStudentEvaluations()` in `js/rosters.js` loopt over alle
  sessies van dat leerjaar (elk evaluatiemoment). Een individuele
  beoordeling (rij met enkel deze leerling) verhuist volledig naar de
  sessie van de nieuwe klas. Een groepsrij (samen met klasgenoten) kan
  niet zomaar fysiek verhuizen — de score is gedeeld met leerlingen die
  niet meeverhuizen — dus die blijft bewerkbaar bij de oorspronkelijke
  sessie, maar `row.studentKlas` van deze leerling wordt wel bijgewerkt
  zodat resultaten, export en groeigrafiek haar of hem voortaan bij de
  nieuwe klas tellen. Rijen van vóór 1.14.0 zonder `row.studentKlas`
  krijgen dat veld alsnog voor iedereen in de rij, vóór de klas van de
  verplaatste leerling verandert.

- **Leerling van klas veranderen zonder de klaslijst opnieuw in te lezen**
  (1.15.0): nieuw onderdeel op het Klaslijsten-scherm (`moveStudentToClass()`
  en de `fillMove*Options()`-functies in `js/rosters.js`) voor de eerste
  weken van het schooljaar, wanneer klasgroepen nog kunnen wijzigen.
  Verplaatst enkel de gekozen naam tussen `db.roster[year][klas].students`
  van de twee betrokken klassen, in plaats van de hele klaslijst opnieuw
  te moeten plakken/inlezen (wat de rest van de klas ook zou
  overschrijven). Bumpt `updatedAt` van beide klassen zodat het gewoon
  meegaat bij de volgende synchronisatie. Roept sinds 1.16.0
  `migrateStudentEvaluations()` aan zodat opgeslagen evaluaties mee
  verhuizen in plaats van bij de oude klas te blijven staan — zie
  hierboven.

- **Meerdere klassen tegelijk selecteren op het Evalueren-scherm**
  (1.14.0): klasveld is een zelfgetekende keuzelijst met aanvinkvakjes
  geworden (`klasMultiInput`/`klasMultiPanel` in `js/evaluations.js`,
  zelfde patroon als de evaluatiemoment-combo hieronder), zodat een
  gemengde groep met leerlingen uit meerdere klasgroepen in één keer
  beoordeeld kan worden. De gekozen klassen vormen samen een sessiesleutel
  (`cur.klas` = klassen gesorteerd en met "+" verbonden, `cur.klassen` is
  de array van echte klasnamen). **Belangrijke architecturale beslissing:**
  elke opgeslagen rij houdt nu ook de échte klas per leerling bij
  (`row.studentKlas`), niet enkel de sessie als geheel — dat is wat
  `collectResults()` in `js/results.js` toelaat om per leerling de juiste
  klas te tonen, ook al zat die leerling in een combinatiesessie. Oudere
  rijen zonder dat veld vallen terug op de klas van de sessie zelf, wat
  altijd exact klopt omdat die vroeger altijd precies één echte klas was.
  `evaluatedMap()` in `js/evaluations.js` kijkt sindsdien ook
  klas-overkoepelend (over alle sessies van hetzelfde leerjaar en
  evaluatiemoment) in plaats van enkel de huidige sessie, zodat eenzelfde
  leerling niet twee keer beoordeeld kan worden wanneer die soms solo en
  soms in een combinatie zit — met een check op de per-leerling klas zodat
  gelijknamige leerlingen uit andere klassen elkaar niet in de weg zitten.
  `teamForKlassen()` (`js/sync.js`) neemt de unie van de teamleden van de
  gekozen klassen voor de "niet ingeschreven voor deze klas"-waarschuwing.

- **Jaaroverzicht afdrukken** (1.13.0): knop op het Rubrics-scherm,
  `printYearOverview(year)` in `js/reports.js`. Eén PDF: kerncijfers,
  evaluaties gegroepeerd per map (net als op het scherm), en de volledige
  dekkingstabel. Die laatste tabel is geëxtraheerd uit `printGoalOverview()`
  naar een gedeelde `buildGoalCoverageTable(year, usage, attainment)` —
  beide afdrukfuncties hergebruiken hem nu, in plaats van gedupliceerde
  tabelopbouw. Voor een leerjaar zonder leerplandoelen (1ste jaar) valt de
  dekkingssectie netjes weg met uitleg, geen kapotte tabel.
  **Testmethodiek-valkuil, hier gevonden:** de printstijlen zitten in een
  `@media print`-blok — een gewone Playwright-schermopname toont dan de
  normale pagina, niet de printopmaak. Gebruik `page.emulateMedia({media:
  "print"})` vóór het screenshotten van iets dat via `window.print()` werkt.
- **Evaluatiemoment: zelfgetekende zoek-vervolgkeuzelijst** (1.12.0,
  vervangen in 1.12.1): eerste versie (1.12.0) verborg/toonde gewoon
  `<option>`-elementen in de echte `<select>` via een zoekveld ERBOVEN.
  Terechte gebruikersfeedback met screenshots: zag er los uit, en een
  browser kiest zelf of de popup naar boven of onder opent — daar is met
  een native `<select>` geen enkele CSS/JS-hendel voor. Vervangen door een
  echte, zelf getekende combobox (`initEvalCombo()` en de andere
  `evalCombo*`-functies in `js/evaluations.js`): het zoekveld ís nu het
  zichtbare veld, het resultatenpaneel (`#evalComboPanel`) is absoluut
  gepositioneerd en opent dus **altijd** naar beneden, zelf getekend dus
  zelf onder controle. **Belangrijk architecturaal patroon:** de echte
  `<select id="evalSelect">` blijft volledig intact en functioneel
  (waarde, "change"-event) maar is onzichtbaar gemaakt via
  `opacity:0; pointer-events:none` (NIET `display:none` — dat laatste zou
  Playwrights actionability-check laten falen). Empirisch bevestigd dat
  `page.selectOption()` op een `opacity:0`-select gewoon blijft werken —
  daardoor bleven alle 19 bestaande testbestanden ongewijzigd werken,
  enkel `test-search-e2e.js` zelf (dat rechtstreeks de oude
  `#evalSelectFilter`/`.hidden`-mechaniek testte) moest herschreven worden
  naar de nieuwe `.eval-combo-option`/`.eval-combo-panel`-structuur. **Les
  voor een volgende UI-herwerking van een bestaand veld:** eerst
  empirisch testen of Playwright nog met het element kan interageren
  vóór je aanneemt dat bestaande tests zullen breken of net niet.
- **Zoeken op het Rubrics-scherm** (1.12.0, ongewijzigd): een zoekveld
  filtert `renderEvalList()` op naam (mappen zonder match verdwijnen
  tijdens het zoeken). Dit blijft de eenvoudigere aanpak — het is een
  altijd-zichtbare, gefilterde lijst, geen popup, dus geen "opent naar
  boven/onder"-probleem om op te lossen. Het zoekwoord wist enkel bij een
  echte jaarwissel, niet bij een achtergrondherbouw van de lijst
  (`fillClassAndEvalOptions()`, die ook via `refreshAll()` na
  synchroniseren draait) — die herbouwt de lijst en past het bestaande
  filter gewoon opnieuw toe.
- **Cijfertoetsen en automatisch doorschuiven** (1.11.0): toetsen 1-9
  scoren het criterium waar de focus op staat en springen automatisch
  naar het volgende (`initScoringShortcuts()` in `js/evaluations.js`).
  Na opslaan van één leerling (niet bij groepswerk) schuift de tool door
  naar de eerstvolgende onbeoordeelde leerling (`advanceToNextStudent()`).
  **Belangrijke valkuil, al één keer misgegaan:** checkboxes zijn ook
  `<input>`-elementen — een simpele `tagName === "INPUT"`-check om
  tekstvelden te beschermen blokkeert dan óók de sneltoetsen na het
  aanvinken van een leerling. Gebruik `isTextEntryField()`, die specifiek
  op het `type`-attribuut checkt, niet enkel de tag.
- **Verwijderen voor iedereen / voor mezelf** (1.10.0): tombstone-
  mechanisme (`db.tombstones` gedeeld, `db.localTombstones` nooit
  gesynchroniseerd — bewust uitgesloten uit `dbBlob()`/`netSyncPush()`)
  voor klassen, evaluaties/rubrics en mappen. Elke verwijderactie toont
  een keuzevenster (`askDeleteScope()` in `js/app.js`, vervangt de
  standaard `confirm()`) in plaats van drie losse implementaties.
  `isTombstoned(kind, key, itemUpdatedAt)` in `js/state.js` is de enige
  juiste manier om te checken — **nooit** `tombstoneTime()` rechtstreeks
  vergelijken, want 0 betekent "geen tombstone", niet "tombstone op
  tijdstip 0" (zie het randgeval hieronder). Tombstones worden centraal
  en éénmalig samengevoegd in `mergeDb()`, vóór alle andere merges,
  anders zou `mergeRoster()` (die per schooljaar in een lus draait) een
  deel van de binnenkomende tombstone-informatie mislopen.
- **Eén klas verwijderen** (1.9.0): kruisje op de klas-chip bij "Wat er nu
  in de tool zit" (Klaslijsten-scherm), verschijnt bij hover — `:hover`
  bestaat niet op een touchscreen, dus via `@media (hover: none)` staat het
  kruisje daar gewoon altijd zichtbaar.
- **Mappen voor rubrics/evaluaties** (1.7.0, verplaatsbaar sinds 1.8.0):
  `db.evaluationFolders[jaar]` als geordende mapregistratie (de array-volgorde
  ís de weergavevolgorde, niet meer alfabetisch gesorteerd), elke evaluatie
  krijgt een `folder`-veld. Zichtbaar als gegroepeerde, in-/uitklapbare
  secties op het Rubrics-scherm met ↑/↓ om te herschikken, en als
  `<optgroup>` in de evaluatiemoment-kiezer bij Evalueren — in dezelfde
  volgorde. Map verwijderen laat evaluaties nooit verloren gaan (komen terug
  bij "Geen map"); bewerken en dupliceren behouden de mapindeling;
  samenvoegen volgt hetzelfde "nooit verwijderen, enkel toevoegen"-patroon
  als team/klaslijsten.
- Rubric-editor met Bloom-niveaus, rubricversies (bewaart oude tekst bij
  bewerken na gebruik)
- Leerplandoelen 2de jaar (46 unieke doelen TW+MW samengevoegd), koppeling
  per criterium
- **AI-hulp bij rubrics opstellen** (1.5.0, uitgebreid in 1.6.0, herwerkt
  in 1.24.0, zie bovenaan): beschrijving
  → gegenereerde prompt → kopiëren naar eigen AI-gesprek (Claude/ChatGPT/…) →
  antwoord plakken → automatisch omgezet naar criteria, inclusief
  leerplandoelen-koppeling die de AI zelf meebepaalt. Bewust **geen**
  rechtstreekse API-aanroep vanuit de tool — dat zou een sleutel vereisen die
  in het gedeelde bestand zou staan, door iedereen uit te lezen. Zie
  "Bewust afgewezen aanpakken" hieronder voor de volledige afweging.
- **Groepsbeoordeling met individuele correctie** (1.4.0): groepsscore per
  criterium blijft gedeeld voor klasgemiddelden/werkpunten/kalibratie; een
  optionele +/- correctie per leerling werkt enkel door op diens eigen
  eindscore. Geclemd tussen 0 en het maximum.
- **Schooljaren** (1.3.0): `db.schoolYears[label] = {roster, sessions}`,
  `activeSchoolYear` (waar nieuw werk naartoe gaat) apart van
  `currentSchoolYear` (wat je bekijkt). Oude jaren volledig bekijkbaar,
  alleen-lezen afgedwongen zowel in de UI als met een harde controle in de
  functies zelf. Rubrics/team/instellingen zijn NIET per schooljaar — die
  blijven behouden bij een nieuw jaar.
- Resultatenscherm: kerncijfers, "Per leerling"-tabel, "Grafieken per
  criterium en spreiding" (ingeklapt, onderaan), Dekking/Groei/Leerplandoelen
  als losse inklapbare secties
- Team: gedeelde map (File System Access API), in de praktijk een map in
  OneDrive. De NAS-netwerksynchronisatie is in 1.20.0 verwijderd: de school
  gebruikt enkel OneDrive (staat nog in de git-historie, tot en met 1.19.1)
- Opstartwizard, leest bestaande bestanden correct in
- Printbare rapporten en feed-up-blad, met automatische PDF-bestandsnaam
  (`klas_evaluatie` of `leerling_klas_evaluatie`) via een tijdelijke
  `document.title`-wissel

## Databeveiliging — het belangrijkste bewezen patroon

`mergeDb`/`mergeTeam`/`mergeRoster` volgen allemaal dezelfde regel: **nooit
verwijderen bij het samenvoegen, enkel toevoegen of bijwerken op basis van een
tijdstempel.** Dit patroon bestond al voor klaslijsten en rubrics, maar
`mergeTeam` volgde het aanvankelijk niet — een collega die de tool voor het
eerst opende (leeg team-object, gloednieuwe tijdstempel) kon daardoor het
volledige team van iedereen wegvegen. Gevonden via een echte, opgezette proef
(niet enkel geredeneerd), gerepareerd, en een permanente regressietest
toegevoegd. **Bij elke toekomstige wijziging aan samenvoeglogica: dit patroon
expliciet controleren met een echte proef, niet aannemen dat het klopt.**

**Tweede, vergelijkbaar geval (1.10.0, tombstones):** dezelfde les, andere
vorm. De opruimstap die eigen verouderde items verwijdert na een binnen-
komende tombstone gebruikte aanvankelijk een rauwe `updatedAt <= tombstoneTime`
vergelijking. Omdat "geen tombstone" intern ook als `0` voorgesteld wordt,
en een nooit-aangepast standaarditem (bv. een ongewijzigde klas bij een
verse installatie) ook `updatedAt: 0` heeft, verwijderde dit onterecht
items zonder dat er ooit een échte tombstone bestond. Gevonden via exact
dezelfde aanpak: een geschreven, uitgevoerde twee-personen-simulatie
(Bert + Marie, elk hun eigen browsercontext), niet door de code te lezen en
te vertrouwen dat de logica klopte. Gerepareerd met `isTombstoned(kind, key,
itemUpdatedAt)` in `js/state.js`, die expliciet `tombstoneTime > 0` vereist
vóór de vergelijking. **Gebruik die functie overal, nooit `tombstoneTime()`
rechtstreeks vergelijken met `<=`.**

## Testinfrastructuur

De oorspronkelijke testreeks (22 bestanden, ruim 1000 tests) is niet meer
beschikbaar. Sinds 1.20.0 is er een nieuwe reeks in de repository zelf,
`tests/`, die bij elke push automatisch draait op GitHub:

- `opstarten.spec.js`: build, alle scriptbestanden bestaan, opstarten
  zonder fouten (gebouwd én losse `index.html`), opstartwizard, alle tabbladen,
  de tab Instellingen met zijn onderdelen, nieuw schooljaar via Algemeen
- `evalueren.spec.js`: een leerling beoordelen, opslaan en terugzien bij
  Controle; melding bij ontbrekende criteria
- `zoeklijst.spec.js`: de zoeklijst bij Evalueren (mappen, accenten,
  mapnaam, Enter, ARIA)
- `opslaan.spec.js`: beschadigde browseropslag, gelijktijdig schrijven,
  mislukte opslag
- `samenvoegen.spec.js`: de "nooit verwijderen bij samenvoegen"-regel
  (team, tombstones, rijen)
- `controle.spec.js`: dekkingstelling met combinatiesessies en
  klasverandering, elk controlepunt, "+ X meer", opmerkingen per
  evaluatie, "Nu beoordelen", "Alles in orde", periodefilter,
  leerplandoelen, vrijstelling (reden, ongedaan maken, later toch
  beoordeeld, meeverhuizen, twee-personen-synchronisatie)
- `skore.spec.js`: periodes, overzicht per klas en periode, omrekenen,
  overgezet-vinkjes, periodes aanpassen, `createdAt`, samenvoegen
- `feedback.spec.js`: de feedbacktekst (de drie voorbeelden uit het plan
  letterlijk, gelijke stand, geen valse lof, eigen tekst letterlijk en
  onverkort, lengtegrens, rubricversie, niet gescoord, groepswerk, geen
  punten/labels/gedachtestreep), welke beoordeling telt, punt met de
  juiste rubricversie, en de knop (enkel bij punten, klembord uitlezen,
  melding, vinkje per sessie, terugvaloptie, mislukt kopiëren,
  gearchiveerd jaar). Getoetst door tijdelijk fouten in te bouwen
  (huidige rubric, gelijke stand, drempel): de tests faalden zoals
  verwacht.
- `reservekopie.spec.js`: naam met datum en uur, opruimregels, kopie bij
  verbinden, hoogstens één per uur, geen dubbele kopie, enkel eigen
  kopieën opruimen, niet ingelezen bij Team bijwerken, terugzetten via het
  Teamscherm (en annuleren), teruggezette versie wint van een collega die
  de fout al had, datum van de beoordeling blijft, "Nu een reservekopie
  maken"
- `ai-rubric.spec.js`: prompt (enkel beantwoorde vragen, labels en
  doelniveau, Bloom, geen gedachtestreep in alle varianten, nakijkprompt),
  inlezen (nieuw en oud formaat, labels uit de tool, volgende stappen,
  ook passend, zonder doel), nakijken (`buildAiReview()`), elke
  waarschuwing en geen valse meldingen bij de bestaande rubrics, volgorde
  van de volgende stap in de feedback, de volledige flow op het scherm,
  nakijken met bevestigen en een nieuwe versie, velden na opslaan,
  heropenen en synchronisatie tussen twee personen, `rubricsDiffer()`.
  Getoetst met ingebouwde fouten (opslaan vergeet de volgende stap,
  labels van de AI, `next` telt mee voor versies): telkens rood.
- `vakken.spec.js` (1.28.0): vakken toevoegen, dubbel weigeren, klassen
  aanduiden, verwijderen met tombstone, Evalueren zonder en met vak
  (klassen en evaluaties gefilterd, melding bij een leeg vak, beoordeling
  sluit, keuze onthouden), Nu beoordelen met een ander vak, Rubrics
  (filter, vak per rij, nieuwe evaluatie, dupliceren, leerjaar zonder
  vakken), opslaan, openen en samenvoegen.
- `omzetten.spec.js` (1.27.0): Excel-tekst met samengevoegde cellen,
  bestanden kiezen (Excel, Word, PowerPoint, PDF met uitleg, tweede keer
  voegt toe), lange tekst, de omzetprompt (regels, materiaal, geen
  gedachtestreep, het json-voorbeeld is geldige json in alle standen),
  `nietOvergenomen` inlezen, en de volledige flow op het scherm tot
  opslaan. Getoetst met ingebouwde fouten (samengevoegde cellen negeren,
  streepjes niet vervangen): telkens rood.

Elke test controleert ook dat er geen JavaScript-fouten waren
(`page.expectNoErrors()` uit `tests/helpers.js`). Filosofie blijft:
**niet aannemen dat iets werkt, altijd empirisch verifiëren**. De reeks is
gecontroleerd door de fout van vóór 1.18.1 tijdelijk terug te zetten: de
testen voor beschadigde opslag faalden toen zoals verwacht.

**Nog niet gedekt** (vroeger wel, bij uitbreiden eerst hieraan denken):
klaslijsten en Excel-import, rubric-editor (behalve doelniveau en
volgende stap), team en gedeelde map,
de inhoud van afgedrukte rapporten, schooljaren, groepscorrectie,
verwijderen voor iedereen/mezelf, cijfertoetsen, jaaroverzicht afdrukken.
De groeigrafiek staat sinds 1.22.0 niet meer op het scherm en heeft dus ook
geen test.

## Bekende openstaande schuld

0. **Nieuwe les (1.12.0), al opgelost maar het patroon is de moeite waard te
   onthouden:** bij het opstarten van deze sessie (na het uitpakken van de
   geüploade zip en het draaien van de standaardregressie, zoals dit
   document zelf voorschrijft) bleek `test-folders-e2e.js` te falen — niet
   door de nieuwe zoekfunctie, maar omdat het bestand nog uit de periode
   vóór 1.10.0 (verwijderen voor iedereen/mezelf) dateerde. Het klikte op
   "Map verwijderen" zonder het sindsdien verschijnende keuzevenster af te
   handelen (bleef openstaan, blokkeerde een latere test), en gebruikte nog
   de verouderde platte-string vorm voor mappen in plaats van
   `{name, updatedAt}`. **Les: als een UI-stroom een extra
   bevestigingsstap krijgt (zoals `askDeleteScope()`), grep dan expliciet
   naar alle testbestanden die de oude, kortere stroom aanroepen — niet
   enkel de testbestanden die in dezelfde sessie als die wijziging
   geschreven zijn.** Beide gerepareerd; zie de git-historie/diff van
   `test-folders-e2e.js` in het huidige testpakket voor het patroon.

1. **De testreeks dekt nog niet alles**, zie "Nog niet gedekt" hierboven.
2. (opgelost in 1.20.0: `build-demo.js`, de demo-code en de oude
   `test-core.js`/`test-roster.js` zijn weg.)
3. **Offline trefwoord-matching voor leerplandoelen is volledig verwijderd**
   (1.6.0) — werkte niet betrouwbaar genoeg door Nederlandse woordvormen.
   Vervangen door AI-gestuurde koppeling als deel van dezelfde prompt. Geen
   herstelwerk meer nodig hier, dit is bewust afgerond, niet halfweg.

## Bewust afgewezen aanpakken (belangrijk om niet opnieuw voor te stellen)

- **De voornaam van de leerling in de feedbacktekst** (voorgesteld voor
  1.25.0): de Smartschool-export heeft één naamkolom "Achternaam
  Voornaam", dus de voornaam is niet betrouwbaar te bepalen. De gebruiker
  koos voor een tekst zonder naam, persoonlijk door de je-vorm.

- **Rechtstreekse AI-API-aanroep vanuit de tool**: zou een sleutel vereisen
  in het gedeelde bestand → door iedereen uit te lezen en te misbruiken.
  Gebruiker koos expliciet voor de kopieer-plak-aanpak (geen sleutel, geen
  server). Twee andere opties werden voorgelegd en niet gekozen: elke
  collega een eigen sleutel (te veel drempel voor niet-technische
  collega's), of via een eigen server (niet meer van toepassing: de school
  werkt enkel met OneDrive) — de eerste blijft een optie als de gebruiker ooit terugkomt
  op deze keuze.
- **`type="module"` (`import`/`export`)** voor de losse broncode: empirisch
  bevestigd dat dit geblokkeerd wordt door browsers bij een `file://`-pagina
  (CORS-fout). Vandaar klassieke `<script src>`-tags.
- **Eén schooljaar-veld dat zowel "wat je bekijkt" als "waar nieuw werk
  naartoe gaat" bepaalt**: bewust gesplitst in `activeSchoolYear` en
  `currentSchoolYear` om te voorkomen dat je per ongeluk in een oud jaar gaat
  schrijven door het gewoon te bekijken.

## Wat de gebruiker expliciet gevraagd heeft, blijvend van toepassing

- Geen testomgeving meer aanmaken/bouwen (sinds het gesprek daarover)
- Versiebeheer bij elke wijziging, met onderscheid groot/klein
- Volledige regressie vóór elke oplevering, geen uitzonderingen (`npm test`)
- Enkel OneDrive voor het delen, geen NAS of eigen server
- `README.md` is de handleiding voor leerkrachten en wordt bij elke
  wijziging mee bijgewerkt (zie `CLAUDE.md`, een test bewaakt het
  versienummer erin)
- Geen gedachtestreep in Nederlandse teksten die de gebruiker leest (in
  1.23.0 opgeruimd in alle zichtbare teksten; lege cellen tonen "–")
- Eenvoud voor collega's staat boven ontwikkelaarsgemak — bij twijfel dat
  toetsen
- De AI-hulp biedt enkel 4 of 5 niveaus aan (sinds 1.25.0); bestaande
  rubrics met 3 niveaus blijven werken
- Rubrics en feedbackzinnen in leerlingentaal (je-vorm, korte zinnen,
  gewone woorden) voor leerlingen van 12 tot 14 jaar; de feedbacktekst
  noemt geen naam

## Suggesties voor een volgende sessie (niet gevraagd, enkel ter overweging)

- De testreeks uitbreiden met de onderdelen onder "Nog niet gedekt"
- Reservekopieën ook zonder gedeelde map (bv. een download-knop voor
  wie enkel een los werkbestand heeft)
- Laatst gebruikte evaluatie bovenaan in de zoeklijsten
- Resultaten per map exporteren naar Excel
- De groeigrafiek elders terugzetten (functies staan nog in js/goals.js)
