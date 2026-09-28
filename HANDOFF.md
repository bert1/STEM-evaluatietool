# HANDOFF — STEM Evaluatietool

Laatst bijgewerkt: 28 september 2026, versie **1.19.0**.

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

## Waar alles staat (in déze sessie — zie hieronder voor een nieuwe sessie)

- **Broncode, dé bron van waarheid:** `/home/claude/stem-evaluatietool/`
- **Gebouwde bestanden voor de gebruiker:** `/mnt/user-data/outputs/`
  (`STEM-Evaluatietool.html` = vaste naam voor tests, `STEM-Evaluatietool-v1.6.0.html`
  = wat de leerkracht effectief krijgt)
- **Testbestanden (16 stuks, horen NIET in de product-zip):** `/home/claude/build/test-*.js`
- **Oude, voorbijgestreefde platte bronmap (technische schuld, zie onderaan):**
  `/home/claude/build/*.js` (zonder `test-` voorvoegsel)

### In een NIEUWE sessie bestaat niets hiervan nog

De sandbox is dan leeg. Eerste stappen:
1. Pak `stem-evaluatietool-broncode.zip` uit naar `/home/claude/stem-evaluatietool/`
2. Pak `stem-evaluatietool-tests.zip` uit, kopieer de `test-*.js`-bestanden naar
   `/home/claude/build/` (zie `LEESMIJ-TESTS.md` erin voor het volledige stappenplan)
3. `cd /home/claude/stem-evaluatietool && node build.js` — dit schrijft naar
   `/mnt/user-data/outputs/`
4. Test pas daarna

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

**Modules** (`js/`): `ui.js` ($/el-hulpfuncties, moet als eerste laden),
`state.js` (db-model, opslaan/laden, mergeDb, schooljaren), `storage.js`
(bestand openen/opslaan, File System Access API), `rosters.js` (klaslijsten,
Excel-import), `evaluations.js` (rubric-editor, scores, AI-rubriekhulp),
`results.js` (statistieken, grafieken, kalibratie), `reports.js` (rapport,
feed-up-blad), `goals.js` (leerplandoelen-UI, groeigrafiek), `sync.js`
(gedeelde map, team, netwerksynchronisatie), `app.js` (opstart, wizard,
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

## Volledige featurelijst (huidige stand, 1.19.0)

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
- **AI-hulp bij rubrics opstellen** (1.5.0, uitgebreid in 1.6.0): beschrijving
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
- Team: gedeelde map (File System Access API) of optionele
  netwerksynchronisatie op het schoolnetwerk (zie `js/sync.js`,
  `NETWORK_SYNC`-configuratie, `sync-server/`)
- Opstartwizard, leest bestaande bestanden correct in, slaat mapkeuze over
  als netwerksynchronisatie al actief is
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

22 Playwright-bestanden, ruim 1000 tests, volledige regressie voor élke
release. Filosofie doorheen het hele project: **niet aannemen dat iets werkt,
altijd empirisch verifiëren** — inclusief tegen zichzelf (bv. de
JSON-extractie-tool voor de architectuur-opsplitsing controleerde zichzelf op
byte-exacte heropbouw).

Standaardregressie (20 bestanden, zie ook `LEESMIJ-TESTS.md` in het testpakket):
```
test-e2e test-roster-e2e test-xlsx-e2e test-editor-e2e test-nav-e2e
test-team-e2e test-results-e2e test-safety-e2e test-inspect-e2e
test-goals-e2e test-phase2-e2e test-wizard-e2e test-schoolyear-e2e
test-correction-e2e test-ai-rubric-e2e test-folders-e2e
test-deletion-scope-e2e test-shortcuts-e2e test-search-e2e
test-yearoverview-e2e
```
Apart: `test-netsync-e2e.js` (heeft een draaiende server nodig, zie
`LEESMIJ-TESTS.md`).

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

1. **`test-core.js` en `test-roster.js` testen verouderde code.** Deze twee
   Node-only testbestanden (uit de periode vóór de architectuur-opsplitsing)
   lezen rechtstreeks de oude platte bestanden (`build/core.js`,
   `build/goals.js`) via `require()`, niet de huidige modulaire bron in
   `stem-evaluatietool/js/`. Ze testen dus code die niet meer verzonden wordt.
   Bewust niet meegenomen in het testpakket om verwarring te vermijden. Twee
   opties voor een volgende sessie: (a) herschrijven tegen de nieuwe bron —
   vereist `module.exports`-blokken toevoegen aan de nieuwe bestanden (veilig,
   want no-op in de browser, `typeof module === "undefined"` daar), of (b)
   gewoon laten vervallen, want hun logica wordt al onrechtstreeks gedekt door
   de editor/results-e2e-tests.
2. **`build-demo.js` staat nog in de broncode**, onaangeroerd sinds de
   gebruiker vroeg om de testomgeving niet meer te maken. Niet verwijderd
   (voor het geval het later terug nodig is), maar ook niet onderhouden —
   bouwt mogelijk niet meer foutloos na latere wijzigingen.
3. **Offline trefwoord-matching voor leerplandoelen is volledig verwijderd**
   (1.6.0) — werkte niet betrouwbaar genoeg door Nederlandse woordvormen.
   Vervangen door AI-gestuurde koppeling als deel van dezelfde prompt. Geen
   herstelwerk meer nodig hier, dit is bewust afgerond, niet halfweg.

## Bewust afgewezen aanpakken (belangrijk om niet opnieuw voor te stellen)

- **Rechtstreekse AI-API-aanroep vanuit de tool**: zou een sleutel vereisen
  in het gedeelde bestand → door iedereen uit te lezen en te misbruiken.
  Gebruiker koos expliciet voor de kopieer-plak-aanpak (geen sleutel, geen
  server). Twee andere opties werden voorgelegd en niet gekozen: elke
  collega een eigen sleutel (te veel drempel voor niet-technische
  collega's), of via het NAS-servertje (haalbaar, maar infrastructuur-
  afhankelijk) — deze twee blijven een optie als de gebruiker ooit terugkomt
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
- Volledige regressie vóór elke oplevering, geen uitzonderingen
- Eenvoud voor collega's staat boven ontwikkelaarsgemak — bij twijfel dat
  toetsen

## Suggesties voor een volgende sessie (niet gevraagd, enkel ter overweging)

- De technische schuld rond `test-core.js`/`test-roster.js` opruimen
- Overwegen of `build-demo.js` definitief verwijderd moet worden
- De NAS-netwerksynchronisatie is gebouwd en getest, maar niet standaard
  actief — bij interesse: `sync-server/` bevat de volledige serverimplementatie
