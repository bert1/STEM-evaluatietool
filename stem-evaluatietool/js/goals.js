/* ---- overgenomen uit core.js ---- */



/* ------------------------------------------------------------------
   LEERPLANDOELEN

   Doelen hangen aan een criterium, niet aan een evaluatie als geheel.
   Zo weet je niet alleen dát een doel geëvalueerd is, maar ook waarmee
   — en kan je per leerling zien of het behaald is.

   Wanneer een doel behaald is, hangt af van het beheersingsniveau.
   "Toepassen" en "creëren" leg je niet noodzakelijk op dezelfde lat.
   De drempels zijn daarom instelbaar; 50% is alleen een startpunt.
   ------------------------------------------------------------------ */

var DEFAULT_THRESHOLDS = {
  onthouden: 50,
  begrijpen: 50,
  toepassen: 50,
  analyseren: 50,
  evalueren: 50,
  "creëren": 50,
}

function emptySettings() {
  return { thresholds: JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)), updatedAt: 0 };
}

function thresholdFor(db, bloom) {
  var t = db.settings && db.settings.thresholds ? db.settings.thresholds : DEFAULT_THRESHOLDS;
  var v = t[bloom];
  return typeof v === "number" ? v : 50;
}

function mergeSettings(target, incoming) {
  if (!incoming) return false;
  if (!target.settings) target.settings = emptySettings();
  if ((incoming.updatedAt || 0) <= (target.settings.updatedAt || 0)) return false;
  target.settings = {
    thresholds: JSON.parse(JSON.stringify(incoming.thresholds || DEFAULT_THRESHOLDS)),
    updatedAt: incoming.updatedAt || 0,
  };
  return true;
}



/* Alle doelen die in een leerjaar ergens aan een criterium hangen. */
/* Oude koppelingen met pakketprefix omzetten. Gebeurt bij het inlezen,
   zodat de rest van de tool alleen nieuwe sleutels ziet. */
function migrateGoalLinks(db) {
  Object.keys(db.evaluations || {}).forEach(function (year) {
    if (!yearHasGoals(year)) return;
    Object.keys(db.evaluations[year]).forEach(function (name) {
      var ev = db.evaluations[year][name];
      (ev.rubrics || []).forEach(function (r) {
        if (!r.goals || !r.goals.length) return;
        var seen = {};
        r.goals = r.goals
          .map(function (k) { return migrateGoalKey(year, k); })
          .filter(function (k) {
            if (!k || seen[k]) return false;
            seen[k] = true;
            return true;
          });
      });
      Object.keys(ev.history || {}).forEach(function (v) {
        (ev.history[v].rubrics || []).forEach(function (r) {
          if (!r.goals || !r.goals.length) return;
          r.goals = r.goals.map(function (k) { return migrateGoalKey(year, k); });
        });
      });
    });
  });
  return db;
}

function goalUsage(db, year) {
  var usage = {};
  var names = evaluationNames(db, year);

  names.forEach(function (name) {
    var ev = getEvaluation(db, year, name);
    (ev.rubrics || []).forEach(function (r) {
      (r.goals || []).forEach(function (key) {
        if (!usage[key]) usage[key] = [];
        usage[key].push({ evaluation: name, rubricId: r.id, rubricName: r.name });
      });
    });
  });

  return usage;
}



/* Per doel: hoeveel leerlingen halen de drempel voor dat doel?
   Een doel kan door meerdere criteria gedekt worden; we nemen dan het
   gemiddelde van die criteria per leerling. */
function goalAttainment(db, year, goalKeys, entriesByEvaluation) {
  var out = {};

  goalKeys.forEach(function (key) {
    var goal = findGoal(year, key);
    if (!goal) return;
    var drempel = thresholdFor(db, goal.bloom);

    var perStudent = {};

    Object.keys(entriesByEvaluation).forEach(function (evaluation) {
      var pack = entriesByEvaluation[evaluation];
      var linked = (pack.rubrics || []).filter(function (r) {
        return (r.goals || []).indexOf(key) !== -1;
      });
      if (!linked.length) return;

      pack.entries.forEach(function (e) {
        var vals = [];
        linked.forEach(function (r) {
          var v = e.scores[r.id];
          var rMax = rubricMaxScore(r);
          if (typeof v === "number" && rMax > 0) vals.push((v / rMax) * 100);
        });
        if (!vals.length) return;
        var id = e.klas + "||" + e.name;
        if (!perStudent[id]) perStudent[id] = [];
        perStudent[id].push(average(vals));
      });
    });

    var students = Object.keys(perStudent);
    var reached = students.filter(function (id) {
      return average(perStudent[id]) >= drempel;
    });

    out[key] = {
      goal: goal,
      threshold: drempel,
      assessed: students.length,
      reached: reached.length,
      pct: students.length ? Math.round((reached.length / students.length) * 100) : null,
      notReached: students
        .filter(function (id) { return average(perStudent[id]) < drempel; })
        .map(function (id) { return id.split("||")[1]; }),
      averagePct: students.length
        ? Math.round(average(students.map(function (id) { return average(perStudent[id]); })))
        : null,
    };
  });

  return out;
}



/* Welke doelen dekt deze evaluatie, en op welk niveau? */
function goalsOfEvaluation(db, year, name) {
  var ev = getEvaluation(db, year, name);
  if (!ev) return [];
  var seen = {};
  var list = [];
  (ev.rubrics || []).forEach(function (r) {
    (r.goals || []).forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      var goal = findGoal(year, key);
      if (goal) list.push(goal);
    });
  });
  return list.sort(function (a, b) {
    return a.id.localeCompare(b.id, "nl", { numeric: true });
  });
}



/* ------------------------------------------------------------------
   GROEI OVER HET JAAR

   Eén evaluatie geeft een momentopname. Om te zien of het leren
   vooruitgaat, moet je hetzelfde doel over meerdere evaluaties heen
   volgen — dat kan alleen via het leerplandoel, want dat is het enige
   dat evaluaties met elkaar verbindt.
   ------------------------------------------------------------------ */

/* Eén reeks: per evaluatie die dit doel raakt, het gemiddelde percentage
   op het tijdstip van de vroegste beoordeling in die evaluatie.
   student = null → klasgemiddelde; student = naam → één leerling. */
function goalTrendSeries(db, year, goalKey, klas, student) {
  var goal = findGoal(year, goalKey);
  if (!goal) return [];

  var out = [];

  evaluationNames(db, year).forEach(function (evName) {
    var ev = getEvaluation(db, year, evName);
    var linked = (ev.rubrics || []).filter(function (r) {
      return (r.goals || []).indexOf(goalKey) !== -1;
    });
    if (!linked.length) return;

    var perStudentVals = {};
    var when = [];

    Object.keys(db.sessions || {}).forEach(function (key) {
      var p = parseSessionKey(key);
      if (p.year !== year || p.evaluation !== evName) return;

      (db.sessions[key] || []).forEach(function (row) {
        if (row.formative) return; // tellen niet mee voor de eindlijn
        var rowVals = [];
        linked.forEach(function (r) {
          var v = row.scores[r.id];
          var rMax = rubricMaxScore(r);
          if (typeof v === "number" && rMax > 0) rowVals.push((v / rMax) * 100);
        });
        if (!rowVals.length) return;
        var avgRow = average(rowVals);

        (row.students || []).forEach(function (name) {
          if (student && name !== student) return;
          // De echte klas van deze leerling, niet die van de sessie: een
          // combinatie als "1WM+1WTa" hoort zo bij beide klassen (1.34.3).
          if (klas && klas !== "*" && klasOfStudentInRow(db, year, row, name, p.klas) !== klas) return;
          if (!perStudentVals[name]) perStudentVals[name] = [];
          perStudentVals[name].push(avgRow);
          when.push(row.updatedAt || 0);
        });
      });
    });

    var studentAverages = Object.keys(perStudentVals).map(function (name) {
      return average(perStudentVals[name]);
    });
    if (!studentAverages.length) return;

    out.push({
      evaluation: evName,
      pct: Math.round(average(studentAverages)),
      studentCount: studentAverages.length,
      when: when.length ? Math.min.apply(null, when) : 0,
    });
  });

  out.sort(function (a, b) { return a.when - b.when; });
  return out;
}



/* Klas- en leerlinglijn samen, zodat je één leerling tegen het
   klasgemiddelde kan afzetten. */
function goalTrendComparison(db, year, goalKey, klas, student) {
  return {
    goal: findGoal(year, goalKey),
    classSeries: goalTrendSeries(db, year, goalKey, klas, null),
    studentSeries: student ? goalTrendSeries(db, year, goalKey, klas, student) : [],
  };
}

/* ---- overgenomen uit goalview.js ---- */

/* ------------------------------------------------------------------
   LEERPLANDOELEN OP HET RESULTATENSCHERM
   ------------------------------------------------------------------ */

/* Blok "Leerplandoelen" op het Controle-tabblad (sinds 1.22.0): per
   rubriek elk doel met één van drie toestanden. Geen percentages meer;
   "Overzicht afdrukken" en de drempels daarachter blijven wel werken. */
function goalStatusList(dbObj, year, klas) {
  var perEvaluation = {};
  evaluationNames(dbObj, year).forEach(function (name) {
    var data = collectResults(dbObj, year, name, klas);
    var finals = data.entries.filter(function (e) { return !e.formative; });
    if (!finals.length) return;
    perEvaluation[name] = { rubrics: data.rubrics, entries: finals };
  });

  var usage = goalUsage(dbObj, year);
  var attainment = goalAttainment(dbObj, year, Object.keys(usage), perEvaluation);

  var list = goalsForYear(year).map(function (g) {
    var linked = usage[g.id] || [];
    var evs = linked.map(function (l) { return l.evaluation; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    var assessedIn = evs.filter(function (ev) {
      var pack = perEvaluation[ev];
      if (!pack) return false;
      return pack.rubrics.some(function (r) {
        return (r.goals || []).indexOf(g.id) !== -1 && pack.entries.some(function (e) {
          return typeof e.scores[r.id] === "number";
        });
      });
    });
    var status = !linked.length ? "niet" : assessedIn.length ? "beoordeeld" : "gekoppeld";
    return { goal: g, status: status, evaluations: evs, assessedIn: assessedIn };
  });

  return { list: list, usage: usage, attainment: attainment };
}

function renderGoalOverview() {
  var host = $("goalsBody");
  host.innerHTML = "";

  var year = $("resYear").value;
  var klas = $("resKlas").value || "*";

  if (!yearHasGoals(year)) {
    host.appendChild(el("div", "empty",
      "Voor " + year + " zijn er geen leerplandoelen in de tool geladen."));
    return;
  }

  var st = goalStatusList(db, year, klas);
  var count = { niet: 0, gekoppeld: 0, beoordeeld: 0 };
  st.list.forEach(function (x) { count[x.status]++; });
  host.appendChild(el("p", "goal-status-summary",
    count.beoordeeld + " beoordeeld, " + count.gekoppeld + " gekoppeld maar nog niet beoordeeld, " +
      count.niet + " niet gekoppeld" + (klas === "*" ? "." : " (klas " + klas + ").")));

  var labels = {
    niet: "Niet gekoppeld",
    gekoppeld: "Nog niet beoordeeld",
    beoordeeld: "Beoordeeld",
  };

  var lastRubriek = null;
  st.list.forEach(function (x) {
    var g = x.goal;
    if (g.rubriek !== lastRubriek) {
      host.appendChild(el("div", "goal-rubriek", g.rubriek));
      lastRubriek = g.rubriek;
    }
    var row = el("div", "goal-row goal-status-" + x.status);
    var main = el("div", "goal-main");
    main.appendChild(el("span", "goal-code", goalCodeLabel(g)));
    main.appendChild(planBadge(g));
    main.appendChild(bloomBadge(g.bloom));
    main.appendChild(goalInfo(g));
    row.appendChild(main);
    row.appendChild(el("div", "goal-title", g.text));

    var status = el("div", "goal-status");
    status.appendChild(el("span", "badge goal-badge-" + x.status, labels[x.status]));
    var shown = x.status === "beoordeeld" ? x.assessedIn : x.evaluations;
    if (shown.length) status.appendChild(el("span", "goal-evals", shown.join(", ")));
    row.appendChild(status);
    host.appendChild(row);
  });

  var btns = el("div", "btn-row");
  btns.style.marginTop = "14px";
  var print = el("button", "btn-ghost btn-small", "Overzicht afdrukken");
  print.type = "button";
  print.addEventListener("click", function () { printGoalOverview(st.usage, st.attainment); });
  btns.appendChild(print);
  host.appendChild(btns);
}

function goalInfo(goal) {
  if (!goal) return el("span");
  // Alleen het bolletje overhouden; code en niveau staan er al naast.
  var info = goalChip(goal, null).querySelector(".goal-info");
  return info || el("span");
}



/* ---- overgenomen uit growth.js ---- */

/* ------------------------------------------------------------------
   GROEI OVER HET JAAR
   Eén evaluatie is een momentopname. Dit paneel zet dezelfde
   leerplandoelen naast elkaar over meerdere evaluaties heen, zodat je
   ziet of een leerling — of de klas — vooruitgaat.
   ------------------------------------------------------------------ */

/* Sinds 1.22.0 staat het groeiblok niet meer op het scherm (het tabblad
   Resultaten werd Controle). renderGrowthPanel(), renderGrowthWorkpoints(),
   renderGrowthChart(), goalTrendSeries() en goalTrendComparison() blijven
   bewust staan om ze later elders terug te zetten. Ze verwachten de
   elementen #growthBody en #growthWorkpoints en lezen #resYear/#resEval/
   #resKlas; die moeten dan opnieuw voorzien worden. */
function renderGrowthPanel() {
  renderGrowthWorkpoints();

  var host = $("growthBody");
  host.innerHTML = "";

  var year = $("resYear").value;
  if (!yearHasGoals(year)) {
    host.appendChild(el("div", "empty", "Voor " + year + " zijn er nog geen leerplandoelen geladen."));
    return;
  }

  var usage = goalUsage(db, year);
  var usedKeys = Object.keys(usage).filter(function (k) {
    return usage[k].length; // enkel doelen die ook echt gekoppeld zijn
  });

  if (!usedKeys.length) {
    host.appendChild(el("div", "empty", "Koppel eerst een leerplandoel aan een criterium om groei te kunnen volgen."));
    return;
  }

  var controls = el("div", "selection-grid");
  controls.style.marginBottom = "14px";

  var goalGroup = el("div", "form-group");
  goalGroup.style.margin = "0";
  goalGroup.appendChild(el("label", null, "Leerplandoel"));
  var goalSelect = document.createElement("select");
  goalSelect.id = "growthGoal";
  usedKeys
    .map(function (k) { return findGoal(year, k); })
    .filter(Boolean)
    .sort(function (a, b) { return a.id.localeCompare(b.id, "nl", { numeric: true }); })
    .forEach(function (g) {
      goalSelect.appendChild(new Option(goalCodeLabel(g) + ": " + g.text.slice(0, 60), g.id));
    });
  goalGroup.appendChild(goalSelect);
  controls.appendChild(goalGroup);

  var klasGroup = el("div", "form-group");
  klasGroup.style.margin = "0";
  klasGroup.appendChild(el("label", null, "Klas"));
  var klasSelect = document.createElement("select");
  klasSelect.id = "growthKlas";
  classesFor(db, year).forEach(function (k) { klasSelect.appendChild(new Option(k, k)); });
  klasGroup.appendChild(klasSelect);
  controls.appendChild(klasGroup);

  var studentGroup = el("div", "form-group");
  studentGroup.style.margin = "0";
  studentGroup.appendChild(el("label", null, "Leerling"));
  var studentSelect = document.createElement("select");
  studentSelect.id = "growthStudent";
  studentGroup.appendChild(studentSelect);
  controls.appendChild(studentGroup);

  host.appendChild(controls);

  var chartHost = el("div");
  host.appendChild(chartHost);

  function fillStudents() {
    var klas = klasSelect.value;
    studentSelect.innerHTML = "";
    studentSelect.appendChild(new Option("Hele klas (gemiddelde)", ""));
    studentsFor(db, year, klas).forEach(function (name) {
      studentSelect.appendChild(new Option(name, name));
    });
  }

  function draw() {
    var goalKeyVal = goalSelect.value;
    var klas = klasSelect.value;
    var student = studentSelect.value || null;
    chartHost.innerHTML = "";
    chartHost.appendChild(renderGrowthChart(year, goalKeyVal, klas, student));
  }

  goalSelect.addEventListener("change", draw);
  klasSelect.addEventListener("change", function () { fillStudents(); draw(); });
  studentSelect.addEventListener("change", draw);

  fillStudents();
  draw();
}

/* Werkpunten voor de klas hoort inhoudelijk bij "Groei over het jaar":
   groei laat zien of het beter gaat, werkpunten laat zien waar dat nu
   nog niet zo is. Gebruikt bewust dezelfde evaluatie/klas-keuze als de
   rest van het Resultatenscherm — geen aparte selectie nodig. */
function renderGrowthWorkpoints() {
  var host = $("growthWorkpoints");
  if (!host) return;
  host.innerHTML = "";

  var year = $("resYear").value;
  var evaluation = $("resEval").value;
  var klas = $("resKlas").value || "*";

  if (!evaluation) {
    host.appendChild(el("div", "empty", "Kies hieronder eerst een evaluatie."));
    return;
  }

  var data = collectResults(db, year, evaluation, klas);
  var summativeEntries = data.entries.filter(function (e) { return !e.formative; });
  if (!summativeEntries.length) {
    host.appendChild(el("div", "empty",
      "Nog geen eindbeoordelingen voor " + evaluation + (klas === "*" ? "" : " in " + klas) + "."));
    return;
  }

  var stats = statsFor(summativeEntries, data.rubrics);
  host.appendChild(renderWorkPoints(data, stats));
}

function renderGrowthChart(year, goalKeyVal, klas, student) {
  var box = el("div", "chart-box");
  var cmp = goalTrendComparison(db, year, goalKeyVal, klas, student);

  if (!cmp.goal) {
    box.appendChild(el("div", "empty", "Onbekend leerplandoel."));
    return box;
  }

  box.appendChild(el("p", "hint",
    "Score op " + goalCodeLabel(cmp.goal) + " over de evaluaties heen die dit doel raken, in de klas " +
    klas + ". Tussentijdse checks tellen niet mee: dit gaat over eindbeoordelingen."));

  var series = cmp.classSeries;
  if (!series.length) {
    box.appendChild(el("div", "empty", "Nog geen eindbeoordelingen die dit doel raken in " + klas + "."));
    return box;
  }

  if (series.length === 1) {
    var n = el("div", "notice info");
    n.appendChild(el("strong", null, "Nog maar één meetpunt"));
    n.appendChild(document.createTextNode(
      "Dit doel is tot nu toe maar in één evaluatie beoordeeld (" + series[0].evaluation +
      "). Zodra een volgende evaluatie hetzelfde doel raakt, verschijnt hier een lijn.",
    ));
    box.appendChild(n);
  }

  var width = 760;
  var height = 220;
  var padL = 40;
  var padB = 46;
  var padT = 14;
  var chartW = width - padL - 16;
  var chartH = height - padT - padB;

  var svg = svgEl("svg", {
    viewBox: "0 0 " + width + " " + height,
    class: "chart",
    role: "img",
    "aria-label": "Groei op " + cmp.goal.text,
  });

  // Y-as: 0-100%
  [0, 25, 50, 75, 100].forEach(function (p) {
    var y = padT + chartH - (p / 100) * chartH;
    svg.appendChild(svgEl("line", {
      x1: padL, y1: y, x2: width - 8, y2: y,
      stroke: p === 50 ? "#cbd5e1" : "#eef2f7", "stroke-dasharray": p === 50 ? "4 3" : "0",
    }));
    svg.appendChild(svgText(padL - 8, y + 4, p + "%", { "text-anchor": "end", class: "axis" }));
  });

  var n = series.length;
  var stepX = n > 1 ? chartW / (n - 1) : 0;
  function xAt(i) { return padL + (n > 1 ? i * stepX : chartW / 2); }
  function yAt(pct) { return padT + chartH - (Math.max(0, Math.min(100, pct)) / 100) * chartH; }

  function drawLine(points, color, dashed, label) {
    if (points.length < 2) {
      // één punt: gewoon een stip, geen lijn te trekken
      points.forEach(function (p, i) {
        var dot = svgEl("circle", { cx: xAt(i), cy: yAt(p.pct), r: 5, fill: color });
        dot.appendChild(svgEl("title")).textContent = p.evaluation + ": " + p.pct + "%";
        svg.appendChild(dot);
      });
      return;
    }
    var d = points.map(function (p, i) { return (i === 0 ? "M" : "L") + xAt(i) + " " + yAt(p.pct); }).join(" ");
    svg.appendChild(svgEl("path", {
      d: d, fill: "none", stroke: color, "stroke-width": 2.5,
      "stroke-dasharray": dashed ? "6 4" : "0", "stroke-linejoin": "round", "stroke-linecap": "round",
    }));
    points.forEach(function (p, i) {
      var dot = svgEl("circle", { cx: xAt(i), cy: yAt(p.pct), r: 4.5, fill: color });
      dot.appendChild(svgEl("title")).textContent =
        label + ", " + p.evaluation + ": " + p.pct + "%" +
        (p.studentCount > 1 ? " (" + p.studentCount + " leerlingen)" : "");
      svg.appendChild(dot);
    });
  }

  drawLine(series, "#94a3b8", true, "Klasgemiddelde");
  if (student && cmp.studentSeries.length) {
    drawLine(cmp.studentSeries, "#0284c7", false, student);
  }

  series.forEach(function (p, i) {
    var label = p.evaluation.length > 16 ? p.evaluation.slice(0, 15) + "…" : p.evaluation;
    var t = svgText(xAt(i), height - padB + 20, label, { "text-anchor": "middle", class: "axis" });
    t.appendChild(svgEl("title")).textContent = p.evaluation;
    svg.appendChild(t);
  });

  box.appendChild(svg);

  var legend = el("div", "legend");
  var l1 = el("span", "legend-item");
  var d1 = el("span", "dot");
  d1.style.background = "#94a3b8";
  l1.appendChild(d1);
  l1.appendChild(document.createTextNode("Klasgemiddelde"));
  legend.appendChild(l1);
  if (student) {
    var l2 = el("span", "legend-item");
    var d2 = el("span", "dot");
    d2.style.background = "#0284c7";
    l2.appendChild(d2);
    l2.appendChild(document.createTextNode(student));
    legend.appendChild(l2);
  }
  box.appendChild(legend);

  if (student && series.length > 1 && cmp.studentSeries.length > 1) {
    var eerste = cmp.studentSeries[0].pct;
    var laatste = cmp.studentSeries[cmp.studentSeries.length - 1].pct;
    var verschil = laatste - eerste;
    var trend = el("p", "hint");
    trend.textContent = verschil > 0
      ? student + " gaat vooruit: van " + eerste + "% naar " + laatste + "% (+" + verschil + ")."
      : verschil < 0
        ? student + " scoort lager dan bij de eerste meting: van " + eerste + "% naar " + laatste + "% (" + verschil + ")."
        : student + " scoort stabiel rond " + laatste + "%.";
    box.appendChild(trend);
  }

  return box;
}

/* ---- overgenomen uit editor.js ---- */



/* Gedeeld tussen editor, resultaten en rapport. */
function bloomBadge(bloom) {
  var b = el("span", "bloom bloom-" + slugify(bloom), bloom);
  b.title = "Beheersingsniveau volgens de taxonomie van Bloom";
  return b;
}



/* Toont of het doel in één of in beide leerplannen zit. */
function planBadge(goal) {
  var pkgs = goalPackages(goal);
  var badge = el("span", "plan-badge" + (pkgs.length > 1 ? " both" : " one"));
  badge.textContent = pkgs.length > 1 ? "beide" : pkgs[0];
  badge.title = pkgs.length > 1
    ? "Staat woordelijk in beide leerplannen: " + pkgs.map(function (p) {
        return GOAL_PACKAGES[p].label + " (" + goal.codes[p] + ")";
      }).join(" en ")
    : "Alleen in " + GOAL_PACKAGES[pkgs[0]].label;
  return badge;
}

function goalChip(goal, onRemove) {
  var chip = el("span", "goal-chip");
  chip.appendChild(el("span", "goal-code", goalCodeLabel(goal)));
  chip.appendChild(planBadge(goal));
  chip.appendChild(bloomBadge(goal.bloom));

  var info = el("span", "goal-info", "i");
  info.setAttribute("tabindex", "0");
  info.setAttribute("role", "button");
  info.setAttribute("aria-label", "Toon concretisering van " + goalCodeLabel(goal));
  var tip = el("span", "goal-tip");
  tip.appendChild(el("strong", null, goalCodeLabel(goal)));

  var plans = el("span", "tip-text");
  plans.textContent = goalPackages(goal).map(function (p) {
    return GOAL_PACKAGES[p].label + " · " + goal.codes[p];
  }).join("  |  ");
  tip.appendChild(plans);

  tip.appendChild(el("span", "tip-label", "Doel"));
  tip.appendChild(el("span", "tip-text", goal.text));
  if (goal.concretisering) {
    tip.appendChild(el("span", "tip-label",
      goal.concretiseringPer ? "Concretisering (" + GOAL_PACKAGES.TW.label + ")" : "Concretisering"));
    tip.appendChild(el("span", "tip-text", goal.concretisering));
  }
  if (goal.concretiseringPer) {
    Object.keys(goal.concretiseringPer).forEach(function (p) {
      tip.appendChild(el("span", "tip-label", "Concretisering (" + GOAL_PACKAGES[p].label + ")"));
      tip.appendChild(el("span", "tip-text", goal.concretiseringPer[p]));
    });
  }
  tip.appendChild(el("span", "tip-label", "Beheersingsniveau"));
  tip.appendChild(el("span", "tip-text", goal.bloom));
  info.appendChild(tip);
  // Op een tablet is er geen muisaanwijzer; tikken moet dus ook werken.
  info.addEventListener("click", function (e) {
    e.preventDefault();
    this.classList.toggle("open");
  });
  chip.appendChild(info);

  if (onRemove) {
    var rm = el("button", "goal-remove", "×");
    rm.type = "button";
    rm.title = "Koppeling verwijderen";
    rm.addEventListener("click", onRemove);
    chip.appendChild(rm);
  }
  return chip;
}
