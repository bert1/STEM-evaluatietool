/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* Selectie                                                            */
/* ------------------------------------------------------------------ */

/* Vult de keuzelijsten voor klas en evaluatie. Behoudt de huidige keuze
   als die er nog in zit — nodig na een samenvoeging of een nieuwe klaslijst. */
function fillClassAndEvalOptions(year) {
  var prevClasses = selectedKlassen();
  var prevEval = $("evalSelect").value;
  fillSubjectOptions(year);
  var subject = selectedSubject();

  $("classSelect").innerHTML = "";
  $("evalSelect").innerHTML = "";
  $("evalSelect").appendChild(new Option("Kies een evaluatie", ""));

  if (year && CONFIG[year]) {
    classesForSubject(db, year, subject).forEach(function (c) {
      $("classSelect").appendChild(new Option(c, c));
    });

    fillGroupedEvalSelect($("evalSelect"), year, "Evaluaties", subject);

    $("classSelect").disabled = false;
    $("evalSelect").disabled = false;
  } else {
    $("classSelect").appendChild(new Option("Kies eerst een jaar", ""));
    $("classSelect").disabled = true;
    $("evalSelect").disabled = true;
  }

  prevClasses.forEach(function (c) {
    var opt = $("classSelect").querySelector('option[value="' + cssEscape(c) + '"]');
    if (opt) opt.selected = true;
  });
  if (prevEval && $("evalSelect").querySelector('option[value="' + cssEscape(prevEval) + '"]')) {
    $("evalSelect").value = prevEval;
  }

  // De echte <select> hierboven is enkel nog voor waarde/"change"-event
  // en voor tests — zichtbaar is voortaan het paneel hieronder.
  syncEvalComboDisplay();
  syncKlasMultiDisplay();
}

/* Evaluaties van een leerjaar, gegroepeerd per map in de volgorde van
   het Rubrics-scherm. Gedeeld door de zoeklijst bij Evalueren en die bij
   Resultaten. Met een vak (sinds 1.28.0) enkel de evaluaties van dat vak. */
function evaluationGroups(year, subject) {
  if (!year || !CONFIG[year]) return [];

  var folders = evaluationFoldersFor(db, year);
  var byFolder = {};
  folders.forEach(function (f) { byFolder[f] = []; });
  var ongeordend = [];
  evaluationNames(db, year).forEach(function (name) {
    if (!evaluationInSubject(db, year, name, subject)) return;
    var ev = getEvaluation(db, year, name);
    var f = ev && ev.folder;
    if (f && byFolder[f]) byFolder[f].push(name);
    else ongeordend.push(name);
  });

  var groups = [];
  folders.forEach(function (f) {
    if (byFolder[f].length) groups.push({ label: f, names: byFolder[f] });
  });
  if (ongeordend.length) {
    groups.push({ label: folders.length ? "Geen map" : "", names: ongeordend });
  }
  return groups;
}

/* Vult een (onzichtbare) <select> met één <optgroup> per map, in dezelfde
   indeling als de zoeklijst. Evaluaties zonder map krijgen de kop
   "Geen map"; zijn er helemaal geen mappen, dan fallbackLabel (of geen
   <optgroup> als die leeg is). Bestaande opties blijven staan. */
function fillGroupedEvalSelect(select, year, fallbackLabel, subject) {
  evaluationGroups(year, subject).forEach(function (g) {
    var label = g.label || fallbackLabel;
    var parent = select;
    if (label) {
      parent = document.createElement("optgroup");
      parent.label = label;
      select.appendChild(parent);
    }
    g.names.forEach(function (name) { parent.appendChild(new Option(name, name)); });
  });
}

/* Zelfgetekende zoek-vervolgkeuzelijst voor het evaluatiemoment, zie
   makeSearchCombo() in js/ui.js. De echte <select id="evalSelect">
   hierboven blijft volledig functioneel maar is onzichtbaar. */
var evalCombo = makeSearchCombo({
  inputId: "evalComboInput",
  panelId: "evalComboPanel",
  selectId: "evalSelect",
  wrapId: "evalComboWrap",
  groups: function () { return evaluationGroups($("yearSelect").value, selectedSubject()); },
  isEnabled: function () { return !!($("yearSelect").value && CONFIG[$("yearSelect").value]); },
  placeholder: "Zoek een evaluatie…",
  disabledPlaceholder: "Zoek eerst een jaar en klas…",
  emptyText: "Nog geen evaluaties voor dit leerjaar.",
  emptyTextFn: function () {
    return selectedSubject() ? "Nog geen evaluaties voor dit vak. Kies het vak bij Rubrics." : "Nog geen evaluaties voor dit leerjaar.";
  },
});

function syncEvalComboDisplay() { evalCombo.sync(); }
function openEvalCombo() { evalCombo.open(); }
function closeEvalCombo() { evalCombo.close(); }

/* Klas: zelfgetekende keuzelijst met aanvinkvakjes, meerdere klassen
   tegelijk kiezen. Nodig omdat een stem-les leerlingen van verschillende
   klasgroepen samenbrengt — een groepje kan dus leerlingen uit meer dan
   één klas bevatten, en die moeten samen aangeduid kunnen worden. Zelfde
   architecturaal patroon als de evaluatiemoment-combo hierboven: de echte
   <select id="classSelect" multiple> blijft volledig functioneel (waarde
   via .selectedOptions, "change"-event, en dus ook voor tests) maar is
   onzichtbaar — dit paneel is wat een leerkracht ziet. */

function selectedKlassen() {
  return Array.prototype.slice
    .call($("classSelect").selectedOptions)
    .map(function (o) { return o.value; })
    .filter(function (v) { return v; });
}

function syncKlasMultiDisplay() {
  var btn = $("klasMultiInput");
  var hasYear = !!($("yearSelect").value && CONFIG[$("yearSelect").value]);
  btn.disabled = !hasYear;
  var chosen = selectedKlassen();

  if (!hasYear) {
    btn.textContent = "Kies eerst een jaar";
  } else if (!chosen.length) {
    btn.textContent = "Kies een of meer klassen";
  } else if (chosen.length <= 2) {
    btn.textContent = chosen.join(" + ");
  } else {
    btn.textContent = chosen.length + " klassen gekozen";
  }
  btn.title = chosen.join(", ");

  if (!$("klasMultiPanel").classList.contains("hidden")) renderKlasMultiPanel();
}

function openKlasMulti() {
  if ($("klasMultiInput").disabled) return;
  renderKlasMultiPanel();
  $("klasMultiPanel").classList.remove("hidden");
}

function closeKlasMulti() {
  $("klasMultiPanel").classList.add("hidden");
}

function renderKlasMultiPanel() {
  var panel = $("klasMultiPanel");
  panel.innerHTML = "";
  var year = $("yearSelect").value;
  // Enkel de klassen van het gekozen vak (sinds 1.31.1; daarvoor filterde
  // enkel de onzichtbare <select> en toonde dit paneel alle klassen).
  var subject = selectedSubject();
  var classes = year && CONFIG[year] ? classesForSubject(db, year, subject) : [];

  if (!classes.length) {
    panel.appendChild(el("div", "klas-multi-empty",
      subject ? "Geen klassen voor dit vak. Duid ze aan bij Instellingen, Vakken." : "Nog geen klassen voor dit leerjaar."));
    return;
  }

  var chosen = selectedKlassen();
  classes.forEach(function (klas) {
    var row = el("label", "klas-multi-option");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = klas;
    cb.checked = chosen.indexOf(klas) !== -1;
    cb.addEventListener("change", function () { toggleKlasOption(klas, cb.checked); });
    row.appendChild(cb);
    row.appendChild(el("span", null, klas));
    panel.appendChild(row);
  });
}

function toggleKlasOption(klas, checked) {
  Array.prototype.forEach.call($("classSelect").options, function (o) {
    if (o.value === klas) o.selected = checked;
  });
  $("classSelect").dispatchEvent(new Event("change", { bubbles: true }));
  syncKlasMultiDisplay();
}

function initKlasMulti() {
  var btn = $("klasMultiInput");
  btn.addEventListener("click", function () {
    if ($("klasMultiPanel").classList.contains("hidden")) openKlasMulti();
    else closeKlasMulti();
  });

  document.addEventListener("mousedown", function (e) {
    var wrap = document.querySelector(".klas-multi-wrap");
    if (wrap && !wrap.contains(e.target) && !$("klasMultiPanel").classList.contains("hidden")) {
      closeKlasMulti();
    }
  });
}

function initEvalCombo() {
  evalCombo.init();
}

function cssEscape(v) {
  return String(v).replace(/["\\]/g, "\\$&");
}

function onYearChange() {
  // Altijd opruimen — ook wanneer er een geldig jaar gekozen is.
  // In V2 bleef hier het formulier van de vorige klas staan.
  closeSession();
  Array.prototype.forEach.call($("classSelect").options, function (o) { o.selected = false; });
  $("evalSelect").value = "";
  closeEvalCombo(); // ander leerjaar = andere lijst, oud zoekwoord slaat nergens meer op
  closeKlasMulti();
  fillClassAndEvalOptions($("yearSelect").value);
  Array.prototype.forEach.call($("classSelect").options, function (o) { o.selected = false; });
  $("evalSelect").value = "";
  syncEvalComboDisplay();
  syncKlasMultiDisplay();
}

/* Opent het Evalueren-scherm met dit leerjaar, deze klas en deze
   evaluatie al gekozen (knop "Nu beoordelen" op het Controle-tabblad).
   Doet exact wat een leerkracht met de hand doet: leerjaar kiezen, klas
   aanvinken, evaluatie kiezen, zodat dezelfde functies het werk doen. */
function openEvaluationFor(year, klas, evaluation) {
  $("yearSelect").value = year;
  onYearChange();
  // Het gekozen vak mag de klas of de evaluatie niet verbergen.
  var ev = getEvaluation(db, year, evaluation);
  var subject = (ev && ev.subject) || "";
  if (classesForSubject(db, year, subject).indexOf(klas) === -1) subject = "";
  if ($("subjectSelect").value !== subject) {
    $("subjectSelect").value = subjectNames(db, year).indexOf(subject) !== -1 ? subject : "";
    fillClassAndEvalOptions(year);
  }
  Array.prototype.forEach.call($("classSelect").options, function (o) { o.selected = o.value === klas; });
  $("evalSelect").value = evaluation;
  syncKlasMultiDisplay();
  syncEvalComboDisplay();
  onSelectionChange();
  showView("main");
  var form = $("formCard");
  if (form && !form.classList.contains("hidden")) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onSelectionChange() {
  var year = $("yearSelect").value,
    klassen = selectedKlassen(),
    evaluation = $("evalSelect").value;

  syncKlasMultiDisplay();

  if (year && klassen.length && evaluation) {
    openSession(year, klassen, evaluation);
  } else {
    closeSession();
  }
}

/* klassen: array van één of meer echte klasnamen. Samen vormen ze de
   sessiesleutel (cur.klas, alfabetisch gesorteerd en met "+" verbonden)
   — zo blijft één klas exact hetzelfde als voorheen, en wordt een
   combinatie een eigen, herkenbare sessie die niet botst met de losse
   klassen zelf. */
function openSession(year, klassen, evaluation) {
  cur.year = year;
  cur.klassen = klassen.slice().sort(function (a, b) { return a.localeCompare(b, "nl", { numeric: true }); });
  cur.klas = cur.klassen.join("+");
  cur.evaluation = evaluation;
  cur.rubrics = rubricsFor(db, year, evaluation);
  cur.questions = questionsFor(db, year, evaluation);
  cur.key = sessionKey(year, cur.klas, evaluation);

  if (!db.sessions[cur.key]) db.sessions[cur.key] = [];

  $("formTitle").textContent = cur.klassen.join(" + ") + ": " + evaluation;
  $("maxTotal").textContent = maxScoreOf(cur.rubrics);

  renderStudents();
  renderRubrics();
  renderOpenQuestions();
  resetForm();
  renderTable();

  $("formCard").classList.remove("hidden");
  $("resultsCard").classList.remove("hidden");
}

function closeSession() {
  cur = { year: "", klas: "", klassen: [], evaluation: "", rubrics: [], questions: [], key: "", studentKlasMap: {} };
  $("formCard").classList.add("hidden");
  $("resultsCard").classList.add("hidden");
  $("studentGrid").innerHTML = "";
  $("rubrics").innerHTML = "";
  $("openQuestions").innerHTML = "";
}



/* ------------------------------------------------------------------ */
/* Leerlingen                                                          */
/* ------------------------------------------------------------------ */

/* Kijkt over ALLE klas(-combinaties) van dit jaar en dit evaluatiemoment
   heen — niet enkel de huidige sessie — zodat eenzelfde leerling niet
   twee keer beoordeeld kan worden wanneer die soms solo en soms in een
   combinatie van klassen wordt gezet. De klas van elke leerling wordt
   per rij bijgehouden (r.studentKlas); oudere rijen zonder dat veld
   hadden altijd precies één echte klas per sessie, dus de klas van de
   sessie zelf (p.klas) is daar het juiste antwoord. Enkel meetellen als
   die klas ook bij de huidige selectie hoort — zo lopen gelijknamige
   leerlingen uit andere klassen elkaar niet voor de voeten. */
function evaluatedMap() {
  var map = {};
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== cur.year || p.evaluation !== cur.evaluation) return;
    (db.sessions[key] || []).forEach(function (r) {
      if (r.id === form.editId) return;
      (r.students || []).forEach(function (s) {
        var klas = (r.studentKlas && r.studentKlas[s]) || p.klas;
        if (cur.klassen.indexOf(klas) === -1) return;
        map[s] = r.assessor || "?";
      });
    });
  });
  return map;
}

function renderStudents() {
  var grid = $("studentGrid");
  grid.innerHTML = "";
  var data = studentsForKlassen(db, cur.year, cur.klassen);
  cur.studentKlasMap = data.klasByName;
  var list = data.names;
  var done = evaluatedMap();
  var showKlasBadge = cur.klassen.length > 1;

  list.forEach(function (student) {
    var label = el("label", "student");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = student;
    cb.className = "student-cb";
    cb.addEventListener("change", updateTotals);
    label.appendChild(cb);
    label.appendChild(el("span", null, student));

    var right = el("span", "student-right");
    if (showKlasBadge && data.klasByName[student]) {
      right.appendChild(el("span", "klas-badge", data.klasByName[student]));
    }
    if (done[student]) {
      right.appendChild(el("span", "who", done[student]));
      label.title = "Al beoordeeld door " + done[student];
    }
    label.appendChild(right);

    grid.appendChild(label);
  });

  renderProgress(list, done);
}

function renderProgress(list, done) {
  var total = list.length;
  var count = list.filter(function (s) { return done[s]; }).length;
  var pct = total ? Math.round((count / total) * 100) : 0;

  $("progressFill").style.width = pct + "%";
  $("progressText").textContent = count + " van " + total + " leerlingen beoordeeld";
  renderTeamProgress(list);

  var chips = $("remaining");
  chips.innerHTML = "";
  var left = list.filter(function (s) { return !done[s]; });
  if (!left.length) {
    chips.appendChild(el("span", "chip", "Iedereen beoordeeld"));
    return;
  }
  left.forEach(function (s) { chips.appendChild(el("span", "chip", s)); });
}



/* Wie van het team heeft hoeveel gedaan in deze klas? */
function renderTeamProgress(list) {
  var host = $("teamProgress");
  host.innerHTML = "";

  var assigned = teamForKlassen(db, cur.year, cur.klassen);
  var prog = progressByAssessor(rows(), list);
  var seen = Object.keys(prog.byAssessor);
  var everyone = assigned.slice();
  seen.forEach(function (a) { if (everyone.indexOf(a) === -1) everyone.push(a); });

  if (!everyone.length) return;

  everyone.forEach(function (initials) {
    var n = (prog.byAssessor[initials] || []).length;
    var chip = el("span", "who-chip" + (n ? "" : " idle"), initials + ": " + n);
    chip.title = memberName(db, initials) + (assigned.indexOf(initials) === -1 ? " (niet ingeschreven voor deze klas)" : "");
    host.appendChild(chip);
  });

  if (prog.remaining.length) {
    host.appendChild(el("span", "who-chip none", "nog " + prog.remaining.length));
  }

  var me = cleanAssessor(db.assessor);
  if (me && assigned.length && assigned.indexOf(me) === -1) {
    var warn = el("span", "who-chip none", "jij staat niet ingeschreven voor " + cur.klassen.join(" + "));
    warn.title = "Je kan gewoon verder werken. Pas dit aan in het Teamscherm.";
    host.appendChild(warn);
  }
}

function selectedStudents() {
  return Array.prototype.slice
    .call(document.querySelectorAll(".student-cb:checked"))
    .map(function (cb) { return cb.value; });
}



/* ------------------------------------------------------------------ */
/* Rubrics                                                             */
/* ------------------------------------------------------------------ */

function renderRubrics() {
  var host = $("rubrics");
  host.innerHTML = "";
  var frag = document.createDocumentFragment();

  cur.rubrics.forEach(function (rubric, i) {
    var card = el("div", "rubric-card");
    card.dataset.rubric = rubric.id;

    var head = el("div", "rubric-header");
    head.appendChild(el("span", "num", i + 1));
    head.appendChild(el("h3", null, rubric.name));
    card.appendChild(head);
    card.appendChild(el("p", "rubric-desc", rubric.description));

    var grid = el("div", "option-grid");
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", rubric.name);

    rubric.options.forEach(function (opt) {
      var btn = el("button", "option-btn");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.dataset.score = opt.score;
      btn.appendChild(el("span", "score", opt.score));
      btn.appendChild(el("span", "lbl", opt.label));
      btn.appendChild(el("span", "desc", opt.desc));
      btn.addEventListener("click", function () { selectScore(rubric.id, opt.score); });
      btn.addEventListener("keydown", function (e) { onOptionKey(e, grid); });
      grid.appendChild(btn);
    });

    card.appendChild(grid);
    frag.appendChild(card);
  });

  host.appendChild(frag);
}

function onOptionKey(e, grid) {
  var keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (keys.indexOf(e.key) === -1) return;
  e.preventDefault();
  var btns = Array.prototype.slice.call(grid.querySelectorAll(".option-btn"));
  var i = btns.indexOf(document.activeElement);
  var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  var next = btns[(i + step + btns.length) % btns.length];
  next.focus();
  next.click();
}

/* Cijfertoetsen 1-9: scoort meteen het niveau op die positie binnen het
   "huidige" criterium (waar de focus op staat, of anders het eerste),
   en springt automatisch door naar het volgende criterium — zo scoor je
   een hele rubric zonder de muis aan te raken. Enkel actief terwijl het
   evaluatieformulier echt open staat, en nooit terwijl je in een
   tekstveld aan het typen bent. */
function initScoringShortcuts() {
  document.addEventListener("keydown", function (e) {
    if ($("formCard").classList.contains("hidden")) return;
    if (isTextEntryField(document.activeElement)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var digit = Number(e.key);
    if (!digit || digit < 1 || digit > 9) return;

    var card = currentRubricCard();
    if (!card) return;
    var btns = card.querySelectorAll(".option-btn");
    var btn = btns[digit - 1];
    if (!btn) return;

    e.preventDefault();
    btn.click();
    moveToNextRubricCard(card);
  });
}

/* Een checkbox is ook een <input>, maar daar iets in "typen" bestaat
   niet — enkel echte tekstvelden mogen de cijfertoetsen blokkeren. */
function isTextEntryField(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") {
    var type = (el.type || "text").toLowerCase();
    return ["text", "number", "email", "search", "tel", "url", "password"].indexOf(type) !== -1;
  }
  return false;
}

function currentRubricCard() {
  var active = document.activeElement;
  var fromFocus = active && active.closest && active.closest(".rubric-card");
  if (fromFocus) return fromFocus;
  return $("rubrics").querySelector(".rubric-card");
}

function moveToNextRubricCard(card) {
  var cards = Array.prototype.slice.call($("rubrics").querySelectorAll(".rubric-card"));
  var next = cards[cards.indexOf(card) + 1];
  if (next) {
    var btn = next.querySelector(".option-btn");
    if (btn) btn.focus();
  } else {
    $("btnSave").focus();
  }
}

function selectScore(rubricId, score) {
  form.scores[rubricId] = score;
  paintScores();
  updateTotals();
}

function paintScores() {
  cur.rubrics.forEach(function (rubric) {
    var card = $("rubrics").querySelector('[data-rubric="' + rubric.id + '"]');
    if (!card) return;
    var chosen = form.scores[rubric.id];
    card.classList.toggle("done", typeof chosen === "number");
    card.querySelectorAll(".option-btn").forEach(function (btn) {
      var on = Number(btn.dataset.score) === chosen;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
  });
}

function updateTotals() {
  var max = maxScoreOf(cur.rubrics);
  var sum = cur.rubrics.reduce(function (t, r) {
    var v = form.scores[r.id];
    return t + (typeof v === "number" ? v : 0);
  }, 0);
  $("currentTotal").textContent = sum;
  $("currentPct").textContent = max ? " (" + Math.round((sum / max) * 100) + "%)" : "";

  var chosen = Object.keys(form.scores).length;
  var n = selectedStudents().length;
  var isFormative = $("formativeToggle").checked;

  $("btnSave").textContent =
    form.editId
      ? "Wijziging opslaan"
      : n > 1
        ? "Groep van " + n + " opslaan"
        : "Opslaan";
  $("btnSave").disabled = false;

  var missing = cur.rubrics.length - chosen;
  if (!missing) {
    $("formHint").textContent = "";
  } else if (isFormative) {
    $("formHint").textContent = missing + " van de " + cur.rubrics.length + " criteria nog niet gescoord. Dat mag bij een tussentijdse check.";
  } else {
    $("formHint").textContent = missing + " van de " + cur.rubrics.length + " criteria nog niet gescoord";
  }

  renderCorrections(sum, max, n);
}

/* Bij groepswerk: eerst één gedeelde groepsscore (hierboven), en
   optioneel per leerling een individuele correctie erbovenop. Enkel
   zinvol bij meer dan één geselecteerde leerling — bij één leerling is
   er niets om te corrigeren ten opzichte van. */
function renderCorrections(groupTotal, max, studentCount) {
  var host = $("groupCorrections");
  var students = selectedStudents();

  if (students.length < 2) {
    host.classList.add("hidden");
    host.innerHTML = "";
    return;
  }

  // Correcties van leerlingen die niet meer aangevinkt zijn, horen niet
  // stil te blijven hangen in het formulier.
  Object.keys(form.corrections).forEach(function (name) {
    if (students.indexOf(name) === -1) delete form.corrections[name];
  });

  host.classList.remove("hidden");
  host.innerHTML = "";

  host.appendChild(el("div", "correction-heading", "Individuele correctie (optioneel)"));
  host.appendChild(el("p", "hint",
    "De score hierboven (" + groupTotal + "/" + max + ") geldt voor de hele groep. Wil je voor " +
      "iemand een punt bij- of aftrekken voor individuele inzet, vul dat hier in. De rest van de " +
      "groep blijft ongemoeid.",
  ));

  var list = el("div", "correction-list");
  students.forEach(function (name) {
    var row = el("div", "correction-row");
    row.appendChild(el("span", "correction-name", name));

    var input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.className = "correction-input";
    input.value = form.corrections[name] || 0;
    row.appendChild(input);

    var preview = el("span", "correction-preview");
    row.appendChild(preview);

    function refreshPreview() {
      var correction = form.corrections[name] || 0;
      var total = Math.max(0, Math.min(max, groupTotal + correction));
      var sign = correction > 0 ? "+" + correction : correction < 0 ? String(correction) : "±0";
      preview.textContent = groupTotal + " groep, " + sign + " correctie = " + total + "/" + max;
      preview.classList.toggle("adjusted", !!correction);
      row.classList.toggle("adjusted", !!correction);
    }

    input.addEventListener("input", function () {
      var v = parseInt(this.value, 10);
      if (!v || isNaN(v)) delete form.corrections[name];
      else form.corrections[name] = v;
      refreshPreview();
    });

    refreshPreview();
    list.appendChild(row);
  });
  host.appendChild(list);
}



/* ------------------------------------------------------------------ */
/* Opslaan van een evaluatie                                           */
/* ------------------------------------------------------------------ */

function saveEvaluation() {
  if (isArchivedSchoolYear(db)) {
    showNotice(
      "warn", "Dit schooljaar is een archief",
      "Je bekijkt " + db.currentSchoolYear + ", maar werkt actief in " + db.activeSchoolYear +
        ". Kies het actieve schooljaar bovenaan om te kunnen opslaan.",
    );
    return;
  }

  var students = selectedStudents();
  var assessor = cleanAssessor(db.assessor);

  if (!assessor) {
    // Kan normaal niet meer sinds 1.32.0: de wizard vraagt de initialen.
    showNotice("warn", "Je initialen ontbreken", "Stel je koppeling opnieuw in bij Instellingen, Gebruiker.");
    return;
  }
  if (!students.length) {
    showNotice("warn", "Geen leerling geselecteerd", "Vink minstens één leerling aan. Voor groepswerk vink je ze allemaal aan. Dan krijgen ze dezelfde score.");
    return;
  }
  var isFormative = $("formativeToggle").checked;

  if (!isFormative) {
    var missing = cur.rubrics.filter(function (r) {
      return typeof form.scores[r.id] !== "number";
    });
    if (missing.length) {
      showNotice(
        "warn", "Nog niet alle criteria gescoord",
        "Ontbreekt: " + missing.map(function (r) { return r.name; }).join(", ") +
          ". Gaat het om een tussentijdse controle, vink dan 'Tussentijdse check' aan. Dan hoeft niet alles ingevuld te zijn.",
      );
      return;
    }
  } else if (!Object.keys(form.scores).length) {
    showNotice("warn", "Nog niets gescoord", "Vul minstens één criterium in, ook bij een tussentijdse check.");
    return;
  }

  db.assessor = assessor;

  var corrections = {};
  var studentKlas = {};
  students.forEach(function (name) {
    var v = form.corrections[name];
    if (typeof v === "number" && v) corrections[name] = v;
    studentKlas[name] = (cur.studentKlasMap && cur.studentKlasMap[name]) || cur.klassen[0] || "";
  });

  var row = {
    id: form.editId || makeRowId(assessor),
    assessor: assessor,
    students: students,
    studentKlas: studentKlas,
    scores: JSON.parse(JSON.stringify(form.scores)),
    answers: collectAnswers(),
    rubricVersion: evaluationVersion(db, cur.year, cur.evaluation),
    formative: isFormative,
    feedback: $("feedback").value.trim(),
    feedforward: $("feedforward").value.trim(),
    corrections: corrections,
    updatedAt: Date.now(),
  };

  var list = rows();
  var i = list.findIndex(function (r) { return r.id === row.id; });
  // De datum van de beoordeling zelf (voor de periodes in Skore) blijft
  // behouden bij het bewerken; enkel updatedAt schuift mee.
  var previous = i !== -1 ? list[i] : null;
  row.createdAt = (previous && (previous.createdAt || previous.updatedAt)) || row.updatedAt;
  if (i !== -1) list[i] = row;
  else list.push(row);

  var wasSingleStudent = students.length === 1;

  persist();
  clearNotice();
  updateSafetyBar();
  resetForm();
  renderStudents();
  renderTable();

  // Enkel bij één leerling tegelijk springt de tool automatisch door —
  // bij groepswerk is er geen eenduidige "volgende", dus daar blijft het
  // formulier gewoon leeg staan zoals voorheen.
  if (wasSingleStudent) advanceToNextStudent();
}

/* Vinkt automatisch de eerstvolgende nog niet beoordeelde leerling aan
   en zet de focus meteen op het eerste criterium — samen met de
   cijfertoetsen (zie initScoringShortcuts) kan je zo een hele klas
   doorlopen zonder de muis aan te raken. */
function advanceToNextStudent() {
  var list = studentsForKlassen(db, cur.year, cur.klassen).names;
  var done = evaluatedMap();
  var next = list.filter(function (s) { return !done[s]; })[0];
  if (!next) return; // iedereen beoordeeld — renderProgress toont dat al

  var cb = document.querySelector('.student-cb[value="' + cssEscape(next) + '"]');
  if (!cb) return;
  cb.checked = true;
  updateTotals();

  var firstBtn = $("rubrics").querySelector(".option-btn");
  if (firstBtn) firstBtn.focus();
}

function resetForm() {
  form.editId = null;
  form.scores = {};
  form.corrections = {};
  document.querySelectorAll(".student-cb").forEach(function (cb) { cb.checked = false; });
  fillAnswers({});
  $("feedback").value = "";
  $("feedforward").value = "";
  $("formativeToggle").checked = false;
  $("formSubtitle").textContent = "";
  paintScores();
  updateTotals();
}

function editRow(id) {
  var row = rows().find(function (r) { return r.id === id; });
  if (!row) return;

  form.editId = id;
  form.scores = JSON.parse(JSON.stringify(row.scores));
  form.corrections = JSON.parse(JSON.stringify(row.corrections || {}));
  $("feedback").value = row.feedback || "";
  $("feedforward").value = row.feedforward || "";
  $("formativeToggle").checked = !!row.formative;
  fillAnswers(row.answers);
  $("formSubtitle").textContent = "Je bewerkt een bestaande rij";

  renderStudents(); // herteken zodat deze rij niet als 'al beoordeeld' verschijnt
  document.querySelectorAll(".student-cb").forEach(function (cb) {
    cb.checked = row.students.indexOf(cb.value) !== -1;
  });

  paintScores();
  updateTotals();
  $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteRow(id) {
  var row = rows().find(function (r) { return r.id === id; });
  if (!row) return;
  if (!confirm("Evaluatie van " + row.students.join(" en ") + " verwijderen?")) return;
  db.sessions[cur.key] = rows().filter(function (r) { return r.id !== id; });
  persist();
  if (form.editId === id) resetForm();
  renderStudents();
  renderTable();
}

function clearSession() {
  if (!rows().length) return;
  if (!confirm("Alle " + rows().length + " evaluaties van " + cur.klassen.join(" + ") + " voor " + cur.evaluation + " verwijderen?\n\nDit raakt alleen deze klas(sen) en dit evaluatiemoment.")) return;
  db.sessions[cur.key] = [];
  persist();
  resetForm();
  renderStudents();
  renderTable();
}



/* ------------------------------------------------------------------ */
/* Tabel                                                               */
/* ------------------------------------------------------------------ */

function renderTable() {
  var head = $("tableHead"),
    body = $("tableBody");
  head.innerHTML = "";
  body.innerHTML = "";

  var max = maxScoreOf(cur.rubrics);
  var list = rows();
  var dupes = findDuplicates(list);

  var hr = document.createElement("tr");
  ["Leerling(en)", "Door"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
  cur.rubrics.forEach(function (r, i) {
    var th = el("th", null, i + 1);
    th.title = r.name;
    th.style.textAlign = "center";
    hr.appendChild(th);
  });
  ["Totaal", "%", "Feedback"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
  cur.questions.forEach(function (q) {
    var th = el("th", null, q.label.length > 18 ? q.label.slice(0, 17) + "…" : q.label);
    th.title = q.label;
    hr.appendChild(th);
  });
  hr.appendChild(el("th", null, ""));
  head.appendChild(hr);

  $("rowCount").textContent = list.length
    ? list.length + (list.length === 1 ? " rij" : " rijen")
    : "";

  if (!list.length) {
    var tr = document.createElement("tr");
    var td = el("td", "empty", "Nog niets opgeslagen. Vink hierboven leerlingen aan en scoor de criteria.");
    td.colSpan = cur.rubrics.length + cur.questions.length + 6;
    tr.appendChild(td);
    body.appendChild(tr);
    renderConflictNotice(dupes);
    return;
  }

  list.forEach(function (row) {
    var tr = document.createElement("tr");
    if (dupes.rowIds[row.id]) tr.className = "conflict";

    var nameCell = el("td");
    nameCell.appendChild(el("strong", null, row.students.join(" + ")));
    if (row.formative) {
      nameCell.appendChild(document.createTextNode(" "));
      var f = el("span", "badge formative", "tussentijds");
      f.title = "Formatieve check, niet meegeteld als eindbeoordeling";
      nameCell.appendChild(f);
    }
    if (row.corrections && Object.keys(row.corrections).length) {
      nameCell.appendChild(document.createTextNode(" "));
      var cbadge = el("span", "badge correction up", "correctie");
      cbadge.title = correctionsSummary(row.corrections);
      nameCell.appendChild(cbadge);
    }
    if (dupes.rowIds[row.id]) {
      nameCell.appendChild(document.createTextNode(" "));
      var b = el("span", "badge warn", "dubbel");
      b.title = "Deze leerling staat in meer dan één rij";
      nameCell.appendChild(b);
    }
    tr.appendChild(nameCell);

    tr.appendChild(el("td", null, row.assessor || "–"));

    var total = rowTotal(row, cur.rubrics);
    cur.rubrics.forEach(function (r) {
      var v = row.scores[r.id];
      tr.appendChild(el("td", "num", typeof v === "number" ? v : "–"));
    });

    tr.appendChild(el("td", "total", total + "/" + max));
    tr.appendChild(el("td", "num", max ? Math.round((total / max) * 100) + "%" : "–"));

    var fb = el("td", "feedback-cell", row.feedback || "–");
    fb.title = row.feedback || "";
    tr.appendChild(fb);

    cur.questions.forEach(function (q) {
      var text = (row.answers && row.answers[q.id]) || "";
      var cell = el("td", "feedback-cell", text || "–");
      cell.title = text;
      tr.appendChild(cell);
    });

    var actions = el("td");
    var edit = el("button", "btn-ghost btn-small", "Bewerk");
    edit.type = "button";
    edit.addEventListener("click", function () { editRow(row.id); });
    var del = el("button", "btn-danger btn-small", "Verwijder");
    del.type = "button";
    del.style.marginLeft = "6px";
    del.addEventListener("click", function () { deleteRow(row.id); });
    actions.appendChild(edit);
    actions.appendChild(del);
    tr.appendChild(actions);

    body.appendChild(tr);
  });

  renderConflictNotice(dupes);
}

function renderConflictNotice(dupes) {
  var host = $("conflicts");
  host.innerHTML = "";
  if (!dupes.students.length) return;
  var names = dupes.students.map(function (d) { return d.student; }).join(", ");
  var box = el("div", "notice warn");
  box.appendChild(el("strong", null, "Deze leerlingen staan in meer dan één rij"));
  box.appendChild(document.createTextNode(
    names + ". Meestal betekent dit dat jij en je collega dezelfde groep beoordeeld hebben. " +
    "Er is niets weggegooid. Verwijder zelf de rij die weg mag, of laat beide staan als je de scores wil vergelijken.",
  ));
  host.appendChild(box);
}

/* ------------------------------------------------------------------ */
/* Open vragen in het evaluatieformulier                               */
/* ------------------------------------------------------------------ */

function renderOpenQuestions() {
  var host = $("openQuestions");
  host.innerHTML = "";
  if (!cur.questions.length) return;

  cur.questions.forEach(function (q) {
    var group = el("div", "form-group");
    group.style.marginTop = "16px";
    group.appendChild(el("label", null, q.label));
    var ta = document.createElement("textarea");
    ta.id = "answer-" + q.id;
    ta.className = "answer-field";
    ta.dataset.question = q.id;
    ta.placeholder = q.hint || "";
    ta.style.minHeight = "58px";
    group.appendChild(ta);
    host.appendChild(group);
  });
}

function collectAnswers() {
  var out = {};
  document.querySelectorAll(".answer-field").forEach(function (ta) {
    var v = ta.value.trim();
    if (v) out[ta.dataset.question] = v;
  });
  return out;
}

function fillAnswers(answers) {
  document.querySelectorAll(".answer-field").forEach(function (ta) {
    ta.value = (answers && answers[ta.dataset.question]) || "";
  });
}
