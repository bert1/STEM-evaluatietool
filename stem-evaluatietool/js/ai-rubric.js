/* AI-hulp bij het opstellen van rubrics. Afgesplitst uit
   js/evaluations.js (1.19.1). */

/* ------------------------------------------------------------------
   AI-HULP: RUBRIC GENEREREN OP BASIS VAN EEN BESCHRIJVING
   Geen sleutel, geen server: de tool bouwt een prompt, de leerkracht
   plakt die in een AI-gesprek dat hij toch al heeft (Claude, ChatGPT,
   …), en plakt het antwoord terug. Alles blijft lokaal — er verlaat
   nooit iets automatisch dit toestel.
   ------------------------------------------------------------------ */

/* Een criterium dat nog exact is zoals blankRubric() het opleverde:
   geen naam, geen omschrijving, geen enkel niveau ingevuld. Enkel dán
   mag AI-import het stilzwijgend vervangen — bij de kleinste twijfel
   (er staat al iets in) laten we het met rust. */
function isUntouchedRubric(rubric) {
  if (rubric.name && rubric.name.trim()) return false;
  if (rubric.description && rubric.description.trim()) return false;
  return (rubric.options || []).every(function (o) {
    return !o.desc || !o.desc.trim();
  });
}

function buildAiRubricPrompt(description, year) {
  var goals = yearHasGoals(year) ? goalsForYear(year) : [];

  var lines = [
    "Ik ben leerkracht STEM in het secundair onderwijs in Vlaanderen. Ik wil een " +
      "beoordelingsrubric opstellen voor de volgende opdracht, voor leerlingen uit " + year + ":",
    "",
    "\"" + description.trim() + "\"",
    "",
    "Maak een rubric met 4 tot 7 duidelijke, meetbare criteria die samen deze opdracht " +
      "dekken. Geef voor elk criterium 4 of 5 niveaus, van zwak naar sterk, met bij elk " +
      "niveau een concrete, waarneembare omschrijving van 1 tot 2 zinnen. Vermijd vage " +
      "woorden zoals \"goed\" of \"voldoende\" zonder uit te leggen wat je dan precies ziet.",
  ];

  if (goals.length) {
    lines.push(
      "",
      "Koppel daarnaast bij elk criterium de leerplandoelen (uit de lijst hieronder) die er " +
        "inhoudelijk bij aansluiten, met hun code (bijvoorbeeld \"SW05\"). Een criterium mag ook " +
        "geen enkel doel krijgen als er echt niets goed past. Verzin er dan liever geen bij dan " +
        "een zwakke match te forceren. Meerdere doelen per criterium mag.",
      "",
      "Leerplandoelen om uit te kiezen:",
    );
    goals.forEach(function (g) {
      lines.push(g.id + ": " + g.text);
    });
  }

  lines.push(
    "",
    "Antwoord ALLEEN met een JSON-blok in exact dit formaat, zonder tekst ervoor of erna:",
    "",
    "```json",
    "{",
    "  \"criteria\": [",
    "    {",
    "      \"naam\": \"Naam van het criterium\",",
    "      \"beschrijving\": \"Korte omschrijving van wat dit criterium meet\",",
  );
  if (goals.length) {
    lines.push("      \"leerplandoelen\": [\"SW05\"],");
  }
  lines.push(
    "      \"niveaus\": [",
    "        { \"label\": \"Onvoldoende\", \"omschrijving\": \"Concrete, waarneembare beschrijving\" },",
    "        { \"label\": \"Matig\", \"omschrijving\": \"…\" },",
    "        { \"label\": \"Voldoende\", \"omschrijving\": \"…\" },",
    "        { \"label\": \"Goed\", \"omschrijving\": \"…\" }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "```",
  );
  if (goals.length) {
    lines.push("", "Laat \"leerplandoelen\" gewoon weg bij een criterium waar niets bij past. Een lege lijst mag ook.");
  }

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

/* Zet het geplakte AI-antwoord om in criteria in het formaat dat de
   rubric-editor verwacht. Gooit een duidelijke, specifieke fout zodat
   de leerkracht weet wat er mis is, in plaats van een kale parsefout. */
function parseAiRubricResponse(text, year) {
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

  var taken = takenIds();
  var result = [];
  var goalsSkipped = 0;
  data.criteria.forEach(function (c, i) {
    if (!c || !c.naam || !String(c.naam).trim()) {
      throw new Error("Criterium " + (i + 1) + " heeft geen naam.");
    }
    if (!Array.isArray(c.niveaus) || !c.niveaus.length) {
      throw new Error("Criterium \"" + c.naam + "\" heeft geen niveaus.");
    }
    var id = uniqueId(c.naam, taken);
    taken.push(id);
    var options = c.niveaus.map(function (n, li) {
      return {
        score: li + 1,
        label: String((n && n.label) || "Niveau " + (li + 1)).trim(),
        desc: String((n && n.omschrijving) || "").trim(),
      };
    });

    // De AI koppelt met een code (bv. "SW05"); enkel codes die echt
    // bestaan voor dit leerjaar worden overgenomen. Een verzonnen of
    // verkeerd getypte code wordt gewoon genegeerd, niet als fout
    // behandeld — dat zou de hele import onnodig laten mislukken.
    var goalKeys = [];
    if (Array.isArray(c.leerplandoelen) && year) {
      c.leerplandoelen.forEach(function (code) {
        var g = findGoal(year, String(code || "").trim());
        if (g && goalKeys.indexOf(g.id) === -1) goalKeys.push(g.id);
        else if (code) goalsSkipped++;
      });
    }

    result.push({
      id: id,
      name: String(c.naam).trim(),
      description: String(c.beschrijving || "").trim(),
      options: options,
      goals: goalKeys,
    });
  });
  result.goalsSkipped = goalsSkipped;
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

function initAiRubricHelper() {
  $("btnAiGeneratePrompt").addEventListener("click", function () {
    var desc = $("aiDescription").value.trim();
    if (!desc) {
      showNoticeIn("aiImportState", "warn", "Beschrijf eerst de opdracht", "Een paar zinnen volstaan. Hoe concreter, hoe beter de rubric.");
      return;
    }
    var year = (draft && draft.year) || $("draftYear").value || "2de jaar";
    $("aiPromptOut").value = buildAiRubricPrompt(desc, year);
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
    if (!text.trim()) {
      showNoticeIn("aiImportState", "warn", "Plak eerst het antwoord van de AI", "");
      return;
    }

    var criteria;
    try {
      criteria = parseAiRubricResponse(text, draft.year);
    } catch (e) {
      showNoticeIn("aiImportState", "warn", "Kon dit niet inlezen", e.message);
      return;
    }

    // Een nieuwe evaluatie start met één leeg criterium als startpunt
    // voor wie met de hand typt. Gebruikt de leerkracht in plaats
    // daarvan de AI-hulp, dan hoort dat lege criterium niet ernaast te
    // blijven staan — enkel verwijderen als het echt nog helemaal
    // onaangeroerd is, nooit iets waar al aan gewerkt is.
    var verwijderd = 0;
    draft.rubrics = draft.rubrics.filter(function (r) {
      if (isUntouchedRubric(r)) { verwijderd++; return false; }
      return true;
    });

    criteria.forEach(function (c) { draft.rubrics.push(c); });
    renderDraftRubrics();
    updateDraftSummary();

    var gekoppeld = criteria.reduce(function (n, c) { return n + c.goals.length; }, 0);
    var extra = [];
    if (gekoppeld) extra.push(gekoppeld + " leerplandoel(en) alvast gekoppeld. Controleer of ze kloppen.");
    if (criteria.goalsSkipped) extra.push(criteria.goalsSkipped + " voorgestelde code(s) van de AI niet herkend en genegeerd.");

    showNoticeIn(
      "aiImportState", "good",
      criteria.length + " criteria toegevoegd" + (verwijderd ? " (leeg startcriterium vervangen)" : ""),
      "Kijk de niveaus na en pas aan waar nodig. " + extra.join(" "),
    );
    $("aiResponseIn").value = "";

    var cards = $("draftRubrics").querySelectorAll(".rubric-edit");
    var firstNew = cards[cards.length - criteria.length];
    if (firstNew) firstNew.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
