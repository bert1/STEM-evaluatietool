/* ------------------------------------------------------------------
   HELP (sinds 1.34.0)

   Instellingen, Help toont de handleiding: README.md uit de hoofdmap van
   de repository. build.js plakt die bij elke build letterlijk in
   <script type="text/markdown" id="handleidingBron">, dus de Help is
   altijd dezelfde tekst als de README. Een test bewaakt dat. In de losse
   ontwikkelversie (index.html) is dat blok leeg.

   renderMarkdown() kent enkel wat de README gebruikt: koppen, alinea's,
   lijsten (ook genest), tabellen, citaten, een lijn, codeblokken, vet,
   code en links. Het hoofdstuk "Voor ontwikkelaars" en alles erna blijft
   weg: dat is niet voor leerkrachten. Links naar een kop (#...) springen
   binnen de Help; links naar bestanden worden gewone tekst, want die
   bestanden staan niet naast de tool.
   ------------------------------------------------------------------ */

var HELP_STOP_HEADING = /Voor ontwikkelaars/;

function helpEscape(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Zoals GitHub de id van een kop maakt: kleine letters, leestekens weg,
   spaties worden streepjes. */
function helpSlug(text) {
  return String(text)
    .replace(/[`*]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

function helpInline(text) {
  var parts = String(text).split(/(`[^`]*`)/);
  return parts.map(function (p) {
    if (/^`[^`]*`$/.test(p)) return "<code>" + helpEscape(p.slice(1, -1)) + "</code>";
    var s = helpEscape(p);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, label, href) {
      if (href.charAt(0) === "#") return '<a href="' + href + '" data-help-link="' + href.slice(1) + '">' + label + "</a>";
      return label;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return s;
  }).join("")
    // Een link rond code: [`bestand`](pad) wordt hierboven niet herkend.
    .replace(/\[(<code>[^<]*<\/code>)\]\([^)]+\)/g, "$1");
}

/* Na een lege regel: een ingesprongen punt, of een punt van dezelfde
   soort als de buitenste lijst (genummerde stappen lopen door). */
function continuesList(next, stack) {
  var m = /^(\s*)([-*]|\d+\.)\s+/.exec(next);
  if (!m || !stack.length) return false;
  if (m[1].length > 0) return true;
  return (/\d/.test(m[2]) ? "ol" : "ul") === stack[0].tag;
}

function renderMarkdown(md) {
  var lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  var out = [];
  var i = 0;

  function isBlockStart(l) {
    return /^#{1,6}\s/.test(l) || /^\s*([-*]|\d+\.)\s+/.test(l) || /^>/.test(l) || /^\|/.test(l) || /^```/.test(l) || /^---\s*$/.test(l);
  }

  while (i < lines.length) {
    var line = lines[i];

    if (!line.trim()) { i++; continue; }

    var h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      if (HELP_STOP_HEADING.test(h[2])) break;
      var level = h[1].length;
      out.push("<h" + level + ' id="' + helpSlug(h[2]) + '">' + helpInline(h[2]) + "</h" + level + ">");
      i++;
      continue;
    }

    if (/^---\s*$/.test(line)) { out.push("<hr />"); i++; continue; }

    if (/^```/.test(line)) {
      var code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push("<pre><code>" + helpEscape(code.join("\n")) + "</code></pre>");
      continue;
    }

    if (/^>/.test(line)) {
      var quote = [];
      while (i < lines.length && /^>/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push("<blockquote>" + renderMarkdown(quote.join("\n")) + "</blockquote>");
      continue;
    }

    if (/^\|/.test(line)) {
      var rowsMd = [];
      while (i < lines.length && /^\|/.test(lines[i])) rowsMd.push(lines[i++]);
      var cells = function (r) { return r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); }); };
      var html = "<table><thead><tr>" + cells(rowsMd[0]).map(function (c) { return "<th>" + helpInline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
      rowsMd.slice(2).forEach(function (r) {
        html += "<tr>" + cells(r).map(function (c) { return "<td>" + helpInline(c) + "</td>"; }).join("") + "</tr>";
      });
      out.push(html + "</tbody></table>");
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      // Lijsten: een stapel van open lijsten, volgens het inspringen.
      var stack = [];
      var html2 = "";
      // De tekst van een punt eerst volledig verzamelen: vet of een link
      // kan over twee regels lopen.
      var itemText = null;
      var flush = function () {
        if (itemText !== null) html2 += helpInline(itemText);
        itemText = null;
      };
      while (i < lines.length) {
        var l = lines[i];
        var m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
        if (m) {
          flush();
          var indent = m[1].length;
          var tag = /\d/.test(m[2]) ? "ol" : "ul";
          while (stack.length && indent < stack[stack.length - 1].indent) {
            html2 += "</li></" + stack.pop().tag + ">";
          }
          var top = stack[stack.length - 1];
          if (!top || indent > top.indent) {
            stack.push({ indent: indent, tag: tag });
            var start = tag === "ol" ? parseInt(m[2], 10) : 1;
            html2 += "<" + tag + (start > 1 ? ' start="' + start + '"' : "") + ">";
          } else {
            html2 += "</li>";
          }
          html2 += "<li>";
          itemText = m[3];
          i++;
        } else if (l.trim() && /^\s+/.test(l) && stack.length) {
          itemText = (itemText === null ? "" : itemText + " ") + l.trim();
          i++;
        } else if (!l.trim() && i + 1 < lines.length && continuesList(lines[i + 1], stack)) {
          // Een lege regel binnen een lijst: het volgende punt hoort erbij.
          i++;
        } else {
          break;
        }
      }
      flush();
      while (stack.length) html2 += "</li></" + stack.pop().tag + ">";
      out.push(html2);
      continue;
    }

    var para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim());
    out.push("<p>" + helpInline(para.join(" ")) + "</p>");
  }
  return out.join("\n");
}

/* In de inhoudstafel verwijst de README ook naar het hoofdstuk voor
   ontwikkelaars; dat staat niet in de Help. */
function removeDeadHelpLinks(host) {
  Array.prototype.forEach.call(host.querySelectorAll("a[data-help-link]"), function (a) {
    if (document.getElementById(a.getAttribute("data-help-link"))) return;
    var li = a.closest("li");
    if (li) li.parentNode.removeChild(li);
    else a.replaceWith(document.createTextNode(a.textContent));
  });
}

var helpRendered = false;

function openHelp() {
  var host = $("helpContent");
  if (!helpRendered) {
    var src = $("handleidingBron");
    var md = src ? src.textContent : "";
    if (md.trim()) {
      host.innerHTML = renderMarkdown(md);
      removeDeadHelpLinks(host);
    } else {
      host.innerHTML = "";
      host.appendChild(el("p", "hint", "De handleiding staat in het gebouwde bestand (STEM-Evaluatietool-vX.Y.Z.html) en in README.md."));
    }
    helpRendered = true;
  }
  showView("help");
}

function initHelp() {
  $("btnSettingsHelp").addEventListener("click", openHelp);
  $("btnCloseHelp").addEventListener("click", goHome);
  $("helpContent").addEventListener("click", function (e) {
    var a = e.target.closest("a[data-help-link]");
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById(a.getAttribute("data-help-link"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
