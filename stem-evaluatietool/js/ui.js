/* ---- overgenomen uit ui.js ---- */

var $ = function (id) { return document.getElementById(id); }

function el(tag, className, text) {
  var n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

/* Zelfgetekende zoek-vervolgkeuzelijst met mappen als koppen. Gebruikt
   door het evaluatiemoment bij Evalueren én de evaluatiekeuze bij
   Resultaten, zodat beide er exact hetzelfde uitzien en werken. De echte
   <select> (cfg.selectId) blijft volledig functioneel (waarde lezen,
   "change"-event, en dus ook voor tests) maar is onzichtbaar; dit paneel
   is wat een leerkracht ziet. Het paneel is absoluut gepositioneerd en
   opent dus altijd naar beneden, wat met een kale <select> niet kan.

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
    panel().classList.remove("hidden");
  }

  function close() {
    panel().classList.add("hidden");
    highlight = -1;
    input().value = select().value || "";
  }

  function render() {
    var p = panel();
    p.innerHTML = "";
    var needle = input().value.trim().toLowerCase();
    var flat = [];

    cfg.groups().forEach(function (g) {
      var matches = g.names.filter(function (n) { return !needle || n.toLowerCase().indexOf(needle) !== -1; });
      if (!matches.length) return;
      if (g.label) p.appendChild(el("div", "eval-combo-group", g.label));
      matches.forEach(function (name) {
        var row = el("div", "eval-combo-option" + (g.label ? " in-folder" : ""), name);
        row.dataset.value = name;
        row.addEventListener("mousedown", function (e) {
          e.preventDefault(); // voorkomt dat het invoerveld al "blurt" vóór de klik telt
          choose(name);
        });
        p.appendChild(row);
        flat.push(row);
      });
    });

    if (!flat.length) {
      p.appendChild(el(
        "div", "eval-combo-empty",
        needle
          ? "Geen evaluaties gevonden voor \"" + input().value.trim() + "\"."
          : cfg.emptyText,
      ));
    }

    if (highlight >= flat.length) highlight = flat.length - 1;
    updateHighlight(flat);
  }

  function updateHighlight(flat) {
    flat = flat || options();
    flat.forEach(function (row, i) { row.classList.toggle("highlight", i === highlight); });
    if (highlight >= 0 && flat[highlight]) flat[highlight].scrollIntoView({ block: "nearest" });
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
    } else if (e.key === "Escape") {
      if (isOpen()) { e.preventDefault(); close(); }
    }
  }

  function init() {
    input().addEventListener("focus", open);
    input().addEventListener("click", open);
    input().addEventListener("input", function () {
      highlight = -1;
      render();
      panel().classList.remove("hidden");
    });
    input().addEventListener("keydown", onKeydown);

    document.addEventListener("mousedown", function (e) {
      var wrap = $(cfg.wrapId);
      if (wrap && !wrap.contains(e.target) && isOpen()) close();
    });
  }

  return { init: init, sync: sync, open: open, close: close, render: render, choose: choose };
}
