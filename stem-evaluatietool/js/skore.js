/* ------------------------------------------------------------------
   SKORE
   Overzicht per klas en per rapportperiode (GE1, GE2, …) van de punten
   die in Skore (Smartschool) ingebracht moeten worden. De leerlingen
   staan alfabetisch en genummerd, net als in Skore, zodat je kolom per
   kolom kan overnemen (plakken kan niet in Skore).

   Periodes horen bij een schooljaar en worden gedeeld met het team:
   db.schoolYears[label].periods = {
     list: [{ name: "GE1", start: "2026-09-01" }, …],   // oplopend
     end: "2027-06-13",                                  // laatste dag
     updatedAt
   }
   Een periode loopt van haar startdatum tot de dag vóór de volgende
   start; de laatste loopt tot en met "end".

   Welke evaluatie in welke periode valt, volgt uit de datum van de
   beoordeling zelf (row.createdAt, sinds 1.21.0; oudere rijen vallen
   terug op row.updatedAt). Tussentijdse checks tellen niet mee.

   Het punt wordt berekend met de rubric zoals hij was bij het beoordelen
   (row.rubricVersion, sinds 1.23.0), net als het afgedrukte rapport.
   Had die versie een ander maximum dan de huidige rubric, dan wordt het
   punt omgerekend naar het maximum van de kolom.

   Naast elk punt staat een kopieerknop voor de feedbacktekst (zie
   js/feedback.js). Welke cellen al gekopieerd zijn, onthoudt enkel deze
   sessie (skoreCopied), niet het werkbestand.

   "Overgezet naar Skore" wordt ook per schooljaar bewaard en gedeeld:
   db.schoolYears[label].skoreDone["leerjaar||klas||evaluatie||periode"]
     = { done: true/false, by: "AB", updatedAt }
   ------------------------------------------------------------------ */

var skoreState = { year: "", klas: "", period: -1, scale: "" };

/* ---- datums: altijd als "JJJJ-MM-DD" in lokale tijd ---- */

function isoDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function isoFromTime(t) { return isoDate(new Date(t)); }

function isoAddDays(iso, days) {
  var p = iso.split("-").map(Number);
  return isoDate(new Date(p[0], p[1] - 1, p[2] + days));
}

function formatShortDate(iso) {
  var p = iso.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

function isValidIso(iso) {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/* ---- periodes ---- */

/* Voorstel voor een schooljaar zonder eigen periodes: dezelfde data als
   2026-2027. Wordt pas bewaard als iemand op "Periodes opslaan" klikt. */
function defaultPeriods(schoolYearLabel) {
  var m = /^(\d{4})-(\d{4})$/.exec(schoolYearLabel || "");
  var y = m ? parseInt(m[1], 10) : new Date().getFullYear();
  return {
    list: [
      { name: "GE1", start: y + "-09-01" },
      { name: "GE2", start: y + "-10-11" },
      { name: "GE3", start: y + "-12-13" },
      { name: "GE4", start: (y + 1) + "-02-28" },
    ],
    end: (y + 1) + "-06-13",
    updatedAt: 0,
  };
}

function periodsFor(dbObj, schoolYearLabel) {
  var bucket = dbObj.schoolYears && dbObj.schoolYears[schoolYearLabel];
  var p = bucket && bucket.periods;
  if (p && Array.isArray(p.list) && p.list.length) return p;
  return defaultPeriods(schoolYearLabel);
}

/* [{name, start, end}] met de einddatum ingevuld. */
function periodRanges(periods) {
  return periods.list.map(function (p, i) {
    var next = periods.list[i + 1];
    return { name: p.name, start: p.start, end: next ? isoAddDays(next.start, -1) : periods.end };
  });
}

/* Index van de periode waarin deze datum valt, of -1. */
function periodIndexFor(iso, periods) {
  var ranges = periodRanges(periods);
  for (var i = 0; i < ranges.length; i++) {
    if (iso >= ranges[i].start && iso <= ranges[i].end) return i;
  }
  return -1;
}

/* Controle vóór opslaan. Geeft een lijst met leesbare problemen. */
function validatePeriods(periods) {
  var problems = [];
  if (!periods.list.length) problems.push("Er moet minstens één periode zijn.");
  periods.list.forEach(function (p, i) {
    if (!p.name.trim()) problems.push("Periode " + (i + 1) + " heeft geen naam.");
    if (!isValidIso(p.start)) problems.push((p.name || "Periode " + (i + 1)) + " heeft geen geldige startdatum.");
    var prev = periods.list[i - 1];
    if (prev && isValidIso(prev.start) && isValidIso(p.start) && p.start <= prev.start) {
      problems.push(p.name + " begint niet na " + prev.name + ".");
    }
  });
  var last = periods.list[periods.list.length - 1];
  if (!isValidIso(periods.end)) problems.push("De einddatum van de laatste periode ontbreekt.");
  else if (last && isValidIso(last.start) && periods.end < last.start) {
    problems.push("De einddatum ligt vóór de start van " + last.name + ".");
  }
  return problems;
}

/* Nieuwere periode-indeling wint als geheel, net als de drempels. */
function mergePeriods(bucket, incoming) {
  if (!incoming || !Array.isArray(incoming.list) || !incoming.list.length) return false;
  if (bucket.periods && (incoming.updatedAt || 0) <= (bucket.periods.updatedAt || 0)) return false;
  bucket.periods = JSON.parse(JSON.stringify(incoming));
  return true;
}

/* Per sleutel wint de nieuwste; nooit iets verwijderen. */
function mergeSkoreDone(bucket, incoming) {
  if (!incoming) return;
  if (!bucket.skoreDone) bucket.skoreDone = {};
  Object.keys(incoming).forEach(function (key) {
    var inc = incoming[key];
    if (!inc) return;
    var cur = bucket.skoreDone[key];
    if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) bucket.skoreDone[key] = JSON.parse(JSON.stringify(inc));
  });
}

/* ---- welke punten horen bij deze klas en periode ---- */

function rowDateIso(row) {
  return isoFromTime(row.createdAt || row.updatedAt || 0);
}

/* Verzamelt per evaluatie de punten van de leerlingen van deze klas die
   in de gekozen periode beoordeeld werden.
   Geeft { evaluations: [{ name, folder, max, dates: [iso], byStudent:
   { naam: { total, max, date, duplicate, row } } }], students: [namen] }.
   "max" per leerling is het maximum van de rubricversie van die rij. */
function collectSkore(dbObj, year, klas, periods, periodIndex) {
  var range = periodRanges(periods)[periodIndex];
  var byEval = {};

  Object.keys(dbObj.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year) return;
    var max = maxScoreOf(rubricsFor(dbObj, year, p.evaluation));

    (dbObj.sessions[key] || []).forEach(function (row) {
      if (row.formative) return;
      var date = rowDateIso(row);
      if (!range || date < range.start || date > range.end) return;
      var rubrics = rubricsForVersion(dbObj, year, p.evaluation, row.rubricVersion);
      var rowMax = maxScoreOf(rubrics);
      var groupTotal = rowTotal(row, rubrics);

      (row.students || []).forEach(function (name) {
        var studentKlas = (row.studentKlas && row.studentKlas[name]) || p.klas;
        if (studentKlas !== klas) return;

        if (!byEval[p.evaluation]) {
          var ev = getEvaluation(dbObj, year, p.evaluation);
          byEval[p.evaluation] = { name: p.evaluation, folder: (ev && ev.folder) || "", max: max, dates: [], byStudent: {} };
        }
        var entry = byEval[p.evaluation];
        var correction = (row.corrections && typeof row.corrections[name] === "number") ? row.corrections[name] : 0;
        var total = Math.max(0, Math.min(rowMax, groupTotal + correction));
        if (entry.dates.indexOf(date) === -1) entry.dates.push(date);

        var prev = entry.byStudent[name];
        // Twee beoordelingen voor dezelfde leerling: de recentste telt,
        // maar we tonen dat er iets te controleren valt.
        if (!prev || (row.updatedAt || 0) > prev.updatedAt) {
          entry.byStudent[name] = { total: total, max: rowMax, date: date, updatedAt: row.updatedAt || 0, duplicate: !!prev, row: row };
        } else {
          prev.duplicate = true;
        }
      });
    });
  });

  var evaluations = Object.keys(byEval).map(function (k) { return byEval[k]; });
  evaluations.forEach(function (e) { e.dates.sort(); });
  // In de volgorde waarin ze gebeurd zijn, zoals de kolommen in Skore.
  evaluations.sort(function (a, b) {
    if (a.dates[0] !== b.dates[0]) return a.dates[0] < b.dates[0] ? -1 : 1;
    return a.name.localeCompare(b.name, "nl");
  });

  var students = studentsFor(dbObj, year, klas).slice();
  var extra = [];
  evaluations.forEach(function (e) {
    Object.keys(e.byStudent).forEach(function (n) {
      if (students.indexOf(n) === -1 && extra.indexOf(n) === -1) extra.push(n);
    });
  });
  students.sort(function (a, b) { return a.localeCompare(b, "nl"); });
  extra.sort(function (a, b) { return a.localeCompare(b, "nl"); });

  return { evaluations: evaluations, students: students, notInRoster: extra };
}

/* Punten omrekenen naar het maximum dat in Skore staat. */
function scaleScore(total, max, scale) {
  if (!scale || !max) return total;
  return Math.round((total / max) * scale * 10) / 10;
}

/* Het punt zoals het in de tabel komt: omgerekend naar de gekozen schaal,
   of naar het kolommaximum als de rubricversie een ander maximum had. */
function skoreCellScore(v, columnMax, scale) {
  var target = scale || (v.max && v.max !== columnMax ? columnMax : 0);
  return scaleScore(v.total, v.max || columnMax, target);
}

function formatScore(v) {
  return String(v).replace(".", ",");
}

function skoreDoneKey(year, klas, evaluation, periodName) {
  return [year, klas, evaluation, periodName].join("||");
}

function isSkoreDone(dbObj, key) {
  var bucket = dbObj.schoolYears[dbObj.currentSchoolYear] || {};
  var v = bucket.skoreDone && bucket.skoreDone[key];
  return !!(v && v.done);
}

function setSkoreDone(key, done) {
  var bucket = db.schoolYears[db.currentSchoolYear];
  if (!bucket.skoreDone) bucket.skoreDone = {};
  bucket.skoreDone[key] = { done: done, by: cleanAssessor(db.assessor), updatedAt: Date.now() };
  persist();
}

/* ---- scherm ---- */

function openSkore() {
  if (!$("skoreYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) { $("skoreYear").appendChild(new Option(y, y)); });
    if ($("yearSelect").value) $("skoreYear").value = $("yearSelect").value;
  }
  periodDraft = null;
  fillSkoreSelectors(true);
  renderSkore();
  showView("skore");
}

function fillSkoreSelectors(pickToday) {
  var year = $("skoreYear").value;

  var prevKlas = $("skoreKlas").value;
  $("skoreKlas").innerHTML = "";
  classesFor(db, year).forEach(function (k) { $("skoreKlas").appendChild(new Option(k, k)); });
  if (prevKlas && classesFor(db, year).indexOf(prevKlas) !== -1) $("skoreKlas").value = prevKlas;

  var periods = periodsFor(db, db.currentSchoolYear);
  var prevPeriod = $("skorePeriod").value;
  $("skorePeriod").innerHTML = "";
  periodRanges(periods).forEach(function (r, i) {
    $("skorePeriod").appendChild(new Option(
      r.name + " (" + formatShortDate(r.start) + " t/m " + formatShortDate(r.end) + ")", String(i),
    ));
  });

  if (pickToday || prevPeriod === "" || Number(prevPeriod) >= periods.list.length) {
    // Standaard de periode van vandaag; buiten het schooljaar de laatste.
    var today = periodIndexFor(isoDate(new Date()), periods);
    if (skoreState.period >= 0 && skoreState.period < periods.list.length && !pickToday) today = skoreState.period;
    $("skorePeriod").value = String(today >= 0 ? today : periods.list.length - 1);
  } else {
    $("skorePeriod").value = prevPeriod;
  }
  skoreState.period = Number($("skorePeriod").value);
}

function stepSkorePeriod(step) {
  var sel = $("skorePeriod");
  var i = Number(sel.value) + step;
  if (i < 0 || i >= sel.options.length) return;
  sel.value = String(i);
  skoreState.period = i;
  renderSkore();
}

function renderSkore() {
  var host = $("skoreBody");
  host.innerHTML = "";
  var year = $("skoreYear").value;
  var klas = $("skoreKlas").value;
  var periods = periodsFor(db, db.currentSchoolYear);
  var pIndex = Number($("skorePeriod").value);
  var range = periodRanges(periods)[pIndex];
  var scale = Number($("skoreScale").value) || 0;

  $("skorePrev").disabled = pIndex <= 0;
  $("skoreNext").disabled = pIndex >= periods.list.length - 1;
  renderPeriodEditor();

  if (!klas) {
    host.appendChild(el("div", "empty", "Er zijn nog geen klassen voor " + year + "."));
    return;
  }
  if (!range) return;

  var data = collectSkore(db, year, klas, periods, pIndex);
  var periodLabel = range.name + " (" + formatShortDate(range.start) + " t/m " + formatShortDate(range.end) + ")";

  if (!data.evaluations.length) {
    host.appendChild(el("div", "empty", "Geen beoordelingen voor " + klas + " in " + periodLabel + "."));
    return;
  }

  var doneCount = data.evaluations.filter(function (e) {
    return isSkoreDone(db, skoreDoneKey(year, klas, e.name, range.name));
  }).length;
  host.appendChild(el(
    "p", "skore-summary",
    data.evaluations.length + " evaluatie(s) voor " + klas + " in " + periodLabel + ". " +
      doneCount + " van de " + data.evaluations.length + " al overgezet naar Skore.",
  ));

  host.appendChild(buildSkoreEvalList(data, year, klas, range, scale));
  host.appendChild(el(
    "p", "hint skore-copy-hint",
    "Klik op het kopieericoon naast een punt om de feedback te kopiëren. Plak die in Smartschool bij het resultaat.",
  ));
  host.appendChild(buildSkoreTable(data, year, klas, scale));

  if (data.notInRoster.length) {
    host.appendChild(el(
      "p", "hint",
      "Beoordeeld maar niet (meer) in de klaslijst van " + klas + ": " + data.notInRoster.join(", ") +
        ". Die staan onderaan de tabel.",
    ));
  }
}

function buildSkoreEvalList(data, year, klas, range, scale) {
  var wrap = el("div", "table-wrap");
  wrap.style.marginBottom = "18px";
  var table = el("table", "skore-evals");
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  ["Evaluatie", "Map", "Datum", "Beoordeeld", "Max", "Overgezet naar Skore"].forEach(function (h) {
    hr.appendChild(el("th", null, h));
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  var total = data.students.length;
  data.evaluations.forEach(function (e, i) {
    var key = skoreDoneKey(year, klas, e.name, range.name);
    var done = isSkoreDone(db, key);
    var tr = document.createElement("tr");
    if (done) tr.classList.add("skore-done");

    var nameTd = el("td", "skore-eval-name");
    nameTd.appendChild(el("span", "skore-col-num", i + 1));
    nameTd.appendChild(document.createTextNode(e.name));
    tr.appendChild(nameTd);
    tr.appendChild(el("td", null, e.folder || "–"));
    var first = e.dates[0], last = e.dates[e.dates.length - 1];
    tr.appendChild(el("td", null, first === last ? formatShortDate(first) : formatShortDate(first) + " t/m " + formatShortDate(last)));
    var n = Object.keys(e.byStudent).filter(function (s) { return data.students.indexOf(s) !== -1; }).length;
    var vrij = data.students.filter(function (s) {
      return !e.byStudent[s] && getExemption(year, e.name, klas, s);
    }).length;
    tr.appendChild(el(
      "td", "num" + (n + vrij < total ? " skore-incomplete" : ""),
      n + "/" + total + (vrij ? ", " + vrij + " vrijgesteld" : ""),
    ));
    tr.appendChild(el("td", "num", scale ? scale + " (van " + e.max + ")" : e.max));

    var doneTd = el("td");
    var lbl = el("label", "skore-done-toggle");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = done;
    cb.disabled = isArchivedSchoolYear(db);
    cb.addEventListener("change", function () {
      setSkoreDone(key, cb.checked);
      renderSkore();
    });
    lbl.appendChild(cb);
    lbl.appendChild(el("span", null, done ? "Ja" : "Nog niet"));
    doneTd.appendChild(lbl);
    tr.appendChild(doneTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function buildSkoreTable(data, year, klas, scale) {
  var wrap = el("div", "table-wrap");
  var table = el("table", "skore-table");
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  hr.appendChild(el("th", null, "Leerling"));
  data.evaluations.forEach(function (e, i) {
    var th = el("th", "num");
    th.title = e.name;
    th.appendChild(el("span", "skore-col-num", i + 1));
    th.appendChild(el("span", "skore-th-name", e.name));
    th.appendChild(el("span", "skore-th-max", "/" + (scale || e.max)));
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");
  data.students.concat(data.notInRoster).forEach(function (s, idx) {
    var tr = document.createElement("tr");
    if (data.notInRoster.indexOf(s) !== -1) tr.classList.add("skore-extra");
    tr.appendChild(el("td", "skore-student", (idx + 1) + ". " + s));
    data.evaluations.forEach(function (e) {
      var v = e.byStudent[s];
      var td = el("td", "num");
      if (v) {
        td.appendChild(el("span", "skore-score", formatScore(skoreCellScore(v, e.max, scale))));
        td.appendChild(buildSkoreCopyButton(td, year, e.name, v, s));
        var notes = [];
        if (v.duplicate) {
          td.classList.add("skore-dup");
          notes.push("Deze leerling is meer dan eens beoordeeld; de recentste beoordeling telt.");
        }
        if (v.max !== e.max) {
          notes.push("Beoordeeld met een oudere rubric (op " + v.max + "), omgerekend naar " + (scale || e.max) + ".");
        }
        if (notes.length) td.title = notes.join(" ");
      } else if (data.notInRoster.indexOf(s) === -1 && getExemption(year, e.name, klas, s)) {
        // Vrijgesteld op het Controle-tabblad: geen punt in Skore nodig.
        var ex = getExemption(year, e.name, klas, s);
        td.textContent = "vrijgesteld";
        td.classList.add("skore-exempt");
        td.title = "Niet te beoordelen" + (ex.reason ? ": " + ex.reason : "");
      } else {
        td.textContent = "–";
        td.classList.add("skore-missing");
        td.title = "Niet beoordeeld in deze periode";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ---- feedback kopiëren ---- */

/* Enkel voor deze sessie: welke feedback al gekopieerd is, zodat je bij
   het overtypen ziet waar je gebleven bent. Bewust niet in db: niet
   bewaren, niet synchroniseren. Na een aanpassing van de beoordeling
   verandert updatedAt en verdwijnt het vinkje vanzelf. */
var skoreCopied = {};

function skoreCopyKey(row, student) {
  return [row.id, row.updatedAt || 0, student].join("||");
}

var SKORE_COPY_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h8"></path></svg>';
var SKORE_CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';

/* Kopiëren wijzigt niets, dus dit werkt ook in een gearchiveerd jaar. */
function buildSkoreCopyButton(td, year, evaluation, v, student) {
  var key = skoreCopyKey(v.row, student);
  var btn = el("button", "skore-copy");
  btn.type = "button";
  var label = "Feedback voor " + student + " kopiëren";
  btn.setAttribute("aria-label", label);
  btn.title = label;

  function markCopied() {
    td.classList.add("skore-copied");
    btn.innerHTML = SKORE_CHECK_ICON;
    btn.title = label + " (al gekopieerd)";
  }
  btn.innerHTML = SKORE_COPY_ICON;
  if (skoreCopied[key]) markCopied();

  btn.addEventListener("click", function () {
    var text = buildSkoreFeedback(db, year, evaluation, v.row, student);
    copyText(text, function () {
      skoreCopied[key] = true;
      markCopied();
      showToast("Feedback voor " + student + " gekopieerd");
    }, function () {
      showToast("Kopiëren lukte niet. Probeer het nog eens.", "warn");
    });
  });
  return btn;
}

/* ---- periodes aanpassen ---- */

var periodDraft = null;

function renderPeriodEditor() {
  var host = $("skorePeriodEditor");
  if (!host) return;
  var stored = db.schoolYears[db.currentSchoolYear] && db.schoolYears[db.currentSchoolYear].periods;
  if (!periodDraft) periodDraft = JSON.parse(JSON.stringify(periodsFor(db, db.currentSchoolYear)));
  host.innerHTML = "";

  var readOnly = isArchivedSchoolYear(db);
  host.appendChild(el(
    "p", "hint",
    (stored ? "" : "Dit zijn voorgestelde data, nog niet bewaard. Controleer ze en klik op Periodes opslaan. ") +
      "Een periode loopt van haar startdatum tot de dag vóór de volgende periode. Wijzigingen gelden voor " +
      db.currentSchoolYear + " en worden gedeeld met je collega's.",
  ));

  periodDraft.list.forEach(function (p, i) {
    var row = el("div", "period-row");
    var name = document.createElement("input");
    name.type = "text";
    name.value = p.name;
    name.className = "period-name";
    name.setAttribute("aria-label", "Naam periode " + (i + 1));
    name.disabled = readOnly;
    name.addEventListener("input", function () { p.name = name.value; });
    var start = document.createElement("input");
    start.type = "date";
    start.value = p.start;
    start.className = "period-start";
    start.setAttribute("aria-label", "Startdatum " + (p.name || "periode " + (i + 1)));
    start.disabled = readOnly;
    start.addEventListener("input", function () { p.start = start.value; });
    start.addEventListener("change", function () { p.start = start.value; });
    row.appendChild(name);
    row.appendChild(el("span", "period-label", "vanaf"));
    row.appendChild(start);
    if (periodDraft.list.length > 1 && !readOnly) {
      var del = el("button", "btn-ghost btn-small", "Verwijderen");
      del.type = "button";
      del.addEventListener("click", function () {
        periodDraft.list.splice(i, 1);
        renderPeriodEditor();
      });
      row.appendChild(del);
    }
    host.appendChild(row);
  });

  var endRow = el("div", "period-row");
  endRow.appendChild(el("span", "period-label period-end-label", "Laatste periode loopt tot en met"));
  var end = document.createElement("input");
  end.type = "date";
  end.value = periodDraft.end;
  end.className = "period-end";
  end.disabled = readOnly;
  end.addEventListener("input", function () { periodDraft.end = end.value; });
  end.addEventListener("change", function () { periodDraft.end = end.value; });
  endRow.appendChild(end);
  host.appendChild(endRow);

  if (readOnly) return;

  var btns = el("div", "btn-row");
  btns.style.marginTop = "10px";
  var add = el("button", "btn-ghost btn-small", "Periode toevoegen");
  add.type = "button";
  add.addEventListener("click", function () {
    var last = periodDraft.list[periodDraft.list.length - 1];
    periodDraft.list.push({ name: "GE" + (periodDraft.list.length + 1), start: last && isValidIso(last.start) ? isoAddDays(last.start, 1) : "" });
    renderPeriodEditor();
  });
  var save = el("button", "btn-primary btn-small", "Periodes opslaan");
  save.type = "button";
  save.id = "btnSavePeriods";
  save.addEventListener("click", savePeriodDraft);
  btns.appendChild(add);
  btns.appendChild(save);
  host.appendChild(btns);
}

function savePeriodDraft() {
  periodDraft.list.forEach(function (p) { p.name = p.name.trim(); });
  var problems = validatePeriods(periodDraft);
  if (problems.length) {
    showNotice("warn", "Periodes niet opgeslagen", problems.join(" "));
    return;
  }
  var bucket = db.schoolYears[db.currentSchoolYear];
  bucket.periods = { list: JSON.parse(JSON.stringify(periodDraft.list)), end: periodDraft.end, updatedAt: Date.now() };
  periodDraft = null;
  persist();
  fillSkoreSelectors(false);
  renderSkore();
  showNotice("good", "Periodes opgeslagen", "De indeling geldt voor " + db.currentSchoolYear + ".");
}

function initSkore() {
  $("skoreYear").addEventListener("change", function () { fillSkoreSelectors(false); renderSkore(); });
  $("skoreKlas").addEventListener("change", renderSkore);
  $("skorePeriod").addEventListener("change", function () {
    skoreState.period = Number($("skorePeriod").value);
    renderSkore();
  });
  $("skoreScale").addEventListener("change", renderSkore);
  $("skorePrev").addEventListener("click", function () { stepSkorePeriod(-1); });
  $("skoreNext").addEventListener("click", function () { stepSkorePeriod(1); });
  $("skorePeriodsWrap").addEventListener("toggle", function () {
    // Niet-bewaarde wijzigingen vervallen bij het DICHTklappen, zodat je
    // bij het openen vertrekt van wat er echt bewaard is. Bewust niet bij
    // het openklappen: het toggle-event komt een fractie later, en op een
    // trage computer zou het dan een net ingevulde datum wissen.
    if (!this.open) { periodDraft = null; renderPeriodEditor(); }
  });
}
