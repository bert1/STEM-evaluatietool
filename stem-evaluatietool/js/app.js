/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* Opstarten                                                           */
/* ------------------------------------------------------------------ */

function init() {
  $("appVersion").textContent = "v" + APP_VERSION;
  $("appVersion").title = "STEM Evaluatietool " + APP_VERSION + " — zie CHANGELOG.md voor wat er veranderd is";

  Object.keys(CONFIG).forEach(function (year) {
    $("yearSelect").appendChild(new Option(year, year));
  });

  loadFromStorage();

  renderSchoolYearSelect();
  $("schoolYearSelect").addEventListener("change", function () {
    switchViewedSchoolYear(db, this.value);
    persist();
    renderArchivedYearBar();
    refreshAll();
  });
  $("btnAddSchoolYear").addEventListener("click", onAddSchoolYear);
  renderArchivedYearBar();

  $("assessor").value = db.assessor;
  $("assessor").addEventListener("input", function () {
    db.assessor = cleanAssessor(this.value);
    this.value = db.assessor;
    try { localStorage.setItem(ASSESSOR_KEY, db.assessor); } catch (e) {}
    markDirty();
  });

  $("yearSelect").addEventListener("change", onYearChange);
  $("classSelect").addEventListener("change", onSelectionChange);
  $("evalSelect").addEventListener("change", onSelectionChange);
  $("compactToggle").addEventListener("change", function () {
    document.body.classList.toggle("compact", this.checked);
  });
  $("formativeToggle").addEventListener("change", updateTotals);

  $("btnSave").addEventListener("click", saveEvaluation);
  $("btnCancel").addEventListener("click", function () { resetForm(); });

  $("btnSaveFile").addEventListener("click", function () { saveToFile(false); });
  $("btnSaveFileAs").addEventListener("click", function () { saveToFile(true); });
  $("btnOpenFile").addEventListener("click", function () { pickFile("open"); });
  $("btnMergeFile").addEventListener("click", function () { pickFile("merge"); });
  $("btnExportCsv").addEventListener("click", exportCSV);
  $("btnCopy").addEventListener("click", copyTable);
  $("btnClearSession").addEventListener("click", clearSession);

  $("btnRoster").addEventListener("click", openRoster);
  $("btnEvals").addEventListener("click", openEvals);
  $("btnTeam").addEventListener("click", openTeam);
  $("btnResults").addEventListener("click", openResults);
  $("btnCloseResults").addEventListener("click", goHome);
  $("resYear").addEventListener("change", function () {
    fillResultSelectors();
    renderResults();
  });
  $("resEval").addEventListener("change", function () { fillResultSelectors(); renderResults(); });
  $("resKlas").addEventListener("change", renderResults);
  $("goalsWrap").addEventListener("toggle", function () {
    if (this.open) renderGoalOverview();
  });
  $("growthWrap").addEventListener("toggle", function () {
    if (this.open) renderGrowthPanel();
  });
  $("btnCloseTeam").addEventListener("click", goHome);
  $("btnAddMember").addEventListener("click", addMember);
  $("teamYear").addEventListener("change", renderTeamClasses);
  $("btnSyncTeam").addEventListener("click", function () { syncTeam(false); });
  $("btnCloseEval").addEventListener("click", goHome);
  $("evalListYear").addEventListener("change", function () {
    $("evalListSearch").value = "";
    renderEvalList();
  });
  $("evalListSearch").addEventListener("input", renderEvalList);
  $("btnNewEval").addEventListener("click", newEvaluation);
  $("btnNewFolder").addEventListener("click", function () {
    var year = $("evalListYear").value;
    var naam = prompt("Naam voor de nieuwe map, bijvoorbeeld \"Robotica\" of \"Basisvaardigheden\":");
    if (naam === null) return;
    naam = naam.trim();
    if (!naam) {
      showNotice("warn", "Vul een naam in", "");
      return;
    }
    if (!addEvaluationFolder(db, year, naam)) {
      showNotice("warn", "Deze map bestaat al", "Kies een andere naam, of gebruik de bestaande map hieronder.");
      return;
    }
    persist();
    renderEvalList();
    showNotice("good", "Map aangemaakt: " + naam, "Verplaats een evaluatie erin via de keuzelijst bij die evaluatie.");
  });
  $("btnYearOverview").addEventListener("click", function () {
    printYearOverview($("evalListYear").value);
  });
  $("btnCancelEval").addEventListener("click", showEvalList);
  $("btnSaveEval").addEventListener("click", saveDraft);
  $("btnAddRubric5").addEventListener("click", function () { addRubric(5); });
  $("btnAddRubric4").addEventListener("click", function () { addRubric(4); });
  $("btnAddRubric3").addEventListener("click", function () { addRubric(3); });
  $("btnAddQuestion").addEventListener("click", addQuestion);
  $("btnCloseRoster").addEventListener("click", goHome);
  $("btnHome").addEventListener("click", goHome);
  $("pasteArea").addEventListener("input", onPasteChange);
  $("btnClearPaste").addEventListener("click", clearPending);
  $("btnPickCsv").addEventListener("click", function () { $("csvInput").click(); });
  $("csvInput").addEventListener("change", onCsvFile);
  $("btnPickXlsx").addEventListener("click", function () { $("xlsxInput").click(); });
  $("xlsxInput").addEventListener("change", onXlsxFiles);
  ["mapClassCol", "mapNameCol", "mapName2Col", "mapHeader"].forEach(function (id) {
    $(id).addEventListener("change", renderRosterPreview);
  });
  $("btnRosterCancel").addEventListener("click", clearPending);
  $("btnClearAllClasses").addEventListener("click", clearAllClasses);
  $("btnRosterApply").addEventListener("click", function () { applyRoster(false); });
  $("btnRosterReplace").addEventListener("click", function () { applyRoster(true); });

  $("fallbackInput").addEventListener("change", onFallbackFile);

  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  if (!canPickFiles) {
    showNotice(
      "info",
      "Deze browser slaat op via downloaden",
      "Voor een echte Opslaan-knop die rechtstreeks naar je schijf schrijft, open je dit bestand in Chrome of Edge. Hier werkt opslaan via een download, en openen via Bladeren.",
    );
  }

  updateStatus();
  restoreFolder();
  initSetupWizard();
  initAiRubricHelper();
  initScoringShortcuts();
  initEvalCombo();
  initKlasMulti();
  initMoveStudent();
  startNetSync();
}



/* ------------------------------------------------------------------ */
/* Opstartwizard — enkel bij de allereerste keer openen                */
/* ------------------------------------------------------------------ */

function initSetupWizard() {
  if (typeof IS_DEMO !== "undefined" && IS_DEMO) return; // de testomgeving heeft haar eigen introductie
  if (!freshStart) return;

  $("setupWizard").classList.remove("hidden");
  document.body.classList.add("wizard-open");
  $("wizardInitials").focus();

  if (netSyncEnabled()) {
    $("wizardFolderGroup").classList.add("hidden");
    $("wizardNetSyncGroup").classList.remove("hidden");
  } else if (!FOLDER_SUPPORTED) {
    $("wizardFolderGroup").classList.add("hidden");
  }

  function updateFinishState() {
    $("wizardFinish").disabled = !cleanAssessor($("wizardInitials").value);
  }
  $("wizardInitials").addEventListener("input", updateFinishState);
  updateFinishState();

  $("wizardPickFolder").addEventListener("click", function () {
    var initials = cleanAssessor($("wizardInitials").value);
    var stateHost = $("wizardFolderState");
    stateHost.innerHTML = "";

    if (!initials) {
      var warn = el("div", "notice warn");
      warn.appendChild(el("strong", null, "Vul eerst je initialen in"));
      warn.appendChild(document.createTextNode("Die bepalen hoe je bestand in de gedeelde map gaat heten."));
      stateHost.appendChild(warn);
      return;
    }

    $("assessor").value = initials;
    db.assessor = initials;

    connectToFolder(
      function (name) {
        stateHost.innerHTML = "";
        var ok = el("div", "notice good");
        ok.appendChild(el("strong", null, "Map gekoppeld"));
        ok.appendChild(document.createTextNode(name));
        stateHost.appendChild(ok);
      },
      function (title, body) {
        stateHost.innerHTML = "";
        var w = el("div", "notice warn");
        w.appendChild(el("strong", null, title));
        w.appendChild(document.createTextNode(body));
        stateHost.appendChild(w);
      },
    );
  });

  function finishWizard() {
    var initials = cleanAssessor($("wizardInitials").value);
    if (initials) {
      $("assessor").value = initials;
      db.assessor = initials;
      try { localStorage.setItem(ASSESSOR_KEY, initials); } catch (e) {}

      var name = $("wizardName").value.trim();
      if (name) {
        if (!db.team) db.team = emptyTeam();
        if (!db.team.members[initials]) db.team.members[initials] = { name: "" };
        db.team.members[initials].name = name;
        db.team.updatedAt = Date.now();
      }
    }
    persist();
    updateStatus();
    $("setupWizard").classList.add("hidden");
    document.body.classList.remove("wizard-open");
  }

  $("wizardFinish").addEventListener("click", finishWizard);
  $("wizardSkip").addEventListener("click", function () {
    // Overslaan mag zonder initialen; alleen een lege start vastleggen zodat
    // de wizard niet bij elke volgende opstart terugkomt.
    persist();
    $("setupWizard").classList.add("hidden");
    document.body.classList.remove("wizard-open");
  });
}

function initDemoBanner() {
  $("demoBanner").classList.remove("hidden");
  $("btnDemoReset").addEventListener("click", function () {
    if (!confirm(
      "Alle testgegevens wissen en de testomgeving herladen met de oorspronkelijke voorbeelddata?\n\n" +
      "Eigen wijzigingen die je hier maakte, gaan verloren. Dit raakt alleen deze testomgeving, niet je echte werkbestand.",
    )) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    // Anders vraagt de browser zelf óók nog eens of je de pagina mag
    // verlaten, bovenop onze eigen bevestiging hierboven.
    dirty = false;
    location.reload();
  });
}



/* ------------------------------------------------------------------ */
/* Schermen                                                            */
/* Eén scherm tegelijk. Klaslijsten en Evaluaties vervangen het        */
/* evaluatiescherm in plaats van eronder open te blijven staan.        */
/* ------------------------------------------------------------------ */

var VIEWS = { main: "mainView", roster: "rosterCard", evals: "evalCard", team: "teamCard", results: "resultsCard2" }

var NAV = { main: "btnHome", roster: "btnRoster", evals: "btnEvals", team: "btnTeam", results: "btnResults" }

var currentView = "main";

function showView(name) {
  if (!VIEWS[name]) name = "main";
  currentView = name;

  Object.keys(VIEWS).forEach(function (key) {
    $(VIEWS[key]).classList.toggle("hidden", key !== name);
    $(NAV[key]).classList.toggle("active", key === name);
  });

  clearNotice();
  window.scrollTo({ top: 0, behavior: "smooth" });
}



/* ------------------------------------------------------------------ */
/* Meldingen                                                           */
/* ------------------------------------------------------------------ */

function showNotice(kind, title, body) {
  var host = $("notice");
  host.innerHTML = "";
  var box = el("div", "notice " + kind);
  box.appendChild(el("strong", null, title));
  if (body) box.appendChild(document.createTextNode(body));
  host.appendChild(box);
  host.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearNotice() { $("notice").innerHTML = ""; }

document.addEventListener("DOMContentLoaded", init);

/* ---- overgenomen uit editor.js ---- */

function goHome() {
  if (draft && !confirm("Je bent een evaluatie aan het bewerken. Wijzigingen die je nog niet opsloeg, gaan verloren.\n\nToch weggaan?")) {
    return;
  }
  draft = null;
  showView("main");
}

/* ------------------------------------------------------------------ */
/* Schooljaar                                                          */
/* ------------------------------------------------------------------ */

function renderSchoolYearSelect() {
  var select = $("schoolYearSelect");
  select.innerHTML = "";
  schoolYearLabels(db).forEach(function (label) {
    var opt = new Option(label + (label === db.activeSchoolYear ? " (actief)" : ""), label);
    select.appendChild(opt);
  });
  select.value = db.currentSchoolYear;
}

function renderArchivedYearBar() {
  var bar = $("archivedYearBar");
  if (!isArchivedSchoolYear(db)) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }

  bar.classList.remove("hidden");
  bar.innerHTML = "";

  var txt = el("div", "txt");
  txt.appendChild(el("strong", null, "Je bekijkt een archiefschooljaar: " + db.currentSchoolYear));
  txt.appendChild(document.createTextNode(
    "Klaslijsten en evaluaties hierin zijn niet meer te wijzigen. Resultaten bekijken kan gewoon. " +
      "Nieuw werk gaat naar het actieve schooljaar, " + db.activeSchoolYear + ".",
  ));
  bar.appendChild(txt);

  var btns = el("div", "btn-row");
  var back = el("button", "btn-primary", "Terug naar " + db.activeSchoolYear);
  back.type = "button";
  back.addEventListener("click", function () {
    $("schoolYearSelect").value = db.activeSchoolYear;
    switchViewedSchoolYear(db, db.activeSchoolYear);
    persist();
    renderArchivedYearBar();
    refreshAll();
  });
  btns.appendChild(back);
  bar.appendChild(btns);
}

function onAddSchoolYear() {
  var suggestion = suggestNextSchoolYearLabel(db.activeSchoolYear);
  var label = prompt(
    "Naam voor het nieuwe schooljaar (bijvoorbeeld " + suggestion + "):\n\n" +
      "De klaslijsten beginnen helemaal leeg. Rubrics en team blijven behouden — " +
      db.activeSchoolYear + " blijft gewoon bewaard en te bekijken.",
    suggestion,
  );
  if (label === null) return;
  label = label.trim();
  if (!label) {
    showNotice("warn", "Vul een naam in", "Bijvoorbeeld " + suggestion + ".");
    return;
  }
  if (db.schoolYears[label]) {
    showNotice("warn", "Dit schooljaar bestaat al", "Kies het gewoon bovenaan om ernaar te wisselen.");
    return;
  }

  var ok = addSchoolYear(db, label);
  if (!ok) return;

  persist();
  renderSchoolYearSelect();
  renderArchivedYearBar();
  refreshAll();
  showNotice(
    "good", "Nieuw schooljaar aangemaakt: " + label,
    "De klaslijsten zijn leeg. Rubrics en team zijn overgenomen uit " +
      Object.keys(db.schoolYears).filter(function (y) { return y !== label; }).join(", ") + ".",
  );
}

/* ------------------------------------------------------------------ */
/* Verwijderen: voor iedereen of enkel voor mezelf                     */
/* ------------------------------------------------------------------ */

/* Vervangt een gewone confirm() waar de keuze verder gaat dan ja/nee:
   verwijder ik dit ook bij collega's zodra we samenvoegen, of enkel bij
   mezelf? Roept callback("iedereen" | "mezelf") aan, of helemaal niet
   bij annuleren. */
function askDeleteScope(title, bodyLines, callback) {
  var overlay = document.createElement("div");
  overlay.id = "deleteScopeDialog";
  overlay.innerHTML =
    '<div class="wizard-overlay"></div>' +
    '<div class="wizard-card" style="max-width: 440px">' +
    "<h2>" + title + "</h2>" +
    bodyLines.map(function (l) { return '<p class="hint">' + l + "</p>"; }).join("") +
    '<div class="btn-row" style="margin-top: 20px; flex-direction: column; align-items: stretch; gap: 8px">' +
    '<button type="button" class="btn-danger" id="btnDelScopeEveryone">Verwijderen voor iedereen</button>' +
    '<button type="button" class="btn-ghost" id="btnDelScopeMe">Verwijderen voor mezelf</button>' +
    '<button type="button" class="btn-ghost" id="btnDelScopeCancel">Annuleren</button>' +
    "</div></div>";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "200";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";
  document.body.appendChild(overlay);

  function close(scope) {
    document.body.removeChild(overlay);
    if (scope) callback(scope);
  }
  $("btnDelScopeEveryone").addEventListener("click", function () { close("iedereen"); });
  $("btnDelScopeMe").addEventListener("click", function () { close("mezelf"); });
  $("btnDelScopeCancel").addEventListener("click", function () { close(null); });
  overlay.querySelector(".wizard-overlay").addEventListener("click", function () { close(null); });
}
