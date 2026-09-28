/* ---- overgenomen uit goals.js ---- */

/* ------------------------------------------------------------------
   LEERPLANDOELEN — 2de jaar

   Overgenomen uit "POV-doelen-MW-TW-2A".

   Zestien doelen komen woordelijk in beide leerplannen voor, met
   hetzelfde beheersingsniveau. Die staan hier één keer, met beide
   codes. Zo duid je ze met één klik aan voor allebei en kan je er
   niet één vergeten.

   Doelen die er alleen op lijken zijn bewust niet samengevoegd:
   SW09 "analyseren waarnemingen" tegenover MW22 "verwoorden
   waarnemingen", en SW21 tegenover MW30 dat "aan de hand van een
   aangereikt stappenplan" toevoegt.

   De sleutel van een doel is zijn id: de SW-code waar die bestaat,
   anders de MW-code.
   ------------------------------------------------------------------ */

var BLOOM_ORDER = ["onthouden", "begrijpen", "toepassen", "analyseren", "evalueren", "creëren"];

var GOAL_PACKAGES = {
  TW: { label: "Techniek wetenschappen", note: "pakket STEM-wetenschappen" },
  MW: { label: "Moderne talen en wetenschappen", note: "basisoptie STEM-wetenschappen" },
}

var GOALS = {
  "2de jaar": [
      {
          "id": "SW01",
          "codes": {
              "TW": "SW01",
              "MW": "MW13"
          },
          "bloom": "toepassen",
          "rubriek": "Gezondheid, duurzaamheid en veiligheid",
          "text": "De leerlingen werken op een veilige manier, rekening houdend met instructies, gevaarsymbolen, veiligheidsrisico's en persoonlijke hygiëne.",
          "concretisering": "veiligheidsinstructies opzoeken, risico's leren inschatten, gebruik maken van persoonlijke beschermingsmiddelen"
      },
      {
          "id": "SW02",
          "codes": {
              "TW": "SW02",
              "MW": "MW14"
          },
          "bloom": "toepassen",
          "rubriek": "Gezondheid, duurzaamheid en veiligheid",
          "text": "De leerlingen handelen duurzaam met energiebronnen, grondstoffen, materiaal en toestellen.",
          "concretisering": "zorgzaam omgaan met materiaal en gereedschap, zuinig gebruik maken van grondstoffen, energiebesparend werken waar het kan"
      },
      {
          "id": "SW03",
          "codes": {
              "TW": "SW03"
          },
          "bloom": "toepassen",
          "rubriek": "Gezondheid, duurzaamheid en veiligheid",
          "text": "De leerlingen lichten het belang toe van de correcte afvoer van chemische stoffen en vervuilde labomaterialen.",
          "concretisering": "zoals gebruik maken van de 'Flowchart voor vloeibaar afval' uit COS-brochure, het recycleren van materiaal of grondstoffen"
      },
      {
          "id": "MW15",
          "codes": {
              "MW": "MW15"
          },
          "bloom": "toepassen",
          "rubriek": "Gezondheid, duurzaamheid en veiligheid",
          "text": "De leerlingen passen de gemaakte afspraken rond een verantwoorde keuze voor de correcte afvoer of recyclage van gebruikte materialen toe.",
          "concretisering": "sorteren volgens de geldende regelgeving, recycleren van materiaal en grondstoffen waar het kan"
      },
      {
          "id": "MW16",
          "codes": {
              "MW": "MW16"
          },
          "bloom": "begrijpen",
          "rubriek": "Gezondheid, duurzaamheid en veiligheid",
          "text": "De leerlingen lichten het belang toe van het inschatten van risico's voor de aanvang van een experiment.",
          "concretisering": "aangegeven in de COS-brochure of op de website www.gevaarlijkestoffen.be"
      },
      {
          "id": "SW04",
          "codes": {
              "TW": "SW04",
              "MW": "MW17"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "Leerlingen passen stapsgewijs de wetenschappelijke methode toe bij een onderzoek in biologie, chemie of fysica.",
          "concretisering": "onderzoeksvraag opstellen, hypothese formuleren, methode/plan uitvoeren, waarnemingen/data analyseren, concluderen"
      },
      {
          "id": "SW05",
          "codes": {
              "TW": "SW05",
              "MW": "MW18"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen formuleren voor een afgebakend probleem een onderzoeksvraag aan de hand van aangereikte criteria.",
          "concretisering": "criteria voor een onderzoeksvraag: onderzoekbaar, ondubbelzinnig, afgebakend, relevant, beknopt en vraagvorm"
      },
      {
          "id": "SW06",
          "codes": {
              "TW": "SW06",
              "MW": "MW19"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen formuleren een hypothese in functie van een onderzoeksvraag aan de hand van aangereikte criteria.",
          "concretisering": "criteria waaraan een hypothese moet voldoen: toetsbaar, ondubbelzinnig, afgebakend, relevant, beknopt"
      },
      {
          "id": "SW07",
          "codes": {
              "TW": "SW07"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen maken een eenvoudige proefopstelling in functie van het onderzoek.",
          "concretisering": "zoals statiefopstelling, stroomkring maken, meetinstallatie"
      },
      {
          "id": "MW20",
          "codes": {
              "MW": "MW20"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen voeren een onderzoek/stappenplan uit waarvan de resultaten aanleiding geven tot een antwoord op de onderzoeksvraag.",
          "concretisering": ""
      },
      {
          "id": "SW08",
          "codes": {
              "TW": "SW08",
              "MW": "MW21"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen verzamelen gegevens bij een onderzoek.",
          "concretisering": "zoals het noteren van meetresultaten, het verzamelen van resultaten van een enquête, het noteren van waarnemingen tijdens een observatie"
      },
      {
          "id": "SW09",
          "codes": {
              "TW": "SW09"
          },
          "bloom": "analyseren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen analyseren waarnemingen in functie van het onderzoek.",
          "concretisering": "zoals gasvorming, neerslagvorming en kleurverandering, observaties, beweging"
      },
      {
          "id": "MW22",
          "codes": {
              "MW": "MW22"
          },
          "bloom": "analyseren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen verwoorden waarnemingen in functie van het onderzoek.",
          "concretisering": "zoals gasvorming, neerslagvorming en kleurverandering, observaties, beweging"
      },
      {
          "id": "SW10",
          "codes": {
              "TW": "SW10"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen zetten (SI-)eenheden en grootheden zinvol om binnen functionele contexten.",
          "concretisering": "zoals omzetten van lengte-eenheden, volume-eenheden, massa-eenheden"
      },
      {
          "id": "SW11",
          "codes": {
              "TW": "SW11",
              "MW": "MW23"
          },
          "bloom": "analyseren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen analyseren de verzamelde en beschikbare datagegevens om te classificeren of om een besluit te formuleren.",
          "concretisering": "zoals het bepalen van trends, het classificeren van gegevens in rubrieken"
      },
      {
          "id": "SW12",
          "codes": {
              "TW": "SW12",
              "MW": "MW24"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen gebruiken zelfgemaakte modellen om te visualiseren, te beschrijven of te verklaren.",
          "concretisering": "zoals schetsen, schema's, tekeningen"
      },
      {
          "id": "SW13",
          "codes": {
              "TW": "SW13"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen visualiseren de genoteerde meetresultaten in functie van het onderzoek.",
          "concretisering": "zoals gebruik van tabellen, grafieken, sjablonen, wetenschappelijke notatie"
      },
      {
          "id": "SW14",
          "codes": {
              "TW": "SW14",
              "MW": "MW25"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen formuleren een antwoord op een onderzoeksvraag of hypothese aan de hand van aangereikte richtlijnen.",
          "concretisering": "toetsen van de hypothese"
      },
      {
          "id": "SW15",
          "codes": {
              "TW": "SW15",
              "MW": "MW26"
          },
          "bloom": "creëren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen schrijven van een eigen onderzoek een verslag aan de hand van een schrijfkader.",
          "concretisering": "zoals aan de hand van een sjabloon van verslag met schrijfkader"
      },
      {
          "id": "SW16",
          "codes": {
              "TW": "SW16"
          },
          "bloom": "analyseren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen analyseren recht- en omgekeerd evenredige verbanden tussen grootheden en kunnen die in verband brengen met eigenschappen van natuurlijke en technische systemen.",
          "concretisering": "zoals onderzoek naar snelheid van systemen, onderzoek naar de rechtlijnige eenparige beweging, onderzoek naar wet van Ohm"
      },
      {
          "id": "SW17",
          "codes": {
              "TW": "SW17"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen werken efficiënt en doelgericht.",
          "concretisering": "zoals tijd respecteren, planmatig werken, werkverdeling"
      },
      {
          "id": "SW18",
          "codes": {
              "TW": "SW18",
              "MW": "MW27"
          },
          "bloom": "evalueren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen evalueren het eigen werk aan de hand van vooropgestelde criteria.",
          "concretisering": "zoals proces- en productevaluatie"
      },
      {
          "id": "SW19",
          "codes": {
              "TW": "SW19",
              "MW": "MW28"
          },
          "bloom": "evalueren",
          "rubriek": "De wetenschappelijke onderzoeksmethode",
          "text": "De leerlingen sturen, indien nodig, eigen werkzaamheden bij.",
          "concretisering": "zoals aanpassen methode, aanpassen stappenplan, aanpassen materiaal- of gereedschapskeuze"
      },
      {
          "id": "SW20",
          "codes": {
              "TW": "SW20"
          },
          "bloom": "begrijpen",
          "rubriek": "De wetenschappelijke disciplines",
          "text": "De leerlingen herkennen de samenhang tussen biologie, fysica en chemie.",
          "concretisering": "zoals onderzoek van plantaardige kleurstoffen, de fotosynthese, toepassingen van actieve kool, voedingsstoffen"
      },
      {
          "id": "SW21",
          "codes": {
              "TW": "SW21"
          },
          "bloom": "analyseren",
          "rubriek": "De wetenschappelijke disciplines",
          "text": "De leerlingen onderzoeken het verband tussen natuurwetenschappen en verschijnselen in het dagelijks leven.",
          "concretisering": "zoals onderzoek naar de zwaartekracht, milieuvervuiling, bereidingsprocessen, kunststoffen"
      },
      {
          "id": "MW29",
          "codes": {
              "MW": "MW29"
          },
          "bloom": "toepassen",
          "rubriek": "De wetenschappelijke disciplines",
          "text": "De leerlingen tonen via experimenten het onderscheid aan tussen biologie, fysica en chemie.",
          "concretisering": "oxidatie, krachten, faseovergangen of andere experimenten zoals extractie, vergisting"
      },
      {
          "id": "MW30",
          "codes": {
              "MW": "MW30"
          },
          "bloom": "analyseren",
          "rubriek": "Onderzoek in natuurwetenschappen",
          "text": "De leerlingen onderzoeken het verband tussen natuurwetenschappen en verschijnselen in het dagelijks leven aan de hand van een aangereikt stappenplan.",
          "concretisering": "zoals onderzoek naar de zwaartekracht, milieuvervuiling, bereidingsprocessen, kunststoffen, de klimaatverstoring, evolutionaire aanpassingen, nanotechnologie, hernieuwbare energie"
      },
      {
          "id": "MW31",
          "codes": {
              "MW": "MW31"
          },
          "bloom": "analyseren",
          "rubriek": "Onderzoek in natuurwetenschappen",
          "text": "De leerlingen voeren een onderzoek uit in biologie.",
          "concretisering": "zoals het belang van biodiversiteit, voedselbederf, toepassingen van micro-organismen in het dagelijks leven, aantonen van voedingsstoffen in voeding"
      },
      {
          "id": "MW32",
          "codes": {
              "MW": "MW32"
          },
          "bloom": "analyseren",
          "rubriek": "Onderzoek in natuurwetenschappen",
          "text": "De leerlingen voeren een onderzoek uit in chemie.",
          "concretisering": "zoals het onderzoek naar waterzuivering, zonne-energie, stofeigenschappen en voorwerpeigenschappen, eenvoudige scheidingstechnieken, stof- en energieveranderingen door chemische reacties"
      },
      {
          "id": "MW33",
          "codes": {
              "MW": "MW33"
          },
          "bloom": "analyseren",
          "rubriek": "Onderzoek in natuurwetenschappen",
          "text": "De leerlingen voeren een onderzoek uit in fysica.",
          "concretisering": "zoals het onderscheid tussen lichtbronnen, onderzoeken van licht, serie- en parallelschakeling, onderzoek naar evenwicht, hefbomen, krachten, warmtetransport"
      },
      {
          "id": "SW22",
          "codes": {
              "TW": "SW22"
          },
          "bloom": "creëren",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen ontwikkelen 2D- en 3D-modellen van een prototype van een product.",
          "concretisering": "zoals vormgeving van gebruiksvoorwerpen, CAD-programma"
      },
      {
          "id": "SW23",
          "codes": {
              "TW": "SW23"
          },
          "bloom": "toepassen",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen realiseren een eenvoudige sturing of regeling die voldoet aan vooropgestelde criteria.",
          "concretisering": "zoals met gebruik van digitale of analoge signalen, gebruik van sensoren of actuatoren, feedbacksysteem, aan-uit regelprincipe"
      },
      {
          "id": "SW24",
          "codes": {
              "TW": "SW24"
          },
          "bloom": "analyseren",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen stellen een stappenplan op om een technisch systeem te realiseren op basis van een ontwerp.",
          "concretisering": "zoals methode, stappenplan, materiaal, hulpmiddelen"
      },
      {
          "id": "SW25",
          "codes": {
              "TW": "SW25"
          },
          "bloom": "analyseren",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen onderzoeken kenmerken van materialen en grondstoffen in functie van een opdracht of ontwerp.",
          "concretisering": "onderzoek van eigenschappen van aangereikte materialen, soorten bewegingen, soorten bereidingen"
      },
      {
          "id": "SW26",
          "codes": {
              "TW": "SW26"
          },
          "bloom": "analyseren",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen onderzoeken een bestaande eenvoudige sturing of regeling van een systeem.",
          "concretisering": "zoals mechanische, elektrische, elektronische, besturingstechnische systemen"
      },
      {
          "id": "SW27",
          "codes": {
              "TW": "SW27"
          },
          "bloom": "creëren",
          "rubriek": "Technologische wetenschappen",
          "text": "De leerlingen ontwerpen een realisatie met aangereikte criteria.",
          "concretisering": "zoals met een hernieuwbare energiebron, een bewegend voorwerp, een constructie, een sturing, een regeling"
      },
      {
          "id": "SW28",
          "codes": {
              "TW": "SW28"
          },
          "bloom": "toepassen",
          "rubriek": "Biochemische wetenschappen",
          "text": "De leerlingen ontwikkelen een product van natuurlijke oorsprong.",
          "concretisering": "zoals een voedingsmiddel, een cosmetisch product, een batterij, bioplastic"
      },
      {
          "id": "SW29",
          "codes": {
              "TW": "SW29"
          },
          "bloom": "analyseren",
          "rubriek": "Biochemische wetenschappen",
          "text": "De leerlingen onderzoeken een probleem in biologie, chemie of fysica.",
          "concretisering": "zoals bereidingen van voedingsmiddelen of medicijnen, zuivering van water of bodem, beweging van organismen, invloed van biotische en abiotische factoren, aanwezigheid van stoffen"
      },
      {
          "id": "SW30",
          "codes": {
              "TW": "SW30"
          },
          "bloom": "creëren",
          "rubriek": "Bouwtechnische wetenschappen",
          "text": "De leerlingen ontwerpen 2D- en 3D-modellen van een prototype van een constructie.",
          "concretisering": "zoals hout- en bouw, architectuur, ruimtelijke ordening"
      },
      {
          "id": "SW31",
          "codes": {
              "TW": "SW31"
          },
          "bloom": "toepassen",
          "rubriek": "Bouwtechnische wetenschappen",
          "text": "De leerlingen realiseren een constructie die voldoet aan vooropgestelde criteria.",
          "concretisering": "zoals dimensies, kwaliteitseisen, veiligheids- en duurzaamheidseisen"
      },
      {
          "id": "SW32",
          "codes": {
              "TW": "SW32"
          },
          "bloom": "analyseren",
          "rubriek": "Bouwtechnische wetenschappen",
          "text": "De leerlingen onderzoeken constructies en verbindingen in functie van een probleem of behoefte.",
          "concretisering": "zoals constructies, installaties, transportsystemen, structuren, overbrenging"
      },
      {
          "id": "SW33",
          "codes": {
              "TW": "SW33"
          },
          "bloom": "analyseren",
          "rubriek": "Communicatie- en informatietechnologie",
          "text": "De leerlingen onderzoeken bestaande communicatiesystemen in functie van een probleem of behoefte.",
          "concretisering": "zoals applicaties, mens-machine-interface, een algoritme"
      },
      {
          "id": "AL01",
          "codes": {
              "TW": "AL01",
              "MW": "AL01"
          },
          "bloom": "toepassen",
          "rubriek": "Algemeen",
          "text": "De leerlingen passen de ergonomische principes toe.",
          "concretisering": "zoals het aannemen van een ergonomische lichaamshouding tijdens het staan of zitten, of bij het heffen en tillen de principes van de rughygiëne toepassen"
      },
      {
          "id": "AL02",
          "codes": {
              "TW": "AL02",
              "MW": "AL02"
          },
          "bloom": "toepassen",
          "rubriek": "Algemeen",
          "text": "De leerlingen passen digitale vaardigheden functioneel toe.",
          "concretisering": "zoals instructietaal, het gebruiken van de correcte benaming van producten, onderdelen van toestellen, gereedschappen, materialen, middelen en technieken gebruikt in de sector",
          "concretiseringPer": {
              "MW": "zoals digitale vaardigheden inzetten bij het onderzoeken, ontwerpen, communiceren, realiseren en creëren, bij het digitaal opzoeken en selecteren van informatie, bij het digitaal presenteren"
          }
      },
      {
          "id": "AL03",
          "codes": {
              "TW": "AL03",
              "MW": "AL03"
          },
          "bloom": "toepassen",
          "rubriek": "Algemeen",
          "text": "De leerlingen zetten vakterminologie correct in bij het oplossen van opdrachten.",
          "concretisering": "zoals instructietaal, het gebruiken van de correcte benaming van producten, onderdelen van toestellen, gereedschappen, materialen, middelen en technieken gebruikt in de sector"
      },
      {
          "id": "AL04",
          "codes": {
              "TW": "AL04",
              "MW": "AL04"
          },
          "bloom": "toepassen",
          "rubriek": "Algemeen",
          "text": "De leerlingen passen sociale en communicatieve vaardigheden toe.",
          "concretisering": "zoals het respectvol communiceren met leraar of medeleerling, het ondersteunen van medeleerlingen tijdens groepswerk"
      }
  ],
}



/* --- opzoeken --- */

function yearHasGoals(year) {
  return !!GOALS[year];
}

function goalsForYear(year) {
  return GOALS[year] || [];
}

function findGoal(year, id) {
  var list = GOALS[year];
  if (!list) return null;
  var hit = null;
  list.forEach(function (g) {
    if (g.id === id) hit = g;
  });
  return hit;
}



/* "SW01 / MW13", of gewoon "MW15" bij een doel uit één leerplan. */
function goalCodeLabel(goal) {
  if (!goal) return "";
  var codes = goalPackages(goal).map(function (p) { return goal.codes[p]; });
  // De algemene doelen dragen in beide leerplannen dezelfde code;
  // "AL01 / AL01" zou alleen maar verwarren.
  var unique = codes.filter(function (c, i) { return codes.indexOf(c) === i; });
  return unique.join(" / ");
}

function goalPackages(goal) {
  if (!goal) return [];
  return Object.keys(GOAL_PACKAGES).filter(function (p) { return goal.codes[p]; });
}

function goalInBothPlans(goal) {
  return goalPackages(goal).length > 1;
}



/* Zoekt op elke code die het doel draagt, en op de tekst. */
function goalMatches(goal, needle) {
  if (!needle) return true;
  var hay = [goal.text, goal.concretisering, goal.rubriek, goal.bloom]
    .concat(Object.keys(goal.codes).map(function (p) { return goal.codes[p]; }))
    .join(" ");
  if (goal.concretiseringPer) {
    Object.keys(goal.concretiseringPer).forEach(function (p) {
      hay += " " + goal.concretiseringPer[p];
    });
  }
  return hay.toLowerCase().indexOf(String(needle).toLowerCase()) !== -1;
}



/* Oude koppelingen ("TW|SW05", "MW|MW19") omzetten naar de nieuwe id. */
function migrateGoalKey(year, key) {
  var raw = String(key || "");
  if (raw.indexOf("|") === -1) return raw;
  var code = raw.split("|")[1];
  var hit = null;
  (GOALS[year] || []).forEach(function (g) {
    Object.keys(g.codes).forEach(function (p) {
      if (g.codes[p] === code) hit = g.id;
    });
  });
  return hit || code;
}
