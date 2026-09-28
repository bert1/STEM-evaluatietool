const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* Zet beoordelingen klaar voor 1WM (1ste jaar) op vaste datums:
   eval 0 op 15 sep (GE1), eval 1 op 30 sep + 2 okt (GE1, met een
   tussentijdse check die niet mag meetellen), eval 2 op 20 okt (GE2). */
async function seedRows(page) {
  return page.evaluate(() => {
    const year = "1ste jaar", klas = "1WM";
    const names = evaluationNames(db, year);
    const students = studentsFor(db, year, klas).slice().sort((a, b) => a.localeCompare(b, "nl"));
    const t = (iso) => new Date(iso + "T10:00:00").getTime();
    function add(ev, iso, studs, extra) {
      const rubrics = rubricsFor(db, year, ev);
      const scores = {};
      rubrics.forEach((r) => { scores[r.id] = Math.max(...r.options.map((o) => o.score)); });
      const key = sessionKey(year, klas, ev);
      (db.sessions[key] = db.sessions[key] || []).push(Object.assign({
        id: "r" + Math.random(), assessor: "TST", students: studs, scores,
        studentKlas: Object.fromEntries(studs.map((s) => [s, klas])),
        createdAt: t(iso), updatedAt: t(iso), corrections: {},
      }, extra || {}));
    }
    students.slice(0, 4).forEach((s) => add(names[0], "2026-09-15", [s]));
    add(names[1], "2026-09-30", students.slice(0, 2));
    add(names[1], "2026-10-02", students.slice(2, 4), { formative: true });
    add(names[2], "2026-10-20", students.slice(0, 1));
    persist();
    return { names, students, max: names.map((n) => maxScoreOf(rubricsFor(db, year, n))) };
  });
}

async function openSkoreFor(page, periodIndex) {
  await page.click("#btnSkore");
  await page.selectOption("#skoreYear", "1ste jaar");
  await page.selectOption("#skoreKlas", "1WM");
  await page.selectOption("#skorePeriod", String(periodIndex));
}

test("periodes: standaardindeling, einddatums en welke periode bij een datum hoort", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const p = defaultPeriods("2026-2027");
    return {
      ranges: periodRanges(p).map((x) => x.name + " " + x.start + " " + x.end),
      idx: ["2026-09-01", "2026-10-10", "2026-10-11", "2026-12-13", "2027-02-27", "2027-02-28", "2027-06-13", "2027-06-14", "2026-08-31"]
        .map((d) => periodIndexFor(d, p)),
    };
  });
  expect(r.ranges).toEqual([
    "GE1 2026-09-01 2026-10-10",
    "GE2 2026-10-11 2026-12-12",
    "GE3 2026-12-13 2027-02-27",
    "GE4 2027-02-28 2027-06-13",
  ]);
  expect(r.idx).toEqual([0, 0, 1, 2, 2, 3, 3, -1, -1]);
});

test("overzicht per klas en periode, zonder tussentijdse checks", async ({ page }) => {
  await openTool(page);
  const d = await seedRows(page);
  await openSkoreFor(page, 0);

  await expect(page.locator(".skore-summary")).toContainText("2 evaluatie(s) voor 1WM in GE1");
  const koppen = await page.locator(".skore-table th .skore-th-name").allInnerTexts();
  expect(koppen).toEqual([d.names[0], d.names[1]]);

  const rij = (i) => page.locator(".skore-table tbody tr").nth(i).locator("td");
  await expect(rij(0).nth(0)).toHaveText("1. " + d.students[0]);
  await expect(rij(0).nth(1)).toHaveText(String(d.max[0]));
  await expect(rij(2).nth(2)).toHaveText("–"); // tussentijdse check telt niet mee
  await expect(page.locator(".skore-table tbody tr")).toHaveCount(d.students.length);

  await page.click("#skoreNext");
  await expect(page.locator(".skore-summary")).toContainText("1 evaluatie(s) voor 1WM in GE2");
  await page.click("#skoreNext");
  await expect(page.locator("#skoreBody")).toContainText("Geen beoordelingen voor 1WM in GE3");
  page.expectNoErrors();
});

test("omrekenen naar 10", async ({ page }) => {
  await openTool(page);
  const d = await seedRows(page);
  await openSkoreFor(page, 0);
  await page.selectOption("#skoreScale", "10");
  await expect(page.locator(".skore-table th .skore-th-max").first()).toHaveText("/10");
  await expect(page.locator(".skore-table tbody tr").first().locator("td").nth(1)).toHaveText("10");
  await expect(page.locator(".skore-evals tbody tr").first().locator("td").nth(4)).toHaveText("10 (van " + d.max[0] + ")");
  await expect(page.locator(".skore-evals button")).toHaveCount(0); // geen kopieerknop: plakken kan niet in Skore
});

test("overgezet naar Skore aanvinken blijft bewaard", async ({ page }) => {
  await openTool(page);
  await seedRows(page);
  await openSkoreFor(page, 0);
  await page.locator(".skore-done-toggle input").first().check();
  await expect(page.locator(".skore-summary")).toContainText("1 van de 2 al overgezet");
  await page.reload();
  await openSkoreFor(page, 0);
  await expect(page.locator(".skore-done-toggle input").first()).toBeChecked();
  await expect(page.locator(".skore-evals tbody tr").first()).toHaveClass(/skore-done/);
});

test("periodes aanpassen, met controle op de volgorde", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSkore");
  await page.click("#skorePeriodsWrap summary");
  await expect(page.locator("#skorePeriodEditor")).toContainText("voorgestelde data");

  await page.locator(".period-start").nth(1).fill("2026-08-01");
  await page.click("#btnSavePeriods");
  await expect(page.locator("#notice")).toContainText("GE2 begint niet na GE1");

  await page.locator(".period-start").nth(1).fill("2026-10-20");
  await page.click("#btnSavePeriods");
  await expect(page.locator("#notice")).toContainText("Periodes opgeslagen");
  await expect(page.locator("#skorePeriod option").nth(0)).toContainText("t/m 19 okt");
  await page.reload();
  await page.click("#btnSkore");
  await expect(page.locator("#skorePeriod option").nth(1)).toContainText("GE2 (20 okt");
  page.expectNoErrors();
});

test("een bewerkte beoordeling houdt haar oorspronkelijke datum", async ({ page }) => {
  await openTool(page);
  await page.fill("#assessor", "TST");
  await page.selectOption("#yearSelect", "1ste jaar");
  await page.click("#klasMultiInput");
  await page.locator("#klasMultiPanel .klas-multi-option").first().click();
  await page.click("#evalComboInput");
  await page.locator("#evalComboPanel .eval-combo-option").first().click();
  await page.locator("#studentGrid .student-cb").first().check();
  const kaarten = page.locator("#rubrics .rubric-card");
  for (let i = 0; i < (await kaarten.count()); i++) await kaarten.nth(i).locator(".option-btn").last().click();
  await page.click("#btnSave");

  const eerst = await page.evaluate(() => {
    const r = rows()[0];
    r.createdAt = new Date("2026-09-10T10:00:00").getTime(); // alsof dit al eerder gebeurde
    return r.createdAt;
  });
  await page.evaluate(() => { editRow(rows()[0].id); });
  await page.click("#btnSave");
  const na = await page.evaluate(() => ({ createdAt: rows()[0].createdAt, updatedAt: rows()[0].updatedAt }));
  expect(na.createdAt).toBe(eerst);
  expect(na.updatedAt).toBeGreaterThan(eerst);

  // ook na herladen (normaliseDb) blijft de datum staan
  await page.reload();
  const bewaard = await page.evaluate(() => Object.values(db.sessions).flat()[0].createdAt);
  expect(bewaard).toBe(eerst);
  page.expectNoErrors();
});

test("samenvoegen: nieuwste periodes winnen, overgezet-vinkjes gaan nooit verloren", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const bucket = { roster: {}, sessions: {} };
    mergePeriods(bucket, { list: [{ name: "A", start: "2026-09-01" }], end: "2027-06-30", updatedAt: 10 });
    mergePeriods(bucket, { list: [{ name: "OUD", start: "2026-09-01" }], end: "2027-06-30", updatedAt: 5 });
    mergePeriods(bucket, { list: [], end: "", updatedAt: 99 });
    mergeSkoreDone(bucket, { k1: { done: true, updatedAt: 10 }, k2: { done: true, updatedAt: 10 } });
    mergeSkoreDone(bucket, { k1: { done: false, updatedAt: 20 }, k2: { done: false, updatedAt: 5 } });
    mergeSkoreDone(bucket, {});
    return { naam: bucket.periods.list[0].name, k1: bucket.skoreDone.k1.done, k2: bucket.skoreDone.k2.done };
  });
  expect(r).toEqual({ naam: "A", k1: false, k2: true });
});

test("een laat toggle-event wist geen net ingevulde periodedatum (trage computer)", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSkore");
  await page.click("#skorePeriodsWrap summary");
  await page.locator(".period-start").nth(1).fill("2026-08-01");
  // Op een trage computer komt het toggle-event van het openklappen pas nu.
  await page.evaluate(() => $("skorePeriodsWrap").dispatchEvent(new Event("toggle")));
  await expect(page.locator(".period-start").nth(1)).toHaveValue("2026-08-01");
  await page.click("#btnSavePeriods");
  await expect(page.locator("#notice")).toContainText("GE2 begint niet na GE1");
  page.expectNoErrors();
});

test("niet-bewaarde periodes vervallen na dichtklappen", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSkore");
  await page.click("#skorePeriodsWrap summary");
  await page.locator(".period-start").nth(1).fill("2026-10-25");
  await page.click("#skorePeriodsWrap summary"); // dicht, zonder opslaan
  await page.click("#skorePeriodsWrap summary"); // weer open
  await expect(page.locator(".period-start").nth(1)).toHaveValue("2026-10-11");
  page.expectNoErrors();
});

test("een vrijgestelde leerling staat als 'vrijgesteld' in Skore en telt mee als afgewerkt", async ({ page }) => {
  await openTool(page);
  const d = await seedRows(page);
  // eval 0: leerlingen 0 tot 3 beoordeeld; leerling 4 vrijstellen
  await page.evaluate(([ev, s]) => { setExemption("1ste jaar", ev, "1WM", s, "ziek"); persist(); }, [d.names[0], d.students[4]]);
  await openSkoreFor(page, 0);
  const cel = page.locator(".skore-table tbody tr").nth(4).locator("td").nth(1);
  await expect(cel).toHaveText("vrijgesteld");
  await expect(cel).toHaveAttribute("title", "Niet te beoordelen: ziek");
  await expect(page.locator(".skore-table tbody tr").nth(5).locator("td").nth(1)).toHaveText("–");
  await expect(page.locator(".skore-evals tbody tr").first().locator("td").nth(3))
    .toHaveText("4/" + d.students.length + ", 1 vrijgesteld");

  // ongedaan maken: terug een streepje
  await page.evaluate(([ev, s]) => { clearExemption("1ste jaar", ev, "1WM", s); persist(); }, [d.names[0], d.students[4]]);
  await page.selectOption("#skoreKlas", "1WTa");
  await page.selectOption("#skoreKlas", "1WM");
  await expect(page.locator(".skore-table tbody tr").nth(4).locator("td").nth(1)).toHaveText("–");
  page.expectNoErrors();
});
