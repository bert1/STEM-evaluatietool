/* Bouwt het ene HTML-bestand dat leerkrachten krijgen, rechtstreeks uit
   index.html: elke <link rel="stylesheet"> wordt een <style>-blok, en
   het blok <script src>-tags wordt één <script> met alles erin. Er is
   maar één HTML-bronbestand — index.html is dus niet "de dev-versie
   naast het echte bestand", het IS het bronbestand.
*/
const fs = require("fs");
const path = require("path");

const root = __dirname;
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// --- CSS: elke <link rel="stylesheet" href="css/x.css" /> inlinen ---
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)" \/>\n?/g, (full, href) => {
  const css = fs.readFileSync(path.join(root, href), "utf8");
  return "<style>\n" + css + "</style>\n";
});

// --- JS: het aaneengesloten blok <script src="..."></script>-tags
//     vervangen door één <script> met alle inhoud samengevoegd, in
//     dezelfde volgorde als index.html ze al oplijst. ---
const scriptBlock = /(?:^[ \t]*<script src="[^"]+"><\/script>\n?)+/m;
const match = html.match(scriptBlock);
if (!match) throw new Error("Geen <script src>-blok gevonden in index.html");

const srcPaths = [...match[0].matchAll(/<script src="([^"]+)">/g)].map((m) => m[1]);
if (!srcPaths.length) throw new Error("Geen scriptbestanden herkend");

let networkSyncData = "";
const netCfgPath = path.join(root, "..", "build", "networksync-config.json");
if (fs.existsSync(netCfgPath)) {
  const cfg = JSON.parse(fs.readFileSync(netCfgPath, "utf8"));
  networkSyncData = "\nvar NETWORK_SYNC = " + JSON.stringify(cfg, null, 2) + ";\n";
  console.log("Netwerksynchronisatie ingebakken naar:", cfg.url);
}

const js = srcPaths.map((p) => fs.readFileSync(path.join(root, p), "utf8")).join("\n\n") + networkSyncData;
if (/<\/script/i.test(js)) throw new Error("Samengevoegde JS bevat </script>");

html = html.replace(scriptBlock, () => "<script>\n" + js + "\n</script>\n");

// Structuurcontrole: mis-geneste tags worden door de browser stilzwijgend
// "gerepareerd", wat hele stukken van de pagina kan verplaatsen.
(function checkNesting(fullHtml) {
  const body = fullHtml.slice(fullHtml.indexOf("<body>") + 6, fullHtml.indexOf("</body>"));
  const stripped = body.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const voids = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(stripped))) {
    const [, closing, tag, selfClose] = m;
    if (voids.has(tag.toLowerCase()) || selfClose) continue;
    if (!closing) stack.push(tag);
    else {
      const open = stack.pop();
      if (open !== tag) throw new Error(`Tags kruisen elkaar: </${tag}> sluit terwijl <${open}> nog open staat`);
    }
  }
  if (stack.length) throw new Error("Niet gesloten tags: " + stack.join(", "));
  console.log("Structuurcontrole: alle tags netjes genest");
})(html);

const out = path.join("/mnt/user-data/outputs", "STEM-Evaluatietool.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

// De bestaande testreeks (15 bestanden, 900+ tests) verwijst naar deze
// vaste naam — dat moet zo blijven, anders moet elk testbestand mee
// veranderen bij elke versie-ophoging. De versie zit al zichtbaar ín de
// tool zelf (rechtsboven); de bestandsnaam hieronder is er puur voor het
// delen: zo zien collega's meteen welke versie ze hebben zonder de tool
// te moeten openen.
const versionMatch = js.match(/var APP_VERSION = "([^"]+)"/);
if (!versionMatch) throw new Error("APP_VERSION niet gevonden — kan geen versienummer in de bestandsnaam zetten");
const version = versionMatch[1];
const versionedOut = path.join("/mnt/user-data/outputs", `STEM-Evaluatietool-v${version}.html`);
fs.writeFileSync(versionedOut, html);

const studentsData = JSON.parse(js.match(/var STUDENTS = ([\s\S]*?);\n\nvar CONFIG/)[1]);
const config = JSON.parse(js.match(/var CONFIG = ([\s\S]*?);\n/)[1]);

console.log("Geschreven:", out);
console.log("Geschreven (met versienummer):", versionedOut);
console.log("Grootte:", (fs.statSync(out).size / 1024).toFixed(0) + " KB");
console.log(
  "Leerlingen:", Object.values(studentsData).reduce((n, v) => n + v.length, 0),
  "| Klassen:", Object.keys(studentsData).length,
  "| Criteria:", Object.values(config).reduce(
    (n, y) => n + Object.values(y.evaluations).reduce((m, r) => m + r.length, 0), 0,
  ),
);
