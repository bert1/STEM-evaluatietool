const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

async function kiesKlasEnEvaluatie(page) {
  await page.selectOption("#yearSelect", "1ste jaar");
  await page.click("#klasMultiInput");
  await page.locator("#klasMultiPanel .klas-multi-option").first().click();
  await page.click("#evalComboInput");
  await page.locator("#evalComboPanel .eval-combo-option").first().click();
}

test("een leerling beoordelen, opslaan en terugzien bij Controle", async ({ page }) => {
  await openTool(page);
  await kiesKlasEnEvaluatie(page);

  const leerling = (await page.locator("#studentGrid .student").first().innerText()).split("\n")[0].trim();
  await page.locator("#studentGrid .student-cb").first().check();
  const kaarten = page.locator("#rubrics .rubric-card");
  const n = await kaarten.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await kaarten.nth(i).locator(".option-btn").last().click();
  await page.click("#btnSave");

  expect(await page.evaluate(() => rows().length)).toBe(1);
  await expect(page.locator("#tableBody")).toContainText(leerling);

  await page.click("#btnResults");
  await page.selectOption("#resYear", "1ste jaar");
  // Eén leerling beoordeeld: de evaluatie is gestart maar nog niet in orde.
  const item = page.locator(".controle-open").first();
  await expect(item).toContainText("1/");
  await item.locator(".controle-detail-btn").click();
  const rij = page.locator(".controle-table tr", { hasText: leerling });
  await expect(rij.locator(".status-badge")).toHaveText("In orde");
  await expect(rij.locator("button", { hasText: "Rapport" })).toBeVisible();
  page.expectNoErrors();
});

test("na het opslaan wordt geen volgende leerling aangevinkt", async ({ page }) => {
  await openTool(page);
  await kiesKlasEnEvaluatie(page);
  await page.locator("#studentGrid .student-cb").nth(2).check();
  const kaarten = page.locator("#rubrics .rubric-card");
  const n = await kaarten.count();
  for (let i = 0; i < n; i++) await kaarten.nth(i).locator(".option-btn").last().click();
  await page.click("#btnSave");

  expect(await page.evaluate(() => rows().length)).toBe(1);
  await expect(page.locator("#studentGrid .student-cb:checked")).toHaveCount(0);
  page.expectNoErrors();
});

test("opslaan zonder alle criteria geeft een duidelijke melding", async ({ page }) => {
  await openTool(page);
  await kiesKlasEnEvaluatie(page);
  await page.locator("#studentGrid .student-cb").first().check();
  await page.click("#btnSave");
  await expect(page.locator("#notice")).toContainText("Nog niet alle criteria gescoord");
  expect(await page.evaluate(() => rows().length)).toBe(0);
  page.expectNoErrors();
});

/* Sinds 1.34.2: in een combinatie van klassen bleef na het heropenen van
   de tool enkel de laatst opgeslagen leerling als "al beoordeeld" staan,
   omdat de klas per leerling (row.studentKlas) bij het inlezen wegviel. */
async function kiesTweeKlassen(page, jaar = "1ste jaar") {
  await page.selectOption("#yearSelect", jaar);
  await page.click("#klasMultiInput");
  await page.locator("#klasMultiPanel .klas-multi-option").nth(0).click();
  await page.locator("#klasMultiPanel .klas-multi-option").nth(1).click();
  await page.click("#evalComboInput");
  await page.locator("#evalComboPanel .eval-combo-option").first().click();
}

async function beoordeel(page, index) {
  await page.locator("#studentGrid .student-cb").nth(index).check();
  const kaarten = page.locator("#rubrics .rubric-card");
  const n = await kaarten.count();
  for (let i = 0; i < n; i++) await kaarten.nth(i).locator(".option-btn").last().click();
  await page.click("#btnSave");
}

test("beoordeelde leerlingen: naam van de beoordelaar blijft, vinkje uitgeschakeld, ook na heropenen", async ({ page }) => {
  await openTool(page);
  await kiesTweeKlassen(page);
  expect(await page.evaluate(() => cur.klassen.length)).toBe(2);
  await beoordeel(page, 0);
  await beoordeel(page, 3);

  const controleer = async () => {
    for (const i of [0, 3]) {
      const rij = page.locator("#studentGrid .student").nth(i);
      await expect(rij.locator(".who")).toHaveText("TST");
      await expect(rij.locator(".student-cb")).toBeDisabled();
    }
    await expect(page.locator("#studentGrid .student").nth(1).locator(".student-cb")).toBeEnabled();
    await expect(page.locator("#progressText")).toContainText("2 van");
  };
  await controleer();

  await page.reload();
  await expect(page.locator("#setupWizard")).toBeHidden();
  await kiesTweeKlassen(page);
  expect(await page.evaluate(() => rows().every((r) => r.studentKlas && Object.keys(r.studentKlas).length === 1))).toBe(true);
  await controleer();

  // Bewerken maakt de leerling van die rij weer aan te vinken.
  await page.locator("#tableBody tr").first().locator("button", { hasText: "Bewerk" }).click();
  await expect(page.locator("#studentGrid .student-cb:checked")).toHaveCount(1);
  await expect(page.locator("#studentGrid .student-cb:checked")).toBeEnabled();
  page.expectNoErrors();
});

test("oudere rij zonder klas per leerling in een combinatie: toch herkend via de klaslijst", async ({ page }) => {
  await openTool(page);
  await kiesTweeKlassen(page);
  await beoordeel(page, 0);
  await beoordeel(page, 3);
  await page.evaluate(() => {
    rows().forEach((r) => { delete r.studentKlas; });
    renderStudents();
  });
  for (const i of [0, 3]) {
    await expect(page.locator("#studentGrid .student").nth(i).locator(".student-cb")).toBeDisabled();
  }
  await expect(page.locator("#progressText")).toContainText("2 van");
  page.expectNoErrors();
});

/* Sinds 1.34.3: de groeigrafiek van de leerplandoelen telt een
   beoordeling in een combinatie van klassen mee bij de echte klas van
   elke leerling, niet enkel bij sessies van die ene klas. */
test("groeigrafiek: een combinatie van klassen telt mee bij elke klas", async ({ page }) => {
  await openTool(page);
  await kiesTweeKlassen(page, "2de jaar"); // enkel het 2de jaar heeft leerplandoelen
  expect(await page.evaluate(() => cur.klassen.length)).toBe(2);
  await beoordeel(page, 0);
  const uitkomst = await page.evaluate(() => {
    const year = cur.year;
    const goalKey = goalsForYear(year)[0].id;
    const ev = getEvaluation(db, year, cur.evaluation);
    ev.rubrics.forEach((r) => { r.goals = [goalKey]; });
    const name = rows()[0].students[0];
    const klasVan = cur.studentKlasMap[name];
    const andere = cur.klassen.find((k) => k !== klasVan);
    return {
      eigen: goalTrendSeries(db, year, goalKey, klasVan, null).length,
      leerling: goalTrendSeries(db, year, goalKey, klasVan, name).length,
      andere: goalTrendSeries(db, year, goalKey, andere, null).length,
    };
  });
  expect(uitkomst).toEqual({ eigen: 1, leerling: 1, andere: 0 });
  page.expectNoErrors();
});

/* Sinds 1.35.0: alle leerlingen samen in beeld, zonder schuifbalk, en
   bij twee klassen loopt geen naam over twee regels. */
test("leerlingenlijst: geen schuifbalk en elke naam op één regel, ook bij twee klassen", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openTool(page);
  for (const tweeKlassen of [false, true]) {
    if (tweeKlassen) await kiesTweeKlassen(page);
    else await kiesKlasEnEvaluatie(page);
    if (!tweeKlassen) await beoordeel(page, 0);
    const maat = await page.evaluate(() => {
      const grid = document.getElementById("studentGrid");
      const labels = Array.from(grid.querySelectorAll(".student"));
      return {
        aantal: labels.length,
        klassen: cur.klassen.length,
        schuift: grid.scrollHeight > grid.clientHeight + 1,
        hoogtes: [...new Set(labels.map((l) => Math.round(l.getBoundingClientRect().height)))],
        afgekapt: labels.map((l) => l.querySelector(".student-name"))
          .filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
      };
    });
    expect(maat.klassen).toBe(tweeKlassen ? 2 : 1);
    expect(maat.aantal).toBeGreaterThan(10);
    expect(maat.schuift).toBe(false);
    expect(maat.hoogtes).toHaveLength(1);
    expect(maat.afgekapt).toEqual([]);
    if (!tweeKlassen) await page.reload();
  }
  page.expectNoErrors();
});

/* Sinds 1.35.0: de teller per beoordelaar telt ook beoordelingen die in
   een andere klaskeuze gemaakt zijn, net als "x van y beoordeeld". */
test("teller per beoordelaar telt beoordelingen uit een combinatie van klassen mee", async ({ page }) => {
  await openTool(page);
  await kiesTweeKlassen(page);
  await beoordeel(page, 0);
  const sel = await page.evaluate(() => ({ year: cur.year, evaluation: cur.evaluation, klas: cur.studentKlasMap[rows()[0].students[0]] }));
  await page.evaluate((s) => openEvaluationFor(s.year, s.klas, s.evaluation), sel);
  expect(await page.evaluate(() => cur.klassen.length)).toBe(1);
  await expect(page.locator("#progressText")).toContainText("1 van");
  await expect(page.locator("#teamProgress .who-chip", { hasText: "TST" })).toHaveText("TST: 1");
  page.expectNoErrors();
});
