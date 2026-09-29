/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* Opstarten                                                           */
/* ------------------------------------------------------------------ */

function init() {
  $("appVersion").textContent = "v" + APP_VERSION;
  $("appVersion").title = "STEM Evaluatietool " + APP_VERSION + ". Zie CHANGELOG.md voor wat er veranderd is.";

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

  $("yearSelect").addEventListener("change", onYearChange);
  $("classSelect").addEventListener("change", onSelectionChange);
  $("evalSelect").addEventListener("change", onSelectionChange);
  $("compactToggle").addEventListener("change", function () {
    document.body.classList.toggle("compact", this.checked);
  });
  $("formativeToggle").addEventListener("change", updateTotals);

  $("btnSave").addEventListener("click", saveEvaluation);
  $("btnCancel").addEventListener("click", function () { resetForm(); });

  $("btnMergeFile").addEventListener("click", function () { pickFile("merge"); });
  $("btnMergeFileOff").addEventListener("click", function () { pickFile("merge"); });
  $("status").addEventListener("click", onStatusClick);
  $("btnExportCsv").addEventListener("click", exportCSV);
  $("btnCopy").addEventListener("click", copyTable);
  $("btnClearSession").addEventListener("click", clearSession);

  $("btnSettings").addEventListener("click", openSettings);
  $("btnSettingsGeneral").addEventListener("click", openGeneral);
  $("btnCloseGeneral").addEventListener("click", goHome);
  $("btnRoster").addEventListener("click", openRoster);
  $("btnSubjects").addEventListener("click", openSubjects);
  $("btnCloseSubjects").addEventListener("click", goHome);
  $("btnEvals").addEventListener("click", openEvals);
  $("btnTeam").addEventListener("click", openTeam);
  $("btnBackupNow").addEventListener("click", backupNow);
  $("btnResults").addEventListener("click", openResults);
  $("btnSkore").addEventListener("click", openSkore);
  $("btnCloseResults").addEventListener("click", goHome);
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
  $("evalListSubject").addEventListener("change", renderEvalList);
  $("draftYear").addEventListener("change", function () { fillDraftSubjectOptions($("draftSubject").value); });
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

  updateStatus();
  initKoppelen();
  initAutoSync();
  initAiRubricHelper();
  initScoringShortcuts();
  initEvalCombo();
  initControle();
  initSkore();
  initKlasMulti();
  initSubjects();
  initMoveStudent();
}



/* De opstartwizard staat sinds 1.32.0 in js/koppelen.js. */



/* ------------------------------------------------------------------ */
/* Schermen                                                            */
/* Eén scherm tegelijk. Klaslijsten en Evaluaties vervangen het        */
/* evaluatiescherm in plaats van eronder open te blijven staan.        */
/* ------------------------------------------------------------------ */

var VIEWS = { main: "mainView", roster: "rosterCard", evals: "evalCard", team: "teamCard", results: "resultsCard2", skore: "skoreCard", general: "generalCard", subjects: "subjectsCard", user: "userCard" }

var NAV = { main: "btnHome", roster: "btnRoster", evals: "btnEvals", team: "btnTeam", results: "btnResults", skore: "btnSkore", general: "btnSettingsGeneral", subjects: "btnSubjects", user: "btnSettingsUser" }

/* Sinds 1.29.0 staan Klaslijsten en Team onder één tab Instellingen, met
   een eigen rij knoppen erboven. Zo blijft de bovenste rij kort, ook als
   er later instellingen bijkomen: voeg die hier en in openSettingsView()
   toe, niet bovenaan. */
var SETTINGS_VIEWS = ["general", "user", "roster", "subjects", "team"];

var lastSettingsView = "general";

var currentView = "main";

function showView(name) {
  if (!VIEWS[name]) name = "main";
  currentView = name;
  var inSettings = SETTINGS_VIEWS.indexOf(name) !== -1;
  if (inSettings) lastSettingsView = name;

  Object.keys(VIEWS).forEach(function (key) {
    $(VIEWS[key]).classList.toggle("hidden", key !== name);
    $(NAV[key]).classList.toggle("active", key === name);
  });
  $("btnSettings").classList.toggle("active", inSettings);
  $("settingsTabs").classList.toggle("hidden", !inSettings);

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

/* Tab Instellingen: opent het onderdeel dat je het laatst bekeek. */
function openSettings() {
  openSettingsView(lastSettingsView);
}

function openSettingsView(name) {
  if (name === "roster") openRoster();
  else if (name === "team") openTeam();
  else if (name === "subjects") openSubjects();
  else if (name === "user") openUser();
  else openGeneral();
}

function openGeneral() {
  $("generalActiveYear").textContent = db.activeSchoolYear;
  $("generalVersion").textContent =
    "STEM Evaluatietool, versie " + APP_VERSION + ". Vermeld dit nummer als je een probleem meldt.";
  showView("general");
}

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
    "Klaslijsten en evaluaties hierin zijn niet meer te wijzigen. Bekijken en controleren kan gewoon. " +
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
      "De klaslijsten beginnen helemaal leeg. Rubrics en team blijven behouden, en " +
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
    showNotice("warn", "Dit schooljaar bestaat al", "Kies het linksboven om ernaar te wisselen.");
    return;
  }

  var ok = addSchoolYear(db, label);
  if (!ok) return;

  persist();
  renderSchoolYearSelect();
  renderArchivedYearBar();
  refreshAll();
  if (currentView === "general") $("generalActiveYear").textContent = db.activeSchoolYear;
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
