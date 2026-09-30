/* ---- overgenomen uit ui.js ---- */

/* ------------------------------------------------------------------
   UI — alles wat het scherm aanraakt.
   ------------------------------------------------------------------ */

var STORAGE_KEY = "STEM_EVAL_DB_V3";
// Reservekopie van browseropslag die niet meer te lezen was. Bewust een
// aparte sleutel: persist() overschrijft STORAGE_KEY bij de eerstvolgende
// wijziging, en dan zou de oude inhoud anders voorgoed weg zijn.
var STORAGE_RESCUE_KEY = "STEM_EVAL_DB_V3_BESCHADIGD";

var INSTANCE_KEY = "STEM_EVAL_INSTANCE";

var ASSESSOR_KEY = "STEM_EVAL_ASSESSOR";

var db = emptyDb();

var instanceId = "";

/* cur.klas blijft de samengestelde sessiesleutel (bv. "1WA+1WB" bij een
   combinatie van klassen); cur.klassen is de bijhorende array van de
   werkelijke, echte klasnamen — nodig voor klaslijsten, team-koppeling
   en de klas-per-leerling die in elke opgeslagen rij zit. */
var cur = { year: "", klas: "", klassen: [], evaluation: "", rubrics: [], questions: [], key: "", studentKlasMap: {} }

var form = { editId: null, scores: {}, corrections: {} }

var freshStart = false;

// Werd er in deze sessie al iets bewaard? Zie browserHasWork() in
// js/koppelen.js.
var persistedThisSession = false;

function loadFromStorage() {
  var raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  freshStart = !raw;

  if (raw) {
    try {
      db = normaliseDb(JSON.parse(raw));
    } catch (e) {
      db = emptyDb();
      try { localStorage.setItem(STORAGE_RESCUE_KEY, raw); } catch (e2) {}
    }
  } else {
    // Eerste start op dit toestel: kijk of er nog data van de vorige versie staat.
    try {
      var mig = migrateLegacyStorage(CONFIG, localStorage);
      if (mig.found > 0) {
        db = mig.db;
        markDirty();
        showNotice(
          "good",
          mig.found + " evaluatie(s) overgezet uit de vorige versie",
          "De scores stonden nog op volgnummer opgeslagen en zijn omgezet naar vaste criteria. Controleer een paar rijen en sla daarna op als bestand.",
        );
      }
    } catch (e) {}
  }

  try {
    var saved = localStorage.getItem(ASSESSOR_KEY);
    if (saved) db.assessor = cleanAssessor(saved);
  } catch (e) {}

  // Eerste start: neem de klaslijsten uit de tool over als vertrekpunt.
  // Daarna leven ze in het werkbestand en kan je ze plakken uit Excel.
  if (!db.roster || !Object.keys(db.roster).length) {
    db.roster = seedRoster(CONFIG, STUDENTS);
  }
  if (!db.evaluations || !Object.keys(db.evaluations).length) {
    db.evaluations = seedEvaluations(CONFIG);
  }
  if (!db.team) db.team = emptyTeam();
  if (!db.settings) db.settings = emptySettings();

  try {
    instanceId = localStorage.getItem(INSTANCE_KEY) || "";
  } catch (e) {}
  if (!instanceId) {
    instanceId = Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
    try { localStorage.setItem(INSTANCE_KEY, instanceId); } catch (e) {}
  }
}

function persist() {
  persistedThisSession = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    showNotice(
      "warn",
      "Kon niet bewaren in de browser",
      "Sla je werk op als bestand voor je verdergaat.",
    );
  }
  markDirty();
  scheduleAutoSave();
}



/* ------------------------------------------------------------------ */
/* Bestandsstatus                                                      */
/* ------------------------------------------------------------------ */

/* changeCount telt elke wijziging. Een schrijfactie onthoudt bij de start
   tot welke wijziging ze bewaart; enkel als er intussen niets bijkwam,
   mag de status op "opgeslagen" (zie writeHandle() in js/storage.js). */
var changeCount = 0;

function markDirty() { dirty = true; changeCount++; updateStatus(); }

function markClean() { dirty = false; updateStatus(); }

function rows() { return db.sessions[cur.key] || []; }

/* ---- overgenomen uit core.js ---- */

/* ------------------------------------------------------------------
   CORE — pure logica, geen DOM. Alles hier is los te testen.
   ------------------------------------------------------------------ */

/* Versie van de tool zelf (semantisch: MAJOR.MINOR.PATCH). Niet te
   verwarren met DB_VERSION hieronder — dat is het versienummer van het
   opslagformaat van een werkbestand, voor migraties. Deze verandert bij
   elke release; DB_VERSION enkel als de opbouw van een werkbestand zelf
   wijzigt. Zie CHANGELOG.md voor wat er per versie veranderd is. */
var APP_VERSION = "1.36.0";

var DB_VERSION = 4;

var DB_FORMAT = "stem-eval";

/* Een schooljaar loopt van september tot en met augustus; in augustus
   reken je jezelf al bij het jaar dat net begint. */
function defaultSchoolYearLabel() {
  var now = new Date();
  var startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return startYear + "-" + (startYear + 1);
}

function suggestNextSchoolYearLabel(currentLabel) {
  var m = /^(\d{4})-(\d{4})$/.exec(currentLabel || "");
  if (m) {
    var start = parseInt(m[1], 10) + 1;
    return start + "-" + (start + 1);
  }
  return defaultSchoolYearLabel();
}

/* db.roster en db.sessions bestaan niet meer als eigen data — het zijn
   doorverwijzingen naar db.schoolYears[db.currentSchoolYear]. Alle
   bestaande code die db.roster/db.sessions leest of schrijft blijft zo
   ongewijzigd werken, ook al ligt de data nu een laag dieper (per
   schooljaar). Bewust niet-opsombaar (enumerable: false), zodat
   JSON.stringify(db) ze niet dubbel opslaat naast db.schoolYears. */
function installYearAccessors(dbObj) {
  Object.defineProperty(dbObj, "roster", {
    configurable: true,
    enumerable: false,
    get: function () {
      var bucket = dbObj.schoolYears[dbObj.currentSchoolYear];
      return bucket ? bucket.roster : {};
    },
    set: function (v) {
      if (!dbObj.schoolYears[dbObj.currentSchoolYear]) {
        dbObj.schoolYears[dbObj.currentSchoolYear] = { roster: {}, sessions: {}, createdAt: Date.now() };
      }
      dbObj.schoolYears[dbObj.currentSchoolYear].roster = v;
    },
  });
  Object.defineProperty(dbObj, "sessions", {
    configurable: true,
    enumerable: false,
    get: function () {
      var bucket = dbObj.schoolYears[dbObj.currentSchoolYear];
      return bucket ? bucket.sessions : {};
    },
    set: function (v) {
      if (!dbObj.schoolYears[dbObj.currentSchoolYear]) {
        dbObj.schoolYears[dbObj.currentSchoolYear] = { roster: {}, sessions: {}, createdAt: Date.now() };
      }
      dbObj.schoolYears[dbObj.currentSchoolYear].sessions = v;
    },
  });
}

function emptyDb() {
  var yearLabel = defaultSchoolYearLabel();
  var out = {
    format: DB_FORMAT,
    version: DB_VERSION,
    assessor: "",
    schoolYears: {},
    currentSchoolYear: yearLabel,
    activeSchoolYear: yearLabel,
    evaluations: {},
    evaluationFolders: {},
    subjects: {},
    tombstones: emptyTombstones(),
    localTombstones: emptyTombstones(),
    team: { members: {}, classes: {}, renamed: {}, updatedAt: 0 },
    settings: { thresholds: null, updatedAt: 0 },
  };
  out.schoolYears[yearLabel] = { roster: {}, sessions: {}, createdAt: Date.now() };
  installYearAccessors(out);
  return out;
}

/* "Verwijderen voor iedereen" versus "verwijderen voor mezelf": de app
   moet onthouden WANNEER iets verwijderd werd, anders brengt een latere
   samenvoeging met een collega die het item nog heeft, het gewoon
   terug — precies het probleem dat dit oplost.

   tombstones (gedeeld): reist mee bij synchroniseren, dus verdwijnt het
   item ook bij collega's zodra zij samenvoegen.
   localTombstones (enkel bij mezelf): wordt nooit meegestuurd, maar
   telt intern wél mee — zo blijft "voor mezelf" verwijderd ook al heeft
   een collega het item nog. */
/* "exemptions" (sinds 1.22.0): een opgeheven vrijstelling, zie
   js/controle.js. Oudere bestanden hebben die soort niet; dat is gewoon
   "nog nooit iets opgeheven". */
/* "subjects" (sinds 1.28.0): een verwijderd vak, zie js/subjects.js. */
var TOMBSTONE_KINDS = ["roster", "evaluations", "folders", "exemptions", "subjects"];

function emptyTombstones() {
  return { roster: {}, evaluations: {}, folders: {}, exemptions: {}, subjects: {} };
}

/* Later moment van beide lagen samen — het maakt voor de vraag "moet
   dit terugkomen?" niet uit of de verwijdering gedeeld was of lokaal. */
function tombstoneTime(kind, key) {
  var shared = (db.tombstones && db.tombstones[kind] && db.tombstones[kind][key]) || 0;
  var local = (db.localTombstones && db.localTombstones[kind] && db.localTombstones[kind][key]) || 0;
  return Math.max(shared, local);
}

/* Cruciaal onderscheid: 0 betekent "geen tombstone", niet "een
   tombstone op tijdstip 0". Een item dat nog nooit bewerkt is (bv. een
   ongewijzigde standaardklas bij een verse installatie) heeft zelf ook
   updatedAt: 0 — zonder deze bewuste >0-controle zou zo'n item
   onterecht als "verwijderd" behandeld worden, ook al bestaat er geen
   enkele echte tombstone. Gebruik deze functie overal, nooit
   tombstoneTime() rechtstreeks vergelijken. */
function isTombstoned(kind, key, itemUpdatedAt) {
  var t = tombstoneTime(kind, key);
  return t > 0 && (itemUpdatedAt || 0) <= t;
}

function recordDeletion(kind, key, scope) {
  var now = Date.now();
  if (scope === "iedereen") {
    if (!db.tombstones) db.tombstones = emptyTombstones();
    db.tombstones[kind][key] = now;
  } else {
    if (!db.localTombstones) db.localTombstones = emptyTombstones();
    db.localTombstones[kind][key] = now;
  }
}

/* Een nieuw schooljaar: klaslijsten beginnen helemaal leeg, maar rubrics
   en team blijven gewoon bestaan — dat zijn geen leerlinggegevens, dat
   is de vaste basis waarmee je elk jaar opnieuw werkt. Wordt meteen het
   actieve (bewerkbare) schooljaar. */
function addSchoolYear(dbObj, label) {
  var clean = String(label || "").trim();
  if (!clean) return false;
  if (dbObj.schoolYears[clean]) return false;
  dbObj.schoolYears[clean] = { roster: {}, sessions: {}, createdAt: Date.now() };
  dbObj.activeSchoolYear = clean;
  dbObj.currentSchoolYear = clean;
  return true;
}

/* Enkel het bekijken wisselen — niet het jaar waar nieuwe evaluaties
   naartoe geschreven worden. Enkel activeSchoolYear bepaalt dat. */
function switchViewedSchoolYear(dbObj, label) {
  if (!dbObj.schoolYears[label]) return false;
  dbObj.currentSchoolYear = label;
  return true;
}

function schoolYearLabels(dbObj) {
  return Object.keys(dbObj.schoolYears).sort();
}

function isArchivedSchoolYear(dbObj) {
  return dbObj.currentSchoolYear !== dbObj.activeSchoolYear;
}

function sessionKey(year, klas, evaluation) {
  return [year, klas, evaluation].join("||");
}

function parseSessionKey(key) {
  var p = key.split("||");
  return { year: p[0], klas: p[1], evaluation: p[2] };
}



/* Initialen opschonen: max 6 tekens, letters/cijfers, hoofdletters. */
function cleanAssessor(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}



/* Id dat gegarandeerd uniek is over verschillende laptops heen.
   Een botsing zou bij het samenvoegen stilzwijgend een rij overschrijven,
   dus hier geen toeval alleen: de teller sluit botsingen binnen één sessie
   volledig uit, het tijdstip doet dat over sessies heen. */
var _idCounter = 0;

function makeRowId(assessor) {
  var a = cleanAssessor(assessor) || "XX";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return a + "-" + crypto.randomUUID();
  }
  _idCounter++;
  return (
    a +
    "-" +
    Date.now().toString(36) +
    "-" +
    _idCounter.toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}



/* Maximumscore uit de werkelijke opties, niet uit een hardgecodeerde 5. */
function maxScoreOf(rubrics) {
  return rubrics.reduce(function (sum, r) {
    var best = r.options.reduce(function (m, o) {
      return Math.max(m, o.score);
    }, 0);
    return sum + best;
  }, 0);
}

function rowTotal(row, rubrics) {
  return rubrics.reduce(function (sum, r) {
    var s = row.scores[r.id];
    return sum + (typeof s === "number" ? s : 0);
  }, 0);
}

function rowIsComplete(row, rubrics) {
  return rubrics.every(function (r) {
    return typeof row.scores[r.id] === "number";
  });
}



/* Een onvolledige tussentijdse check is verwacht en geen probleem — dat
   is net het punt van een snelle formatieve controle. Bij een gewone
   evaluatie wijst onvolledigheid wél op iets dat nog afgewerkt moet
   worden. */
function rowNeedsAttention(row, rubrics) {
  return !row.formative && !rowIsComplete(row, rubrics);
}



/* ------------------------------------------------------------------
   SAMENVOEGEN
   Twee leerkrachten, twee bestanden, geen gedeelde schrijfactie.
   Rijen worden op id gematcht; bij gelijke id wint de recentste.
   ------------------------------------------------------------------ */

/* Voegt de sessies van één sleutel-emmer samen (bv. binnen één
   schooljaar). Losstaand van mergeDb zodat dezelfde logica per
   schooljaar herbruikt kan worden. */
function mergeSessionsInto(targetSessions, incomingSessions) {
  var result = { added: 0, updated: 0, skipped: 0, sessions: [] };
  if (!incomingSessions) return result;

  Object.keys(incomingSessions).forEach(function (key) {
    var incomingRows = incomingSessions[key] || [];
    if (!incomingRows.length) return;

    if (!targetSessions[key]) targetSessions[key] = [];
    var rows = targetSessions[key];

    var index = {};
    rows.forEach(function (r, i) {
      index[r.id] = i;
    });

    var touched = { added: 0, updated: 0, skipped: 0 };

    incomingRows.forEach(function (row) {
      if (!row || !row.id) return;
      if (!(row.id in index)) {
        rows.push(row);
        index[row.id] = rows.length - 1;
        touched.added++;
      } else {
        var existing = rows[index[row.id]];
        if ((row.updatedAt || 0) > (existing.updatedAt || 0)) {
          rows[index[row.id]] = row;
          touched.updated++;
        } else {
          touched.skipped++;
        }
      }
    });

    result.added += touched.added;
    result.updated += touched.updated;
    result.skipped += touched.skipped;
    if (touched.added || touched.updated) {
      result.sessions.push({ key: key, added: touched.added, updated: touched.updated });
    }
  });

  return result;
}

/* Schooljaren worden nooit verwijderd bij het samenvoegen, enkel
   toegevoegd — net als teamleden en klastoewijzingen. Elk jaar wordt
   apart samengevoegd met exact dezelfde regels als voorheen (nieuwere
   klaslijst wint, rijen matchen op id). */
/* Tombstones eerst en in één keer samenvoegen, vóór alle andere
   merges — anders zou bv. mergeRoster (die per schooljaar in een lus
   draait) een deel van de binnenkomende verwijderinformatie mislopen.
   Enkel db.tombstones (gedeeld) reist mee; localTombstones nooit. */
function mergeTombstonesInto(target, incomingTombstones) {
  if (!incomingTombstones) return;
  if (!target.tombstones) target.tombstones = emptyTombstones();
  TOMBSTONE_KINDS.forEach(function (kind) {
    if (!target.tombstones[kind]) target.tombstones[kind] = {};
    Object.keys(incomingTombstones[kind] || {}).forEach(function (key) {
      var t = Number(incomingTombstones[kind][key]) || 0;
      if (t > (target.tombstones[kind][key] || 0)) target.tombstones[kind][key] = t;
    });
  });
}

function mergeDb(target, incoming) {
  var stats = {
    added: 0, updated: 0, skipped: 0, sessions: [], classes: [],
    evaluations: [], team: false, settings: false, schoolYears: [],
  };
  if (!incoming) return stats;

  mergeTombstonesInto(target, incoming.tombstones);

  stats.evaluations = mergeEvaluations(target, incoming.evaluations);
  stats.evaluationFolders = mergeEvaluationFolders(target, incoming.evaluationFolders);
  stats.subjects = mergeSubjects(target, incoming.subjects);
  stats.team = mergeTeam(target, incoming.team);
  stats.settings = mergeSettings(target, incoming.settings);

  if (!target.schoolYears) target.schoolYears = {};
  var incomingYears = incoming.schoolYears || {};
  Object.keys(incomingYears).forEach(function (yr) {
    var incBucket = incomingYears[yr] || {};
    if (!target.schoolYears[yr]) {
      target.schoolYears[yr] = { roster: {}, sessions: {}, createdAt: incBucket.createdAt || Date.now() };
      stats.schoolYears.push(yr + " (nieuw)");
    }
    var bucket = target.schoolYears[yr];

    var classesChanged = mergeRoster(bucket.roster, incBucket.roster, yr);
    stats.classes = stats.classes.concat(
      classesChanged.map(function (c) { return c + " [" + yr + "]"; }),
    );

    mergePeriods(bucket, incBucket.periods);
    mergeSkoreDone(bucket, incBucket.skoreDone);
    mergeExemptions(bucket, incBucket.exemptions);

    var sessResult = mergeSessionsInto(bucket.sessions, incBucket.sessions);
    stats.added += sessResult.added;
    stats.updated += sessResult.updated;
    stats.skipped += sessResult.skipped;
    stats.sessions = stats.sessions.concat(sessResult.sessions);
  });

  return stats;
}



/* Dubbels: dezelfde leerling in meer dan één rij binnen dezelfde sessie.
   Wordt getoond, nooit stilzwijgend opgelost. */
function findDuplicates(rows) {
  var byStudent = {};
  rows.forEach(function (row) {
    (row.students || []).forEach(function (s) {
      if (!byStudent[s]) byStudent[s] = [];
      byStudent[s].push(row.id);
    });
  });

  var conflictRowIds = {};
  var students = [];
  Object.keys(byStudent).forEach(function (s) {
    if (byStudent[s].length > 1) {
      students.push({ student: s, rowIds: byStudent[s] });
      byStudent[s].forEach(function (id) {
        conflictRowIds[id] = true;
      });
    }
  });

  return { students: students, rowIds: conflictRowIds };
}



/* ------------------------------------------------------------------
   OUDE BESTANDEN INLEZEN
   V2 exporteerde {year, className, evaluation, data:{rows:[{names, scores:{0:4}}]}}
   Scores stonden op array-index. Die worden hier omgezet naar vaste
   rubric-sleutels, op basis van de volgorde in CONFIG.
   ------------------------------------------------------------------ */

function convertLegacyExport(obj, config) {
  if (!obj || !obj.year || !obj.className || !obj.evaluation || !obj.data) {
    return null;
  }
  var year = config[obj.year];
  if (!year) return null;
  var rubrics = year.evaluations[obj.evaluation];
  if (!rubrics) return null;

  var db = emptyDb();
  var key = sessionKey(obj.year, obj.className, obj.evaluation);
  db.sessions[key] = (obj.data.rows || []).map(function (row) {
    var scores = {};
    rubrics.forEach(function (r, i) {
      var v = row.scores ? row.scores[i] : undefined;
      if (v === undefined) v = row.scores ? row.scores[String(i)] : undefined;
      if (typeof v === "number") scores[r.id] = v;
    });
    return {
      id: "V2-" + (row.id || Date.now()) + "-" + Math.random().toString(36).slice(2, 6),
      assessor: "V2",
      students: splitLegacyNames(row.names),
      scores: scores,
      feedback: row.feedback || "",
      updatedAt: typeof row.id === "number" ? row.id : Date.now(),
    };
  });
  return db;
}

/* De klas per leerling van een rij (sinds 1.14.0). Tot 1.34.2 ging dit
   veld bij het inlezen van het bestand verloren, zodat beoordelingen in
   een combinatie van klassen na het heropenen niet meer als "al
   beoordeeld" herkend werden. Geeft undefined als er niets bruikbaars is:
   dan valt klasOfStudentInRow() terug op de sessie en de klaslijst. */
function cleanStudentKlas(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  var out = {};
  var any = false;
  Object.keys(raw).forEach(function (name) {
    if (typeof raw[name] === "string" && raw[name]) {
      out[name] = raw[name];
      any = true;
    }
  });
  return any ? out : undefined;
}

function splitLegacyNames(names) {
  if (Array.isArray(names)) return names;
  return String(names || "")
    .split("&")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}



/* Herkent zowel het nieuwe werkbestand als een oude V2-export. */
function readAnyFile(parsed, config) {
  if (parsed && parsed.format === DB_FORMAT && (parsed.schoolYears || parsed.sessions)) {
    return { db: normaliseDb(parsed), legacy: false };
  }
  var converted = convertLegacyExport(parsed, config);
  if (converted) return { db: converted, legacy: true };
  return null;
}

function normaliseDb(db) {
  var out = emptyDb();
  out.assessor = cleanAssessor(db.assessor);

  /* Schooljaren: nieuwe bestanden hebben db.schoolYears al. Een ouder
     bestand (van vóór schooljaren bestonden) heeft alles plat in
     db.roster/db.sessions — dat wordt hier één enkel schooljaar. */
  var sourceYears;
  if (db.schoolYears && Object.keys(db.schoolYears).length) {
    sourceYears = db.schoolYears;
  } else {
    var label = (typeof db.currentSchoolYear === "string" && db.currentSchoolYear) || defaultSchoolYearLabel();
    sourceYears = {};
    sourceYears[label] = { roster: db.roster || {}, sessions: db.sessions || {}, createdAt: 0 };
  }

  out.schoolYears = {};
  Object.keys(sourceYears).forEach(function (yearLabel) {
    var src = sourceYears[yearLabel] || {};
    var bucket = { roster: {}, sessions: {}, createdAt: src.createdAt || 0 };

    Object.keys(src.roster || {}).forEach(function (year) {
      bucket.roster[year] = {};
      Object.keys(src.roster[year] || {}).forEach(function (klas) {
        var entry = src.roster[year][klas] || {};
        bucket.roster[year][klas] = {
          students: Array.isArray(entry.students) ? entry.students.slice() : [],
          updatedAt: entry.updatedAt || 0,
        };
      });
    });

    Object.keys(src.sessions || {}).forEach(function (key) {
      bucket.sessions[key] = (src.sessions[key] || []).map(function (r) {
        var corrections = {};
        if (r.corrections && typeof r.corrections === "object") {
          Object.keys(r.corrections).forEach(function (name) {
            var v = Number(r.corrections[name]);
            if (v) corrections[name] = v; // 0 is gelijk aan geen correctie, niet apart bewaren
          });
        }
        return {
          id: r.id,
          assessor: cleanAssessor(r.assessor),
          students: splitLegacyNames(r.students || r.names),
          scores: r.scores || {},
          answers: r.answers || {},
          rubricVersion: r.rubricVersion || null,
          formative: !!r.formative,
          feedback: r.feedback || "",
          feedforward: r.feedforward || "",
          corrections: corrections,
          studentKlas: cleanStudentKlas(r.studentKlas),
          createdAt: r.createdAt || 0,
          updatedAt: r.updatedAt || 0,
        };
      });
    });

    if (src.periods && Array.isArray(src.periods.list) && src.periods.list.length) {
      bucket.periods = JSON.parse(JSON.stringify(src.periods));
    }
    if (src.skoreDone && typeof src.skoreDone === "object") {
      bucket.skoreDone = JSON.parse(JSON.stringify(src.skoreDone));
    }
    if (src.exemptions && typeof src.exemptions === "object") {
      bucket.exemptions = JSON.parse(JSON.stringify(src.exemptions));
    }
    out.schoolYears[yearLabel] = bucket;
  });

  var yearLabels = Object.keys(out.schoolYears);
  if (!yearLabels.length) {
    var fallback = defaultSchoolYearLabel();
    out.schoolYears[fallback] = { roster: {}, sessions: {}, createdAt: Date.now() };
    yearLabels = [fallback];
  }
  yearLabels.sort();
  out.activeSchoolYear = (db.activeSchoolYear && out.schoolYears[db.activeSchoolYear])
    ? db.activeSchoolYear
    : yearLabels[yearLabels.length - 1];
  out.currentSchoolYear = (db.currentSchoolYear && out.schoolYears[db.currentSchoolYear])
    ? db.currentSchoolYear
    : out.activeSchoolYear;

  /* De rest is niet aan een schooljaar gebonden — rubrics, team en de
     drempels voor leerplandoelen gelden voor de hele vakgroep, elk jaar
     opnieuw. */
  if (db.settings) {
    out.settings = {
      thresholds: db.settings.thresholds ? JSON.parse(JSON.stringify(db.settings.thresholds)) : null,
      updatedAt: db.settings.updatedAt || 0,
    };
  }
  if (db.team) {
    out.team = {
      members: JSON.parse(JSON.stringify(db.team.members || {})),
      classes: JSON.parse(JSON.stringify(db.team.classes || {})),
      renamed: JSON.parse(JSON.stringify(db.team.renamed || {})),
      updatedAt: db.team.updatedAt || 0,
    };
  }
  Object.keys(db.evaluations || {}).forEach(function (year) {
    out.evaluations[year] = {};
    Object.keys(db.evaluations[year] || {}).forEach(function (name) {
      var ev = db.evaluations[year][name] || {};
      out.evaluations[year][name] = {
        rubrics: Array.isArray(ev.rubrics) ? JSON.parse(JSON.stringify(ev.rubrics)) : [],
        questions: Array.isArray(ev.questions) ? JSON.parse(JSON.stringify(ev.questions)) : [],
        version: ev.version || 1,
        history: ev.history ? JSON.parse(JSON.stringify(ev.history)) : {},
        folder: typeof ev.folder === "string" ? ev.folder : "",
        subject: typeof ev.subject === "string" ? ev.subject : "",
        updatedAt: ev.updatedAt || 0,
      };
    });
  });
  migrateGoalLinks(out);

  out.evaluationFolders = {};
  Object.keys(db.evaluationFolders || {}).forEach(function (year) {
    var list = db.evaluationFolders[year];
    if (!Array.isArray(list)) return;
    var seen = {};
    out.evaluationFolders[year] = [];
    list.forEach(function (f) {
      // Oudere bestanden (voor 1.9.1) sloegen mappen op als platte tekst.
      var name = typeof f === "string" ? f.trim() : String((f && f.name) || "").trim();
      var updatedAt = (f && typeof f === "object" && f.updatedAt) || 0;
      if (!name || seen[name]) return;
      seen[name] = true;
      out.evaluationFolders[year].push({ name: name, updatedAt: updatedAt });
    });
  });

  out.subjects = normaliseSubjects(db.subjects);

  function copyTombstones(src) {
    var t = emptyTombstones();
    TOMBSTONE_KINDS.forEach(function (kind) {
      Object.keys((src && src[kind]) || {}).forEach(function (key) {
        var v = Number(src[kind][key]);
        if (v) t[kind][key] = v;
      });
    });
    return t;
  }
  out.tombstones = copyTombstones(db.tombstones);
  out.localTombstones = copyTombstones(db.localTombstones);

  installYearAccessors(out);
  return out;
}



/* ------------------------------------------------------------------
   MIGRATIE van de oude localStorage-sleutels van V2.
   De oude sleutel was STEM_EVAL_<jaar>_<klas>_<evaluatie> met spaties
   vervangen door underscores. Die is niet terug te ontleden, dus we
   genereren hem opnieuw voor elke bestaande combinatie.
   ------------------------------------------------------------------ */

function legacyStorageKey(year, klas, evaluation) {
  return ("STEM_EVAL_" + year + "_" + klas + "_" + evaluation).replace(/\s+/g, "_");
}

function migrateLegacyStorage(config, storage) {
  var db = emptyDb();
  var found = 0;

  Object.keys(config).forEach(function (year) {
    config[year].classes.forEach(function (klas) {
      Object.keys(config[year].evaluations).forEach(function (evaluation) {
        var raw = storage.getItem(legacyStorageKey(year, klas, evaluation));
        if (!raw) return;
        var parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return;
        }
        var converted = convertLegacyExport(
          { year: year, className: klas, evaluation: evaluation, data: parsed },
          config,
        );
        if (converted) {
          Object.keys(converted.sessions).forEach(function (k) {
            if (converted.sessions[k].length) {
              db.sessions[k] = converted.sessions[k];
              found += converted.sessions[k].length;
            }
          });
        }
      });
    });
  });

  return { db: db, found: found };
}
