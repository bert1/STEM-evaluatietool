/* ---- overgenomen uit ui.js ---- */

var $ = function (id) { return document.getElementById(id); }

function el(tag, className, text) {
  var n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

/* Klembord: eerst de moderne manier, anders de oude met een verborgen
   tekstvak (werkt ook als de browser navigator.clipboard weigert). Eén
   plek, gebruikt door Kopieer tabel, de AI-rubriekhulp en Skore. */
function copyText(text, onDone, onFail) {
  function fallback() {
    if (legacyCopy(text)) { if (onDone) onDone(); } else if (onFail) onFail();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { if (onDone) onDone(); }, fallback);
  } else {
    fallback();
  }
}

function legacyCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  var okCopy = false;
  try { okCopy = document.execCommand("copy"); } catch (e) { okCopy = false; }
  document.body.removeChild(ta);
  return okCopy;
}

/* Korte bevestiging onderaan het scherm, die vanzelf verdwijnt. Handig
   waar een melding bovenaan buiten beeld zou vallen (lange tabellen). */
var toastTimer = null;
function showToast(text, kind) {
  var t = $("toast");
  if (!t) {
    t = el("div", "toast");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = "toast" + (kind ? " " + kind : ""); }, 3000);
}

/* Zoeksleutel: kleine letters, zonder accenten en met enkele spaties,
   zodat "creme" ook "Crème" vindt en "  proef" ook "Proef". */
function searchKey(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Zelfgetekende zoek-vervolgkeuzelijst met mappen als koppen. Gebruikt
   door het evaluatiemoment bij Evalueren én de evaluatiekeuze bij
   Resultaten, zodat beide er exact hetzelfde uitzien en werken. De echte
   <select> (cfg.selectId) blijft volledig functioneel (waarde lezen,
   "change"-event, en dus ook voor tests) maar is onzichtbaar; dit paneel
   is wat een leerkracht ziet. Het paneel is absoluut gepositioneerd en
   opent dus altijd naar beneden, wat met een kale <select> niet kan.

   Zoeken negeert hoofdletters en accenten, en vindt ook mapnamen: typ
   "september" en je ziet alle evaluaties uit die map. Staat er maar één
   resultaat, dan kiest Enter dat meteen.

   Voor schermlezers volgt het het ARIA-patroon "combobox met listbox":
   het invoerveld houdt de focus, aria-activedescendant wijst naar de
   gemarkeerde optie.

   cfg: inputId, panelId, selectId, wrapId,
        groups()        -> [{label, names}], label "" = geen kop
        isEnabled()     -> true/false
        placeholder, disabledPlaceholder, emptyText */
function makeSearchCombo(cfg) {
  var highlight = -1;

  function input() { return $(cfg.inputId); }
  function panel() { return $(cfg.panelId); }
  function select() { return $(cfg.selectId); }
  function isOpen() { return !panel().classList.contains("hidden"); }
  function options() {
    return Array.prototype.slice.call(panel().querySelectorAll(".eval-combo-option"));
  }

  function showPanel(show) {
    panel().classList.toggle("hidden", !show);
    input().setAttribute("aria-expanded", show ? "true" : "false");
  }

  function sync() {
    var enabled = cfg.isEnabled();
    input().disabled = !enabled;
    input().placeholder = enabled ? cfg.placeholder : cfg.disabledPlaceholder;
    if (document.activeElement !== input()) input().value = select().value || "";
    if (isOpen()) render();
  }

  function open() {
    if (input().disabled) return;
    // Altijd met een schone lei beginnen om te zoeken; de huidige keuze
    // blijft intussen gewoon geselecteerd, enkel de weergave wordt leeg.
    input().value = "";
    highlight = -1;
    render();
    showPanel(true);
  }

  function close() {
    showPanel(false);
    highlight = -1;
    input().removeAttribute("aria-activedescendant");
    input().value = select().value || "";
  }

  function render() {
    var p = panel();
    p.innerHTML = "";
    var needle = searchKey(input().value);
    var current = select().value;
    var flat = [];

    cfg.groups().forEach(function (g, gi) {
      // Past de mapnaam zelf bij het zoekwoord, dan tonen we de hele map.
      var folderMatch = !!(needle && g.label && searchKey(g.label).indexOf(needle) !== -1);
      var matches = g.names.filter(function (n) {
        return !needle || folderMatch || searchKey(n).indexOf(needle) !== -1;
      });
      if (!matches.length) return;

      var section = el("div", "eval-combo-section");
      var parent = section;
      if (g.label) {
        var headId = cfg.panelId + "-g" + gi;
        var head = el("div", "eval-combo-group", g.label);
        head.id = headId;
        head.setAttribute("role", "presentation");
        section.appendChild(head);
        parent = el("div", "eval-combo-items");
        parent.setAttribute("role", "group");
        parent.setAttribute("aria-labelledby", headId);
        section.appendChild(parent);
      }
      matches.forEach(function (name) {
        var row = el("div", "eval-combo-option" + (g.label ? " in-folder" : ""), name);
        row.dataset.value = name;
        row.id = cfg.panelId + "-o" + flat.length;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", name === current ? "true" : "false");
        if (name === current) row.classList.add("current");
        row.addEventListener("mousedown", function (e) {
          e.preventDefault(); // voorkomt dat het invoerveld al "blurt" vóór de klik telt
          choose(name);
        });
        parent.appendChild(row);
        flat.push(row);
      });
      p.appendChild(section);
    });

    if (!flat.length) {
      p.appendChild(el(
        "div", "eval-combo-empty",
        needle
          ? "Geen evaluaties of mappen gevonden voor \"" + input().value.trim() + "\"."
          : cfg.emptyText,
      ));
    }

    if (highlight >= flat.length) highlight = flat.length - 1;
    updateHighlight(flat);
  }

  function updateHighlight(flat) {
    flat = flat || options();
    flat.forEach(function (row, i) { row.classList.toggle("highlight", i === highlight); });
    if (highlight >= 0 && flat[highlight]) {
      input().setAttribute("aria-activedescendant", flat[highlight].id);
      flat[highlight].scrollIntoView({ block: "nearest" });
    } else {
      input().removeAttribute("aria-activedescendant");
    }
  }

  function choose(name) {
    select().value = name;
    select().dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }

  function onKeydown(e) {
    var flat;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen()) { open(); return; }
      flat = options();
      if (!flat.length) return;
      var step = e.key === "ArrowDown" ? 1 : -1;
      highlight = (highlight + step + flat.length) % flat.length;
      updateHighlight(flat);
    } else if (e.key === "Enter") {
      if (!isOpen()) return;
      e.preventDefault();
      flat = options();
      if (highlight >= 0 && flat[highlight]) choose(flat[highlight].dataset.value);
      else if (flat.length === 1) choose(flat[0].dataset.value);
    } else if (e.key === "Escape") {
      if (isOpen()) { e.preventDefault(); close(); }
    }
  }

  function init() {
    var inp = input();
    inp.setAttribute("role", "combobox");
    inp.setAttribute("aria-autocomplete", "list");
    inp.setAttribute("aria-controls", cfg.panelId);
    inp.setAttribute("aria-expanded", "false");
    panel().setAttribute("role", "listbox");

    inp.addEventListener("focus", open);
    inp.addEventListener("click", open);
    inp.addEventListener("input", function () {
      highlight = -1;
      render();
      showPanel(true);
    });
    inp.addEventListener("keydown", onKeydown);

    document.addEventListener("mousedown", function (e) {
      var wrap = $(cfg.wrapId);
      if (wrap && !wrap.contains(e.target) && isOpen()) close();
    });
  }

  return { init: init, sync: sync, open: open, close: close, render: render, choose: choose };
}
