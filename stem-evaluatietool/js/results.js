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

  copyText(text, done, failed);
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
        var klas = klasOfStudentInRow(db, year, row, name, p.klas);
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
    year: year,
    evaluation: evaluation,
    klas: klasFilter || "*",
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



/* ------------------------------------------------------------------
   DEKKING OVER HET SCHOOLJAAR
   ------------------------------------------------------------------ */

function coverageMatrix(db, year) {
  var klassen = classesFor(db, year);
  var evaluaties = evaluationNames(db, year);

  // Eén keer over alle sessies van dit leerjaar: per leerling telt de
  // echte klas (row.studentKlas), zoals in collectResults() en
  // evaluatedMap(). Zo tellen combinatiesessies en leerlingen die van
  // klas veranderden correct mee. Oudere rijen zonder dat veld hadden
  // altijd precies één klas per sessie, dus daar is p.klas juist.
  var doneBy = {};
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year) return;
    (db.sessions[key] || []).forEach(function (row) {
      (row.students || []).forEach(function (s) {
        var klas = klasOfStudentInRow(db, year, row, s, p.klas);
        var cellKey = klas + "||" + p.evaluation;
        if (!doneBy[cellKey]) doneBy[cellKey] = {};
        doneBy[cellKey][s] = true;
      });
    });
  });

  var cells = {};
  klassen.forEach(function (klas) {
    var students = studentsFor(db, year, klas);
    evaluaties.forEach(function (evaluation) {
      var beoordeeld = doneBy[klas + "||" + evaluation] || {};
      var count = students.filter(function (s) { return beoordeeld[s]; }).length;
      cells[klas + "||" + evaluation] = {
        done: count,
        total: students.length,
        pct: students.length ? Math.round((count / students.length) * 100) : 0,
        started: Object.keys(beoordeeld).length > 0,
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



function scoreColor(pct) {
  if (pct >= 80) return "hsl(140, 62%, 40%)";
  if (pct >= 60) return "hsl(85, 58%, 42%)";
  if (pct >= 50) return "hsl(45, 80%, 45%)";
  if (pct >= 40) return "hsl(28, 85%, 50%)";
  return "hsl(0, 70%, 50%)";
}

/* Het scherm zelf (tabblad Controle, sinds 1.22.0) staat in js/controle.js. */
