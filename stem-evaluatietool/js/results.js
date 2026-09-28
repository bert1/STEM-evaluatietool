/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function exportCSV() {
  if (!rows().length) {
    showNotice("info", "Nog niets om te exporteren", "Sla eerst minstens één evaluatie op.");
    return;
  }
  var csv = buildCSV(rows(), cur.rubrics, { klas: cur.klas, questions: cur.questions });
  var safe = (cur.klas + "-" + cur.evaluation).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = safe + ".csv";
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}



/* ------------------------------------------------------------------ */
/* Klembord                                                            */
/* ------------------------------------------------------------------ */

function copyTable() {
  if (!rows().length) {
    showNotice("info", "Nog niets om te kopiëren", "Sla eerst minstens één evaluatie op.");
    return;
  }
  var text = buildClipboardTable(rows(), cur.rubrics, { klas: cur.klas, questions: cur.questions });
  var count = rows().length;

  function done() {
    showNotice("good", "Gekopieerd naar het klembord", count + (count === 1 ? " rij" : " rijen") + ". Ga naar je Excel-blad, klik de cel aan waar het moet beginnen en druk Ctrl+V.");
  }
  function failed() {
    showNotice("warn", "Kopiëren lukte niet", "Gebruik Exporteren naar Excel in plaats daarvan.");
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () {
      if (legacyCopy(text)) done(); else failed();
    });
  } else if (legacyCopy(text)) {
    done();
  } else {
    failed();
  }
}

function legacyCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  var okCopy = false;
  try { okCopy = document.execCommand("copy"); } catch (e) { okCopy = false; }
  document.body.removeChild(ta);
  return okCopy;
}

/* ---- overgenomen uit core.js ---- */



/* ------------------------------------------------------------------
   KLEMBORD
   Tab-gescheiden, want dat plakt rechtstreeks in kolommen in Excel.
   ------------------------------------------------------------------ */

/* Toont de echte klas(sen) van de leerlingen ín die ene rij, niet
   noodzakelijk de volledige combinatie van de hele sessie — een sessie
   "1WA+1WB" kan best rijen bevatten die toevallig maar uit één van
   beide klassen bestaan. Valt terug op de sessie-klas voor oudere rijen
   zonder studentKlas. */
function rowKlasLabel(row, fallbackKlas) {
  if (!row.studentKlas) return fallbackKlas;
  var seen = {};
  var list = [];
  (row.students || []).forEach(function (name) {
    var k = row.studentKlas[name];
    if (k && !seen[k]) { seen[k] = true; list.push(k); }
  });
  if (!list.length) return fallbackKlas;
  list.sort();
  return list.join(" + ");
}

function buildClipboardTable(rows, rubrics, meta) {
  var max = maxScoreOf(rubrics);
  var questions = (meta && meta.questions) || [];
  var lines = [];

  lines.push(
    ["Klas", "Leerling(en)", "Aantal", "Beoordelaar", "Type"]
      .concat(rubrics.map(function (r) { return r.name; }))
      .concat(["Totaal (op " + max + ")", "Percentage", "Correcties", "Feedback", "Feedforward"])
      .concat(questions.map(function (q) { return q.label; }))
      .join("\t"),
  );

  rows.forEach(function (row) {
    var total = rowTotal(row, rubrics);
    var pct = max > 0 ? Math.round((total / max) * 100) : 0;
    var students = row.students.length ? row.students : ["(geen leerling)"];

    lines.push(
      [rowKlasLabel(row, meta.klas), students.join(" + "), students.length, row.assessor || "",
        row.formative ? "Tussentijds" : "Eindbeoordeling"]
        .concat(
          rubrics.map(function (r) {
            var v = row.scores[r.id];
            return typeof v === "number" ? v : "";
          }),
        )
        .concat([total, pct + "%", cleanForCell(correctionsSummary(row.corrections)), cleanForCell(row.feedback), cleanForCell(row.feedforward)])
        .concat(questions.map(function (q) {
          return cleanForCell(row.answers && row.answers[q.id]);
        }))
        .join("\t"),
    );
  });

  return lines.join("\n");
}

/* Compacte tekst voor in een exportkolom, bv. "Mats: -1, Lotte: +1". */
function correctionsSummary(corrections) {
  if (!corrections) return "";
  return Object.keys(corrections)
    .map(function (name) {
      var v = corrections[name];
      return name + ": " + (v > 0 ? "+" + v : v);
    })
    .join(", ");
}



/* Tabs en regeleindes in feedback zouden de kolommen uit elkaar trekken. */
function cleanForCell(s) {
  return String(s || "").replace(/[\t\n\r]+/g, " ").trim();
}



/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   RESULTATEN
   Voor de analyse tellen we per leerling, niet per opgeslagen rij:
   bij groepswerk krijgt elk groepslid de score van de groep.
   ------------------------------------------------------------------ */

function collectResults(db, year, evaluation, klasFilter) {
  var rubrics = rubricsFor(db, year, evaluation);
  var max = maxScoreOf(rubrics);
  var entries = [];
  var classes = {};

  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year || p.evaluation !== evaluation) return;
    if (!db.sessions[key].length) return;

    db.sessions[key].forEach(function (row) {
      var groupTotal = rowTotal(row, rubrics);
      (row.students || []).forEach(function (name) {
        // De echte klas van deze leerling: bij een combinatiesessie zit
        // die per leerling in row.studentKlas; oudere rijen zonder dat
        // veld hadden altijd precies één echte klas per sessie, dus is
        // de klas van de sessie zelf (p.klas) daar het juiste antwoord.
        var klas = (row.studentKlas && row.studentKlas[name]) || p.klas;
        classes[klas] = true;
        if (klasFilter && klasFilter !== "*" && klas !== klasFilter) return;

        // Groepsscore is gedeeld; de individuele correctie is per leerling
        // en telt enkel mee in ZIJN of HAAR eindtotaal, niet in de
        // per-criterium cijfers die de klas als geheel beschrijven.
        var correction = (row.corrections && typeof row.corrections[name] === "number") ? row.corrections[name] : 0;
        var total = Math.max(0, Math.min(max, groupTotal + correction));
        entries.push({
          name: name,
          klas: klas,
          assessor: row.assessor || "",
          scores: row.scores || {},
          answers: row.answers || {},
          feedback: row.feedback || "",
          feedforward: row.feedforward || "",
          formative: !!row.formative,
          groupTotal: groupTotal,
          correction: correction,
          total: total,
          pct: max > 0 ? Math.round((total / max) * 100) : 0,
          groupSize: (row.students || []).length,
          rowId: row.id,
          rubricVersion: row.rubricVersion || null,
          feedbackText: row.feedback || "",
          updatedAt: row.updatedAt || 0,
          complete: rowIsComplete(row, rubrics),
          needsAttention: rowNeedsAttention(row, rubrics),
        });
      });
    });
  });

  entries.sort(function (a, b) {
    if (a.klas !== b.klas) return a.klas.localeCompare(b.klas, "nl", { numeric: true });
    return a.name.localeCompare(b.name, "nl");
  });

  // Dezelfde leerling in meer dan één rij: meestal een dubbele beoordeling.
  var seen = {};
  var duplicates = [];
  entries.forEach(function (e) {
    var k = e.klas + "||" + e.name;
    if (seen[k]) {
      if (duplicates.indexOf(e.name) === -1) duplicates.push(e.name);
    }
    seen[k] = true;
  });

  return {
    rubrics: rubrics,
    max: max,
    entries: entries,
    duplicates: duplicates,
    classes: Object.keys(classes).sort(function (a, b) {
      return a.localeCompare(b, "nl", { numeric: true });
    }),
  };
}

function median(values) {
  if (!values.length) return 0;
  var s = values.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce(function (a, b) { return a + b; }, 0) / values.length;
}

function rubricMaxScore(rubric) {
  return rubric.options.reduce(function (m, o) { return Math.max(m, Number(o.score) || 0); }, 0);
}

function statsFor(entries, rubrics) {
  var perCriterion = rubrics.map(function (r) {
    var values = [];
    entries.forEach(function (e) {
      var v = e.scores[r.id];
      if (typeof v === "number") values.push(v);
    });

    var rMax = rubricMaxScore(r);
    var counts = {};
    r.options.forEach(function (o) { counts[o.score] = 0; });
    values.forEach(function (v) {
      if (counts[v] === undefined) counts[v] = 0;
      counts[v]++;
    });

    var avg = average(values);
    // "Onder de helft" is de gangbare grens voor een werkpunt.
    var below = values.filter(function (v) { return rMax > 0 && v / rMax < 0.5; }).length;

    return {
      id: r.id,
      name: r.name,
      max: rMax,
      options: r.options,
      counts: counts,
      scored: values.length,
      avg: avg,
      avgPct: rMax > 0 ? Math.round((avg / rMax) * 100) : 0,
      below: below,
      belowPct: values.length ? Math.round((below / values.length) * 100) : 0,
    };
  });

  var totals = entries.map(function (e) { return e.total; });
  var pcts = entries.map(function (e) { return e.pct; });
  var maxTotal = maxScoreOf(rubrics);

  // Verdeling in stappen van tien procent, met 100 bij de laatste bak.
  var buckets = [];
  for (var i = 0; i < 10; i++) {
    buckets.push({ from: i * 10, to: i * 10 + 9, count: 0 });
  }
  buckets[9].to = 100;
  pcts.forEach(function (p) {
    var idx = Math.min(9, Math.floor(p / 10));
    buckets[idx].count++;
  });

  return {
    perCriterion: perCriterion,
    count: entries.length,
    incomplete: entries.filter(function (e) { return e.needsAttention; }).length,
    formativeCount: entries.filter(function (e) { return e.formative; }).length,
    avg: average(totals),
    avgPct: maxTotal > 0 ? Math.round((average(totals) / maxTotal) * 100) : 0,
    median: median(totals),
    lowest: totals.length ? Math.min.apply(null, totals) : 0,
    highest: totals.length ? Math.max.apply(null, totals) : 0,
    maxTotal: maxTotal,
    buckets: buckets,
  };
}



/* De criteria waar de klas het zwakst op scoort, zwakste eerst. */
function weakPoints(stats, limit) {
  return stats.perCriterion
    .filter(function (c) { return c.scored > 0; })
    .slice()
    .sort(function (a, b) { return a.avgPct - b.avgPct; })
    .slice(0, limit || 3);
}



/* Wie zit onder de helft op dit criterium? */
function strugglingOn(entries, criterion) {
  return entries
    .filter(function (e) {
      var v = e.scores[criterion.id];
      return typeof v === "number" && criterion.max > 0 && v / criterion.max < 0.5;
    })
    .map(function (e) { return e.name; })
    .filter(function (n, i, arr) { return arr.indexOf(n) === i; });
}



/* ------------------------------------------------------------------
   DEKKING OVER HET SCHOOLJAAR
   ------------------------------------------------------------------ */

function coverageMatrix(db, year) {
  var klassen = classesFor(db, year);
  var evaluaties = evaluationNames(db, year);

  var cells = {};
  klassen.forEach(function (klas) {
    var students = studentsFor(db, year, klas);
    evaluaties.forEach(function (evaluation) {
      var key = sessionKey(year, klas, evaluation);
      var rows = (db.sessions || {})[key] || [];
      var done = {};
      rows.forEach(function (row) {
        (row.students || []).forEach(function (s) {
          if (students.indexOf(s) !== -1) done[s] = true;
        });
      });
      var count = Object.keys(done).length;
      cells[klas + "||" + evaluation] = {
        done: count,
        total: students.length,
        pct: students.length ? Math.round((count / students.length) * 100) : 0,
        started: rows.length > 0,
      };
    });
  });

  return { klassen: klassen, evaluaties: evaluaties, cells: cells };
}



/* ------------------------------------------------------------------
   KALIBRATIE
   Scoort de ene leerkracht structureel strenger dan de andere?
   ------------------------------------------------------------------ */

function calibration(entries, rubrics, minPerAssessor) {
  var floor = minPerAssessor === undefined ? 3 : minPerAssessor;
  var groups = {};

  entries.forEach(function (e) {
    var who = e.assessor || "?";
    if (!groups[who]) groups[who] = [];
    groups[who].push(e);
  });

  var maxTotal = maxScoreOf(rubrics);
  var assessors = Object.keys(groups)
    .sort(function (a, b) { return a.localeCompare(b, "nl"); })
    .map(function (who) {
      var list = groups[who];
      var perCriterion = {};
      rubrics.forEach(function (r) {
        var vals = [];
        list.forEach(function (e) {
          var v = e.scores[r.id];
          if (typeof v === "number") vals.push(v);
        });
        var rMax = rubricMaxScore(r);
        perCriterion[r.id] = {
          avg: average(vals),
          pct: rMax > 0 && vals.length ? Math.round((average(vals) / rMax) * 100) : null,
          count: vals.length,
        };
      });
      var totals = list.map(function (e) { return e.total; });
      return {
        assessor: who,
        count: list.length,
        avg: average(totals),
        avgPct: maxTotal > 0 ? Math.round((average(totals) / maxTotal) * 100) : 0,
        perCriterion: perCriterion,
        reliable: list.length >= floor,
      };
    });

  // Alleen leerkrachten met genoeg beoordelingen vergelijken.
  var solid = assessors.filter(function (a) { return a.reliable; });
  var spread = 0;
  var strictest = null;
  var mildest = null;
  if (solid.length > 1) {
    var pcts = solid.map(function (a) { return a.avgPct; });
    spread = Math.max.apply(null, pcts) - Math.min.apply(null, pcts);
    strictest = solid.reduce(function (m, a) { return a.avgPct < m.avgPct ? a : m; });
    mildest = solid.reduce(function (m, a) { return a.avgPct > m.avgPct ? a : m; });
  }

  return {
    assessors: assessors,
    comparable: solid.length > 1,
    spread: spread,
    strictest: strictest,
    mildest: mildest,
  };
}



/* ------------------------------------------------------------------
   CSV
   Eén rij per leerling — niet één rij per groep. Dat is wat je nodig
   hebt om naast een klaslijst te plakken.
   ------------------------------------------------------------------ */

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  var s = String(value);
  // Excel voert cellen die met = + - @ beginnen uit als formule.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildCSV(rows, rubrics, meta) {
  var max = maxScoreOf(rubrics);
  var questions = (meta && meta.questions) || [];
  var lines = [];

  var header = ["Klas", "Leerling(en)", "Aantal", "Beoordelaar", "Type"]
    .concat(
      rubrics.map(function (r) {
        return r.name;
      }),
    )
    .concat(["Totaal (op " + max + ")", "Percentage", "Correcties", "Feedback", "Feedforward"])
    .concat(
      questions.map(function (q) {
        return q.label;
      }),
    );
  lines.push(header.map(csvCell).join(";"));

  // Eén rij per opgeslagen evaluatie. Een groep blijft dus één regel,
  // met alle namen in dezelfde cel.
  rows.forEach(function (row) {
    var total = rowTotal(row, rubrics);
    var pct = max > 0 ? Math.round((total / max) * 100) : 0;
    var students = row.students.length ? row.students : ["(geen leerling)"];

    var cells = [
      rowKlasLabel(row, meta.klas), students.join(" + "), students.length, row.assessor || "",
      row.formative ? "Tussentijds" : "Eindbeoordeling",
    ]
      .concat(
        rubrics.map(function (r) {
          var v = row.scores[r.id];
          return typeof v === "number" ? v : "";
        }),
      )
      .concat([total, pct + "%", correctionsSummary(row.corrections), row.feedback || "", row.feedforward || ""])
      .concat(
        questions.map(function (q) {
          return (row.answers && row.answers[q.id]) || "";
        }),
      );
    lines.push(cells.map(csvCell).join(";"));
  });

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/* ---- overgenomen uit results.js ---- */

/* ------------------------------------------------------------------
   RESULTATEN
   Grafieken worden hier met de hand in SVG getekend. Een
   grafiekbibliotheek zou het bestand een megabyte zwaarder maken en
   moet ook offline werken.
   ------------------------------------------------------------------ */

var SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  var node = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function (k) {
    node.setAttribute(k, attrs[k]);
  });
  return node;
}

function svgText(x, y, text, attrs) {
  var node = svgEl("text", attrs || {});
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.textContent = text;
  return node;
}



/* Rood naar groen. Werkt voor elk aantal niveaus. */
function levelColor(index, total) {
  if (total <= 1) return "hsl(140, 55%, 42%)";
  var hue = (index / (total - 1)) * 134;
  return "hsl(" + Math.round(hue) + ", 62%, 45%)";
}

function scoreColor(pct) {
  if (pct >= 80) return "hsl(140, 62%, 40%)";
  if (pct >= 60) return "hsl(85, 58%, 42%)";
  if (pct >= 50) return "hsl(45, 80%, 45%)";
  if (pct >= 40) return "hsl(28, 85%, 50%)";
  return "hsl(0, 70%, 50%)";
}

function openResults() {
  if (!$("resYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) {
      $("resYear").appendChild(new Option(y, y));
    });
    var chosen = $("yearSelect").value;
    if (chosen) $("resYear").value = chosen;
  }
  fillResultSelectors();
  renderResults();
  showView("results");
}

function fillResultSelectors() {
  var year = $("resYear").value;
  var prevEval = $("resEval").value;
  var prevKlas = $("resKlas").value;

  // Zelfde mapindeling als bij Evalueren: <optgroup> per map in de echte
  // (onzichtbare) <select>, en koppen in de zichtbare zoeklijst.
  $("resEval").innerHTML = "";
  evaluationGroups(year).forEach(function (g) {
    var parent = $("resEval");
    if (g.label) {
      parent = document.createElement("optgroup");
      parent.label = g.label;
      $("resEval").appendChild(parent);
    }
    g.names.forEach(function (name) { parent.appendChild(new Option(name, name)); });
  });
  if (prevEval && evaluationNames(db, year).indexOf(prevEval) !== -1) {
    $("resEval").value = prevEval;
  }

  var evaluation = $("resEval").value;
  var found = collectResults(db, year, evaluation, "*");

  $("resKlas").innerHTML = "";
  $("resKlas").appendChild(new Option("Alle klassen", "*"));
  found.classes.forEach(function (klas) {
    $("resKlas").appendChild(new Option(klas, klas));
  });
  if (prevKlas && $("resKlas").querySelector('option[value="' + cssEscape(prevKlas) + '"]')) {
    $("resKlas").value = prevKlas;
  }

  resEvalCombo.sync();
}

/* Zoeklijst voor de evaluatie bij Resultaten, exact hetzelfde als het
   evaluatiemoment bij Evalueren (zie makeSearchCombo() in js/ui.js). */
var resEvalCombo = makeSearchCombo({
  inputId: "resEvalComboInput",
  panelId: "resEvalComboPanel",
  selectId: "resEval",
  wrapId: "resEvalComboWrap",
  groups: function () { return evaluationGroups($("resYear").value); },
  isEnabled: function () { return !!$("resYear").value; },
  placeholder: "Zoek een evaluatie…",
  disabledPlaceholder: "Kies eerst een leerjaar…",
  emptyText: "Nog geen evaluaties voor dit leerjaar.",
});

function renderResults() {
  renderCoverage();
  if ($("goalsWrap").open) renderGoalOverview();
  if ($("growthWrap").open) renderGrowthPanel();

  var host = $("resultsBody");
  host.innerHTML = "";

  var year = $("resYear").value;
  var evaluation = $("resEval").value;
  var klas = $("resKlas").value || "*";

  if (!evaluation) {
    host.appendChild(el("div", "empty", "Er zijn nog geen evaluaties in " + year + "."));
    return;
  }

  var data = collectResults(db, year, evaluation, klas);
  if (!data.entries.length) {
    host.appendChild(el("div", "empty",
      "Nog geen resultaten voor " + evaluation + (klas === "*" ? "" : " in " + klas) + "."));
    return;
  }

  // Kerncijfers en grafieken gaan over de eindbeoordelingen. Tussentijdse
  // checks zijn expres vaak onvolledig en zouden het gemiddelde vertekenen.
  var summativeEntries = data.entries.filter(function (e) { return !e.formative; });
  var stats = statsFor(summativeEntries.length ? summativeEntries : data.entries, data.rubrics);
  stats.formativeCount = data.entries.filter(function (e) { return e.formative; }).length;

  host.appendChild(renderSummary(data, stats, klas));
  host.appendChild(renderCalibration(data, stats));
  host.appendChild(renderStudentTable(data, stats));

  var chartsWrap = el("details", "chart-group");
  var chartsSummary = document.createElement("summary");
  chartsSummary.className = "section-toggle";
  chartsSummary.textContent = "Grafieken per criterium en spreiding";
  chartsWrap.appendChild(chartsSummary);
  var chartsBody = el("div");
  chartsBody.style.marginTop = "10px";
  chartsBody.appendChild(renderCriterionChart(stats));
  chartsBody.appendChild(renderDistributionChart(stats));
  chartsBody.appendChild(renderSpreadChart(stats));
  chartsWrap.appendChild(chartsBody);
  host.appendChild(chartsWrap);
}



/* --- kerncijfers --- */

function renderSummary(data, stats, klas) {
  var wrap = el("div");

  var cards = el("div", "stat-grid");
  function card(value, label, tone) {
    var c = el("div", "stat" + (tone ? " " + tone : ""));
    c.appendChild(el("div", "value", value));
    c.appendChild(el("div", "label", label));
    return c;
  }
  cards.appendChild(card(stats.count, stats.count === 1 ? "leerling beoordeeld" : "leerlingen beoordeeld"));
  cards.appendChild(card(stats.avgPct + "%", "klasgemiddelde (" + stats.avg.toFixed(1) + " op " + stats.maxTotal + ")"));
  cards.appendChild(card(stats.median + "/" + stats.maxTotal, "mediaan"));
  cards.appendChild(card(stats.lowest + " – " + stats.highest, "laagste en hoogste"));
  wrap.appendChild(cards);

  if (data.duplicates.length) {
    var dup = el("div", "notice warn");
    dup.appendChild(el("strong", null, "Dubbel beoordeeld"));
    dup.appendChild(document.createTextNode(
      data.duplicates.join(", ") + " staat meer dan één keer in de resultaten. Die telt dus dubbel mee in de cijfers hieronder.",
    ));
    wrap.appendChild(dup);
  }
  if (stats.incomplete) {
    var inc = el("div", "notice warn");
    inc.appendChild(el("strong", null, stats.incomplete + " onvolledige beoordeling(en)"));
    inc.appendChild(document.createTextNode(
      "Bij een of meer leerlingen is niet elk criterium gescoord. Hun totaal ligt daardoor lager dan het hoort. " +
      "Was dit bedoeld als tussentijdse check, markeer de rij dan als zodanig in het evaluatiescherm.",
    ));
    wrap.appendChild(inc);
  }
  if (stats.formativeCount) {
    var fm = el("div", "notice info");
    fm.appendChild(el("strong", null, stats.formativeCount + " tussentijdse check(s) niet meegeteld"));
    fm.appendChild(document.createTextNode(
      "Deze cijfers gaan alleen over de eindbeoordelingen. Tussentijdse checks tellen niet mee in het gemiddelde, de mediaan of de grafieken hieronder.",
    ));
    wrap.appendChild(fm);
  }

  return wrap;
}



/* --- werkpunten --- */

function renderWorkPoints(data, stats) {
  var wrap = el("div", "workpoints");
  var weak = weakPoints(stats, 3);
  if (!weak.length) return wrap;

  wrap.appendChild(el("h3", null, "Werkpunten voor de klas"));
  wrap.appendChild(el("p", "hint", "De criteria waar deze groep het zwakst op scoort, zwakste eerst."));

  weak.forEach(function (c) {
    var item = el("div", "workpoint");

    var head = el("div", "wp-head");
    head.appendChild(el("span", "wp-name", c.name));
    var pct = el("span", "wp-pct", c.avgPct + "%");
    pct.style.color = scoreColor(c.avgPct);
    head.appendChild(pct);
    item.appendChild(head);

    var line = el("div", "wp-meta",
      "Gemiddeld " + c.avg.toFixed(1) + " op " + c.max +
      (c.below ? " · " + c.below + " van de " + c.scored + " leerlingen onder de helft" : " · niemand onder de helft"));
    item.appendChild(line);

    if (c.below) {
      var names = strugglingOn(data.entries, c);
      var who = el("div", "chips");
      who.style.marginTop = "6px";
      names.slice(0, 12).forEach(function (n) {
        who.appendChild(el("span", "chip", n));
      });
      if (names.length > 12) who.appendChild(el("span", "chip", "+" + (names.length - 12) + " meer"));
      item.appendChild(who);
    }

    wrap.appendChild(item);
  });

  return wrap;
}



/* --- gemiddelde per criterium --- */

function renderCriterionChart(stats) {
  var box = el("div", "chart-box");
  box.appendChild(el("h3", null, "Gemiddelde per criterium"));
  box.appendChild(el("p", "hint", "Hoe hoger de balk, hoe beter de klas op dat criterium scoort. Kort betekent werkpunt."));

  var items = stats.perCriterion.filter(function (c) { return c.scored > 0; });
  if (!items.length) return box;

  var rowH = 34;
  var labelW = 210;
  var width = 760;
  var barW = width - labelW - 60;
  var height = items.length * rowH + 26;

  var svg = svgEl("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "chart",
    role: "img",
    "aria-label": "Gemiddelde score per criterium",
  });

  // Hulplijnen op 25, 50, 75 en 100 procent
  [0, 25, 50, 75, 100].forEach(function (p) {
    var x = labelW + (p / 100) * barW;
    svg.appendChild(svgEl("line", {
      x1: x, y1: 8, x2: x, y2: items.length * rowH + 6,
      stroke: p === 50 ? "#cbd5e1" : "#e2e8f0",
      "stroke-dasharray": p === 50 ? "4 3" : "0",
      "stroke-width": 1,
    }));
    svg.appendChild(svgText(x, height - 6, p + "%", {
      "text-anchor": "middle", class: "axis",
    }));
  });

  items.forEach(function (c, i) {
    var y = i * rowH + 8;
    var label = c.name.length > 30 ? c.name.slice(0, 29) + "…" : c.name;
    var t = svgText(labelW - 10, y + 16, label, { "text-anchor": "end", class: "bar-label" });
    t.appendChild(svgEl("title")).textContent = c.name;
    svg.appendChild(t);

    svg.appendChild(svgEl("rect", {
      x: labelW, y: y + 4, width: barW, height: 18, rx: 4, fill: "#f1f5f9",
    }));
    var w = Math.max(2, (c.avgPct / 100) * barW);
    var bar = svgEl("rect", {
      x: labelW, y: y + 4, width: w, height: 18, rx: 4, fill: scoreColor(c.avgPct),
    });
    bar.appendChild(svgEl("title")).textContent =
      c.name + ": gemiddeld " + c.avg.toFixed(1) + " op " + c.max + " (" + c.avgPct + "%)";
    svg.appendChild(bar);

    svg.appendChild(svgText(labelW + barW + 8, y + 18, c.avgPct + "%", { class: "bar-value" }));
  });

  box.appendChild(svg);
  return box;
}



/* --- verdeling per criterium --- */

function renderDistributionChart(stats) {
  var box = el("div", "chart-box");
  box.appendChild(el("h3", null, "Verdeling per criterium"));
  box.appendChild(el("p", "hint",
    "Hoeveel leerlingen op welk niveau zitten. Een gemiddelde verbergt of iedereen in het midden zit of dat de klas uiteenvalt."));

  var items = stats.perCriterion.filter(function (c) { return c.scored > 0; });
  if (!items.length) return box;

  var rowH = 34;
  var labelW = 210;
  var width = 760;
  var barW = width - labelW - 20;
  var height = items.length * rowH + 8;

  var svg = svgEl("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "chart",
    role: "img",
    "aria-label": "Verdeling van de scores per criterium",
  });

  items.forEach(function (c, i) {
    var y = i * rowH + 8;
    var label = c.name.length > 30 ? c.name.slice(0, 29) + "…" : c.name;
    var t = svgText(labelW - 10, y + 16, label, { "text-anchor": "end", class: "bar-label" });
    t.appendChild(svgEl("title")).textContent = c.name;
    svg.appendChild(t);

    var x = labelW;
    var sorted = c.options.slice().sort(function (a, b) { return a.score - b.score; });
    sorted.forEach(function (opt, oi) {
      var n = c.counts[opt.score] || 0;
      if (!n) return;
      var w = (n / c.scored) * barW;
      var seg = svgEl("rect", {
        x: x, y: y + 4, width: Math.max(1, w), height: 18,
        fill: levelColor(oi, sorted.length),
      });
      seg.appendChild(svgEl("title")).textContent =
        c.name + " — " + opt.label + " (" + opt.score + "): " + n +
        (n === 1 ? " leerling" : " leerlingen");
      svg.appendChild(seg);

      if (w > 22) {
        svg.appendChild(svgText(x + w / 2, y + 17, String(n), {
          "text-anchor": "middle", class: "seg-value",
        }));
      }
      x += w;
    });
  });

  box.appendChild(svg);
  box.appendChild(renderLegend(items[0]));
  return box;
}

function renderLegend(criterion) {
  var legend = el("div", "legend");
  var sorted = criterion.options.slice().sort(function (a, b) { return a.score - b.score; });
  sorted.forEach(function (opt, i) {
    var item = el("span", "legend-item");
    var dot = el("span", "dot");
    dot.style.background = levelColor(i, sorted.length);
    item.appendChild(dot);
    item.appendChild(document.createTextNode(opt.label + " (" + opt.score + ")"));
    legend.appendChild(item);
  });
  return legend;
}



/* --- spreiding van de totalen --- */

function renderSpreadChart(stats) {
  var box = el("div", "chart-box");
  box.appendChild(el("h3", null, "Spreiding van de totaalscores"));
  box.appendChild(el("p", "hint", "Hoeveel leerlingen in elke schijf van tien procent vallen."));

  var width = 760;
  var height = 200;
  var padL = 34;
  var padB = 34;
  var chartW = width - padL - 10;
  var chartH = height - padB - 14;
  var maxCount = Math.max.apply(null, stats.buckets.map(function (b) { return b.count; })) || 1;

  var svg = svgEl("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "chart",
    role: "img",
    "aria-label": "Spreiding van de totaalscores",
  });

  svg.appendChild(svgEl("line", {
    x1: padL, y1: chartH + 14, x2: width - 10, y2: chartH + 14,
    stroke: "#cbd5e1", "stroke-width": 1,
  }));

  var slot = chartW / stats.buckets.length;
  stats.buckets.forEach(function (b, i) {
    var h = b.count ? Math.max(3, (b.count / maxCount) * chartH) : 0;
    var x = padL + i * slot + slot * 0.15;
    var w = slot * 0.7;
    if (h) {
      var bar = svgEl("rect", {
        x: x, y: chartH + 14 - h, width: w, height: h, rx: 3,
        fill: scoreColor(b.from + 5),
      });
      bar.appendChild(svgEl("title")).textContent =
        b.from + " tot " + b.to + "%: " + b.count + (b.count === 1 ? " leerling" : " leerlingen");
      svg.appendChild(bar);
      svg.appendChild(svgText(x + w / 2, chartH + 8 - h, String(b.count), {
        "text-anchor": "middle", class: "bar-value",
      }));
    }
    if (i % 2 === 0) {
      svg.appendChild(svgText(x + w / 2, height - 12, b.from + "%", {
        "text-anchor": "middle", class: "axis",
      }));
    }
  });

  box.appendChild(svg);
  return box;
}



/* --- tabel per leerling --- */

var resultSort = { key: "name", dir: 1 }

function renderStudentTable(data, stats) {
  var box = el("div", "chart-box");
  var head = el("h3", null, "Per leerling");
  box.appendChild(head);

  var entries = data.entries.slice();
  entries.sort(function (a, b) {
    var v;
    if (resultSort.key === "total") v = a.total - b.total;
    else if (resultSort.key === "klas") v = a.klas.localeCompare(b.klas, "nl", { numeric: true });
    else v = a.name.localeCompare(b.name, "nl");
    if (v === 0) v = a.name.localeCompare(b.name, "nl");
    return v * resultSort.dir;
  });

  var wrap = el("div", "table-wrap");
  var table = document.createElement("table");
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");

  function sortable(label, key) {
    var th = el("th", "sortable", label + (resultSort.key === key ? (resultSort.dir === 1 ? " ↑" : " ↓") : ""));
    th.addEventListener("click", function () {
      if (resultSort.key === key) resultSort.dir *= -1;
      else { resultSort.key = key; resultSort.dir = 1; }
      renderResults();
    });
    return th;
  }

  hr.appendChild(sortable("Leerling", "name"));
  hr.appendChild(sortable("Klas", "klas"));
  data.rubrics.forEach(function (r, i) {
    var th = el("th", null, String(i + 1));
    var goalCodes = (r.goals || []).map(function (k) {
      var g = findGoal($("resYear").value, k);
      return g ? goalCodeLabel(g) : k;
    });
    th.title = r.name + (goalCodes.length ? "\nLeerplandoelen: " + goalCodes.join(", ") : "");
    th.style.textAlign = "center";
    hr.appendChild(th);
  });
  hr.appendChild(sortable("Totaal", "total"));
  hr.appendChild(el("th", null, "%"));
  hr.appendChild(el("th", null, "Door"));
  hr.appendChild(el("th", null, ""));
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  entries.forEach(function (e) {
    var tr = document.createElement("tr");

    var nameCell = el("td");
    nameCell.appendChild(el("strong", null, e.name));
    if (e.groupSize > 1) {
      var g = el("span", "badge", "groep van " + e.groupSize);
      g.style.marginLeft = "6px";
      nameCell.appendChild(g);
    }
    var live = evaluationVersion(db, $("resYear").value, $("resEval").value);
    if (e.rubricVersion && e.rubricVersion !== live) {
      var vb = el("span", "badge warn", "versie " + e.rubricVersion);
      vb.style.marginLeft = "6px";
      vb.title = "Beoordeeld met een oudere versie van de rubric. Het rapport toont die versie.";
      nameCell.appendChild(vb);
    }
    tr.appendChild(nameCell);
    tr.appendChild(el("td", null, e.klas));

    data.rubrics.forEach(function (r) {
      var v = e.scores[r.id];
      var cell = el("td", "num", typeof v === "number" ? v : "—");
      if (typeof v === "number") {
        var rMax = rubricMaxScore(r);
        if (rMax > 0 && v / rMax < 0.5) cell.classList.add("low");
      }
      tr.appendChild(cell);
    });

    var totalCell = el("td", "total", e.total + "/" + data.max);
    if (e.correction) {
      var sign = e.correction > 0 ? "+" + e.correction : String(e.correction);
      var cb = el("span", "badge correction " + (e.correction > 0 ? "up" : "down"), sign);
      cb.title = "Groepsscore " + e.groupTotal + "/" + data.max + ", individuele correctie " + sign + " → " + e.total + "/" + data.max;
      cb.style.marginLeft = "6px";
      totalCell.appendChild(cb);
    }
    tr.appendChild(totalCell);
    var pctCell = el("td", "num", e.pct + "%");
    pctCell.style.color = scoreColor(e.pct);
    pctCell.style.fontWeight = "700";
    tr.appendChild(pctCell);
    tr.appendChild(el("td", null, e.assessor || "—"));

    var act = el("td");
    var one = el("button", "btn-ghost btn-small", "Rapport");
    one.type = "button";
    one.addEventListener("click", function () { printReports(data, [e], true); });
    act.appendChild(one);
    tr.appendChild(act);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  box.appendChild(wrap);

  var legend = el("p", "hint");
  legend.textContent = "De cijferkolommen volgen de volgorde van de criteria; wijs een kolomkop aan voor de naam. Rood betekent onder de helft op dat criterium.";
  box.appendChild(legend);

  var btns = el("div", "btn-row");
  btns.style.marginTop = "12px";
  var copy = el("button", "btn-ghost btn-small", "Kopieer deze tabel");
  copy.type = "button";
  copy.addEventListener("click", function () { copyResultTable(data, entries); });
  btns.appendChild(copy);

  var printAll = el("button", "btn-ghost btn-small", "Rapporten afdrukken (" + entries.length + ")");
  printAll.type = "button";
  printAll.id = "btnPrintAll";
  printAll.addEventListener("click", function () { printReports(data, entries, false); });
  btns.appendChild(printAll);
  box.appendChild(btns);

  var printHint = el("p", "hint");
  printHint.textContent = "Eén blad per leerling, met per criterium het behaalde niveau én de beschrijving die daarbij hoort. Kies in het afdrukvenster \"Opslaan als PDF\" als je het digitaal wil bewaren.";
  box.appendChild(printHint);

  return box;
}

function copyResultTable(data, entries) {
  var lines = [];
  lines.push(
    ["Leerling", "Klas"]
      .concat(data.rubrics.map(function (r) { return r.name; }))
      .concat(["Groepsscore", "Correctie", "Totaal (op " + data.max + ")", "Percentage", "Beoordelaar"])
      .join("\t"),
  );
  entries.forEach(function (e) {
    lines.push(
      [e.name, e.klas]
        .concat(data.rubrics.map(function (r) {
          var v = e.scores[r.id];
          return typeof v === "number" ? v : "";
        }))
        .concat([e.groupTotal, e.correction ? (e.correction > 0 ? "+" + e.correction : e.correction) : "",
          e.total, e.pct + "%", e.assessor || ""])
        .join("\t"),
    );
  });
  var text = lines.join("\n");

  function done() {
    showNotice("good", "Gekopieerd naar het klembord",
      entries.length + " leerling(en). Plak met Ctrl+V in een Excel-blad.");
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () {
      if (legacyCopy(text)) done();
    });
  } else if (legacyCopy(text)) {
    done();
  }
}

/* ---- overgenomen uit report.js ---- */



/* ------------------------------------------------------------------
   KALIBRATIE
   ------------------------------------------------------------------ */

function renderCalibration(data, stats) {
  var wrap = el("div", "chart-box");
  var summativeEntries = data.entries.filter(function (e) { return !e.formative; });
  var cal = calibration(summativeEntries.length ? summativeEntries : data.entries, data.rubrics);

  if (cal.assessors.length < 2) return wrap;

  wrap.appendChild(el("h3", null, "Vergelijking tussen beoordelaars"));
  wrap.appendChild(el("p", "hint",
    "Scoort iemand structureel strenger of milder? Verschillen kunnen ook komen doordat je andere groepen beoordeeld hebt, dus lees dit als een aanleiding om te overleggen, niet als een oordeel."));

  if (!cal.comparable) {
    var few = el("div", "notice info");
    few.appendChild(el("strong", null, "Nog te weinig om te vergelijken"));
    few.appendChild(document.createTextNode(
      "Er is minstens drie beoordelingen per leerkracht nodig voor een zinvolle vergelijking. Nu: " +
      cal.assessors.map(function (a) { return a.assessor + " (" + a.count + ")"; }).join(", ") + ".",
    ));
    wrap.appendChild(few);
    return wrap;
  }

  var summary = el("div", "notice " + (cal.spread >= 15 ? "warn" : "good"));
  summary.appendChild(el("strong", null,
    cal.spread >= 15
      ? "Opvallend verschil van " + cal.spread + " procentpunt"
      : "Redelijk op één lijn (" + cal.spread + " procentpunt verschil)"));
  summary.appendChild(document.createTextNode(
    memberName(db, cal.mildest.assessor) + " geeft gemiddeld " + cal.mildest.avgPct + "%, " +
    memberName(db, cal.strictest.assessor) + " gemiddeld " + cal.strictest.avgPct + "%." +
    (cal.spread >= 15
      ? " De moeite om samen een paar dezelfde leerlingen te scoren en de verschillen te bespreken."
      : ""),
  ));
  wrap.appendChild(summary);

  // Per criterium een balk per beoordelaar
  var rowH = 20;
  var groupGap = 14;
  var labelW = 210;
  var width = 760;
  var barW = width - labelW - 60;
  var items = data.rubrics.filter(function (r) {
    return cal.assessors.some(function (a) { return a.perCriterion[r.id].count > 0; });
  });
  var height = items.length * (cal.assessors.length * rowH + groupGap) + 24;

  var svg = svgEl("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "chart",
    role: "img",
    "aria-label": "Gemiddelde per criterium, per beoordelaar",
  });

  var palette = ["#0284c7", "#7c3aed", "#0891b2", "#c2410c", "#4d7c0f"];
  var y = 8;

  items.forEach(function (r) {
    var blockTop = y;
    cal.assessors.forEach(function (a, ai) {
      var cell = a.perCriterion[r.id];
      if (!cell.count) { y += rowH; return; }
      var pct = cell.pct || 0;

      svg.appendChild(svgEl("rect", {
        x: labelW, y: y + 3, width: barW, height: rowH - 8, rx: 3, fill: "#f1f5f9",
      }));
      var bar = svgEl("rect", {
        x: labelW, y: y + 3, width: Math.max(2, (pct / 100) * barW), height: rowH - 8, rx: 3,
        fill: palette[ai % palette.length],
        opacity: a.reliable ? 1 : 0.45,
      });
      bar.appendChild(svgEl("title")).textContent =
        r.name + " — " + memberName(db, a.assessor) + ": gemiddeld " + cell.avg.toFixed(1) +
        " (" + pct + "%) over " + cell.count + " leerling(en)";
      svg.appendChild(bar);

      svg.appendChild(svgText(labelW + barW + 8, y + rowH - 6, a.assessor + " " + pct + "%", {
        class: "bar-value",
      }));
      y += rowH;
    });

    var label = r.name.length > 30 ? r.name.slice(0, 29) + "…" : r.name;
    var t = svgText(labelW - 10, blockTop + (y - blockTop) / 2 + 4, label, {
      "text-anchor": "end", class: "bar-label",
    });
    t.appendChild(svgEl("title")).textContent = r.name;
    svg.appendChild(t);

    y += groupGap;
  });

  wrap.appendChild(svg);
  return wrap;
}



/* ------------------------------------------------------------------
   DEKKING OVER HET SCHOOLJAAR
   ------------------------------------------------------------------ */

function renderCoverage() {
  var host = $("coverageBody");
  host.innerHTML = "";

  var year = $("resYear").value;
  var cov = coverageMatrix(db, year);

  if (!cov.klassen.length || !cov.evaluaties.length) {
    host.appendChild(el("div", "empty", "Nog geen klassen of rubrics in " + year + "."));
    return;
  }

  var totalCells = cov.klassen.length * cov.evaluaties.length;
  var doneCells = 0;
  var openCells = 0;
  cov.klassen.forEach(function (klas) {
    cov.evaluaties.forEach(function (ev) {
      var cell = cov.cells[klas + "||" + ev];
      if (cell.pct === 100) doneCells++;
      if (!cell.started) openCells++;
    });
  });

  var line = el("p", "hint");
  line.textContent =
    doneCells + " van de " + totalCells + " combinaties volledig afgewerkt · " +
    openCells + " nog niet begonnen.";
  host.appendChild(line);

  var wrap = el("div", "table-wrap");
  var table = document.createElement("table");
  table.className = "coverage";

  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  hr.appendChild(el("th", null, "Klas"));
  cov.evaluaties.forEach(function (ev) {
    var th = el("th", null, ev.length > 20 ? ev.slice(0, 19) + "…" : ev);
    th.title = ev;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  cov.klassen.forEach(function (klas) {
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, klas)).style.fontWeight = "700";

    cov.evaluaties.forEach(function (ev) {
      var cell = cov.cells[klas + "||" + ev];
      var td = el("td", "cov-cell");

      var btn = el("button", "cov" + (cell.pct === 100 ? " full" : cell.started ? " part" : " none"));
      btn.type = "button";
      btn.textContent = cell.started ? cell.done + "/" + cell.total : "—";
      btn.title = klas + " · " + ev + ": " + cell.done + " van de " + cell.total +
        " leerlingen beoordeeld" + (cell.started ? "" : " (nog niet begonnen)");
      btn.addEventListener("click", function () {
        $("resEval").value = ev;
        fillResultSelectors();
        $("resEval").value = ev;
        fillResultSelectors();
        $("resKlas").value = klas;
        renderResults();
        $("resultsBody").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      td.appendChild(btn);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  host.appendChild(wrap);
}
