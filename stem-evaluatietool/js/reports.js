/* ---- overgenomen uit report.js ---- */

/* ------------------------------------------------------------------
   RAPPORT
   Eén blad per leerling: de criteria, welk niveau behaald is en wat
   dat niveau concreet beschrijft. Dat laatste is het punt — een cijfer
   zonder de omschrijving zegt niets bij een nabespreking of een
   doorlichting.

   Afdrukken gebeurt met de browser zelf. Kies daar "Opslaan als PDF".
   ------------------------------------------------------------------ */

/* De browser gebruikt document.title als voorstel voor de bestandsnaam
   bij "Opslaan als PDF" — er is geen andere haak om die naam te
   beïnvloeden. Daarom hier tijdelijk aanpassen en nadien terugzetten. */
function sanitizeFilename(s) {
  return String(s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function printReports(data, entries, single) {
  var host = $("printArea");
  host.innerHTML = "";

  // Leerjaar en evaluatie komen uit collectResults(), niet meer uit
  // filtervelden: het Controle-tabblad toont meerdere evaluaties tegelijk.
  var year = data.year;
  var evaluation = data.evaluation;
  var currentVersion = evaluationVersion(db, year, evaluation);
  var printed = new Date().toLocaleDateString("nl-BE", {
    day: "numeric", month: "long", year: "numeric",
  });

  entries.forEach(function (entry) {
    // De rubric zoals hij was toen deze leerling beoordeeld werd.
    var rubrics = rubricsForVersion(db, year, evaluation, entry.rubricVersion);
    var questions = questionsForVersion(db, year, evaluation, entry.rubricVersion);
    var max = maxScoreOf(rubrics);

    var page = el("div", "report");

    var head = el("div", "report-head");
    var left = el("div");
    left.appendChild(el("h1", null, entry.name));
    left.appendChild(el("div", "sub", entry.klas + " · " + evaluation));
    head.appendChild(left);

    var score = el("div", "report-score");
    score.appendChild(el("div", "big", entry.total + " / " + max));
    score.appendChild(el("div", "sub", (max > 0 ? Math.round((entry.total / max) * 100) : 0) + "%"));
    if (entry.correction) {
      var sign = entry.correction > 0 ? "+" + entry.correction : String(entry.correction);
      score.appendChild(el("div", "sub correction-note",
        "Groep " + entry.groupTotal + " " + sign + " individueel"));
    }
    head.appendChild(score);
    page.appendChild(head);

    var meta = el("div", "report-meta");
    meta.appendChild(el("span", null, "Beoordeeld door " + (entry.assessor || "onbekend")));
    if (entry.formative) {
      meta.appendChild(el("span", "flag", "Tussentijdse check — niet de eindbeoordeling"));
    }
    if (entry.groupSize > 1) {
      meta.appendChild(el("span", null,
        "Groepswerk (" + entry.groupSize + " leerlingen" +
          (entry.correction ? ", met individuele correctie" : ", gedeelde score") + ")"));
    }
    if (entry.rubricVersion && entry.rubricVersion !== currentVersion) {
      meta.appendChild(el("span", "flag", "Beoordeeld met rubricversie " + entry.rubricVersion + " (nu " + currentVersion + ")"));
    }
    meta.appendChild(el("span", null, "Afgedrukt op " + printed));
    page.appendChild(meta);

    var table = document.createElement("table");
    table.className = "report-table";
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var withGoals = yearHasGoals(year) && rubrics.some(function (r) { return (r.goals || []).length; });
    var cols = withGoals
      ? ["Criterium", "Leerplandoel", "Behaald niveau", "Wat dat betekent", "Score"]
      : ["Criterium", "Behaald niveau", "Wat dat betekent", "Score"];
    cols.forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rubrics.forEach(function (r) {
      var v = entry.scores[r.id];
      var chosen = null;
      (r.options || []).forEach(function (o) {
        if (Number(o.score) === v) chosen = o;
      });
      var rMax = rubricMaxScore(r);

      var tr = document.createElement("tr");

      var nameCell = el("td");
      nameCell.appendChild(el("strong", null, r.name));
      if (r.description) nameCell.appendChild(el("div", "muted", r.description));
      tr.appendChild(nameCell);

      if (withGoals) {
        var goalCell = el("td", "muted");
        var codes = (r.goals || []).map(function (k) {
          var g = findGoal(year, k);
          return g ? goalCodeLabel(g) : k;
        });
        goalCell.textContent = codes.length ? codes.join(", ") : "—";
        if (codes.length) {
          goalCell.title = (r.goals || []).map(function (k) {
            var g = findGoal(year, k);
            return g ? goalCodeLabel(g) + " (" + g.bloom + "): " + g.text : k;
          }).join("\n");
        }
        tr.appendChild(goalCell);
      }

      tr.appendChild(el("td", null, chosen ? chosen.label : "niet gescoord"));
      tr.appendChild(el("td", "muted", chosen && chosen.desc ? chosen.desc : "—"));

      var scoreCell = el("td", "score-cell", typeof v === "number" ? v + " / " + rMax : "—");
      if (typeof v === "number" && rMax > 0 && v / rMax < 0.5) scoreCell.classList.add("low");
      tr.appendChild(scoreCell);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    page.appendChild(table);

    if (entry.feedbackText) {
      var fb = el("div", "report-block");
      fb.appendChild(el("h2", null, "Feedback"));
      fb.appendChild(el("p", null, entry.feedbackText));
      page.appendChild(fb);
    }

    if (entry.feedforward) {
      var ff = el("div", "report-block feedforward-block");
      ff.appendChild(el("h2", null, "Feedforward — de volgende stap"));
      ff.appendChild(el("p", null, entry.feedforward));
      page.appendChild(ff);
    }

    var answered = questions.filter(function (q) {
      return entry.answers && entry.answers[q.id];
    });
    answered.forEach(function (q) {
      var block = el("div", "report-block");
      block.appendChild(el("h2", null, q.label));
      block.appendChild(el("p", null, entry.answers[q.id]));
      page.appendChild(block);
    });

    if (yearHasGoals(year)) {
      var goalList = goalsOfEvaluation(db, year, evaluation);
      if (goalList.length) {
        var gb = el("div", "report-block");
        gb.appendChild(el("h2", null, "Leerplandoelen die met deze opdracht geëvalueerd zijn"));
        goalList.forEach(function (g) {
          var line = el("p");
          line.style.marginBottom = "3px";
          line.appendChild(el("strong", null, goalCodeLabel(g) + " "));
          line.appendChild(document.createTextNode(g.text + " "));
          line.appendChild(el("em", null, "(" + g.bloom + ")"));
          gb.appendChild(line);
        });
        page.appendChild(gb);
      }
    }

    var foot = el("div", "report-foot");
    foot.appendChild(document.createTextNode(
      "De niveaubeschrijvingen hierboven zijn die van de rubric zoals die gold op het moment van beoordelen.",
    ));
    page.appendChild(foot);

    host.appendChild(page);
  });

  var klasLabel = (data.klas && data.klas !== "*") ? data.klas : (single && entries.length === 1 ? entries[0].klas : "Alle klassen");
  var suggestedName = single && entries.length === 1
    ? sanitizeFilename(entries[0].name) + "_" + sanitizeFilename(klasLabel) + "_" + sanitizeFilename(evaluation)
    : sanitizeFilename(klasLabel) + "_" + sanitizeFilename(evaluation);

  var previousTitle = document.title;
  document.title = suggestedName;

  document.body.classList.add("printing");
  window.print();

  // Na het afdrukvenster alles weer opruimen.
  setTimeout(function () {
    document.title = previousTitle;
    document.body.classList.remove("printing");
    host.innerHTML = "";
  }, 800);
}

/* ---- overgenomen uit feedup.js ---- */

/* ------------------------------------------------------------------
   FEED-UP
   De criteria en niveaus vóór de opdracht meegeven, zodat een leerling
   weet wat er verwacht wordt vóór hij begint — niet pas een score
   achteraf. Bewust zonder scores, zonder beoordelaar, zonder
   leerplandoel-jargon: dit is voor de leerling, niet voor de inspectie.
   ------------------------------------------------------------------ */

function printFeedUp(year, evaluationName) {
  var ev = getEvaluation(db, year, evaluationName);
  if (!ev) return;

  var host = $("printArea");
  host.innerHTML = "";

  var page = el("div", "report feedup");

  var head = el("div", "report-head");
  var left = el("div");
  left.appendChild(el("h1", null, evaluationName));
  left.appendChild(el("div", "sub", "Waarop word je beoordeeld?"));
  head.appendChild(left);
  page.appendChild(head);

  page.appendChild(el("p", "feedup-intro",
    "Hieronder staat per onderdeel wat we bekijken en wat het verschil maakt tussen de niveaus. " +
    "Gebruik dit tijdens het werken: hoe dichter je bij de rechterkolom komt, hoe sterker je werk."));

  (ev.rubrics || []).forEach(function (r) {
    var block = el("div", "feedup-block");
    block.appendChild(el("h2", null, r.name));
    if (r.description) block.appendChild(el("p", "muted", r.description));

    var sorted = (r.options || []).slice().sort(function (a, b) { return a.score - b.score; });
    var table = document.createElement("table");
    table.className = "report-table feedup-table";
    var tr = document.createElement("tr");
    sorted.forEach(function (o) { tr.appendChild(el("th", null, o.label)); });
    table.appendChild(tr);

    var tr2 = document.createElement("tr");
    sorted.forEach(function (o) {
      tr2.appendChild(el("td", null, o.desc || ""));
    });
    table.appendChild(tr2);

    block.appendChild(table);
    page.appendChild(block);
  });

  if (ev.questions && ev.questions.length) {
    var qb = el("div", "report-block");
    qb.appendChild(el("h2", null, "Dit wordt je ook gevraagd"));
    var ul = document.createElement("ul");
    ul.style.margin = "4px 0 0";
    ul.style.paddingLeft = "20px";
    ev.questions.forEach(function (q) { ul.appendChild(el("li", null, q.label)); });
    qb.appendChild(ul);
    page.appendChild(qb);
  }

  var foot = el("div", "report-foot");
  foot.textContent = "Deze omschrijvingen zijn dezelfde die je leerkracht gebruikt bij het beoordelen.";
  page.appendChild(foot);

  host.appendChild(page);
  document.body.classList.add("printing");
  window.print();
  setTimeout(function () {
    document.body.classList.remove("printing");
    host.innerHTML = "";
  }, 800);
}

/* ---- overgenomen uit goalview.js ---- */



/* --- afdrukbaar overzicht voor de doorlichting --- */

/* De doelendekkingstabel — herbruikt door printGoalOverview() en door
   printYearOverview() (jaaroverzicht), zodat er maar één plek is die
   bepaalt hoe "dekking" wordt weergegeven. */
function buildGoalCoverageTable(year, usage, attainment) {
  var table = document.createElement("table");
  table.className = "report-table";
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  ["Code(s)", "Leerplan", "Niveau", "Omschrijving", "Geëvalueerd in", "Behaald"].forEach(function (h) {
    hr.appendChild(el("th", null, h));
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  var lastRubriek = null;

  goalsForYear(year).forEach(function (g) {
    if (g.rubriek !== lastRubriek) {
      var sep = document.createElement("tr");
      var cell = el("td", "rubriek-row", g.rubriek);
      cell.colSpan = 6;
      sep.appendChild(cell);
      tbody.appendChild(sep);
      lastRubriek = g.rubriek;
    }

    var linked = usage[g.id];
    var att = attainment[g.id];

    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, goalCodeLabel(g))).style.fontWeight = "700";

    var pkgs = goalPackages(g);
    tr.appendChild(el("td", "muted", pkgs.length > 1 ? "beide" : pkgs[0]));
    tr.appendChild(el("td", "muted", g.bloom));

    var omschrijving = el("td");
    omschrijving.appendChild(document.createTextNode(g.text));
    if (g.concretisering) omschrijving.appendChild(el("div", "muted", g.concretisering));
    tr.appendChild(omschrijving);

    tr.appendChild(el("td", "muted", linked
      ? linked.map(function (l) { return l.evaluation; })
          .filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ")
      : "—"));

    var res = el("td", "score-cell");
    if (!linked) res.textContent = "niet gekoppeld";
    else if (!att || !att.assessed) res.textContent = "nog niet beoordeeld";
    else {
      res.textContent = att.reached + " / " + att.assessed + " (" + att.pct + "%)";
      if (att.pct < 70) res.classList.add("low");
    }
    tr.appendChild(res);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

function printGoalOverview(usage, attainment) {
  var host = $("printArea");
  host.innerHTML = "";

  var year = $("resYear").value;
  var klas = $("resKlas").value || "*";
  var printed = new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });

  var page = el("div", "report");

  var head = el("div", "report-head");
  var left = el("div");
  left.appendChild(el("h1", null, "Leerplandoelen " + year));
  left.appendChild(el("div", "sub", klas === "*" ? "Alle klassen" : klas));
  head.appendChild(left);
  var right = el("div", "report-score");
  right.appendChild(el("div", "sub", "Afgedrukt op " + printed));
  head.appendChild(right);
  page.appendChild(head);

  var intro = el("div", "report-meta");
  intro.appendChild(el("span", null,
    GOAL_PACKAGES.TW.label + " (SW) en " + GOAL_PACKAGES.MW.label + " (MW). " +
    "Doelen met twee codes staan woordelijk in beide leerplannen."));
  page.appendChild(intro);

  page.appendChild(buildGoalCoverageTable(year, usage, attainment));

  var foot = el("div", "report-foot");
  foot.textContent =
    "Een doel geldt als behaald wanneer de leerling op de gekoppelde criteria de drempel voor dat " +
    "beheersingsniveau haalt. Drempels: " +
    BLOOM_ORDER.map(function (b) { return b + " " + thresholdFor(db, b) + "%"; }).join(", ") + ".";
  page.appendChild(foot);

  host.appendChild(page);
  document.body.classList.add("printing");
  window.print();
  setTimeout(function () {
    document.body.classList.remove("printing");
    host.innerHTML = "";
  }, 800);
}

/* Eén PDF met alle evaluaties van een leerjaar (per map), hun
   leerplandoelen-koppeling en de volledige dekking — voor een
   doorlichting of vakgroepoverleg, in plaats van losse afdrukfuncties
   per evaluatie bij elkaar te moeten zoeken. */
function printYearOverview(year) {
  var host = $("printArea");
  host.innerHTML = "";

  var printed = new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
  var names = evaluationNames(db, year);
  var hasGoals = yearHasGoals(year);
  var usage = hasGoals ? goalUsage(db, year) : {};

  var page = el("div", "report");

  var head = el("div", "report-head");
  var left = el("div");
  left.appendChild(el("h1", null, "Jaaroverzicht " + year));
  left.appendChild(el("div", "sub", db.currentSchoolYear || ""));
  head.appendChild(left);
  var right = el("div", "report-score");
  right.appendChild(el("div", "sub", "Afgedrukt op " + printed));
  head.appendChild(right);
  page.appendChild(head);

  var totalCriteria = 0;
  names.forEach(function (name) {
    totalCriteria += rubricsFor(db, year, name).length;
  });
  var totalGoalCount = hasGoals ? goalsForYear(year).length : 0;
  var linkedGoalCount = hasGoals ? Object.keys(usage).length : 0;

  var meta = el("div", "report-meta");
  meta.appendChild(el("span", null, names.length + (names.length === 1 ? " evaluatie" : " evaluaties")));
  meta.appendChild(el("span", null, totalCriteria + (totalCriteria === 1 ? " criterium" : " criteria") + " in totaal"));
  if (hasGoals) {
    meta.appendChild(el("span", null, linkedGoalCount + " van de " + totalGoalCount + " leerplandoelen gekoppeld"));
  }
  page.appendChild(meta);

  // -- Evaluaties, gegroepeerd per map (net als op het Rubrics-scherm) --
  var evalBlock = el("div", "report-block");
  evalBlock.appendChild(el("h2", null, "Evaluaties"));

  if (!names.length) {
    evalBlock.appendChild(el("p", null, "Nog geen evaluaties voor " + year + "."));
  } else {
    var folders = evaluationFoldersFor(db, year);
    var byFolder = {};
    folders.forEach(function (f) { byFolder[f] = []; });
    var ongeordend = [];
    names.forEach(function (name) {
      var ev = getEvaluation(db, year, name);
      var f = ev && ev.folder;
      if (f && byFolder[f]) byFolder[f].push(name);
      else ongeordend.push(name);
    });

    var table = document.createElement("table");
    table.className = "report-table";
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["Evaluatie", "Criteria", "Max", "Leerplandoelen"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");

    function addRows(groupLabel, evalNames) {
      if (!evalNames.length) return;
      if (groupLabel) {
        var sep = document.createElement("tr");
        var cell = el("td", "rubriek-row", groupLabel);
        cell.colSpan = 4;
        sep.appendChild(cell);
        tbody.appendChild(sep);
      }
      evalNames.forEach(function (name) {
        var rubrics = rubricsFor(db, year, name);
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, name)).style.fontWeight = "700";
        tr.appendChild(el("td", "muted", String(rubrics.length)));
        tr.appendChild(el("td", "muted", String(maxScoreOf(rubrics))));

        var goalCodes = [];
        if (hasGoals) {
          rubrics.forEach(function (r) {
            (r.goals || []).forEach(function (key) {
              var g = findGoal(year, key);
              if (g) {
                var label = goalCodeLabel(g);
                if (goalCodes.indexOf(label) === -1) goalCodes.push(label);
              }
            });
          });
        }
        tr.appendChild(el("td", "muted", hasGoals ? (goalCodes.length ? goalCodes.join(", ") : "—") : "n.v.t."));
        tbody.appendChild(tr);
      });
    }

    folders.forEach(function (f) { addRows(f, byFolder[f]); });
    addRows(ongeordend.length && folders.length ? "Geen map" : null, ongeordend);

    table.appendChild(tbody);
    evalBlock.appendChild(table);
  }
  page.appendChild(evalBlock);

  // -- Dekking van de leerplandoelen (dezelfde tabel als het losse overzicht) --
  if (hasGoals) {
    var perEvaluation = {};
    names.forEach(function (name) {
      var data = collectResults(db, year, name, "*");
      if (!data.entries.length) return;
      perEvaluation[name] = { rubrics: data.rubrics, entries: data.entries };
    });
    var attainment = goalAttainment(db, year, Object.keys(usage), perEvaluation);

    var goalBlock = el("div", "report-block");
    goalBlock.appendChild(el("h2", null, "Dekking leerplandoelen"));
    goalBlock.appendChild(buildGoalCoverageTable(year, usage, attainment));
    page.appendChild(goalBlock);

    var foot = el("div", "report-foot");
    foot.textContent =
      "Een doel geldt als behaald wanneer de leerling op de gekoppelde criteria de drempel voor dat " +
      "beheersingsniveau haalt. Drempels: " +
      BLOOM_ORDER.map(function (b) { return b + " " + thresholdFor(db, b) + "%"; }).join(", ") + ".";
    page.appendChild(foot);
  } else {
    var noGoals = el("div", "report-block");
    noGoals.appendChild(el("h2", null, "Dekking leerplandoelen"));
    noGoals.appendChild(el("p", null, "Voor " + year + " zijn er geen leerplandoelen geladen in de tool."));
    page.appendChild(noGoals);
  }

  host.appendChild(page);
  document.body.classList.add("printing");
  window.print();
  setTimeout(function () {
    document.body.classList.remove("printing");
    host.innerHTML = "";
  }, 800);
}
