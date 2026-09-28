/* De belangrijkste regel van de tool: samenvoegen verwijdert nooit iets,
   het voegt enkel toe of werkt bij op basis van een tijdstempel. Zie
   "Databeveiliging" in HANDOFF.md. */
const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

test("een leeg team van een nieuwe collega wist het bestaande team niet", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const target = { team: { members: { AB: { name: "Anne" }, CD: { name: "" } }, classes: { "1ste jaar||1WM": ["AB"] }, updatedAt: 5 } };
    mergeTeam(target, { members: {}, classes: {}, updatedAt: Date.now() });
    mergeTeam(target, { members: { CD: { name: "Chris" }, AB: { name: "Iemand anders" } }, classes: { "1ste jaar||1WM": ["CD"] } });
    return target.team;
  });
  expect(r.members.AB.name).toBe("Anne");
  expect(r.members.CD.name).toBe("Chris");
  expect(r.classes["1ste jaar||1WM"].sort()).toEqual(["AB", "CD"]);
});

test("zonder echte tombstone is een item met updatedAt 0 niet verwijderd", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => [
    isTombstoned("roster", "bestaat-niet", 0),
    isTombstoned("roster", "bestaat-niet", 123),
  ]);
  expect(r).toEqual([false, false]);
});

test("werk van een collega toevoegen behoudt je eigen rijen en neemt nieuwere versies over", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const jaar = db.currentSchoolYear;
    const key = "1ste jaar||1WM||Test";
    const bestand = (rijen) => {
      const d = JSON.parse(JSON.stringify(db));
      d.schoolYears[jaar].sessions = { [key]: rijen };
      return d;
    };
    const mijn = bestand([
      { id: "mijn-1", assessor: "AB", students: ["X"], scores: {}, updatedAt: 10 },
      { id: "gedeeld", assessor: "AB", students: ["Z"], scores: {}, updatedAt: 10, versie: "oud" },
    ]);
    const collega = bestand([
      { id: "coll-1", assessor: "CD", students: ["Y"], scores: {}, updatedAt: 20 },
      { id: "gedeeld", assessor: "AB", students: ["Z"], scores: {}, updatedAt: 30, versie: "nieuw" },
    ]);
    const leeg = bestand([]);
    mergeDb(mijn, collega);
    mergeDb(mijn, leeg);
    const rijen = mijn.schoolYears[jaar].sessions[key];
    return { ids: rijen.map((row) => row.id).sort(), gedeeld: rijen.find((row) => row.id === "gedeeld").versie };
  });
  expect(r.ids).toEqual(["coll-1", "gedeeld", "mijn-1"]);
  expect(r.gedeeld).toBe("nieuw");
});
