/* Standaard klaslijsten en rubrics. Dit is enkel het vertrekpunt bij
   een lege installatie — zodra er een werkbestand bestaat, komt alles
   daaruit (zie js/state.js). Bewerk klaslijsten en rubrics dus niet
   hier, maar in de tool zelf via Klaslijsten / Rubrics. */

var STUDENTS = {
  "1WM": [
    "Bogaerts Finn",
    "De Meyer Mats",
    "Hendrickx Anaïs",
    "Jacobs Lotte",
    "Jeurissen Lien",
    "Kaminski Victoria",
    "Lambrechts Neyo",
    "Mansouri Sana",
    "Martirosyan Nelly",
    "Massez Fenna",
    "Rombouts Liam",
    "Sambre Ruben",
    "Somers Phil",
    "van den Brink Marthe",
    "Van Goethem Arthur"
  ],
  "1WTa": [
    "De Koninck Iben",
    "Gerits Arthur",
    "Koekoeckx Daan",
    "Machiels Siebe",
    "Provo Alex",
    "Vanachter Fonne",
    "Van den Keybus Siënn",
    "Van Reeth Ruben",
    "Westerlinck Aiden"
  ],
  "1WTb1": [
    "Auwers Vic",
    "Bosman Winter",
    "Bosschaerts Hailey",
    "Bosschaerts Lars",
    "De Belder Julien",
    "De Bondt Alles",
    "De Schutter Stan",
    "Gui Leon",
    "Helsen Lander",
    "Janssens Lukas",
    "Konings Lowie",
    "Lenie Lou",
    "Rollier Jelle",
    "Somers Mathijs",
    "Van Gehuchten Lien",
    "Vanlommel Eefke",
    "Stoks Floris"
  ],
  "1WTb2": [
    "Couscheir Mats",
    "Kegelaers Ron",
    "Mustafa Berkin",
    "Mutebutsi Arianna",
    "Scheiblich Niall",
    "Theré Matheo",
    "Van Tendeloo Seph"
  ],
  "1WTc1": [
    "Bellens Luca",
    "De Keyser Lucca",
    "Hottentot Mylan",
    "Kuppens Thor",
    "Lamberts Mats",
    "Lefever Lio",
    "Lemmens Gaston",
    "Mertens Neal",
    "Oberts Ella",
    "Okhih Joppe",
    "Seeuws Stijn",
    "Serneels Emma",
    "Smeuninx Ivy",
    "Snelders Evi",
    "Steendam Kamiel"
  ],
  "1WTc2": [
    "Tavares Tiago",
    "Van den Broeck Stan",
    "Van de Poel Mitte",
    "Van Laerhoven Preben",
    "Van Mechelen Floor",
    "Vercammen Nand",
    "Vermeulen Leon",
    "Wyns Wies"
  ],
  "1WTd1": [
    "Aertgeerts Tibo",
    "Allaert Arthur",
    "Bogaerts Kobe",
    "Bostoen Lucas",
    "De Ridder Stan",
    "Donckers Dries",
    "Henning Seppe",
    "Loos Alexander",
    "Lycke Rube",
    "Massaux Lukasz",
    "Mortier Jules",
    "Muijzelaar Jaro",
    "Peeters Bas",
    "Van den Broeck Nils",
    "Verlinden Wout"
  ],
  "1WTd2": [
    "Piron Marcel",
    "Van den Eynde Loïc",
    "Van Dessel Oliver",
    "Van Regenmortel Jack",
    "Van Tendeloo Nox",
    "Verwerft Kellan",
    "Visschers Emiel",
    "Vivet Ruben"
  ],
  "2MW": [
    "Cavens Rune",
    "Ceulemans Elise",
    "Peenen Jarne",
    "Van Camp Warre",
    "Vanderlick Cédric",
    "Wagemans Luna",
    "Oeyen Stan"
  ],
  "2TWa": [
    "Antonissen Fen",
    "Cassier Carolina",
    "De Proft Nina",
    "Gerits Miel",
    "Gregoir Rune",
    "Hendrickx Cas",
    "Janssens Dante",
    "Spelkens Yotta",
    "Theys Sanne",
    "Van Bael Kobe",
    "Van de put Nina",
    "Van Dyck Robbe",
    "Verbeeck Juliette",
    "Verlaet Alexia"
  ],
  "2TWb1": [
    "Dieltjens Shawn",
    "Eersels Lou",
    "Gregoir Sander",
    "Grootaers Leon",
    "Hijmans Alexander",
    "Hovius Fynn",
    "Keersmaekers Kamiel",
    "Moons Hendrik",
    "Obbers Simon",
    "Pauwels Ruben",
    "Somers Finn",
    "Staelens Lars",
    "Truyen Wannes",
    "van Boxel Victor",
    "Van den Broeck Wannes",
    "Van der Kerken Stan"
  ],
  "2TWb2": [
    "Van de Weyer Thibaut",
    "Van Hove Sander",
    "Vanmarsenille Oscar",
    "Verachtert Thomas",
    "Verpoorten Wannes"
  ],
  "2TWc1": [
    "Aerts Louis",
    "Brants Troy",
    "Cluyts Dean",
    "De Lathouwer Oscar",
    "Dieltjens Wies",
    "Franck Sam",
    "Geudens Tijl",
    "Heylen Mats",
    "Merciny Tiebe",
    "Nuyts Seppe",
    "Smits Tygo",
    "Thys Sem",
    "Van Genechten Mathis"
  ],
  "2TWc2": [
    "Van Looveren Arne",
    "Van Roy Tuur",
    "Vanzurpele Milan",
    "Verstraete Pepijn",
    "Wouters Fonne"
  ]
};

var CONFIG = {
  "1ste jaar": {
    "classes": [
      "1WM",
      "1WTa",
      "1WTb1",
      "1WTb2",
      "1WTc1",
      "1WTc2",
      "1WTd1",
      "1WTd2"
    ],
    "evaluations": {
      "Challenge windei": [
        {
          "name": "Planning en stappenplan",
          "description": "Het invullen van de benodigde materialen en het vooraf opstellen van een chronologisch stappenplan met specifieke data en tijdstippen.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De materiaallijst en het stappenplan zijn niet ingevuld of ontbreken volledig."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Slechts enkele basismaterialen zijn genoteerd en het stappenplan is erg oppervlakkig zonder vermelding van specifieke meetmomenten."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De belangrijkste materialen zoals het ei en azijn zijn genoteerd en het stappenplan vermeldt de hoofdlijnen van het experiment zonder exacte data of tijdstippen."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Alle noodzakelijke materialen en meetgereedschappen zijn genoteerd en het stappenplan is logisch opgebouwd met concrete data en tijdstippen voor de metingen."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De materiaallijst is volledig gespecificeerd en het stappenplan toont een uiterst nauwkeurige tijdsplanning voor de observaties na twaalf, vierentwintig en zesendertig uur."
            }
          ],
          "id": "planning-en-stappenplan"
        },
        {
          "name": "Formuleren van hypothesen",
          "description": "Het vooraf formuleren van beredeneerde verwachtingen voor de drie verschillende proeven binnen de challenge.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er zijn vooraf geen hypothesen geformuleerd voor de drie proeven."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Er zijn hypothesen genoteerd, maar deze zijn niet onderbouwd en beperken zich tot zeer eenvoudige voorspellingen zoals het ei wordt zacht."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Voor elke proef (het weken, de lichttest en de valtest) is een eenvoudige, relevante hypothese opgesteld die beschrijft wat er naar verwachting gebeurt."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De hypothesen voor de drie proeven zijn helder geformuleerd en tonen een goed begrip van de verwachte invloed van azijn op de kalkschaal."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De hypothesen zijn wetenschappelijk beargumenteerd en maken vooraf een specifiek, meetbaar onderscheid tussen de resultaten van het onbehandelde ei en het azijnei."
            }
          ],
          "id": "formuleren-van-hypothesen"
        },
        {
          "name": "Video-observaties en voortgangsrapportage",
          "description": "Het periodiek opnemen, mondeling toelichten en tijdig uploaden van de drie verplichte voortgangsvideo's.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er zijn geen voortgangsfilmpjes opgenomen of geüpload in de uploadzone."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Er is slechts één filmpje geüpload, of de video's bevatten geen mondelinge toelichting van de bevindingen over de toestand van het ei."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De drie verplichte filmpjes (na twaalf, vierentwintig en zesendertig uur) zijn geüpload, maar de uitleg over de transformatie is erg beknopt."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De drie filmpjes zijn op de juiste momenten opgenomen, duren maximaal een minuut en bevatten een duidelijke mondelinge toelichting van de waargenomen veranderingen."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De drie filmpjes zijn exact op schema opgenomen, duren maximaal een minuut, tonen een stabiele camera-opstelling en bieden een kwalitatieve, scherpe analyse van het proces."
            }
          ],
          "id": "video-observaties-en-voortgangsrapportage"
        },
        {
          "name": "Lichttest en fotografie",
          "description": "Het maken en inleveren van een kwalitatieve foto van het windei in het donker met een lichtbron erachter.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er is geen foto van het windei met een lamp erachter gemaakt of ingeleverd."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De foto is erg onduidelijk, onscherp of overbelicht, waardoor het rubberachtige gloeieffect van het ei nauwelijks te beoordelen is."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Er is een herkenbare foto in het donker gemaakt waarbij het doorschijnen van het licht door het ei zichtbaar is gemaakt."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De ingediende foto is scherp en goed belicht, waardoor het windei duidelijk als een soort gloeibal te zien is in een donkere ruimte."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De foto is van uitstekende kwaliteit, perfect scherpgesteld en toont het doorschijnende effect en de interne structuur van het windei op een creatieve manier."
            }
          ],
          "id": "lichttest-en-fotografie"
        },
        {
          "name": "Uitvoering en dataregistratie valtest",
          "description": "Het systematisch uitvoeren van de valtest vanaf verschillende hoogtes en het correct bijhouden van de breekpunten in de tabel.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De valtest is niet uitgevoerd of de tabel met de valhoogtes van vijf tot zestig centimeter is volledig leeg gelaten."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De valtest is onvolledig uitgevoerd door stappen over te slaan, of de gegevens zijn slechts voor één van de twee eieren genoteerd."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De valtest is uitgevoerd volgens de intervallen van vijf centimeter en de breekpunten van beide eieren zijn herkenbaar genoteerd in de tabel."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De valtest is nauwkeurig uitgevoerd met een meetlat op een geschikte ondergrond, en de tabel is volledig en overzichtelijk ingevuld voor beide eieren."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De valtest is strikt systematisch uitgevoerd conform de veiligheidsrichtlijnen, en de tabel is foutloos ingevuld met een exacte registratie van de breekhoogtes."
            }
          ],
          "id": "uitvoering-en-dataregistratie-valtest"
        },
        {
          "name": "Formuleren van besluiten",
          "description": "Het trekken van conclusies voor de drie proeven op basis van de verzamelde waarnemingen en tabelgegevens.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er zijn geen besluiten of conclusies genoteerd voor de uitgevoerde proeven."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De besluiten zijn zeer oppervlakkig en beschrijven enkel wat er te zien was, zonder een logische conclusie te trekken over de werking van het azijn."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Voor elke proef is een basisconclusie geformuleerd die aansluit bij de resultaten uit de tabel en de gemaakte filmpjes."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De besluiten zijn helder geformuleerd en leggen een correct functioneel verband tussen het verdwijnen van de kalkschaal en de elasticiteit van het ei."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De besluiten zijn wetenschappelijk nauwkeurig onderbouwd, evalueren de eerdere hypothesen kritisch en verklaren de chemische reactie met het azijnzuur diepgaand."
            }
          ],
          "id": "formuleren-van-besluiten"
        },
        {
          "name": "Reflectie en zelfevaluatie",
          "description": "Het kritisch evalueren van het eigen verloop van de challenge en het formuleren van persoonlijke leerpunten.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De evaluatie- en reflectievragen aan het einde van de werkbundel zijn niet beantwoord."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De reflectievragen zijn zeer summier beantwoord met eenletterige of oppervlakkige antwoorden zonder enige diepgang."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Alle reflectievragen zijn ingevuld en geven een beknopt maar bruikbaar beeld van wat er goed ging en wat er minder goed verliep."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De reflectie is uitgebreid ingevuld met concrete voorbeelden van eigen succesmomenten, uitdagingen en duidelijke leerpunten voor een volgende keer."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De zelfevaluatie toont een diepgaand kritisch inzicht waarbij de leerling het eigen experimentele handelen en de tijdsplanning analyseert en vertaalt naar waardevolle verbeteracties."
            }
          ],
          "id": "reflectie-en-zelfevaluatie"
        }
      ],
      "Challenge kettingreactie": [
        {
          "name": "Planning en stappenplan",
          "description": "Het invullen van de benodigde materialen en het vooraf opstellen van een chronologisch stappenplan met specifieke deadlines.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De materiaallijst en het stappenplan zijn niet ingevuld of ontbreken volledig."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Slechts enkele basismaterialen zijn genoteerd en het stappenplan is erg oppervlakkig zonder concrete tijdsplanning."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De belangrijkste materialen zijn genoteerd en het stappenplan vermeldt de hoofdlijnen van de bouwfasen zonder gedetailleerde deadlines."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Alle noodzakelijke materialen zijn genoteerd en het stappenplan is logisch opgebouwd met duidelijke deadlines voor de testfases."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De materiaalspecificatie is volledig en het stappenplan toont een uiterst nauwkeurige tijdsplanning met expliciet ingecalculeerde bijstuurmomenten."
            }
          ],
          "id": "planning-en-stappenplan"
        },
        {
          "name": "Duur van de kettingreactie",
          "description": "De totale tijdsduur dat de kettingreactie continu in beweging blijft zonder tussentijdse handmatige stops.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De kettingreactie duurt korter dan 15 seconden of treedt helemaal niet in werking."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De kettingreactie blijft tussen 15 en 29 seconden in beweging, wat ruim onder de vereiste norm is."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De kettingreactie blijft tussen 30 en 39 seconden lopen, waarmee het net onder de gevraagde limiet van 40 seconden zit."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De kettingreactie voldoet aan de gestelde norm van de werkbundel en duurt exact tussen 40 en 50 seconden."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De kettingreactie duurt langer dan 50 seconden en behoudt over de gehele tijdsduur een vloeiende dynamiek."
            }
          ],
          "id": "duur-van-de-kettingreactie"
        },
        {
          "name": "Aantal kettingreacties",
          "description": "Het aantal verschillende opeenvolgende oorzaak-gevolgreacties of schakels dat in de opstelling is verwerkt.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De opstelling bevat minder dan 4 verschillende opeenvolgende reacties."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De opstelling bevat tussen 4 en 7 verschillende opeenvolgende reacties."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De opstelling bevat tussen 8 en 11 verschillende opeenvolgende reacties, wat net onder de gevraagde norm van 12 zit."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De opstelling bevat exact de gevraagde 12 verschillende kettingreacties conform de opdracht."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De opstelling bevat meer dan 12 unieke, opeenvolgende kettingreacties die foutloos en autonoom in elkaar overlopen."
            }
          ],
          "id": "aantal-kettingreacties"
        },
        {
          "name": "Creativiteit en materiaalkeuze",
          "description": "De originaliteit van de opstelling en de variatie in het gebruik van alledaagse materialen.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er is geen originaliteit aanwezig en er wordt slechts een enkel type standaardmateriaal gebruikt."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Er is weinig variatie in materialen en de overgangen tussen de onderdelen zijn zeer voorspelbaar."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Verschillende alledaagse materialen zijn gecombineerd tot een functionele opstelling met enkele creatieve elementen."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Er is sprake van een zeer creatief gebruik van diverse huis-tuin-en-keukenmaterialen met verrassende mechanische effecten."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Het concept is uiterst innovatief met een indrukwekkend visueel wow-effect en zeer vindingrijke materiaalcombinaties."
            }
          ],
          "id": "creativiteit-en-materiaalkeuze"
        },
        {
          "name": "Video-opname en rapportage",
          "description": "De kwaliteit van de videoregistratie in een ononderbroken opname en de tijdige inlevering via de uploadzone.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er is geen video geüpload in de daarvoor bestemde uploadzone op Smartschool."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De video bevat knips en is niet in een ononderbroken opname gefilmd, of de opstelling is slecht zichtbaar."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De video is in een ononderbroken opname gefilmd en succesvol geüpload, hoewel het overzicht beter kon."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De video is gefilmd in exact 1 take, toont de volledige baan scherp en helder, en is tijdig ingediend."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De opname is van uitstekende kwaliteit, perfect stabiel gefilmd in 1 take en biedt een vlekkeloos overzicht van het volledige proces."
            }
          ],
          "id": "video-opname-en-rapportage"
        },
        {
          "name": "Besluit en analyse",
          "description": "Het correct benoemen van de gebruikte typen reacties en het formuleren van een algemene conclusie in de werkbundel.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Er zijn geen besluiten genoteerd en de gebruikte typen kettingreacties worden niet benoemd."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Het besluit is uiterst beknopt en de gebruikte soorten kettingreacties zijn grotendeels verkeerd geïdentificeerd."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Er is een basisconclusie geformuleerd en de belangrijkste soorten gebruikte kettingreacties zijn correct benoemd."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Het besluit bevat een duidelijke analyse van de werking van de baan en brengt de gebruikte typen reacties helder in kaart."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De conclusie toont een diepgaand technisch begrip, analyseert energie-overdrachten en benoemt alle reacties feilloos."
            }
          ],
          "id": "besluit-en-analyse"
        },
        {
          "name": "Reflectie en zelfevaluatie",
          "description": "Het kritisch beoordelen van de eigen werkhouding, het proces en de behaalde resultaten aan de hand van de evaluatievragen.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De evaluatie- en reflectievragen aan het einde van de werkbundel zijn volledig leeg gelaten."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De reflectievragen zijn zeer summier beantwoord met korte zinnen zonder kritische blik op het eigen handelen."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Alle reflectievragen zijn ingevuld en geven een bruikbaar algemeen beeld van de successen en knelpunten."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De zelfevaluatie is uitgebreid en bevat concrete voorbeelden van technische problemen en persoonlijke leerpunten."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De reflectie getuigt van een diepgaand kritisch inzicht waarbij het eigen experimentele handelen nauwkeurig wordt omgezet in gerichte verbeteracties."
            }
          ],
          "id": "reflectie-en-zelfevaluatie"
        }
      ],
      "Maken van pinkers": [
        {
          "name": "Elektrische Schakeling",
          "description": "Werkt de schakeling correct? Knipperen/branden de LED's goed en is de bedrading correct aangesloten?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Werkt niet (kortsluiting) of compleet fout aangesloten."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Slechts 1 LED werkt, of veel haperingen bij de schakelaar."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Werkt grotendeels, maar soms slecht contact."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Schakeling is correct en werkt zeer betrouwbaar."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Perfect functionerend, helder en logisch bekabeld."
            }
          ],
          "id": "elektrische-schakeling"
        },
        {
          "name": "Realisatie & Soldeerwerk",
          "description": "Beoordeel de kwaliteit van het soldeerwerk en de isolatie van de verbindingen (bv. gebruik van krimpkousen).",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Losse draden, blote koperdraden (gevaar op kortsluiting)."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Klonterig en dof gesoldeerd, rommelig afgewerkt."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Functioneel gesoldeerd, maar oogt wat slordig."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Nette, glanzende verbindingen. Isolatie correct toegepast."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Zeer professioneel gesoldeerd en perfect geïsoleerd."
            }
          ],
          "id": "realisatie-soldeerwerk"
        },
        {
          "name": "Behuizing & Fietsmontage",
          "description": "Is de behuizing stevig en waterbestendig? Kan het geheel veilig en efficiënt op een fiets gemonteerd worden?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen behuizing, onmogelijk te monteren op een fiets."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Behuizing is rudimentair, zeer wankele montage."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Oké, maar vereist nog tape of aanpassingen voor montage."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Stevige behuizing, makkelijk en stabiel te monteren."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Waterbestendig, inventief en past perfect op de fiets."
            }
          ],
          "id": "behuizing-fietsmontage"
        },
        {
          "name": "Werkproces & Veiligheid",
          "description": "Heeft de leerling tijdens de praktijkles veilig, netjes en zelfstandig gewerkt met het gereedschap?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Onveilig gewerkt met bout, werkplek vies achtergelaten."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Slordig, veel materiaal verspild, weinig oog voor veiligheid."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basisregels gevolgd, had nog wat sturing nodig."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Zelfstandig en veilig gewerkt, werkplek netjes opgeruimd."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Voorbeeldige werkhouding, extreem veilig en gestructureerd."
            }
          ],
          "id": "werkproces-veiligheid"
        }
      ]
    }
  },
  "2de jaar": {
    "classes": [
      "2MW",
      "2TWa",
      "2TWb1",
      "2TWb2",
      "2TWc1",
      "2TWc2"
    ],
    "evaluations": {
      "Inzet jaarproject": [
        {
          "name": "Zelfstandigheid en taakgerichtheid",
          "description": "De mate waarin de leerling tijdens de les gefocust aan de slag gaat en zonder constante sturing kan werken aan het technologisch of wetenschappelijk probleem.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De leerling is snel afgeleid, werkt niet of nauwelijks aan het project en heeft de hele les door aansporing nodig om bezig te blijven."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De leerling heeft moeite om de aandacht bij het project te houden en heeft vaak sturing nodig van de leerkracht om aan het werk te blijven."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De leerling werkt redelijk zelfstandig aan het project, maar is af en toe afgeleid en heeft soms een korte herinnering nodig om gefocust te blijven."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De leerling werkt goed zelfstandig, is gedurende de les gefocust op de taak en weet uit zichzelf wat de volgende stap is in het ontwerpproces."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De leerling werkt uiterst geconcentreerd, neemt proactief initiatief voor volgende stappen en behoudt een zeer sterke focus gedurende de volledige lestijd."
            }
          ],
          "id": "zelfstandigheid-en-taakgerichtheid"
        },
        {
          "name": "Probleemoplossend vermogen en doorzettingsvermogen",
          "description": "Hoe de leerling reageert wanneer het project niet volgens plan verloopt, een experiment mislukt of er technologische obstakels opduiken.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De leerling geeft direct op bij een probleem, raakt gefrustreerd en onderneemt zelf geen enkele actie om een oplossing te zoeken."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De leerling probeert een probleem slechts heel kort zelf aan te pakken en roept daarna direct om hulp zonder eerst andere bronnen te raadplegen."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De leerling probeert problemen eerst een tijdje zelf of met medeleerlingen op te lossen voordat de hulp van de leerkracht wordt ingeschakeld."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De leerling toont duidelijk doorzettingsvermogen, zoekt actief naar oplossingen in naslagwerken of het internet, en geeft niet snel op na een tegenslag."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De leerling ziet obstakels als leerkansen, onderzoekt systematisch meerdere mogelijke oplossingen en toont een opmerkelijk groot doorzettingsvermogen."
            }
          ],
          "id": "probleemoplossend-vermogen-en-doorzettingsvermogen"
        },
        {
          "name": "Tijdbeheer en werkplanning",
          "description": "De manier waarop de leerling de beschikbare lestijd plant en effectief benut om vooruitgang te boeken met het project.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De leerling verspilt structureel de lestijd aan andere zaken, heeft geen overzicht en boekt hierdoor nagenoeg geen vooruitgang in de afgelopen periode."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De leerling heeft moeite met het inschatten van tijd, waardoor taken niet afraken en de vooruitgang in de les trager is dan wat realistisch verwacht mag worden."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De leerling maakt in de regel nuttig gebruik van de lestijd, houdt zich aan de gemaakte afspraken en boekt de verwachte, stabiele vooruitgang."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De leerling deelt de lestijd efficiënt in, weet precies welke deeltaken prioriteit hebben en zorgt voor een duidelijk zichtbare vooruitgang in het project."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De leerling hanteert een doordachte planning, anticipeert op mogelijke vertragingen in het ontwerpproces en benut de lestijd maximaal om voorop schema te blijven."
            }
          ],
          "id": "tijdbeheer-en-werkplanning"
        },
        {
          "name": "Samenwerking en rol binnen de groep",
          "description": "De mate waarin de leerling actief bijdraagt aan de groepswerking, verantwoordelijkheid neemt voor het gezamenlijke project en constructief samenwerkt met teamleden.",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "De leerling neemt geen actieve rol op, leunt volledig op de inzet van groepsleden, of vertoont gedrag dat de samenwerking en het groepsproces belemmert."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "De leerling neemt een afwachtende houding aan, voert voornamelijk taken uit als anderen dit expliciet vragen en toont weinig eigen initiatief in het groepswerk."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "De leerling voert de eigen, afgesproken taken binnen het project adequaat uit, neemt deel aan het groepsoverleg en draagt een eerlijk deel bij aan het eindresultaat."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "De leerling neemt actief een duidelijke rol aan in het team, denkt proactief mee over de taakverdeling en helpt groepsleden op een constructieve manier vooruit."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "De leerling fungeert als een stuwende kracht binnen de groep, neemt vlug en doeltreffend verantwoordelijkheid op, motiveert teamleden en zorgt voor een zeer positieve, productieve groepsdynamiek."
            }
          ],
          "id": "samenwerking-en-rol-binnen"
        }
      ],
      "Pitch jaarproject": [
        {
          "name": "Inhoud & STEM-cyclus",
          "description": "Bevat de pitch alle belangrijke informatie over de probleemstelling en de stappen van de STEM-cyclus?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen link met de cyclus, mist de absolute kern van het project."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Zeer summiere uitleg, mist essentiële stappen van het proces."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basisconcepten uitgelegd, maar het proces blijft oppervlakkig."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Heldere uitleg van het probleem en de gekozen oplossingsstappen."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Diepgaande, logische uitleg van het hele proces en gemaakte keuzes."
            }
          ],
          "id": "inhoud-stem-cyclus"
        },
        {
          "name": "Prototype / Eindproduct",
          "description": "Wordt er een werkend, kwalitatief afgewerkt prototype getoond en overtuigend gedemonstreerd tijdens de pitch?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen prototype of een prototype dat absoluut niet werkt."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Prototype toont het concept aan, maar hapert of is onaf."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Werkend prototype getoond, maar de afwerking is zeer matig."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Werkend en netjes afgewerkt prototype. Duidelijke demonstratie."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Zeer innovatief, robuust en professioneel afgewerkt prototype."
            }
          ],
          "id": "prototype-eindproduct"
        },
        {
          "name": "Presentatievaardigheden",
          "description": "Spreken de leerlingen vlot, met oogcontact en overtuiging? Blijven ze strak binnen de toegewezen tijd?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Volledig afgelezen, geen oogcontact, timing sterk afwijkend."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Onzeker, monotoon, slecht verdeeld of timing genegeerd."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Voldoende luid, af en toe oogcontact, timing is redelijk oké."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Vlotte vertelstijl, goede taakverdeling en perfect op tijd."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Overtuigend, professioneel en boeit het publiek volledig."
            }
          ],
          "id": "presentatievaardigheden"
        },
        {
          "name": "Visuele Ondersteuning",
          "description": "Is de presentatie (poster/slides) visueel aantrekkelijk, foutloos en een goede ondersteuning van het verhaal?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Zeer rommelig, onleesbaar of te veel overbodige tekst."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Lay-out is verwarrend, visuals versterken het verhaal niet."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Functioneel en leesbaar, maar weinig creatief vormgegeven."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Aantrekkelijke vormgeving, duidelijke en helpende schema's."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Professionele en in het oog springende visuals."
            }
          ],
          "id": "visuele-ondersteuning"
        },
        {
          "name": "Vragenronde / Q&A",
          "description": "Kunnen de leerlingen na de pitch gerichte, kritische vragen over hun project vlot en inhoudelijk correct beantwoorden?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Zwijgt, of kan totaal niet antwoorden op fundamentele vragen."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Heeft veel hulp nodig van groepsleden, vage antwoorden."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Geeft correcte basisantwoorden, maar mist technische diepgang."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Antwoordt vlot en correct met de juiste technische termen."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Toont zich expert, pareert kritische vragen moeiteloos."
            }
          ],
          "id": "vragenronde-q-a"
        }
      ],
      "Paper jaarproject": [
        {
          "name": "Inleiding & Probleemstelling",
          "description": "Is de onderzoeksvraag helder geformuleerd en wordt het doel van het project duidelijk uitgelegd?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen duidelijke inleiding of probleemstelling aanwezig."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Zeer vaag beschreven probleem, onderzoeksvraag ontbreekt deels."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Doel en probleemstelling duidelijk, maar erg beknopt."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Heldere probleemstelling, goede afbakening van het project."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Uitstekend en overtuigend uitgeschreven inleiding en doel."
            }
          ],
          "id": "inleiding-probleemstelling"
        },
        {
          "name": "Onderzoek & STEM-cyclus",
          "description": "Wordt het proces van ontwerpen, testen en bijsturen goed en gedetailleerd beschreven in de paper?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen weergave van het ontwerpproces, enkel het eindresultaat."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Stappen van de cyclus missen of zijn zeer onduidelijk beschreven."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basisstappen uitgelegd, maar mist details van het testproces."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Duidelijk overzicht van het proces, met logboek en testfase."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Diepgaande analyse van alle iteraties, testen en keuzes."
            }
          ],
          "id": "onderzoek-stem-cyclus"
        },
        {
          "name": "Technische theorie",
          "description": "Zijn de achterliggende technische en natuurwetenschappelijke principes correct toegepast en uitgeschreven?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Theorie ontbreekt of bevat zware fundamentele fouten."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Zeer oppervlakkige theorie, bevat meerdere kleine fouten."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basisprincipes correct uitgelegd, zonder veel verdieping."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Goede, diepgaande en foutloze technische uitleg."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Zeer sterke koppeling tussen theorie en praktijk, hoog niveau."
            }
          ],
          "id": "technische-theorie"
        },
        {
          "name": "Besluit & Reflectie",
          "description": "Bevat de paper een duidelijke conclusie en een kritische reflectie op de samenwerking en het resultaat?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Conclusie en reflectie ontbreken volledig."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Enkel een zeer kort besluit, geen echte reflectie op het werk."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basis evaluatie van wat goed/fout ging in het project."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Sterk besluit met goede reflectie op proces en product."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Zeer kritische blik op eigen werk met concrete verbetervoorstellen."
            }
          ],
          "id": "besluit-reflectie"
        },
        {
          "name": "Structuur & Lay-out",
          "description": "Is de paper logisch opgebouwd (inleiding, kern, slot) en is de lay-out netjes en overzichtelijk?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Geen structuur, onoverzichtelijk en onlogisch opgebouwd."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Verwarrende lay-out, inconsistente titels of alinea's."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Basisstructuur (inleiding/kern/slot) aanwezig en oké opgemaakt."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Heldere structuur, goed gebruik van witruimte en afbeeldingen."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Professioneel vormgegeven, perfecte logische flow."
            }
          ],
          "id": "structuur-lay-out"
        },
        {
          "name": "Taal & Bronvermelding",
          "description": "Is de tekst vlot leesbaar, zonder spelfouten, en zijn de gebruikte bronnen correct vermeld?",
          "options": [
            {
              "score": 1,
              "label": "Onvoldoende",
              "desc": "Extreem veel taalfouten, spreektaal gebruikt, geen bronnen."
            },
            {
              "score": 2,
              "label": "Matig",
              "desc": "Storende spelfouten, onvolledige of slordige bronvermelding."
            },
            {
              "score": 3,
              "label": "Voldoende",
              "desc": "Begrijpelijk geschreven, basis bronvermelding aanwezig."
            },
            {
              "score": 4,
              "label": "Goed",
              "desc": "Vlot geschreven, weinig fouten, correcte referentiestijl."
            },
            {
              "score": 5,
              "label": "Zeer Goed",
              "desc": "Foutloos, academische toon en perfecte bronvermelding."
            }
          ],
          "id": "taal-bronvermelding"
        }
      ]
    }
  }
};
