/* ---- overgenomen uit ui.js ---- */

var fileHandle = null;

var fileName = "";

var dirty = false;

// Tekst van de laatste mislukte automatische opslag, "" als alles goed ging.
// Blijft staan (rode status + balk) tot een volgende opslag wel lukt.
var saveError = "";

var writing = null;
var writeAgain = false;

var canPickFiles = typeof window.showSaveFilePicker === "function";

function updateStatus() {
  var s = $("status");
  s.className = "status";
  if (saveError && fileHandle) {
    s.classList.add("error");
    s.textContent = "Niet opgeslagen!";
  } else if (fileHandle && !dirty) {
    s.classList.add("saved");
    s.textContent = "Opgeslagen in " + fileName;
  } else if (dirty && fileHandle) {
    s.classList.add("dirty");
    s.textContent = "Niet opgeslagen";
  } else if (pendingFolder && !folderHandle) {
    s.classList.add("dirty");
    s.textContent = "Map niet verbonden";
  } else if (dirty) {
    s.classList.add("dirty");
    s.textContent = "Alleen in deze browser";
  } else {
    s.classList.add("nofile");
    s.textContent = "Geen bestand gekozen";
  }
  updateFileButtons();
  updateSafetyBar();
}



/* Een balk die blijft staan zolang je werk nergens vast staat. Een
   melding zou bij de eerstvolgende actie verdwijnen, en dan zie je
   niets meer terwijl het risico er nog is. */
function updateSafetyBar() {
  var bar = $("safetyBar");
  var rowCount = Object.keys(db.sessions || {}).reduce(function (n, key) {
    return n + db.sessions[key].length;
  }, 0);

  var rescued = storageRescueData();
  var failed = !!(saveError && fileHandle);
  var needsFolder = pendingFolder && !folderHandle;
  // Zonder opgeslagen werk valt er niets te verliezen; dan is een
  // waarschuwing alleen maar ruis bij het eerste gebruik.
  var needsFile = !fileHandle && !(!canPickFiles && fileName) && rowCount > 0;

  if (!rescued && !failed && !needsFolder && !needsFile) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  bar.classList.toggle("error", !!(rescued || failed));
  bar.innerHTML = "";

  var txt = el("div", "txt");
  var btns = el("div", "btn-row");

  if (rescued) {
    txt.appendChild(el("strong", null, "Je werk in deze browser kon niet gelezen worden"));
    txt.appendChild(document.createTextNode(
      "De tool is leeg gestart. Open je laatste werkbestand (bijvoorbeeld uit OneDrive) om verder te werken. " +
      "De onleesbare gegevens zijn apart bewaard; download ze als reservekopie voor je deze melding verbergt.",
    ));
    var open = el("button", "btn-primary", "Werkbestand openen…");
    open.type = "button";
    open.addEventListener("click", function () { pickFile("open"); });
    var dl = el("button", "btn-ghost", "Reservekopie downloaden");
    dl.type = "button";
    dl.addEventListener("click", downloadStorageRescue);
    var hide = el("button", "btn-ghost", "Verbergen");
    hide.type = "button";
    hide.addEventListener("click", function () {
      if (!confirm("De apart bewaarde, onleesbare gegevens worden gewist. Heb je je werk terug of de reservekopie gedownload?")) return;
      try { localStorage.removeItem(STORAGE_RESCUE_KEY); } catch (e) {}
      storageRescueCache = "";
      updateSafetyBar();
    });
    btns.appendChild(open);
    btns.appendChild(dl);
    btns.appendChild(hide);
  } else if (failed) {
    txt.appendChild(el("strong", null, "Automatisch opslaan naar " + fileName + " is mislukt"));
    txt.appendChild(document.createTextNode(
      "Je laatste wijzigingen staan enkel in deze browser. " + saveError,
    ));
    var retry = el("button", "btn-primary", "Opnieuw proberen");
    retry.type = "button";
    retry.addEventListener("click", function () { writeHandle(); });
    var saveAsBtn = el("button", "btn-ghost", "Opslaan als…");
    saveAsBtn.type = "button";
    saveAsBtn.addEventListener("click", function () { saveToFile(true); });
    btns.appendChild(retry);
    btns.appendChild(saveAsBtn);
  } else if (needsFolder) {
    txt.appendChild(el("strong", null, "Gedeelde map niet verbonden"));
    txt.appendChild(document.createTextNode(
      "Je werk wordt bewaard in deze browser, maar komt niet in " + pendingFolder.name +
      " terecht. Je collega's zien het dus niet, en het is weg als je je browsergegevens wist." +
      (rowCount ? " Er staan nu " + rowCount + " evaluatie(s) klaar." : ""),
    ));
    var re = el("button", "btn-primary", "Verbinden met " + pendingFolder.name);
    re.type = "button";
    re.addEventListener("click", reconnectFolder);
    btns.appendChild(re);
  } else {
    txt.appendChild(el("strong", null, "Je werk staat alleen in deze browser"));
    txt.appendChild(document.createTextNode(
      "Er is nog geen werkbestand gekozen. " +
      (rowCount ? "Je " + rowCount + " evaluatie(s) zijn " : "Je werk is ") +
      "weg zodra je je browsergegevens wist of op een ander toestel werkt.",
    ));
    var mk = el("button", "btn-primary", canPickFiles ? "Werkbestand aanmaken…" : "Opslaan (download)");
    mk.type = "button";
    mk.addEventListener("click", function () { saveToFile(false); });
    btns.appendChild(mk);
  }

  bar.appendChild(txt);
  bar.appendChild(btns);
}



/* De knoppen zeggen wat ze op dit moment doen. Zolang er nog geen
   bestand is, zouden "Opslaan" en "Opslaan als…" hetzelfde doen —
   dan tonen we er maar één. */
function updateFileButtons() {
  var hasFile = !!fileHandle || (!canPickFiles && !!fileName);
  var save = $("btnSaveFile");
  var saveAs = $("btnSaveFileAs");
  var hint = $("fileHint");

  saveAs.classList.toggle("hidden", !hasFile);
  $("folderGroup").classList.toggle("hidden", !folderHandle);

  if (!hasFile && canPickFiles) {
    save.textContent = "Werkbestand aanmaken…";
    save.title = "Maakt een nieuw bestand waarin je werk bewaard wordt";
  } else if (!canPickFiles) {
    save.textContent = "Opslaan (download)";
    save.title = "Deze browser bewaart via een download";
  } else {
    save.textContent = "Opslaan";
    save.title = "Schrijft naar " + fileName;
  }

  hint.innerHTML = "";
  function part(label, text) {
    hint.appendChild(el("strong", null, label));
    hint.appendChild(document.createTextNode(" " + text + " "));
  }

  if (!hasFile) {
    if (canPickFiles) {
      part("Werkbestand aanmaken…", "maakt een nieuw, leeg bestand waarin je werk bewaard wordt. Je kiest zelf de map en de naam. Daarna slaat de tool automatisch op bij elke wijziging.");
    } else {
      part("Opslaan (download)", "maakt je werkbestand aan en downloadt het. Deze browser kan niet rechtstreeks naar je schijf schrijven, dus klik na elke les zelf even op opslaan.");
    }
  } else if (!canPickFiles) {
    part("Opslaan (download)", "downloadt " + fileName + " opnieuw. Automatisch opslaan kan hier niet, dus doe het na elke les zelf.");
    part("Opslaan als…", "maakt een nieuw bestand, bijvoorbeeld bij een nieuw schooljaar.");
  } else {
    part("Opslaan", "schrijft naar " + fileName + ". Dat gebeurt ook vanzelf.");
    part("Opslaan als…", "maakt een nieuw bestand, bijvoorbeeld bij een nieuw schooljaar.");
  }
  if (folderHandle) {
    part("Team bijwerken", "leest de bestanden van je collega's uit " + folderName + " en voegt ze bij de jouwe.");
  }
  part("Werk van collega toevoegen", "voegt hun evaluaties bij de jouwe; niets gaat verloren.");
  part("Ander bestand openen", "vervangt alles wat je nu hebt.");
}

var autoSaveTimer = null;

function scheduleAutoSave() {
  if (!fileHandle) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(function () { writeHandle(); }, 900);
}



/* ------------------------------------------------------------------ */
/* Bestanden                                                           */
/* ------------------------------------------------------------------ */

function defaultFileName() {
  var who = db.assessor ? "-" + db.assessor : "";
  return "stem-evaluaties" + who + ".json";
}

function dbBlob() {
  var out = {
    format: DB_FORMAT,
    version: DB_VERSION,
    assessor: db.assessor,
    exportedAt: new Date().toISOString(),
    instanceId: instanceId,
    schoolYears: db.schoolYears,
    currentSchoolYear: db.currentSchoolYear,
    activeSchoolYear: db.activeSchoolYear,
    evaluations: db.evaluations,
    evaluationFolders: db.evaluationFolders,
    tombstones: db.tombstones,
    team: db.team,
    settings: db.settings,
    // localTombstones bewust NIET mee — dat is precies het punt van
    // "verwijderen voor mezelf": nooit delen met collega's.
  };
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
}

function saveToFile(forceNew) {
  if (canPickFiles) {
    if (fileHandle && !forceNew) return writeHandle();
    window
      .showSaveFilePicker({
        suggestedName: defaultFileName(),
        types: [{ description: "STEM-evaluaties", accept: { "application/json": [".json"] } }],
      })
      .then(function (handle) {
        fileHandle = handle;
        fileName = handle.name;
        return writeHandle();
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        canPickFiles = false;
        downloadDb();
        showNotice("info", "Rechtstreeks opslaan lukt hier niet", "Je bestand is in plaats daarvan gedownload. Dat werkt even goed, je moet het alleen zelf op de juiste plek zetten.");
      });
    return;
  }
  downloadDb();
}

/* Schrijft naar het werkbestand. Nooit twee schrijfacties tegelijk: loopt
   er al een, dan volgt er na afloop nog precies één met de nieuwste
   stand. De status gaat pas op "opgeslagen" als er tijdens het schrijven
   niets meer veranderd is, anders zou het tabblad sluiten zonder
   waarschuwing terwijl de laatste wijziging nog niet op schijf staat. */
function writeHandle() {
  if (!fileHandle) return Promise.resolve();
  if (writing) {
    writeAgain = true;
    return writing;
  }
  var handle = fileHandle;
  var target = changeCount;
  writing = handle
    .createWritable()
    .then(function (w) {
      return w.write(dbBlob()).then(function () { return w.close(); });
    })
    .then(function () {
      saveError = "";
      if (changeCount === target && fileHandle === handle) markClean();
      else updateStatus();
      maybeBackup();
    })
    .catch(function () {
      saveError = "Controleer of het bestand niet ergens anders openstaat (bijvoorbeeld in OneDrive) en probeer opnieuw, of kies Opslaan als.";
      updateStatus();
      showNotice("warn", "Opslaan mislukt", saveError);
    })
    .then(function () {
      writing = null;
      if (writeAgain) {
        writeAgain = false;
        return writeHandle();
      }
    });
  return writing;
}

// Eén keer inlezen: updateSafetyBar() draait bij elke wijziging.
var storageRescueCache = null;

function storageRescueData() {
  if (storageRescueCache === null) {
    try { storageRescueCache = localStorage.getItem(STORAGE_RESCUE_KEY) || ""; } catch (e) { storageRescueCache = ""; }
  }
  return storageRescueCache;
}

function downloadStorageRescue() {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([storageRescueData()], { type: "application/json" }));
  a.download = "stem-evaluaties-reservekopie-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

function downloadDb() {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(dbBlob());
  a.download = defaultFileName();
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  fileName = a.download;
  markClean();
}

var pendingMode = "merge";

function pickFile(mode) {
  pendingMode = mode;
  if (mode === "open" && dirty) {
    if (!confirm("Je hebt wijzigingen die nog niet in een bestand staan.\n\nBestand openen vervangt alles wat er nu is. Toch doorgaan?")) return;
  }

  if (canPickFiles) {
    window
      .showOpenFilePicker({
        types: [{ description: "STEM-evaluaties", accept: { "application/json": [".json"] } }],
        multiple: false,
      })
      .then(function (handles) {
        var handle = handles[0];
        return handle.getFile().then(function (file) {
          return file.text().then(function (text) {
            handleIncoming(text, file.name, mode === "open" ? handle : null);
          });
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        canPickFiles = false;
        $("fallbackInput").click();
      });
    return;
  }
  $("fallbackInput").click();
}

function onFallbackFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (ev) { handleIncoming(ev.target.result, file.name, null); };
  reader.readAsText(file);
  e.target.value = "";
}

function handleIncoming(text, name, handleForOpen) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    showNotice("warn", "Dit bestand kon niet gelezen worden", "Het is geen geldig JSON-bestand. Kies het werkbestand dat deze tool zelf opslaat.");
    return;
  }

  var read = readAnyFile(parsed, CONFIG);
  if (!read) {
    showNotice("warn", "Dit lijkt geen evaluatiebestand", "Kies een bestand dat door deze tool of door de vorige versie is opgeslagen.");
    return;
  }

  if (pendingMode === "open") {
    db = read.db;
    if (!db.assessor) db.assessor = cleanAssessor($("assessor").value);
    $("assessor").value = db.assessor;
    fileHandle = handleForOpen;
    fileName = name;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) {}
    dirty = read.legacy;
    updateStatus();
    refreshAll();
    showNotice(
      "good",
      "Bestand geopend",
      read.legacy
        ? "Dit was nog een bestand van de vorige versie. Het is omgezet. Sla het opnieuw op om de nieuwe versie te bewaren."
        : countRows(db) + " evaluatie(s) ingeladen uit " + name + ".",
    );
    return;
  }

  // Samenvoegen
  var before = countRows(db);
  var stats = mergeDb(db, read.db);
  persist();
  refreshAll();

  var after = countRows(db);
  if (!stats.added && !stats.updated) {
    showNotice("info", "Niets nieuws in dat bestand", "Alle rijen stonden er al in. Er is niets gewijzigd of verdwenen.");
    return;
  }

  var parts = [];
  if (stats.added) parts.push(stats.added + " nieuwe rij(en) toegevoegd");
  if (stats.updated) parts.push(stats.updated + " rij(en) bijgewerkt naar een recentere versie");
  if (stats.skipped) parts.push(stats.skipped + " oudere versie(s) genegeerd");
  if (stats.classes && stats.classes.length) {
    parts.push("klaslijsten aangepast: " + stats.classes.join(", "));
  }
  if (stats.evaluations && stats.evaluations.length) {
    parts.push("evaluaties aangepast: " + stats.evaluations.join(", "));
  }
  if (stats.settings) parts.push("drempels voor leerplandoelen bijgewerkt");

  showNotice(
    "good",
    "Samengevoegd met " + name,
    parts.join(", ") + ". Je hebt nu " + after + " evaluaties in totaal (was " + before + "). Sla op als bestand om dit te bewaren.",
  );
}

function countRows(database) {
  return Object.keys(database.sessions).reduce(function (n, k) {
    return n + database.sessions[k].length;
  }, 0);
}

function refreshAll() {
  renderSchoolYearSelect();
  renderArchivedYearBar();
  fillClassAndEvalOptions($("yearSelect").value);
  if (currentView === "roster") {
    renderRosterCurrent();
    fillMoveFromKlasOptions();
  }
  if (currentView === "evals" && !draft) renderEvalList();
  periodDraft = null; // ander schooljaar of samengevoegd: opnieuw vertrekken van wat bewaard is
  if (currentView === "skore") {
    fillSkoreSelectors(false);
    renderSkore();
  }
  if (currentView === "results") {
    fillResultSelectors();
    renderResults();
  }

  // Is een van de klassen verdwenen uit de klaslijsten, dan sluiten we de
  // sessie netjes (een combinatiesessie heeft ze allemaal nog nodig).
  if (cur.key && cur.klassen.some(function (k) { return classesFor(db, cur.year).indexOf(k) === -1; })) {
    Array.prototype.forEach.call($("classSelect").options, function (o) { o.selected = false; });
    syncKlasMultiDisplay();
    closeSession();
    return;
  }
  if (cur.key && evaluationNames(db, cur.year).indexOf(cur.evaluation) === -1) {
    $("evalSelect").value = "";
    closeSession();
    return;
  }
  // Rubrics of vragen kunnen net aangepast zijn.
  if (cur.key) {
    cur.rubrics = rubricsFor(db, cur.year, cur.evaluation);
    cur.questions = questionsFor(db, cur.year, cur.evaluation);
    $("maxTotal").textContent = maxScoreOf(cur.rubrics);
    renderRubrics();
    renderOpenQuestions();
  }

  if (cur.key) {
    if (!db.sessions[cur.key]) db.sessions[cur.key] = [];
    renderStudents();
    renderTable();
    resetForm();
  } else {
    onSelectionChange();
  }
}

/* ---- overgenomen uit folder.js ---- */

/* ------------------------------------------------------------------
   GEDEELDE MAP

   Twee leerkrachten die tegelijk in hetzelfde bestand schrijven, gaat
   altijd mis: OneDrive maakt er dan conflictkopieën van. Daarom
   schrijft iedereen alleen in zijn eigen bestand, in een map die
   jullie delen. Inlezen doet iedereen van iedereen.

   De map wordt onthouden tussen sessies via IndexedDB. De browser
   vraagt bij een nieuwe sessie opnieuw toestemming; dat is bewust zo
   en kan niet omzeild worden.
   ------------------------------------------------------------------ */

var FOLDER_SUPPORTED = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

var IDB_NAME = "stem-eval";

var IDB_STORE = "handles";

function idb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = function () {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function idbPut(key, value) {
  return idb().then(function (database) {
    return new Promise(function (resolve, reject) {
      var tx = database.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function idbGet(key) {
  return idb().then(function (database) {
    return new Promise(function (resolve, reject) {
      var tx = database.transaction(IDB_STORE, "readonly");
      var req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function idbDelete(key) {
  return idb().then(function (database) {
    return new Promise(function (resolve) {
      var tx = database.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    });
  });
}



/* Bestandsnaam per leerkracht. Eén schrijver per bestand. */
function teamFileName(assessor) {
  return "evaluaties-" + (cleanAssessor(assessor) || "XX") + ".json";
}

function isTeamFile(name) {
  return /^evaluaties-[A-Z0-9]{1,6}\.json$/i.test(name);
}

function assessorFromFileName(name) {
  var m = String(name).match(/^evaluaties-([A-Za-z0-9]{1,6})\.json$/);
  return m ? m[1].toUpperCase() : null;
}



/* Leest alle teambestanden in de map, behalve dat van jezelf.
   Bestanden die OneDrive nog aan het synchroniseren is, kunnen half
   geschreven zijn — die worden apart gemeld in plaats van genegeerd. */
function readTeamFolder(dirHandle, ownFileName, config) {
  var found = [];
  var problems = [];

  return (async function () {
    for await (var entry of dirHandle.values()) {
      if (entry.kind !== "file") continue;
      if (!isTeamFile(entry.name)) continue;
      if (entry.name.toLowerCase() === String(ownFileName).toLowerCase()) continue;

      try {
        var file = await entry.getFile();
        var text = await file.text();
        var parsed = JSON.parse(text);
        var read = readAnyFile(parsed, config);
        if (!read) {
          problems.push(entry.name + " (geen evaluatiebestand)");
          continue;
        }
        found.push({
          name: entry.name,
          assessor: assessorFromFileName(entry.name) || read.db.assessor,
          modified: file.lastModified,
          db: read.db,
        });
      } catch (err) {
        problems.push(entry.name + " (kon niet gelezen worden, misschien nog aan het synchroniseren?)");
      }
    }
    found.sort(function (a, b) { return a.name.localeCompare(b.name, "nl"); });
    return { files: found, problems: problems };
  })();
}



/* Waarschuwing tegen stil overschrijven: staat er al een bestand met
   jouw initialen dat van een ander toestel komt? */
function checkOwnFile(dirHandle, ownFileName, myInstanceId) {
  return dirHandle
    .getFileHandle(ownFileName)
    .then(function (handle) { return handle.getFile(); })
    .then(function (file) { return file.text(); })
    .then(function (text) {
      var parsed = JSON.parse(text);
      if (parsed.instanceId && parsed.instanceId !== myInstanceId) {
        return { conflict: true, name: ownFileName };
      }
      return { conflict: false };
    })
    .catch(function () {
      return { conflict: false }; // bestaat nog niet, of onleesbaar
    });
}
