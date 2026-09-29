/* Deel B (1.33.0): geen bestandsknoppen meer op het Evalueren-scherm.
   Bewaren gaat vanzelf, Team bijwerken ook, en wat overblijft staat bij
   Instellingen, Gebruiker en Team. */
const { test, expect } = require("@playwright/test");
const { openTool, tweedeToestel, nieuweSchijf } = require("./helpers");

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

const rijen = (page) => page.evaluate(() => Object.values(db.sessions).flat().map((r) => r.id).sort());

test("het Evalueren-scherm heeft geen bestandsknoppen meer", async ({ page }) => {
  await openTool(page);
  for (const id of ["#btnSaveFile", "#btnSaveFileAs", "#btnOpenFile", "#fileHint", "#folderGroup"]) {
    await expect(page.locator(id), id).toHaveCount(0);
  }
  await expect(page.locator("#mainView #btnSyncTeam")).toHaveCount(0);
  await expect(page.locator("#mainView #btnMergeFile")).toHaveCount(0);
  await expect(page.locator("#safetyBar")).toBeHidden();
  page.expectNoErrors();
});

test("de status rechtsboven opent Instellingen, Gebruiker", async ({ page }) => {
  await openTool(page, { initialen: "BB" });
  await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
  await page.click("#status");
  await expect(page.locator("#userCard")).toBeVisible();
  await expect(page.locator("#userStorage")).toContainText("evaluaties-BB.json");
  page.expectNoErrors();
});

test("Gebruiker: elke knop heeft een korte uitleg, zonder gedachtestreep", async ({ page }) => {
  await openTool(page);
  await page.click("#assessor");
  const tekst = await page.locator("#userCard").innerText();
  expect(tekst).toContain("Kopie downloaden");
  expect(tekst).toContain("Dit toestel loskoppelen");
  expect(tekst).toContain("Koppeling opnieuw instellen");
  expect(tekst).not.toContain("—");
  // Enkel in een browser zonder Chrome of Edge.
  await expect(page.locator("#btnMergeWorkFile")).toBeHidden();
  page.expectNoErrors();
});

test("Kopie downloaden geeft al je werk, met een eigen naam", async ({ page }) => {
  await openTool(page, { initialen: "BB" });
  await rij(page, "BB-1");
  await page.click("#assessor");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnDownloadCopy")]);
  expect(dl.suggestedFilename()).toMatch(/^kopie-evaluaties-BB-\d{4}-\d{2}-\d{2}\.json$/);
  const inhoud = JSON.parse(require("fs").readFileSync(await dl.path(), "utf8"));
  expect(JSON.stringify(inhoud)).toContain("BB-1");
  await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
  page.expectNoErrors();
});

test("Dit toestel loskoppelen: de browser vergeet alles, je werk blijft in de map", async ({ page }) => {
  await openTool(page, { initialen: "BB", naam: "Bert Bollen" });
  await rij(page, "BB-1");
  await page.evaluate(() => localStorage.setItem("iets-anders", "blijft"));
  await page.click("#assessor");
  let vraag = "";
  page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
  await page.click("#btnUnlinkDevice");
  await expect(page.locator("#setupWizard")).toBeVisible();
  expect(vraag).toContain("evaluaties-BB.json");
  // Na het herladen: geen werk, geen initialen, geen koppeling meer in deze browser.
  expect(await page.evaluate(() => ["STEM_EVAL_DB_V3", "STEM_EVAL_ASSESSOR", "STEM_EVAL_BESTAND_TIJD"].map((k) => localStorage.getItem(k)))).toEqual([null, null, null]);
  expect(await page.evaluate(() => idbGet("teamFolder"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("iets-anders"))).toBe("blijft");
  expect(page.schijf.namen("Gedeeld")).toEqual(["evaluaties-BB.json"]);

  // Later, of iemand anders: gewoon ophalen.
  await page.click("#wizardExisting");
  await page.click("#wizardPickExisting");
  await page.locator(".wizard-person", { hasText: "Bert Bollen" }).click();
  await page.click("#wizardFinish");
  expect(await rijen(page)).toEqual(["BB-1"]);
  page.expectNoErrors();
});

test("Dit toestel loskoppelen weigert als je werk niet veilig bewaard is", async ({ page }) => {
  await openTool(page, { initialen: "BB" });
  page.schijf.zet("Gedeeld/evaluaties-BB.json", "{half");
  await rij(page, "BB-1");
  await page.click("#assessor");
  await page.click("#btnUnlinkDevice");
  await expect(page.locator("#notice")).toContainText("Nog niet loskoppelen");
  await expect(page.locator("#setupWizard")).toBeHidden();
  expect(await rijen(page)).toEqual(["BB-1"]);
  page.expectNoErrors();
});

test.describe("Team bijwerken gaat vanzelf", () => {
  async function metCollega(browser) {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB" });
    const m = await tweedeToestel(browser, schijf, { initialen: "MD" });
    await rij(m, "MD-1");
    return { a, m };
  }

  test("bij het opstarten", async ({ browser }) => {
    const { a } = await metCollega(browser);
    await a.reload();
    await expect.poll(() => rijen(a)).toEqual(["MD-1"]);
    a.expectNoErrors();
  });

  test("bij terugkeren naar het venster, en hoogstens om de vijf minuten", async ({ browser }) => {
    const { a, m } = await metCollega(browser);
    await a.evaluate(() => { lastSyncAt = 0; window.dispatchEvent(new Event("focus")); });
    await expect.poll(() => rijen(a)).toEqual(["MD-1"]);
    await rij(m, "MD-2");
    await a.evaluate(() => window.dispatchEvent(new Event("focus")));
    await a.waitForTimeout(300);
    expect(await rijen(a)).toEqual(["MD-1"]);
    await a.evaluate(() => { lastSyncAt = Date.now() - 6 * 60 * 1000; window.dispatchEvent(new Event("focus")); });
    await expect.poll(() => rijen(a)).toEqual(["MD-1", "MD-2"]);
    // Geen melding die het scherm verschuift.
    await expect(a.locator("#notice")).toBeEmpty();
    a.expectNoErrors();
  });

  test("om de tien minuten", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    await a.clock.install();
    await openTool(a, { initialen: "BB", schijf });
    const m = await tweedeToestel(browser, schijf, { initialen: "MD" });
    await rij(m, "MD-1");
    await a.clock.runFor(11 * 60 * 1000);
    await expect.poll(() => rijen(a)).toEqual(["MD-1"]);
    a.expectNoErrors();
  });

  test("wacht zolang je een leerling aan het beoordelen bent", async ({ browser }) => {
    const { a } = await metCollega(browser);
    await a.selectOption("#yearSelect", "1ste jaar");
    await a.click("#klasMultiInput");
    await a.locator("#klasMultiPanel .klas-multi-option").first().click();
    await a.click("#evalComboInput");
    await a.locator("#evalComboPanel .eval-combo-option").first().click();
    await a.locator("#studentGrid .student-cb").first().check();
    await a.locator("#rubrics .rubric-card").first().locator(".option-btn").last().click();

    await a.evaluate(() => { lastSyncAt = 0; return autoSyncTeam(); });
    expect(await rijen(a)).toEqual([]);
    await expect(a.locator("#studentGrid .student-cb").first()).toBeChecked();
    expect(await a.evaluate(() => Object.keys(form.scores).length)).toBe(1);

    await a.click("#btnCancel");
    await a.evaluate(() => autoSyncTeam());
    expect(await rijen(a)).toEqual(["MD-1"]);
    a.expectNoErrors();
  });

  test("Instellingen, Team: Nu bijwerken, met het tijdstip", async ({ browser }) => {
    const { a } = await metCollega(browser);
    await a.click("#btnSettings");
    await a.click("#btnTeam");
    await expect(a.locator("#syncSection")).toBeVisible();
    await a.click("#btnSyncTeam");
    await expect.poll(() => rijen(a)).toEqual(["MD-1"]);
    await expect(a.locator("#syncState")).toContainText("Laatst bijgewerkt om");
    await expect(a.locator("#syncSection summary")).toHaveText("Een bestand van buiten de map toevoegen");
    a.expectNoErrors();
  });
});

test.describe("zonder Chrome of Edge", () => {
  test("de status is de knop Opslaan (download) zolang er iets niet gedownload is", async ({ page }) => {
    await openTool(page, { initialen: "BB", fsa: false });
    await expect(page.locator("#status")).toHaveText("Gedownload als evaluaties-BB.json");
    await page.evaluate(() => persist());
    await expect(page.locator("#status")).toHaveText("Opslaan (download)");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#status")]);
    expect(dl.suggestedFilename()).toBe("evaluaties-BB.json");
    await expect(page.locator("#status")).toHaveText("Gedownload als evaluaties-BB.json");
    // Nu opent een klik gewoon Gebruiker.
    await page.click("#status");
    await expect(page.locator("#userCard")).toBeVisible();
    await expect(page.locator("#btnMergeWorkFile")).toBeVisible();
    page.expectNoErrors();
  });

  test("Werkbestand openen en samenvoegen: werk van een andere computer komt erbij", async ({ page, browser }) => {
    const b = await tweedeToestel(browser, nieuweSchijf(), { initialen: "BB", fsa: false });
    await rij(b, "BB-andere");
    const [dl] = await Promise.all([b.waitForEvent("download"), b.click("#status")]);

    await openTool(page, { initialen: "BB", fsa: false });
    await rij(page, "BB-hier");
    await page.click("#assessor");
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#btnMergeWorkFile")]);
    await chooser.setFiles(await dl.path());
    await expect(page.locator("#notice")).toContainText("Samengevoegd");
    expect(await rijen(page)).toEqual(["BB-andere", "BB-hier"]);
    page.expectNoErrors();
  });

  test("Team toont dat vanzelf ophalen hier niet kan, en hoe het wel kan", async ({ page }) => {
    await openTool(page, { fsa: false });
    await page.click("#btnSettings");
    await page.click("#btnTeam");
    await expect(page.locator("#syncSection")).toBeHidden();
    await expect(page.locator("#syncOff")).toBeVisible();
    await expect(page.locator("#syncOff")).toContainText("Chrome of Edge");
    page.expectNoErrors();
  });
});
