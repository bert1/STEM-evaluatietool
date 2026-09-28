const path = require("path");
const { expect } = require("@playwright/test");

const TOOL_URL = "file://" + path.join(__dirname, "..", "stem-evaluatietool", "dist", "STEM-Evaluatietool.html");

/* Opent de tool met een lege browseropslag, slaat de opstartwizard over
   en verzamelt JavaScript-fouten. Elke test controleert op het einde met
   expectNoErrors() dat er geen enkele fout was. */
async function openTool(page, { skipWizard = true } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.expectNoErrors = () => expect(errors, "JavaScript-fouten in de tool").toEqual([]);
  await page.goto(TOOL_URL);
  if (skipWizard && (await page.isVisible("#wizardSkip"))) await page.click("#wizardSkip");
  return page;
}

/* Zet een map "September" en "Wetenschappelijk onderzoek" klaar in het
   1ste jaar, plus een evaluatie met accenten zonder map. */
async function seedFolders(page) {
  return page.evaluate(() => {
    const year = "1ste jaar";
    const names = evaluationNames(db, year);
    db.evaluations[year]["Crème brûlée proef"] = JSON.parse(JSON.stringify(db.evaluations[year][names[0]]));
    db.evaluations[year]["Crème brûlée proef"].folder = "";
    db.evaluationFolders[year] = [
      { name: "September", updatedAt: 1 },
      { name: "Wetenschappelijk onderzoek", updatedAt: 1 },
    ];
    names.forEach((n, i) => { db.evaluations[year][n].folder = i === 0 ? "September" : "Wetenschappelijk onderzoek"; });
    persist();
    return names;
  });
}

module.exports = { TOOL_URL, openTool, seedFolders };
