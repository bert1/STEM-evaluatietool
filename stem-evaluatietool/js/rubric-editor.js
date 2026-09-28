/* Rubrics-scherm: evaluaties en criteria aanmaken en bewerken.
   Afgesplitst uit js/evaluations.js (1.19.1). */

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
        ["De evaluaties erin blijven gewoon bestaan: ze komen terug bij \"Geen map\"."],
        function (scope) {
          deleteEvaluationFolder(db, year, folderName, scope);
          persist();
          renderEvalList();
          showNotice(
            "good", 'Map "' + folderName + '" verwijderd',
            scope === "iedereen"
              ? "Komt na synchroniseren ook bij collega's niet meer terug."
              : "Blijft enkel bij jou weg. Collega's behouden hun eigen versie.",
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
  feedup.title = "Print de criteria en niveaus zonder scores. Geef dit vooraf mee.";
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
        targetScore: r.targetScore,
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
          : "Blijft enkel bij jou weg. Collega's behouden hun eigen versie."),
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

  resetAiRubricHelper();

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
    desc.addEventListener("input", function () { rubric.description = this.value; renderDraftChecks(); });
    card.appendChild(desc);

    var headRow = el("div", "level-head");
    ["Punten", "Niveau", "Wat je ziet", "Doel", ""].forEach(function (t) {
      headRow.appendChild(el("span", null, t));
    });
    card.appendChild(headRow);

    var sortedScores = rubric.options.map(function (o) { return Number(o.score); });
    var topScore = Math.max.apply(null, sortedScores.length ? sortedScores : [0]);
    var target = rubricTargetScore(rubric, false);
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
      d.addEventListener("input", function () { opt.desc = this.value; renderDraftChecks(); });
      row.appendChild(d);

      // Welk niveau "doel behaald" is: wat een leerling toont die het
      // leerplandoel haalt. Eén per criterium.
      var goalLbl = el("label", "level-target");
      goalLbl.title = "Dit niveau betekent: doel behaald";
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "target-" + index;
      radio.checked = target !== null && Number(opt.score) === target;
      radio.setAttribute("aria-label", "Niveau " + (oi + 1) + " is doel behaald");
      radio.addEventListener("change", function () { rubric.targetScore = Number(opt.score); });
      goalLbl.appendChild(radio);
      goalLbl.appendChild(el("span", null, "doel"));
      row.appendChild(goalLbl);

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

      // Volgende stap voor de leerling (optioneel, niet bij het hoogste
      // niveau): gebruikt door de feedback in Skore.
      if (Number(opt.score) !== topScore) {
        var nx = document.createElement("input");
        nx.type = "text";
        nx.className = "level-next";
        nx.value = opt.next || "";
        nx.placeholder = "Volgende stap voor de leerling (optioneel), bv. Schrijf vooraf op wat je verwacht te meten.";
        nx.setAttribute("aria-label", "Volgende stap bij niveau " + (oi + 1));
        nx.addEventListener("input", function () { opt.next = this.value; renderDraftChecks(); });
        row.appendChild(nx);
      }

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
  updateAiReviewAvailability();
  renderDraftChecks();
}

/* Kwaliteitscontrole van de hele rubric, live onder de criteria. Enkel
   waarschuwingen: opslaan blijft altijd mogelijk. */
function renderDraftChecks() {
  var host = $("draftChecks");
  if (!host || !draft) return;
  host.innerHTML = "";
  var list = draft.rubrics.filter(function (r) { return !isUntouchedRubric(r); });
  if (!list.length) return;
  var warnings = rubricWarnings(draft.rubrics, draft.year, 0);
  if (warnings.length) host.appendChild(renderWarningsBox(warnings, "Nakijken"));
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

  renderDraftChecks();
  updateAiReviewAvailability();

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
      var options = r.options
        .map(function (o) {
          var opt = { score: Number(o.score), label: String(o.label).trim(), desc: String(o.desc || "").trim() };
          var next = String(o.next || "").trim();
          if (next) opt.next = next;
          return opt;
        })
        .sort(function (a, b) { return a.score - b.score; });
      // Het hoogste niveau heeft geen volgende stap.
      if (options.length) delete options[options.length - 1].next;
      var out = {
        id: r.id,
        name: String(r.name).trim(),
        description: String(r.description || "").trim(),
        goals: (r.goals || []).slice(),
        options: options,
      };
      var target = rubricTargetScore({ options: options, targetScore: r.targetScore }, false);
      if (target !== null) out.targetScore = target;
      return out;
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
