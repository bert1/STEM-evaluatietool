const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* Stap 1: de dekkingstelling moet de echte klas per leerling gebruiken
   (row.studentKlas), niet enkel sessies met exact één klas. */
test.describe("telling per klas (coverageMatrix)", () => {
  test("een combinatiesessie telt mee voor elke echte klas", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const a = studentsFor(db, year, "1WM")[0];
      const b = studentsFor(db, year, "1WTa")[0];
      db.sessions[sessionKey(year, "1WM+1WTa", ev)] = [{
        id: "combi", assessor: "TST", students: [a, b], scores: {},
        studentKlas: { [a]: "1WM", [b]: "1WTa" }, createdAt: Date.now(), updatedAt: Date.now(),
      }];
      const cov = coverageMatrix(db, year);
      return [cov.cells["1WM||" + ev].done, cov.cells["1WTa||" + ev].done, cov.cells["1WM||" + ev].started];
    });
    expect(r).toEqual([1, 1, true]);
  });

  test("een leerling die van klas veranderde telt bij de nieuwe klas", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const [a, b] = studentsFor(db, year, "1WM");
      // Groepsrij blijft in de sessie van 1WM staan, maar b zit nu in 1WTa.
      db.roster[year]["1WM"].students = db.roster[year]["1WM"].students.filter((s) => s !== b);
      db.roster[year]["1WTa"].students.push(b);
      db.sessions[sessionKey(year, "1WM", ev)] = [{
        id: "groep", assessor: "TST", students: [a, b], scores: {},
        studentKlas: { [a]: "1WM", [b]: "1WTa" }, createdAt: Date.now(), updatedAt: Date.now(),
      }];
      const cov = coverageMatrix(db, year);
      return [cov.cells["1WM||" + ev].done, cov.cells["1WTa||" + ev].done, cov.cells["1WTa||" + ev].started];
    });
    expect(r).toEqual([1, 1, true]);
  });

  test("oudere rijen zonder studentKlas vallen terug op de klas van de sessie", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const a = studentsFor(db, year, "1WM")[0];
      db.sessions[sessionKey(year, "1WM", ev)] = [{ id: "oud", assessor: "TST", students: [a], scores: {}, updatedAt: 1 }];
      return coverageMatrix(db, year).cells["1WM||" + ev].done;
    });
    expect(r).toBe(1);
  });
});
