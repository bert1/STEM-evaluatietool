const path = require("path");
const { expect } = require("@playwright/test");
const { nieuweSchijf, installeerSchijf } = require("./schijf");

const TOOL_URL = "file://" + path.join(__dirname, "..", "stem-evaluatietool", "dist", "STEM-Evaluatietool.html");

/* Opent de tool met een lege browseropslag en verzamelt JavaScript-fouten.
   Elke test controleert op het einde met expectNoErrors() dat er geen
   enkele fout was.

   Sinds 1.32.0 is koppelen verplicht: openTool() doorloopt de
   opstartwizard ("Ik gebruik de tool voor het eerst") en koppelt aan een
   nagemaakte gedeelde map (tests/schijf.js). page.schijf geeft toegang
   tot de bestanden in die map.
   Opties: koppel (false: de wizard blijft open), initialen, naam,
   schijf (een gedeelde map met een andere pagina), fsa (false: browser
   zonder File System Access API). */
async function openTool(page, { koppel = true, initialen = "TST", naam = "", schijf, fsa = true } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.expectNoErrors = () => expect(errors, "JavaScript-fouten in de tool").toEqual([]);
  page.schijf = schijf || nieuweSchijf();
  await installeerSchijf(page, page.schijf, { fsa });
  await page.goto(TOOL_URL);
  if (koppel) await koppelNieuw(page, { initialen, naam, fsa });
  return page;
}

/* De eerste weg van de wizard: initialen, naam, map kiezen, beginnen. */
async function koppelNieuw(page, { initialen = "TST", naam = "", fsa = true } = {}) {
  await expect(page.locator("#setupWizard")).toBeVisible();
  if (await page.locator("#wizardNew").isVisible()) await page.click("#wizardNew");
  if (!(await page.locator("#wizardInitials").getAttribute("readonly"))) await page.fill("#wizardInitials", initialen);
  if (naam) await page.fill("#wizardName", naam);
  if (fsa) {
    await page.click("#wizardPickFolder");
  } else {
    await Promise.all([page.waitForEvent("download"), page.click("#wizardDownload")]);
  }
  await expect(page.locator("#wizardFinish")).toBeEnabled();
  await page.click("#wizardFinish");
  await expect(page.locator("#setupWizard")).toBeHidden();
  await page.evaluate(() => (typeof writing !== "undefined" && writing) || null);
}

/* Een tweede toestel of een collega: een eigen browsercontext die
   dezelfde map deelt. */
async function tweedeToestel(browser, schijf, opties = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await openTool(page, { schijf, ...opties });
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

module.exports = { TOOL_URL, openTool, koppelNieuw, tweedeToestel, seedFolders, nieuweSchijf };
