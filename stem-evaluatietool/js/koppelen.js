/* ------------------------------------------------------------------
   KOPPELEN (sinds 1.32.0)

   Wie ben je, en waar staat je werk? Er bestaan geen accounts: je
   identiteit is de combinatie van je initialen en je eigen bestand
   evaluaties-XX.json in de gedeelde map (OneDrive). In een browser
   zonder File System Access API (Firefox, Safari) is dat een
   werkbestand dat je zelf downloadt en opent.

   De tool is pas bruikbaar als je gekoppeld bent. Anders verschijnt de
   opstartwizard, bij elke opstart opnieuw, zonder knop om over te slaan.
   Een map die al gekoppeld was maar waarvan de browser opnieuw
   toestemming vraagt, telt wel als gekoppeld: dat is één klik in de
   balk "Verbinden met ...", geen wizard.

   De regels voor je eigen bestand:
   - Nooit blind overschrijven. Staat er op schijf een versie die deze
     browser nog niet kent (van een ander toestel, of van vóór je
     browsergegevens gewist werden), dan eerst een reservekopie, dan
     samenvoegen met mergeDb() (nooit verwijderen), dan pas schrijven.
   - Na elke lees- en schrijfactie onthoudt de tool het tijdstip
     (lastModified) van het bestand (ownFileStamp, ook in localStorage
     onder OWN_STAMP_KEY). Vóór elke schrijfactie kijkt pullOwnFile() of
     dat nog klopt. Zo niet: eerst inlezen en samenvoegen.
   - Een onleesbaar bestand (half gesynchroniseerd, beschadigd) wordt
     nooit overschreven: ownFileProblem blokkeert elke schrijfactie tot
     het weer leesbaar is.

   Alle wegen om een map te koppelen (de wizard bij de eerste keer, het
   ophalen van bestaand werk, en Instellingen, Gebruiker, "Koppeling
   opnieuw instellen") lopen via connectToFolder() en de wizard
   hieronder. Er is geen tweede kopie van die logica.
   ------------------------------------------------------------------ */

var OWN_STAMP_KEY = "STEM_EVAL_BESTAND_TIJD";

// Browser zonder File System Access API: de naam van het werkbestand dat
// de leerkracht downloadde of opende. Zonder deze sleutel is de tool niet
// gekoppeld.
var WORKFILE_KEY = "STEM_EVAL_WERKBESTAND";

var ownFileHandle = null;
var ownFileStamp = 0;
var ownFileProblem = "";

/* ------------------------------------------------------------------
   IDENTITEIT
   ------------------------------------------------------------------ */

function myName() {
  var m = db.team && db.team.members && db.team.members[db.assessor];
  return (m && m.name) || "";
}

/* Met een eigen tijdstip, zodat de nieuwe naam bij collega's doorkomt na
   Team bijwerken (mergeTeam() in js/sync.js). */
function setMyName(name) {
  name = String(name || "").trim();
  if (!db.assessor || !name) return false;
  if (!db.team) db.team = emptyTeam();
  var m = db.team.members[db.assessor];
  if (!m) m = db.team.members[db.assessor] = { name: "" };
  if (m.name === name) return false;
  m.name = name;
  m.updatedAt = Date.now();
  db.team.updatedAt = Date.now();
  return true;
}

function setIdentity(initials) {
  db.assessor = cleanAssessor(initials);
  try { localStorage.setItem(ASSESSOR_KEY, db.assessor); } catch (e) {}
  ensureSelfInTeam();
  renderAssessor();
}

/* Het veld Beoordelaar in de kop is enkel een weergave. Wijzigen kan bij
   Instellingen, Gebruiker. */
function renderAssessor() {
  var b = $("assessor");
  if (!b) return;
  b.textContent = db.assessor || "?";
  var name = myName();
  b.title = (name ? name + " (" + db.assessor + ")" : "Je initialen") +
    ". Klik om je gegevens te bekijken bij Instellingen, Gebruiker.";
}

function sameName(a, b) {
  function key(x) {
    return String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  }
  return key(a) === key(b);
}

/* Heeft deze browser eigen werk dat niet verloren mag gaan? Een verse
   start waarin nog niets bewaard werd, heeft dat niet: dan mag een
   opgehaald bestand de lege stand gewoon vervangen. */
function browserHasWork() {
  return !freshStart || persistedThisSession;
}

function isLinked() {
  if (!FOLDER_SUPPORTED) return !!(db.assessor && workFileName());
  return !!(db.assessor && (folderHandle || pendingFolder));
}

function workFileName() {
  try { return localStorage.getItem(WORKFILE_KEY) || ""; } catch (e) { return ""; }
}

/* ------------------------------------------------------------------
   JE EIGEN BESTAND
   ------------------------------------------------------------------ */

/* "leeg" voor een leeg bestand (daar valt niets te verliezen), null als
   het niet te lezen is, anders het resultaat van readAnyFile(). */
function parseDbText(text) {
  if (!String(text || "").trim()) return "leeg";
  try { return readAnyFile(JSON.parse(text), CONFIG); } catch (e) { return null; }
}

function knownStamp(name) {
  try {
    var s = JSON.parse(localStorage.getItem(OWN_STAMP_KEY) || "null");
    if (s && s.file === name && s.folder === folderName) return s.time || 0;
  } catch (e) {}
  return 0;
}

function saveStamp() {
  try {
    localStorage.setItem(OWN_STAMP_KEY, JSON.stringify({ file: fileName, folder: folderName, time: ownFileStamp }));
  } catch (e) {}
}

/* Na een geslaagde schrijfactie (writeHandle() in js/storage.js). */
function rememberOwnStamp(handle) {
  if (handle !== ownFileHandle) return Promise.resolve();
  return handle.getFile().then(function (f) {
    ownFileStamp = f.lastModified;
    saveStamp();
  }).catch(function () {});
}

/* Je eigen bestand samenvoegen met wat deze browser heeft. Zelfde regels
   als bij collega's (mergeDb: nooit verwijderen, nieuwste wint), plus
   wat enkel in je eigen bestand hoort: "verwijderd voor mezelf" en het
   actieve schooljaar. Geeft true als er iets veranderde. */
function mergeOwnFile(target, incoming) {
  var before = JSON.stringify(target);
  // Eerst de verwijderingen, zodat mergeDb() ze meteen toepast.
  TOMBSTONE_KINDS.forEach(function (kind) {
    var inc = (incoming.localTombstones && incoming.localTombstones[kind]) || {};
    if (!target.localTombstones) target.localTombstones = emptyTombstones();
    if (!target.localTombstones[kind]) target.localTombstones[kind] = {};
    Object.keys(inc).forEach(function (key) {
      if (inc[key] > (target.localTombstones[kind][key] || 0)) target.localTombstones[kind][key] = inc[key];
    });
  });
  mergeDb(target, incoming);
  if (incoming.activeSchoolYear && target.schoolYears[incoming.activeSchoolYear] &&
      incoming.activeSchoolYear > target.activeSchoolYear) {
    target.activeSchoolYear = incoming.activeSchoolYear;
  }
  return JSON.stringify(target) !== before;
}

function saveLocal() {
  persistedThisSession = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) {}
  markDirty();
}

/* Koppelt je eigen bestand in de gedeelde map (folderHandle). Bestaat
   het al, dan eerst een reservekopie van het bestand zoals het op schijf
   staat, dan samenvoegen (of, in een verse browser, gewoon inlezen), dan
   pas schrijven.
   opts.create === false: een ontbrekend bestand niet aanmaken.
   opts.overwriteUnreadable: enkel na een uitdrukkelijke keuze (werk
   terughalen uit een reservekopie); het onleesbare bestand komt eerst
   letterlijk in de reservekopieën.
   Geeft een Promise met "ok", "ontbreekt" of "onleesbaar". */
function attachOwnFile(opts) {
  opts = opts || {};
  if (!folderHandle) return Promise.resolve("geen-map");
  var name = teamFileName(db.assessor);
  var handle = null;
  var stamp = 0;

  return folderHandle.getFileHandle(name)
    .then(function (h) {
      handle = h;
      return h.getFile().then(function (file) {
        stamp = file.lastModified;
        return file.text().then(function (text) {
          var read = parseDbText(text);
          if (read === "leeg") return "leeg";
          if (!read) {
            if (!opts.overwriteUnreadable) return "onleesbaar";
            return backupRawText(text).then(function () { return "leeg"; });
          }
          // Niets veranderd sinds deze browser het laatst schreef: dan is
          // wat hier staat al volledig.
          if (browserHasWork() && knownStamp(name) === stamp) return "gekend";
          return backupRawText(text).then(function () {
            if (browserHasWork()) {
              mergeOwnFile(db, read.db);
            } else {
              var me = db.assessor;
              db = read.db;
              db.assessor = me;
            }
            return "ingelezen";
          });
        });
      });
    }, function (err) {
      if (err && err.name === "NotFoundError") return "ontbreekt";
      throw err;
    })
    .then(function (res) {
      if (res === "onleesbaar") {
        ownFileHandle = handle;
        fileHandle = null;
        fileName = name;
        ownFileProblem =
          "Misschien is OneDrive nog bezig met synchroniseren, of is het bestand beschadigd. " +
          "De tool schrijft er niets naar zolang het niet leesbaar is. Je werk van nu blijft in deze browser. " +
          "Wacht even en klik op Opnieuw proberen. Lukt het niet, zet dan een reservekopie terug bij Instellingen, Team.";
        updateStatus();
        return "onleesbaar";
      }
      if (res === "ontbreekt" && opts.create === false) return "ontbreekt";
      var ready = handle ? Promise.resolve(handle) : folderHandle.getFileHandle(name, { create: true });
      return ready.then(function (h) {
        ownFileProblem = "";
        ownFileHandle = h;
        fileHandle = h;
        fileName = name;
        ownFileStamp = res === "ingelezen" || res === "gekend" ? stamp : 0;
        saveLocal();
        return writeHandle();
      }).then(function () { return "ok"; });
    });
}

/* Staat er op schijf een andere versie van je eigen bestand dan de
   laatste die deze browser las of schreef? Dan eerst inlezen en
   samenvoegen. Geeft een Promise met true als schrijven veilig is. */
function pullOwnFile() {
  if (!ownFileHandle || fileHandle !== ownFileHandle || ownFileProblem) return Promise.resolve(!ownFileProblem);
  var handle = ownFileHandle;
  return handle.getFile().then(function (file) {
    if (ownFileStamp && file.lastModified === ownFileStamp) return true;
    return file.text().then(function (text) {
      var read = parseDbText(text);
      if (read === "leeg") return true;
      if (!read) {
        ownFileProblem =
          "Het bestand werd intussen gewijzigd, maar kon niet gelezen worden. Misschien is OneDrive nog bezig. " +
          "De tool schrijft er niets naar zolang het niet leesbaar is. Je werk van nu blijft in deze browser.";
        fileHandle = null;
        updateStatus();
        return false;
      }
      return backupRawText(text, true).then(function () {
        var changed = mergeOwnFile(db, read.db);
        ownFileStamp = file.lastModified;
        saveStamp();
        if (changed) {
          saveLocal();
          refreshAll();
          showNotice(
            "info",
            "Je bestand werd intussen op een ander toestel aangepast",
            "Dat werk is bij het jouwe gevoegd. Er ging niets verloren.",
          );
        }
        return true;
      });
    });
  }, function (err) {
    if (!err || err.name !== "NotFoundError" || !folderHandle) throw err;
    // Uit de map verdwenen (bijvoorbeeld per ongeluk verwijderd in
    // OneDrive): opnieuw aanmaken met het werk uit deze browser.
    return folderHandle.getFileHandle(teamFileName(db.assessor), { create: true }).then(function (h) {
      ownFileHandle = h;
      fileHandle = h;
      ownFileStamp = 0;
      return true;
    });
  });
}

function retryOwnFile() {
  if (!folderHandle) return;
  ownFileProblem = "";
  attachOwnFile().then(function (res) {
    updateStatus();
    if (res === "ok") showNotice("good", "Je bestand is weer leesbaar", "Je werk is samengevoegd en bewaard in " + fileName + ".");
  }).catch(function () { updateStatus(); });
}

/* Terugkomen naar het venster: kijk of een ander toestel intussen iets
   bewaarde. */
function checkOwnFileOnFocus() {
  if (document.visibilityState === "hidden" || !ownFileHandle || writing) return;
  pullOwnFile().catch(function () {});
}

/* ------------------------------------------------------------------
   BIJ HET OPSTARTEN
   ------------------------------------------------------------------ */

/* Probeert de vorige map terug te vinden. Geeft een Promise met true als
   de tool gekoppeld is (ook als de browser nog een klik nodig heeft). */
function restoreFolder() {
  if (!FOLDER_SUPPORTED) {
    if (workFileName()) fileName = workFileName();
    updateStatus();
    return Promise.resolve(isLinked());
  }
  if (!db.assessor) return Promise.resolve(false);
  return idbGet("teamFolder")
    .then(function (handle) {
      if (!handle) return false;
      return handle.queryPermission({ mode: "readwrite" }).then(function (perm) {
        if (perm === "granted") {
          folderHandle = handle;
          folderName = handle.name;
          return attachOwnFile().then(function () {
            updateStatus();
            return true;
          }, function () {
            updateStatus();
            return true;
          });
        }
        // Toestemming vervallen. Niet in een melding die bij de
        // eerstvolgende actie verdwijnt, maar in een balk die blijft.
        pendingFolder = handle;
        updateStatus();
        return true;
      });
    })
    .catch(function () { return false; });
}

function reconnectFolder() {
  if (!pendingFolder) return;
  var handle = pendingFolder;
  handle
    .requestPermission({ mode: "readwrite" })
    .then(function (perm) {
      if (perm !== "granted") {
        showNotice(
          "warn",
          "Geen toestemming gekregen",
          "Zonder toegang tot de map blijft je werk alleen in deze browser staan. Probeer het opnieuw.",
        );
        return;
      }
      folderHandle = handle;
      folderName = handle.name;
      pendingFolder = null;
      return attachOwnFile().then(function (res) {
        updateStatus();
        if (currentView === "user") renderUserView();
        if (res !== "ok") return;
        syncTeam(true);
        showNotice("good", "Map weer verbonden", "Je werk is bewaard in " + fileName + " in " + folderName + ".");
      });
    })
    .catch(function () {});
}

function initKoppelen() {
  renderAssessor();
  $("assessor").addEventListener("click", function () { openSettingsView("user"); });
  $("btnSettingsUser").addEventListener("click", openUser);
  $("btnCloseUser").addEventListener("click", goHome);
  $("btnUserEdit").addEventListener("click", openUserEdit);
  $("btnUserCancel").addEventListener("click", closeUserEdit);
  $("btnUserSave").addEventListener("click", saveUserEdit);
  $("btnRelink").addEventListener("click", function () { openWizard("opnieuw"); });

  $("wizardNew").addEventListener("click", function () { showWizardStep("nieuw"); });
  $("wizardExisting").addEventListener("click", function () { showWizardStep("bestaand"); });
  $("wizardToExisting").addEventListener("click", function () { showWizardStep("bestaand"); });
  $("wizardBack").addEventListener("click", function () { showWizardStep(wiz.first); });
  $("wizardCancel").addEventListener("click", closeWizard);
  $("wizardFinish").addEventListener("click", finishWizard);
  $("wizardPickFolder").addEventListener("click", function () { connectToFolder("nieuw"); });
  $("wizardPickExisting").addEventListener("click", function () { connectToFolder("bestaand"); });
  $("wizardDownload").addEventListener("click", wizardDownload);
  $("wizardOpenFile").addEventListener("click", function () { pickFile("wizard"); });
  $("wizardInitials").addEventListener("input", function () {
    $("wizardNewState").innerHTML = "";
  });

  window.addEventListener("focus", checkOwnFileOnFocus);
  document.addEventListener("visibilitychange", checkOwnFileOnFocus);

  return restoreFolder().then(function (linked) {
    if (!linked) openWizard("start");
  });
}

/* ------------------------------------------------------------------
   WAT STAAT ER IN DE MAP?
   ------------------------------------------------------------------ */

/* Leest de map een keer: per persoon het eigen bestand (ook als het
   onleesbaar is), de reservekopieën, en de naam zoals die in de
   bestanden staat. Ook wie enkel bij collega's in het team staat, komt
   in de lijst. Geeft { people: { BB: {...} }, files: [...] }. */
function scanFolder(dirHandle) {
  var people = {};
  var files = [];
  function person(initials) {
    if (!people[initials]) people[initials] = { initials: initials, name: "", file: null, backups: [], knownBy: [] };
    return people[initials];
  }

  return (async function () {
    for await (var entry of dirHandle.values()) {
      if (entry.kind !== "file" || !isTeamFile(entry.name)) continue;
      var initials = assessorFromFileName(entry.name);
      var p = person(initials);
      try {
        var file = await entry.getFile();
        var text = await file.text();
        var read = parseDbText(text);
        if (read === "leeg") continue;
        p.file = { name: entry.name, lastModified: file.lastModified, ok: !!read, db: read ? read.db : null };
        if (read) files.push({ name: entry.name, assessor: initials, db: read.db });
      } catch (e) {
        p.file = { name: entry.name, ok: false };
      }
    }
    try {
      var dir = await dirHandle.getDirectoryHandle(BACKUP_DIR);
      for await (var b of dir.values()) {
        if (b.kind !== "file") continue;
        var info = parseBackupName(b.name);
        if (info) person(info.assessor).backups.push(info);
      }
    } catch (e) {}

    // Namen: eerst uit het eigen bestand, anders uit dat van collega's.
    files.forEach(function (f) {
      var members = (f.db.team && f.db.team.members) || {};
      Object.keys(members).forEach(function (initials) {
        var p = person(initials);
        if (initials !== f.assessor) p.knownBy.push(f.assessor);
        var name = members[initials].name;
        if (!name) return;
        if (initials === f.assessor || !p.name) p.name = name;
      });
    });
    files.forEach(function (f) {
      var own = f.db.team && f.db.team.members && f.db.team.members[f.assessor];
      if (own && own.name) people[f.assessor].name = own.name;
    });
    // Enkel reservekopieën: de naam uit de nieuwste kopie.
    for (var k in people) {
      var q = people[k];
      if (q.file || q.name || !q.backups.length) continue;
      q.backups.sort(function (a, b) { return b.time - a.time; });
      try {
        var t = await readBackupText(q.backups[0].name, dirHandle);
        var m = JSON.parse(t).team.members[k];
        if (m && m.name) q.name = m.name;
      } catch (e) {}
    }
    Object.keys(people).forEach(function (k) {
      people[k].backups.sort(function (a, b) { return b.time - a.time; });
    });
    return { people: people, files: files };
  })();
}

/* Hoeveel beoordelingen van deze persoon staan er in de bestanden van
   collega's? */
function rowsInColleagueFiles(scan, initials) {
  var n = 0;
  scan.files.forEach(function (f) {
    if (f.assessor === initials) return;
    Object.keys(f.db.schoolYears || {}).forEach(function (yr) {
      var sessions = f.db.schoolYears[yr].sessions || {};
      Object.keys(sessions).forEach(function (key) {
        sessions[key].forEach(function (r) { if (r.assessor === initials) n++; });
      });
    });
  });
  return n;
}

/* ------------------------------------------------------------------
   DE OPSTARTWIZARD
   ------------------------------------------------------------------ */

var wiz = { mode: "", first: "keuze", folder: null, scan: null, linked: false };

var FOLDER_HELP =
  "Waar staat de gedeelde map? Open de Verkenner. Links staat OneDrive (met een wolkje). " +
  "Daarin staat de map die jullie delen, bijvoorbeeld \"STEM evaluaties\". Kies die map en klik op Map selecteren. " +
  "De browser vraagt daarna of de tool er bestanden mag bewaren: klik op toestaan. " +
  "Zie je OneDrive of de map niet, dan is OneDrive op deze computer nog niet gesynchroniseerd. " +
  "Meld je aan bij OneDrive, of vraag hulp aan je ICT-verantwoordelijke.";

function openWizard(mode) {
  wiz = { mode: mode, first: "keuze", folder: null, scan: null, linked: false };
  var again = mode === "opnieuw";
  var work = browserHasWork() && !!db.assessor;

  $("wizardTitle").textContent = again ? "Koppeling opnieuw instellen" : work ? "Bewaar je werk in de gedeelde map" : "Welkom";
  $("wizardIntro").textContent = FOLDER_SUPPORTED
    ? "De tool bewaart je werk in je eigen bestand in de gedeelde map van je vakgroep, op OneDrive. Zo staat het veilig, en zien je collega's het."
    : "De tool bewaart je werk in een werkbestand. Dat bestand bewaar je zelf, bijvoorbeeld in OneDrive.";
  $("wizardBrowserWarn").classList.toggle("hidden", FOLDER_SUPPORTED);
  $("wizardFolderHelpNew").textContent = FOLDER_HELP;
  $("wizardFolderHelpExisting").textContent = FOLDER_HELP;
  $("wizardFolderPart").classList.toggle("hidden", !FOLDER_SUPPORTED);
  $("wizardFilePart").classList.toggle("hidden", FOLDER_SUPPORTED);
  $("wizardExistingFolderPart").classList.toggle("hidden", !FOLDER_SUPPORTED);
  $("wizardExistingFilePart").classList.toggle("hidden", FOLDER_SUPPORTED);
  $("wizardNewState").innerHTML = "";
  $("wizardExistingState").innerHTML = "";
  $("wizardPeople").innerHTML = "";

  // Wie al werk in deze browser heeft, is geen nieuwe gebruiker: meteen
  // naar het koppelen, met de initialen die er al zijn.
  $("wizardInitials").value = db.assessor || "";
  $("wizardName").value = myName();
  $("wizardInitials").readOnly = !!(work && db.assessor);
  $("wizardInitialsFixed").classList.toggle("hidden", !(work && db.assessor));
  if (work || again) wiz.first = "nieuw";
  $("wizardNewIntro").textContent = work
    ? "Je werk staat nu enkel in deze browser. Kies de gedeelde map: je werk komt dan in je eigen bestand. Staat daar al werk van jou, dan wordt alles samengevoegd. Er gaat niets verloren."
    : "Vul je initialen en je naam in, en kies daarna de gedeelde map.";

  $("wizardCancel").classList.toggle("hidden", !again);
  $("wizardFinish").textContent = again ? "Klaar" : "Beginnen";
  $("setupWizard").classList.remove("hidden");
  document.body.classList.add("wizard-open");
  showWizardStep(wiz.first);
}

function showWizardStep(step) {
  Array.prototype.forEach.call(document.querySelectorAll("#setupWizard .wizard-step"), function (n) {
    n.classList.toggle("hidden", n.getAttribute("data-step") !== step);
  });
  wiz.step = step;
  $("wizardBack").classList.toggle("hidden", step === wiz.first || wiz.linked);
  $("wizardToExistingRow").classList.toggle("hidden", !(step === "nieuw" && wiz.first === "nieuw"));
  $("wizardFinish").disabled = !wiz.linked;
  $("wizardFinish").classList.toggle("hidden", step === "keuze");
  var focus = step === "keuze" ? $("wizardNew") : step === "nieuw" && !$("wizardInitials").readOnly ? $("wizardInitials") : null;
  if (focus) focus.focus();
}

function closeWizard() {
  $("setupWizard").classList.add("hidden");
  document.body.classList.remove("wizard-open");
  if (currentView === "user") renderUserView();
}

function finishWizard() {
  if (!wiz.linked) return;
  closeWizard();
  refreshAll();
}

/* Een blokje met uitleg en knoppen in de wizard. De eerste knop met
   primary is de standaardkeuze en krijgt de focus. */
function wizardPanel(host, kind, title, text, buttons) {
  host.innerHTML = "";
  var box = el("div", "notice " + kind + " wizard-panel");
  box.appendChild(el("strong", null, title));
  (Array.isArray(text) ? text : [text]).forEach(function (t) {
    if (!t) return;
    if (typeof t === "string") box.appendChild(el("p", null, t));
    else box.appendChild(t);
  });
  var row = el("div", "btn-row");
  var first = null;
  (buttons || []).forEach(function (b) {
    var btn = el("button", b.primary ? "btn-primary" : "btn-ghost", b.label);
    btn.type = "button";
    if (b.id) btn.id = b.id;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
    if (b.primary && !first) first = btn;
  });
  if (buttons && buttons.length) box.appendChild(row);
  host.appendChild(box);
  if (first) first.focus();
  return box;
}

function wizardBusy(host, text) {
  host.innerHTML = "";
  host.appendChild(el("div", "hint", text));
}

/* Alle wegen om een map te koppelen, zie bovenaan. "nieuw": je vulde je
   initialen in; "bestaand": je kiest jezelf uit de lijst. */
function connectToFolder(path) {
  var host = path === "nieuw" ? $("wizardNewState") : $("wizardExistingState");
  var initials = cleanAssessor($("wizardInitials").value);
  if (path === "nieuw" && !initials) {
    wizardPanel(host, "warn", "Vul eerst je initialen in", "Die bepalen hoe je bestand in de gedeelde map heet.", []);
    return Promise.resolve();
  }

  return window
    .showDirectoryPicker({ mode: "readwrite" })
    .then(function (handle) {
      wiz.folder = handle;
      wizardBusy(host, "Even kijken wat er in " + handle.name + " staat…");
      return scanFolder(handle).then(function (scan) {
        wiz.scan = scan;
        if (path === "nieuw") recognizeInitials(initials, $("wizardName").value.trim());
        else renderPeople();
      });
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      wizardPanel(host, "warn", "Map koppelen lukte niet", (err && err.message ? err.message + ". " : "") + "Probeer het opnieuw.", []);
    });
}

/* De eerste weg, maar de initialen bestaan al in de map. Nooit
   overschrijven: de vraag is of je die persoon bent, en ophalen is de
   standaardkeuze. */
function recognizeInitials(initials, typedName) {
  var host = $("wizardNewState");
  var p = wiz.scan.people[initials];
  var again = wiz.mode === "opnieuw";
  var fixed = $("wizardInitials").readOnly;

  if (!p) {
    linkNewFile(initials, typedName, host);
    return;
  }

  var who = p.name || initials;
  var other = {
    label: fixed ? "Nee, een andere map kiezen" : "Nee, ik kies andere initialen",
    onClick: function () {
      host.innerHTML = "";
      if (fixed) return;
      $("wizardInitials").focus();
      $("wizardInitials").select();
    },
  };
  var fetch = function () { choosePerson(p, host); };

  if (p.file && !p.file.ok) {
    showUnreadable(p, host);
    return;
  }

  if (typedName && p.name && !sameName(typedName, p.name) && !again) {
    wizardPanel(host, "warn", "Die initialen gebruikt al iemand anders",
      [
        "In deze map staat al werk van " + initials + ", en dat is van " + p.name + ". Jij vulde " + typedName + " in.",
        "Kies andere initialen, bijvoorbeeld met een extra letter. Ben je toch " + p.name + ", haal dan je werk op.",
      ],
      [
        { label: "Andere initialen kiezen", primary: true, onClick: other.onClick },
        { label: "Ik ben " + p.name + ": haal mijn werk op", onClick: fetch },
      ]);
    return;
  }

  var where = p.file
    ? "In deze map staat al werk van " + initials + (p.name ? " (" + p.name + ")" : "") + "."
    : p.backups.length
      ? "Het bestand van " + initials + " staat niet meer in deze map, maar er zijn wel reservekopieën."
      : initials + " staat al in het team van je collega's" + (p.name ? ", als " + p.name : "") + ".";
  wizardPanel(host, "info", "Ben jij " + who + "?",
    [where, "Dan halen we je werk op. Er gaat niets verloren."],
    [
      { label: "Ja, haal mijn werk op", primary: true, id: "wizardFetch", onClick: fetch },
      other,
    ]);
}

/* De tweede weg: een lijst met iedereen die in de map werk heeft. */
function renderPeople() {
  var host = $("wizardPeople");
  var state = $("wizardExistingState");
  host.innerHTML = "";
  state.innerHTML = "";
  var list = Object.keys(wiz.scan.people).map(function (k) { return wiz.scan.people[k]; });
  list.sort(function (a, b) { return (a.name || a.initials).localeCompare(b.name || b.initials, "nl"); });

  if (!list.length) {
    wizardPanel(state, "warn", "In deze map staat nog geen werk",
      "Is dit de juiste map? Kies een andere map, of kies Ik gebruik de tool voor het eerst als je nog nooit met de tool werkte.",
      [
        { label: "Andere map kiezen", primary: true, onClick: function () { connectToFolder("bestaand"); } },
        { label: "Ik gebruik de tool voor het eerst", onClick: function () { showWizardStep("nieuw"); } },
      ]);
    return;
  }

  host.appendChild(el("p", "hint", "Klik op je naam."));
  list.forEach(function (p) {
    var btn = el("button", "wizard-person");
    btn.type = "button";
    btn.setAttribute("data-initials", p.initials);
    btn.appendChild(el("strong", null, p.name || p.initials));
    if (p.name) btn.appendChild(el("span", "wizard-person-init", p.initials));
    var sub = p.file && p.file.ok
      ? "laatst bewaard op " + backupLabel(p.file.lastModified)
      : p.file
        ? "bestand kon niet gelezen worden"
        : p.backups.length
          ? "bestand niet gevonden, wel reservekopieën"
          : "enkel bekend bij collega's";
    btn.appendChild(el("span", "wizard-person-sub", sub));
    btn.addEventListener("click", function () { choosePerson(p, state); });
    host.appendChild(btn);
  });

  var missing = el("button", "btn-ghost btn-small", "Ik sta niet in de lijst");
  missing.type = "button";
  missing.id = "wizardNotListed";
  missing.addEventListener("click", function () { showNotListed(state); });
  host.appendChild(missing);
}

function showNotListed(host) {
  var input = document.createElement("input");
  input.type = "text";
  input.id = "wizardSearchInitials";
  input.maxLength = 20;
  input.placeholder = "Je initialen";
  var wrap = el("div", "form-group");
  wrap.appendChild(input);
  wizardPanel(host, "info", "Vul je initialen in", [wrap], [
    {
      label: "Zoeken",
      primary: true,
      onClick: function () {
        var initials = cleanAssessor(input.value);
        if (!initials) return;
        var p = wiz.scan.people[initials];
        if (p) { choosePerson(p, host); return; }
        if (rowsInColleagueFiles(wiz.scan, initials)) {
          showColleagueRecovery({ initials: initials, name: "", file: null, backups: [], knownBy: [] }, host);
          return;
        }
        wizardPanel(host, "warn", "Er staat nog niets van " + initials + " in deze map",
          "Is dit de juiste map? Werkte je nog nooit met de tool, kies dan Ik gebruik de tool voor het eerst.",
          [
            { label: "Ik gebruik de tool voor het eerst", primary: true, onClick: function () {
              $("wizardInitials").value = $("wizardInitials").readOnly ? $("wizardInitials").value : initials;
              showWizardStep("nieuw");
            } },
            { label: "Andere map kiezen", onClick: function () { connectToFolder("bestaand"); } },
          ]);
      },
    },
  ]);
  input.focus();
}

/* Iemand koos zichzelf (of zei ja op "Ben jij ...?"). */
function choosePerson(p, host) {
  // Werk in deze browser van iemand anders nooit stil vermengen.
  if (browserHasWork() && db.assessor && p.initials !== db.assessor) {
    wizardPanel(host, "warn", "In deze browser staat het werk van " + (myName() || db.assessor),
      "Kies jezelf (" + db.assessor + "). Wil je als iemand anders werken, gebruik dan een andere browser of vraag hulp aan je ICT-verantwoordelijke.",
      []);
    return;
  }
  if (p.file && p.file.ok) linkExistingFile(p, host);
  else if (p.file) showUnreadable(p, host);
  else if (p.backups.length) showBackupRestore(p, host);
  else showColleagueRecovery(p, host);
}

function showUnreadable(p, host) {
  var buttons = [{
    label: "Opnieuw proberen",
    primary: true,
    onClick: function () {
      wizardBusy(host, "Opnieuw aan het lezen…");
      scanFolder(wiz.folder).then(function (scan) {
        wiz.scan = scan;
        var fresh = scan.people[p.initials] || p;
        if (fresh.file && fresh.file.ok) choosePerson(fresh, host);
        else showUnreadable(fresh, host);
      });
    },
  }];
  if (p.backups.length) {
    buttons.push({ label: "Werk terughalen uit een reservekopie", onClick: function () { showBackupRestore(p, host, true); } });
  }
  wizardPanel(host, "warn", "Je bestand kon niet gelezen worden",
    [
      p.file.name + " staat in de map, maar de tool kan het niet lezen. Misschien is OneDrive nog bezig met synchroniseren.",
      "Wacht een minuut en probeer opnieuw. De tool schrijft niets naar dit bestand zolang het niet leesbaar is.",
    ],
    buttons);
}

/* Het eigen bestand ontbreekt (of is onleesbaar), maar er zijn
   reservekopieën: nieuwste eerst, met datum en uur. */
function showBackupRestore(p, host, unreadable) {
  var list = el("div", "backup-list");
  p.backups.forEach(function (b, i) {
    var row = el("div", "backup-row");
    row.appendChild(el("span", "backup-when", backupLabel(b.time)));
    if (i === 0) row.appendChild(el("span", "backup-tag", "nieuwste"));
    var btn = el("button", i === 0 ? "btn-primary btn-small" : "btn-ghost btn-small", "Terughalen");
    btn.type = "button";
    btn.title = b.name;
    btn.addEventListener("click", function () { linkFromBackup(p, b, host, unreadable); });
    row.appendChild(btn);
    list.appendChild(row);
  });
  wizardPanel(host, "info", unreadable ? "Werk terughalen uit een reservekopie" : "Je bestand is niet gevonden",
    [
      unreadable
        ? "Kies de nieuwste, tenzij je weet dat er toen al iets misging. Het onleesbare bestand blijft bewaard bij de reservekopieën."
        : "Wil je je werk terughalen uit een reservekopie? Kies de nieuwste, tenzij je weet dat er toen al iets misging.",
      list,
    ],
    [{ label: "Geen reservekopie gebruiken", onClick: function () { showColleagueRecovery(p, host, true); } }]);
}

/* Geen bestand en geen (gekozen) reservekopie: eerlijk uitleggen wat de
   bestanden van collega's bevatten. Pas na deze uitdrukkelijke keuze
   komt er een nieuw, leeg bestand. */
function showColleagueRecovery(p, host, afterBackups) {
  var n = rowsInColleagueFiles(wiz.scan, p.initials);
  var others = wiz.scan.files.filter(function (f) { return f.assessor !== p.initials; }).length;
  var text = [
    (afterBackups ? "" : "Je bestand en je reservekopieën zijn niet gevonden. ") +
      "Je kan je werk terughalen uit de bestanden van je collega's in deze map.",
    "Let op: die bevatten enkel wat zij de laatste keer van jou overnamen met Team bijwerken. Wat je daarna nog deed, zit er niet in.",
    n ? "In hun bestanden staan " + n + " beoordeling(en) van jou." : "In hun bestanden staat geen enkele beoordeling van jou.",
  ];
  var buttons = [];
  if (others) {
    buttons.push({ label: "Terughalen uit de bestanden van collega's", primary: true, onClick: function () { linkFromColleagues(p, host); } });
  }
  buttons.push({
    label: "Beginnen met een nieuw, leeg bestand",
    primary: !others,
    onClick: function () { linkNewFile(p.initials, $("wizardName").value.trim() || p.name, host); },
  });
  wizardPanel(host, "info", afterBackups ? "Werk terughalen uit de bestanden van collega's" : "Je bestand is niet gevonden", text, buttons);
}

/* ---- de eigenlijke koppeling ---- */

/* Vóór elke stap die inleest, samenvoegt of terugzet: een reservekopie
   van het werk in deze browser, als dat er is. */
function startLink(initials) {
  folderHandle = wiz.folder;
  folderName = wiz.folder.name;
  pendingFolder = null;
  setIdentity(initials);
  lastBackupAt = 0;
  lastBackupContent = null;
  return browserHasWork() ? makeBackup() : Promise.resolve(null);
}

function linkDone(host, typedName) {
  var named = typedName && !myName() && setMyName(typedName);
  return idbPut("teamFolder", folderHandle).catch(function () {}).then(function () {
    if (!named) return;
    // De naam meteen in het bestand, niet pas bij de volgende opslag.
    saveLocal();
    return writeHandle();
  }).then(function () {
    wiz.linked = true;
    persist();
    renderAssessor();
    refreshAll();
    updateStatus();
    wizardPanel(host, "good", "Gekoppeld",
      "Je werk wordt bewaard in " + fileName + " in de map " + folderName + ". Dat gebeurt vanaf nu vanzelf." +
        (wiz.mode === "opnieuw" ? "" : " Klik op Beginnen."),
      []);
    showWizardStep(wiz.step);
    $("wizardFinish").focus();
  });
}

function linkFailed(host, err) {
  folderHandle = null;
  wizardPanel(host, "warn", "Koppelen lukte niet", (err && err.message ? err.message + ". " : "") + "Probeer het opnieuw.", []);
}

function linkExistingFile(p, host) {
  wizardBusy(host, "Je werk wordt opgehaald…");
  return startLink(p.initials)
    .then(function () { return attachOwnFile({ create: false }); })
    .then(function (res) {
      if (res === "ok") return linkDone(host, "");
      folderHandle = null;
      if (res === "onleesbaar") showUnreadable(p, host);
      else showBackupRestore(p, host);
    })
    .catch(function (err) { linkFailed(host, err); });
}

function linkNewFile(initials, typedName, host) {
  wizardBusy(host, "Je bestand wordt aangemaakt…");
  return startLink(initials)
    .then(function () { return attachOwnFile(); })
    .then(function (res) {
      if (res === "ok") return linkDone(host, typedName);
      folderHandle = null;
      showUnreadable(wiz.scan.people[initials] || { initials: initials, file: { name: teamFileName(initials) }, backups: [] }, host);
    })
    .catch(function (err) { linkFailed(host, err); });
}

/* Terugzetten met dezelfde logica als bij Instellingen, Team
   (restoreBackup() in js/backups.js), inclusief refreshRestoredTimes(). */
function linkFromBackup(p, b, host, unreadable) {
  wizardBusy(host, "Je werk wordt teruggehaald…");
  var hadWork = browserHasWork();
  return startLink(p.initials)
    .then(function () { return readBackupText(b.name); })
    .then(function (text) {
      var read = readAnyFile(JSON.parse(text), CONFIG);
      if (!read) throw new Error("Deze reservekopie kon niet gelezen worden");
      var current = db;
      var restored = read.db;
      refreshRestoredTimes(restored, current, Date.now());
      restored.assessor = p.initials;
      db = restored;
      // Werk dat enkel in deze browser stond, gaat niet verloren.
      if (hadWork) mergeOwnFile(db, current);
      return attachOwnFile({ overwriteUnreadable: !!unreadable });
    })
    .then(function (res) {
      if (res === "ok") return linkDone(host, "");
      folderHandle = null;
      showUnreadable(p, host);
    })
    .catch(function (err) { linkFailed(host, err); });
}

function linkFromColleagues(p, host) {
  wizardBusy(host, "Je werk wordt teruggehaald uit de bestanden van je collega's…");
  return startLink(p.initials)
    .then(function () {
      wiz.scan.files.forEach(function (f) {
        if (f.assessor !== p.initials) mergeDb(db, f.db);
      });
      return attachOwnFile();
    })
    .then(function (res) {
      if (res === "ok") return linkDone(host, $("wizardName").value.trim());
      folderHandle = null;
      showUnreadable(p, host);
    })
    .catch(function (err) { linkFailed(host, err); });
}

/* ---- browser zonder File System Access API ---- */

function wizardDownload() {
  var host = $("wizardNewState");
  var initials = cleanAssessor($("wizardInitials").value);
  if (!initials) {
    wizardPanel(host, "warn", "Vul eerst je initialen in", "Die komen in de naam van je werkbestand.", []);
    return;
  }
  setIdentity(initials);
  setMyName($("wizardName").value);
  persist();
  downloadDb();
  try { localStorage.setItem(WORKFILE_KEY, fileName); } catch (e) {}
  wiz.linked = true;
  updateStatus();
  wizardPanel(host, "good", "Je werkbestand is gedownload",
    [
      fileName + " staat nu bij je downloads. Zet het op een veilige plek, bijvoorbeeld in OneDrive.",
      "Deze browser kan niet vanzelf bewaren: klik na elke les op Opslaan (download) en vervang het oude bestand.",
    ], []);
  showWizardStep(wiz.step);
}

/* Via handleIncoming() in js/storage.js, na "Mijn werkbestand openen". */
function wizardOpenedFile(read, name) {
  var host = $("wizardExistingState");
  var initials = cleanAssessor(read.db.assessor) || assessorFromFileName(String(name).replace(/^stem-/, ""));
  if (!initials) {
    var m = /^stem-evaluaties-([A-Za-z0-9]{1,6})/.exec(name);
    initials = m ? m[1].toUpperCase() : "";
  }
  if (!initials) {
    wizardPanel(host, "warn", "Dit bestand heeft geen initialen", "Kies het werkbestand dat de tool voor jou maakte, bijvoorbeeld stem-evaluaties-BB.json.", []);
    return;
  }
  if (browserHasWork() && db.assessor && db.assessor !== initials) {
    wizardPanel(host, "warn", "Dit is het werkbestand van " + initials,
      "In deze browser staat het werk van " + db.assessor + ". Open je eigen werkbestand.", []);
    return;
  }
  if (browserHasWork()) {
    mergeOwnFile(db, read.db);
  } else {
    db = read.db;
  }
  setIdentity(initials);
  fileName = name;
  try { localStorage.setItem(WORKFILE_KEY, name); } catch (e) {}
  persist();
  wiz.linked = true;
  refreshAll();
  updateStatus();
  wizardPanel(host, "good", "Je werk is terug",
    [
      countAllRows(db) + " beoordeling(en) ingelezen uit " + name + ".",
      "Deze browser kan niet vanzelf bewaren: klik na elke les op Opslaan (download) en vervang het oude bestand.",
    ], []);
  showWizardStep(wiz.step);
}

/* ------------------------------------------------------------------
   INSTELLINGEN, GEBRUIKER
   ------------------------------------------------------------------ */

function openUser() {
  closeUserEdit();
  renderUserView();
  showView("user");
}

function renderUserView() {
  $("userInitials").textContent = db.assessor || "?";
  $("userName").textContent = myName() || "nog niet ingevuld";

  var host = $("userStorage");
  host.innerHTML = "";
  function line(label, value) {
    var p = el("p", "user-line");
    p.appendChild(el("span", "user-label", label));
    p.appendChild(el("code", null, value));
    host.appendChild(p);
  }

  if (!FOLDER_SUPPORTED) {
    line("Werkbestand", workFileName() || "nog geen");
    host.appendChild(el("p", "hint",
      "Deze browser kan niet vanzelf bewaren. Klik na elke les op Opslaan (download) en vervang het oude bestand, bijvoorbeeld in OneDrive. " +
      "Gebruik liefst Chrome of Edge: daar bewaart de tool elke wijziging vanzelf in de gedeelde map."));
    return;
  }
  if (pendingFolder && !folderHandle) {
    line("Gedeelde map", pendingFolder.name);
    line("Jouw bestand", teamFileName(db.assessor));
    host.appendChild(el("p", "hint", "De browser vraagt opnieuw toestemming voor deze map. Tot je verbindt, blijft je werk enkel in deze browser."));
    var re = el("button", "btn-primary", "Verbinden met " + pendingFolder.name);
    re.type = "button";
    re.addEventListener("click", reconnectFolder);
    host.appendChild(re);
    return;
  }
  if (folderHandle) {
    line("Gedeelde map", folderName);
    line("Jouw bestand", teamFileName(db.assessor));
    host.appendChild(el("p", "hint", ownFileProblem
      ? "Je bestand kon niet gelezen worden. De tool schrijft er niets naar tot het weer leesbaar is."
      : "De tool bewaart elke wijziging vanzelf in dit bestand."));
    return;
  }
  host.appendChild(el("p", "hint", "Nog niet gekoppeld."));
}

function openUserEdit() {
  $("userNameInput").value = myName();
  $("userEditForm").classList.remove("hidden");
  $("btnUserEdit").classList.add("hidden");
  $("userNameInput").focus();
}

function closeUserEdit() {
  $("userEditForm").classList.add("hidden");
  $("btnUserEdit").classList.remove("hidden");
}

function saveUserEdit() {
  var name = $("userNameInput").value.trim();
  if (!name) {
    showNotice("warn", "Vul je naam in", "Zo herkennen je collega's je in de overzichten.");
    return;
  }
  var changed = setMyName(name);
  closeUserEdit();
  if (changed) {
    persist();
    showNotice("good", "Naam gewijzigd", "Je collega's zien je nieuwe naam na Team bijwerken.");
  }
  renderAssessor();
  renderUserView();
}
