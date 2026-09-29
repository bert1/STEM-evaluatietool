/* Proef A1: de risico's van 1.31.1 naspelen met twee browsercontexten
   die dezelfde (nagemaakte) OneDrive-map delen. Tijdelijk bestand. */
const { test, expect } = require("@playwright/test");
const { TOOL_URL } = require("./helpers");
const { nieuweSchijf, installeerSchijf } = require("./schijf");

async function toestel(browser, schijf) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await installeerSchijf(page, schijf);
  await page.goto(TOOL_URL);
  return page;
}

/* De wizard van 1.31.1: initialen, map kiezen, beginnen. Een confirm()
   wordt aanvaard, zoals een leerkracht die op OK klikt. */
async function oudeWizard(page, initialen) {
  page.on("dialog", (d) => d.accept());
  await page.fill("#wizardInitials", initialen);
  await page.click("#wizardPickFolder");
  await expect(page.locator("#wizardFolderState")).toContainText("Map gekoppeld");
  await page.click("#wizardFinish");
}

async function rij(page, id) {
  await page.evaluate(async (id) => {
    const year = "1ste jaar";
    const klas = classesFor(db, year)[0];
    const ev = evaluationNames(db, year)[0];
    const key = sessionKey(year, klas, ev);
    if (!db.sessions[key]) db.sessions[key] = [];
    db.sessions[key].push({ id, assessor: db.assessor, students: [studentsFor(db, year, klas)[0]], scores: {}, createdAt: Date.now(), updatedAt: Date.now() });
    persist();
    clearTimeout(autoSaveTimer);
    await writeHandle();
  }, id);
}

function rijenInBestand(schijf, naam) {
  const d = schijf.json("Gedeeld/" + naam);
  const ids = [];
  Object.values(d.schoolYears).forEach((b) => Object.values(b.sessions).forEach((l) => l.forEach((r) => ids.push(r.id))));
  return ids.sort();
}

test("risico 1: een nieuw toestel met dezelfde initialen overschrijft het werkbestand", async ({ browser }) => {
  const schijf = nieuweSchijf();
  const a = await toestel(browser, schijf);
  await oudeWizard(a, "BB");
  await rij(a, "BB-1");
  expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);

  const b = await toestel(browser, schijf);
  await oudeWizard(b, "BB");
  expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);
});

test("risico 2: Team bijwerken slaat het eigen bestand over", async ({ browser }) => {
  const schijf = nieuweSchijf();
  const a = await toestel(browser, schijf);
  await oudeWizard(a, "BB");
  await rij(a, "BB-1");

  const b = await toestel(browser, schijf);
  const ids = await b.evaluate(async () => {
    db.assessor = "BB";
    folderHandle = window.__nepMap("Gedeeld");
    folderName = "Gedeeld";
    const r = await readTeamFolder(folderHandle, teamFileName(db.assessor), CONFIG);
    r.files.forEach((f) => mergeDb(db, f.db));
    return Object.values(db.sessions).flat().map((x) => x.id);
  });
  expect(ids).toContain("BB-1");
});

test("risico 3: twee toestellen van dezelfde leerkracht, laatste schrijver wint", async ({ browser }) => {
  const schijf = nieuweSchijf();
  const a = await toestel(browser, schijf);
  await oudeWizard(a, "BB");
  const b = await toestel(browser, schijf);
  await oudeWizard(b, "BB");

  await rij(a, "BB-laptop-1");
  await rij(b, "BB-school-1");
  await rij(a, "BB-laptop-2");
  expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-laptop-1", "BB-laptop-2", "BB-school-1"]);
});

test("risico 4: initialen wijzigen in de kop schrijft verder naar het oude bestand", async ({ browser }) => {
  const schijf = nieuweSchijf();
  const a = await toestel(browser, schijf);
  await oudeWizard(a, "BB");
  await a.fill("#assessor", "XY");
  await rij(a, "XY-1");
  const r = await a.evaluate(() => ({ bestand: fileName, verwacht: teamFileName(db.assessor) }));
  const inhoud = schijf.json("Gedeeld/" + r.bestand);
  expect(r.bestand).toBe(r.verwacht);
  expect(inhoud.assessor).toBe(r.bestand.replace("evaluaties-", "").replace(".json", ""));
});
