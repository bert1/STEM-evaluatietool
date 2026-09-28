/* Evaluatiedefinities: rubrics, open vragen, mappen en rubricversies.
   Enkel gegevenslogica, geen schermopbouw. Afgesplitst uit
   js/evaluations.js (1.19.1). */

/* ------------------------------------------------------------------
   EVALUATIES (rubrics en open vragen)
   Staan in het werkbestand, niet in de HTML. Zo maak je een nieuw
   project aan zonder de tool te bewerken.

   evaluations = { "1ste jaar": { "Challenge windei": {
     rubrics: [{ id, name, description, options: [{score,label,desc}] }],
     questions: [{ id, label, hint }],
     updatedAt
   } } }
   ------------------------------------------------------------------ */

function seedEvaluations(config) {
  var out = {};
  Object.keys(config).forEach(function (year) {
    out[year] = {};
    Object.keys(config[year].evaluations).forEach(function (name) {
      out[year][name] = {
        rubrics: JSON.parse(JSON.stringify(config[year].evaluations[name])),
        questions: [],
        version: 1,
        history: {},
        updatedAt: 0,
      };
    });
  });
  return out;
}

function evaluationNames(db, year) {
  if (db.evaluations && db.evaluations[year]) {
    return Object.keys(db.evaluations[year]).sort(function (a, b) {
      return a.localeCompare(b, "nl");
    });
  }
  return [];
}

function getEvaluation(db, year, name) {
  if (db.evaluations && db.evaluations[year] && db.evaluations[year][name]) {
    return db.evaluations[year][name];
  }
  return null;
}

function rubricsFor(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev ? ev.rubrics || [] : [];
}

function questionsFor(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev ? ev.questions || [] : [];
}



/* Sleutels moeten stabiel blijven: ze koppelen opgeslagen scores aan
   het juiste criterium. Alleen nieuwe krijgen een nieuwe sleutel. */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
}

function uniqueId(base, taken) {
  var id = slugify(base) || "criterium";
  if (taken.indexOf(id) === -1) return id;
  var n = 2;
  while (taken.indexOf(id + "-" + n) !== -1) n++;
  return id + "-" + n;
}



/* Standaardniveaus (sinds 1.24.0), zodat een nieuw criterium meteen de
   juiste vorm heeft. Dezelfde reeksen gelden voor de AI-rubriekhulp: de
   labels komen altijd uit de tool, nooit uit het antwoord van de AI.
   LEVEL_TARGETS is de score van het niveau "doel behaald": wat een
   leerling toont die het leerplandoel haalt. Bestaande rubrics met
   andere labels blijven gewoon werken. */
var LEVEL_TEMPLATES = {
  3: ["Onvoldoende", "Voldoende", "Sterk"],
  4: ["Onvoldoende", "Bijna", "Voldoende", "Sterk"],
  5: ["Onvoldoende", "Bijna", "Voldoende", "Sterk", "Uitstekend"],
};

var LEVEL_TARGETS = { 3: 2, 4: 3, 5: 3 };

var DEFAULT_LEVEL_COUNT = 5;

/* Het niveau "doel behaald" van een criterium: het bewaarde, anders dat
   van de standaardreeks bij dit aantal niveaus (enkel als hulp voor de
   AI-prompt, niet om oude rubrics iets op te leggen). */
function rubricTargetScore(rubric, useDefault) {
  var scores = (rubric.options || []).map(function (o) { return Number(o.score); });
  if (typeof rubric.targetScore === "number" && scores.indexOf(rubric.targetScore) !== -1) return rubric.targetScore;
  if (useDefault && LEVEL_TARGETS[scores.length] && isSequentialScores(rubric.options)) return LEVEL_TARGETS[scores.length];
  return null;
}

/* Staan de punten op 1, 2, 3 … zonder gaten? Dan wil de leerkracht bijna
   zeker dat het zo blijft wanneer er een niveau bijkomt of wegvalt. */
function isSequentialScores(options) {
  if (!options || !options.length) return false;
  var scores = options.map(function (o) { return Number(o.score); });
  if (scores.some(function (s) { return !isFinite(s); })) return false;
  var sorted = scores.slice().sort(function (a, b) { return a - b; });
  return sorted.every(function (s, i) { return s === i + 1; });
}



/* Hernummert in de volgorde waarin de niveaus op het scherm staan. */
function renumberScores(options) {
  options.forEach(function (o, i) { o.score = i + 1; });
  return options;
}

function blankRubric(count, taken) {
  if (!LEVEL_TEMPLATES[count]) count = DEFAULT_LEVEL_COUNT;
  return {
    id: uniqueId("nieuw-criterium", taken || []),
    name: "",
    description: "",
    targetScore: LEVEL_TARGETS[count],
    options: LEVEL_TEMPLATES[count].map(function (label, i) {
      return { score: i + 1, label: label, desc: "", next: "" };
    }),
  };
}

/* ------------------------------------------------------------------
   KWALITEITSCONTROLE VAN EEN RUBRIC (sinds 1.24.0)
   Waarschuwt, blokkeert nooit. Gebruikt na het inlezen van een AI-
   antwoord en live in de rubric-editor. Korte, concrete meldingen met
   het nummer van het criterium en het niveau.
   ------------------------------------------------------------------ */

var VAGUE_WORDS = ["goed", "voldoende", "correct", "mooi", "slecht", "zwak", "sterk", "prima", "ok", "oké", "matig", "onvoldoende", "uitstekend", "perfect", "netjes", "fout", "juist"];
var FILLER_WORDS = ["zeer", "heel", "erg", "niet", "wel", "het", "de", "een", "is", "zijn", "was", "en", "of", "nog", "te", "wat", "vrij", "redelijk", "best", "echt", "helemaal", "gedaan", "uitgevoerd", "werk"];

function textWords(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9à-ÿ\s]/g, " ").split(/\s+/).filter(Boolean);
}

function isVagueText(text) {
  var words = textWords(text).filter(function (w) { return FILLER_WORDS.indexOf(w) === -1; });
  return words.length > 0 && words.every(function (w) { return VAGUE_WORDS.indexOf(w) !== -1; });
}

/* Gelijkenis tussen 0 en 1 op basis van de bewerkingsafstand. */
function textSimilarity(a, b) {
  a = textWords(a).join(" ");
  b = textWords(b).join(" ");
  if (!a.length && !b.length) return 1;
  var prev = [], cur = [];
  for (var j = 0; j <= b.length; j++) prev[j] = j;
  for (var i = 1; i <= a.length; i++) {
    cur = [i];
    for (var k = 1; k <= b.length; k++) {
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

var DASH_PATTERN = /\u2014|\s\u2013\s/;

/* chosenLevels: het aantal niveaus dat in de AI-hulp gekozen werd, of
   0/undefined in de editor. Geeft een lijst met leesbare meldingen. */
function rubricWarnings(rubrics, year, chosenLevels) {
  var out = [];
  var counts = rubrics.map(function (r) { return (r.options || []).length; });
  var most = null, freq = {};
  counts.forEach(function (c) { freq[c] = (freq[c] || 0) + 1; if (most === null || freq[c] > freq[most]) most = c; });

  rubrics.forEach(function (r, ri) {
    var nr = "Criterium " + (ri + 1);
    var n = counts[ri];
    if (chosenLevels && n !== chosenLevels) {
      out.push(nr + ": " + n + " niveaus, je koos er " + chosenLevels + ".");
    } else if (!chosenLevels && n !== most) {
      out.push(nr + " heeft " + n + " niveaus, de andere " + most + ". Dan weegt het " + (n < most ? "minder" : "zwaarder") + " door.");
    }
    if (DASH_PATTERN.test(r.name || "") || DASH_PATTERN.test(r.description || "")) {
      out.push(nr + ": de naam of uitleg bevat een gedachtestreep.");
    }
    (r.options || []).forEach(function (o, oi) {
      var where = nr + ", niveau " + (oi + 1);
      var desc = String(o.desc || "").trim();
      if (!desc) out.push(where + ": nog geen omschrijving.");
      else if (isVagueText(desc)) out.push(where + ": enkel \"" + desc.replace(/[.!]+$/, "").toLowerCase() + "\". Wat zie je concreet?");
      else if (textWords(desc).length < 4) out.push(where + ": erg kort. Wat zie je concreet?");
      if (DASH_PATTERN.test(desc) || DASH_PATTERN.test(o.next || "")) out.push(where + ": bevat een gedachtestreep.");
      var nextOpt = r.options[oi + 1];
      if (desc && nextOpt && String(nextOpt.desc || "").trim() && textSimilarity(desc, nextOpt.desc) >= 0.9) {
        out.push(where + ": bijna dezelfde tekst als niveau " + (oi + 2) + ".");
      }
    });
    if (yearHasGoals(year) && !(r.goals || []).length) out.push(nr + ": nog geen leerplandoel gekoppeld.");
  });
  return out;
}

function blankQuestion(taken) {
  return { id: uniqueId("open-vraag", taken || []), label: "", hint: "" };
}



/* Controle vóór opslaan. Levert een lijst met leesbare problemen op. */
function validateEvaluation(draft, db, originalName) {
  var problems = [];
  var name = String(draft.name || "").trim();

  if (!name) problems.push("Geef de evaluatie een naam.");
  if (name.indexOf("|") !== -1) problems.push("De naam mag geen | bevatten.");

  var existing = evaluationNames(db, draft.year);
  if (name && name !== originalName && existing.indexOf(name) !== -1) {
    problems.push('Er bestaat al een evaluatie "' + name + '" in ' + draft.year + ".");
  }

  if (!draft.rubrics.length) problems.push("Voeg minstens één criterium toe.");

  var seenIds = [];
  draft.rubrics.forEach(function (r, i) {
    var nr = "Criterium " + (i + 1);
    if (!String(r.name || "").trim()) problems.push(nr + " heeft nog geen naam.");
    if (seenIds.indexOf(r.id) !== -1) problems.push(nr + " heeft een dubbele sleutel.");
    seenIds.push(r.id);

    if (!r.options || r.options.length < 2) {
      problems.push(nr + " heeft minstens twee niveaus nodig.");
      return;
    }
    var scores = [];
    r.options.forEach(function (o, j) {
      if (!String(o.label || "").trim()) {
        problems.push(nr + ", niveau " + (j + 1) + " heeft geen naam.");
      }
      var s = Number(o.score);
      if (!isFinite(s)) problems.push(nr + ", niveau " + (j + 1) + " heeft geen geldige score.");
      else if (scores.indexOf(s) !== -1) problems.push(nr + " heeft twee keer de score " + s + ".");
      else scores.push(s);
    });
  });

  (draft.questions || []).forEach(function (q, i) {
    if (!String(q.label || "").trim()) {
      problems.push("Open vraag " + (i + 1) + " heeft nog geen tekst.");
    }
  });

  return problems;
}



/* Hoeveel resultaten hangen er aan deze evaluatie? */
function resultCount(db, year, name) {
  var n = 0;
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year === year && p.evaluation === name) n += db.sessions[key].length;
  });
  return n;
}



/* Bij hernoemen moeten de opgeslagen resultaten mee, anders raken ze zoek. */
function renameEvaluation(db, year, oldName, newName) {
  if (oldName === newName) return 0;
  var moved = 0;
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year || p.evaluation !== oldName) return;
    var target = sessionKey(year, p.klas, newName);
    if (!db.sessions[target]) db.sessions[target] = [];
    db.sessions[target] = db.sessions[target].concat(db.sessions[key]);
    moved += db.sessions[key].length;
    delete db.sessions[key];
  });
  return moved;
}



/* Wat gaat er stuk als je deze wijziging opslaat? */
function impactOfEdit(original, draft) {
  if (!original) return [];
  var warnings = [];
  var oldIds = (original.rubrics || []).map(function (r) { return r.id; });
  var newIds = draft.rubrics.map(function (r) { return r.id; });

  var removed = oldIds.filter(function (id) { return newIds.indexOf(id) === -1; });
  if (removed.length) {
    warnings.push(
      removed.length +
        " criterium/criteria verdwijnen. De punten die daarvoor gegeven zijn, tellen niet meer mee in het totaal.",
    );
  }

  (original.rubrics || []).forEach(function (oldR) {
    var newR = draft.rubrics.filter(function (r) { return r.id === oldR.id; })[0];
    if (!newR) return;
    var oldMax = Math.max.apply(null, oldR.options.map(function (o) { return o.score; }));
    var newMax = Math.max.apply(null, newR.options.map(function (o) { return Number(o.score); }));
    if (oldMax !== newMax) {
      warnings.push('"' + (newR.name || oldR.name) + '" gaat van maximum ' + oldMax + " naar " + newMax + ". Bestaande percentages verschuiven.");
    }
  });

  return warnings;
}



/* Nieuwere definitie wint, net als bij klaslijsten — tenzij een
   tombstone zegt dat dit item verwijderd is en de inkomende versie niet
   nieuwer is dan dat verwijdermoment. */
function mergeEvaluations(target, incoming) {
  var changed = [];
  if (!target.evaluations) target.evaluations = {};

  if (incoming) {
    Object.keys(incoming).forEach(function (year) {
      if (!target.evaluations[year]) target.evaluations[year] = {};
      Object.keys(incoming[year]).forEach(function (name) {
        var inc = incoming[year][name];
        var key = year + "||" + name;
        if (isTombstoned("evaluations", key, inc.updatedAt)) return; // blijft verwijderd

        var cur = target.evaluations[year][name];
        if (!cur) {
          target.evaluations[year][name] = JSON.parse(JSON.stringify(inc));
          changed.push(name + " (nieuw)");
        } else if ((inc.updatedAt || 0) > (cur.updatedAt || 0)) {
          target.evaluations[year][name] = JSON.parse(JSON.stringify(inc));
          changed.push(name + " (bijgewerkt)");
        }
      });
    });
  }

  // Zelf ook toepassen: een "voor iedereen" tombstone die net binnenkwam
  // ruimt onze eigen, oudere kopie meteen mee op.
  Object.keys(target.evaluations).forEach(function (year) {
    Object.keys(target.evaluations[year]).forEach(function (name) {
      var key = year + "||" + name;
      if (isTombstoned("evaluations", key, target.evaluations[year][name].updatedAt)) {
        delete target.evaluations[year][name];
      }
    });
  });

  return changed;
}

/* Mappen zijn een vrije indeling. Elke map heeft nu een eigen updatedAt
   (nodig om tegen een verwijder-tombstone te kunnen vergelijken, zie
   hieronder) — daarom een lijst van {name, updatedAt}-objecten, niet
   langer platte tekst. De volgorde in de lijst blijft wel de
   weergavevolgorde, voor het verplaatsen met de pijltjes. */
function mergeEvaluationFolders(target, incoming) {
  var added = [];
  if (!target.evaluationFolders) target.evaluationFolders = {};

  if (incoming) {
    Object.keys(incoming).forEach(function (year) {
      if (!target.evaluationFolders[year]) target.evaluationFolders[year] = [];
      (incoming[year] || []).forEach(function (f) {
        if (!f || !f.name) return;
        var key = year + "||" + f.name;
        if (isTombstoned("folders", key, f.updatedAt)) return; // blijft verwijderd

        var list = target.evaluationFolders[year];
        var existing = list.filter(function (x) { return x.name === f.name; })[0];
        if (!existing) {
          list.push({ name: f.name, updatedAt: f.updatedAt || 0 });
          added.push(f.name + " [" + year + "]");
        } else if ((f.updatedAt || 0) > (existing.updatedAt || 0)) {
          existing.updatedAt = f.updatedAt;
        }
      });
    });
  }

  // Tombstones toepassen op wat we zelf al hadden — als een collega deze
  // map "voor iedereen" verwijderde ná onze laatste wijziging eraan,
  // verdwijnt hij nu ook bij ons.
  Object.keys(target.evaluationFolders).forEach(function (year) {
    target.evaluationFolders[year] = target.evaluationFolders[year].filter(function (f) {
      return !isTombstoned("folders", year + "||" + f.name, f.updatedAt);
    });
  });

  return added;
}

/* --- mappen: aanmaken, hernoemen, verwijderen, toewijzen --- */

function evaluationFoldersFor(db, year) {
  var registry = (db.evaluationFolders && db.evaluationFolders[year]) || [];
  // De opgeslagen volgorde is de echte volgorde — een leerkracht kan die
  // zelf met de pijltjes aanpassen. Enkel mappen die wél in gebruik zijn
  // maar om een of andere reden niet in de registry staan (bv. een ouder
  // bestand) komen er zonder vaste volgorde alfabetisch achteraan bij.
  var names = registry.map(function (f) { return f.name; });
  var extra = [];
  Object.keys((db.evaluations && db.evaluations[year]) || {}).forEach(function (name) {
    var f = db.evaluations[year][name].folder;
    if (f && names.indexOf(f) === -1 && extra.indexOf(f) === -1) extra.push(f);
  });
  extra.sort(function (a, b) { return a.localeCompare(b, "nl"); });
  return names.concat(extra);
}

function moveEvaluationFolder(db, year, folderName, delta) {
  if (!db.evaluationFolders || !db.evaluationFolders[year]) return false;
  var list = db.evaluationFolders[year];
  var index = list.findIndex(function (f) { return f.name === folderName; });
  var target = index + delta;
  if (index === -1 || target < 0 || target >= list.length) return false;
  var tmp = list[index];
  list[index] = list[target];
  list[target] = tmp;
  return true;
}

function addEvaluationFolder(db, year, name) {
  var clean = String(name || "").trim();
  if (!clean) return false;
  if (!db.evaluationFolders) db.evaluationFolders = {};
  if (!db.evaluationFolders[year]) db.evaluationFolders[year] = [];
  if (db.evaluationFolders[year].some(function (f) { return f.name === clean; })) return false;
  db.evaluationFolders[year].push({ name: clean, updatedAt: Date.now() });
  return true;
}

/* De map verdwijnt, de evaluaties die erin zaten nooit — die komen
   gewoon terug bij "Geen map". "scope" bepaalt of dit ook bij collega's
   moet verdwijnen ("iedereen") of enkel lokaal blijft ("mezelf"), zie
   recordDeletion() verderop. */
function deleteEvaluationFolder(db, year, name, scope) {
  var key = year + "||" + name;
  if (db.evaluationFolders && db.evaluationFolders[year]) {
    db.evaluationFolders[year] = db.evaluationFolders[year].filter(function (f) { return f.name !== name; });
  }
  Object.keys((db.evaluations && db.evaluations[year]) || {}).forEach(function (evName) {
    if (db.evaluations[year][evName].folder === name) {
      db.evaluations[year][evName].folder = "";
      db.evaluations[year][evName].updatedAt = Date.now();
    }
  });
  recordDeletion("folders", key, scope);
}

function setEvaluationFolder(db, year, evalName, folder) {
  var ev = getEvaluation(db, year, evalName);
  if (!ev) return;
  ev.folder = folder || "";
  ev.updatedAt = Date.now();
}



/* ------------------------------------------------------------------
   RUBRICVERSIES

   Pas je een niveaubeschrijving aan nadat er al beoordeeld is, dan zou
   een oude evaluatie ineens met de nieuwe tekst getoond worden. Op de
   vraag "waarop is deze leerling in september beoordeeld?" klopt het
   antwoord dan niet meer.

   Daarom: de oude tekst verhuist naar history[] en elke rij onthoudt
   met welke versie hij beoordeeld is. Alleen wijzigingen ná gebruik
   maken een nieuwe versie; anders zou je bij elk typfoutje een versie
   bijhouden.
   ------------------------------------------------------------------ */

function evaluationVersion(db, year, name) {
  var ev = getEvaluation(db, year, name);
  return ev && ev.version ? ev.version : 1;
}



/* De rubric zoals hij was op het moment van beoordelen. */
function rubricsForVersion(db, year, name, version) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return [];
  if (!version || version === (ev.version || 1)) return ev.rubrics || [];
  var old = (ev.history || {})[String(version)];
  return old && old.rubrics ? old.rubrics : ev.rubrics || [];
}

function questionsForVersion(db, year, name, version) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return [];
  if (!version || version === (ev.version || 1)) return ev.questions || [];
  var old = (ev.history || {})[String(version)];
  return old && old.questions ? old.questions : ev.questions || [];
}



/* Is er inhoudelijk iets veranderd? Volgorde telt niet mee. */
function rubricsDiffer(a, b) {
  function normalise(list) {
    return (list || [])
      .map(function (r) {
        return {
          id: r.id,
          name: String(r.name || "").trim(),
          description: String(r.description || "").trim(),
          options: (r.options || [])
            .map(function (o) {
              return Number(o.score) + "|" + String(o.label || "").trim() + "|" + String(o.desc || "").trim();
            })
            .sort(),
        };
      })
      .sort(function (x, y) { return x.id.localeCompare(y.id); });
  }
  return JSON.stringify(normalise(a)) !== JSON.stringify(normalise(b));
}



/* Bewaart de huidige tekst als oude versie en verhoogt het nummer. */
function archiveVersion(evaluationObj) {
  var version = evaluationObj.version || 1;
  if (!evaluationObj.history) evaluationObj.history = {};
  evaluationObj.history[String(version)] = {
    rubrics: JSON.parse(JSON.stringify(evaluationObj.rubrics || [])),
    questions: JSON.parse(JSON.stringify(evaluationObj.questions || [])),
    archivedAt: Date.now(),
  };
  evaluationObj.version = version + 1;
  return evaluationObj.version;
}
