const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

const JAAR = "2de jaar";
const opties = (page) => page.locator("#evalComboPanel .eval-combo-option").allInnerTexts();
const zonderVinkje = (list) => list.map((t) => t.replace(/\s*✓$/, ""));
const klassen = (page) => page.locator("#classSelect option").evaluateAll((os) => os.map((o) => o.value));

/* Twee vakken in het 2de jaar: STEM (2MW) en Techniek (2TWa, 2TWb1),
   met elk één eigen evaluatie. De rest van de evaluaties heeft geen vak. */
async function zetVakkenKlaar(page) {
  return page.evaluate((year) => {
    addSubject(db, year, "STEM");
    addSubject(db, year, "Techniek");
    setSubjectClass(db, year, "STEM", "2MW", true);
    setSubjectClass(db, year, "Techniek", "2TWa", true);
    setSubjectClass(db, year, "Techniek", "2TWb1", true);
    const names = evaluationNames(db, year);
    setEvaluationSubject(db, year, names[0], "STEM");
    setEvaluationSubject(db, year, names[1], "Techniek");
    persist();
    return { stem: names[0], techniek: names[1], alle: names };
  }, JAAR);
}

test("vakken toevoegen, klassen aanduiden en verwijderen op het Klaslijsten-scherm", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSettings");
  await page.click("#btnRoster");
  await page.selectOption("#subjectYear", JAAR);
  await expect(page.locator("#subjectList")).toContainText("Nog geen vakken");

  await page.fill("#subjectName", "  STEM-wetenschappen ");
  await page.click("#btnAddSubject");
  await page.fill("#subjectName", "Techniek");
  await page.keyboard.press("Enter");
  await expect(page.locator("#subjectList .subject-name")).toHaveText(["STEM-wetenschappen", "Techniek"]);

  // Dubbel (ook met andere hoofdletters) wordt geweigerd.
  await page.fill("#subjectName", "techniek");
  await page.click("#btnAddSubject");
  expect(await page.evaluate((y) => subjectNames(db, y), JAAR)).toEqual(["STEM-wetenschappen", "Techniek"]);

  const rij = page.locator(".subject-row", { hasText: "Techniek" });
  await rij.locator("button.chip-toggle", { hasText: "2TWa" }).click();
  await expect(rij.locator("button.chip-toggle", { hasText: "2TWa" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate((y) => findSubject(db, y, "Techniek").classes, JAAR)).toEqual(["2TWa"]);
  await rij.locator("button.chip-toggle", { hasText: "2TWa" }).click();
  expect(await page.evaluate((y) => findSubject(db, y, "Techniek").classes, JAAR)).toEqual([]);

  // Verwijderen: de evaluatie van het vak blijft, zonder vak.
  const naam = await page.evaluate((y) => {
    const n = evaluationNames(db, y)[0];
    setEvaluationSubject(db, y, n, "Techniek");
    return n;
  }, JAAR);
  await rij.locator("button", { hasText: "Vak verwijderen" }).click();
  await page.click("#btnDelScopeEveryone");
  await expect(page.locator("#subjectList .subject-name")).toHaveText(["STEM-wetenschappen"]);
  const na = await page.evaluate(({ y, n }) => ({ ev: getEvaluation(db, y, n).subject, tomb: !!db.tombstones.subjects[y + "||Techniek"] }), { y: JAAR, n: naam });
  expect(na).toEqual({ ev: "", tomb: true });
  page.expectNoErrors();
});

test("Evalueren: zonder vakken geen keuzelijst Vak, alles zoals vroeger", async ({ page }) => {
  await openTool(page);
  await page.selectOption("#yearSelect", JAAR);
  await expect(page.locator("#subjectWrap")).toBeHidden();
  page.expectNoErrors();
});

test("Evalueren: een vak toont enkel zijn klassen en evaluaties", async ({ page }) => {
  await openTool(page);
  const ev = await zetVakkenKlaar(page);
  await page.selectOption("#yearSelect", JAAR);
  await expect(page.locator("#subjectWrap")).toBeVisible();
  await expect(page.locator("#subjectSelect option")).toHaveText(["Alle vakken", "STEM", "Techniek"]);

  // Alle vakken: alles.
  expect(await klassen(page)).toContain("2TWc2");
  await page.click("#evalComboInput");
  expect(await opties(page)).toHaveLength(ev.alle.length);
  await page.keyboard.press("Escape");

  await page.selectOption("#subjectSelect", "Techniek");
  expect(await klassen(page)).toEqual(["2TWa", "2TWb1"]);
  await page.click("#evalComboInput");
  expect(zonderVinkje(await opties(page))).toEqual([ev.techniek]);
  await page.keyboard.press("Escape");

  await page.selectOption("#subjectSelect", "STEM");
  expect(await klassen(page)).toEqual(["2MW"]);
  await page.click("#evalComboInput");
  expect(zonderVinkje(await opties(page))).toEqual([ev.stem]);
  page.expectNoErrors();
});

test("Evalueren: een vak zonder evaluaties geeft een duidelijke melding", async ({ page }) => {
  await openTool(page);
  await page.evaluate((y) => { addSubject(db, y, "Leeg vak"); persist(); }, JAAR);
  await page.selectOption("#yearSelect", JAAR);
  await page.selectOption("#subjectSelect", "Leeg vak");
  // Geen klassen aangeduid: alle klassen blijven zichtbaar.
  expect(await klassen(page)).toContain("2MW");
  await page.click("#evalComboInput");
  await expect(page.locator("#evalComboPanel")).toContainText("Nog geen evaluaties voor dit vak");
  page.expectNoErrors();
});

test("Evalueren: van vak veranderen sluit een beoordeling die niet bij het vak hoort", async ({ page }) => {
  await openTool(page);
  const ev = await zetVakkenKlaar(page);
  await page.selectOption("#yearSelect", JAAR);
  await page.selectOption("#subjectSelect", "Techniek");
  await page.selectOption("#classSelect", ["2TWa"]);
  await page.selectOption("#evalSelect", ev.techniek);
  await expect(page.locator("#formCard")).toBeVisible();

  await page.selectOption("#subjectSelect", "STEM");
  await expect(page.locator("#formCard")).toBeHidden();

  // Terug naar alle vakken: niets verborgen, dus een open beoordeling blijft.
  await page.selectOption("#subjectSelect", "");
  await page.selectOption("#classSelect", ["2TWa"]);
  await page.selectOption("#evalSelect", ev.techniek);
  await expect(page.locator("#formCard")).toBeVisible();
  await page.selectOption("#subjectSelect", "Techniek");
  await expect(page.locator("#formCard")).toBeVisible();
  page.expectNoErrors();
});

test("Evalueren: het gekozen vak blijft onthouden na herladen", async ({ page }) => {
  await openTool(page);
  await zetVakkenKlaar(page);
  await page.selectOption("#yearSelect", JAAR);
  await page.selectOption("#subjectSelect", "Techniek");
  await page.reload();
  await page.selectOption("#yearSelect", JAAR);
  await expect(page.locator("#subjectSelect")).toHaveValue("Techniek");
  page.expectNoErrors();
});

test("Nu beoordelen opent de evaluatie ook als een ander vak gekozen is", async ({ page }) => {
  await openTool(page);
  const ev = await zetVakkenKlaar(page);
  await page.selectOption("#yearSelect", JAAR);
  await page.selectOption("#subjectSelect", "STEM");
  await page.evaluate(({ y, n }) => openEvaluationFor(y, "2TWa", n), { y: JAAR, n: ev.techniek });
  await expect(page.locator("#subjectSelect")).toHaveValue("Techniek");
  await expect(page.locator("#formCard")).toBeVisible();
  await expect(page.locator("#formTitle")).toHaveText("2TWa: " + ev.techniek);
  page.expectNoErrors();
});

test("Rubrics: vak kiezen in de editor, filteren en per evaluatie aanpassen", async ({ page }) => {
  await openTool(page);
  const ev = await zetVakkenKlaar(page);
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", JAAR);
  await expect(page.locator("#evalListSubjectWrap")).toBeVisible();

  await page.selectOption("#evalListSubject", "Techniek");
  await expect(page.locator("#evalList .eval-row .name")).toHaveText([ev.techniek]);
  await page.selectOption("#evalListSubject", " geen");
  await expect(page.locator("#evalList .eval-row .name")).toHaveCount(ev.alle.length - 2);

  // Vak aanpassen in de lijst zelf.
  await page.selectOption("#evalListSubject", "");
  const rij = page.locator(".eval-row", { has: page.locator(".name", { hasText: ev.alle[2] }) }).first();
  await rij.locator("select.eval-subject-select").selectOption("STEM");
  expect(await page.evaluate(({ y, n }) => getEvaluation(db, y, n).subject, { y: JAAR, n: ev.alle[2] })).toBe("STEM");

  // Nieuwe evaluatie terwijl er op Techniek gefilterd is: vak staat al goed.
  await page.selectOption("#evalListSubject", "Techniek");
  await page.click("#btnNewEval");
  await expect(page.locator("#draftSubject")).toHaveValue("Techniek");
  await expect(page.locator("#draftSubject option")).toHaveText(["Geen vak", "STEM", "Techniek"]);
  await page.click("#btnCancelEval");

  // Dupliceren neemt het vak over; een ander vak kiezen en opslaan.
  await page.locator(".eval-row", { hasText: ev.techniek }).locator("button", { hasText: "Dupliceer" }).click();
  await expect(page.locator("#draftSubject")).toHaveValue("Techniek");
  await page.fill("#draftName", "Brug bouwen");
  await page.selectOption("#draftSubject", "STEM");
  await page.click("#btnSaveEval");
  expect(await page.evaluate((y) => getEvaluation(db, y, "Brug bouwen").subject, JAAR)).toBe("STEM");

  // Bewerken toont het vak; een leerjaar zonder vakken schakelt de lijst uit.
  await page.selectOption("#evalListSubject", "STEM");
  await page.locator(".eval-row", { hasText: "Brug bouwen" }).locator("button", { hasText: "Bewerk" }).click();
  await expect(page.locator("#draftSubject")).toHaveValue("STEM");
  await page.selectOption("#draftYear", "1ste jaar");
  await expect(page.locator("#draftSubject")).toBeDisabled();
  await expect(page.locator("#draftSubjectHint")).toContainText("Klaslijsten");
  page.expectNoErrors();
});

test("vakken en het vak van een evaluatie overleven opslaan, openen en samenvoegen", async ({ page }) => {
  await openTool(page);
  const res = await page.evaluate((y) => {
    addSubject(db, y, "STEM");
    setSubjectClass(db, y, "STEM", "2MW", true);
    const n = evaluationNames(db, y)[0];
    setEvaluationSubject(db, y, n, "STEM");
    const heropend = normaliseDb(JSON.parse(JSON.stringify(db)));

    // Collega voegt een klas toe aan STEM en maakt een vak Techniek.
    const collega = normaliseDb(JSON.parse(JSON.stringify(db)));
    const s = collega.subjects[y].find((x) => x.name === "STEM");
    s.classes = ["2MW", "2TWa"];
    s.updatedAt = Date.now() + 1000;
    collega.subjects[y].push({ name: "Techniek", classes: [], updatedAt: Date.now() + 1000 });

    const mijn = normaliseDb(JSON.parse(JSON.stringify(db)));
    mergeDb(mijn, collega);
    return {
      heropendVakken: heropend.subjects[y],
      heropendVak: heropend.evaluations[y][n].subject,
      samen: mijn.subjects[y].map((x) => x.name + ":" + x.classes.join(",")),
    };
  }, JAAR);
  expect(res.heropendVakken.map((s) => s.name + ":" + s.classes.join(","))).toEqual(["STEM:2MW"]);
  expect(res.heropendVak).toBe("STEM");
  expect(res.samen).toEqual(["STEM:2MW,2TWa", "Techniek:"]);
  page.expectNoErrors();
});

test("een vak dat voor iedereen verwijderd is, komt niet terug bij samenvoegen", async ({ page }) => {
  await openTool(page);
  const res = await page.evaluate((y) => {
    addSubject(db, y, "STEM");
    const collega = normaliseDb(JSON.parse(JSON.stringify(db)));
    deleteSubject(db, y, "STEM", "iedereen");
    mergeDb(db, collega);
    const bijMij = subjectNames(db, y);
    // En omgekeerd: de collega leest mijn bestand met de tombstone.
    mergeDb(collega, normaliseDb(JSON.parse(JSON.stringify(db))));
    return { bijMij: bijMij, bijCollega: collega.subjects[y].map((s) => s.name) };
  }, JAAR);
  expect(res).toEqual({ bijMij: [], bijCollega: [] });
  page.expectNoErrors();
});

test("het opgeslagen bestand bevat de vakken", async ({ page }) => {
  await openTool(page);
  const json = await page.evaluate(async (y) => {
    addSubject(db, y, "STEM");
    return JSON.parse(await dbBlob().text());
  }, JAAR);
  expect(json.subjects[JAAR].map((s) => s.name)).toEqual(["STEM"]);
  page.expectNoErrors();
});
