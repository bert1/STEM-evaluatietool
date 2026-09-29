/* Koppelen is verplicht (sinds 1.32.0), en je eigen bestand wordt nooit
   blind overschreven. Twee browsercontexten delen dezelfde nagemaakte
   OneDrive-map (tests/schijf.js): twee toestellen van dezelfde
   leerkracht, of een collega. Zie "Koppelen" in HANDOFF.md. */
const { test, expect } = require("@playwright/test");
const { openTool, tweedeToestel, nieuweSchijf } = require("./helpers");

/* Een beoordeling in het 1ste jaar, bewaard en weggeschreven. */
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

async function rijenInTool(page) {
  return page.evaluate(() => {
    const ids = [];
    Object.values(db.schoolYears).forEach((b) => Object.values(b.sessions).forEach((l) => l.forEach((r) => ids.push(r.id))));
    return ids.sort();
  });
}

function rijenInBestand(schijf, naam) {
  const d = schijf.json("Gedeeld/" + naam);
  const ids = [];
  Object.values(d.schoolYears).forEach((b) => Object.values(b.sessions).forEach((l) => l.forEach((r) => ids.push(r.id))));
  return ids.sort();
}

/* Een nieuwe browser (geen gegevens) die de wizard laat openstaan. */
async function nieuweBrowser(browser, schijf, opties = {}) {
  return tweedeToestel(browser, schijf, { koppel: false, ...opties });
}

/* De tweede weg: map kiezen en op je naam klikken. */
async function haalOp(page, naam) {
  await page.click("#wizardExisting");
  await page.click("#wizardPickExisting");
  await page.locator(".wizard-person", { hasText: naam }).click();
}

async function beginnen(page) {
  await expect(page.locator("#wizardFinish")).toBeEnabled();
  await page.click("#wizardFinish");
  await expect(page.locator("#setupWizard")).toBeHidden();
}

test.describe("de wizard is verplicht", () => {
  test("zonder koppeling kan de wizard niet dicht, en hij komt terug bij de volgende opstart", async ({ page }) => {
    await openTool(page, { koppel: false });
    await expect(page.locator("#setupWizard")).toBeVisible();
    await expect(page.locator("#wizardSkip")).toHaveCount(0);
    await expect(page.locator("#wizardNew")).toContainText("Ik gebruik de tool voor het eerst");
    await expect(page.locator("#wizardExisting")).toContainText("Ik heb de tool al gebruikt op een andere computer of in een andere browser");
    await expect(page.locator("#wizardCancel")).toBeHidden();

    await page.click("#wizardNew");
    await page.fill("#wizardInitials", "BB");
    await expect(page.locator("#wizardFinish")).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.locator(".wizard-overlay").click({ position: { x: 5, y: 5 }, force: true });
    await expect(page.locator("#setupWizard")).toBeVisible();
    await expect(page.locator("#wizardFolderHelpNew")).toContainText("Waar staat de gedeelde map?");

    await page.reload();
    await expect(page.locator("#setupWizard")).toBeVisible();
    expect(page.schijf.namen("Gedeeld")).toEqual([]);
    page.expectNoErrors();
  });

  test("gekoppeld met een map: geen wizard meer, en de map wordt teruggevonden", async ({ page }) => {
    await openTool(page, { initialen: "BB", naam: "Bert Bollen" });
    expect(page.schijf.namen("Gedeeld")).toEqual(["evaluaties-BB.json"]);
    expect(page.schijf.json("Gedeeld/evaluaties-BB.json").team.members.BB.name).toBe("Bert Bollen");
    await page.reload();
    await expect(page.locator("#setupWizard")).toBeHidden();
    await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
    page.expectNoErrors();
  });

  test("een verlopen toestemming geeft de balk Verbinden, geen wizard", async ({ page }) => {
    await openTool(page, { initialen: "BB" });
    await rij(page, "BB-1");
    await page.addInitScript(() => { window.__nepToestemming = "prompt"; });
    await page.reload();
    await expect(page.locator("#setupWizard")).toBeHidden();
    await expect(page.locator("#safetyBar")).toContainText("Gedeelde map niet verbonden");
    await page.click("#safetyBar >> text=Verbinden met Gedeeld");
    await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
    expect(rijenInBestand(page.schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);
    page.expectNoErrors();
  });

  test("in Firefox of Safari: Chrome of Edge aangeraden, werkbestand verplicht", async ({ page }) => {
    await openTool(page, { koppel: false, fsa: false });
    await expect(page.locator("#wizardBrowserWarn")).toBeVisible();
    await expect(page.locator("#wizardBrowserWarn")).toContainText("Chrome of Edge");
    await page.click("#wizardNew");
    await expect(page.locator("#wizardPickFolder")).toBeHidden();
    await page.fill("#wizardInitials", "BB");
    await expect(page.locator("#wizardFinish")).toBeDisabled();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#wizardDownload")]);
    expect(dl.suggestedFilename()).toBe("evaluaties-BB.json");
    await beginnen(page);
    await page.reload();
    await expect(page.locator("#setupWizard")).toBeHidden();
    await expect(page.locator("#status")).toHaveText("Gedownload als evaluaties-BB.json");
    page.expectNoErrors();
  });

  test("in Firefox of Safari: in een nieuwe browser je werkbestand openen", async ({ page, browser }) => {
    await openTool(page, { fsa: false, initialen: "BB", naam: "Bert Bollen" });
    await page.evaluate(() => {
      const key = sessionKey("1ste jaar", classesFor(db, "1ste jaar")[0], evaluationNames(db, "1ste jaar")[0]);
      db.sessions[key] = [{ id: "BB-ff", assessor: "BB", students: ["X"], scores: {}, createdAt: 1, updatedAt: 1 }];
      persist();
    });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#status")]);
    const pad = await dl.path();

    const b = await nieuweBrowser(browser, nieuweSchijf(), { fsa: false });
    await b.click("#wizardExisting");
    const [chooser] = await Promise.all([b.waitForEvent("filechooser"), b.click("#wizardOpenFile")]);
    await chooser.setFiles(pad);
    await expect(b.locator("#wizardExistingState")).toContainText("Je werk is terug");
    await beginnen(b);
    expect(await rijenInTool(b)).toEqual(["BB-ff"]);
    expect(await b.evaluate(() => [db.assessor, myName()])).toEqual(["BB", "Bert Bollen"]);
    await b.reload();
    await expect(b.locator("#setupWizard")).toBeHidden();
    b.expectNoErrors();
  });
});

test.describe("bestaande gebruiker van 1.31.1 met werk enkel in de browser", () => {
  async function oudeGebruiker(page) {
    await openTool(page, { koppel: false });
    await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(db));
      const key = sessionKey("1ste jaar", classesFor(db, "1ste jaar")[0], evaluationNames(db, "1ste jaar")[0]);
      d.schoolYears[d.currentSchoolYear].sessions[key] = [{ id: "BB-browser", assessor: "BB", students: ["X"], scores: {}, createdAt: 1, updatedAt: 1 }];
      d.assessor = "BB";
      localStorage.setItem("STEM_EVAL_DB_V3", JSON.stringify(d));
      localStorage.setItem("STEM_EVAL_ASSESSOR", "BB");
    });
    await page.reload();
  }

  test("moet koppelen, en zijn browserwerk wordt het nieuwe bestand", async ({ page }) => {
    await oudeGebruiker(page);
    await expect(page.locator("#setupWizard")).toBeVisible();
    await expect(page.locator("#wizardTitle")).toHaveText("Bewaar je werk in de gedeelde map");
    await expect(page.locator("#wizardInitials")).toHaveValue("BB");
    await expect(page.locator("#wizardInitials")).toHaveJSProperty("readOnly", true);
    await page.click("#wizardPickFolder");
    await beginnen(page);
    expect(rijenInBestand(page.schijf, "evaluaties-BB.json")).toEqual(["BB-browser"]);
    // Eerst een reservekopie van het browserwerk.
    expect(page.schijf.namen("Gedeeld/backups").length).toBeGreaterThan(0);
    page.expectNoErrors();
  });

  test("bestaat zijn bestand al, dan wordt alles samengevoegd", async ({ page, browser }) => {
    const schijf = nieuweSchijf();
    const ander = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await rij(ander, "BB-laptop");

    page.schijf = schijf;
    await openTool(page, { koppel: false, schijf });
    await page.evaluate(() => {
      const d = JSON.parse(JSON.stringify(db));
      const key = sessionKey("1ste jaar", classesFor(db, "1ste jaar")[0], evaluationNames(db, "1ste jaar")[0]);
      d.schoolYears[d.currentSchoolYear].sessions[key] = [{ id: "BB-browser", assessor: "BB", students: ["X"], scores: {}, createdAt: 1, updatedAt: 1 }];
      localStorage.setItem("STEM_EVAL_DB_V3", JSON.stringify(d));
      localStorage.setItem("STEM_EVAL_ASSESSOR", "BB");
    });
    await page.reload();
    await page.click("#wizardPickFolder");
    await expect(page.locator("#wizardNewState")).toContainText("Ben jij Bert Bollen?");
    await page.click("#wizardFetch");
    await beginnen(page);
    expect(await rijenInTool(page)).toEqual(["BB-browser", "BB-laptop"]);
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-browser", "BB-laptop"]);
    page.expectNoErrors();
  });
});

test.describe("nieuwe browser, bestaande leerkracht", () => {
  /* Bert werkt op zijn laptop: een beoordeling, een eigen rubric, een
     klas, een vak, periodes, drempels en iets verwijderd voor hemzelf. */
  async function bertOpLaptop(browser, schijf) {
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await a.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      db.evaluations[year]["Eigen rubric"] = JSON.parse(JSON.stringify(db.evaluations[year][ev]));
      db.evaluations[year]["Eigen rubric"].updatedAt = Date.now();
      db.roster[year]["1ZZ"] = { students: ["Zeno"], updatedAt: Date.now() };
      db.subjects[year] = [{ name: "STEM", classes: ["1ZZ"], updatedAt: Date.now() }];
      db.schoolYears[db.currentSchoolYear].periods = { list: [{ name: "P1", start: "2026-09-01" }], end: "2027-06-30", updatedAt: Date.now() };
      db.settings = { thresholds: { onthouden: 77 }, updatedAt: Date.now() };
      const weg = evaluationNames(db, year)[1];
      delete db.evaluations[year][weg];
      recordDeletion("evaluations", year + "||" + weg, "mezelf");
      persist();
    });
    await rij(a, "BB-1");
    return a;
  }

  function stand(page) {
    return page.evaluate(() => ({
      rijen: Object.values(db.sessions).flat().map((r) => r.id),
      rubrics: evaluationNames(db, "1ste jaar").sort(),
      klas: db.roster["1ste jaar"]["1ZZ"],
      vakken: db.subjects["1ste jaar"],
      periodes: db.schoolYears[db.currentSchoolYear].periods,
      drempels: db.settings.thresholds,
      initialen: db.assessor,
      naam: myName(),
    }));
  }

  test("kiest zichzelf uit de lijst: al zijn werk is terug", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await bertOpLaptop(browser, schijf);
    const b = await nieuweBrowser(browser, schijf);
    await haalOp(b, "Bert Bollen");
    await expect(b.locator("#wizardExistingState")).toContainText("Gekoppeld");
    await beginnen(b);
    expect(await stand(b)).toEqual(await stand(a));
    await expect(b.locator("#assessor")).toHaveText("BB");
    await b.reload();
    await expect(b.locator("#setupWizard")).toBeHidden();
    expect(await stand(b)).toEqual(await stand(a));
    b.expectNoErrors();
  });

  test("typt dezelfde initialen: zijn werk wordt opgehaald, niet overschreven", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await bertOpLaptop(browser, schijf);
    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardNew");
    await b.fill("#wizardInitials", "bb");
    await b.click("#wizardPickFolder");
    await expect(b.locator("#wizardNewState")).toContainText("Ben jij Bert Bollen?");
    // Ophalen is de standaardkeuze: Enter kiest het.
    await expect(b.locator("#wizardFetch")).toBeFocused();
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);
    await b.keyboard.press("Enter");
    await beginnen(b);
    expect(await stand(b)).toEqual(await stand(a));
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);
    b.expectNoErrors();
  });

  test("een collega met dezelfde initialen en een andere naam: duidelijke melding, geen vermenging", async ({ browser }) => {
    const schijf = nieuweSchijf();
    await bertOpLaptop(browser, schijf);
    const voor = schijf.tekst("Gedeeld/evaluaties-BB.json");
    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardNew");
    await b.fill("#wizardInitials", "BB");
    await b.fill("#wizardName", "Bram Baert");
    await b.click("#wizardPickFolder");
    const paneel = b.locator("#wizardNewState");
    await expect(paneel).toContainText("Die initialen gebruikt al iemand anders");
    await expect(paneel).toContainText("Bert Bollen");
    await expect(paneel.locator(".btn-primary")).toHaveText("Andere initialen kiezen");
    await paneel.locator(".btn-primary").click();
    await expect(b.locator("#wizardInitials")).toBeFocused();
    await expect(b.locator("#wizardFinish")).toBeDisabled();
    expect(schijf.tekst("Gedeeld/evaluaties-BB.json")).toBe(voor);

    await b.fill("#wizardInitials", "BBA");
    await b.click("#wizardPickFolder");
    await beginnen(b);
    expect(schijf.namen("Gedeeld")).toEqual(["evaluaties-BB.json", "evaluaties-BBA.json"]);
    expect(schijf.tekst("Gedeeld/evaluaties-BB.json")).toBe(voor);
    b.expectNoErrors();
  });

  test("in deze browser staat werk van iemand anders: niet vermengen", async ({ browser }) => {
    const schijf = nieuweSchijf();
    await bertOpLaptop(browser, schijf);
    const m = await tweedeToestel(browser, schijf, { initialen: "MD", naam: "Marie Dubois" });
    await m.click("#btnSettings");
    await m.click("#btnSettingsUser");
    await m.click("#btnRelink");
    await expect(m.locator("#wizardCancel")).toBeVisible();
    await m.click("#wizardToExisting");
    await m.click("#wizardPickExisting");
    await m.locator(".wizard-person", { hasText: "Bert Bollen" }).click();
    await expect(m.locator("#wizardExistingState")).toContainText("In deze browser staat het werk van Marie Dubois");
    await m.click("#wizardCancel");
    expect(await m.evaluate(() => db.assessor)).toBe("MD");
    m.expectNoErrors();
  });
});

test.describe("het eigen bestand ontbreekt", () => {
  test("terughalen uit een reservekopie, nieuwste eerst", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await rij(a, "BB-1");
    await a.evaluate(async () => { lastBackupAt = 0; await makeBackup(); });
    schijf.wis("Gedeeld/evaluaties-BB.json");

    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardExisting");
    await b.click("#wizardPickExisting");
    const bert = b.locator(".wizard-person", { hasText: "Bert Bollen" });
    await expect(bert).toContainText("bestand niet gevonden, wel reservekopieën");
    await bert.click();
    const paneel = b.locator("#wizardExistingState");
    await expect(paneel).toContainText("Je bestand is niet gevonden");
    await expect(paneel).toContainText("Wil je je werk terughalen uit een reservekopie?");
    const rijen = paneel.locator(".backup-row");
    expect(await rijen.count()).toBeGreaterThan(1);
    await expect(rijen.first()).toContainText("nieuwste");
    await rijen.first().getByRole("button", { name: "Terughalen" }).click();
    await beginnen(b);
    expect(await rijenInTool(b)).toEqual(["BB-1"]);
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1"]);
    b.expectNoErrors();
  });

  test("zonder reservekopieën: terughalen uit de bestanden van collega's", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await rij(a, "BB-1");
    const m = await tweedeToestel(browser, schijf, { initialen: "MD", naam: "Marie Dubois" });
    await rij(m, "MD-1");
    await m.evaluate(() => syncTeam(true));
    await m.evaluate(async () => { clearTimeout(autoSaveTimer); await writeHandle(); });
    schijf.wis("Gedeeld/evaluaties-BB.json");
    schijf.namen("Gedeeld/backups").filter((n) => n.startsWith("evaluaties-BB-")).forEach((n) => schijf.wis("Gedeeld/backups/" + n));

    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardExisting");
    await b.click("#wizardPickExisting");
    const bert = b.locator(".wizard-person", { hasText: "Bert Bollen" });
    await expect(bert).toContainText("enkel bekend bij collega's");
    await bert.click();
    const paneel = b.locator("#wizardExistingState");
    await expect(paneel).toContainText("Je bestand en je reservekopieën zijn niet gevonden");
    await expect(paneel).toContainText("enkel wat zij de laatste keer van jou overnamen");
    await expect(paneel).toContainText("1 beoordeling(en) van jou");
    // Nog geen nieuw bestand zolang er niet gekozen is.
    expect(schijf.namen("Gedeeld")).toEqual(["evaluaties-MD.json"]);
    await paneel.getByRole("button", { name: "Terughalen uit de bestanden van collega's" }).click();
    await beginnen(b);
    expect(await rijenInTool(b)).toEqual(["BB-1", "MD-1"]);
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(["BB-1", "MD-1"]);
    b.expectNoErrors();
  });
});

test.describe("twee toestellen van dezelfde leerkracht", () => {
  test("afwisselend werken: niets verdwijnt", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const laptop = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    const school = await nieuweBrowser(browser, schijf);
    await haalOp(school, "Bert Bollen");
    await beginnen(school);

    await rij(laptop, "BB-laptop-1");
    await rij(school, "BB-school-1");
    await rij(laptop, "BB-laptop-2");
    await rij(school, "BB-school-2");
    const alles = ["BB-laptop-1", "BB-laptop-2", "BB-school-1", "BB-school-2"];
    expect(rijenInBestand(schijf, "evaluaties-BB.json")).toEqual(alles);
    expect(await rijenInTool(school)).toEqual(alles);
    await expect(school.locator("#notice")).toContainText("op een ander toestel aangepast");
    // Terug naar het venster van de laptop: die haalt het ook op.
    await laptop.evaluate(async () => { await pullOwnFile(); });
    expect(await rijenInTool(laptop)).toEqual(alles);
    // Voor het samenvoegen kwam er een kopie van het bestand op schijf.
    expect(schijf.namen("Gedeeld/backups").length).toBeGreaterThan(1);
    laptop.expectNoErrors();
    school.expectNoErrors();
  });

  test("Team bijwerken haalt ook het werk van je andere toestel op", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const laptop = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    const school = await nieuweBrowser(browser, schijf);
    await haalOp(school, "Bert Bollen");
    await beginnen(school);
    await rij(laptop, "BB-laptop-1");
    await school.click("#btnSettings");
    await school.click("#btnTeam");
    await school.click("#btnSyncTeam");
    await expect(school.locator("#syncState")).toContainText("Laatst bijgewerkt om");
    expect(await rijenInTool(school)).toEqual(["BB-laptop-1"]);
    school.expectNoErrors();
  });
});

test.describe("onleesbaar eigen bestand", () => {
  test("bij het opstarten: geen lege start, niets overschreven", async ({ page }) => {
    await openTool(page, { initialen: "BB" });
    await rij(page, "BB-1");
    page.schijf.zet("Gedeeld/evaluaties-BB.json", '{"format": "stem-eval", "schoolYe');
    await page.reload();
    await expect(page.locator("#setupWizard")).toBeHidden();
    await expect(page.locator("#status")).toHaveText("Bestand onleesbaar");
    await expect(page.locator("#safetyBar")).toContainText("Je bestand evaluaties-BB.json kon niet gelezen worden");
    expect(await rijenInTool(page)).toEqual(["BB-1"]);
    await rij(page, "BB-2");
    expect(page.schijf.tekst("Gedeeld/evaluaties-BB.json")).toBe('{"format": "stem-eval", "schoolYe');

    // OneDrive is klaar: opnieuw proberen voegt samen en bewaart.
    const goed = await page.evaluate(() => JSON.parse(JSON.stringify(Object.assign({}, db, { localTombstones: undefined }))));
    goed.format = "stem-eval";
    page.schijf.zet("Gedeeld/evaluaties-BB.json", goed);
    await page.locator("#safetyBar").getByRole("button", { name: "Opnieuw proberen" }).click();
    await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
    expect(rijenInBestand(page.schijf, "evaluaties-BB.json")).toEqual(["BB-1", "BB-2"]);
    page.expectNoErrors();
  });

  test("in een nieuwe browser: geen lege start, niets overschreven", async ({ browser }) => {
    const schijf = nieuweSchijf();
    await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    schijf.zet("Gedeeld/evaluaties-BB.json", "{kapot");
    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardNew");
    await b.fill("#wizardInitials", "BB");
    await b.click("#wizardPickFolder");
    await expect(b.locator("#wizardNewState")).toContainText("Je bestand kon niet gelezen worden");
    await expect(b.locator("#wizardFinish")).toBeDisabled();
    expect(schijf.tekst("Gedeeld/evaluaties-BB.json")).toBe("{kapot");
    b.expectNoErrors();
  });

  test("tijdens het werken gewijzigd en onleesbaar: niet schrijven", async ({ page }) => {
    await openTool(page, { initialen: "BB" });
    page.schijf.zet("Gedeeld/evaluaties-BB.json", "{half");
    await rij(page, "BB-1");
    expect(page.schijf.tekst("Gedeeld/evaluaties-BB.json")).toBe("{half");
    await expect(page.locator("#status")).toHaveText("Bestand onleesbaar");
    page.expectNoErrors();
  });
});

test.describe("Instellingen, Gebruiker", () => {
  test("toont wie je bent en waar je werk staat; Beoordelaar opent dit onderdeel", async ({ page }) => {
    await openTool(page, { initialen: "BB", naam: "Bert Bollen" });
    const beoordelaar = page.locator("#assessor");
    await expect(beoordelaar).toHaveText("BB");
    expect(await beoordelaar.evaluate((e) => e.tagName)).toBe("BUTTON");
    await beoordelaar.click();
    await expect(page.locator("#userCard")).toBeVisible();
    await expect(page.locator("#btnSettingsUser")).toHaveClass(/active/);
    await expect(page.locator("#userInitials")).toHaveText("BB");
    await expect(page.locator("#userName")).toHaveText("Bert Bollen");
    await expect(page.locator("#userStorage")).toContainText("Gedeeld");
    await expect(page.locator("#userStorage")).toContainText("evaluaties-BB.json");
    page.expectNoErrors();
  });

  test("een nieuwe naam komt door bij collega's na Team bijwerken", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    const m = await tweedeToestel(browser, schijf, { initialen: "MD", naam: "Marie Dubois" });
    await m.evaluate(() => syncTeam(true));
    expect(await m.evaluate(() => memberName(db, "BB"))).toBe("Bert Bollen");

    await a.click("#assessor");
    await a.click("#btnUserEdit");
    await a.fill("#userNameInput", "Bert Bollen-Peeters");
    await a.click("#btnUserSave");
    await expect(a.locator("#userName")).toHaveText("Bert Bollen-Peeters");
    await a.evaluate(async () => { clearTimeout(autoSaveTimer); await writeHandle(); });

    await m.evaluate(() => syncTeam(true));
    expect(await m.evaluate(() => memberName(db, "BB"))).toBe("Bert Bollen-Peeters");
    a.expectNoErrors();
    m.expectNoErrors();
  });

  test("Koppeling opnieuw instellen: een andere map, het werk gaat mee", async ({ page }) => {
    await openTool(page, { initialen: "BB", naam: "Bert Bollen" });
    await rij(page, "BB-1");
    await page.click("#assessor");
    await page.click("#btnRelink");
    await expect(page.locator("#wizardTitle")).toHaveText("Koppeling opnieuw instellen");
    await page.evaluate(() => { window.__nepKeuze = "Nieuw"; });
    await page.click("#wizardPickFolder");
    await expect(page.locator("#wizardNewState")).toContainText("Gekoppeld");
    await page.click("#wizardFinish");
    await expect(page.locator("#userStorage")).toContainText("Nieuw");
    expect(rijenInBestand({ json: (p) => page.schijf.json(p.replace("Gedeeld/", "Nieuw/")) }, "evaluaties-BB.json")).toEqual(["BB-1"]);
    await page.reload();
    await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-BB.json");
    page.expectNoErrors();
  });
});

test.describe("initialen wijzigen", () => {
  async function wijzig(page, initialen, { aanvaard = true } = {}) {
    await page.click("#assessor");
    await page.click("#btnUserEdit");
    await page.fill("#userInitialsInput", initialen);
    let vraag = "";
    page.once("dialog", (d) => { vraag = d.message(); aanvaard ? d.accept() : d.dismiss(); });
    await page.click("#btnUserSave");
    return () => vraag;
  }

  test("met een gedeelde map: nieuw bestand, verwijsbestand, en collega's volgen", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await rij(a, "BB-1");
    const m = await tweedeToestel(browser, schijf, { initialen: "MD", naam: "Marie Dubois" });
    await m.evaluate(() => {
      db.team.classes["1ste jaar||1WA"] = ["BB", "MD"];
      persist();
      return syncTeam(true);
    });
    await m.evaluate(async () => { clearTimeout(autoSaveTimer); await writeHandle(); });
    const kopieenVoor = schijf.namen("Gedeeld/backups").filter((n) => n.startsWith("evaluaties-BB-")).length;

    const vraag = await wijzig(a, "BX");
    await expect(a.locator("#notice")).toContainText("Initialen gewijzigd naar BX");
    expect(vraag()).toContain("evaluaties-BX.json");
    expect(vraag()).not.toContain("—");
    await expect(a.locator("#assessor")).toHaveText("BX");
    await expect(a.locator("#userStorage")).toContainText("evaluaties-BX.json");

    // Het nieuwe bestand heeft alles, met dezelfde rij-id.
    const nieuw = schijf.json("Gedeeld/evaluaties-BX.json");
    expect(nieuw.assessor).toBe("BX");
    expect(rijenInBestand(schijf, "evaluaties-BX.json")).toEqual(["BB-1"]);
    const rijBX = Object.values(nieuw.schoolYears).flatMap((b) => Object.values(b.sessions).flat())[0];
    expect(rijBX.assessor).toBe("BX");
    expect(nieuw.team.members.BX.name).toBe("Bert Bollen");
    expect(nieuw.team.members.BB).toBeUndefined();
    // Het oude bestand is een verwijsbestand.
    expect(schijf.json("Gedeeld/evaluaties-BB.json")).toMatchObject({ format: "stem-eval-verhuisd", from: "BB", to: "BX" });
    // De oude reservekopieën blijven de jouwe, en er kwam er een bij.
    await a.click("#btnTeam");
    const n = await a.locator("#backupList .backup-row").count();
    expect(n).toBeGreaterThan(kopieenVoor);

    // Marie: geen dubbele persoon, geen foutmelding, de rij heet nu BX.
    await m.evaluate(() => syncTeam(false));
    await expect(m.locator("#notice")).not.toContainText("Niet gelukt");
    const bijMarie = await m.evaluate(() => ({
      leden: memberList(db),
      klas: db.team.classes["1ste jaar||1WA"],
      rij: Object.values(db.sessions).flat().find((r) => r.id === "BB-1").assessor,
    }));
    expect(bijMarie).toEqual({ leden: ["BX", "MD"], klas: ["BX", "MD"], rij: "BX" });
    // Ook na nog een keer samenvoegen met het oude team van Marie komt BB niet terug.
    await a.evaluate(() => syncTeam(true));
    expect(await a.evaluate(() => memberList(db))).toEqual(["BX", "MD"]);
    a.expectNoErrors();
    m.expectNoErrors();
  });

  test("initialen die een collega gebruikt, worden geweigerd", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await tweedeToestel(browser, schijf, { initialen: "MD", naam: "Marie Dubois" });
    const voor = schijf.tekst("Gedeeld/evaluaties-MD.json");
    await wijzig(a, "MD");
    await expect(a.locator("#notice")).toContainText("MD wordt al gebruikt door Marie Dubois");
    expect(await a.evaluate(() => db.assessor)).toBe("BB");
    expect(schijf.tekst("Gedeeld/evaluaties-MD.json")).toBe(voor);
    expect(schijf.namen("Gedeeld")).toEqual(["evaluaties-BB.json", "evaluaties-MD.json"]);
    a.expectNoErrors();
  });

  test("annuleren verandert niets", async ({ page }) => {
    await openTool(page, { initialen: "BB" });
    await wijzig(page, "BX", { aanvaard: false });
    await expect(page.locator("#assessor")).toHaveText("BB");
    expect(page.schijf.namen("Gedeeld")).toEqual(["evaluaties-BB.json"]);
    page.expectNoErrors();
  });

  test("zonder gedeelde map: een nieuw werkbestand met de nieuwe naam", async ({ page }) => {
    await openTool(page, { initialen: "BB", fsa: false });
    await rij(page, "BB-1");
    await page.click("#assessor");
    await page.click("#btnUserEdit");
    await page.fill("#userInitialsInput", "BX");
    page.once("dialog", (d) => d.accept());
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnUserSave")]);
    expect(dl.suggestedFilename()).toBe("evaluaties-BX.json");
    await expect(page.locator("#assessor")).toHaveText("BX");
    const r = await page.evaluate(() => [Object.values(db.sessions).flat()[0].assessor, Object.values(db.sessions).flat()[0].id]);
    expect(r).toEqual(["BX", "BB-1"]);
    await page.reload();
    await expect(page.locator("#setupWizard")).toBeHidden();
    await expect(page.locator("#assessor")).toHaveText("BX");
    page.expectNoErrors();
  });

  test("je tweede toestel volgt vanzelf, en er gaat niets verloren", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const laptop = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    const school = await nieuweBrowser(browser, schijf);
    await haalOp(school, "Bert Bollen");
    await beginnen(school);
    await rij(laptop, "BB-laptop");
    await wijzig(laptop, "BX");
    await expect(laptop.locator("#notice")).toContainText("Initialen gewijzigd naar BX");

    // Het schooltoestel werkt nog als BB en bewaart iets.
    await rij(school, "BB-school");
    await expect(school.locator("#assessor")).toHaveText("BX");
    await expect(school.locator("#notice")).toContainText("Je initialen zijn gewijzigd");
    expect(rijenInBestand(schijf, "evaluaties-BX.json")).toEqual(["BB-laptop", "BB-school"]);
    expect(schijf.json("Gedeeld/evaluaties-BB.json").format).toBe("stem-eval-verhuisd");
    laptop.expectNoErrors();
    school.expectNoErrors();
  });

  test("een nieuwe browser met de oude initialen wordt naar de nieuwe verwezen", async ({ browser }) => {
    const schijf = nieuweSchijf();
    const a = await tweedeToestel(browser, schijf, { initialen: "BB", naam: "Bert Bollen" });
    await rij(a, "BB-1");
    await wijzig(a, "BX");
    await expect(a.locator("#notice")).toContainText("Initialen gewijzigd naar BX");

    const b = await nieuweBrowser(browser, schijf);
    await b.click("#wizardNew");
    await b.fill("#wizardInitials", "BB");
    await b.click("#wizardPickFolder");
    await expect(b.locator("#wizardNewState")).toContainText("BB werkt nu met de initialen BX");
    await b.click("#wizardFetch");
    await beginnen(b);
    expect(await b.evaluate(() => db.assessor)).toBe("BX");
    expect(await rijenInTool(b)).toEqual(["BB-1"]);

    // In de lijst staat Bert één keer.
    const c = await nieuweBrowser(browser, schijf);
    await c.click("#wizardExisting");
    await c.click("#wizardPickExisting");
    await expect(c.locator(".wizard-person")).toHaveCount(1);
    await expect(c.locator(".wizard-person")).toContainText("BX");
    b.expectNoErrors();
    c.expectNoErrors();
  });
});
