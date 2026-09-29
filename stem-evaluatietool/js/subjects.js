/* ------------------------------------------------------------------
   VAKKEN (sinds 1.28.0)

   Per leerjaar een lijst vakken, bv. "STEM-wetenschappen" voor 2STa en
   "Techniek" voor 2TWa. Een evaluatie hoort bij één vak (ev.subject,
   leeg = geen vak). Op het Evalueren-scherm kies je een vak en zie je
   enkel de klassen en evaluaties van dat vak.

   Opslag: db.subjects[leerjaar] = [{name, classes: [klas], updatedAt}].
   Net als de rubrics niet aan een schooljaar gebonden: vakken en
   klasnamen blijven meestal jaren gelijk. Zonder gekoppelde klassen
   toont een vak alle klassen van het leerjaar.
   ------------------------------------------------------------------ */

/* Het gekozen vak per leerjaar op dit toestel. Enkel een gemak voor wie
   elke dag hetzelfde vak geeft, daarom niet in het werkbestand. */
var SUBJECT_CHOICE_KEY = "STEM_EVAL_VAK";

function cleanSubjectName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function subjectsFor(dbObj, year) {
  return ((dbObj.subjects && dbObj.subjects[year]) || []).slice();
}

function subjectNames(dbObj, year) {
  return subjectsFor(dbObj, year).map(function (s) { return s.name; });
}

function findSubject(dbObj, year, name) {
  return subjectsFor(dbObj, year).filter(function (s) { return s.name === name; })[0] || null;
}

function addSubject(dbObj, year, name) {
  var clean = cleanSubjectName(name);
  if (!clean) return false;
  if (!dbObj.subjects) dbObj.subjects = {};
  if (!dbObj.subjects[year]) dbObj.subjects[year] = [];
  var lower = clean.toLowerCase();
  if (dbObj.subjects[year].some(function (s) { return s.name.toLowerCase() === lower; })) return false;
  dbObj.subjects[year].push({ name: clean, classes: [], updatedAt: Date.now() });
  return true;
}

/* Klas aan- of afvinken bij een vak. */
function setSubjectClass(dbObj, year, name, klas, on) {
  var s = findSubject(dbObj, year, name);
  if (!s) return false;
  var i = s.classes.indexOf(klas);
  if (on && i === -1) s.classes.push(klas);
  else if (!on && i !== -1) s.classes.splice(i, 1);
  else return false;
  s.classes.sort(function (a, b) { return a.localeCompare(b, "nl", { numeric: true }); });
  s.updatedAt = Date.now();
  return true;
}

/* Het vak verdwijnt, de evaluaties niet: die komen bij "Geen vak". */
function deleteSubject(dbObj, year, name, scope) {
  if (dbObj.subjects && dbObj.subjects[year]) {
    dbObj.subjects[year] = dbObj.subjects[year].filter(function (s) { return s.name !== name; });
  }
  Object.keys((dbObj.evaluations && dbObj.evaluations[year]) || {}).forEach(function (evName) {
    var ev = dbObj.evaluations[year][evName];
    if (ev.subject === name) {
      ev.subject = "";
      ev.updatedAt = Date.now();
    }
  });
  recordDeletion("subjects", year + "||" + name, scope);
}

function setEvaluationSubject(dbObj, year, evalName, subject) {
  var ev = getEvaluation(dbObj, year, evalName);
  if (!ev) return;
  ev.subject = subject || "";
  ev.updatedAt = Date.now();
}

/* Hoort deze evaluatie bij het gekozen vak? Leeg vak = alle vakken. */
function evaluationInSubject(dbObj, year, evalName, subject) {
  if (!subject) return true;
  var ev = getEvaluation(dbObj, year, evalName);
  return !!ev && ev.subject === subject;
}

/* Klassen van een vak, enkel die er dit schooljaar echt zijn. Heeft het
   vak geen gekoppelde klassen, dan alle klassen van het leerjaar. */
function classesForSubject(dbObj, year, subject) {
  var all = classesFor(dbObj, year);
  var s = subject ? findSubject(dbObj, year, subject) : null;
  if (!s || !s.classes.length) return all;
  return all.filter(function (k) { return s.classes.indexOf(k) !== -1; });
}

/* Nieuwste versie van een vak wint (klassen); verwijderen gaat via de
   tombstones, net als bij de mappen. De volgorde blijft die van wie
   het vak eerst had. */
function mergeSubjects(target, incoming) {
  var added = [];
  if (!target.subjects) target.subjects = {};

  Object.keys(incoming || {}).forEach(function (year) {
    if (!target.subjects[year]) target.subjects[year] = [];
    (incoming[year] || []).forEach(function (s) {
      if (!s || !s.name) return;
      if (isTombstoned("subjects", year + "||" + s.name, s.updatedAt)) return;
      var list = target.subjects[year];
      var existing = list.filter(function (x) { return x.name === s.name; })[0];
      if (!existing) {
        list.push({ name: s.name, classes: (s.classes || []).slice(), updatedAt: s.updatedAt || 0 });
        added.push(s.name + " [" + year + "]");
      } else if ((s.updatedAt || 0) > (existing.updatedAt || 0)) {
        existing.classes = (s.classes || []).slice();
        existing.updatedAt = s.updatedAt;
      }
    });
  });

  Object.keys(target.subjects).forEach(function (year) {
    target.subjects[year] = target.subjects[year].filter(function (s) {
      return !isTombstoned("subjects", year + "||" + s.name, s.updatedAt);
    });
  });
  return added;
}

function normaliseSubjects(src) {
  var out = {};
  Object.keys(src || {}).forEach(function (year) {
    if (!Array.isArray(src[year])) return;
    var seen = {};
    out[year] = [];
    src[year].forEach(function (s) {
      var name = cleanSubjectName(s && s.name);
      if (!name || seen[name]) return;
      seen[name] = true;
      out[year].push({
        name: name,
        classes: Array.isArray(s.classes) ? s.classes.filter(function (k) { return typeof k === "string" && k; }) : [],
        updatedAt: s.updatedAt || 0,
      });
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Klaslijsten-scherm: vakken beheren                                   */
/* ------------------------------------------------------------------ */

function renderSubjectSection() {
  var yearSel = $("subjectYear");
  if (!yearSel.options.length) {
    Object.keys(CONFIG).forEach(function (y) { yearSel.appendChild(new Option(y, y)); });
    var chosen = $("yearSelect").value;
    if (chosen && CONFIG[chosen]) yearSel.value = chosen;
  }
  var year = yearSel.value;
  var host = $("subjectList");
  host.innerHTML = "";

  var list = subjectsFor(db, year);
  if (!list.length) {
    host.appendChild(el("div", "empty", "Nog geen vakken voor " + year + "."));
    return;
  }

  var classes = classesFor(db, year);
  list.forEach(function (s) {
    var row = el("div", "subject-row");
    var head = el("div", "subject-head");
    var count = Object.keys((db.evaluations && db.evaluations[year]) || {}).filter(function (n) {
      return db.evaluations[year][n].subject === s.name;
    }).length;
    head.appendChild(el("strong", "subject-name", s.name));
    head.appendChild(el("span", "hint subject-count", count + (count === 1 ? " evaluatie" : " evaluaties")));

    var del = el("button", "btn-ghost btn-small", "Vak verwijderen");
    del.type = "button";
    del.addEventListener("click", function () {
      askDeleteScope(
        'Vak "' + s.name + '" verwijderen?',
        ["De evaluaties van dit vak blijven gewoon bestaan: ze komen bij \"Geen vak\"."],
        function (scope) {
          deleteSubject(db, year, s.name, scope);
          persist();
          renderSubjectSection();
          refreshAll();
          showNotice("good", 'Vak "' + s.name + '" verwijderd', "");
        },
      );
    });
    head.appendChild(del);
    row.appendChild(head);

    var label = el("div", "hint subject-classes-label",
      "Welke klassen volgen dit vak? Duid niets aan en je ziet alle klassen.");
    row.appendChild(label);
    var chips = el("div", "btn-row subject-classes");
    if (!classes.length) {
      chips.appendChild(el("span", "hint", "Nog geen klassen in dit leerjaar."));
    }
    classes.forEach(function (klas) {
      var chip = el("button", "chip-toggle", klas);
      chip.type = "button";
      chip.setAttribute("aria-pressed", s.classes.indexOf(klas) !== -1 ? "true" : "false");
      chip.addEventListener("click", function () {
        var on = chip.getAttribute("aria-pressed") !== "true";
        setSubjectClass(db, year, s.name, klas, on);
        persist();
        renderSubjectSection();
        refreshSubjectFilter();
      });
      chips.appendChild(chip);
    });
    row.appendChild(chips);
    host.appendChild(row);
  });
}

function onAddSubject() {
  var year = $("subjectYear").value;
  var input = $("subjectName");
  var name = cleanSubjectName(input.value);
  if (!name) {
    showNotice("warn", "Vul de naam van het vak in", "");
    input.focus();
    return;
  }
  if (!addSubject(db, year, name)) {
    showNotice("warn", "Dit vak bestaat al", 'Er is al een vak "' + name + '" in ' + year + ".");
    return;
  }
  input.value = "";
  persist();
  renderSubjectSection();
  refreshSubjectFilter();
  showNotice("good", "Vak toegevoegd: " + name,
    "Duid hieronder aan welke klassen dit vak volgen. Bij Rubrics kies je bij elke evaluatie het vak.");
}

function initSubjects() {
  $("subjectYear").addEventListener("change", renderSubjectSection);
  $("btnAddSubject").addEventListener("click", onAddSubject);
  $("subjectName").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); onAddSubject(); }
  });
  $("subjectSelect").addEventListener("change", onSubjectChange);
}

/* ------------------------------------------------------------------ */
/* Evalueren-scherm: vak kiezen                                         */
/* ------------------------------------------------------------------ */

function selectedSubject() {
  var sel = $("subjectSelect");
  return sel ? sel.value : "";
}

function rememberedSubject(year) {
  try {
    var saved = JSON.parse(localStorage.getItem(SUBJECT_CHOICE_KEY) || "{}");
    return (saved && saved[year]) || "";
  } catch (e) {
    return "";
  }
}

function rememberSubject(year, subject) {
  try {
    var saved = JSON.parse(localStorage.getItem(SUBJECT_CHOICE_KEY) || "{}") || {};
    saved[year] = subject;
    localStorage.setItem(SUBJECT_CHOICE_KEY, JSON.stringify(saved));
  } catch (e) {}
}

/* Vult de keuzelijst met vakken. Zonder vakken voor dit leerjaar blijft
   ze verborgen: dan werkt alles zoals vroeger. */
function fillSubjectOptions(year) {
  var sel = $("subjectSelect");
  // Ander leerjaar: het vak dat je daar het laatst koos.
  var prev = sel.getAttribute("data-year") === year ? sel.value : rememberedSubject(year);
  sel.setAttribute("data-year", year || "");
  sel.innerHTML = "";
  var names = year && CONFIG[year] ? subjectNames(db, year) : [];
  $("subjectWrap").classList.toggle("hidden", !names.length);
  sel.appendChild(new Option("Alle vakken", ""));
  names.forEach(function (n) { sel.appendChild(new Option(n, n)); });
  sel.value = names.indexOf(prev) !== -1 ? prev : "";
}

function onSubjectChange() {
  var year = $("yearSelect").value;
  rememberSubject(year, selectedSubject());
  closeEvalCombo();
  closeKlasMulti();
  fillClassAndEvalOptions(year);
  onSelectionChange();
}

/* Na een wijziging aan de vakken: keuzelijsten bij Evalueren opnieuw
   vullen, en een open beoordeling sluiten als haar klas of evaluatie
   niet meer bij het gekozen vak hoort. */
function refreshSubjectFilter() {
  fillClassAndEvalOptions($("yearSelect").value);
  closeSessionIfHidden();
}

function closeSessionIfHidden() {
  if (!cur.key) return false;
  var shown = selectedKlassen();
  var hidden = $("evalSelect").value !== cur.evaluation ||
    cur.klassen.some(function (k) { return shown.indexOf(k) === -1; });
  if (hidden) closeSession();
  return hidden;
}
