/* AI-hulp bij het opstellen en nakijken van rubrics. Afgesplitst uit
   js/evaluations.js (1.19.1), grondig herwerkt in 1.24.0. */

/* ------------------------------------------------------------------
   AI-HULP
   Geen sleutel, geen server: de tool bouwt een prompt, de leerkracht
   plakt die in een AI-gesprek dat hij toch al heeft (Claude, ChatGPT,
   …), en plakt het antwoord terug. Er verlaat nooit iets automatisch
   dit toestel.

   Drie standen:
   - "nieuw": criteria laten maken op basis van de opdracht en een paar
     optionele contextvragen;
   - "omzetten" (sinds 1.27.0): een bestaande evaluatiefiche of een stuk
     cursus (bestand of geplakte tekst, zie js/ai-source.js) laten
     omzetten naar criteria volgens dezelfde regels als "nieuw";
   - "nakijken": de huidige rubric laten verbeteren. Het aantal criteria
     en niveaus blijft gelijk; de leerkracht ziet eerst per criterium wat
     er verandert en kiest wat ze overneemt.

   Waarom de prompt zo opgebouwd is (zie ook HANDOFF.md):
   - Vast aantal niveaus met vaste labels uit de tool (LEVEL_TEMPLATES).
     Een criterium met meer niveaus zou anders ongewild zwaarder wegen,
     want de score is het niveaunummer.
   - Een expliciete lat: het niveau "doel behaald" beschrijft het
     leerplandoel op zijn Bloom-niveau; erboven gaat verder, eronder
     toont wat ontbreekt.
   - Kwaliteitsregels voor criteria en niveaus, en een zelfcontrole vóór
     het antwoord.
   - Leerlingentaal (sinds 1.25.0): de leerlingen lezen de rubric zelf.
     De prompt noemt hun leeftijd (AGE_BY_YEAR) en vraagt de je-vorm,
     korte zinnen en alledaagse woorden.
   - Feedbackbouwstenen per niveau (sinds 1.25.0), in je-vorm: een
     feedbackzin (option.say), een volgende stap (option.next) en op het
     hoogste niveau een uitdaging (ook in option.next). De feedback in
     Skore (js/feedback.js) bouwt daarmee zijn tekst.
   - Geen enkele gedachtestreep in de prompt: modellen nemen de stijl van
     de vraag over.
   ------------------------------------------------------------------ */

/* Een criterium dat nog exact is zoals blankRubric() het opleverde:
   geen naam, geen omschrijving, geen enkel niveau ingevuld. Enkel dán
   mag AI-import het stilzwijgend vervangen. Bij de kleinste twijfel
   (er staat al iets in) laten we het met rust. */
function isUntouchedRubric(rubric) {
  if (rubric.name && rubric.name.trim()) return false;
  if (rubric.description && rubric.description.trim()) return false;
  return (rubric.options || []).every(function (o) {
    return (!o.desc || !o.desc.trim()) && (!o.next || !String(o.next).trim()) &&
      (!o.say || !String(o.say).trim());
  });
}

/* Lijst "a, b en c". */
function joinWithEn(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " en " + list[list.length - 1];
}

/* De contextregels: enkel wat echt ingevuld is. */
function aiContextLines(ctx, mode) {
  ctx = ctx || {};
  var lines = [];
  var evaluate = String(ctx.evaluate || "").trim();
  if (evaluate) lines.push("Wat ik wil evalueren: " + evaluate.replace(/[.\s]+$/, "") + ".");
  var deliver = (ctx.deliver || []).slice();
  var other = String(ctx.deliverOther || "").trim();
  if (other) deliver.push(other);
  if (deliver.length) lines.push("Wat de leerlingen afleveren: " + joinWithEn(deliver) + ".");
  if (ctx.workform) lines.push("Werkvorm: " + ctx.workform + ".");
  if (ctx.time) lines.push("Lestijd: " + ctx.time + ".");
  var prior = String(ctx.prior || "").trim();
  if (prior) lines.push("Wat ze vooraf al leerden of oefenden: " + prior.replace(/[.\s]+$/, "") + ".");
  if (mode !== "nakijken" && mode !== "omzetten" && evaluate) {
    lines.push(ctx.extraCriteria === false
      ? "Beperk je tot de aspecten die ik noemde."
      : "Je mag ook criteria voorstellen die ik niet noemde, als ze nodig zijn om de opdracht goed te beoordelen.");
  }
  return lines;
}

/* Leeftijd per leerjaar, voor de prompt. Een leerjaar dat hier niet in
   staat, krijgt geen leeftijd in de prompt. */
var AGE_BY_YEAR = { "1ste jaar": "12 tot 13 jaar", "2de jaar": "13 tot 14 jaar" };

/* "een leerling van 12 tot 13 jaar", of "een leerling" zonder leeftijd. */
function aiPupil(year) {
  return AGE_BY_YEAR[year] ? "een leerling van " + AGE_BY_YEAR[year] : "een leerling";
}

var AI_QUALITY_RULES = [
  "Eén aspect per criterium. Een criterium meet nooit twee dingen tegelijk.",
  "Elk niveau is concreet en waarneembaar: wat zie of lees je in het werk van de leerling? Gebruik geen vage woorden zoals \"goed\", \"voldoende\" of \"correct\" zonder te zeggen wat je dan precies ziet.",
  "Elk niveau beschrijft wat er wel is, niet enkel wat ontbreekt. Ook het laagste niveau.",
  "De niveaus zijn parallel: van niveau tot niveau verandert telkens hetzelfde aspect, met dezelfde zinsbouw. Zo ziet een leerling meteen wat het verschil maakt.",
  "Geen criteria over de persoon, zoals inzet, houding of motivatie. Wel over het proces: hoe de leerling testte, bijstuurde of keuzes verantwoordde.",
  "Bevat de opdracht een ontwerp- of onderzoekscyclus, neem dan minstens één procescriterium op.",
  "Houd elke omschrijving op 1 of 2 zinnen.",
  "Gebruik nergens een gedachtestreep. Schrijf gewone zinnen met punten en komma's.",
];

/* Taalregels voor een rubric die leerlingen zelf lezen (sinds 1.25.0).
   De verwijzing naar wat ze vooraf leerden staat er enkel als de
   leerkracht dat in de context invulde. */
function aiLanguageRules(hasPrior) {
  return [
    "De naam van een criterium zegt concreet wat de leerling in deze opdracht maakte of deed, in hoogstens vijf gewone woorden. " +
      "Schrijf \"Je voorspellingen vooraf\" of \"Je filmpjes van het ei\", niet \"Voorspellen\" of \"Observatie\". " +
      "Een leerling moet weken later nog weten waarover het gaat.",
    "De beschrijving van een criterium zegt in één zin wat de leerling moet kunnen of tonen.",
    "Schrijf elk niveau in de je-vorm: wat toont de leerling in het werk? Bijvoorbeeld: \"Je schrijft vooraf op wat je verwacht te zien en waarom.\"",
    "Korte zinnen: hoogstens 15 woorden, één idee per zin.",
    (hasPrior
      ? "Gebruik alledaagse woorden. Een vakterm mag enkel als de leerlingen die in de les leerden (zie \"Wat ze vooraf al leerden of oefenden\")."
      : "Gebruik alledaagse woorden en vermijd vaktermen.") +
      " Geen abstracte woorden zoals \"adequaat\", \"coherent\", \"relevant\", \"optimaal\", \"systematisch\" of \"correct\".",
    "Schrijf actief: \"je meet\", niet \"er wordt gemeten\".",
  ];
}

/* De huidige rubric als json, voor de stand "nakijken". */
function rubricsForAiReview(rubrics, year) {
  return {
    criteria: rubrics.map(function (r) {
      var target = rubricTargetScore(r, true);
      var out = { id: r.id, naam: r.name || "", beschrijving: r.description || "" };
      if (yearHasGoals(year)) {
        out.leerplandoelen = (r.goals || []).map(function (k) { return k; });
      }
      var opts = (r.options || []).slice().sort(function (a, b) { return Number(a.score) - Number(b.score); });
      if (target !== null) {
        opts.forEach(function (o, i) { if (Number(o.score) === target) out.doelNiveau = i + 1; });
      }
      out.niveaus = opts.map(function (o, i) {
        var n = { label: o.label || "", omschrijving: o.desc || "", feedbackZin: o.say || "" };
        if (i < opts.length - 1) n.volgendeStap = o.next || "";
        else n.uitdaging = o.next || "";
        return n;
      });
      return out;
    }),
  };
}

/* Het bestaande materiaal voor de stand "omzetten". Gedachtestreepjes
   worden een dubbelpunt ("4 – Uitstekend" wordt "4: Uitstekend"):
   modellen nemen de stijl van de vraag over, en de rubric mag er geen
   bevatten. Drie backticks zouden het tekstblok in de prompt sluiten. */
function sourceForPrompt(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*[\u2014\u2013][ \t]*/g, ": ")
    .replace(/`{3,}/g, "``")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* Regels voor het omzetten van bestaand materiaal (sinds 1.27.0). */
function aiConvertRules(levels) {
  return [
    "Het materiaal staat onderaan bij BESTAAND MATERIAAL. Tabellen staan er als rijen, met | tussen de cellen.",
    "Staat achter een cel \"(over 2 kolommen)\", dan loopt die cel over zoveel kolommen. Bijvoorbeeld: één omschrijving geldt " +
      "dan voor twee niveaus. Staat dezelfde tekst in de eerste kolom van meerdere rijen, dan horen die rijen bij hetzelfde onderdeel.",
    "Is het een evaluatiefiche of een rubric, neem dan de criteria over die erin staan. Behoud wat de leerkracht wil beoordelen " +
      "en de concrete details, zoals aantallen, materialen en stappen.",
    "Is het een stuk cursus, een opdracht of een werkblad, maak dan 4 tot 7 criteria voor wat de leerlingen daarin maken of doen.",
    "Meet één rij twee dingen tegelijk, splits ze dan in twee criteria. Meten twee rijen hetzelfde, voeg ze dan samen.",
    "Komt hetzelfde criterium terug in verschillende onderdelen (een fase, een hoek, een post), noem het onderdeel dan in de naam " +
      "of de beschrijving, zodat elk criterium herkenbaar blijft.",
    "Het materiaal heeft misschien andere niveaus (bijvoorbeeld Zeer goed, Goed, Zwak, Zeer zwak), of per rij een ander aantal. " +
      "Zet elk criterium om naar precies " + levels + " niveaus met de vaste namen hieronder. Schrijf ontbrekende niveaus zelf bij, in dezelfde lijn.",
    "Staat het materiaal in de ik-vorm (een zelfevaluatie) of spreekt het over \"de leerling\", schrijf het dan in de je-vorm.",
    "Laat vakken voor naam, klas, nummer, datum, punten en opmerkingen weg.",
    "Voldoet iets niet aan de kwaliteitsregels, zoals een criterium over de persoon, herschrijf het dan naar iets wat je ziet in " +
      "het werk of de aanpak. Lukt dat niet, neem het dan niet over en zet het in \"nietOvergenomen\" met de reden.",
  ];
}

/* opts: { year, description, levels, context, mode, rubrics, source }
   Oude aanroep (beschrijving, leerjaar) blijft werken. */
function buildAiRubricPrompt(opts, legacyYear) {
  if (typeof opts === "string") opts = { description: opts, year: legacyYear };
  var year = opts.year;
  var review = opts.mode === "nakijken";
  var convert = opts.mode === "omzetten";
  var source = convert ? sourceForPrompt(opts.source) : "";
  var levels = LEVEL_TEMPLATES[opts.levels] ? opts.levels : DEFAULT_LEVEL_COUNT;
  var labels = LEVEL_TEMPLATES[levels];
  var target = LEVEL_TARGETS[levels];
  var goals = yearHasGoals(year) ? goalsForYear(year) : [];
  var description = String(opts.description || "").trim();
  var ageNote = AGE_BY_YEAR[year] ? " (" + AGE_BY_YEAR[year] + ")" : "";
  var pupil = aiPupil(year);
  var hasPrior = !!String((opts.context && opts.context.prior) || "").trim();

  var lines = [];
  if (review) {
    lines.push(
      "Ik ben leerkracht STEM in het secundair onderwijs in Vlaanderen. Kijk de beoordelingsrubric " +
        "hieronder na, voor leerlingen uit het " + year + ageNote + ", en verbeter ze volgens de regels in deze vraag.",
    );
  } else if (convert) {
    lines.push(
      "Ik ben leerkracht STEM in het secundair onderwijs in Vlaanderen. Zet het bestaande materiaal hieronder " +
        "(een evaluatiefiche of een stuk cursus) om naar een beoordelingsrubric voor leerlingen uit het " + year + ageNote +
        ", volgens de regels in deze vraag.",
    );
  } else {
    lines.push(
      "Ik ben leerkracht STEM in het secundair onderwijs in Vlaanderen. Help me een beoordelingsrubric " +
        "opstellen voor leerlingen uit het " + year + ageNote + ".",
    );
  }

  if (description) lines.push("", "OPDRACHT", "\"" + description + "\"");

  var ctx = aiContextLines(opts.context, review ? "nakijken" : convert ? "omzetten" : "nieuw");
  if (ctx.length) lines.push.apply(lines, ["", "CONTEXT"].concat(ctx));

  if (convert) {
    lines.push("", "OMZETTEN");
    aiConvertRules(levels).forEach(function (r, i) { lines.push((i + 1) + ". " + r); });
  }

  lines.push("", "NIVEAUS");
  if (review) {
    lines.push(
      "Behoud bij elk criterium het aantal niveaus en hun namen (\"label\"). Het niveau \"doel behaald\" " +
        "staat per criterium bij \"doelNiveau\" (het nummer van het niveau, van laag naar hoog).",
      "Behoud van elk criterium het \"id\". Voeg geen criteria toe en verwijder er geen.",
      "Herschrijf namen, beschrijvingen en omschrijvingen in leerlingentaal (zie LEERLINGENTAAL). Vul ontbrekende " +
        "feedbackzinnen, volgende stappen en uitdagingen aan (zie FEEDBACKZINNEN). Wat de regels hieronder al " +
        "volgt, mag blijven zoals het is.",
    );
  } else {
    lines.push("Elk criterium krijgt precies " + levels + " niveaus, van laag naar hoog:");
    labels.forEach(function (l, i) {
      lines.push((i + 1) + ". " + l + (i + 1 === target ? " (doel behaald)" : ""));
    });
    lines.push("De namen van de niveaus liggen vast. Jij schrijft enkel de omschrijvingen.");
  }

  var targetName = review ? "Het niveau \"doel behaald\"" : "Niveau " + target + " (" + labels[target - 1] + ")";
  lines.push("", "DE LAT");
  if (goals.length) {
    lines.push(targetName + " beschrijft wat een leerling toont die het gekoppelde leerplandoel behaalt, op het Bloom-niveau van dat doel.");
  } else {
    lines.push(targetName + " beschrijft wat je minimaal verwacht om de opdracht geslaagd te noemen.");
  }
  lines.push(
    "De niveaus erboven beschrijven werk dat verder gaat dan het doel.",
    "De niveaus eronder tonen wat nog ontbreekt om het doel te halen.",
  );

  lines.push("", "KWALITEITSREGELS");
  var rules = (review || convert ? [] : ["Maak 4 tot 7 criteria die samen de opdracht dekken."]).concat(AI_QUALITY_RULES);
  rules.forEach(function (r, i) { lines.push((i + 1) + ". " + r); });

  lines.push("", "LEERLINGENTAAL",
    "De leerlingen lezen deze rubric zelf. Schrijf zo dat " + pupil + " elk niveau begrijpt zonder uitleg.");
  aiLanguageRules(hasPrior).forEach(function (r, i) { lines.push((i + 1) + ". " + r); });

  lines.push(
    "", "FEEDBACKZINNEN",
    "Schrijf bij elk niveau ook korte zinnen voor de leerling, in de je-vorm:",
    "- \"feedbackZin\": wat de leerling op dit niveau toonde, concreet over de taak of de aanpak. Geen lof " +
      "over de persoon. Bijvoorbeeld: \"Je hebt drie proeven gedaan, maar je schreef niet op wat je verwachtte.\"",
    "- \"volgendeStap\", bij elk niveau behalve het hoogste: wat de leerling concreet moet doen om het " +
      "volgende niveau te halen. Bijvoorbeeld: \"Schrijf bij je hypothese vooraf op welk verschil je verwacht te meten.\"",
    "- \"uitdaging\", enkel bij het hoogste niveau: één concrete stap om nog verder te gaan.",
    "Elke zin is duidelijk zonder de rubric erbij: noem concreet wat de leerling maakte of deed, zoals de " +
      "voorspelling, de tabel of de filmpjes. Schrijf dus niet \"Je deed alle stappen\" of \"Zet de volgende stap\".",
    "Deze zinnen volgen dezelfde taalregels. Ze bevatten geen naam, geen tijdelijke aanduiding zoals {naam}, " +
      "geen punten en geen namen van niveaus. Ze kloppen voor elke leerling op dat niveau.",
  );

  if (goals.length) {
    lines.push(
      "", "LEERPLANDOELEN",
      "Koppel bij elk criterium de leerplandoelen uit de lijst hieronder die er inhoudelijk bij aansluiten, " +
        "met hun code. Forceer geen zwakke match: een criterium zonder doel mag.",
      "Zet in \"ookPassend\" de doelen die goed bij deze opdracht passen maar door geen enkel criterium " +
        "gedekt worden, met één korte zin uitleg per doel.",
      "Zet in \"zonderDoel\" de aspecten die ik wil evalueren maar die bij geen enkel doel passen.",
      "",
      "Leerplandoelen (code [Bloom-niveau]: doel):",
    );
    goals.forEach(function (g) { lines.push(g.id + " [" + g.bloom + "]: " + g.text); });
  }

  if (convert) {
    lines.push("", "BESTAAND MATERIAAL", "```text", source, "```");
  }

  if (review) {
    lines.push("", "HUIDIGE RUBRIC", "```json", JSON.stringify(rubricsForAiReview(opts.rubrics || [], year), null, 2), "```");
  }

  lines.push("", "ZELFCONTROLE", "Loop voor je antwoordt deze lijst na en verbeter je rubric waar nodig:");
  var checks = review
    ? ["Heeft elk criterium nog hetzelfde id en evenveel niveaus als in de huidige rubric?"]
    : ["Heeft elk criterium precies " + levels + " niveaus?"];
  if (convert) {
    checks.push("Staat alles wat het materiaal beoordeelt in een criterium, of in \"nietOvergenomen\" met de reden?");
  }
  checks = checks.concat([
    "Meet elk criterium één aspect?",
    "Is elk niveau waarneembaar, en beschrijft het wat er wel is?",
    "Zijn de niveaus parallel?",
  ]);
  if (goals.length) {
    checks.push(review
      ? "Sluit het niveau \"doel behaald\" aan bij het Bloom-niveau van het gekoppelde doel?"
      : "Sluit niveau " + target + " aan bij het Bloom-niveau van het gekoppelde doel?");
  }
  checks.push(
    "Kan " + pupil + " elk niveau lezen en zeggen: dit zie ik in mijn werk, of dit zie ik er niet in?",
    "Staat elk niveau in de je-vorm, met korte zinnen en alledaagse woorden?",
    "Begrijpt een leerling elke naam en elke feedbackzin ook weken later, zonder de rubric erbij?",
    "Heeft elk niveau een feedbackZin, elk niveau behalve het hoogste een volgendeStap, en het hoogste niveau een uitdaging?",
    "Staat er in de feedbackzinnen geen naam, geen punt en geen naam van een niveau?",
    "Staat er nergens een gedachtestreep?",
  );
  checks.forEach(function (c) { lines.push("- " + c); });

  lines.push(
    "", "ANTWOORD",
    "Antwoord alleen met een json-blok in exact dit formaat, zonder tekst ervoor of erna:",
    "", "```json", "{", "  \"criteria\": [", "    {",
  );
  if (review) lines.push("      \"id\": \"het id uit de huidige rubric\",");
  lines.push(
    "      \"naam\": \"Naam van het criterium\",",
    "      \"beschrijving\": \"Wat dit criterium meet, in één zin\",",
  );
  if (goals.length) lines.push("      \"leerplandoelen\": [\"SW05\"],");
  lines.push("      \"niveaus\": [");
  var exampleCount = review ? 3 : levels;
  for (var i = 1; i <= exampleCount; i++) {
    var level = "        { \"omschrijving\": \"Je-vorm: wat de leerling toont bij niveau " + i + "\", " +
      "\"feedbackZin\": \"Je-vorm: wat de leerling toonde\", ";
    lines.push(i < exampleCount
      ? level + "\"volgendeStap\": \"Je-vorm: wat de leerling nu doet\" },"
      : level + "\"uitdaging\": \"Je-vorm: hoe de leerling nog verder gaat\" }");
  }
  var tail = [];
  if (goals.length) {
    tail.push(
      "  \"ookPassend\": [ { \"doel\": \"SW12\", \"uitleg\": \"Waarom dit doel bij de opdracht past\" } ]",
      "  \"zonderDoel\": [ \"Aspect dat bij geen enkel doel past\" ]",
    );
  }
  if (convert) {
    tail.push("  \"nietOvergenomen\": [ { \"onderdeel\": \"Wat in het materiaal stond\", \"reden\": \"Waarom je het niet overnam\" } ]");
  }
  lines.push("      ]", "    }", "  ]" + (tail.length ? "," : ""));
  tail.forEach(function (t, i) { lines.push(t + (i < tail.length - 1 ? "," : "")); });
  lines.push("}", "```");
  if (review) lines.push("", "Geef elk criterium evenveel niveaus als in de huidige rubric, ook als dat meer of minder is dan in dit voorbeeld.");

  return lines.join("\n");
}

/* Zoekt een JSON-blok in de geplakte tekst, ook als de AI er nog wat
   proza voor of na zette, of het in ```json … ``` verpakte. */
function extractJsonBlock(text) {
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  var candidate = fenced ? fenced[1] : text;
  var start = candidate.indexOf("{");
  var end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}

function readAiJson(text) {
  var jsonText = extractJsonBlock(text);
  if (!jsonText) {
    throw new Error("Geen json-blok gevonden. Zorg dat je het hele antwoord plakt, inclusief de accolades.");
  }
  var data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("De json kon niet gelezen worden (" + e.message + "). Vraag de AI om enkel geldige json terug te geven.");
  }
  if (!data || !Array.isArray(data.criteria) || !data.criteria.length) {
    throw new Error("Verwacht een lijst \"criteria\" met minstens één criterium, maar die ontbreekt of is leeg.");
  }
  return data;
}

/* Doelcodes van de AI omzetten naar sleutels; onbekende codes tellen. */
function aiGoalKeys(codes, year, counter) {
  var keys = [];
  if (!Array.isArray(codes) || !year) return keys;
  codes.forEach(function (code) {
    var g = findGoal(year, String(code || "").trim());
    if (g && keys.indexOf(g.id) === -1) keys.push(g.id);
    else if (code && !g) counter.skipped++;
  });
  return keys;
}

/* Zet het geplakte AI-antwoord om. Leest het nieuwe formaat (1.25.0:
   feedbackZin en uitdaging erbij), dat van 1.24.0 (volgendeStap,
   ookPassend, zonderDoel) en het oudste (label per niveau).
   De labels komen altijd uit de tool: de standaardreeks bij het aantal
   niveaus. Enkel voor een aantal zonder standaardreeks valt de tool
   terug op het label van de AI.
   Geeft { criteria, alsoFitting: [{goal, uitleg}], withoutGoal: [tekst],
   notTaken: [{part, reason}], goalsSkipped }. notTaken komt enkel van de
   stand "omzetten" (json "nietOvergenomen"). */
function parseAiRubricResponse(text, year, taken) {
  var data = readAiJson(text);
  var counter = { skipped: 0 };
  var used = (taken || []).slice();

  var criteria = data.criteria.map(function (c, i) {
    if (!c || !c.naam || !String(c.naam).trim()) {
      throw new Error("Criterium " + (i + 1) + " heeft geen naam.");
    }
    if (!Array.isArray(c.niveaus) || !c.niveaus.length) {
      throw new Error("Criterium \"" + c.naam + "\" heeft geen niveaus.");
    }
    var id = uniqueId(c.naam, used);
    used.push(id);
    var n = c.niveaus.length;
    var template = LEVEL_TEMPLATES[n];
    var options = c.niveaus.map(function (lv, li) {
      return {
        score: li + 1,
        label: template ? template[li] : String((lv && lv.label) || "Niveau " + (li + 1)).trim(),
        desc: String((lv && lv.omschrijving) || "").trim(),
        say: String((lv && lv.feedbackZin) || "").trim(),
        next: String((lv && (li < n - 1 ? lv.volgendeStap : lv.uitdaging)) || "").trim(),
      };
    });
    var r = {
      id: id,
      name: String(c.naam).trim(),
      description: String(c.beschrijving || "").trim(),
      options: options,
      goals: aiGoalKeys(c.leerplandoelen, year, counter),
    };
    if (template) r.targetScore = LEVEL_TARGETS[n];
    return r;
  });

  var linked = {};
  criteria.forEach(function (r) { r.goals.forEach(function (k) { linked[k] = true; }); });
  var alsoFitting = [];
  (Array.isArray(data.ookPassend) ? data.ookPassend : []).forEach(function (item) {
    var code = item && typeof item === "object" ? item.doel : item;
    var g = year ? findGoal(year, String(code || "").trim()) : null;
    if (!g) { if (code) counter.skipped++; return; }
    if (linked[g.id] || alsoFitting.some(function (a) { return a.goal.id === g.id; })) return;
    alsoFitting.push({ goal: g, uitleg: String((item && item.uitleg) || "").trim() });
  });
  var withoutGoal = (Array.isArray(data.zonderDoel) ? data.zonderDoel : [])
    .map(function (t) { return String((t && typeof t === "object" ? t.aspect || t.tekst : t) || "").trim(); })
    .filter(Boolean);

  var notTaken = (Array.isArray(data.nietOvergenomen) ? data.nietOvergenomen : [])
    .map(function (t) {
      if (t && typeof t === "object") {
        return { part: String(t.onderdeel || t.tekst || "").trim(), reason: String(t.reden || "").trim() };
      }
      return { part: String(t || "").trim(), reason: "" };
    })
    .filter(function (t) { return t.part || t.reason; });

  return {
    criteria: criteria, alsoFitting: alsoFitting, withoutGoal: withoutGoal,
    notTaken: notTaken, goalsSkipped: counter.skipped,
  };
}

/* Stand "nakijken": vergelijkt het antwoord met de huidige criteria.
   Koppelt op id, anders op plaats. Het aantal niveaus, de scores en de
   labels blijven die van de huidige rubric. Geeft per criterium
   { index, current, proposed, changes: [{what, was, wordt}], problem }. */
function buildAiReview(currentRubrics, text, year) {
  var data = readAiJson(text);
  var counter = { skipped: 0 };
  var byId = {};
  data.criteria.forEach(function (c) { if (c && c.id) byId[String(c.id)] = c; });

  var result = currentRubrics.map(function (cur, index) {
    var c = byId[cur.id] || (data.criteria[index] && !data.criteria[index].id ? data.criteria[index] : null);
    var item = { index: index, current: cur, proposed: null, changes: [], problem: "" };
    if (!c) { item.problem = "Geen voorstel voor dit criterium."; return item; }
    var opts = (cur.options || []).slice().sort(function (a, b) { return Number(a.score) - Number(b.score); });
    if (!Array.isArray(c.niveaus) || c.niveaus.length !== opts.length) {
      item.problem = "De AI gaf " + (Array.isArray(c.niveaus) ? c.niveaus.length : 0) + " niveaus in plaats van " +
        opts.length + ". Dit criterium blijft zoals het is.";
      return item;
    }
    var proposed = JSON.parse(JSON.stringify(cur));
    proposed.options = opts.map(function (o, i) {
      var lv = c.niveaus[i] || {};
      return {
        score: o.score,
        label: o.label,
        desc: String(lv.omschrijving || "").trim() || o.desc || "",
        say: String(lv.feedbackZin || "").trim() || o.say || "",
        next: String((i < opts.length - 1 ? lv.volgendeStap : lv.uitdaging) || "").trim() || o.next || "",
      };
    });
    if (c.naam && String(c.naam).trim()) proposed.name = String(c.naam).trim();
    if (typeof c.beschrijving === "string") proposed.description = c.beschrijving.trim();
    if (yearHasGoals(year) && Array.isArray(c.leerplandoelen)) proposed.goals = aiGoalKeys(c.leerplandoelen, year, counter);

    function diff(what, was, wordt) {
      if (String(was || "") !== String(wordt || "")) item.changes.push({ what: what, was: was || "", wordt: wordt || "" });
    }
    diff("Naam", cur.name, proposed.name);
    diff("Uitleg", cur.description, proposed.description);
    proposed.options.forEach(function (o, i) {
      diff("Niveau " + (i + 1) + " (" + o.label + ")", opts[i].desc, o.desc);
      diff("Feedbackzin bij niveau " + (i + 1), opts[i].say, o.say);
      diff((i < opts.length - 1 ? "Volgende stap" : "Uitdaging") + " bij niveau " + (i + 1), opts[i].next, o.next);
    });
    if (yearHasGoals(year)) {
      diff("Leerplandoelen", (cur.goals || []).join(", "), (proposed.goals || []).join(", "));
    }
    item.proposed = proposed;
    return item;
  });
  result.goalsSkipped = counter.skipped;
  return result;
}

function showNoticeIn(hostId, kind, title, body) {
  var host = $(hostId);
  host.innerHTML = "";
  var box = el("div", "notice " + kind);
  box.appendChild(el("strong", null, title));
  if (body) box.appendChild(document.createTextNode(body));
  host.appendChild(box);
}

/* ---- scherm ---- */

var aiMode = "nieuw";

/* Keuzeknoppen: aria-pressed is de waarde. Bij één keuze kan je een
   gekozen knop opnieuw aanklikken om hem uit te zetten (de vraag is
   optioneel), behalve bij data-required. */
function initChipGroup(id, onChange) {
  var group = $(id);
  var single = group.dataset.single === "1" || id === "aiLevels";
  var required = group.dataset.required === "1" || id === "aiLevels";
  group.querySelectorAll(".chip-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") === "true";
      if (single) {
        if (on && required) return;
        group.querySelectorAll(".chip-toggle").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      }
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      if (onChange) onChange();
    });
  });
}

function chipValues(id) {
  return Array.prototype.map.call($(id).querySelectorAll('.chip-toggle[aria-pressed="true"]'), function (b) {
    return b.dataset.value;
  });
}

function setChipValues(id, values) {
  $(id).querySelectorAll(".chip-toggle").forEach(function (b) {
    b.setAttribute("aria-pressed", values.indexOf(b.dataset.value) !== -1 ? "true" : "false");
  });
}

function aiChosenLevels() {
  return Number(chipValues("aiLevels")[0]) || DEFAULT_LEVEL_COUNT;
}

function aiContextFromForm() {
  return {
    evaluate: $("aiEvaluate").value,
    deliver: chipValues("aiDeliver"),
    deliverOther: $("aiDeliverOther").value,
    workform: chipValues("aiWorkform")[0] || "",
    time: chipValues("aiTime")[0] || "",
    prior: $("aiPrior").value,
    extraCriteria: chipValues("aiExtra")[0] !== "nee",
  };
}

function renderAiLevelLabels() {
  var n = aiChosenLevels();
  var host = $("aiLevelLabels");
  host.innerHTML = "";
  LEVEL_TEMPLATES[n].forEach(function (l, i) {
    if (i) host.appendChild(document.createTextNode(" · "));
    if (i + 1 === LEVEL_TARGETS[n]) host.appendChild(el("strong", null, l + " (doel behaald)"));
    else host.appendChild(document.createTextNode(l));
  });
}

/* Elk deel met data-ai-modes="nieuw omzetten" is enkel zichtbaar in die
   standen. */
function setAiMode(mode) {
  aiMode = mode;
  $("aiModeNew").setAttribute("aria-pressed", mode === "nieuw" ? "true" : "false");
  $("aiModeConvert").setAttribute("aria-pressed", mode === "omzetten" ? "true" : "false");
  $("aiModeReview").setAttribute("aria-pressed", mode === "nakijken" ? "true" : "false");
  document.querySelectorAll("#aiRubricHelper [data-ai-modes]").forEach(function (n) {
    n.classList.toggle("hidden", n.dataset.aiModes.split(" ").indexOf(mode) === -1);
  });
  $("btnAiImport").textContent = mode === "nakijken" ? "Voorstel bekijken" : "Criteria toevoegen aan deze evaluatie";
  $("aiPromptBlock").classList.add("hidden");
  $("aiPromptOut").value = "";
  $("aiImportState").innerHTML = "";
  $("aiImportResult").innerHTML = "";
}

/* Criteria met een naam: enkel die kunnen nagekeken worden. */
function reviewableRubrics() {
  return (draft ? draft.rubrics : []).filter(function (r) { return !isUntouchedRubric(r); });
}

function updateAiReviewAvailability() {
  var can = reviewableRubrics().length > 0;
  $("aiModeReview").disabled = !can;
  $("btnAiReview").disabled = !can;
  if (!can && aiMode === "nakijken") setAiMode("nieuw");
}

/* Reset bij het openen van een evaluatie in de editor. */
function resetAiRubricHelper() {
  ["aiDescription", "aiEvaluate", "aiDeliverOther", "aiPrior", "aiPromptOut", "aiResponseIn", "aiSource"].forEach(function (id) { $(id).value = ""; });
  $("aiSourceState").innerHTML = "";
  updateAiSourceHint();
  setChipValues("aiLevels", [String(DEFAULT_LEVEL_COUNT)]);
  setChipValues("aiDeliver", []);
  setChipValues("aiWorkform", []);
  setChipValues("aiTime", []);
  setChipValues("aiExtra", ["ja"]);
  renderAiLevelLabels();
  setAiMode("nieuw");
  $("aiRubricHelper").open = false;
  updateAiReviewAvailability();
}

function openAiReview() {
  $("aiRubricHelper").open = true;
  setAiMode("nakijken");
  $("aiRubricHelper").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Na het inlezen van nieuwe criteria: gekoppelde doelen, "ook passend"
   (met één klik koppelen of negeren), "zonder doel" en de controle. */
function renderAiImportResult(parsed, levels) {
  var host = $("aiImportResult");
  host.innerHTML = "";
  var box = el("div", "ai-result");

  if (yearHasGoals(draft.year)) {
    box.appendChild(el("h4", null, "Gekoppelde leerplandoelen"));
    var ul = el("ul", "ai-linked");
    parsed.criteria.forEach(function (r) {
      var codes = r.goals.map(function (k) { var g = findGoal(draft.year, k); return g ? goalCodeLabel(g) : k; });
      var li = el("li");
      li.appendChild(el("strong", null, r.name + ": "));
      li.appendChild(document.createTextNode(codes.length ? codes.join(", ") : "geen doel"));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  if (parsed.alsoFitting.length) {
    box.appendChild(el("h4", null, "Ook passend"));
    box.appendChild(el("p", "hint", "Deze doelen passen bij de opdracht, maar geen criterium dekt ze. Koppel ze aan een criterium, of negeer ze."));
    var list = el("div", "ai-also");
    parsed.alsoFitting.forEach(function (item) {
      var row = el("div", "ai-also-row");
      var text = el("div", "ai-also-text");
      var line = el("div");
      line.appendChild(el("span", "goal-code", goalCodeLabel(item.goal)));
      line.appendChild(bloomBadge(item.goal.bloom));
      line.appendChild(document.createTextNode(" " + item.goal.text));
      text.appendChild(line);
      if (item.uitleg) text.appendChild(el("div", "muted", item.uitleg));
      row.appendChild(text);

      var controls = el("div", "btn-row");
      var sel = document.createElement("select");
      sel.className = "ai-also-target";
      sel.setAttribute("aria-label", "Koppel " + item.goal.id + " aan criterium");
      sel.appendChild(new Option("Koppel aan criterium…", ""));
      draft.rubrics.forEach(function (r, i) {
        if (String(r.name || "").trim()) sel.appendChild(new Option((i + 1) + ". " + r.name, String(i)));
      });
      var link = el("button", "btn-ghost btn-small ai-also-link", "Koppelen");
      link.type = "button";
      link.addEventListener("click", function () {
        if (sel.value === "") { sel.focus(); return; }
        var r = draft.rubrics[Number(sel.value)];
        if (!r.goals) r.goals = [];
        if (r.goals.indexOf(item.goal.id) === -1) r.goals.push(item.goal.id);
        renderDraftRubrics();
        updateDraftSummary();
        row.innerHTML = "";
        row.appendChild(el("div", "muted", goalCodeLabel(item.goal) + " gekoppeld aan " + r.name + "."));
      });
      var ignore = el("button", "btn-ghost btn-small ai-also-ignore", "Negeren");
      ignore.type = "button";
      ignore.addEventListener("click", function () { row.remove(); });
      controls.appendChild(sel);
      controls.appendChild(link);
      controls.appendChild(ignore);
      row.appendChild(controls);
      list.appendChild(row);
    });
    box.appendChild(list);
  }

  if (parsed.withoutGoal.length) {
    box.appendChild(el("h4", null, "Zonder doel"));
    box.appendChild(el("p", "hint", "Deze aspecten wil je evalueren, maar ze passen bij geen enkel leerplandoel. Ter info."));
    var wl = el("ul", "ai-without");
    parsed.withoutGoal.forEach(function (t) { wl.appendChild(el("li", null, t)); });
    box.appendChild(wl);
  }

  if (parsed.notTaken && parsed.notTaken.length) {
    box.appendChild(el("h4", null, "Niet overgenomen"));
    box.appendChild(el("p", "hint", "Dit stond in je materiaal, maar de AI nam het niet over. Voeg het zelf toe als je het toch wil beoordelen."));
    var nl = el("ul", "ai-not-taken");
    parsed.notTaken.forEach(function (t) {
      var li = el("li");
      if (t.part) li.appendChild(el("strong", null, t.part + (t.reason ? ": " : "")));
      if (t.reason) li.appendChild(document.createTextNode(t.reason));
      nl.appendChild(li);
    });
    box.appendChild(nl);
  }

  var warnings = rubricWarnings(parsed.criteria, draft.year, levels);
  if (warnings.length) box.appendChild(renderWarningsBox(warnings, "Nakijken"));

  if (box.childNodes.length) host.appendChild(box);
}

function renderWarningsBox(warnings, title) {
  var box = el("div", "notice warn rubric-warnings");
  box.appendChild(el("strong", null, title + " (" + warnings.length + ")"));
  var ul = document.createElement("ul");
  warnings.forEach(function (w) { ul.appendChild(el("li", null, w)); });
  box.appendChild(ul);
  return box;
}

/* Stand "nakijken": per criterium wat er verandert, met een vinkje. */
function renderAiReviewResult(review) {
  var host = $("aiImportResult");
  host.innerHTML = "";
  var box = el("div", "ai-result ai-review");
  var changed = review.filter(function (r) { return r.changes.length; });

  review.forEach(function (item) {
    var card = el("div", "ai-review-card");
    var head = el("div", "ai-review-head");
    var title = (item.index + 1) + ". " + (item.current.name || "zonder naam");
    if (item.changes.length) {
      var lbl = el("label", "ai-review-take");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.index = String(item.index);
      lbl.appendChild(cb);
      lbl.appendChild(el("strong", null, " " + title));
      lbl.appendChild(el("span", "muted", " (overnemen)"));
      head.appendChild(lbl);
    } else {
      head.appendChild(el("strong", null, title));
      head.appendChild(el("span", "muted", item.problem ? " " + item.problem : " Geen wijzigingen."));
    }
    card.appendChild(head);
    item.changes.forEach(function (c) {
      var row = el("div", "ai-change");
      row.appendChild(el("div", "ai-change-what", c.what));
      var was = el("div", "ai-change-was");
      was.appendChild(el("span", "ai-change-tag", "Was: "));
      was.appendChild(document.createTextNode(c.was || "(leeg)"));
      var wordt = el("div", "ai-change-new");
      wordt.appendChild(el("span", "ai-change-tag", "Wordt: "));
      wordt.appendChild(document.createTextNode(c.wordt || "(leeg)"));
      row.appendChild(was);
      row.appendChild(wordt);
      card.appendChild(row);
    });
    box.appendChild(card);
  });

  if (changed.length) {
    var apply = el("button", "btn-primary", "Gekozen wijzigingen overnemen");
    apply.type = "button";
    apply.id = "btnAiApplyReview";
    apply.addEventListener("click", function () {
      var taken = 0;
      box.querySelectorAll(".ai-review-take input:checked").forEach(function (cb) {
        var item = review[Number(cb.dataset.index)];
        var target = draft.rubrics.indexOf(item.current);
        if (target === -1 || !item.proposed) return;
        draft.rubrics[target] = item.proposed;
        taken++;
      });
      renderDraftRubrics();
      updateDraftSummary();
      host.innerHTML = "";
      showNoticeIn(
        "aiImportState", "good",
        taken + (taken === 1 ? " criterium bijgewerkt" : " criteria bijgewerkt"),
        "Kijk alles na en klik op Evaluatie opslaan. Werd deze rubric al gebruikt, dan blijft de vorige tekst bewaard, zodat eerdere beoordelingen leesbaar blijven.",
      );
    });
    var row = el("div", "btn-row");
    row.style.marginTop = "12px";
    row.appendChild(apply);
    box.appendChild(row);
  }
  host.appendChild(box);
}

function initAiRubricHelper() {
  initChipGroup("aiLevels", renderAiLevelLabels);
  ["aiDeliver", "aiWorkform", "aiTime", "aiExtra"].forEach(function (id) { initChipGroup(id); });
  renderAiLevelLabels();
  initAiSource();
  $("aiModeNew").addEventListener("click", function () { setAiMode("nieuw"); });
  $("aiModeConvert").addEventListener("click", function () { setAiMode("omzetten"); });
  $("aiModeReview").addEventListener("click", function () { setAiMode("nakijken"); });
  $("btnAiReview").addEventListener("click", openAiReview);

  $("btnAiGeneratePrompt").addEventListener("click", function () {
    var desc = $("aiDescription").value.trim();
    if (aiMode === "nieuw" && !desc) {
      showNoticeIn("aiImportState", "warn", "Beschrijf eerst de opdracht", "Een paar zinnen volstaan. Hoe concreter, hoe beter de rubric.");
      return;
    }
    if (aiMode === "omzetten" && !$("aiSource").value.trim()) {
      showNoticeIn("aiImportState", "warn", "Voeg eerst je materiaal toe", "Kies een bestand of plak de tekst van je evaluatiefiche of cursus.");
      return;
    }
    var year = (draft && draft.year) || $("draftYear").value || "2de jaar";
    $("aiPromptOut").value = buildAiRubricPrompt({
      year: year,
      description: desc,
      levels: aiChosenLevels(),
      context: aiContextFromForm(),
      mode: aiMode,
      rubrics: reviewableRubrics(),
      source: $("aiSource").value,
    });
    $("aiPromptBlock").classList.remove("hidden");
    $("aiImportState").innerHTML = "";
  });

  $("btnAiCopyPrompt").addEventListener("click", function () {
    var field = $("aiPromptOut");
    function done() {
      showNoticeIn("aiImportState", "good", "Gekopieerd", "Plak dit in je AI-gesprek (Claude, ChatGPT, Copilot, …) en kom terug met het antwoord.");
    }
    function failed() {
      field.select();
      showNoticeIn("aiImportState", "warn", "Kopiëren lukte niet", "De tekst staat geselecteerd: druk Ctrl+C om hem zelf te kopiëren.");
    }
    copyText(field.value, done, failed);
  });

  $("btnAiImport").addEventListener("click", function () {
    var text = $("aiResponseIn").value;
    $("aiImportResult").innerHTML = "";
    if (!text.trim()) {
      showNoticeIn("aiImportState", "warn", "Plak eerst het antwoord van de AI", "");
      return;
    }

    if (aiMode === "nakijken") {
      var review;
      try {
        review = buildAiReview(reviewableRubrics(), text, draft.year);
      } catch (e) {
        showNoticeIn("aiImportState", "warn", "Kon dit niet inlezen", e.message);
        return;
      }
      var n = review.filter(function (r) { return r.changes.length; }).length;
      showNoticeIn(
        "aiImportState", n ? "info" : "good",
        n ? "Voorstel voor " + n + (n === 1 ? " criterium" : " criteria") : "Geen wijzigingen voorgesteld",
        n ? "Kies hieronder wat je overneemt. Er verandert nog niets tot je op de knop klikt." : "",
      );
      renderAiReviewResult(review);
      $("aiResponseIn").value = "";
      return;
    }

    var parsed;
    try {
      parsed = parseAiRubricResponse(text, draft.year, takenIds());
    } catch (e) {
      showNoticeIn("aiImportState", "warn", "Kon dit niet inlezen", e.message);
      return;
    }

    // Een nieuwe evaluatie start met één leeg criterium als startpunt
    // voor wie met de hand typt. Gebruikt de leerkracht in plaats
    // daarvan de AI-hulp, dan hoort dat lege criterium niet ernaast te
    // blijven staan. Enkel verwijderen als het echt nog helemaal
    // onaangeroerd is, nooit iets waar al aan gewerkt is.
    var verwijderd = 0;
    draft.rubrics = draft.rubrics.filter(function (r) {
      if (isUntouchedRubric(r)) { verwijderd++; return false; }
      return true;
    });

    var criteria = parsed.criteria;
    criteria.forEach(function (c) { draft.rubrics.push(c); });
    renderDraftRubrics();
    updateDraftSummary();

    var gekoppeld = criteria.reduce(function (n, c) { return n + c.goals.length; }, 0);
    var extra = [];
    if (gekoppeld) extra.push(gekoppeld + " leerplandoel(en) alvast gekoppeld. Controleer of ze kloppen.");
    if (parsed.goalsSkipped) extra.push(parsed.goalsSkipped + " voorgestelde code(s) van de AI niet herkend en genegeerd.");

    showNoticeIn(
      "aiImportState", "good",
      criteria.length + " criteria toegevoegd" + (verwijderd ? " (leeg startcriterium vervangen)" : ""),
      "Kijk de niveaus na en pas aan waar nodig. " + extra.join(" "),
    );
    renderAiImportResult(parsed, aiChosenLevels());
    $("aiResponseIn").value = "";
  });
}
