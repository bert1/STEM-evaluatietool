/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* Selectie                                                            */
/* ------------------------------------------------------------------ */

/* Vult de keuzelijsten voor klas en evaluatie. Behoudt de huidige keuze
   als die er nog in zit — nodig na een samenvoeging of een nieuwe klaslijst. */
function fillClassAndEvalOptions(year) {
  var prevClasses = selectedKlassen();
  var prevEval = $("evalSelect").value;

  $("classSelect").innerHTML = "";
  $("evalSelect").innerHTML = "";
  $("evalSelect").appendChild(new Option("Kies een evaluatie", ""));

  if (year && CONFIG[year]) {
    classesFor(db, year).forEach(function (c) {
      $("classSelect").appendChild(new Option(c, c));
    });

    var folders = evaluationFoldersFor(db, year);
    var byFolder = {};
    folders.forEach(function (f) { byFolder[f] = []; });
    var ongeordend = [];
    evaluationNames(db, year).forEach(function (name) {
      var ev = getEvaluation(db, year, name);
      var f = ev && ev.folder;
      if (f && byFolder[f]) byFolder[f].push(name);
      else ongeordend.push(name);
    });

    folders.forEach(function (f) {
      if (!byFolder[f].length) return;
      var group = document.createElement("optgroup");
      group.label = f;
      byFolder[f].forEach(function (name) { group.appendChild(new Option(name, name)); });
      $("evalSelect").appendChild(group);
    });
    if (ongeordend.length) {
      var restGroup = document.createElement("optgroup");
      restGroup.label = folders.length ? "Geen map" : "Evaluaties";
      ongeordend.forEach(function (name) { restGroup.appendChild(new Option(name, name)); });
      $("evalSelect").appendChild(restGroup);
    }

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
   Resultaten. */
function evaluationGroups(year) {
  if (!year || !CONFIG[year]) return [];

  var folders = evaluationFoldersFor(db, year);
  var byFolder = {};
  folders.forEach(function (f) { byFolder[f] = []; });
  var ongeordend = [];
  evaluationNames(db, year).forEach(function (name) {
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

/* Zelfgetekende zoek-vervolgkeuzelijst voor het evaluatiemoment, zie
   makeSearchCombo() in js/ui.js. De echte <select id="evalSelect">
   hierboven blijft volledig functioneel maar is onzichtbaar. */
var evalCombo = makeSearchCombo({
  inputId: "evalComboInput",
  panelId: "evalComboPanel",
  selectId: "evalSelect",
  wrapId: "evalComboWrap",
  groups: function () { return evaluationGroups($("yearSelect").value); },
  isEnabled: function () { return !!($("yearSelect").value && CONFIG[$("yearSelect").value]); },
  placeholder: "Zoek een evaluatie…",
  disabledPlaceholder: "Zoek eerst een jaar en klas…",
  emptyText: "Nog geen evaluaties voor dit leerjaar.",
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
  var classes = year && CONFIG[year] ? classesFor(db, year) : [];

  if (!classes.length) {
    panel.appendChild(el("div", "klas-multi-empty", "Nog geen klassen voor dit leerjaar."));
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

  $("formTitle").textContent = cur.klassen.join(" + ") + " — " + evaluation;
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

  var me = cleanAssessor($("assessor").value);
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
    $("formHint").textContent = missing + " van de " + cur.rubrics.length + " criteria nog niet gescoord — mag bij een tussentijdse check.";
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
      "iemand een punt bij- of aftrekken voor individuele inzet, vul dat hier in — de rest van de " +
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
  var assessor = cleanAssessor($("assessor").value);

  if (!assessor) {
    showNotice("warn", "Vul eerst je initialen in", "Die staan bovenaan. Zonder initialen kan je je werk later niet samenvoegen met dat van je collega.");
    $("assessor").focus();
    return;
  }
  if (!students.length) {
    showNotice("warn", "Geen leerling geselecteerd", "Vink minstens één leerling aan. Voor groepswerk vink je ze allemaal aan — dan krijgen ze dezelfde score.");
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
          ". Gaat het om een tussentijdse controle, vink dan 'Tussentijdse check' aan — dan hoeft niet alles ingevuld te zijn.",
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

    tr.appendChild(el("td", null, row.assessor || "—"));

    var total = rowTotal(row, cur.rubrics);
    cur.rubrics.forEach(function (r) {
      var v = row.scores[r.id];
      tr.appendChild(el("td", "num", typeof v === "number" ? v : "—"));
    });

    tr.appendChild(el("td", "total", total + "/" + max));
    tr.appendChild(el("td", "num", max ? Math.round((total / max) * 100) + "%" : "—"));

    var fb = el("td", "feedback-cell", row.feedback || "—");
    fb.title = row.feedback || "";
    tr.appendChild(fb);

    cur.questions.forEach(function (q) {
      var text = (row.answers && row.answers[q.id]) || "";
      var cell = el("td", "feedback-cell", text || "—");
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
    "Er is niets weggegooid — verwijder zelf de rij die weg mag, of laat beide staan als je de scores wil vergelijken.",
  ));
  host.appendChild(box);
}

/* ---- overgenomen uit core.js ---- */



/* ------------------------------------------------------------------
   EVALUATIES (rubrics en open vragen)
   Staan in het werkbestand, niet in de HTML. Zo maak je een nieuw
   project aan zonder de tool te bewerken.

   evaluations = { "1ste jaar": { "Challenge windei": {
     rubrics: [{ id, name, description, options: [{score,label,desc}] }],
     questions: [{ id, label, hint }],
     updatedAt
   } } }
   ------------------------------------------------------------------ */

function seedEvaluations(config) {
  var out = {};
  Object.keys(config).forEach(function (year) {
    out[year] = {};
    Object.keys(config[year].evaluations).forEach(function (name) {
      out[year][name] = {
        rubrics: JSON.parse(JSON.stringify(config[year].evaluations[name])),
        questions: [],
        version: 1,
        history: {},
        updatedAt: 0,
      };
    });
  });
  return out;
}

function evaluationNames(db, year) {
  if (db.evaluations && db.evaluations[year]) {
    return Object.keys(db.evaluations[year]).sort(function (a, b) {
      return a.localeCompare(b, "nl");
    });
  }
  return [];
}

function getEvaluation(db, year, name) {
  if (db.evaluations && db.evaluations[year] && db.evaluations[year][name]) {
    return db.evaluations[year][name];
  }
  return null;
}

function rubricsFor(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev ? ev.rubrics || [] : [];
}

function questionsFor(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev ? ev.questions || [] : [];
}



/* Sleutels moeten stabiel blijven: ze koppelen opgeslagen scores aan
   het juiste criterium. Alleen nieuwe krijgen een nieuwe sleutel. */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
}

function uniqueId(base, taken) {
  var id = slugify(base) || "criterium";
  if (taken.indexOf(id) === -1) return id;
  var n = 2;
  while (taken.indexOf(id + "-" + n) !== -1) n++;
  return id + "-" + n;
}



/* Standaardniveaus, zodat een nieuw criterium meteen de juiste vorm heeft. */
var LEVEL_TEMPLATES = {
  3: ["Onvoldoende", "Voldoende", "Goed"],
  4: ["Onvoldoende", "Matig", "Goed", "Zeer Goed"],
  5: ["Onvoldoende", "Matig", "Voldoende", "Goed", "Zeer Goed"],
}



/* Staan de punten op 1, 2, 3 … zonder gaten? Dan wil de leerkracht bijna
   zeker dat het zo blijft wanneer er een niveau bijkomt of wegvalt. */
function isSequentialScores(options) {
  if (!options || !options.length) return false;
  var scores = options.map(function (o) { return Number(o.score); });
  if (scores.some(function (s) { return !isFinite(s); })) return false;
  var sorted = scores.slice().sort(function (a, b) { return a - b; });
  return sorted.every(function (s, i) { return s === i + 1; });
}



/* Hernummert in de volgorde waarin de niveaus op het scherm staan. */
function renumberScores(options) {
  options.forEach(function (o, i) { o.score = i + 1; });
  return options;
}

function blankRubric(count, taken) {
  var labels = LEVEL_TEMPLATES[count] || LEVEL_TEMPLATES[5];
  return {
    id: uniqueId("nieuw-criterium", taken || []),
    name: "",
    description: "",
    options: labels.map(function (label, i) {
      return { score: i + 1, label: label, desc: "" };
    }),
  };
}

function blankQuestion(taken) {
  return { id: uniqueId("open-vraag", taken || []), label: "", hint: "" };
}



/* Controle vóór opslaan. Levert een lijst met leesbare problemen op. */
function validateEvaluation(draft, db, originalName) {
  var problems = [];
  var name = String(draft.name || "").trim();

  if (!name) problems.push("Geef de evaluatie een naam.");
  if (name.indexOf("|") !== -1) problems.push("De naam mag geen | bevatten.");

  var existing = evaluationNames(db, draft.year);
  if (name && name !== originalName && existing.indexOf(name) !== -1) {
    problems.push('Er bestaat al een evaluatie "' + name + '" in ' + draft.year + ".");
  }

  if (!draft.rubrics.length) problems.push("Voeg minstens één criterium toe.");

  var seenIds = [];
  draft.rubrics.forEach(function (r, i) {
    var nr = "Criterium " + (i + 1);
    if (!String(r.name || "").trim()) problems.push(nr + " heeft nog geen naam.");
    if (seenIds.indexOf(r.id) !== -1) problems.push(nr + " heeft een dubbele sleutel.");
    seenIds.push(r.id);

    if (!r.options || r.options.length < 2) {
      problems.push(nr + " heeft minstens twee niveaus nodig.");
      return;
    }
    var scores = [];
    r.options.forEach(function (o, j) {
      if (!String(o.label || "").trim()) {
        problems.push(nr + ", niveau " + (j + 1) + " heeft geen naam.");
      }
      var s = Number(o.score);
      if (!isFinite(s)) problems.push(nr + ", niveau " + (j + 1) + " heeft geen geldige score.");
      else if (scores.indexOf(s) !== -1) problems.push(nr + " heeft twee keer de score " + s + ".");
      else scores.push(s);
    });
  });

  (draft.questions || []).forEach(function (q, i) {
    if (!String(q.label || "").trim()) {
      problems.push("Open vraag " + (i + 1) + " heeft nog geen tekst.");
    }
  });

  return problems;
}



/* Hoeveel resultaten hangen er aan deze evaluatie? */
function resultCount(db, year, name) {
  var n = 0;
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year === year && p.evaluation === name) n += db.sessions[key].length;
  });
  return n;
}



/* Bij hernoemen moeten de opgeslagen resultaten mee, anders raken ze zoek. */
function renameEvaluation(db, year, oldName, newName) {
  if (oldName === newName) return 0;
  var moved = 0;
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year || p.evaluation !== oldName) return;
    var target = sessionKey(year, p.klas, newName);
    if (!db.sessions[target]) db.sessions[target] = [];
    db.sessions[target] = db.sessions[target].concat(db.sessions[key]);
    moved += db.sessions[key].length;
    delete db.sessions[key];
  });
  return moved;
}



/* Wat gaat er stuk als je deze wijziging opslaat? */
function impactOfEdit(original, draft) {
  if (!original) return [];
  var warnings = [];
  var oldIds = (original.rubrics || []).map(function (r) { return r.id; });
  var newIds = draft.rubrics.map(function (r) { return r.id; });

  var removed = oldIds.filter(function (id) { return newIds.indexOf(id) === -1; });
  if (removed.length) {
    warnings.push(
      removed.length +
        " criterium/criteria verdwijnen. De punten die daarvoor gegeven zijn, tellen niet meer mee in het totaal.",
    );
  }

  (original.rubrics || []).forEach(function (oldR) {
    var newR = draft.rubrics.filter(function (r) { return r.id === oldR.id; })[0];
    if (!newR) return;
    var oldMax = Math.max.apply(null, oldR.options.map(function (o) { return o.score; }));
    var newMax = Math.max.apply(null, newR.options.map(function (o) { return Number(o.score); }));
    if (oldMax !== newMax) {
      warnings.push('"' + (newR.name || oldR.name) + '" gaat van maximum ' + oldMax + " naar " + newMax + ". Bestaande percentages verschuiven.");
    }
  });

  return warnings;
}



/* Nieuwere definitie wint, net als bij klaslijsten — tenzij een
   tombstone zegt dat dit item verwijderd is en de inkomende versie niet
   nieuwer is dan dat verwijdermoment. */
function mergeEvaluations(target, incoming) {
  var changed = [];
  if (!target.evaluations) target.evaluations = {};

  if (incoming) {
    Object.keys(incoming).forEach(function (year) {
      if (!target.evaluations[year]) target.evaluations[year] = {};
      Object.keys(incoming[year]).forEach(function (name) {
        var inc = incoming[year][name];
        var key = year + "||" + name;
        if (isTombstoned("evaluations", key, inc.updatedAt)) return; // blijft verwijderd

        var cur = target.evaluations[year][name];
        if (!cur) {
          target.evaluations[year][name] = JSON.parse(JSON.stringify(inc));
          changed.push(name + " (nieuw)");
        } else if ((inc.updatedAt || 0) > (cur.updatedAt || 0)) {
          target.evaluations[year][name] = JSON.parse(JSON.stringify(inc));
          changed.push(name + " (bijgewerkt)");
        }
      });
    });
  }

  // Zelf ook toepassen: een "voor iedereen" tombstone die net binnenkwam
  // ruimt onze eigen, oudere kopie meteen mee op.
  Object.keys(target.evaluations).forEach(function (year) {
    Object.keys(target.evaluations[year]).forEach(function (name) {
      var key = year + "||" + name;
      if (isTombstoned("evaluations", key, target.evaluations[year][name].updatedAt)) {
        delete target.evaluations[year][name];
      }
    });
  });

  return changed;
}

/* Mappen zijn een vrije indeling. Elke map heeft nu een eigen updatedAt
   (nodig om tegen een verwijder-tombstone te kunnen vergelijken, zie
   hieronder) — daarom een lijst van {name, updatedAt}-objecten, niet
   langer platte tekst. De volgorde in de lijst blijft wel de
   weergavevolgorde, voor het verplaatsen met de pijltjes. */
function mergeEvaluationFolders(target, incoming) {
  var added = [];
  if (!target.evaluationFolders) target.evaluationFolders = {};

  if (incoming) {
    Object.keys(incoming).forEach(function (year) {
      if (!target.evaluationFolders[year]) target.evaluationFolders[year] = [];
      (incoming[year] || []).forEach(function (f) {
        if (!f || !f.name) return;
        var key = year + "||" + f.name;
        if (isTombstoned("folders", key, f.updatedAt)) return; // blijft verwijderd

        var list = target.evaluationFolders[year];
        var existing = list.filter(function (x) { return x.name === f.name; })[0];
        if (!existing) {
          list.push({ name: f.name, updatedAt: f.updatedAt || 0 });
          added.push(f.name + " [" + year + "]");
        } else if ((f.updatedAt || 0) > (existing.updatedAt || 0)) {
          existing.updatedAt = f.updatedAt;
        }
      });
    });
  }

  // Tombstones toepassen op wat we zelf al hadden — als een collega deze
  // map "voor iedereen" verwijderde ná onze laatste wijziging eraan,
  // verdwijnt hij nu ook bij ons.
  Object.keys(target.evaluationFolders).forEach(function (year) {
    target.evaluationFolders[year] = target.evaluationFolders[year].filter(function (f) {
      return !isTombstoned("folders", year + "||" + f.name, f.updatedAt);
    });
  });

  return added;
}

/* --- mappen: aanmaken, hernoemen, verwijderen, toewijzen --- */

function evaluationFoldersFor(db, year) {
  var registry = (db.evaluationFolders && db.evaluationFolders[year]) || [];
  // De opgeslagen volgorde is de echte volgorde — een leerkracht kan die
  // zelf met de pijltjes aanpassen. Enkel mappen die wél in gebruik zijn
  // maar om een of andere reden niet in de registry staan (bv. een ouder
  // bestand) komen er zonder vaste volgorde alfabetisch achteraan bij.
  var names = registry.map(function (f) { return f.name; });
  var extra = [];
  Object.keys((db.evaluations && db.evaluations[year]) || {}).forEach(function (name) {
    var f = db.evaluations[year][name].folder;
    if (f && names.indexOf(f) === -1 && extra.indexOf(f) === -1) extra.push(f);
  });
  extra.sort(function (a, b) { return a.localeCompare(b, "nl"); });
  return names.concat(extra);
}

function moveEvaluationFolder(db, year, folderName, delta) {
  if (!db.evaluationFolders || !db.evaluationFolders[year]) return false;
  var list = db.evaluationFolders[year];
  var index = list.findIndex(function (f) { return f.name === folderName; });
  var target = index + delta;
  if (index === -1 || target < 0 || target >= list.length) return false;
  var tmp = list[index];
  list[index] = list[target];
  list[target] = tmp;
  return true;
}

function addEvaluationFolder(db, year, name) {
  var clean = String(name || "").trim();
  if (!clean) return false;
  if (!db.evaluationFolders) db.evaluationFolders = {};
  if (!db.evaluationFolders[year]) db.evaluationFolders[year] = [];
  if (db.evaluationFolders[year].some(function (f) { return f.name === clean; })) return false;
  db.evaluationFolders[year].push({ name: clean, updatedAt: Date.now() });
  return true;
}

/* De map verdwijnt, de evaluaties die erin zaten nooit — die komen
   gewoon terug bij "Geen map". "scope" bepaalt of dit ook bij collega's
   moet verdwijnen ("iedereen") of enkel lokaal blijft ("mezelf"), zie
   recordDeletion() verderop. */
function deleteEvaluationFolder(db, year, name, scope) {
  var key = year + "||" + name;
  if (db.evaluationFolders && db.evaluationFolders[year]) {
    db.evaluationFolders[year] = db.evaluationFolders[year].filter(function (f) { return f.name !== name; });
  }
  Object.keys((db.evaluations && db.evaluations[year]) || {}).forEach(function (evName) {
    if (db.evaluations[year][evName].folder === name) {
      db.evaluations[year][evName].folder = "";
      db.evaluations[year][evName].updatedAt = Date.now();
    }
  });
  recordDeletion("folders", key, scope);
}

function setEvaluationFolder(db, year, evalName, folder) {
  var ev = getEvaluation(db, year, evalName);
  if (!ev) return;
  ev.folder = folder || "";
  ev.updatedAt = Date.now();
}



/* ------------------------------------------------------------------
   RUBRICVERSIES

   Pas je een niveaubeschrijving aan nadat er al beoordeeld is, dan zou
   een oude evaluatie ineens met de nieuwe tekst getoond worden. Op de
   vraag "waarop is deze leerling in september beoordeeld?" klopt het
   antwoord dan niet meer.

   Daarom: de oude tekst verhuist naar history[] en elke rij onthoudt
   met welke versie hij beoordeeld is. Alleen wijzigingen ná gebruik
   maken een nieuwe versie; anders zou je bij elk typfoutje een versie
   bijhouden.
   ------------------------------------------------------------------ */

function evaluationVersion(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev && ev.version ? ev.version : 1;
}



/* De rubric zoals hij was op het moment van beoordelen. */
function rubricsForVersion(db, year, name, version) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return [];
  if (!version || version === (ev.version || 1)) return ev.rubrics || [];
  var old = (ev.history || {})[String(version)];
  return old && old.rubrics ? old.rubrics : ev.rubrics || [];
}

function questionsForVersion(db, year, name, version) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return [];
  if (!version || version === (ev.version || 1)) return ev.questions || [];
  var old = (ev.history || {})[String(version)];
  return old && old.questions ? old.questions : ev.questions || [];
}



/* Is er inhoudelijk iets veranderd? Volgorde telt niet mee. */
function rubricsDiffer(a, b) {
  function normalise(list) {
    return (list || [])
      .map(function (r) {
        return {
          id: r.id,
          name: String(r.name || "").trim(),
          description: String(r.description || "").trim(),
          options: (r.options || [])
            .map(function (o) {
              return Number(o.score) + "|" + String(o.label || "").trim() + "|" + String(o.desc || "").trim();
            })
            .sort(),
        };
      })
      .sort(function (x, y) { return x.id.localeCompare(y.id); });
  }
  return JSON.stringify(normalise(a)) !== JSON.stringify(normalise(b));
}



/* Bewaart de huidige tekst als oude versie en verhoogt het nummer. */
function archiveVersion(evaluationObj) {
  var version = evaluationObj.version || 1;
  if (!evaluationObj.history) evaluationObj.history = {};
  evaluationObj.history[String(version)] = {
    rubrics: JSON.parse(JSON.stringify(evaluationObj.rubrics || [])),
    questions: JSON.parse(JSON.stringify(evaluationObj.questions || [])),
    archivedAt: Date.now(),
  };
  evaluationObj.version = version + 1;
  return evaluationObj.version;
}

/* ---- overgenomen uit editor.js ---- */

/* ------------------------------------------------------------------
   EVALUATIE-EDITOR
   Rubrics en open vragen aanmaken en aanpassen zonder de HTML te openen.
   ------------------------------------------------------------------ */

var draft = null;

var draftOriginalName = null;

var draftOriginalYear = null;

function openEvals() {
  if (!$("evalListYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) {
      $("evalListYear").appendChild(new Option(y, y));
      $("draftYear").appendChild(new Option(y, y));
    });
    var chosen = $("yearSelect").value;
    if (chosen) $("evalListYear").value = chosen;
  }
  showEvalList();
  showView("evals");
}

function showEvalList() {
  draft = null;
  $("evalListView").classList.remove("hidden");
  $("evalEditView").classList.add("hidden");
  renderEvalList();
}

function renderEvalList() {
  var year = $("evalListYear").value;
  var host = $("evalList");
  host.innerHTML = "";

  var needle = ($("evalListSearch").value || "").trim().toLowerCase();
  var allNames = evaluationNames(db, year);
  var names = needle
    ? allNames.filter(function (n) { return n.toLowerCase().indexOf(needle) !== -1; })
    : allNames;
  var folders = evaluationFoldersFor(db, year);

  if (!allNames.length && !folders.length) {
    host.appendChild(el("div", "empty", "Nog geen evaluaties voor " + year + "."));
    return;
  }
  if (needle && !names.length) {
    host.appendChild(el("div", "empty", "Geen evaluaties gevonden voor \"" + $("evalListSearch").value.trim() + "\"."));
    return;
  }

  var byFolder = {};
  folders.forEach(function (f) { byFolder[f] = []; });
  var ongeordend = [];
  names.forEach(function (name) {
    var ev = getEvaluation(db, year, name);
    var f = ev.folder || "";
    if (f && byFolder[f]) byFolder[f].push(name);
    else ongeordend.push(name);
  });

  folders.forEach(function (f, i) {
    // Tijdens het zoeken tonen we enkel mappen die ook echt een
    // treffer bevatten — anders lijkt het net of het zoeken niets doet.
    if (needle && !byFolder[f].length) return;
    host.appendChild(renderEvalFolderGroup(year, f, byFolder[f], i, folders.length));
  });
  if (ongeordend.length || (!folders.length && !needle)) {
    host.appendChild(renderEvalFolderGroup(year, "", ongeordend, -1, 0));
  }
}

function renderEvalFolderGroup(year, folderName, names, folderIndex, folderCount) {
  var wrap = el("details", "eval-folder");
  wrap.open = true;

  var summary = document.createElement("summary");
  summary.className = "section-toggle";
  summary.textContent = (folderName || "Geen map") +
    " (" + names.length + (names.length === 1 ? " evaluatie" : " evaluaties") + ")";
  wrap.appendChild(summary);

  if (folderName) {
    var folderActions = el("div", "btn-row eval-folder-actions");

    var up = el("button", "icon-btn", "↑");
    up.type = "button";
    up.title = "Map naar boven";
    up.disabled = folderIndex === 0;
    up.addEventListener("click", function () {
      moveEvaluationFolder(db, year, folderName, -1);
      persist();
      renderEvalList();
    });
    folderActions.appendChild(up);

    var down = el("button", "icon-btn", "↓");
    down.type = "button";
    down.title = "Map naar beneden";
    down.disabled = folderIndex === folderCount - 1;
    down.addEventListener("click", function () {
      moveEvaluationFolder(db, year, folderName, 1);
      persist();
      renderEvalList();
    });
    folderActions.appendChild(down);

    var delBtn = el("button", "btn-ghost btn-small", "Map verwijderen");
    delBtn.type = "button";
    delBtn.addEventListener("click", function () {
      askDeleteScope(
        'Map "' + folderName + '" verwijderen?',
        ["De evaluaties erin blijven gewoon bestaan — ze komen terug bij \"Geen map\"."],
        function (scope) {
          deleteEvaluationFolder(db, year, folderName, scope);
          persist();
          renderEvalList();
          showNotice(
            "good", 'Map "' + folderName + '" verwijderd',
            scope === "iedereen"
              ? "Komt na synchroniseren ook bij collega's niet meer terug."
              : "Blijft enkel bij jou weg — collega's behouden hun eigen versie.",
          );
        },
      );
    });
    folderActions.appendChild(delBtn);

    wrap.appendChild(folderActions);
  }

  var body = el("div", "eval-folder-body");
  if (!names.length) {
    body.appendChild(el("div", "empty", "Nog geen evaluaties in deze map."));
  } else {
    names.forEach(function (name) {
      body.appendChild(renderEvalRow(year, name));
    });
  }
  wrap.appendChild(body);
  return wrap;
}

function renderEvalRow(year, name) {
  var ev = getEvaluation(db, year, name);
  var used = resultCount(db, year, name);

  var row = el("div", "eval-row");
  var left = el("div");
  left.appendChild(el("div", "name", name));

  var bits = [
    ev.rubrics.length + (ev.rubrics.length === 1 ? " criterium" : " criteria"),
    "max " + maxScoreOf(ev.rubrics) + " punten",
  ];
  if (ev.questions && ev.questions.length) {
    bits.push(ev.questions.length + (ev.questions.length === 1 ? " open vraag" : " open vragen"));
  }
  bits.push(used ? used + (used === 1 ? " resultaat" : " resultaten") : "nog niet gebruikt");
  left.appendChild(el("div", "meta", bits.join(" · ")));
  row.appendChild(left);

  var actions = el("div", "btn-row");

  var folderSelect = document.createElement("select");
  folderSelect.className = "eval-folder-select";
  folderSelect.title = "Verplaats naar map";
  folderSelect.appendChild(new Option("Geen map", ""));
  evaluationFoldersFor(db, year).forEach(function (f) {
    folderSelect.appendChild(new Option(f, f));
  });
  folderSelect.value = ev.folder || "";
  folderSelect.addEventListener("change", function () {
    setEvaluationFolder(db, year, name, this.value);
    persist();
    renderEvalList();
  });
  actions.appendChild(folderSelect);

  var feedup = el("button", "btn-ghost btn-small", "Voor leerlingen afdrukken");
  feedup.type = "button";
  feedup.title = "Print de criteria en niveaus zonder scores — geef dit vooraf mee";
  feedup.addEventListener("click", function () { printFeedUp(year, name); });
  var edit = el("button", "btn-ghost btn-small", "Bewerk");
  edit.type = "button";
  edit.addEventListener("click", function () { editEvaluation(year, name); });
  var copy = el("button", "btn-ghost btn-small", "Dupliceer");
  copy.type = "button";
  copy.addEventListener("click", function () { duplicateEvaluation(year, name); });
  var del = el("button", "btn-danger btn-small", "Verwijder");
  del.type = "button";
  del.addEventListener("click", function () { deleteEvaluation(year, name); });
  actions.appendChild(feedup);
  actions.appendChild(edit);
  actions.appendChild(copy);
  actions.appendChild(del);
  row.appendChild(actions);

  return row;
}



/* --- bewerken starten --- */

function newEvaluation() {
  draftOriginalName = null;
  draftOriginalYear = null;
  draft = {
    name: "",
    year: $("evalListYear").value,
    rubrics: [blankRubric(5, [])],
    questions: [],
    folder: "",
  };
  renderDraft();
}

function editEvaluation(year, name) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return;
  draftOriginalName = name;
  draftOriginalYear = year;
  draft = {
    name: name,
    year: year,
    rubrics: JSON.parse(JSON.stringify(ev.rubrics || [])),
    questions: JSON.parse(JSON.stringify(ev.questions || [])),
    folder: ev.folder || "",
  };
  renderDraft();
}

function duplicateEvaluation(year, name) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return;
  draftOriginalName = null;
  draftOriginalYear = null;

  // Nieuwe sleutels: dit is een andere evaluatie, geen kopie van de punten.
  var taken = [];
  draft = {
    name: name + " (kopie)",
    year: year,
    rubrics: (ev.rubrics || []).map(function (r) {
      var id = uniqueId(r.name || "criterium", taken);
      taken.push(id);
      return {
        id: id,
        name: r.name,
        description: r.description,
        goals: (r.goals || []).slice(),
        options: JSON.parse(JSON.stringify(r.options)),
      };
    }),
    questions: (ev.questions || []).map(function (q) {
      var id = uniqueId(q.label || "open-vraag", taken);
      taken.push(id);
      return { id: id, label: q.label, hint: q.hint };
    }),
    folder: ev.folder || "",
  };
  renderDraft();
}

function deleteEvaluation(year, name) {
  var used = resultCount(db, year, name);
  var msg = 'Evaluatie "' + name + '" verwijderen uit ' + year + "?";
  if (used) {
    msg +=
      "<br><br>Er hangen " + used + " opgeslagen resultaten aan. Die worden niet gewist, maar je kan " +
      "er niet meer bij zolang deze evaluatie weg is. Maak hem opnieuw aan met exact dezelfde naam " +
      "om ze terug te zien.";
  }

  askDeleteScope('Evaluatie "' + name + '" verwijderen?', [msg], function (scope) {
    delete db.evaluations[year][name];
    recordDeletion("evaluations", year + "||" + name, scope);
    persist();
    renderEvalList();
    refreshAll();
    showNotice(
      "good", "Evaluatie verwijderd",
      '"' + name + '" staat niet meer in ' + year + ". " +
        (scope === "iedereen"
          ? "Komt na synchroniseren ook bij collega's niet meer terug."
          : "Blijft enkel bij jou weg — collega's behouden hun eigen versie."),
    );
  });
}



/* --- het formulier tekenen --- */

function renderDraft() {
  $("evalListView").classList.add("hidden");
  $("evalEditView").classList.remove("hidden");
  $("evalProblems").innerHTML = "";

  $("draftName").value = draft.name;
  $("draftYear").value = draft.year;

  $("aiDescription").value = "";
  $("aiPromptOut").value = "";
  $("aiPromptBlock").classList.add("hidden");
  $("aiResponseIn").value = "";
  $("aiImportState").innerHTML = "";
  $("aiRubricHelper").open = false;

  renderDraftRubrics();
  renderDraftQuestions();
  updateDraftSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDraftRubrics() {
  var host = $("draftRubrics");
  host.innerHTML = "";

  draft.rubrics.forEach(function (rubric, index) {
    var card = el("div", "rubric-edit");

    var head = el("div", "rubric-edit-head");
    head.appendChild(el("span", "num", index + 1));

    var nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.value = rubric.name || "";
    nameIn.placeholder = "Naam van het criterium";
    nameIn.style.flex = "1";
    nameIn.style.fontWeight = "600";
    nameIn.addEventListener("input", function () {
      rubric.name = this.value;
      updateDraftSummary();
    });
    head.appendChild(nameIn);

    var up = el("button", "icon-btn", "↑");
    up.type = "button";
    up.title = "Omhoog";
    up.disabled = index === 0;
    up.addEventListener("click", function () { moveRubric(index, -1); });

    var down = el("button", "icon-btn", "↓");
    down.type = "button";
    down.title = "Omlaag";
    down.disabled = index === draft.rubrics.length - 1;
    down.addEventListener("click", function () { moveRubric(index, 1); });

    var rm = el("button", "icon-btn danger", "Verwijder");
    rm.type = "button";
    rm.addEventListener("click", function () {
      if (!confirm('Criterium "' + (rubric.name || "zonder naam") + '" verwijderen?')) return;
      draft.rubrics.splice(index, 1);
      renderDraftRubrics();
      updateDraftSummary();
    });

    var maxBadge = el("span", "max-badge");
    maxBadge.dataset.maxFor = String(index);
    maxBadge.title = "Hoogste score van dit criterium";
    head.appendChild(maxBadge);

    head.appendChild(up);
    head.appendChild(down);
    head.appendChild(rm);
    card.appendChild(head);

    var desc = document.createElement("textarea");
    desc.value = rubric.description || "";
    desc.placeholder = "Korte uitleg: waar kijk je naar bij dit criterium?";
    desc.style.minHeight = "48px";
    desc.style.marginBottom = "12px";
    desc.addEventListener("input", function () { rubric.description = this.value; });
    card.appendChild(desc);

    var headRow = el("div", "level-head");
    ["Punten", "Niveau", "Wat je ziet", ""].forEach(function (t) {
      headRow.appendChild(el("span", null, t));
    });
    card.appendChild(headRow);

    rubric.options.forEach(function (opt, oi) {
      var row = el("div", "level-row");

      var score = document.createElement("input");
      score.type = "number";
      score.className = "score-in";
      score.value = opt.score;
      score.min = "0";
      score.addEventListener("input", function () {
        opt.score = this.value === "" ? "" : Number(this.value);
        updateDraftSummary();
      });
      row.appendChild(score);

      var label = document.createElement("input");
      label.type = "text";
      label.value = opt.label || "";
      label.placeholder = "Goed";
      label.addEventListener("input", function () { opt.label = this.value; });
      row.appendChild(label);

      var d = document.createElement("input");
      d.type = "text";
      d.className = "desc-in";
      d.value = opt.desc || "";
      d.placeholder = "Beschrijf wat je concreet ziet bij dit niveau";
      d.addEventListener("input", function () { opt.desc = this.value; });
      row.appendChild(d);

      var rmLevel = el("button", "icon-btn danger", "×");
      rmLevel.type = "button";
      rmLevel.title = "Niveau verwijderen";
      rmLevel.disabled = rubric.options.length <= 2;
      rmLevel.addEventListener("click", function () {
        // Stonden de punten netjes op 1, 2, 3 …? Dan blijven ze dat.
        var wasSequential = isSequentialScores(rubric.options);
        rubric.options.splice(oi, 1);
        if (wasSequential) renumberScores(rubric.options);
        renderDraftRubrics();
        updateDraftSummary();
      });
      row.appendChild(rmLevel);

      card.appendChild(row);
    });

    if (yearHasGoals(draft.year)) {
      card.appendChild(renderGoalPicker(rubric));
    }

    var addLevel = el("button", "icon-btn", "Niveau toevoegen");
    addLevel.type = "button";
    addLevel.style.marginTop = "4px";
    addLevel.addEventListener("click", function () {
      var wasSequential = isSequentialScores(rubric.options);
      var top = rubric.options.reduce(function (m, o) { return Math.max(m, Number(o.score) || 0); }, 0);
      rubric.options.push({ score: top + 1, label: "", desc: "" });
      if (wasSequential) renumberScores(rubric.options);
      renderDraftRubrics();
      updateDraftSummary();
    });
    card.appendChild(addLevel);

    host.appendChild(card);
  });
}



/* --- leerplandoelen koppelen aan een criterium --- */

function renderGoalPicker(rubric) {
  if (!rubric.goals) rubric.goals = [];
  var box = el("div", "goal-picker");

  var head = el("div", "goal-picker-head");
  head.appendChild(el("span", "add-label", "Leerplandoelen"));

  var count = el("span", "goal-count", "");
  head.appendChild(count);

  var toggle = el("button", "icon-btn", "Kiezen");
  toggle.type = "button";
  head.appendChild(toggle);
  box.appendChild(head);

  var chosen = el("div", "goal-chips");
  box.appendChild(chosen);

  var list = el("div", "goal-list hidden");
  box.appendChild(list);

  /* Alleen de chips en de teller verversen. Het hele criterium
     hertekenen zou de doelenlijst dichtklappen, en dan kan je maar
     één doel per keer aanvinken. */
  function refresh() {
    count.textContent = rubric.goals.length
      ? rubric.goals.length + (rubric.goals.length === 1 ? " doel gekoppeld" : " doelen gekoppeld")
      : "nog geen doel gekoppeld";

    chosen.innerHTML = "";
    rubric.goals.forEach(function (key) {
      var goal = findGoal(draft.year, key);
      if (!goal) return;
      chosen.appendChild(goalChip(goal, function () {
        setGoal(rubric, key, false);
      }));
    });

    list.querySelectorAll(".goal-option").forEach(function (row) {
      var on = rubric.goals.indexOf(row.dataset.goal) !== -1;
      row.classList.toggle("on", on);
      var cb = row.querySelector("input");
      if (cb) cb.checked = on;
    });

    updateDraftSummary();
  }

  function setGoal(target, key, on) {
    if (on) {
      if (target.goals.indexOf(key) === -1) target.goals.push(key);
    } else {
      target.goals = target.goals.filter(function (k) { return k !== key; });
    }
    refresh();
  }

  toggle.addEventListener("click", function () {
    var open = list.classList.toggle("hidden") === false;
    this.textContent = open ? "Sluiten" : "Kiezen";
    if (open && !list.childNodes.length) {
      buildGoalList(list, rubric, setGoal);
      refresh();
    }
  });

  refresh();
  return box;
}

function buildGoalList(host, rubric, setGoal) {
  var list = goalsForYear(draft.year);
  if (!list.length) return;

  var controls = el("div", "goal-controls");

  var search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Zoek op code of tekst…";
  controls.appendChild(search);

  var filter = document.createElement("select");
  [["", "Beide leerplannen"], ["TW", "Alleen techniek wetenschappen"], ["MW", "Alleen moderne talen en wetenschappen"]]
    .forEach(function (o) { filter.appendChild(new Option(o[1], o[0])); });
  controls.appendChild(filter);

  host.appendChild(controls);

  var body = el("div");
  host.appendChild(body);

  function draw() {
    body.innerHTML = "";
    var needle = search.value;
    var pkg = filter.value;

    var matches = list.filter(function (g) {
      if (pkg && !g.codes[pkg]) return false;
      return goalMatches(g, needle);
    });

    var lastRubriek = null;
    matches.forEach(function (g) {
      if (g.rubriek !== lastRubriek) {
        body.appendChild(el("div", "goal-rubriek", g.rubriek));
        lastRubriek = g.rubriek;
      }

      var on = rubric.goals.indexOf(g.id) !== -1;
      var row = el("label", "goal-option" + (on ? " on" : ""));
      row.dataset.goal = g.id;

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = on;
      cb.addEventListener("change", function () { setGoal(rubric, g.id, this.checked); });
      row.appendChild(cb);

      var textWrap = el("div", "goal-text");
      var line = el("div");
      line.appendChild(el("span", "goal-code", goalCodeLabel(g)));
      line.appendChild(planBadge(g));
      line.appendChild(bloomBadge(g.bloom));
      line.appendChild(document.createTextNode(" " + g.text));
      textWrap.appendChild(line);
      if (g.concretisering) textWrap.appendChild(el("div", "muted", g.concretisering));
      row.appendChild(textWrap);

      body.appendChild(row);
    });

    if (!matches.length) {
      body.appendChild(el("div", "hint", "Geen doel gevonden."));
    }
  }

  search.addEventListener("input", draw);
  filter.addEventListener("change", draw);
  draw();
}

function moveRubric(index, delta) {
  var target = index + delta;
  if (target < 0 || target >= draft.rubrics.length) return;
  var tmp = draft.rubrics[index];
  draft.rubrics[index] = draft.rubrics[target];
  draft.rubrics[target] = tmp;
  renderDraftRubrics();
}

function renderDraftQuestions() {
  var host = $("draftQuestions");
  host.innerHTML = "";

  if (!draft.questions.length) return;

  draft.questions.forEach(function (q, i) {
    var row = el("div", "question-row");

    var label = document.createElement("input");
    label.type = "text";
    label.value = q.label || "";
    label.placeholder = "Welke vraag stel je?";
    label.addEventListener("input", function () { q.label = this.value; });
    row.appendChild(label);

    var hint = document.createElement("input");
    hint.type = "text";
    hint.value = q.hint || "";
    hint.placeholder = "Hulptekst in het veld (optioneel)";
    hint.addEventListener("input", function () { q.hint = this.value; });
    row.appendChild(hint);

    var rm = el("button", "icon-btn danger", "×");
    rm.type = "button";
    rm.title = "Vraag verwijderen";
    rm.addEventListener("click", function () {
      draft.questions.splice(i, 1);
      renderDraftQuestions();
    });
    row.appendChild(rm);

    host.appendChild(row);
  });
}

function rubricMax(rubric) {
  return rubric.options.reduce(function (m, o) { return Math.max(m, Number(o.score) || 0); }, 0);
}

function updateDraftSummary() {
  var max = draft.rubrics.reduce(function (sum, r) { return sum + rubricMax(r); }, 0);
  $("draftMax").textContent = max;

  draft.rubrics.forEach(function (r, i) {
    var badge = $("draftRubrics").querySelector('[data-max-for="' + i + '"]');
    if (badge) {
      badge.textContent = r.options.length + " niveaus · max " + rubricMax(r);
    }
  });

  var named = draft.rubrics.filter(function (r) { return String(r.name || "").trim(); }).length;
  var goalSet = {};
  draft.rubrics.forEach(function (r) {
    (r.goals || []).forEach(function (k) { goalSet[k] = true; });
  });
  var goalCount = Object.keys(goalSet).length;

  $("draftSummary").textContent =
    named + " van " + draft.rubrics.length + " criteria benoemd" +
    (draft.questions.length ? " · " + draft.questions.length + " open vraag/vragen" : "") +
    (yearHasGoals(draft.year)
      ? " · " + (goalCount ? goalCount + " leerplandoel(en) gedekt" : "nog geen leerplandoelen")
      : "");
}

function takenIds() {
  return draft.rubrics
    .map(function (r) { return r.id; })
    .concat(draft.questions.map(function (q) { return q.id; }));
}

function addRubric(levels) {
  draft.rubrics.push(blankRubric(levels, takenIds()));
  renderDraftRubrics();
  updateDraftSummary();
  var cards = $("draftRubrics").querySelectorAll(".rubric-edit");
  var last = cards[cards.length - 1];
  if (last) {
    last.scrollIntoView({ behavior: "smooth", block: "center" });
    last.querySelector("input").focus();
  }
}

function addQuestion() {
  draft.questions.push(blankQuestion(takenIds()));
  renderDraftQuestions();
  updateDraftSummary();
  var inputs = $("draftQuestions").querySelectorAll("input");
  if (inputs.length) inputs[inputs.length - 2].focus();
}



/* --- opslaan --- */

function saveDraft() {
  draft.name = $("draftName").value.trim();
  draft.year = $("draftYear").value;

  // Sleutels alsnog netjes maken voor criteria die nog de standaardnaam hadden.
  var used = [];
  draft.rubrics.forEach(function (r) {
    if (/^nieuw-criterium/.test(r.id) && String(r.name || "").trim()) {
      r.id = uniqueId(r.name, used);
    }
    used.push(r.id);
  });
  draft.questions.forEach(function (q) {
    if (/^open-vraag/.test(q.id) && String(q.label || "").trim()) {
      q.id = uniqueId(q.label, used);
    }
    used.push(q.id);
  });

  var problems = validateEvaluation(draft, db, draftOriginalName);
  if (problems.length) {
    var box = el("div", "notice warn");
    box.appendChild(el("strong", null, "Nog even nakijken"));
    var ul = document.createElement("ul");
    ul.style.margin = "4px 0 0";
    ul.style.paddingLeft = "20px";
    problems.forEach(function (p) { ul.appendChild(el("li", null, p)); });
    box.appendChild(ul);
    $("evalProblems").innerHTML = "";
    $("evalProblems").appendChild(box);
    $("evalProblems").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  var original = draftOriginalName ? getEvaluation(db, draftOriginalYear, draftOriginalName) : null;
  var warnings = impactOfEdit(original, draft);
  if (warnings.length) {
    if (!confirm("Let op:\n\n- " + warnings.join("\n- ") + "\n\nToch opslaan?")) return;
  }

  // Lege niveaubeschrijvingen: voor inspectie is net "wat je concreet
  // ziet" het punt van een rubric.
  var vague = [];
  draft.rubrics.forEach(function (r) {
    var empty = r.options.filter(function (o) { return !String(o.desc || "").trim(); }).length;
    if (empty) vague.push(r.name + " (" + empty + " van de " + r.options.length + ")");
  });
  if (vague.length) {
    if (!confirm(
      "Sommige niveaus hebben nog geen beschrijving van wat je concreet ziet:\n\n- " +
      vague.join("\n- ") +
      "\n\nZonder die tekst is de rubric moeilijk uit te leggen aan leerlingen of bij een doorlichting.\n\nToch opslaan?",
    )) return;
  }

  // Is er al mee beoordeeld én verandert er inhoudelijk iets? Dan
  // bevriezen we de oude tekst zodat oude beoordelingen leesbaar blijven.
  var archived = 0;
  if (original && resultCount(db, draftOriginalYear, draftOriginalName) > 0) {
    if (rubricsDiffer(original.rubrics, draft.rubrics)) {
      archived = archiveVersion(original);
    }
  }

  var cleaned = {
    rubrics: draft.rubrics.map(function (r) {
      return {
        id: r.id,
        name: String(r.name).trim(),
        description: String(r.description || "").trim(),
        goals: (r.goals || []).slice(),
        options: r.options
          .map(function (o) {
            return { score: Number(o.score), label: String(o.label).trim(), desc: String(o.desc || "").trim() };
          })
          .sort(function (a, b) { return a.score - b.score; }),
      };
    }),
    questions: draft.questions.map(function (q) {
      return { id: q.id, label: String(q.label).trim(), hint: String(q.hint || "").trim() };
    }),
    version: original ? original.version || 1 : 1,
    history: original ? original.history || {} : {},
    folder: draft.folder || "",
    updatedAt: Date.now(),
  };

  var moved = 0;
  if (draftOriginalName) {
    if (draftOriginalYear !== draft.year) {
      // Van leerjaar veranderen zou de opgeslagen resultaten losknippen.
      if (resultCount(db, draftOriginalYear, draftOriginalName) > 0) {
        alert(
          "Deze evaluatie heeft al resultaten in " + draftOriginalYear + ".\n\n" +
          "Van leerjaar veranderen zou die losknippen. Gebruik Dupliceer om een versie voor " +
          draft.year + " te maken.",
        );
        return;
      }
      delete db.evaluations[draftOriginalYear][draftOriginalName];
    } else if (draftOriginalName !== draft.name) {
      moved = renameEvaluation(db, draft.year, draftOriginalName, draft.name);
      delete db.evaluations[draft.year][draftOriginalName];
    }
  }

  if (!db.evaluations[draft.year]) db.evaluations[draft.year] = {};
  db.evaluations[draft.year][draft.name] = cleaned;

  // Onthouden vóór showEvalList(), want die maakt het concept leeg.
  var savedName = draft.name;
  var savedYear = draft.year;
  var wasEdit = !!draftOriginalName;

  persist();
  showEvalList();
  refreshAll();

  showNotice(
    "good",
    wasEdit ? "Evaluatie bijgewerkt" : "Evaluatie aangemaakt",
    '"' + savedName + '" in ' + savedYear + " met " + cleaned.rubrics.length +
      " criteria, maximum " + maxScoreOf(cleaned.rubrics) + " punten" +
      (cleaned.questions.length ? " en " + cleaned.questions.length + " open vraag/vragen" : "") +
      "." + (moved ? " " + moved + " bestaande resultaten zijn meeverhuisd." : "") +
      (archived
        ? " De vorige tekst is bewaard als versie " + (archived - 1) +
          ", zodat eerdere beoordelingen leesbaar blijven zoals ze toen waren."
        : "") +
      " Vergeet niet op te slaan in je bestand.",
  );
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
      "niveau een concrete, waarneembare omschrijving van 1 tot 2 zinnen — vermijd vage " +
      "woorden zoals \"goed\" of \"voldoende\" zonder uit te leggen wat je dan precies ziet.",
  ];

  if (goals.length) {
    lines.push(
      "",
      "Koppel daarnaast bij elk criterium de leerplandoelen (uit de lijst hieronder) die er " +
        "inhoudelijk bij aansluiten, met hun code (bijvoorbeeld \"SW05\"). Een criterium mag ook " +
        "geen enkel doel krijgen als er echt niets goed past — verzin er dan liever geen bij dan " +
        "een zwakke match te forceren. Meerdere doelen per criterium mag.",
      "",
      "Leerplandoelen om uit te kiezen:",
    );
    goals.forEach(function (g) {
      lines.push(g.id + " — " + g.text);
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
    lines.push("", "Laat \"leerplandoelen\" gewoon weg bij een criterium waar niets bij past — een lege lijst mag ook.");
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
    throw new Error("Verwacht een lijst \"criteria\" met minstens één criterium — die ontbreekt of is leeg.");
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
      showNoticeIn("aiImportState", "warn", "Beschrijf eerst de opdracht", "Een paar zinnen volstaan — hoe concreter, hoe beter de rubric.");
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(field.value).then(done).catch(function () {
        field.select();
        if (legacyCopy(field.value)) done();
      });
    } else {
      field.select();
      if (legacyCopy(field.value)) done();
    }
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
    if (gekoppeld) extra.push(gekoppeld + " leerplandoel(en) alvast gekoppeld — controleer of ze kloppen.");
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
