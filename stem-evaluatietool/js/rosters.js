/* ---- overgenomen uit ui.js ---- */



/* ------------------------------------------------------------------ */
/* Klaslijsten beheren                                                 */
/* ------------------------------------------------------------------ */

var parsedTable = null;

function openRoster() {
  if (!$("mapYear").options.length) {
    Object.keys(CONFIG).forEach(function (y) {
      $("mapYear").appendChild(new Option(y, y));
    });
  }
  renderRosterCurrent();
  fillMoveYearOptions();
  fillMoveFromKlasOptions();
  showView("roster");
}

/* ------------------------------------------------------------------
   LEERLING VAN KLAS VERANDEREN
   In de eerste weken van het schooljaar wisselen klasgroepen soms nog.
   Eén leerling verplaatsen zonder de volledige klaslijst opnieuw in te
   lezen — dat zou immers ook de andere, al correcte leerlingen
   overschrijven met wat op dat moment in het geplakte/ingelezen
   bestand staat. Werkt op db.roster[year][klas].students, net als de
   rest van dit bestand: geen aparte leerling-identiteit, gewoon de
   naam verplaatsen van de ene naar de andere lijst, met een nieuwe
   updatedAt op beide klassen zodat sync het meeneemt.
   ------------------------------------------------------------------ */

function fillMoveYearOptions() {
  var sel = $("moveYear");
  var prev = sel.value;
  sel.innerHTML = "";
  Object.keys(CONFIG).forEach(function (y) { sel.appendChild(new Option(y, y)); });
  if (prev && sel.querySelector('option[value="' + cssEscape(prev) + '"]')) sel.value = prev;
}

function fillMoveFromKlasOptions() {
  var year = $("moveYear").value;
  var sel = $("moveFromKlas");
  var prev = sel.value;
  sel.innerHTML = "";
  var classes = year ? classesFor(db, year) : [];

  if (!classes.length) {
    sel.appendChild(new Option("Nog geen klassen voor dit leerjaar", ""));
    sel.disabled = true;
  } else {
    sel.appendChild(new Option("Kies een klas", ""));
    classes.forEach(function (k) { sel.appendChild(new Option(k, k)); });
    sel.disabled = false;
  }
  if (prev && sel.querySelector('option[value="' + cssEscape(prev) + '"]')) sel.value = prev;
  fillMoveStudentOptions();
}

function fillMoveStudentOptions() {
  var year = $("moveYear").value;
  var klas = $("moveFromKlas").value;
  var sel = $("moveStudent");
  var prev = sel.value;
  sel.innerHTML = "";
  var names = klas
    ? studentsFor(db, year, klas).slice().sort(function (a, b) { return a.localeCompare(b, "nl"); })
    : [];

  if (!names.length) {
    sel.appendChild(new Option(klas ? "Geen leerlingen in deze klas" : "Kies eerst een klas", ""));
    sel.disabled = true;
  } else {
    sel.appendChild(new Option("Kies een leerling", ""));
    names.forEach(function (n) { sel.appendChild(new Option(n, n)); });
    sel.disabled = false;
  }
  if (prev && sel.querySelector('option[value="' + cssEscape(prev) + '"]')) sel.value = prev;
  fillMoveToKlasOptions();
}

function fillMoveToKlasOptions() {
  var year = $("moveYear").value;
  var fromKlas = $("moveFromKlas").value;
  var student = $("moveStudent").value;
  var sel = $("moveToKlas");
  var prev = sel.value;
  sel.innerHTML = "";
  var classes = year ? classesFor(db, year).filter(function (k) { return k !== fromKlas; }) : [];

  if (!student || !classes.length) {
    sel.appendChild(new Option("Kies eerst een leerling", ""));
    sel.disabled = true;
  } else {
    sel.appendChild(new Option("Kies de nieuwe klas", ""));
    classes.forEach(function (k) { sel.appendChild(new Option(k, k)); });
    sel.disabled = false;
  }
  if (prev && sel.querySelector('option[value="' + cssEscape(prev) + '"]')) sel.value = prev;
  updateMoveButton();
}

function updateMoveButton() {
  $("btnMoveStudent").disabled = !(
    $("moveYear").value && $("moveFromKlas").value && $("moveStudent").value && $("moveToKlas").value
  );
}

/* Verhuist alle opgeslagen evaluatierijen van deze leerling mee naar de
   nieuwe klas, voor élk evaluatiemoment van dit leerjaar (niet enkel het
   moment dat toevallig open staat).
   - Een rij die enkel deze leerling bevat (een individuele beoordeling)
     verhuist volledig: ze verdwijnt uit de sessie van de oude klas en
     komt terecht in de sessie van de nieuwe klas voor datzelfde
     evaluatiemoment.
   - Een rij met klasgenoten samen (groepswerk) kan niet zomaar verhuizen
     — de score is gedeeld met leerlingen die niet meeverhuizen. Die rij
     blijft dus zichtbaar/bewerkbaar bij de oorspronkelijke sessie, maar
     de klas van déze leerling in row.studentKlas wordt wel bijgewerkt
     naar de nieuwe klas, zodat resultaten, export en groeigrafiek haar
     of hem vanaf nu bij de nieuwe klas tellen.
   Rijen zonder row.studentKlas (van vóór 1.14.0) hadden altijd precies
   één echte klas per sessie — die klas wordt dan alsnog voor iedereen in
   de rij vastgelegd, vóór de klas van deze ene leerling verandert. */
function migrateStudentEvaluations(year, student, toKlas) {
  var now = Date.now();
  var movedRows = 0;
  var relabeledOnly = 0;

  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year) return;

    var list = db.sessions[key] || [];
    var i = 0;
    while (i < list.length) {
      var row = list[i];
      if ((row.students || []).indexOf(student) === -1) { i++; continue; }

      if (!row.studentKlas) {
        row.studentKlas = {};
        row.students.forEach(function (s) { row.studentKlas[s] = p.klas; });
      }
      row.studentKlas[student] = toKlas;
      row.updatedAt = now;

      if (row.students.length === 1) {
        list.splice(i, 1);
        var newKey = sessionKey(year, toKlas, p.evaluation);
        if (!db.sessions[newKey]) db.sessions[newKey] = [];
        db.sessions[newKey].push(row);
        movedRows++;
        continue; // lijst is korter geworden, i niet ophogen
      }

      relabeledOnly++;
      i++;
    }
  });

  return { movedRows: movedRows, relabeledOnly: relabeledOnly };
}

function moveStudentToClass() {
  if (isArchivedSchoolYear(db)) {
    showNotice(
      "warn", "Dit schooljaar is een archief",
      "Je bekijkt " + db.currentSchoolYear + ", maar werkt actief in " + db.activeSchoolYear +
        ". Kies het actieve schooljaar bovenaan om klaslijsten te kunnen wijzigen.",
    );
    return;
  }

  var year = $("moveYear").value;
  var fromKlas = $("moveFromKlas").value;
  var student = $("moveStudent").value;
  var toKlas = $("moveToKlas").value;
  if (!year || !fromKlas || !student || !toKlas || fromKlas === toKlas) return;

  var fromList = studentsFor(db, year, fromKlas);
  if (fromList.indexOf(student) === -1) {
    showNotice("warn", "Niet meer gevonden", student + " staat niet meer in " + fromKlas + ". De lijst is intussen gewijzigd.");
    fillMoveFromKlasOptions();
    return;
  }

  var alreadyThere = studentsFor(db, year, toKlas).indexOf(student) !== -1;

  var soloCount = 0, groupCount = 0;
  Object.keys(db.sessions || {}).forEach(function (key) {
    var p = parseSessionKey(key);
    if (p.year !== year) return;
    (db.sessions[key] || []).forEach(function (row) {
      if ((row.students || []).indexOf(student) === -1) return;
      if (row.students.length === 1) soloCount++; else groupCount++;
    });
  });

  var msg = student + ' van "' + fromKlas + '" naar "' + toKlas + '" verplaatsen?';
  if (alreadyThere) {
    msg += "\n\n" + student + " staat toevallig ook al in " + toKlas +
      " — die naam wordt niet nog eens toegevoegd, enkel uit " + fromKlas + " verwijderd.";
  }
  if (soloCount) {
    msg += "\n\n" + soloCount + " individuele evaluatie(s) verhuizen volledig mee naar " + toKlas + ".";
  }
  if (groupCount) {
    msg += "\n\n" + groupCount + " groepsevaluatie(s) samen met klasgenoten blijven zichtbaar bij de " +
      "oorspronkelijke sessie (de score is gedeeld met leerlingen die niet meeverhuizen), maar tellen " +
      "vanaf nu mee bij " + toKlas + " in de resultaten en de export.";
  }
  msg += "\n\nVergeet niet op te slaan in je bestand.";

  if (!confirm(msg)) return;

  var now = Date.now();
  db.roster[year][fromKlas].students = fromList.filter(function (s) { return s !== student; });
  db.roster[year][fromKlas].updatedAt = now;

  if (!alreadyThere) {
    db.roster[year][toKlas].students = studentsFor(db, year, toKlas).concat([student]);
  }
  db.roster[year][toKlas].updatedAt = now;

  var migrated = migrateStudentEvaluations(year, student, toKlas);

  persist();
  refreshAll();
  renderRosterCurrent();
  fillMoveFromKlasOptions();
  $("moveStudent").value = "";
  fillMoveStudentOptions();

  var detail = student + " staat voortaan in " + toKlas + " in plaats van " + fromKlas + ".";
  if (migrated.movedRows) {
    detail += " " + migrated.movedRows + " individuele evaluatie(s) zijn meeverhuisd.";
  }
  if (migrated.relabeledOnly) {
    detail += " " + migrated.relabeledOnly + " groepsevaluatie(s) tellen vanaf nu bij " + toKlas +
      ", maar blijven ook zichtbaar bij de oorspronkelijke sessie.";
  }

  showNotice("good", student + " verplaatst", detail);
}

function initMoveStudent() {
  fillMoveYearOptions();
  fillMoveFromKlasOptions();
  $("moveYear").addEventListener("change", fillMoveFromKlasOptions);
  $("moveFromKlas").addEventListener("change", fillMoveStudentOptions);
  $("moveStudent").addEventListener("change", fillMoveToKlasOptions);
  $("moveToKlas").addEventListener("change", updateMoveButton);
  $("btnMoveStudent").addEventListener("click", moveStudentToClass);
}

/* Per klas onthouden we of de leerlingenlijst opengeklapt staat, zodat
   die open blijft staan na een herrender (bv. na het verwijderen van
   een andere klas of een sync). Sleutel: "jaar||klas". */
var expandedRosterKlas = {};

function renderRosterCurrent() {
  var host = $("rosterCurrent");
  host.innerHTML = "";
  host.appendChild(el("label", null, "Wat er nu in de tool zit"));
  var hint = el("p", "hint", "Klik op een klas om te zien wie erin zit.");
  hint.style.marginTop = "0";
  host.appendChild(hint);

  Object.keys(CONFIG).forEach(function (year) {
    var list = classesFor(db, year);
    var block = el("div", null, null);
    block.style.marginBottom = "10px";

    var line = el("div", null, null);
    line.style.fontSize = "14px";
    line.appendChild(el("strong", null, year + ": "));
    if (!list.length) {
      line.appendChild(el("span", "chip", "geen klassen"));
    } else {
      var chips = el("span", "chips");
      chips.style.display = "inline-flex";
      list.forEach(function (klas) {
        var key = year + "||" + klas;
        var n = studentsFor(db, year, klas).length;
        var chip = el("span", "chip roster-klas-chip", klas + " (" + n + ")");
        chip.title = "Klik om de leerlingen van " + klas + " te tonen";
        if (expandedRosterKlas[key]) chip.classList.add("chip-open");
        chip.addEventListener("click", function () {
          expandedRosterKlas[key] = !expandedRosterKlas[key];
          renderRosterCurrent();
        });

        var cross = el("span", "chip-remove", "×");
        cross.title = 'Klas "' + klas + '" verwijderen';
        cross.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteClass(year, klas);
        });
        chip.appendChild(cross);
        chips.appendChild(chip);
      });
      line.appendChild(chips);
    }
    block.appendChild(line);

    list.forEach(function (klas) {
      var key = year + "||" + klas;
      if (!expandedRosterKlas[key]) return;
      var names = studentsFor(db, year, klas).slice().sort(function (a, b) { return a.localeCompare(b, "nl"); });
      var panel = el("div", "roster-student-list");
      panel.appendChild(el("strong", null, klas));
      panel.appendChild(el("div", "roster-student-names",
        names.length ? names.join(", ") : "Nog geen leerlingen in deze klas."));
      block.appendChild(panel);
    });

    host.appendChild(block);
  });
}

function onPasteChange() {
  var text = $("pasteArea").value;
  if (!text.trim()) {
    parsedTable = null;
    if (!xlsxClasses) $("mapper").classList.add("hidden");
    return;
  }
  xlsxClasses = null;
  $("columnFields").classList.remove("hidden");
  $("headerField").classList.remove("hidden");

  parsedTable = parseDelimited(text);
  if (parsedTable.length < 1) {
    $("mapper").classList.add("hidden");
    return;
  }

  var cols = parsedTable.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  var headers = parsedTable[0];

  ["mapClassCol", "mapNameCol", "mapName2Col"].forEach(function (id) {
    var sel = $(id);
    var prev = sel.value;
    sel.innerHTML = "";
    if (id === "mapName2Col") sel.appendChild(new Option("Geen", "-1"));
    for (var i = 0; i < cols; i++) {
      var label = "Kolom " + (i + 1);
      if (headers[i]) label += " — " + headers[i].slice(0, 22);
      sel.appendChild(new Option(label, String(i)));
    }
    if (prev !== "" && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
  });

  guessColumns(headers, cols);
  $("mapper").classList.remove("hidden");
  renderRosterPreview();
}



/* Raad de kolommen op basis van de titelrij. Fout raden mag —
   de gebruiker ziet het meteen in de voorbeeldweergave. */
function guessColumns(headers, cols) {
  var lower = headers.map(function (h) { return String(h || "").toLowerCase(); });

  var klasIdx = lower.findIndex(function (h) { return /klas|groep|class/.test(h); });
  var achterIdx = lower.findIndex(function (h) { return /achternaam|familienaam|naam$|^naam/.test(h) && !/voornaam/.test(h); });
  var voorIdx = lower.findIndex(function (h) { return /voornaam|firstname|first name/.test(h); });

  if (klasIdx !== -1) $("mapClassCol").value = String(klasIdx);
  else if (cols > 1) $("mapClassCol").value = "0";

  if (achterIdx !== -1) $("mapNameCol").value = String(achterIdx);
  else $("mapNameCol").value = String(cols > 1 ? 1 : 0);

  $("mapName2Col").value = voorIdx !== -1 ? String(voorIdx) : "-1";

  // Titelrij alleen aanvinken als de eerste rij ook echt op titels lijkt.
  var looksLikeHeader = klasIdx !== -1 || achterIdx !== -1 || voorIdx !== -1;
  $("mapHeader").checked = looksLikeHeader;
}

function currentMapping() {
  return {
    hasHeader: $("mapHeader").checked,
    classCol: parseInt($("mapClassCol").value, 10),
    nameCol: parseInt($("mapNameCol").value, 10),
    secondNameCol: parseInt($("mapName2Col").value, 10),
  };
}

function renderRosterPreview() {
  var host = $("rosterPreview");
  host.innerHTML = "";
  if (!parsedTable) return;

  var result = tableToClasses(parsedTable, currentMapping());
  var klassen = Object.keys(result.classes).sort();
  var total = klassen.reduce(function (n, k) { return n + result.classes[k].length; }, 0);

  if (!klassen.length) {
    var warn = el("div", "notice warn");
    warn.appendChild(el("strong", null, "Zo levert dit niets op"));
    warn.appendChild(document.createTextNode("Controleer of je de juiste kolommen gekozen hebt, en of de titelrij goed staat aangevinkt."));
    host.appendChild(warn);
    return;
  }

  var box = el("div", "notice info");
  box.appendChild(el("strong", null, klassen.length + " klas(sen), " + total + " leerlingen herkend"));

  var chips = el("div", "chips");
  chips.style.marginTop = "6px";
  klassen.forEach(function (k) {
    chips.appendChild(el("span", "chip", k + " (" + result.classes[k].length + ")"));
  });
  box.appendChild(chips);

  var biggest = klassen.slice().sort(function (x, y) {
    return result.classes[y].length - result.classes[x].length;
  })[0];
  var sample = result.classes[biggest].slice(0, 4).join(", ");
  var p = el("div", null, "Voorbeeld uit " + biggest + ": " + sample + (result.classes[biggest].length > 4 ? ", …" : ""));
  p.style.marginTop = "8px";
  p.style.fontSize = "13.5px";
  box.appendChild(p);

  if (result.skipped) {
    var s = el("div", null, result.skipped + " rij(en) overgeslagen omdat klas of naam leeg was.");
    s.style.marginTop = "6px";
    s.style.fontSize = "13px";
    box.appendChild(s);
  }

  host.appendChild(box);
}

function applyRoster(replaceYear) {
  if (isArchivedSchoolYear(db)) {
    showNotice(
      "warn", "Dit schooljaar is een archief",
      "Je bekijkt " + db.currentSchoolYear + ", maar werkt actief in " + db.activeSchoolYear +
        ". Kies het actieve schooljaar bovenaan om klaslijsten te kunnen wijzigen.",
    );
    return;
  }

  var year = $("mapYear").value;
  var result = pendingClasses();
  var klassen = Object.keys(result.classes);

  if (!klassen.length) {
    showNotice("warn", "Niets om toe te passen", "Er zijn geen klassen herkend in wat je geplakt hebt.");
    return;
  }

  var oldClasses = classesFor(db, year);
  var removed = replaceYear
    ? oldClasses.filter(function (k) { return klassen.indexOf(k) === -1; })
    : [];

  var msg = replaceYear
    ? "Alle klassen van " + year + " vervangen door " + klassen.length + " klas(sen)?" +
      (removed.length ? "\n\nDeze verdwijnen uit de keuzelijst: " + removed.join(", ") : "")
    : klassen.length + " klas(sen) van " + year + " bijwerken?\n\n" + klassen.join(", ");

  msg += "\n\nJe opgeslagen evaluaties blijven bewaard.";
  if (!confirm(msg)) return;

  if (!db.roster) db.roster = {};
  if (replaceYear || !db.roster[year]) db.roster[year] = {};

  var now = Date.now();
  klassen.forEach(function (klas) {
    db.roster[year][klas] = { students: result.classes[klas], updatedAt: now };
  });

  persist();
  refreshAll();

  showNotice(
    "good",
    "Klaslijsten bijgewerkt",
    klassen.length + " klas(sen) met " +
      klassen.reduce(function (n, k) { return n + result.classes[k].length; }, 0) +
      " leerlingen opgeslagen voor " + year + "." +
      (removed.length ? " Verwijderd: " + removed.join(", ") + "." : "") +
      " Vergeet niet op te slaan in je bestand.",
  );
  clearPending();
}

/* Eén klas verwijderen uit een leerjaar — met dezelfde beveiligingen als
   "Alle klaslijsten wissen": geblokkeerd in een archiefschooljaar, en een
   duidelijke waarschuwing als er al evaluaties aan hangen (die blijven
   bewaard, maar zijn pas weer te zien als de klas terugkomt). */
function deleteClass(year, klas) {
  if (isArchivedSchoolYear(db)) {
    showNotice(
      "warn", "Dit schooljaar is een archief",
      "Je bekijkt " + db.currentSchoolYear + ", maar werkt actief in " + db.activeSchoolYear +
        ". Kies het actieve schooljaar bovenaan om klaslijsten te kunnen wijzigen.",
    );
    return;
  }

  var studentCount = studentsFor(db, year, klas).length;
  var kept = Object.keys(db.sessions || {}).reduce(function (n, key) {
    var parsed = parseSessionKey(key);
    if (parsed.year === year && parsed.klas === klas) return n + db.sessions[key].length;
    return n;
  }, 0);

  var msg = 'Klas "' + klas + '" verwijderen uit ' + year + "?<br><br>" +
    studentCount + " leerling(en) verdwijnen uit de klaslijst.<br><br>";
  if (kept) {
    msg += "Er hangen " + kept + " opgeslagen evaluatie(s) aan. Die blijven bewaard, maar je kan er pas " +
      "weer bij zodra deze klas opnieuw in de lijst staat.";
  }

  askDeleteScope('Klas "' + klas + '" verwijderen?', [msg], function (scope) {
    delete db.roster[year][klas];
    delete expandedRosterKlas[year + "||" + klas];
    recordDeletion("roster", db.currentSchoolYear + "||" + year + "||" + klas, scope);
    persist();
    renderRosterCurrent();
    refreshAll();
    showNotice(
      "good", 'Klas "' + klas + '" verwijderd',
      scope === "iedereen"
        ? "Komt na synchroniseren ook bij collega's niet meer terug."
        : "Blijft enkel bij jou weg — collega's behouden hun eigen versie.",
    );
  });
}

function clearAllClasses() {
  if (isArchivedSchoolYear(db)) {
    showNotice(
      "warn", "Dit schooljaar is een archief",
      "Je bekijkt " + db.currentSchoolYear + ", maar werkt actief in " + db.activeSchoolYear +
        ". Kies het actieve schooljaar bovenaan om klaslijsten te kunnen wijzigen.",
    );
    return;
  }

  var years = Object.keys(CONFIG);
  var classCount = 0;
  var studentCount = 0;

  years.forEach(function (year) {
    classesFor(db, year).forEach(function (klas) {
      classCount++;
      studentCount += studentsFor(db, year, klas).length;
    });
  });

  if (!classCount) {
    showNotice("info", "Er staan al geen klaslijsten in", "Lees eerst je Smartschool-bestanden in.");
    return;
  }

  var kept = Object.keys(db.sessions || {}).reduce(function (n, key) {
    return n + db.sessions[key].length;
  }, 0);

  var msg =
    "Alle klaslijsten wissen?\n\n" +
    classCount + " klas(sen) met " + studentCount + " leerlingen verdwijnen uit alle leerjaren.\n\n";
  msg += kept
    ? "Je " + kept + " opgeslagen evaluatie(s) blijven bewaard, maar je kan er pas weer bij zodra de klas opnieuw in de lijst staat.\n\n"
    : "Er zijn nog geen opgeslagen evaluaties.\n\n";
  msg += "Dit kan je niet ongedaan maken. Weet je het zeker?";

  if (!confirm(msg)) return;

  db.roster = {};
  years.forEach(function (year) { db.roster[year] = {}; });

  persist();
  refreshAll();
  renderRosterCurrent();

  showNotice(
    "good",
    "Klaslijsten gewist",
    classCount + " klas(sen) verwijderd. Lees je nieuwe Smartschool-bestanden in om verder te gaan." +
      (kept ? " Je " + kept + " opgeslagen evaluatie(s) staan er nog." : "") +
      " Vergeet niet op te slaan in je bestand.",
  );
}

function onCsvFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (ev) {
    $("pasteArea").value = ev.target.result;
    $("pasteDetails").open = true;
    onPasteChange();
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
}



/* ------------------------------------------------------------------ */
/* Excel-bestanden uit Smartschool                                     */
/* ------------------------------------------------------------------ */

var xlsxClasses = null;

function onXlsxFiles(e) {
  var files = Array.prototype.slice.call(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;

  if (!XLSX_SUPPORTED) {
    showNotice(
      "warn",
      "Deze browser kan geen Excel-bestanden uitpakken",
      "Gebruik Chrome of Edge, of open je klaslijst in Excel en plak de namen via 'Of plakken vanuit Excel'.",
    );
    return;
  }

  $("xlsxHint").textContent = files.length + " bestand(en) lezen…";

  Promise.all(
    files.map(function (file) {
      return file
        .arrayBuffer()
        .then(readXlsx)
        .then(function (sheets) {
          return { file: file.name, sheets: sheets, error: null };
        })
        .catch(function (err) {
          return { file: file.name, sheets: [], error: err.message || "onleesbaar" };
        });
    }),
  ).then(function (results) {
    var classes = {};
    var problems = [];
    var sheetsSeen = 0;

    results.forEach(function (r) {
      if (r.error) { problems.push(r.file + " (" + r.error + ")"); return; }
      var usable = 0;
      r.sheets.forEach(function (sheet) {
        sheetsSeen++;
        var found = sheetToClass(sheet);
        if (!found) return;
        usable++;
        if (!classes[found.klas]) classes[found.klas] = [];
        found.students.forEach(function (s) {
          if (classes[found.klas].indexOf(s) === -1) classes[found.klas].push(s);
        });
      });
      if (!usable) problems.push(r.file + " (geen leerlingenlijst gevonden)");
    });

    Object.keys(classes).forEach(function (k) {
      classes[k].sort(function (a, b) { return a.localeCompare(b, "nl"); });
    });

    $("xlsxHint").textContent = "Meerdere klassen tegelijk mag — één bestand per klas.";

    if (!Object.keys(classes).length) {
      xlsxClasses = null;
      $("mapper").classList.add("hidden");
      showNotice(
        "warn",
        "Geen klaslijsten herkend",
        "Er moet een kolom met kop 'Leerling' of 'Naam' in staan. " +
          (problems.length ? "Problemen: " + problems.join(", ") + "." : "") +
          " Lukt het niet, plak de namen dan via 'Of plakken vanuit Excel'.",
      );
      return;
    }

    xlsxClasses = classes;
    parsedTable = null;
    $("pasteArea").value = "";
    showXlsxMapper(problems, sheetsSeen);
  });
}

function showXlsxMapper(problems, sheetsSeen) {
  // Bij Excel zijn de kolommen al bekend; alleen het leerjaar is nog een keuze.
  $("mapper").classList.remove("hidden");
  $("columnFields").classList.add("hidden");
  $("headerField").classList.add("hidden");
  renderXlsxPreview(problems, sheetsSeen);
}

function renderXlsxPreview(problems, sheetsSeen) {
  var host = $("rosterPreview");
  host.innerHTML = "";
  if (!xlsxClasses) return;

  var klassen = Object.keys(xlsxClasses).sort(function (a, b) {
    return a.localeCompare(b, "nl", { numeric: true });
  });
  var total = klassen.reduce(function (n, k) { return n + xlsxClasses[k].length; }, 0);

  var box = el("div", "notice good");
  box.appendChild(el("strong", null, klassen.length + " klas(sen), " + total + " leerlingen gelezen"));

  var chips = el("div", "chips");
  chips.style.marginTop = "6px";
  klassen.forEach(function (k) {
    chips.appendChild(el("span", "chip", k + " (" + xlsxClasses[k].length + ")"));
  });
  box.appendChild(chips);

  var biggest = klassen.slice().sort(function (x, y) {
    return xlsxClasses[y].length - xlsxClasses[x].length;
  })[0];
  var sample = el("div", null,
    "Voorbeeld uit " + biggest + ": " + xlsxClasses[biggest].slice(0, 4).join(", ") +
    (xlsxClasses[biggest].length > 4 ? ", …" : ""));
  sample.style.marginTop = "8px";
  sample.style.fontSize = "13.5px";
  box.appendChild(sample);

  host.appendChild(box);

  if (problems && problems.length) {
    var warn = el("div", "notice warn");
    warn.appendChild(el("strong", null, "Niet alles kon gelezen worden"));
    warn.appendChild(document.createTextNode(problems.join(", ") + "."));
    host.appendChild(warn);
  }

  // Leerjaar raden uit de klasnamen: 1Ba1 -> 1ste jaar, 2TWa -> 2de jaar
  var digits = klassen.map(function (k) { return (k.match(/\d/) || [""])[0]; });
  var first = digits.filter(function (d) { return d; })[0];
  var years = Object.keys(CONFIG);
  if (first) {
    var match = years.filter(function (y) { return y.indexOf(first) === 0; })[0];
    if (match) $("mapYear").value = match;
  }
}



/* Zowel geplakte tekst als ingelezen Excel komen hier samen uit. */
function pendingClasses() {
  if (xlsxClasses) return { classes: xlsxClasses, skipped: 0 };
  if (parsedTable) return tableToClasses(parsedTable, currentMapping());
  return { classes: {}, skipped: 0 };
}

function clearPending() {
  xlsxClasses = null;
  parsedTable = null;
  $("pasteArea").value = "";
  $("mapper").classList.add("hidden");
  $("columnFields").classList.remove("hidden");
  $("headerField").classList.remove("hidden");
  $("rosterPreview").innerHTML = "";
}

/* ---- overgenomen uit core.js ---- */



/* ------------------------------------------------------------------
   KLASLIJSTEN
   Staan in het werkbestand, niet in de HTML. Zo wissel je ze aan het
   begin van het schooljaar zonder de tool aan te raken.
   roster = { "1ste jaar": { "1WM": { students: [...], updatedAt: n } } }
   ------------------------------------------------------------------ */

function seedRoster(config, students) {
  var roster = {};
  Object.keys(config).forEach(function (year) {
    roster[year] = {};
    config[year].classes.forEach(function (klas) {
      roster[year][klas] = { students: (students[klas] || []).slice(), updatedAt: 0 };
    });
  });
  return roster;
}

function classesFor(db, year) {
  if (db.roster && db.roster[year]) {
    return Object.keys(db.roster[year]).sort(function (a, b) {
      return a.localeCompare(b, "nl", { numeric: true });
    });
  }
  return [];
}

function studentsFor(db, year, klas) {
  if (db.roster && db.roster[year] && db.roster[year][klas]) {
    return db.roster[year][klas].students || [];
  }
  return [];
}

/* Voor het Evalueren-scherm: leerlingen van meerdere klassen samen,
   nodig omdat een stem-les leerlingen van verschillende klasgroepen
   in dezelfde groep kan zetten. Eén leerlingnaam wordt maar één keer
   getoond (klasByName onthoudt bij welke klas die dan hoort, voor het
   klas-badge en voor de klas-per-leerling die mee opgeslagen wordt). */
function studentsForKlassen(db, year, klassen) {
  var seen = {};
  var names = [];
  (klassen || []).forEach(function (klas) {
    studentsFor(db, year, klas).forEach(function (name) {
      if (seen[name]) return;
      seen[name] = klas;
      names.push(name);
    });
  });
  names.sort(function (a, b) { return a.localeCompare(b, "nl"); });
  return { names: names, klasByName: seen };
}



/* Nieuwere klaslijst wint, net als bij de evaluatierijen. Werkt op een
   kaal roster-object (één schooljaar), niet op de hele db — zo kan
   mergeDb dit per schooljaar apart aanroepen. */
/* Nieuwere klaslijst wint — tenzij een tombstone zegt dat deze klas
   verwijderd is en de inkomende versie niet nieuwer is dan dat moment.
   "schoolYear" zit in de tombstone-sleutel: dezelfde klasnaam in een
   ander schooljaar is een heel andere klas, met eigen leerlingen. */
function mergeRoster(targetRoster, incomingRoster, schoolYear) {
  var changed = [];
  if (incomingRoster) {
    Object.keys(incomingRoster).forEach(function (year) {
      if (!targetRoster[year]) targetRoster[year] = {};
      Object.keys(incomingRoster[year]).forEach(function (klas) {
        var inc = incomingRoster[year][klas];
        var key = schoolYear + "||" + year + "||" + klas;
        if (isTombstoned("roster", key, inc.updatedAt)) return; // blijft verwijderd

        var cur = targetRoster[year][klas];
        if (!cur || (inc.updatedAt || 0) > (cur.updatedAt || 0)) {
          targetRoster[year][klas] = {
            students: (inc.students || []).slice(),
            updatedAt: inc.updatedAt || 0,
          };
          if (!cur) changed.push(klas + " (nieuw)");
          else if ((cur.students || []).join("|") !== (inc.students || []).join("|")) {
            changed.push(klas + " (bijgewerkt)");
          }
        }
      });
    });
  }

  // Zelf ook toepassen: een net binnengekomen tombstone ruimt onze
  // eigen, oudere kopie van deze klas meteen mee op.
  Object.keys(targetRoster).forEach(function (year) {
    Object.keys(targetRoster[year]).forEach(function (klas) {
      var key = schoolYear + "||" + year + "||" + klas;
      if (isTombstoned("roster", key, targetRoster[year][klas].updatedAt)) {
        delete targetRoster[year][klas];
      }
    });
  });

  return changed;
}



/* ------------------------------------------------------------------
   PLAKKEN VANUIT EXCEL
   Excel zet op het klembord tab-gescheiden tekst. Een CSV-bestand
   gebruikt meestal puntkomma's. Beide worden hier ondersteund.
   ------------------------------------------------------------------ */

function detectDelimiter(text) {
  var first = text.split(/\r?\n/).filter(function (l) { return l.trim(); })[0] || "";
  if (first.indexOf("\t") !== -1) return "\t";
  var semi = (first.match(/;/g) || []).length;
  var comma = (first.match(/,/g) || []).length;
  if (semi === 0 && comma === 0) return "\t";
  return semi >= comma ? ";" : ",";
}



/* Parser die aanhalingstekens respecteert, zoals Excel ze schrijft. */
function parseDelimited(text, delim) {
  delim = delim || detectDelimiter(text);
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  var i = 0;

  text = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  function endField() { row.push(field); field = ""; }
  function endRow() {
    endField();
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  }

  while (i < text.length) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field === "") { inQuotes = true; i++; continue; }
    if (c === delim) { endField(); i++; continue; }
    if (c === "\n") { endRow(); i++; continue; }
    field += c; i++;
  }
  endRow();

  return rows.map(function (r) {
    return r.map(function (v) { return v.trim(); });
  });
}



/* Zet een geplakte tabel om naar klaslijsten.
   opts: { hasHeader, classCol, nameCol, secondNameCol, fixedClass } */
function tableToClasses(rows, opts) {
  var out = {};
  var start = opts.hasHeader ? 1 : 0;
  var skipped = 0;

  for (var i = start; i < rows.length; i++) {
    var r = rows[i];
    if (!r || !r.length) continue;

    // Volledig lege rijen zijn geen fout, alleen witruimte. Niet melden.
    var blank = r.every(function (c) { return !String(c || "").trim(); });
    if (blank) continue;

    var klas = opts.fixedClass
      ? opts.fixedClass
      : (r[opts.classCol] || "").trim();

    var parts = [];
    var a = (r[opts.nameCol] || "").trim();
    if (a) parts.push(a);
    if (opts.secondNameCol !== null && opts.secondNameCol !== undefined && opts.secondNameCol !== -1) {
      var b = (r[opts.secondNameCol] || "").trim();
      if (b) parts.push(b);
    }
    var name = parts.join(" ").replace(/\s+/g, " ").trim();

    if (!klas || !name) { skipped++; continue; }
    if (!out[klas]) out[klas] = [];
    if (out[klas].indexOf(name) === -1) out[klas].push(name);
  }

  Object.keys(out).forEach(function (k) {
    out[k].sort(function (x, y) { return x.localeCompare(y, "nl"); });
  });

  return { classes: out, skipped: skipped };
}

/* ---- overgenomen uit xlsx.js ---- */

/* ------------------------------------------------------------------
   XLSX LEZEN ZONDER BIBLIOTHEEK

   Een .xlsx is een zip met XML erin. De browser kan allebei al:
   DecompressionStream pakt de zip uit, DOMParser leest de XML.
   Dat scheelt een megabyte aan meegeleverde code.
   ------------------------------------------------------------------ */

var XLSX_SUPPORTED = typeof DecompressionStream === "function";



/* --- zip ---------------------------------------------------------- */

function zipEntries(buffer) {
  var view = new DataView(buffer);
  var bytes = new Uint8Array(buffer);

  // Het "end of central directory"-blok staat achteraan, na een
  // commentaarveld van onbekende lengte. Dus achterstevoren zoeken.
  var eocd = -1;
  var minPos = Math.max(0, bytes.length - 66000);
  for (var i = bytes.length - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("Geen geldig zip-bestand");

  var count = view.getUint16(eocd + 10, true);
  var dirOffset = view.getUint32(eocd + 16, true);

  var entries = {};
  var p = dirOffset;
  for (var n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    var method = view.getUint16(p + 10, true);
    var compSize = view.getUint32(p + 20, true);
    var nameLen = view.getUint16(p + 28, true);
    var extraLen = view.getUint16(p + 30, true);
    var commentLen = view.getUint16(p + 32, true);
    var localOffset = view.getUint32(p + 42, true);
    var name = utf8(bytes.subarray(p + 46, p + 46 + nameLen));

    entries[name] = { method: method, compSize: compSize, localOffset: localOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { view: view, bytes: bytes, entries: entries };
}

function utf8(arr) {
  return new TextDecoder("utf-8").decode(arr);
}

function readEntry(zip, name) {
  var e = zip.entries[name];
  if (!e) return Promise.resolve(null);

  // De lokale header herhaalt naam- en extralengte, en die kunnen
  // afwijken van wat in de centrale directory staat.
  var lo = e.localOffset;
  if (zip.view.getUint32(lo, true) !== 0x04034b50) {
    return Promise.reject(new Error("Beschadigd zip-onderdeel: " + name));
  }
  var nameLen = zip.view.getUint16(lo + 26, true);
  var extraLen = zip.view.getUint16(lo + 28, true);
  var start = lo + 30 + nameLen + extraLen;
  var data = zip.bytes.subarray(start, start + e.compSize);

  if (e.method === 0) return Promise.resolve(utf8(data));
  if (e.method !== 8) return Promise.reject(new Error("Onbekende compressie in " + name));

  var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).arrayBuffer().then(function (buf) {
    return utf8(new Uint8Array(buf));
  });
}



/* --- xml ---------------------------------------------------------- */

function parseXml(text) {
  var doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Onleesbare XML in het Excel-bestand");
  }
  return doc;
}

function colIndex(ref) {
  // "AB12" -> 27
  var n = 0;
  for (var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}



/* --- werkblad omzetten naar een tabel ----------------------------- */

function sheetToTable(doc, sharedStrings) {
  var rows = [];
  var rowEls = doc.getElementsByTagName("row");

  for (var r = 0; r < rowEls.length; r++) {
    var cells = rowEls[r].getElementsByTagName("c");
    var out = [];
    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      var ref = cell.getAttribute("r");
      var idx = ref ? colIndex(ref) : out.length;
      var type = cell.getAttribute("t");
      var value = "";

      if (type === "inlineStr") {
        var ts = cell.getElementsByTagName("t");
        for (var k = 0; k < ts.length; k++) value += ts[k].textContent;
      } else {
        var v = cell.getElementsByTagName("v")[0];
        if (v) {
          value = v.textContent;
          if (type === "s") {
            var si = parseInt(value, 10);
            value = sharedStrings[si] !== undefined ? sharedStrings[si] : "";
          }
        }
      }

      while (out.length < idx) out.push("");
      out[idx] = String(value).trim();
    }
    rows.push(out);
  }
  return rows;
}

function readSharedStrings(doc) {
  var out = [];
  var sis = doc.getElementsByTagName("si");
  for (var i = 0; i < sis.length; i++) {
    // Opgemaakte tekst valt uiteen in meerdere <t>-stukken.
    var ts = sis[i].getElementsByTagName("t");
    var s = "";
    for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
    out.push(s);
  }
  return out;
}



/* --- hoofdfunctie ------------------------------------------------- */

/* Levert [{ sheetName, rows }] op, één item per tabblad. */
function readXlsx(arrayBuffer) {
  var zip = zipEntries(arrayBuffer);

  return Promise.all([
    readEntry(zip, "xl/workbook.xml"),
    readEntry(zip, "xl/_rels/workbook.xml.rels"),
    readEntry(zip, "xl/sharedStrings.xml"),
  ]).then(function (parts) {
    var wbXml = parts[0], relsXml = parts[1], sharedXml = parts[2];
    if (!wbXml) throw new Error("Dit lijkt geen Excel-bestand");

    var shared = sharedXml ? readSharedStrings(parseXml(sharedXml)) : [];

    var relMap = {};
    if (relsXml) {
      var rels = parseXml(relsXml).getElementsByTagName("Relationship");
      for (var i = 0; i < rels.length; i++) {
        relMap[rels[i].getAttribute("Id")] = rels[i].getAttribute("Target");
      }
    }

    var sheetEls = parseXml(wbXml).getElementsByTagName("sheet");
    var jobs = [];

    for (var s = 0; s < sheetEls.length; s++) {
      (function (elem, order) {
        var name = elem.getAttribute("name") || "Blad" + (order + 1);
        var rid =
          elem.getAttribute("r:id") ||
          elem.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        var target = relMap[rid] || "worksheets/sheet" + (order + 1) + ".xml";
        if (target.charAt(0) === "/") target = target.slice(1);
        else target = "xl/" + target.replace(/^\.\//, "");

        jobs.push(
          readEntry(zip, target).then(function (xml) {
            if (!xml) return null;
            return { sheetName: name, rows: sheetToTable(parseXml(xml), shared) };
          }),
        );
      })(sheetEls[s], s);
    }

    return Promise.all(jobs).then(function (sheets) {
      return sheets.filter(Boolean);
    });
  });
}



/* ------------------------------------------------------------------
   SMARTSCHOOL-LAYOUT HERKENNEN

   Boven de tabel staan een titel en de klastitularis, onder de tabel
   een regel met het aantal leerlingen. De klasnaam staat in de
   tabbladnaam, niet in een kolom.
   ------------------------------------------------------------------ */

var NAME_HEADER = /^(leerling|naam|leerlingen|achternaam|familienaam|naam leerling)$/i;

function findHeaderRow(rows) {
  for (var i = 0; i < Math.min(rows.length, 15); i++) {
    for (var c = 0; c < rows[i].length; c++) {
      if (NAME_HEADER.test(String(rows[i][c] || "").trim())) {
        return { row: i, nameCol: c };
      }
    }
  }
  return null;
}



/* Haalt de klasnaam uit de tabbladnaam, of anders uit een titelregel
   als "Klaslijst 1Ba1". */
function guessClassName(sheetName, rows) {
  var name = String(sheetName || "").trim();
  if (name && !/^blad|^sheet|^tabblad/i.test(name)) return name;

  for (var i = 0; i < Math.min(rows.length, 5); i++) {
    var first = String((rows[i] && rows[i][0]) || "");
    var m = first.match(/klaslijst\s+(\S+)/i);
    if (m) return m[1];
  }
  return name || "Onbekend";
}



/* Zet één tabblad om naar { klas, students }. Levert null bij twijfel. */
function sheetToClass(sheet) {
  var head = findHeaderRow(sheet.rows);
  if (!head) return null;

  var klas = guessClassName(sheet.sheetName, sheet.rows);
  var students = [];

  for (var i = head.row + 1; i < sheet.rows.length; i++) {
    var row = sheet.rows[i] || [];
    var value = String(row[head.nameCol] || "").trim();
    if (!value) continue;
    // Voetregels zoals "Aantal leerlingen: 27"
    if (/^aantal\s+leerlingen/i.test(value)) continue;
    if (students.indexOf(value) === -1) students.push(value);
  }

  if (!students.length) return null;
  students.sort(function (a, b) { return a.localeCompare(b, "nl"); });
  return { klas: klas, students: students };
}
