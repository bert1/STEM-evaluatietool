const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

test.describe("beschadigde browseropslag", () => {
  test.beforeEach(async ({ page }) => {
    await openTool(page);
    await page.evaluate(() => localStorage.setItem("STEM_EVAL_DB_V3", '{"kapot": '));
    await page.reload();
  });

  test("wordt niet stil gewist, en de rode balk verschijnt", async ({ page }) => {
    await expect(page.locator("#safetyBar")).toBeVisible();
    await expect(page.locator("#safetyBar")).toHaveClass(/error/);
    await expect(page.locator("#safetyBar")).toContainText("kon niet gelezen worden");
    expect(await page.evaluate(() => localStorage.getItem("STEM_EVAL_DB_V3_BESCHADIGD"))).toBe('{"kapot": ');
  });

  test("reservekopie blijft bewaard na een wijziging en na herladen", async ({ page }) => {
    await page.evaluate(() => persist());
    await page.reload();
    await expect(page.locator("#safetyBar")).toContainText("kon niet gelezen worden");
    expect(await page.evaluate(() => localStorage.getItem("STEM_EVAL_DB_V3_BESCHADIGD"))).toBe('{"kapot": ');
  });

  test("reservekopie downloaden geeft de oorspronkelijke inhoud", async ({ page }) => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Reservekopie downloaden")]);
    expect(dl.suggestedFilename()).toMatch(/^stem-evaluaties-reservekopie-\d{4}-\d{2}-\d{2}\.json$/);
    expect(require("fs").readFileSync(await dl.path(), "utf8")).toBe('{"kapot": ');
  });

  test("verbergen wist de reservekopie na bevestiging", async ({ page }) => {
    page.once("dialog", (d) => d.accept());
    await page.click("#safetyBar >> text=Verbergen");
    await expect(page.locator("#safetyBar")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("STEM_EVAL_DB_V3_BESCHADIGD"))).toBeNull();
  });
});

/* Een nagemaakt werkbestand: elke schrijfactie duurt 200 ms en kan op
   commando mislukken. */
async function nepBestand(page) {
  await page.evaluate(() => {
    window.__schrijf = { fail: false, writes: 0 };
    fileHandle = {
      name: "test.json",
      createWritable: async () => {
        window.__schrijf.writes++;
        await new Promise((r) => setTimeout(r, 200));
        if (window.__schrijf.fail) throw new Error("mislukt");
        return { write: async () => {}, close: async () => {} };
      },
    };
    fileName = "test.json";
  });
}

test("een wijziging tijdens het schrijven blijft niet-opgeslagen tot ze ook weggeschreven is", async ({ page }) => {
  await openTool(page);
  await nepBestand(page);
  const r = await page.evaluate(async () => {
    const wacht = (ms) => new Promise((res) => setTimeout(res, ms));
    markDirty();
    writeHandle();
    await wacht(50);
    markDirty();
    const tweede = writeHandle();
    await wacht(220);
    const tussen = { dirty, status: $("status").textContent };
    await tweede;
    return { tussen, einde: { dirty, status: $("status").textContent, writes: window.__schrijf.writes } };
  });
  expect(r.tussen.dirty).toBe(true);
  expect(r.tussen.status).toBe("Niet opgeslagen");
  expect(r.einde).toEqual({ dirty: false, status: "Opgeslagen in test.json", writes: 2 });
  page.expectNoErrors();
});

test("mislukte automatische opslag blijft rood tot opnieuw proberen lukt", async ({ page }) => {
  await openTool(page);
  await nepBestand(page);
  await page.evaluate(async () => { window.__schrijf.fail = true; markDirty(); await writeHandle(); });
  await expect(page.locator("#status")).toHaveText("Niet opgeslagen!");
  await expect(page.locator("#status")).toHaveClass(/error/);
  await expect(page.locator("#safetyBar")).toContainText("Automatisch opslaan naar test.json is mislukt");

  await page.evaluate(() => { window.__schrijf.fail = false; });
  await page.click("#safetyBar >> text=Opnieuw proberen");
  await expect(page.locator("#status")).toHaveText("Opgeslagen in test.json");
  await expect(page.locator("#safetyBar")).toBeHidden();
});
