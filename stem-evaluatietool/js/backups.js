/* ------------------------------------------------------------------
   RESERVEKOPIEËN (sinds 1.26.0)

   Een fout van een leerkracht (verkeerde klas gewist, punten
   overschreven, een rubric verwijderd) wordt automatisch opgeslagen en
   bij "Team bijwerken" ook naar collega's gebracht. Daarom bewaart de
   tool op geregelde tijdstippen een volledige kopie van jouw bestand in
   de submap "backups" van de gedeelde map (OneDrive), met de datum en
   het uur in de naam:

     backups/evaluaties-BB-2026-09-29-14u05.json

   Wanneer: bij de eerste opslag van een sessie (dat is bij het
   verbinden met de map, nog voor je iets verandert) en daarna hoogstens
   één keer per uur, telkens na een geslaagde opslag. Is er niets
   veranderd sinds de vorige kopie, dan komt er geen nieuwe bij.

   Iedereen schrijft en leest enkel zijn eigen kopieën (initialen in de
   naam). readTeamFolder() leest enkel bestanden in de hoofdmap, dus de
   kopieën tellen nooit mee bij "Team bijwerken".
   ------------------------------------------------------------------ */

var BACKUP_DIR = "backups";

var BACKUP_INTERVAL_MS = 60 * 60 * 1000;

// Opruimen: alles van de laatste BACKUP_KEEP_DAYS dagen blijft, daarna
// één kopie per week tot BACKUP_MAX_DAYS, en altijd minstens de
// BACKUP_KEEP_MIN nieuwste (ook na een lange vakantie).
var BACKUP_KEEP_DAYS = 14;
var BACKUP_MAX_DAYS = 365;
var BACKUP_KEEP_MIN = 10;

var lastBackupAt = 0;
var lastBackupContent = null;
var backupBusy = null;

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

/* Lokale tijd, zoals de leerkracht ze op de klok ziet. */
function backupFileName(assessor, date) {
  return "evaluaties-" + (cleanAssessor(assessor) || "XX") + "-" +
    date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + "-" +
    pad2(date.getHours()) + "u" + pad2(date.getMinutes()) + ".json";
}

/* Geeft {name, assessor, time} of null als de naam geen reservekopie is.
   Twee kopieën in dezelfde minuut krijgen een volgnummer ("-2"), anders
   zou de tweede de eerste overschrijven (sinds 1.32.0: vóór het
   samenvoegen komt er een kopie van het bestand zoals het op schijf
   stond, en na het schrijven nog een). Het volgnummer telt als seconden,
   zodat de volgorde klopt. */
function parseBackupName(name) {
  var m = /^evaluaties-([A-Za-z0-9]{1,6})-(\d{4})-(\d{2})-(\d{2})-(\d{2})u(\d{2})(?:-(\d{1,2}))?\.json$/.exec(String(name));
  if (!m) return null;
  var d = new Date(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], m[7] ? +m[7] : 0);
  return { name: name, assessor: m[1].toUpperCase(), time: d.getTime() };
}

/* Een naam die nog niet in de lijst staat. */
function uniqueBackupName(list, assessor, date) {
  var base = backupFileName(assessor, date);
  var taken = {};
  list.forEach(function (b) { taken[b.name] = true; });
  if (!taken[base]) return base;
  for (var n = 2; n < 60; n++) {
    var name = base.replace(/\.json$/, "-" + n + ".json");
    if (!taken[name]) return name;
  }
  return base;
}

/* "dinsdag 29 september 2026 om 14u05" */
function backupLabel(time) {
  var d = new Date(time);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    " om " + pad2(d.getHours()) + "u" + pad2(d.getMinutes());
}

/* Welke kopieën mogen weg? Puur, zodat het los te testen is.
   list: [{name, time}], in willekeurige volgorde. */
function backupsToRemove(list, now) {
  var day = 24 * 60 * 60 * 1000;
  var sorted = list.slice().sort(function (a, b) { return b.time - a.time; });
  var weeksSeen = {};
  var remove = [];
  sorted.forEach(function (b, i) {
    var age = now - b.time;
    if (i < BACKUP_KEEP_MIN || age < BACKUP_KEEP_DAYS * day) return;
    if (age > BACKUP_MAX_DAYS * day) { remove.push(b.name); return; }
    // Weken tellen vanaf een maandag (1 januari 1970 was een donderdag).
    var week = Math.floor((b.time / day + 3) / 7);
    if (weeksSeen[week]) remove.push(b.name);
    else weeksSeen[week] = true;
  });
  return remove;
}

/* De inhoud van een kopie, zonder tijdstip, om te vergelijken met de
   vorige. Anders dan dbBlob() gaan localTombstones wel mee: terugzetten
   moet ook "verwijderd voor mezelf" terugbrengen zoals het toen was. De
   kopieën worden nooit ingelezen bij "Team bijwerken". */
function backupData() {
  return {
    format: DB_FORMAT,
    version: DB_VERSION,
    assessor: db.assessor,
    instanceId: instanceId,
    schoolYears: db.schoolYears,
    currentSchoolYear: db.currentSchoolYear,
    activeSchoolYear: db.activeSchoolYear,
    evaluations: db.evaluations,
    evaluationFolders: db.evaluationFolders,
    subjects: db.subjects,
    tombstones: db.tombstones,
    localTombstones: db.localTombstones,
    team: db.team,
    settings: db.settings,
  };
}

function backupComparable(obj) {
  var copy = {};
  Object.keys(obj).forEach(function (k) {
    if (k !== "backupAt" && k !== "exportedAt") copy[k] = obj[k];
  });
  return JSON.stringify(copy);
}

function backupDir(create) {
  return folderHandle.getDirectoryHandle(BACKUP_DIR, { create: !!create });
}

/* Enkel je eigen kopieën, nieuwste eerst. Een ontbrekende map is gewoon
   "nog geen kopieën". Met dirHandle en assessor ook voor een map die nog
   niet gekoppeld is (de opstartwizard, zie js/koppelen.js). */
function listBackups(dirHandle, assessor) {
  var root = dirHandle || folderHandle;
  if (!root) return Promise.resolve([]);
  var me = cleanAssessor(assessor || db.assessor) || "XX";
  return root.getDirectoryHandle(BACKUP_DIR)
    .then(function (dir) {
      return (async function () {
        var out = [];
        for await (var entry of dir.values()) {
          if (entry.kind !== "file") continue;
          var b = parseBackupName(entry.name);
          if (b && b.assessor === me) out.push(b);
        }
        return out.sort(function (a, b) { return b.time - a.time; });
      })();
    })
    .catch(function () { return []; });
}

function readBackupText(name, dirHandle) {
  return (dirHandle || folderHandle).getDirectoryHandle(BACKUP_DIR)
    .then(function (dir) { return dir.getFileHandle(name); })
    .then(function (h) { return h.getFile(); })
    .then(function (f) { return f.text(); });
}

/* Na elke geslaagde opslag (zie writeHandle() in js/storage.js). */
function maybeBackup() {
  if (!folderHandle || backupBusy) return Promise.resolve(null);
  if (lastBackupAt && Date.now() - lastBackupAt < BACKUP_INTERVAL_MS) return Promise.resolve(null);
  return makeBackup();
}

/* Schrijft een kopie van de huidige stand, tenzij die gelijk is aan de
   nieuwste kopie. Geeft de naam van de nieuwste kopie terug (of null als
   er geen map is of het mislukte). Mislukken is nooit een fout voor de
   gebruiker: het gewone opslaan is dan wel gelukt. */
function makeBackup() {
  if (!folderHandle) return Promise.resolve(null);
  if (backupBusy) return backupBusy;
  // Nu vastleggen: de db kan veranderen terwijl de map gelezen wordt.
  var data = JSON.parse(JSON.stringify(backupData()));
  var content = backupComparable(data);

  backupBusy = listBackups()
    .then(function (list) {
      if (lastBackupContent !== null || !list.length) return list;
      // Eerste keer in deze sessie: vergelijk met de nieuwste kopie op schijf.
      return readBackupText(list[0].name)
        .then(function (text) { lastBackupContent = backupComparable(JSON.parse(text)); })
        .catch(function () {})
        .then(function () { return list; });
    })
    .then(function (list) {
      var now = Date.now();
      if (list.length && content === lastBackupContent) {
        lastBackupAt = now;
        return list[0].name;
      }
      var name = uniqueBackupName(list, db.assessor, new Date(now));
      var full = { backupAt: new Date(now).toISOString() };
      Object.keys(data).forEach(function (k) { full[k] = data[k]; });
      return backupDir(true)
        .then(function (dir) {
          return dir.getFileHandle(name, { create: true }).then(function (h) {
            return h.createWritable().then(function (w) {
              return w.write(new Blob([JSON.stringify(full, null, 2)], { type: "application/json" }))
                .then(function () { return w.close(); });
            }).then(function () {
              lastBackupContent = content;
              lastBackupAt = now;
              var all = list.filter(function (b) { return b.name !== name; });
              all.push({ name: name, time: parseBackupName(name).time });
              return Promise.all(backupsToRemove(all, now).map(function (old) {
                return dir.removeEntry(old).catch(function () {});
              }));
            });
          });
        })
        .then(function () { return name; });
    })
    .catch(function () { return null; })
    .then(function (name) {
      backupBusy = null;
      if (currentView === "team") renderBackupList();
      return name;
    });
  return backupBusy;
}

/* Een kopie van je eigen bestand zoals het nu op schijf staat, letterlijk,
   vóór de tool het samenvoegt en overschrijft (sinds 1.32.0, zie
   js/koppelen.js). Zo blijft ook de versie van het andere toestel
   bewaard. Mislukken is geen fout voor de gebruiker: samenvoegen
   verwijdert nooit iets. */
var lastRawBackupAt = 0;

function backupRawText(text, throttle) {
  if (!folderHandle || !text) return Promise.resolve(null);
  var now = Date.now();
  if (throttle && lastRawBackupAt && now - lastRawBackupAt < BACKUP_INTERVAL_MS) return Promise.resolve(null);
  return listBackups()
    .then(function (list) {
      var name = uniqueBackupName(list, db.assessor, new Date(now));
      return backupDir(true).then(function (dir) {
        return dir.getFileHandle(name, { create: true }).then(function (h) {
          return h.createWritable().then(function (w) {
            return w.write(new Blob([text], { type: "application/json" })).then(function () { return w.close(); });
          });
        });
      }).then(function () {
        lastRawBackupAt = now;
        // De volgende gewone kopie mag niet denken dat er niets veranderde.
        lastBackupContent = null;
        lastBackupAt = 0;
        return name;
      });
    })
    .catch(function () { return null; });
}

/* ------------------------------------------------------------------
   TERUGZETTEN

   Het samenvoegen laat de nieuwste versie winnen. Zonder ingreep zou
   "Team bijwerken" de fout dus meteen terugbrengen uit het bestand van
   een collega die ze al had overgenomen. Daarom krijgt alles wat in de
   kopie anders is dan nu (of nu ontbreekt) een nieuw tijdstip: zo wint
   de teruggezette versie, ook bij collega's. Wat sindsdien nieuw
   bijkwam, blijft bij collega's bestaan en komt terug bij "Team
   bijwerken"; dat is bewust: het kan hun eigen werk zijn.
   ------------------------------------------------------------------ */

function refreshRestoredTimes(restored, current, now) {
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // Strikt later dan de huidige versie en dan een verwijdering: bij een
  // gelijk tijdstip wint bij het samenvoegen de versie die er al was.
  function later(cur, kind, key) {
    var t = now;
    if (cur && cur.updatedAt) t = Math.max(t, cur.updatedAt + 1);
    if (kind) {
      [current.tombstones, current.localTombstones].forEach(function (tomb) {
        var v = (tomb && tomb[kind] && tomb[kind][key]) || 0;
        if (v) t = Math.max(t, v + 1);
      });
    }
    return t;
  }

  Object.keys(restored.schoolYears || {}).forEach(function (yr) {
    var bucket = restored.schoolYears[yr];
    var curBucket = (current.schoolYears || {})[yr] || {};

    Object.keys(bucket.roster || {}).forEach(function (year) {
      Object.keys(bucket.roster[year] || {}).forEach(function (klas) {
        var entry = bucket.roster[year][klas];
        var cur = (curBucket.roster || {})[year] && curBucket.roster[year][klas];
        if (!cur || !same(entry.students, cur.students)) entry.updatedAt = later(cur, "roster", yr + "||" + year + "||" + klas);
      });
    });

    var curRows = {};
    Object.keys(curBucket.sessions || {}).forEach(function (key) {
      (curBucket.sessions[key] || []).forEach(function (r) { curRows[r.id] = r; });
    });
    Object.keys(bucket.sessions || {}).forEach(function (key) {
      (bucket.sessions[key] || []).forEach(function (row) {
        if (same(row, curRows[row.id])) return;
        // Oudere rijen zonder createdAt tonen hun datum via updatedAt
        // (Skore-periode): die datum moet blijven kloppen.
        if (!row.createdAt) row.createdAt = row.updatedAt || now;
        row.updatedAt = later(curRows[row.id]);
      });
    });

    Object.keys(bucket.exemptions || {}).forEach(function (key) {
      var cur = (curBucket.exemptions || {})[key];
      if (!same(bucket.exemptions[key], cur)) bucket.exemptions[key].updatedAt = later(cur, "exemptions", yr + "||" + key);
    });
    Object.keys(bucket.skoreDone || {}).forEach(function (key) {
      var rec = bucket.skoreDone[key];
      var cur = (curBucket.skoreDone || {})[key];
      if (rec && typeof rec === "object" && !same(rec, cur)) rec.updatedAt = later(cur);
    });
    if (bucket.periods && !same(bucket.periods, curBucket.periods)) bucket.periods.updatedAt = later(curBucket.periods);
  });

  Object.keys(restored.evaluations || {}).forEach(function (year) {
    Object.keys(restored.evaluations[year] || {}).forEach(function (name) {
      var ev = restored.evaluations[year][name];
      var cur = (current.evaluations || {})[year] && current.evaluations[year][name];
      if (!cur || !same(ev, cur)) ev.updatedAt = later(cur, "evaluations", year + "||" + name);
    });
  });

  Object.keys(restored.evaluationFolders || {}).forEach(function (year) {
    var curNames = ((current.evaluationFolders || {})[year] || []).map(function (f) { return f.name; });
    restored.evaluationFolders[year].forEach(function (f) {
      if (curNames.indexOf(f.name) === -1) f.updatedAt = later(null, "folders", year + "||" + f.name);
    });
  });

  Object.keys(restored.subjects || {}).forEach(function (year) {
    restored.subjects[year].forEach(function (s) {
      var cur = ((current.subjects || {})[year] || []).filter(function (x) { return x.name === s.name; })[0];
      if (!cur || !same(s.classes, cur.classes)) s.updatedAt = later(cur, "subjects", year + "||" + s.name);
    });
  });
}

function restoreBackup(name) {
  var info = parseBackupName(name);
  readBackupText(name)
    .then(function (text) {
      var read = readAnyFile(JSON.parse(text), CONFIG);
      if (!read) throw new Error("geen evaluatiebestand");
      var when = backupLabel(info.time);
      var ok = confirm(
        "Terugzetten naar de versie van " + when + "?\n\n" +
        "Die versie heeft " + countAllRows(read.db) + " evaluatie(s), nu zijn het er " + countAllRows(db) + ".\n\n" +
        "Wat je daarna veranderde, gaat verloren. De tool maakt eerst nog een reservekopie van hoe het nu is. " +
        "Zo kan je dit ook weer ongedaan maken.",
      );
      if (!ok) return;
      return makeBackup().then(function () {
        var restored = read.db;
        refreshRestoredTimes(restored, db, Date.now());
        restored.assessor = db.assessor;
        db = restored;
        persist();
        refreshAll();
        renderBackupList();
        showNotice(
          "good",
          "Vorige versie teruggezet",
          "Je werk staat terug zoals het was op " + when + ". Klik op Team bijwerken om nieuw werk van je collega's weer op te halen.",
        );
      });
    })
    .catch(function () {
      showNotice("warn", "Terugzetten lukte niet", "Deze reservekopie kon niet gelezen worden. Kies een andere, of probeer het opnieuw als OneDrive klaar is met synchroniseren.");
    });
}

/* Alle schooljaren samen: een kopie kan een ander bekeken schooljaar
   hebben dan nu. */
function countAllRows(database) {
  return Object.keys(database.schoolYears || {}).reduce(function (n, yr) {
    var sessions = database.schoolYears[yr].sessions || {};
    return n + Object.keys(sessions).reduce(function (m, k) { return m + sessions[k].length; }, 0);
  }, 0);
}

/* ------------------------------------------------------------------
   TEAMSCHERM: lijst met kopieën
   ------------------------------------------------------------------ */

function renderBackupList() {
  var section = $("backupSection");
  if (!section) return;
  section.classList.toggle("hidden", !folderHandle);
  if (!folderHandle) return;

  $("backupWhere").textContent = folderName + "/" + BACKUP_DIR;
  var host = $("backupList");
  listBackups().then(function (list) {
    host.innerHTML = "";
    if (!list.length) {
      host.appendChild(el("div", "hint", "Nog geen reservekopieën. De eerste komt er vanzelf bij de volgende opslag."));
      return;
    }
    list.forEach(function (b, i) {
      var row = el("div", "backup-row");
      row.appendChild(el("span", "backup-when", backupLabel(b.time)));
      if (i === 0) row.appendChild(el("span", "backup-tag", "nieuwste"));
      var btn = el("button", "btn-ghost btn-small", "Terugzetten");
      btn.type = "button";
      btn.title = b.name;
      btn.addEventListener("click", function () { restoreBackup(b.name); });
      row.appendChild(btn);
      host.appendChild(row);
    });
  });
}

function backupNow() {
  if (!folderHandle) return;
  makeBackup().then(function (name) {
    if (!name) {
      showNotice("warn", "Reservekopie maken lukte niet", "Controleer of de gedeelde map nog bereikbaar is en probeer opnieuw.");
      return;
    }
    showNotice("good", "Reservekopie gemaakt", "Je werk van nu staat veilig in " + folderName + "/" + BACKUP_DIR + ".");
  });
}
