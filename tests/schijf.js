/* Een nagemaakte OneDrive-map voor de testen.

   De echte File System Access API werkt niet vanaf file:// in de
   testbrowser. Daarom krijgt elke pagina een nagemaakte
   window.showDirectoryPicker() waarvan de bestanden in Node bewaard
   worden, in een gewone Map. Zo kunnen twee browsercontexten (twee
   toestellen, of twee collega's) dezelfde map delen, net zoals
   OneDrive dat doet, en kan een test de bestanden rechtstreeks lezen,
   wijzigen of wissen.

   Ook IndexedDB wordt bijgestuurd: de tool onthoudt de gekozen map
   daar, maar een nagemaakte map kan de browser niet bewaren. Er wordt
   enkel het pad bewaard, en bij het teruglezen komt er een nieuwe
   nagemaakte map voor hetzelfde pad. Dit is testinfrastructuur, niets
   hiervan zit in de tool zelf. */

function nieuweSchijf() {
  const files = new Map(); // pad -> { text, lastModified }
  const dirs = new Set();
  let klok = 0;

  function ouders(pad) {
    const delen = pad.split("/");
    for (let i = 1; i < delen.length; i++) dirs.add(delen.slice(0, i).join("/"));
  }

  const schijf = {
    files,
    dirs,
    /* Elke schrijfactie krijgt een ander, later tijdstip, ook als twee
       pagina's dezelfde (vastgezette) klok hebben. */
    schrijf(pad, text, nu) {
      klok = Math.max(nu || Date.now(), klok + 1);
      ouders(pad);
      files.set(pad, { text, lastModified: klok });
    },
    maakMap(pad) { ouders(pad + "/x"); },
    wis(pad) {
      files.delete(pad);
      dirs.delete(pad);
      [...files.keys()].forEach((k) => { if (k.startsWith(pad + "/")) files.delete(k); });
      [...dirs].forEach((k) => { if (k.startsWith(pad + "/")) dirs.delete(k); });
    },
    lijst(pad) {
      const out = [];
      files.forEach((v, k) => {
        if (k.startsWith(pad + "/") && !k.slice(pad.length + 1).includes("/")) out.push({ kind: "file", name: k.slice(pad.length + 1) });
      });
      dirs.forEach((k) => {
        if (k.startsWith(pad + "/") && !k.slice(pad.length + 1).includes("/")) out.push({ kind: "directory", name: k.slice(pad.length + 1) });
      });
      return out;
    },
    /* Hulpjes voor de testen zelf. */
    tekst(pad) { const f = files.get(pad); return f ? f.text : null; },
    json(pad) { const f = files.get(pad); return f ? JSON.parse(f.text) : null; },
    zet(pad, inhoud) { schrijf(pad, typeof inhoud === "string" ? inhoud : JSON.stringify(inhoud), 0); },
    namen(map) { return schijf.lijst(map).filter((e) => e.kind === "file").map((e) => e.name).sort(); },
  };
  const schrijf = schijf.schrijf;
  return schijf;
}

/* Vóór page.goto() aanroepen. fsa: false maakt een browser zonder File
   System Access API (zoals Firefox of Safari). */
async function installeerSchijf(page, schijf, { fsa = true, mapNaam = "Gedeeld" } = {}) {
  await page.exposeFunction("__schijf", (op, pad, tekst, nu) => {
    if (op === "lees") return schijf.files.get(pad) || null;
    if (op === "schrijf") return schijf.schrijf(pad, tekst, nu), true;
    if (op === "isMap") return schijf.dirs.has(pad);
    if (op === "maakMap") return schijf.maakMap(pad), true;
    if (op === "wis") return schijf.wis(pad), true;
    if (op === "lijst") return schijf.lijst(pad);
    throw new Error("onbekend: " + op);
  });
  await page.addInitScript(({ fsa, mapNaam }) => {
    if (!fsa) {
      window.showDirectoryPicker = undefined;
      window.showSaveFilePicker = undefined;
      window.showOpenFilePicker = undefined;
      return;
    }
    const weg = () => new DOMException("niet gevonden", "NotFoundError");
    function bestand(pad) {
      return {
        kind: "file",
        name: pad.split("/").pop(),
        __nepPad: pad,
        async getFile() {
          const e = await window.__schijf("lees", pad);
          if (!e) throw weg();
          return { name: pad.split("/").pop(), lastModified: e.lastModified, size: e.text.length, text: async () => e.text };
        },
        async createWritable() {
          let buf = "";
          return {
            write: async (b) => { buf = typeof b === "string" ? b : await b.text(); },
            close: async () => { await window.__schijf("schrijf", pad, buf, Date.now()); },
          };
        },
        async isSameEntry(o) { return !!o && o.__nepPad === pad; },
      };
    }
    function map(pad) {
      return {
        kind: "directory",
        name: pad.split("/").pop(),
        __nepPad: pad,
        async getFileHandle(n, o = {}) {
          const p = pad + "/" + n;
          if (!(await window.__schijf("lees", p))) {
            if (!o.create) throw weg();
            await window.__schijf("schrijf", p, "", Date.now());
          }
          return bestand(p);
        },
        async getDirectoryHandle(n, o = {}) {
          const p = pad + "/" + n;
          if (!(await window.__schijf("isMap", p))) {
            if (!o.create) throw weg();
            await window.__schijf("maakMap", p);
          }
          return map(p);
        },
        async removeEntry(n) { await window.__schijf("wis", pad + "/" + n); },
        async *values() {
          const lijst = await window.__schijf("lijst", pad);
          for (const e of lijst) yield e.kind === "file" ? bestand(pad + "/" + e.name) : map(pad + "/" + e.name);
        },
        async queryPermission() { return window.__nepToestemming || "granted"; },
        async requestPermission() { return "granted"; },
        async isSameEntry(o) { return !!o && o.__nepPad === pad; },
      };
    }
    window.__nepMap = map;
    // De map die de "leerkracht" kiest; een test kan dit veranderen.
    window.__nepKeuze = mapNaam;
    window.showDirectoryPicker = async () => {
      if (window.__nepKeuze === "annuleren") throw new DOMException("geannuleerd", "AbortError");
      return map(window.__nepKeuze);
    };

    // IndexedDB kan een nagemaakte map niet bewaren: enkel het pad.
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (v, k) {
      if (v && v.__nepPad) v = { __nepPad: v.__nepPad, __nepSoort: v.kind };
      return put.call(this, v, k);
    };
    const res = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "result");
    Object.defineProperty(IDBRequest.prototype, "result", {
      configurable: true,
      get() {
        const r = res.get.call(this);
        if (r && r.__nepPad && r.__nepSoort) return r.__nepSoort === "file" ? bestand(r.__nepPad) : map(r.__nepPad);
        return r;
      },
    });
  }, { fsa, mapNaam });
}

module.exports = { nieuweSchijf, installeerSchijf };
