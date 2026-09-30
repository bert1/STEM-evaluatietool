/* ------------------------------------------------------------------
   CONTROLE (sinds 1.22.0, was het tabblad Resultaten)
   Beantwoordt één vraag: wat ontbreekt er nog of klopt er niet? Toont
   enkel wat aandacht vraagt, zonder punten, gemiddelden of grafieken.

   De interne namen van het oude tabblad blijven (btnResults,
   resultsCard2, view "results", #resYear, #resKlas): hernoemen levert
   niets op voor de gebruiker en die namen zitten in app.js, storage.js,
   goals.js en reports.js.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   VRIJSTELLINGEN ("niet te beoordelen")
   Per schooljaar, gedeeld met het team:
     db.schoolYears[schooljaar].exemptions["leerjaar||evaluatie||klas||leerling"]
       = { reason: "langdurig ziek", by: "AB", updatedAt }
   Ongedaan maken volgt het tombstone-patroon:
     db.tombstones.exemptions["schooljaar||leerjaar||evaluatie||klas||leerling"] = tijdstip
   Een vrijstelling geldt zolang isTombstoned() "nee" zegt; opnieuw
   vrijstellen schrijft een nieuwere updatedAt en wint dus weer.
   Samenvoegen: per sleutel wint de nieuwste, er gaat nooit iets weg.
   De klas zit in de sleutel, zodat gelijknamige leerlingen uit andere
   klassen elkaar niet raken (zoals evaluatedMap() dat ook bewaakt).
   ------------------------------------------------------------------ */

function exemptionKey(year, evaluation, klas, student) {
  return [year, evaluation, klas, student].join("||");
}

function exemptionTombKey(key) {
  return db.currentSchoolYear + "||" + key;
}

function exemptionBucket() {
  var bucket = db.schoolYears[db.currentSchoolYear];
  if (!bucket.exemptions) bucket.exemptions = {};
  return bucket.exemptions;
}

function getExemption(year, evaluation, klas, student) {
  var bucket = db.schoolYears[db.currentSchoolYear] || {};
  var key = exemptionKey(year, evaluation, klas, student);
  var rec = bucket.exemptions && bucket.exemptions[key];
  if (!rec) return null;
  if (isTombstoned("exemptions", exemptionTombKey(key), rec.updatedAt)) return null;
  return rec;
}

function setExemption(year, evaluation, klas, student, reason) {
  var key = exemptionKey(year, evaluation, klas, student);
  // Altijd nieuwer dan een eventuele tombstone, ook binnen dezelfde milliseconde.
  var tomb = (db.tombstones.exemptions && db.tombstones.exemptions[exemptionTombKey(key)]) || 0;
  exemptionBucket()[key] = {
    reason: String(reason || "").trim().slice(0, 120),
    by: cleanAssessor(db.assessor),
    updatedAt: Math.max(Date.now(), tomb + 1),
  };
}

function clearExemption(year, evaluation, klas, student) {
  var key = exemptionKey(year, evaluation, klas, student);
  var rec = exemptionBucket()[key];
  if (!db.tombstones.exemptions) db.tombstones.exemptions = {};
  db.tombstones.exemptions[exemptionTombKey(key)] = Math.max(Date.now(), rec ? rec.updatedAt : 0);
}

/* Per sleutel wint de nieuwste; nooit iets verwijderen. */
function mergeExemptions(bucket, incoming) {
  if (!incoming || typeof incoming !== "object") return;
  if (!bucket.exemptions) bucket.exemptions = {};
  Object.keys(incoming).forEach(function (key) {
    var inc = incoming[key];
    if (!inc) return;
    var cur = bucket.exemptions[key];
    if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) {
      bucket.exemptions[key] = JSON.parse(JSON.stringify(inc));
    }
  });
}

/* Leerling van klas veranderd (migrateStudentEvaluations): de geldende
   vrijstellingen van de oude klas verhuizen mee naar de nieuwe. */
function migrateExemptions(year, student, fromKlas, toKlas) {
  var bucket = db.schoolYears[db.currentSchoolYear] || {};
  Object.keys(bucket.exemptions || {}).forEach(function (key) {
    var p = key.split("||");
    if (p[0] !== year || p[2] !== fromKlas || p[3] !== student) return;
    var rec = getExemption(year, p[1], fromKlas, student);
    if (!rec) return;
    clearExemption(year, p[1], fromKlas, student);
    setExemption(year, p[1], toKlas, student, rec.reason);
    exemptionBucket()[exemptionKey(year, p[1], toKlas, student)].by = rec.by;
  });
}

/* ------------------------------------------------------------------
   CONTROLES
   ------------------------------------------------------------------ */

var CONTROLE_ISSUES = [
  { kind: "ontbreekt", label: "Nog niet beoordeeld" },
  { kind: "onvolledig", label: "Onvolledig, niet elk criterium gescoord" },
  { kind: "tussentijds", label: "Enkel een tussentijdse check" },
  { kind: "dubbel", label: "Dubbel beoordeeld" },
  { kind: "nietInLijst", label: "Niet (meer) in de klaslijst" },
  { kind: "vrijgesteldToch", label: "Vrijgesteld, maar toch beoordeeld" },
];

var CONTROLE_STATUS = {
  ok: "In orde",
  onvolledig: "Onvolledig",
  tussentijds: "Enkel tussentijds",
  ontbreekt: "Ontbreekt",
  dubbel: "Dubbel",
  vrijgesteld: "Niet te beoordelen",
  nietInLijst: "Niet in de klaslijst",
};

/* Eén keer over alle sessies van dit leerjaar. Per evaluatie en per
   echte klas van de leerling (row.studentKlas, anders de klas van de
   sessie): welke rijen horen bij welke leerling, en op welke datums. */
function controleScan(year) {
  var out = {};
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year) return;
    (db.sessions[key] || []).forEach(function (row) {
      var date = rowDateIso(row);
      (row.students || []).forEach(function (s) {
        var klas = klasOfStudentInRow(db, year, row, s, p.klas);
        var k = p.evaluation + "||" + klas;
        if (!out[k]) out[k] = { students: {}, dates: [], rowDates: {} };
        var cell = out[k];
        if (!cell.students[s]) cell.students[s] = { finals: [], formatives: [] };
        (row.formative ? cell.students[s].formatives : cell.students[s].finals).push(row);
        if (cell.dates.indexOf(date) === -1) cell.dates.push(date);
        cell.rowDates[row.id] = date;
      });
    });
  });
  return out;
}

/* Alle controlepunten voor één evaluatie in één klas. */
function controleCheck(year, evaluation, klas, cell) {
  var liveVersion = evaluationVersion(db, year, evaluation);
  var roster = studentsFor(db, year, klas).slice().sort(function (a, b) { return a.localeCompare(b, "nl"); });
  var perStudent = (cell && cell.students) || {};
  var issues = {};
  CONTROLE_ISSUES.forEach(function (i) { issues[i.kind] = []; });
  var oldVersion = [];
  var students = [];
  var exempt = 0;

  function classify(name, inRoster) {
    var s = perStudent[name] || { finals: [], formatives: [] };
    var ex = inRoster ? getExemption(year, evaluation, klas, name) : null;
    var status;
    if (!inRoster) status = "nietInLijst";
    else if (s.finals.length > 1) status = "dubbel";
    else if (s.finals.length === 1) {
      var row = s.finals[0];
      // Volledig ten opzichte van de rubric zoals die gold bij het beoordelen.
      status = rowIsComplete(row, rubricsForVersion(db, year, evaluation, row.rubricVersion)) ? "ok" : "onvolledig";
    }
    else if (ex) status = "vrijgesteld";
    else if (s.formatives.length) status = "tussentijds";
    else status = "ontbreekt";

    var exemptButEvaluated = !!(ex && s.finals.length);
    if (s.finals.some(function (r) { return r.rubricVersion && r.rubricVersion < liveVersion; })) {
      oldVersion.push(name);
    }
    if (status === "dubbel" || status === "onvolledig" || status === "tussentijds" ||
        status === "ontbreekt" || status === "nietInLijst") issues[status].push(name);
    if (exemptButEvaluated) issues.vrijgesteldToch.push(name);
    if (status === "vrijgesteld") exempt++;

    students.push({
      name: name,
      status: status,
      exemption: ex,
      exemptButEvaluated: exemptButEvaluated,
      hasRows: !!(s.finals.length || s.formatives.length),
    });
  }

  roster.forEach(function (n) { classify(n, true); });
  Object.keys(perStudent).sort(function (a, b) { return a.localeCompare(b, "nl"); }).forEach(function (n) {
    if (roster.indexOf(n) === -1) classify(n, false);
  });

  var issueList = CONTROLE_ISSUES
    .filter(function (i) { return issues[i.kind].length; })
    .map(function (i) { return { kind: i.kind, label: i.label, names: issues[i.kind] }; });

  return {
    evaluation: evaluation,
    klas: klas,
    started: !!(cell && Object.keys(cell.students).length),
    students: students,
    issues: issueList,
    oldVersion: oldVersion,
    counts: {
      evaluated: roster.filter(function (n) { return perStudent[n] && perStudent[n].finals.length; }).length,
      total: roster.length,
      exempt: exempt,
    },
  };
}

function countsText(c) {
  return c.evaluated + "/" + c.total + " beoordeeld" + (c.exempt ? ", " + c.exempt + " vrijgesteld" : "");
}

/* Opmerkingen die over een hele evaluatie gaan, niet over één klas:
   criteria zonder leerplandoel, en een opvallend verschil tussen
   beoordelaars (de bestaande grens van 15 procentpunt). */
function controleEvalNotes(year, evaluation, klasFilter, rowInScope) {
  var notes = [];
  var rubrics = rubricsFor(db, year, evaluation);
  if (yearHasGoals(year)) {
    var zonder = rubrics.filter(function (r) { return !(r.goals || []).length; });
    if (zonder.length) {
      notes.push({
        kind: "doelen",
        text: zonder.length + (zonder.length === 1 ? " criterium" : " criteria") + " zonder leerplandoel: " +
          zonder.map(function (r) { return r.name || "(zonder naam)"; }).join(", ") + ".",
      });
    }
  }

  var data = collectResults(db, year, evaluation, klasFilter);
  var entries = data.entries.filter(function (e) { return !e.formative && rowInScope(e.rowId); });
  var cal = calibration(entries, data.rubrics);
  if (cal.comparable && cal.spread >= 15) {
    notes.push({
      kind: "kalibratie",
      text: memberName(db, cal.mildest.assessor) + " geeft gemiddeld " + cal.mildest.avgPct + "%, " +
        memberName(db, cal.strictest.assessor) + " " + cal.strictest.avgPct + "% (" + cal.spread +
        " procentpunt verschil). Bespreek samen hoe jullie scoren.",
    });
  }
  return notes;
}

/* Alles wat het scherm toont, per map in de volgorde van
   evaluationGroups(). filters: { klas, map, period } met klas "*" voor
   alle klassen, map "*" voor alle mappen en period -1 voor het hele
   schooljaar. */
function collectControle(year, filters) {
  var scan = controleScan(year);
  var klassen = classesFor(db, year).filter(function (k) { return filters.klas === "*" || k === filters.klas; });
  var range = null;
  if (filters.period >= 0) range = periodRanges(periodsFor(db, db.currentSchoolYear))[filters.period] || null;

  function inPeriod(cell) {
    if (!range) return true;
    return cell.dates.some(function (d) { return d >= range.start && d <= range.end; });
  }

  var groups = [];
  var totals = { open: 0, ok: 0, notStarted: 0, notes: 0 };

  evaluationGroups(year).forEach(function (g) {
    var label = g.label || "Zonder map";
    if (filters.map !== "*" && g.label !== filters.map) return;
    var group = { label: label, open: [], ok: [], notStarted: [], notes: [] };

    g.names.forEach(function (evaluation) {
      var shownForEval = false;
      var notStartedKlassen = [];
      var rowIds = {};

      klassen.forEach(function (klas) {
        var cell = scan[evaluation + "||" + klas];
        if (!cell || !Object.keys(cell.students).length) {
          notStartedKlassen.push(klas);
          return;
        }
        if (!inPeriod(cell)) return;
        Object.keys(cell.rowDates).forEach(function (id) { rowIds[id] = cell.rowDates[id]; });
        var check = controleCheck(year, evaluation, klas, cell);
        (check.issues.length ? group.open : group.ok).push(check);
        shownForEval = true;
      });

      if (notStartedKlassen.length) group.notStarted.push({ evaluation: evaluation, klassen: notStartedKlassen });

      if (shownForEval) {
        var notes = controleEvalNotes(year, evaluation, filters.klas, function (id) {
          var d = rowIds[id];
          return !!d && (!range || (d >= range.start && d <= range.end));
        });
        if (notes.length) group.notes.push({ evaluation: evaluation, notes: notes });
      }
    });

    totals.open += group.open.length;
    totals.ok += group.ok.length;
    totals.notStarted += group.notStarted.length;
    totals.notes += group.notes.length;
    groups.push(group);
  });

  return { groups: groups, totals: totals, range: range };
}

/* ------------------------------------------------------------------
   SCHERM
   ------------------------------------------------------------------ */

var controleOpenDetail = {};   // "evaluatie||klas" → detail staat open
var controleOpenNames = {};    // "evaluatie||klas||soort" → alle namen tonen
var CONTROLE_NAMES_SHOWN = 4;

function openResults() {
  if (!$("resYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) { $("resYear").appendChild(new Option(y, y)); });
    var chosen = $("yearSelect").value;
    if (chosen) $("resYear").value = chosen;
  }
  fillResultSelectors();
  renderResults();
  showView("results");
}

function fillResultSelectors() {
  var year = $("resYear").value;

  var prevKlas = $("resKlas").value;
  $("resKlas").innerHTML = "";
  $("resKlas").appendChild(new Option("Alle klassen", "*"));
  classesFor(db, year).forEach(function (k) { $("resKlas").appendChild(new Option(k, k)); });
  if (prevKlas && classesFor(db, year).indexOf(prevKlas) !== -1) $("resKlas").value = prevKlas;

  var prevMap = $("resMap").value;
  $("resMap").innerHTML = "";
  $("resMap").appendChild(new Option("Alle mappen", "*"));
  evaluationGroups(year).forEach(function (g) {
    if (g.label) $("resMap").appendChild(new Option(g.label, g.label));
  });
  if (prevMap && $("resMap").querySelector('option[value="' + cssEscape(prevMap) + '"]')) $("resMap").value = prevMap;

  var prevPeriod = $("resPeriod").value;
  $("resPeriod").innerHTML = "";
  $("resPeriod").appendChild(new Option("Hele schooljaar", "-1"));
  periodRanges(periodsFor(db, db.currentSchoolYear)).forEach(function (r, i) {
    $("resPeriod").appendChild(new Option(
      r.name + " (" + formatShortDate(r.start) + " t/m " + formatShortDate(r.end) + ")", String(i),
    ));
  });
  if (prevPeriod && $("resPeriod").querySelector('option[value="' + prevPeriod + '"]')) $("resPeriod").value = prevPeriod;
}

function controleFilters() {
  return {
    klas: $("resKlas").value || "*",
    map: $("resMap").value || "*",
    period: Number($("resPeriod").value || -1),
  };
}

function renderResults() {
  var host = $("controleBody");
  host.innerHTML = "";
  var year = $("resYear").value;
  var f = controleFilters();
  if ($("goalsWrap").open) renderGoalOverview();

  if (!evaluationNames(db, year).length) {
    host.appendChild(el("div", "empty", "Er zijn nog geen evaluaties in " + year + "."));
    return;
  }

  var res = collectControle(year, f);
  var scope = (f.klas === "*" ? "alle klassen" : f.klas) + " in " +
    (res.range ? res.range.name : "het hele schooljaar") + (f.map === "*" ? "" : " (map " + f.map + ")");
  var attention = res.totals.open + res.totals.notes;

  var summary = el("div", "notice controle-summary " + (attention ? "warn" : "good"));
  if (attention) {
    summary.appendChild(el("strong", null, attention === 1 ? "1 punt vraagt aandacht" : attention + " punten vragen aandacht"));
    summary.appendChild(document.createTextNode("Voor " + scope + "."));
  } else if (!res.totals.ok) {
    summary.appendChild(el("strong", null, "Nog geen beoordelingen voor " + scope + "."));
  } else {
    summary.appendChild(el("strong", null, "Alles in orde voor " + scope + "."));
  }
  host.appendChild(summary);

  if (attention) {
    host.appendChild(el("h3", "controle-heading", "Openstaand"));
    res.groups.forEach(function (g) {
      if (!g.open.length && !g.notes.length) return;
      var box = el("div", "controle-group");
      box.appendChild(el("div", "controle-group-title", g.label));
      g.open.forEach(function (check) { box.appendChild(renderControleItem(year, check, true)); });
      g.notes.forEach(function (n) { box.appendChild(renderControleNote(year, n)); });
      host.appendChild(box);
    });
  }

  if (res.totals.ok) {
    var okWrap = el("details", "controle-fold");
    var okSum = document.createElement("summary");
    okSum.className = "section-toggle";
    okSum.textContent = "In orde (" + res.totals.ok + ")";
    okWrap.appendChild(okSum);
    okWrap.open = Object.keys(controleOpenDetail).some(function (k) {
      return controleOpenDetail[k] && res.groups.some(function (g) {
        return g.ok.some(function (c) { return c.evaluation + "||" + c.klas === k; });
      });
    });
    res.groups.forEach(function (g) {
      if (!g.ok.length) return;
      var box = el("div", "controle-group");
      box.appendChild(el("div", "controle-group-title", g.label));
      g.ok.forEach(function (check) { box.appendChild(renderControleItem(year, check, false)); });
      okWrap.appendChild(box);
    });
    host.appendChild(okWrap);
  }

  if (res.totals.notStarted) {
    var nsWrap = el("details", "controle-fold");
    nsWrap.id = "controleNotStarted";
    var nsSum = document.createElement("summary");
    nsSum.className = "section-toggle";
    nsSum.textContent = "Nog niet gestart (" + res.totals.notStarted + ")";
    nsWrap.appendChild(nsSum);
    if (res.range) {
      nsWrap.appendChild(el("p", "hint", "Zonder beoordelingen is er geen datum, dus deze lijst staat los van de gekozen periode."));
    }
    res.groups.forEach(function (g) {
      if (!g.notStarted.length) return;
      var box = el("div", "controle-group");
      box.appendChild(el("div", "controle-group-title", g.label));
      g.notStarted.forEach(function (ns) {
        var row = el("div", "controle-item controle-notstarted");
        row.appendChild(el("div", "controle-title", ns.evaluation));
        var klassen = el("div", "controle-klassen");
        ns.klassen.forEach(function (klas) {
          var b = el("button", "btn-ghost btn-small", klas);
          b.type = "button";
          b.title = ns.evaluation + " beoordelen in " + klas;
          b.addEventListener("click", function () { openEvaluationFor(year, klas, ns.evaluation); });
          klassen.appendChild(b);
        });
        row.appendChild(klassen);
        box.appendChild(row);
      });
      nsWrap.appendChild(box);
    });
    host.appendChild(nsWrap);
  }
}

function renderControleItem(year, check, isOpen) {
  var id = check.evaluation + "||" + check.klas;
  var item = el("div", "controle-item" + (isOpen ? " controle-open" : ""));
  item.dataset.evaluation = check.evaluation;
  item.dataset.klas = check.klas;

  var head = el("div", "controle-head");
  var title = el("div", "controle-title");
  title.appendChild(document.createTextNode(check.evaluation));
  title.appendChild(el("span", "controle-klas", check.klas));
  head.appendChild(title);
  head.appendChild(el("span", "controle-count", countsText(check.counts)));

  var btns = el("div", "btn-row controle-actions");
  var detailBtn = el("button", "btn-ghost btn-small controle-detail-btn", controleOpenDetail[id] ? "Details verbergen" : "Details");
  detailBtn.type = "button";
  detailBtn.addEventListener("click", function () {
    controleOpenDetail[id] = !controleOpenDetail[id];
    renderResults();
  });
  btns.appendChild(detailBtn);
  var go = el("button", (isOpen ? "btn-primary" : "btn-ghost") + " btn-small controle-go", "Nu beoordelen");
  go.type = "button";
  go.addEventListener("click", function () { openEvaluationFor(year, check.klas, check.evaluation); });
  btns.appendChild(go);
  head.appendChild(btns);
  item.appendChild(head);

  if (check.issues.length || check.oldVersion.length) {
    var ul = el("ul", "controle-issues");
    check.issues.forEach(function (issue) {
      ul.appendChild(renderIssueLine(id, issue.kind, issue.label, issue.names, false));
    });
    if (check.oldVersion.length) {
      ul.appendChild(renderIssueLine(id, "oudeVersie",
        "Beoordeeld met een oudere versie van de rubric (ter info)", check.oldVersion, true));
    }
    item.appendChild(ul);
  }

  if (controleOpenDetail[id]) item.appendChild(renderControleDetail(year, check));
  return item;
}

function renderIssueLine(id, kind, label, names, info) {
  var li = el("li", "controle-issue controle-issue-" + kind + (info ? " controle-info" : ""));
  li.appendChild(el("strong", null, label + ": "));
  var key = id + "||" + kind;
  var all = !!controleOpenNames[key];
  var shown = all ? names : names.slice(0, CONTROLE_NAMES_SHOWN);
  li.appendChild(document.createTextNode(shown.join(", ")));
  if (names.length > CONTROLE_NAMES_SHOWN) {
    var more = el("button", "link-btn controle-more", all ? "minder tonen" : "+ " + (names.length - CONTROLE_NAMES_SHOWN) + " meer");
    more.type = "button";
    more.addEventListener("click", function () {
      controleOpenNames[key] = !all;
      renderResults();
    });
    li.appendChild(document.createTextNode(" "));
    li.appendChild(more);
  }
  return li;
}

function renderControleNote(year, n) {
  var item = el("div", "controle-item controle-note");
  var head = el("div", "controle-head");
  head.appendChild(el("div", "controle-title", n.evaluation));
  var needsEditor = n.notes.some(function (x) { return x.kind === "doelen"; });
  if (needsEditor) {
    var btns = el("div", "btn-row controle-actions");
    var edit = el("button", "btn-ghost btn-small", "Naar Rubrics");
    edit.type = "button";
    edit.addEventListener("click", function () {
      openEvals();
      editEvaluation(year, n.evaluation);
    });
    btns.appendChild(edit);
    head.appendChild(btns);
  }
  item.appendChild(head);
  var ul = el("ul", "controle-issues");
  n.notes.forEach(function (x) {
    var li = el("li", "controle-issue controle-issue-" + x.kind);
    li.textContent = x.text;
    ul.appendChild(li);
  });
  item.appendChild(ul);
  return item;
}

function renderControleDetail(year, check) {
  var box = el("div", "controle-detail");
  var readOnly = isArchivedSchoolYear(db);
  var data = collectResults(db, year, check.evaluation, check.klas);

  var wrap = el("div", "table-wrap");
  var table = el("table", "controle-table");
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  ["Leerling", "Status", "Opmerking", ""].forEach(function (h) { hr.appendChild(el("th", null, h)); });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  check.students.forEach(function (s, i) {
    var tr = document.createElement("tr");
    tr.dataset.student = s.name;
    tr.appendChild(el("td", null, (i + 1) + ". " + s.name));
    var st = el("td");
    st.appendChild(el("span", "status-badge status-" + s.status, CONTROLE_STATUS[s.status]));
    tr.appendChild(st);

    var note = el("td", "controle-remark");
    if (s.exemption) {
      var why = s.exemption.reason ? "Reden: " + s.exemption.reason : "Geen reden opgegeven";
      note.textContent = why + (s.exemption.by ? " (" + s.exemption.by + ")" : "");
    }
    if (s.exemptButEvaluated) {
      note.textContent = "Vrijgesteld, maar toch beoordeeld. De beoordeling telt. " + note.textContent;
      note.classList.add("controle-warn");
    }
    tr.appendChild(note);

    var act = el("td", "controle-row-actions");
    if (s.hasRows) {
      var rep = el("button", "btn-ghost btn-small", "Rapport");
      rep.type = "button";
      rep.addEventListener("click", function () {
        printReports(data, data.entries.filter(function (e) { return e.name === s.name; }), true);
      });
      act.appendChild(rep);
    }
    if (!readOnly && (s.status === "ontbreekt" || s.status === "tussentijds")) {
      var ex = el("button", "btn-ghost btn-small controle-exempt", "Niet te beoordelen");
      ex.type = "button";
      ex.addEventListener("click", function () { askExemption(year, check.evaluation, check.klas, s.name); });
      act.appendChild(ex);
    }
    if (!readOnly && s.exemption) {
      var undo = el("button", "btn-ghost btn-small controle-unexempt",
        s.exemptButEvaluated ? "Vrijstelling opheffen" : "Ongedaan maken");
      undo.type = "button";
      undo.addEventListener("click", function () {
        clearExemption(year, check.evaluation, check.klas, s.name);
        persist();
        renderResults();
      });
      act.appendChild(undo);
    }
    tr.appendChild(act);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  box.appendChild(wrap);

  if (data.entries.length) {
    var btns = el("div", "btn-row");
    btns.style.marginTop = "10px";
    var printAll = el("button", "btn-ghost btn-small", "Rapporten afdrukken (" + data.entries.length + ")");
    printAll.type = "button";
    printAll.id = "btnPrintAll";
    printAll.addEventListener("click", function () { printReports(data, data.entries, false); });
    btns.appendChild(printAll);
    box.appendChild(btns);
  }
  return box;
}

function askExemption(year, evaluation, klas, student) {
  var reason = window.prompt(
    student + " niet laten beoordelen voor " + evaluation + " (" + klas + ")?\n\n" +
      "Dit geldt ook voor je collega's en is altijd ongedaan te maken.\n" +
      "Reden (niet verplicht), bijvoorbeeld: langdurig ziek",
    "",
  );
  if (reason === null) return; // geannuleerd
  setExemption(year, evaluation, klas, student, reason);
  persist();
  renderResults();
}

function initControle() {
  $("resYear").addEventListener("change", function () { fillResultSelectors(); renderResults(); });
  $("resKlas").addEventListener("change", renderResults);
  $("resMap").addEventListener("change", renderResults);
  $("resPeriod").addEventListener("change", renderResults);
  $("goalsWrap").addEventListener("toggle", function () { if (this.open) renderGoalOverview(); });
}
