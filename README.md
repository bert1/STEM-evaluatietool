# STEM-evaluatietool

Een evaluatietool voor de STEM-lessen. Je beoordeelt leerlingen met rubrics,
controleert wat er nog ontbreekt en ziet per rapportperiode welke punten je
nog in Skore moet zetten. De tool werkt volledig offline: je gegevens blijven
op je eigen computer en in je eigen OneDrive.

> **Huidige versie: 1.26.0.** Het versienummer staat ook rechtsboven in de
> tool. Wat er per versie veranderd is, lees je in
> [`stem-evaluatietool/CHANGELOG.md`](stem-evaluatietool/CHANGELOG.md).

---

## Inhoud

1. [Snel aan de slag](#1-snel-aan-de-slag)
2. [Je werk bewaren](#2-je-werk-bewaren)
3. [Evalueren](#3-evalueren)
4. [Klaslijsten](#4-klaslijsten)
5. [Rubrics](#5-rubrics)
6. [Controle](#6-controle)
7. [Skore](#7-skore)
8. [Team en OneDrive](#8-team-en-onedrive)
9. [Een nieuw schooljaar](#9-een-nieuw-schooljaar)
10. [Problemen oplossen](#10-problemen-oplossen)
11. [Voor ontwikkelaars](#11-voor-ontwikkelaars)

---

## 1. Snel aan de slag

**Wat heb je nodig?** Een computer met **Google Chrome** of **Microsoft
Edge**. Andere browsers werken ook, maar dan kan de tool niet automatisch
opslaan.

1. **Download het bestand** `STEM-Evaluatietool-v….html` (bovenaan in deze
   pagina, of krijg het van een collega) en zet het ergens waar je het
   terugvindt, bijvoorbeeld op je bureaublad.
2. **Dubbelklik** op het bestand. Het opent in je browser. Er is geen
   installatie nodig.
3. De eerste keer verschijnt een **welkomstscherm**:
   - vul je **initialen** in (bijvoorbeeld `JVDB`);
   - vul eventueel je volledige naam in;
   - kies de **gedeelde map** in OneDrive (zie [Team en OneDrive](#8-team-en-onedrive)),
     of klik op "Overslaan, ik doe dit later".
4. Klik op **Beginnen**.
5. Maak meteen een **werkbestand** aan: klik op "Werkbestand aanmaken…" en
   kies een plek in je OneDrive. Vanaf dan slaat de tool alles automatisch op.

Bovenaan zie je zes tabbladen:

| Tabblad | Waarvoor dient het? |
|---|---|
| **Evalueren** | Leerlingen beoordelen tijdens of na de les |
| **Klaslijsten** | Klassen inlezen uit Smartschool |
| **Rubrics** | Evaluaties en hun criteria maken en ordenen in mappen |
| **Controle** | Wat ontbreekt er nog of klopt er niet? |
| **Skore** | Welke punten je per periode (GE1 tot GE4) in Skore zet |
| **Team** | Wie geeft welke klas, en de gedeelde map in OneDrive |

---

## 2. Je werk bewaren

Rechtsboven zie je altijd of je werk veilig staat:

| Status | Betekenis |
|---|---|
| 🟢 **Opgeslagen in …** | Alles staat in je werkbestand. |
| 🟠 **Niet opgeslagen** | Er is een wijziging die nog weggeschreven wordt. Dat gebeurt binnen een seconde vanzelf. |
| 🟠 **Alleen in deze browser** | Je hebt nog geen werkbestand. Maak er een aan met "Werkbestand aanmaken…". |
| 🔴 **Niet opgeslagen!** | Opslaan is mislukt. Volg de rode balk: "Opnieuw proberen" of "Opslaan als…". |

**Knoppen op het Evalueren-scherm:**

- **Opslaan**: schrijft meteen naar je werkbestand (gebeurt ook automatisch).
- **Opslaan als…**: maakt een nieuw bestand, bijvoorbeeld bij een nieuw schooljaar.
- **Werk van collega toevoegen**: voegt het bestand van een collega bij het
  jouwe. Er gaat nooit iets verloren.
- **Ander bestand openen**: vervangt alles wat je nu hebt door een ander
  werkbestand.

> **Tip:** zet je werkbestand in OneDrive. Dan heb je altijd een reservekopie
> en kan je op een andere computer verder werken.

---

## 3. Evalueren

1. Kies bovenaan het **leerjaar**.
2. Kies de **klas**. Je mag meerdere klassen aanvinken als een groepje
   leerlingen uit verschillende klassen bevat.
3. Kies het **evaluatiemoment**. Typ een deel van de naam of van de map om te
   zoeken (hoofdletters en accenten maken niet uit). Blijft er één evaluatie
   over, dan kies je die met **Enter**.
4. Vink de **leerling** aan. Voor **groepswerk** vink je alle leerlingen van
   de groep aan: ze krijgen dezelfde score.
5. Klik per criterium op het juiste **niveau**.
6. Vul eventueel **feedback** (wat ging goed, wat kon beter) en
   **feedforward** (wat doet de leerling de volgende keer anders) in. Die
   tekst komt later mee in de feedback die je vanuit het tabblad Skore
   naar Smartschool kopieert.
7. Klik op **Opslaan**. De tool vinkt meteen de volgende leerling aan.

**Handig om te weten:**

- **Sneltoetsen:** de cijfertoetsen **1 tot 9** kiezen het niveau van het
  criterium waar je staat en springen door naar het volgende. Zo beoordeel je
  een hele klas zonder muis.
- **Individuele correctie bij groepswerk:** onder de groepsscore kan je per
  leerling een paar punten bij- of aftrekken. Dat telt enkel voor die
  leerling.
- **Tussentijdse check:** vink dit aan als het geen eindbeoordeling is. Dan
  hoeven niet alle criteria ingevuld te zijn, en telt het niet mee in de
  controle en in Skore.
- **Bewerken of verwijderen:** onderaan staat een tabel met alle
  beoordelingen van deze klas. Gebruik **Bewerk** of **Verwijder**.
- **Kopieer tabel** en **Exporteren naar Excel** zetten die tabel over naar
  Excel.
- De tool onthoudt de **datum** van elke beoordeling. Die bepaalt in welke
  periode ze in het tabblad Skore komt, ook als je ze later nog bewerkt.

---

## 4. Klaslijsten

Doe dit **aan het begin van het schooljaar**, of als er een klas bijkomt.

1. Download je klaslijsten uit **Smartschool** (één Excel-bestand per klas).
2. Klik op **Kies Smartschool-bestand(en)** en kies ze. Meerdere tegelijk mag.
3. Controleer het voorbeeld en klik op **Klaslijsten bijwerken**. Wil je
   alle klassen van dat leerjaar volledig vervangen, kies dan **Alle klassen
   van dit leerjaar vervangen**.

**Andere mogelijkheden:**

- **Of plakken vanuit Excel:** plak twee kolommen (klas en naam).
- **Wat er nu in de tool zit:** klik op een klas om te zien wie erin zit. Met
  het kruisje verwijder je een klas.
- **Leerling van klas veranderen** (onderaan): verplaatst één leerling naar
  een andere klas, samen met de beoordelingen die al gebeurd zijn.

---

## 5. Rubrics

Hier maak je de evaluaties die je bij Evalueren kan kiezen. De knoppen
**Nieuwe evaluatie**, **+ Nieuwe map** en **Jaaroverzicht afdrukken** staan
bovenaan, boven de lijst.

- **Nieuwe evaluatie:** geef een naam, voeg **criteria** toe en kies per
  criterium het aantal niveaus. Geef bij voorkeur alle criteria hetzelfde
  aantal niveaus, anders weegt het ene criterium zwaarder dan het andere.
  Voeg eventueel **open vragen** toe. Klik op **Evaluatie opslaan**.
- **Per niveau** vul je in:
  - **Wat je ziet:** wat je concreet ziet of leest in het werk.
  - **doel:** vink aan welk niveau betekent dat de leerling het doel
    behaalt. Standaard is dat **Voldoende**.
- **Schrijf voor de leerling.** Leerlingen lezen de rubric zelf, op het
  blad voor leerlingen en in de feedback. Schrijf dus in de je-vorm, met
  korte zinnen en gewone woorden. Bijvoorbeeld: "Je schrijft vooraf op wat
  je verwacht te zien en waarom."
- **Feedbackzinnen voor leerlingen** (optioneel): klik onder de niveaus op
  **Feedbackzinnen voor leerlingen** om ze open te klappen. Per niveau vul
  je in:
  - **Feedbackzin:** wat de leerling op dit niveau deed, bijvoorbeeld "Je
    deed drie proeven, maar je schreef niet op wat je verwachtte."
  - **Volgende stap:** wat de leerling moet doen om een niveau hoger te
    komen, bijvoorbeeld "Schrijf vooraf op wat je verwacht te meten."
  - **Uitdaging** (enkel bij het hoogste niveau): hoe een sterke leerling
    nog verder kan gaan.

  Zet er geen naam, geen punten en geen woorden als "Voldoende" in. Deze
  zinnen komen in de feedback die je vanuit Skore kopieert. Je kan ze ook
  later aanvullen, als er al mee beoordeeld is: ze gelden dan ook voor die
  beoordelingen, en er komt geen nieuwe versie van de rubric.
- **Nakijken:** onder de criteria verschijnen tips, bijvoorbeeld "Criterium
  3, niveau 2: bijna dezelfde tekst als niveau 3", "een zin is langer dan
  20 woorden" of "moeilijk woord voor leerlingen". Het zijn enkel tips: je
  kan altijd opslaan.
- Staat een rubric nog niet in de je-vorm, of ontbreken de feedbackzinnen,
  dan zie je één melding met de knop **Laat AI deze rubric nakijken**. De
  AI herschrijft de rubric dan in leerlingentaal en vult de zinnen aan.

### AI-hulp bij rubrics

Open **AI-hulp: rubric laten maken of nakijken** bovenaan de evaluatie.

**Nieuwe criteria laten maken:**

1. Kies het **aantal niveaus**: 4 of 5 (standaard 5). Je ziet meteen de
   namen en welk niveau "doel behaald" is.
2. **Beschrijf de opdracht.** Dat is het enige verplichte veld.
3. Beantwoord de **vragen** die je kan beantwoorden. Alles is optioneel;
   wat je openlaat, gaat niet mee. **Wat wil je evalueren?** helpt het meest.
4. Klik op **Prompt maken** en daarna op **Kopieer prompt**.
5. Plak de prompt in je eigen AI-gesprek (bijvoorbeeld Claude of ChatGPT).
6. Plak het antwoord terug en klik op **Criteria toevoegen aan deze
   evaluatie**.
7. Onder de knop zie je:
   - welke leerplandoelen bij elk criterium gekoppeld zijn;
   - **Ook passend:** doelen die bij de opdracht passen maar nog bij geen
     criterium staan. Kies een criterium en klik op **Koppelen**, of klik
     op **Negeren**;
   - **Zonder doel:** wat je wil evalueren maar bij geen enkel doel past;
   - tips om na te kijken.
8. Kijk alles na en klik op **Evaluatie opslaan**.

**Een bestaande rubric laten nakijken:**

1. Klik boven de criteria op **Laat AI deze rubric nakijken**.
2. Klik op **Prompt maken**, kopieer en plak in je AI-gesprek.
3. Plak het antwoord terug en klik op **Voorstel bekijken**.
4. Je ziet per criterium wat er zou veranderen ("Was" en "Wordt"). Vink uit
   wat je niet wil en klik op **Gekozen wijzigingen overnemen**.
5. Klik op **Evaluatie opslaan**. Werd de rubric al gebruikt, dan bewaart
   de tool de vorige tekst, zodat eerdere beoordelingen kloppen.

De AI schrijft de rubric in leerlingentaal, aangepast aan de leeftijd van
het leerjaar. De namen van de criteria zeggen wat de leerling maakte of
deed, bijvoorbeeld "Je voorspellingen vooraf" in plaats van "Voorspellen",
zodat een leerling weken later nog weet waarover het gaat. De AI maakt ook
meteen de feedbackzinnen, volgende stappen en
uitdagingen. Bij het nakijken herschrijft ze een bestaande rubric zo, en
vult ze ontbrekende zinnen aan. Ze verandert nooit het aantal criteria of
niveaus. Controleer het resultaat altijd zelf.

- **Mappen:** met **+ Nieuwe map** orden je evaluaties, bijvoorbeeld per
  thema of per maand. Met ↑ en ↓ zet je mappen in de juiste volgorde. Die
  volgorde zie je ook in de zoeklijsten.
- **Zoeken:** het zoekveld filtert de lijst op naam.
- **Bewerk / Dupliceer / Verwijder** bij elke evaluatie. Is een evaluatie al
  gebruikt, dan bewaart de tool de oude versie, zodat oude scores kloppen.
- **Voor leerlingen afdrukken:** een blad met de criteria, om vooraf aan de
  leerlingen te geven (feed-up).
- **Jaaroverzicht afdrukken:** alle evaluaties van het jaar in één PDF.

**Verwijderen voor iedereen of voor mezelf?** Bij het verwijderen van een
klas, evaluatie of map vraagt de tool wat je bedoelt:

- **Voor iedereen:** het verdwijnt ook bij je collega's.
- **Voor mezelf:** het verdwijnt enkel bij jou.

---

## 6. Controle

Dit tabblad beantwoordt één vraag: **wat moet ik nog doen?** Je ziet enkel
wat aandacht vraagt. Staat alles goed, dan staat er één groene zin, zoals
"Alles in orde voor 1WM in GE1."

**Filters bovenaan:** leerjaar, klas (standaard alle klassen), map en
periode (GE1 tot GE4, of het hele schooljaar).

**Openstaand** (het belangrijkste blok), per map. Elke regel is één
evaluatie voor één klas die al gestart is, met wat er nog mis is:

| Melding | Wat doe je? |
|---|---|
| Nog niet beoordeeld | Beoordeel deze leerlingen nog, of stel ze vrij (zie hieronder). |
| Onvolledig, niet elk criterium gescoord | Open de beoordeling en vul de ontbrekende criteria in. |
| Enkel een tussentijdse check | Maak nog een eindbeoordeling. |
| Dubbel beoordeeld | Verwijder een van de twee beoordelingen bij Evalueren. |
| Niet (meer) in de klaslijst | Controleer de klaslijst, of de leerling van klas veranderd is. |
| Vrijgesteld, maar toch beoordeeld | De beoordeling telt. Hef de vrijstelling op in de details. |

Grijze meldingen zijn enkel ter info, bijvoorbeeld een beoordeling met een
oudere versie van de rubric.

- Klik op **Nu beoordelen**: het Evalueren-scherm opent met dat leerjaar,
  die klas en die evaluatie al gekozen.
- Klik op **Details**: je ziet de klaslijst met per leerling een status
  (In orde, Onvolledig, Enkel tussentijds, Ontbreekt, Dubbel of Niet te
  beoordelen). Hier staan ook **Rapport** per leerling en **Rapporten
  afdrukken** voor de hele klas.
- Staan er meer dan vier namen, klik dan op **+ X meer** om ze allemaal te
  zien.

Sommige meldingen gaan over een hele evaluatie, niet over één klas:

- **Criteria zonder leerplandoel** (enkel in leerjaren met leerplandoelen).
  Met **Naar Rubrics** open je de evaluatie om ze te koppelen.
- **Verschil tussen beoordelaars:** geeft de ene collega gemiddeld veel
  hogere punten dan de andere (15 procentpunt of meer), bespreek dan samen
  hoe jullie scoren.

**Een leerling niet laten beoordelen.** Soms moet een leerling een
evaluatie niet krijgen, bijvoorbeeld bij langdurige ziekte.

1. Open de **Details** van de evaluatie.
2. Klik bij de leerling op **Niet te beoordelen**.
3. Bevestig, en geef eventueel een korte reden in.

De leerling telt dan als in orde, maar de tool toont altijd hoeveel
leerlingen vrijgesteld zijn (bijvoorbeeld "22/24 beoordeeld, 2
vrijgesteld"). Met **Ongedaan maken** zet je het terug. Je collega's zien
dezelfde vrijstelling, en verandert de leerling van klas, dan verhuist ze
mee.

**Onderaan, ingeklapt:**

- **In orde:** evaluaties die volledig in orde zijn. Via **Details** druk
  je hier de rapporten af.
- **Nog niet gestart:** evaluaties waarvoor een klas nog geen enkele
  beoordeling heeft. Klik op een klas om meteen te beginnen.
- **Leerplandoelen** (2de jaar): per doel of het niet gekoppeld is,
  gekoppeld maar nog niet beoordeeld, of beoordeeld (met de evaluaties
  erbij). Met **Overzicht afdrukken** maak je er een PDF van.

---

## 7. Skore

Hier zie je per **rapportperiode** welke punten je in **Skore** (Smartschool)
moet zetten.

1. Kies het **leerjaar** en de **klas**.
2. De **periode** van vandaag staat al open. Met **‹** en **›** ga je naar een
   vorige of volgende periode.
3. Kies bij **Punten op** of je de punten ziet zoals in de rubric, of
   omgerekend naar 10, 20 of 100 (zoals je evaluatie in Skore staat).

Je krijgt twee overzichten:

- **De evaluaties van die periode**, in de volgorde waarin ze gebeurden, met
  datum, hoeveel leerlingen beoordeeld zijn (oranje als het er nog niet
  allemaal zijn) en het maximum.
- **Een tabel met de punten**: de leerlingen staan alfabetisch en
  genummerd, net als in Skore. Een "–" betekent: niet beoordeeld in deze
  periode. "vrijgesteld" betekent dat de leerling deze evaluatie niet moet
  krijgen (ingesteld op het tabblad Controle); daar hoeft geen punt in
  Skore.

Typ de punten kolom per kolom over in Skore. Vink daarna **Overgezet naar
Skore** aan, dan weet je (en je collega's) wat al gebeurd is. Punten plakken
in Skore kan niet, feedback wel (zie hieronder).

### Feedback kopiëren voor Smartschool

In Skore kan je bij elk resultaat een feedbacktekst zetten. Die tekst maakt
de tool voor je, uit de rubric en je beoordeling.

1. Klik in de tabel op het **kopieericoon** naast het punt van een
   leerling.
2. Onderaan verschijnt "Feedback voor ... gekopieerd". Het icoon wordt een
   groen **vinkje**, zodat je ziet waar je gebleven bent.
3. Ga naar Smartschool, open de feedback bij het resultaat van die leerling
   en plak met **Ctrl+V**.

De tekst spreekt de leerling aan met "je". Er staat geen naam in. Zo ziet
hij eruit:

- Eerst de opdracht: "Dit is je feedback bij "Challenge windei"." Er staat
  geen lijst met criteria: elke regel zegt zelf waarover hij gaat, zodat
  de leerling de rubric niet opnieuw moet bekijken.
- **Dit ging goed:** het sterkste criterium, met de feedbackzin uit de
  rubric.
- **Hier kan je groeien:** het criterium dat het meest aandacht nodig
  heeft, met de feedbackzin uit de rubric. Daaronder een korte zin waarin
  je zegt dat je gelooft dat de leerling het kan leren, of dat je graag
  helpt, bijvoorbeeld "Fouten maken hoort bij leren. Ik help je graag
  verder." Daarna
  jouw eigen **feedback**, als je die invulde bij het beoordelen.
- **Zo pak je het de volgende keer aan:** jouw eigen **feedforward**.
  Vulde je die niet in, dan de **volgende stap** uit de rubric bij het
  werkpunt, als gewone zin: "Schrijf bij elke voorspelling het woord
  "omdat" en je reden erbij." Staat die er ook niet, dan wat de leerling moet doen om een
  niveau hoger te komen.
- Haalt een leerling overal het hoogste niveau, dan staat er **Een
  uitdaging voor de volgende keer:** met de uitdaging uit de rubric.

Goed om te weten:

- Er staan geen punten of woorden als "Onvoldoende" in de tekst: Smartschool
  toont het punt al.
- Je eigen feedback en feedforward komen er letterlijk in, nooit ingekort.
- Heeft de rubric nog geen feedbackzinnen, dan gebruikt de tool de
  omschrijving van het niveau. In de kolomkop staat dan een klein **i**.
  Laat de rubric nakijken door de AI, dan wordt de feedback persoonlijker.
- Bij groepswerk staat erbij dat het om een groepsopdracht gaat.
- De vinkjes onthoudt de tool enkel zolang ze open staat. Pas je een
  beoordeling aan, dan verdwijnt het vinkje van die leerling.
- Kopiëren werkt ook in een oud schooljaar.

**Goed om te weten:**

- Tussentijdse checks tellen niet mee.
- Bij groepswerk telt de individuele correctie mee.
- Pas je een rubric aan nadat je al beoordeeld had, dan telt voor elke
  leerling de rubric zoals hij was bij het beoordelen. Had die oude rubric
  een ander maximum, dan rekent de tool het punt om (houd de muis op het
  punt voor uitleg).
- **Periodes aanpassen:** open onderaan **Periodes van dit schooljaar**. Een
  periode loopt van haar startdatum tot de dag vóór de volgende periode.
  Klik op **Periodes opslaan**. Dit hoeft maar één keer per schooljaar, en
  je collega's krijgen dezelfde indeling.

Periodes 2026-2027:

| Periode | Van | Tot en met |
|---|---|---|
| GE1 | 1 september 2026 | 10 oktober 2026 |
| GE2 | 11 oktober 2026 | 12 december 2026 |
| GE3 | 13 december 2026 | 27 februari 2027 |
| GE4 | 28 februari 2027 | 13 juni 2027 |

---

## 8. Team en OneDrive

Werk je met collega's samen aan dezelfde klassen, dan deel je je werk via een
**gedeelde map in OneDrive**.

1. Maak (of vraag) één gedeelde map in OneDrive voor de vakgroep, en zorg dat
   die op je computer gesynchroniseerd wordt.
2. Open het tabblad **Team** en klik op **Gedeelde map kiezen**. Kies die
   OneDrive-map.
3. De tool bewaart jouw werk daar automatisch in een eigen bestand met je
   initialen.
4. Klik op het Evalueren-scherm op **Team bijwerken** om het werk van je
   collega's op te halen.

Bij **Team** vul je ook in **wie welke klas geeft**. Zo zie je bij Evalueren
wie hoeveel leerlingen van een klas al beoordeeld heeft.

> Samenvoegen verwijdert **nooit** iets: de tool voegt enkel toe, en bij twee
> versies van dezelfde beoordeling wint de nieuwste.

### Reservekopieën

Als je met een gedeelde map werkt, bewaart de tool vanzelf een
**reservekopie** van jouw werk. Je hoeft daar niets voor te doen.

- De kopieën staan in de map **backups**, in jullie gedeelde OneDrive-map.
- De naam bevat je initialen, de datum en het uur, bijvoorbeeld
  `evaluaties-BB-2026-09-29-14u05.json`.
- Er komt een kopie bij als je de tool opent en daarna elk uur dat je werkt.
  Veranderde er niets, dan komt er geen nieuwe kopie.
- Kopieën van de laatste twee weken blijven allemaal bewaard. Oudere kopieën
  worden opgeruimd tot één per week, en na een jaar verdwijnen ze.

**Iets misgegaan? Zet een vorige versie terug:**

1. Open het tabblad **Team**.
2. Zoek onder **Reservekopieën** de datum en het uur van vóór de fout.
3. Klik op **Terugzetten** en bevestig.
4. Klik daarna op **Team bijwerken** om nieuw werk van je collega's weer op
   te halen.

Wat je na dat tijdstip veranderde, is dan weg. Geen paniek als je de
verkeerde kiest: de tool maakt eerst nog een kopie van hoe het was. Die staat
bovenaan de lijst, dus je kan altijd terug.

Ga je iets groots doen, zoals een klaslijst opnieuw inlezen? Klik dan eerst
op **Nu een reservekopie maken**.

> Je ziet enkel je eigen reservekopieën. Het teruggezette werk komt ook bij je
> collega's terecht zodra zij op Team bijwerken klikken.

---

## 9. Een nieuw schooljaar

1. Klik linksboven op **+ Nieuw schooljaar**.
2. Lees nieuwe **klaslijsten** in (zie [Klaslijsten](#4-klaslijsten)).
3. Controleer de **periodes** in het tabblad Skore en sla ze op.

Rubrics, mappen, team en instellingen blijven behouden. Oude schooljaren kan
je nog altijd bekijken via de keuzelijst linksboven, maar niet meer wijzigen.

---

## 10. Problemen oplossen

| Probleem | Oplossing |
|---|---|
| De tool slaat niet automatisch op | Gebruik Chrome of Edge. In andere browsers moet je zelf op "Opslaan (download)" klikken. |
| Rode balk "Automatisch opslaan is mislukt" | Staat het bestand ergens anders open, of is OneDrive aan het synchroniseren? Klik op "Opnieuw proberen", of kies "Opslaan als…". |
| Rode balk "Je werk in deze browser kon niet gelezen worden" | Klik op "Werkbestand openen…" en kies je laatste werkbestand uit OneDrive. Download eerst de reservekopie. |
| Oranje balk "Gedeelde map niet verbonden" | Klik op "Verbinden met …". De browser vraagt na een herstart opnieuw toestemming. |
| Een leerling moet een evaluatie niet krijgen | Controle, Details, "Niet te beoordelen". |
| Een evaluatie staat in de verkeerde Skore-periode | Controleer de periodes onderaan het tabblad Skore. |
| Ik heb per ongeluk iets gewist of overschreven | Team, Reservekopieën: klik op "Terugzetten" bij een tijdstip van vóór de fout. |
| Ik zie de evaluaties van een collega niet | Klik op "Team bijwerken", of voeg hun bestand toe met "Werk van collega toevoegen". |
| Er staat een nieuwe versie van de tool klaar | Download het nieuwe bestand en open het. Je werkbestand blijft gewoon werken. |

---

## 11. Voor ontwikkelaars

- **Broncode:** [`stem-evaluatietool/`](stem-evaluatietool/) (zie de README
  daar voor de opbouw).
- **Wijzigingslog:** [`stem-evaluatietool/CHANGELOG.md`](stem-evaluatietool/CHANGELOG.md).
- **Overdracht voor een volgende ontwikkelsessie:** [`HANDOFF.md`](HANDOFF.md).

**Bouwen en testen:**

```bash
npm ci      # eenmalig
npm test    # bouwt naar stem-evaluatietool/dist/ en draait de testreeks
```

Bij elke push bouwt en test GitHub dit automatisch (tabblad "Actions"). Na
een geslaagde run staat het gebouwde bestand daar onder "Artifacts".

**Bij elke wijziging aan de tool** wordt deze handleiding mee bijgewerkt
(zie [`CLAUDE.md`](CLAUDE.md)).
