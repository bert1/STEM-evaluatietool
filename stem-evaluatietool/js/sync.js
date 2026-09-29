/* ---- overgenomen uit team.js ---- */

/* ------------------------------------------------------------------
   TEAMSCHERM
   ------------------------------------------------------------------ */

var folderHandle = null;

var folderName = "";

var pendingFolder = null;

 // onthouden map die nog toestemming nodig heeft

function openTeam() {
  if (!$("teamYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) {
      $("teamYear").appendChild(new Option(y, y));
    });
    var chosen = $("yearSelect").value;
    if (chosen) $("teamYear").value = chosen;
  }
  ensureSelfInTeam();
  renderFolderSection();
  renderMembers();
  renderTeamClasses();
  showView("team");
}



/* Je eigen initialen horen er altijd bij te staan. */
function ensureSelfInTeam() {
  var me = cleanAssessor($("assessor").value || db.assessor);
  if (!me) return;
  if (!db.team) db.team = emptyTeam();
  if (!db.team.members[me]) {
    db.team.members[me] = { name: "" };
    db.team.updatedAt = Date.now();
  }
}

function touchTeam() {
  db.team.updatedAt = Date.now();
  persist();
}



/* --- collega's --- */

function renderMembers() {
  var host = $("memberRows");
  host.innerHTML = "";
  var me = cleanAssessor($("assessor").value || db.assessor);
  var list = memberList(db);

  if (!list.length) {
    host.appendChild(el("div", "hint", "Nog geen collega's toegevoegd."));
    return;
  }

  list.forEach(function (initials) {
    var row = el("div", "member-row");

    var init = document.createElement("input");
    init.type = "text";
    init.className = "init-in";
    init.value = initials;
    init.maxLength = 20;
    init.addEventListener("change", function () {
      var next = cleanAssessor(this.value);
      if (!next || next === initials) { this.value = initials; return; }
      if (db.team.members[next]) {
        showNotice("warn", "Die initialen bestaan al", next + " staat al in de lijst.");
        this.value = initials;
        return;
      }
      renameMember(initials, next);
    });
    row.appendChild(init);

    var name = document.createElement("input");
    name.type = "text";
    name.value = db.team.members[initials].name || "";
    name.placeholder = "Naam van je collega";
    name.addEventListener("input", function () {
      db.team.members[initials].name = this.value;
    });
    name.addEventListener("change", touchTeam);
    row.appendChild(name);

    if (initials === me) {
      row.appendChild(el("span", "me", "jij"));
    } else {
      var rm = el("button", "icon-btn danger", "×");
      rm.type = "button";
      rm.title = "Collega verwijderen";
      rm.addEventListener("click", function () {
        if (!confirm("Verwijder " + memberName(db, initials) + " uit het team?\n\nHun opgeslagen evaluaties blijven bewaard.")) return;
        delete db.team.members[initials];
        Object.keys(db.team.classes).forEach(function (key) {
          db.team.classes[key] = db.team.classes[key].filter(function (i) { return i !== initials; });
        });
        touchTeam();
        renderMembers();
        renderTeamClasses();
      });
      row.appendChild(rm);
    }

    host.appendChild(row);
  });
}

function renameMember(from, to) {
  db.team.members[to] = db.team.members[from];
  delete db.team.members[from];
  Object.keys(db.team.classes).forEach(function (key) {
    db.team.classes[key] = db.team.classes[key].map(function (i) { return i === from ? to : i; });
  });
  touchTeam();
  renderMembers();
  renderTeamClasses();
}

function addMember() {
  var base = "XX";
  var n = 1;
  while (db.team.members[base + n]) n++;
  db.team.members[base + n] = { name: "" };
  touchTeam();
  renderMembers();
  var inputs = $("memberRows").querySelectorAll(".init-in");
  if (inputs.length) {
    var last = inputs[inputs.length - 1];
    last.focus();
    last.select();
  }
}



/* --- wie voor welke klas --- */

function renderTeamClasses() {
  var year = $("teamYear").value;
  var host = $("teamClasses");
  host.innerHTML = "";

  var klassen = classesFor(db, year);
  if (!klassen.length) {
    host.appendChild(el("div", "empty", "Nog geen klassen in " + year + ". Lees eerst je klaslijsten in."));
    return;
  }
  var members = memberList(db);
  if (!members.length) {
    host.appendChild(el("div", "empty", "Voeg eerst collega's toe."));
    return;
  }

  klassen.forEach(function (klas) {
    var key = teamKey(year, klas);
    var assigned = db.team.classes[key] || [];

    var row = el("div", "team-class");
    row.appendChild(el("span", "klas", klas));

    var who = el("div", "who");
    members.forEach(function (initials) {
      var on = assigned.indexOf(initials) !== -1;
      var label = el("label", "pick" + (on ? " on" : ""));
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = on;
      cb.addEventListener("change", function () {
        var list = db.team.classes[key] || [];
        if (this.checked) {
          if (list.indexOf(initials) === -1) list.push(initials);
        } else {
          list = list.filter(function (i) { return i !== initials; });
        }
        if (list.length) db.team.classes[key] = list;
        else delete db.team.classes[key];
        touchTeam();
        renderTeamClasses();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(initials));
      var full = memberName(db, initials);
      if (full !== initials) label.title = full;
      who.appendChild(label);
    });
    row.appendChild(who);

    row.appendChild(el("span", "count", studentsFor(db, year, klas).length + " leerlingen"));
    host.appendChild(row);
  });
}



/* ------------------------------------------------------------------
   GEDEELDE MAP
   ------------------------------------------------------------------ */

function renderFolderSection() {
  renderBackupList();
  var buttons = $("folderButtons");
  var state = $("folderState");
  buttons.innerHTML = "";
  state.innerHTML = "";

  if (!FOLDER_SUPPORTED) {
    var off = el("div", "folder-state off");
    off.appendChild(document.createTextNode(
      "Deze browser kan geen map onthouden. Gebruik Chrome of Edge, of wissel bestanden uit met " +
      "'Werk van collega toevoegen' op het evaluatiescherm.",
    ));
    state.appendChild(off);
    return;
  }

  var pick = el("button", "btn-primary", folderHandle ? "Andere map kiezen" : "Gedeelde map kiezen");
  pick.type = "button";
  pick.addEventListener("click", pickFolder);
  buttons.appendChild(pick);

  if (pendingFolder && !folderHandle) {
    var again = el("button", "btn-primary", "Verbinden met " + pendingFolder.name);
    again.type = "button";
    again.addEventListener("click", reconnectFolder);
    buttons.innerHTML = "";
    buttons.appendChild(again);
    var pick2 = el("button", "btn-ghost", "Andere map kiezen");
    pick2.type = "button";
    pick2.addEventListener("click", pickFolder);
    buttons.appendChild(pick2);

    var waiting = el("div", "folder-state off");
    waiting.appendChild(document.createTextNode(
      "Je werkte eerder in " + pendingFolder.name + ", maar de browser vraagt elke sessie opnieuw " +
      "toestemming. Tot je verbindt, blijft je werk alleen in deze browser staan.",
    ));
    state.appendChild(waiting);
    return;
  }

  if (folderHandle) {
    var forget = el("button", "btn-ghost", "Map loskoppelen");
    forget.type = "button";
    forget.addEventListener("click", forgetFolder);
    buttons.appendChild(forget);

    var box = el("div", "folder-state");
    box.appendChild(document.createTextNode("Verbonden met "));
    box.appendChild(el("code", null, folderName));
    box.appendChild(document.createTextNode(". Jouw werk gaat naar "));
    box.appendChild(el("code", null, teamFileName(db.assessor)));
    state.appendChild(box);
  } else {
    var idle = el("div", "folder-state off");
    idle.appendChild(document.createTextNode(
      "Nog geen map gekozen. Zonder map kan je nog altijd bestanden uitwisselen met " +
      "'Werk van collega toevoegen'.",
    ));
    state.appendChild(idle);
  }
}



/* Kernlogica van het verbinden met een map. Rapporteert via callbacks in
   plaats van rechtstreeks een melding te tonen, zodat zowel het gewone
   Teamscherm als de opstartwizard hun eigen plek voor de uitkomst kunnen
   gebruiken. */
function connectToFolder(onSuccess, onError) {
  var me = cleanAssessor($("assessor").value || db.assessor);
  if (!me) {
    onError("Vul eerst je initialen in", "Die bepalen hoe jouw bestand in de gedeelde map gaat heten.");
    return;
  }

  window
    .showDirectoryPicker({ mode: "readwrite" })
    .then(function (handle) {
      return checkOwnFile(handle, teamFileName(me), instanceId).then(function (check) {
        if (check.conflict) {
          var proceed = confirm(
            "Let op: in deze map staat al " + check.name + ", en dat bestand komt van een ander toestel.\n\n" +
            "Waarschijnlijk gebruikt een collega dezelfde initialen als jij, of werk je hier vanaf een tweede toestel.\n\n" +
            "Doorgaan overschrijft dat bestand met jouw gegevens. Kies anders eerst andere initialen.\n\n" +
            "Toch doorgaan?",
          );
          if (!proceed) return null;
        }
        return handle;
      });
    })
    .then(function (handle) {
      if (!handle) return null;
      folderHandle = handle;
      folderName = handle.name;
      return idbPut("teamFolder", handle).then(function () {
        return attachOwnFile();
      }).then(function () { return handle; });
    })
    .then(function (handle) {
      if (!handle || !folderHandle) return;
      renderFolderSection();
      updateStatus();
      onSuccess(folderName);
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") return;
      onError("Map koppelen lukte niet", err && err.message ? err.message : "Probeer het opnieuw.");
    });
}

function pickFolder() {
  connectToFolder(
    function (name) {
      showNotice(
        "good", "Map verbonden",
        "Jouw werk wordt vanaf nu bewaard in " + teamFileName(db.assessor) + " in " + name +
          ". Klik op Team bijwerken om het werk van je collega's op te halen.",
      );
    },
    function (title, body) { showNotice("warn", title, body); },
  );
}



/* Zorgt dat 'Opslaan' naar jouw bestand in de gedeelde map schrijft. */
function attachOwnFile() {
  if (!folderHandle) return Promise.resolve();
  var name = teamFileName(db.assessor);
  return folderHandle.getFileHandle(name, { create: true }).then(function (handle) {
    fileHandle = handle;
    fileName = name;
    return writeHandle();
  });
}

function forgetFolder() {
  if (!confirm("Map loskoppelen?\n\nJe bestanden blijven staan waar ze staan. Je kan de map later opnieuw kiezen.")) return;
  folderHandle = null;
  folderName = "";
  pendingFolder = null;
  idbDelete("teamFolder");
  renderFolderSection();
  updateStatus();
}



/* Bij het opstarten proberen we de vorige map terug te vinden. De
   browser kan om nieuwe toestemming vragen; dat vereist een klik. */
function restoreFolder() {
  if (!FOLDER_SUPPORTED) return;
  idbGet("teamFolder")
    .then(function (handle) {
      if (!handle) return;
      return handle.queryPermission({ mode: "readwrite" }).then(function (perm) {
        if (perm === "granted") {
          folderHandle = handle;
          folderName = handle.name;
          return attachOwnFile().then(function () {
            renderFolderSection();
            updateStatus();
          });
        }
        // Toestemming vervallen. Niet in een melding zetten die bij de
        // eerstvolgende actie verdwijnt, maar in een balk die blijft staan.
        pendingFolder = handle;
        updateStatus();
      });
    })
    .catch(function () {});
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
          "Zonder toegang tot de map blijft je werk alleen in deze browser staan. Probeer het opnieuw, of kies de map opnieuw via het Teamscherm.",
        );
        return;
      }
      folderHandle = handle;
      folderName = handle.name;
      pendingFolder = null;
      return attachOwnFile().then(function () {
        renderFolderSection();
        updateStatus();
        syncTeam(true);
        showNotice("good", "Map weer verbonden", "Je werk is bewaard in " + fileName + " in " + folderName + ".");
      });
    })
    .catch(function () {});
}



/* --- het werk van iedereen ophalen --- */

function syncTeam(quiet) {
  if (!folderHandle) {
    showNotice("info", "Nog geen gedeelde map", "Kies er een via het Teamscherm, dan haal je met één klik het werk van iedereen op.");
    return;
  }

  $("btnSyncTeam").disabled = true;
  $("btnSyncTeam").textContent = "Bezig…";

  readTeamFolder(folderHandle, teamFileName(db.assessor), CONFIG)
    .then(function (result) {
      var totals = { added: 0, updated: 0, skipped: 0 };
      var classes = [];
      var evaluations = [];
      var teamChanged = false;
      var perColleague = [];

      result.files.forEach(function (item) {
        var stats = mergeDb(db, item.db);
        totals.added += stats.added;
        totals.updated += stats.updated;
        totals.skipped += stats.skipped;
        classes = classes.concat(stats.classes || []);
        evaluations = evaluations.concat(stats.evaluations || []);
        if (stats.team) teamChanged = true;
        if (stats.added || stats.updated) {
          perColleague.push(memberName(db, item.assessor) + ": " + stats.added + " nieuw");
        }
      });

      // Alleen opslaan wanneer er echt iets veranderd is. Anders zou de
      // status onterecht op "Niet opgeslagen" springen na een sync.
      var changed = totals.added || totals.updated || classes.length || evaluations.length || teamChanged;
      if (changed) persist();
      refreshAll();

      $("btnSyncTeam").disabled = false;
      $("btnSyncTeam").textContent = "Team bijwerken";

      if (!result.files.length) {
        if (!quiet) {
          showNotice(
            "info",
            "Nog geen bestanden van collega's",
            "In " + folderName + " staat alleen jouw bestand. Laat je collega's hun map op dezelfde plek koppelen.",
          );
        }
        return;
      }

      var bits = [];
      if (totals.added) bits.push(totals.added + " nieuwe rij(en)");
      if (totals.updated) bits.push(totals.updated + " bijgewerkt");
      if (classes.length) bits.push("klaslijsten: " + classes.join(", "));
      if (evaluations.length) bits.push("evaluaties: " + evaluations.join(", "));
      if (teamChanged) bits.push("teamindeling bijgewerkt");

      if (!bits.length) {
        if (!quiet) {
          showNotice(
            "info",
            "Je bent al bij",
            result.files.length + " bestand(en) gelezen uit " + folderName + ", niets nieuws gevonden." +
              (result.problems.length ? " Wel: " + result.problems.join(", ") + "." : ""),
          );
        }
        return;
      }

      showNotice(
        "good",
        "Bijgewerkt met " + result.files.length + " bestand(en)",
        bits.join(" · ") + "." +
          (perColleague.length ? " Van " + perColleague.join(", ") + "." : "") +
          (result.problems.length ? " Niet gelukt: " + result.problems.join(", ") + "." : ""),
      );
    })
    .catch(function (err) {
      $("btnSyncTeam").disabled = false;
      $("btnSyncTeam").textContent = "Team bijwerken";
      showNotice(
        "warn",
        "Map kon niet gelezen worden",
        (err && err.message ? err.message + ". " : "") + "Koppel de map opnieuw via het Teamscherm.",
      );
    });
}

/* ---- overgenomen uit core.js ---- */



/* ------------------------------------------------------------------
   TEAM
   Wie geeft samen welke klas? Dat maakt de voortgang per klas
   afleesbaar en waarschuwt wanneer je in een klas werkt waar je
   niet voor ingeschreven staat.

   team = {
     members: { "JVDB": { name: "Jan Van den Bergh" } },
     classes: { "1ste jaar||1WM": ["JVDB", "MDC"] },
     updatedAt
   }
   ------------------------------------------------------------------ */

function teamKey(year, klas) {
  return year + "||" + klas;
}

function emptyTeam() {
  return { members: {}, classes: {}, updatedAt: 0 };
}

function teamFor(db, year, klas) {
  if (!db.team || !db.team.classes) return [];
  return (db.team.classes[teamKey(year, klas)] || []).slice();
}

/* Unie van de teamleden van meerdere klassen tegelijk — voor een
   evaluatiesessie die meer dan één klas combineert. */
function teamForKlassen(db, year, klassen) {
  var seen = {};
  var out = [];
  (klassen || []).forEach(function (klas) {
    teamFor(db, year, klas).forEach(function (initials) {
      if (seen[initials]) return;
      seen[initials] = true;
      out.push(initials);
    });
  });
  return out;
}

function memberName(db, initials) {
  if (db.team && db.team.members && db.team.members[initials]) {
    return db.team.members[initials].name || initials;
  }
  return initials;
}

function memberList(db) {
  if (!db.team || !db.team.members) return [];
  return Object.keys(db.team.members).sort(function (a, b) {
    return a.localeCompare(b, "nl");
  });
}



/* Het hele teamblok wint of verliest als geheel: het is klein en
   wordt zelden gewijzigd, dus per veld samenvoegen levert alleen
   verwarring op. */
/* Net als bij klaslijsten en rubrics: per stukje samenvoegen, nooit het
   hele team-object in één keer vervangen. Dat laatste leek onschuldig
   omdat het dezelfde "nieuwer wint"-regel volgde als de rest, maar het
   heeft een verraderlijk gevolg: een collega die de tool voor het eerst
   opent heeft een team-object met alleen zichzelf erin, en dat krijgt
   een gloednieuwe tijdstempel — nieuwer dan wat jij weken geleden
   instelde. Bij "nieuwer wint" zou dat je hele teamlijst en klas-
   indeling wegvegen. Hier verdwijnt nooit een lid of een toewijzing
   door samen te voegen; enkel expliciet verwijderen in de tool zelf
   doet dat. */
function mergeTeam(target, incoming) {
  if (!incoming) return false;
  if (!target.team) target.team = emptyTeam();
  if (!target.team.members) target.team.members = {};
  if (!target.team.classes) target.team.classes = {};

  var changed = false;

  Object.keys(incoming.members || {}).forEach(function (initials) {
    var incMember = incoming.members[initials] || {};
    if (!target.team.members[initials]) {
      target.team.members[initials] = { name: incMember.name || "" };
      changed = true;
    } else if (!target.team.members[initials].name && incMember.name) {
      // Een ingevulde naam wordt nooit overschreven; een lege naam mag
      // wel aangevuld worden vanuit een ander bestand.
      target.team.members[initials].name = incMember.name;
      changed = true;
    }
  });

  Object.keys(incoming.classes || {}).forEach(function (key) {
    var incList = incoming.classes[key] || [];
    var curList = target.team.classes[key] || [];
    var merged = curList.slice();
    incList.forEach(function (initials) {
      if (merged.indexOf(initials) === -1) {
        merged.push(initials);
        changed = true;
      }
    });
    if (merged.length) target.team.classes[key] = merged;
  });

  if (changed) {
    target.team.updatedAt = Math.max(target.team.updatedAt || 0, incoming.updatedAt || 0);
  }
  return changed;
}



/* Wie heeft wat gedaan in deze klas? */
function progressByAssessor(rows, students) {
  var byAssessor = {};
  var done = {};

  rows.forEach(function (row) {
    var who = row.assessor || "?";
    (row.students || []).forEach(function (s) {
      if (students.indexOf(s) === -1) return;
      done[s] = true;
      if (!byAssessor[who]) byAssessor[who] = [];
      if (byAssessor[who].indexOf(s) === -1) byAssessor[who].push(s);
    });
  });

  var remaining = students.filter(function (s) { return !done[s]; });
  return {
    byAssessor: byAssessor,
    doneCount: students.length - remaining.length,
    remaining: remaining,
  };
}
