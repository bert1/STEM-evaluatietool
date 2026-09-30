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
  if (ownFileProblem) {
    s.classList.add("error");
    s.textContent = "Bestand onleesbaar";
  } else if (saveError && fileHandle) {
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
  } else if (!canPickFiles && fileName) {
    // Browser zonder File System Access API: bewaren gaat via downloaden.
    // Zolang er iets niet gedownload is, is de status zelf de knop.
    s.classList.add(dirty ? "dirty" : "saved");
    if (dirty) s.classList.add("status-action");
    s.textContent = dirty ? "Opslaan (download)" : "Gedownload als " + fileName;
  } else if (dirty) {
    s.classList.add("dirty");
    s.textContent = "Alleen in deze browser";
  } else {
    s.classList.add("nofile");
    s.textContent = "Geen bestand gekozen";
  }
  s.title = !canPickFiles && fileName && dirty
    ? "Downloadt je werkbestand. Vervang daarmee het vorige, dan gaat er niets verloren."
    : "Waar je werk bewaard wordt: klik voor Instellingen, Gebruiker.";
  updateSafetyBar();
}

/* De status rechtsboven is klikbaar (sinds 1.33.0). */
function onStatusClick() {
  if (!canPickFiles && fileName && dirty) {
    downloadDb();
    return;
  }
  openSettingsView("user");
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
  var unreadable = !!ownFileProblem;
  var failed = !!(saveError && fileHandle);
  var needsFolder = pendingFolder && !folderHandle;

  if (!rescued && !unreadable && !failed && !needsFolder) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  bar.classList.toggle("error", !!(rescued || unreadable || failed));
  bar.innerHTML = "";

  var txt = el("div", "txt");
  var btns = el("div", "btn-row");

  if (rescued) {
    txt.appendChild(el("strong", null, "Je werk in deze browser kon niet gelezen worden"));
    txt.appendChild(document.createTextNode(
      (canPickFiles
        ? "Je werk is opgehaald uit je bestand in de gedeelde map. "
        : "Open je laatste werkbestand (bijvoorbeeld uit OneDrive): het wordt bij je werk gevoegd. ") +
      "De onleesbare gegevens zijn apart bewaard; download ze als reservekopie voor je deze melding verbergt.",
    ));
    var open = el("button", "btn-primary", "Werkbestand openen…");
    open.type = "button";
    open.addEventListener("click", function () { pickFile("merge"); });
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
  } else if (unreadable) {
    // Sinds 1.32.0: nooit een lege start die het bestand daarna overschrijft.
    txt.appendChild(el("strong", null, "Je bestand " + fileName + " kon niet gelezen worden"));
    txt.appendChild(document.createTextNode(ownFileProblem));
    var again = el("button", "btn-primary", "Opnieuw proberen");
    again.type = "button";
    again.addEventListener("click", retryOwnFile);
    btns.appendChild(again);
  } else if (failed) {
    txt.appendChild(el("strong", null, "Automatisch opslaan naar " + fileName + " is mislukt"));
    txt.appendChild(document.createTextNode(
      "Je laatste wijzigingen staan enkel in deze browser. " + saveError,
    ));
    var retry = el("button", "btn-primary", "Opnieuw proberen");
    retry.type = "button";
    retry.addEventListener("click", function () { writeHandle(); });
    var copyBtn = el("button", "btn-ghost", "Kopie downloaden");
    copyBtn.type = "button";
    copyBtn.title = "Downloadt een kopie van al je werk, zodat het ergens veilig staat.";
    copyBtn.addEventListener("click", downloadCopy);
    btns.appendChild(retry);
    btns.appendChild(copyBtn);
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
  }

  bar.appendChild(txt);
  bar.appendChild(btns);
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

/* Sinds 1.33.0 dezelfde naam als in de gedeelde map: zet een collega
   zonder Chrome of Edge zijn werkbestand in die map, dan leest Team
   bijwerken het gewoon mee. */
function defaultFileName() {
  return teamFileName(db.assessor);
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
    subjects: db.subjects,
    tombstones: db.tombstones,
    team: db.team,
    settings: db.settings,
    // Sinds 1.32.0 wel mee, want dit is jouw eigen bestand: op een nieuw
    // toestel of in een andere browser moet "verwijderd voor mezelf"
    // verwijderd blijven. Collega's lezen dit bestand ook, maar mergeDb()
    // neemt enkel de gedeelde tombstones over, nooit localTombstones.
    localTombstones: db.localTombstones,
  };
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
}

/* Sinds 1.32.0 kijkt de tool vóór elke schrijfactie naar je eigen
   bestand in de gedeelde map (pullOwnFile() in js/koppelen.js): heeft
   een ander toestel het intussen gewijzigd, dan eerst inlezen en
   samenvoegen. Is het onleesbaar, dan wordt er niets geschreven. */
function writeHandle() {
  if (!fileHandle || ownFileProblem) return Promise.resolve();
  if (writing) {
    writeAgain = true;
    return writing;
  }
  var handle = null;
  var target = 0;
  writing = pullOwnFile()
    .then(function (safe) {
      if (!safe || !fileHandle) return false;
      handle = fileHandle;
      target = changeCount;
      return handle.createWritable()
        .then(function (w) {
          return w.write(dbBlob()).then(function () { return w.close(); });
        })
        .then(function () { return rememberOwnStamp(handle); })
        .then(function () { return true; });
    })
    .then(function (written) {
      if (!written) return;
      saveError = "";
      if (changeCount === target && fileHandle === handle) markClean();
      else updateStatus();
      maybeBackup();
    })
    .catch(function () {
      saveError = "Controleer of het bestand niet ergens anders openstaat (bijvoorbeeld in OneDrive) en probeer opnieuw, of klik op Kopie downloaden.";
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

/* Enkel een kopie downloaden, zonder dat de tool denkt dat dit je
   werkbestand is. Een andere naam dan je werkbestand, met de datum, zodat
   niemand ze verwart. */
function downloadCopy() {
  var a = document.createElement("a");
  var d = new Date();
  a.href = URL.createObjectURL(dbBlob());
  a.download = "kopie-evaluaties-" + (db.assessor || "XX") + "-" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + ".json";
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
            handleIncoming(text, file.name);
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
  reader.onload = function (ev) { handleIncoming(ev.target.result, file.name); };
  reader.readAsText(file);
  e.target.value = "";
}

/* "Ander bestand openen", dat alles verving, bestaat niet meer sinds
   1.33.0: de ophaalweg in de wizard en Reservekopie terugzetten nemen
   het over. Een bestand inlezen voegt dus altijd samen. */
function handleIncoming(text, name) {
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

  if (pendingMode === "wizard") {
    wizardOpenedFile(read, name);
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
    parts.join(", ") + ". Je hebt nu " + after + " evaluaties in totaal (was " + before + ").",
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
  if (currentView === "subjects") renderSubjectSection();
  if (currentView === "evals" && !draft) renderEvalList();
  periodDraft = null; // ander schooljaar of samengevoegd: opnieuw vertrekken van wat bewaard is
  if (currentView === "periods") renderPeriodEditor();
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
  // Het gekozen vak kan klas of evaluatie nu verbergen (sinds 1.28.0).
  if (closeSessionIfHidden()) return;
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
        // Verwijsbestand na gewijzigde initialen (sinds 1.32.0): het werk
        // staat in het nieuwe bestand, dus stil overslaan.
        if (parsed && parsed.format === MOVED_FORMAT) continue;
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
