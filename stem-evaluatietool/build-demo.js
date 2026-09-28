/* Zelfde als build.js, maar met verzonnen klassen/rubrics/resultaten
   in plaats van de gewone lege installatie — voor de testomgeving die
   een leerkracht gebruikt om alles uit te proberen voor het schooljaar
   begint. Zie build.js voor uitleg bij de aanpak zelf. */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const demoDir = path.join(root, "..", "build"); // demo-withids.json/demo-seed.json staan daar nog
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)" \/>\n?/g, (full, href) => {
  const css = fs.readFileSync(path.join(root, href), "utf8");
  return "<style>\n" + css + "</style>\n";
});

const scriptBlock = /(?:^[ \t]*<script src="[^"]+"><\/script>\n?)+/m;
const match = html.match(scriptBlock);
if (!match) throw new Error("Geen <script src>-blok gevonden in index.html");
const srcPaths = [...match[0].matchAll(/<script src="([^"]+)">/g)].map((m) => m[1]);

// Demo-data vervangt de gewone data/*.js: fictieve klassen, rubrics en
// al ingevulde resultaten in plaats van een lege installatie.
const { studentsData, config } = JSON.parse(fs.readFileSync(path.join(demoDir, "demo-withids.json"), "utf8"));
const demoSeed = fs.readFileSync(path.join(demoDir, "demo-seed.json"), "utf8");
const demoData =
  "var STUDENTS = " + JSON.stringify(studentsData, null, 2) +
  ";\n\nvar CONFIG = " + JSON.stringify(config, null, 2) +
  ";\n\nvar IS_DEMO = true;" +
  "\n\nvar DEMO_SEED = " + demoSeed + ";\n";

const nonDataPaths = srcPaths.filter((p) => p !== "data/curriculum.js" && p !== "data/roster-seed.js");
const curriculum = fs.readFileSync(path.join(root, "data/curriculum.js"), "utf8");
const js = curriculum + "\n\n" + demoData + "\n\n" +
  nonDataPaths.map((p) => fs.readFileSync(path.join(root, p), "utf8")).join("\n\n");

if (/<\/script/i.test(js)) throw new Error("Samengevoegde JS bevat </script>");
html = html.replace(scriptBlock, () => "<script>\n" + js + "\n</script>\n");

// Titel en merknaam duidelijk als testomgeving markeren.
html = html
  .replace("<title>STEM Evaluatietool</title>", "<title>STEM Evaluatietool — TESTOMGEVING</title>")
  .replace(
    '<div class="brand">\n        STEM Evaluatietool <span class="app-version" id="appVersion"></span>\n        <small>Werkt offline · je gegevens blijven op dit toestel</small>\n      </div>',
    '<div class="brand">\n        STEM Evaluatietool <span style="color:#7c3aed">— test</span> <span class="app-version" id="appVersion"></span>\n        <small>Fictieve gegevens · niets hiervan is echt</small>\n      </div>',
  );

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

const out = path.join("/mnt/user-data/outputs", "STEM-Evaluatietool-TESTOMGEVING.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

const versionMatch = js.match(/var APP_VERSION = "([^"]+)"/);
if (!versionMatch) throw new Error("APP_VERSION niet gevonden — kan geen versienummer in de bestandsnaam zetten");
const version = versionMatch[1];
const versionedOut = path.join("/mnt/user-data/outputs", `STEM-Evaluatietool-TESTOMGEVING-v${version}.html`);
fs.writeFileSync(versionedOut, html);

console.log("Geschreven:", out);
console.log("Geschreven (met versienummer):", versionedOut);
console.log("Grootte:", (fs.statSync(out).size / 1024).toFixed(0) + " KB");
