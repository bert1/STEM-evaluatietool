/* Bestaand materiaal inlezen voor de AI-hulp, stand "omzetten" (1.27.0).
   De leerkracht kiest een oude evaluatiefiche of een stuk cursus (Excel,
   Word, PowerPoint of tekst), of plakt de tekst. De tool maakt er gewone
   tekst van, die mee in de prompt gaat. Er verlaat niets dit toestel:
   de leerkracht kopieert de prompt zelf naar een AI-gesprek.

   Excel, Word en PowerPoint zijn zip-bestanden met XML erin. Het
   uitpakken gebeurt met dezelfde functies als de klaslijsten
   (js/rosters.js: zipEntries, readEntry, readXlsx, parseXml). Een PDF of
   een oud .doc/.xls-bestand kan de browser niet lezen zonder een grote
   bibliotheek; daarvoor vraagt de tool om de tekst te kopiëren en te
   plakken. */

/* Vanaf hier toont de tool een tip om stukken weg te laten. Sommige
   AI-gesprekken aanvaarden een lange vraag niet. */
var SOURCE_LONG_CHARS = 30000;

var SOURCE_TEXT_TYPES = ["txt", "csv", "tsv", "md"];
var SOURCE_ZIP_TYPES = ["xlsx", "xlsm", "docx", "pptx"];

/* Eén cel of stukje tekst opschonen: invulstreepjes ("naam: ______")
   en dubbele spaties weg. */
function sourceCleanText(value) {
  return String(value == null ? "" : value)
    .replace(/_{3,}/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, " ")
    .trim();
}

/* "C7" -> { row: 7, col: 2 } */
function sourceCellRef(ref) {
  var m = String(ref || "").match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { col: colIndex(m[1]), row: parseInt(m[2], 10) };
}

/* Tekst van een cel die over meerdere kolommen loopt. De AI-prompt
   legt deze aanduiding uit (aiConvertRules in js/ai-rubric.js). */
function sourceSpanText(value, columns) {
  return columns > 1 ? value + " (over " + columns + " kolommen)" : value;
}

/* Een Excel-tabblad als tekst: één regel per rij, cellen gescheiden door
   " | ". Een samengevoegde cel over meerdere kolommen staat er één keer,
   met "(over 2 kolommen)" erachter: zo ziet de AI dat één omschrijving
   over twee niveaus loopt. Over meerdere rijen herhaalt de tekst zich in
   elke rij, zodat duidelijk is dat een fase (Oriënteren, Uitvoeren) bij
   al die rijen hoort. */
function xlsxSheetText(sheet) {
  var grid = {};
  var covered = {};
  var rowNumbers = sheet.rowNumbers || [];
  (sheet.rows || []).forEach(function (row, i) {
    grid[rowNumbers[i] || i + 1] = (row || []).map(sourceCleanText);
  });

  (sheet.merges || []).forEach(function (ref) {
    var parts = String(ref).split(":");
    var a = sourceCellRef(parts[0]);
    var b = sourceCellRef(parts[1] || parts[0]);
    if (!a || !b) return;
    var value = (grid[a.row] || [])[a.col] || "";
    for (var r = a.row; r <= b.row; r++) {
      if (!grid[r]) grid[r] = [];
      while (grid[r].length <= a.col) grid[r].push("");
      grid[r][a.col] = value ? sourceSpanText(value, b.col - a.col + 1) : "";
      for (var c = a.col + 1; c <= b.col; c++) covered[r + ":" + c] = true;
    }
  });

  var lines = [];
  Object.keys(grid)
    .map(Number)
    .sort(function (x, y) { return x - y; })
    .forEach(function (n) {
      var cells = grid[n].filter(function (v, c) { return !covered[n + ":" + c]; });
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (!cells.some(Boolean)) return;
      var line = cells.join(" | ");
      // Een samengevoegde cel over meerdere rijen (een titel) geeft
      // anders dezelfde regel twee keer.
      if (lines[lines.length - 1] === line) return;
      lines.push(line);
    });
  return lines.join("\n");
}

function xlsxSourceText(sheets) {
  var parts = sheets
    .map(function (s) { return { name: s.sheetName, text: xlsxSheetText(s) }; })
    .filter(function (s) { return s.text; });
  if (parts.length === 1) return parts[0].text;
  return parts.map(function (s) { return "Tabblad " + s.name + ":\n" + s.text; }).join("\n\n");
}

/* Directe kinderen met deze lokale naam (w:p, w:tr, …). */
function xmlChildren(node, localName) {
  var out = [];
  for (var i = 0; i < node.childNodes.length; i++) {
    var c = node.childNodes[i];
    if (c.nodeType === 1 && c.localName === localName) out.push(c);
  }
  return out;
}

/* Alle tekst onder een knoop, met tabs en regeleinden als spatie. */
function xmlRunText(node) {
  var out = "";
  (function walk(n) {
    for (var i = 0; i < n.childNodes.length; i++) {
      var c = n.childNodes[i];
      if (c.nodeType !== 1) continue;
      if (c.localName === "t") out += c.textContent;
      else if (c.localName === "tab" || c.localName === "br" || c.localName === "cr") out += " ";
      else walk(c);
    }
  })(node);
  return sourceCleanText(out);
}

/* Een Word-document als tekst: alinea's als regels, tabellen als rijen
   met " | " tussen de cellen. Een cel over meerdere kolommen (gridSpan)
   krijgt "(over 2 kolommen)", net als bij Excel. */
function docxSourceText(xml) {
  var doc = parseXml(xml);
  var body = doc.getElementsByTagNameNS("*", "body")[0] || doc.documentElement;
  var lines = [];

  function cellText(tc) {
    return xmlChildren(tc, "p").map(xmlRunText).filter(Boolean).join(" ");
  }

  (function walk(node) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType !== 1) continue;
      if (c.localName === "p") {
        var t = xmlRunText(c);
        if (t) lines.push(t);
      } else if (c.localName === "tbl") {
        xmlChildren(c, "tr").forEach(function (tr) {
          var cells = [];
          xmlChildren(tr, "tc").forEach(function (tc) {
            var text = cellText(tc);
            var span = tc.getElementsByTagNameNS("*", "gridSpan")[0];
            var n = span ? parseInt(span.getAttribute("w:val"), 10) || 1 : 1;
            cells.push(text ? sourceSpanText(text, n) : "");
          });
          while (cells.length && !cells[cells.length - 1]) cells.pop();
          if (cells.some(Boolean)) lines.push(cells.join(" | "));
        });
        lines.push("");
      } else if (c.localName === "sdt" || c.localName === "sdtContent") {
        walk(c);
      }
    }
  })(body);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* Een PowerPoint als tekst: per dia de alinea's. */
function pptxSlideText(xml) {
  var doc = parseXml(xml);
  var ps = doc.getElementsByTagNameNS("*", "p");
  var lines = [];
  for (var i = 0; i < ps.length; i++) {
    if (ps[i].namespaceURI && !/drawingml/.test(ps[i].namespaceURI)) continue;
    var t = xmlRunText(ps[i]);
    if (t) lines.push(t);
  }
  return lines.join("\n");
}

function pptxSourceText(zip) {
  var slides = Object.keys(zip.entries)
    .map(function (name) {
      var m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return m ? { name: name, nr: parseInt(m[1], 10) } : null;
    })
    .filter(Boolean)
    .sort(function (a, b) { return a.nr - b.nr; });
  return Promise.all(slides.map(function (s) { return readEntry(zip, s.name); })).then(function (xmls) {
    return xmls
      .map(function (xml, i) {
        var text = xml ? pptxSlideText(xml) : "";
        return text ? "Dia " + slides[i].nr + ":\n" + text : "";
      })
      .filter(Boolean)
      .join("\n\n");
  });
}

function sourceExtension(name) {
  var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

/* Leest één bestand en geeft een Promise met de tekst. Bij een type dat
   de tool niet kan lezen: een fout met uitleg voor de leerkracht. */
function readSourceFile(file) {
  var ext = sourceExtension(file.name);
  if (SOURCE_TEXT_TYPES.indexOf(ext) !== -1) {
    return file.text().then(function (t) { return String(t).replace(/\r\n?/g, "\n").trim(); });
  }
  if (SOURCE_ZIP_TYPES.indexOf(ext) === -1) {
    var what = ext === "pdf" ? "Een PDF" : ext ? "Een ." + ext + "-bestand" : "Dit bestand";
    return Promise.reject(new Error(
      what + " kan de tool niet lezen. Open het, selecteer alles (Ctrl+A), kopieer (Ctrl+C) en plak de tekst in het vak.",
    ));
  }
  if (!XLSX_SUPPORTED) {
    return Promise.reject(new Error("Deze browser kan dit bestand niet uitpakken. Gebruik Chrome of Edge, of plak de tekst in het vak."));
  }
  return file.arrayBuffer().then(function (buf) {
    if (ext === "xlsx" || ext === "xlsm") return readXlsx(buf).then(xlsxSourceText);
    var zip = zipEntries(buf);
    if (ext === "pptx") return pptxSourceText(zip);
    return readEntry(zip, "word/document.xml").then(function (xml) {
      if (!xml) throw new Error("Dit lijkt geen Word-bestand.");
      return docxSourceText(xml);
    });
  });
}

/* ---- scherm ---- */

function updateAiSourceHint() {
  var n = $("aiSource").value.length;
  var hint = $("aiSourceLength");
  if (n > SOURCE_LONG_CHARS) {
    hint.textContent = "De tekst is lang (" + n.toLocaleString("nl-BE") + " tekens). Laat stukken weg die niet over deze " +
      "opdracht gaan. Sommige AI-gesprekken aanvaarden zo'n lange vraag niet.";
    hint.classList.remove("hidden");
  } else {
    hint.textContent = "";
    hint.classList.add("hidden");
  }
}

function onAiSourceFiles(e) {
  var files = Array.prototype.slice.call(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;
  $("aiSourceState").innerHTML = "";

  Promise.all(files.map(function (file) {
    return readSourceFile(file).then(
      function (text) { return { name: file.name, text: text, error: "" }; },
      function (err) { return { name: file.name, text: "", error: (err && err.message) || "onleesbaar" }; },
    );
  })).then(function (results) {
    var read = results.filter(function (r) { return !r.error && r.text; });
    var empty = results.filter(function (r) { return !r.error && !r.text; });
    var failed = results.filter(function (r) { return r.error; });

    var field = $("aiSource");
    var blocks = read.map(function (r) { return "[Bestand: " + r.name + "]\n" + r.text; });
    if (blocks.length) {
      var current = field.value.replace(/\s+$/, "");
      field.value = (current ? current + "\n\n" : "") + blocks.join("\n\n");
    }
    updateAiSourceHint();

    var problems = failed.map(function (r) { return r.name + ": " + r.error; })
      .concat(empty.map(function (r) { return r.name + ": geen tekst gevonden."; }));
    if (!read.length) {
      showNoticeIn("aiSourceState", "warn", "Niets ingelezen", problems.join(" "));
    } else {
      showNoticeIn(
        "aiSourceState", problems.length ? "warn" : "good",
        read.length === 1 ? "1 bestand ingelezen" : read.length + " bestanden ingelezen",
        "Kijk de tekst hieronder na. Je mag stukken weglaten of aanpassen." + (problems.length ? " " + problems.join(" ") : ""),
      );
    }
  });
}

function initAiSource() {
  $("btnAiSourceFile").addEventListener("click", function () { $("aiSourceFile").click(); });
  $("aiSourceFile").addEventListener("change", onAiSourceFiles);
  $("aiSource").addEventListener("input", updateAiSourceHint);
}
