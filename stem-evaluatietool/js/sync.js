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
  renderSyncState();
  renderBackupList();
  renderMembers();
  renderTeamClasses();
  showView("team");
}



/* Je eigen initialen horen er altijd bij te staan. */
function ensureSelfInTeam() {
  var me = cleanAssessor(db.assessor);
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
  var me = cleanAssessor(db.assessor);
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
    // Met een eigen tijdstip, zodat een nieuwe naam ook bij collega's
    // doorkomt (zie mergeTeam hieronder).
    name.addEventListener("change", function () {
      db.team.members[initials].updatedAt = Date.now();
      if (initials === me) renderAssessor();
      touchTeam();
    });
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



/* --- het werk van iedereen ophalen --- */

/* Sinds 1.33.0 gebeurt dit ook vanzelf (autoSyncTeam() hieronder): bij
   het opstarten, bij terugkeren naar het venster en om de tien minuten.
   quiet: geen melding als er niets nieuws is. "auto": nooit een melding
   (een melding schuift het scherm, en dat mag niet midden in het werk).
   Geeft altijd een Promise. */
var lastSyncAt = 0;
var syncBusy = null;

function syncTeam(quiet) {
  if (!folderHandle) {
    if (quiet !== "auto") showNotice("info", "Nog geen gedeelde map", "Koppel eerst de gedeelde map bij Instellingen, Gebruiker.");
    return Promise.resolve(false);
  }
  if (syncBusy) return syncBusy;
  var auto = quiet === "auto";
  var btn = $("btnSyncTeam");
  btn.disabled = true;
  btn.textContent = "Bezig…";

  function done() {
    btn.disabled = false;
    btn.textContent = "Nu bijwerken";
    syncBusy = null;
    renderSyncState();
  }

  // Eerst je eigen bestand: een ander toestel kan het intussen aangevuld
  // hebben (sinds 1.32.0, zie js/koppelen.js).
  syncBusy = pullOwnFile()
    .then(function () { return readTeamFolder(folderHandle, teamFileName(db.assessor), CONFIG); })
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

      // Alleen opslaan en hertekenen wanneer er echt iets veranderd is.
      // Anders zou de status onterecht op "Niet opgeslagen" springen, en
      // zou een halve beoordeling op het scherm gewist worden.
      var changed = totals.added || totals.updated || classes.length || evaluations.length || teamChanged;
      if (changed) {
        persist();
        refreshAll();
      }
      lastSyncAt = Date.now();
      done();
      if (auto) return true;

      if (!result.files.length) {
        if (!quiet) {
          showNotice(
            "info",
            "Nog geen bestanden van collega's",
            "In " + folderName + " staat alleen jouw bestand. Laat je collega's de tool aan dezelfde map koppelen.",
          );
        }
        return true;
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
        return true;
      }

      showNotice(
        "good",
        "Bijgewerkt met " + result.files.length + " bestand(en)",
        bits.join(" · ") + "." +
          (perColleague.length ? " Van " + perColleague.join(", ") + "." : "") +
          (result.problems.length ? " Niet gelukt: " + result.problems.join(", ") + "." : ""),
      );
      return true;
    })
    .catch(function (err) {
      done();
      if (auto) return false;
      showNotice(
        "warn",
        "Map kon niet gelezen worden",
        (err && err.message ? err.message + ". " : "") + "Controleer of OneDrive werkt, of stel de koppeling opnieuw in bij Instellingen, Gebruiker.",
      );
      return false;
    });
  return syncBusy;
}

/* Is de leerkracht iets aan het invullen? Dan niet samenvoegen: dat
   tekent het scherm opnieuw en zou de halve beoordeling wissen. De
   volgende keer lukt het wel. */
function busyEditing() {
  if (typeof draft !== "undefined" && draft) return true;
  if (form && (form.editId || Object.keys(form.scores || {}).length)) return true;
  return !!document.querySelector(".student-cb:checked");
}

var AUTO_SYNC_EVERY_MS = 10 * 60 * 1000;
var AUTO_SYNC_ON_FOCUS_MS = 5 * 60 * 1000;

function autoSyncTeam(minGap) {
  if (!folderHandle || ownFileProblem || syncBusy || busyEditing()) return Promise.resolve(false);
  if (minGap && lastSyncAt && Date.now() - lastSyncAt < minGap) return Promise.resolve(false);
  return syncTeam("auto");
}

function initAutoSync() {
  setInterval(function () { autoSyncTeam(AUTO_SYNC_EVERY_MS - 30000); }, AUTO_SYNC_EVERY_MS);
  function onFocus() {
    if (document.visibilityState === "hidden") return;
    autoSyncTeam(AUTO_SYNC_ON_FOCUS_MS);
  }
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onFocus);
}

/* Teamscherm: wanneer werd het laatst bijgewerkt? */
function renderSyncState() {
  var host = $("syncState");
  if (!host) return;
  $("syncSection").classList.toggle("hidden", !folderHandle);
  $("syncOff").classList.toggle("hidden", !!folderHandle || (typeof FOLDER_SUPPORTED !== "undefined" && FOLDER_SUPPORTED));
  if (!lastSyncAt) {
    host.textContent = "Nog niet bijgewerkt in deze sessie.";
    return;
  }
  var d = new Date(lastSyncAt);
  host.textContent = "Laatst bijgewerkt om " + pad2(d.getHours()) + "u" + pad2(d.getMinutes()) + ".";
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

/* renamed (sinds 1.32.0): { "BB": { to: "BX", at } } als iemand zijn
   initialen wijzigde. Zonder dit zou Team bijwerken de oude initialen
   terugbrengen uit de bestanden van collega's, want samenvoegen
   verwijdert nooit een lid. Zie renameMyInitials() in js/koppelen.js. */
function emptyTeam() {
  return { members: {}, classes: {}, renamed: {}, updatedAt: 0 };
}

/* Voert de gewijzigde initialen door in het team: het lid en de
   klastoewijzingen verhuizen naar de nieuwe initialen. In volgorde van
   tijdstip, zodat ook een reeks (BB naar BX, later BX naar BY) klopt.
   Geeft true als er iets veranderde. */
function applyTeamRenames(team) {
  var renamed = team.renamed || {};
  var changed = false;
  Object.keys(renamed)
    .sort(function (a, b) { return (renamed[a].at || 0) - (renamed[b].at || 0); })
    .forEach(function (from) {
      var to = renamed[from].to;
      if (!to || to === from) return;
      if (team.members[from]) {
        var old = team.members[from];
        var cur = team.members[to];
        if (!cur) team.members[to] = old;
        else if (old.name && (old.updatedAt || 0) > (cur.updatedAt || 0)) team.members[to] = old;
        else if (!cur.name && old.name) cur.name = old.name;
        delete team.members[from];
        changed = true;
      }
      Object.keys(team.classes).forEach(function (key) {
        var list = team.classes[key];
        if (list.indexOf(from) === -1) return;
        var next = [];
        list.forEach(function (i) {
          var v = i === from ? to : i;
          if (next.indexOf(v) === -1) next.push(v);
        });
        team.classes[key] = next;
        changed = true;
      });
    });
  return changed;
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
  if (!target.team.renamed) target.team.renamed = {};

  var changed = false;

  Object.keys(incoming.renamed || {}).forEach(function (from) {
    var inc = incoming.renamed[from];
    var cur = target.team.renamed[from];
    if (inc && inc.to && (!cur || (inc.at || 0) > (cur.at || 0))) {
      target.team.renamed[from] = { to: inc.to, at: inc.at || 0 };
      changed = true;
    }
  });

  Object.keys(incoming.members || {}).forEach(function (initials) {
    var incMember = incoming.members[initials] || {};
    var cur = target.team.members[initials];
    if (!cur) {
      target.team.members[initials] = { name: incMember.name || "", updatedAt: incMember.updatedAt || 0 };
      changed = true;
    } else if (incMember.name && (incMember.updatedAt || 0) > (cur.updatedAt || 0)) {
      // Sinds 1.32.0: een naam die iemand bewust wijzigde (Instellingen,
      // Gebruiker, of het Teamscherm) heeft een eigen tijdstip en wint
      // dan van een oudere naam.
      if (cur.name !== incMember.name) changed = true;
      cur.name = incMember.name;
      cur.updatedAt = incMember.updatedAt;
    } else if (!cur.name && incMember.name) {
      // Een ingevulde naam wordt nooit overschreven door een naam zonder
      // tijdstip; een lege naam mag wel aangevuld worden.
      cur.name = incMember.name;
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

  if (applyTeamRenames(target.team)) changed = true;

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
