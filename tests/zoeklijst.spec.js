const { test, expect } = require("@playwright/test");
const { openTool, seedFolders } = require("./helpers");

const opties = (page, panel) => page.locator(panel + " .eval-combo-option").allInnerTexts();
const koppen = (page, panel) => page.locator(panel + " .eval-combo-group").allInnerTexts();
const zonderVinkje = (list) => list.map((t) => t.replace(/\s*✓$/, ""));

test.describe("zoeklijst bij Resultaten", () => {
  test.beforeEach(async ({ page }) => {
    await openTool(page);
    await seedFolders(page);
    await page.click("#btnResults");
    await page.selectOption("#resYear", "1ste jaar");
    await page.click("#resEvalComboInput");
  });

  test("toont mappen als koppen, in volgorde", async ({ page }) => {
    const k = await koppen(page, "#resEvalComboPanel");
    expect(k.map((x) => x.toLowerCase())).toEqual(["september", "wetenschappelijk onderzoek", "geen map"]);
    page.expectNoErrors();
  });

  test("zoekt zonder accenten en hoofdletters", async ({ page }) => {
    await page.fill("#resEvalComboInput", "CREME brulee");
    expect(zonderVinkje(await opties(page, "#resEvalComboPanel"))).toEqual(["Crème brûlée proef"]);
  });

  test("zoekt op mapnaam", async ({ page }) => {
    await page.fill("#resEvalComboInput", "septemb");
    expect((await koppen(page, "#resEvalComboPanel")).map((x) => x.toLowerCase())).toEqual(["september"]);
    expect(await opties(page, "#resEvalComboPanel")).toHaveLength(1);
  });

  test("Enter kiest meteen bij één resultaat", async ({ page }) => {
    await page.fill("#resEvalComboInput", "brulee");
    await page.keyboard.press("Enter");
    await expect(page.locator("#resEval")).toHaveValue("Crème brûlée proef");
    await expect(page.locator("#resEvalComboPanel")).toBeHidden();
    await expect(page.locator("#resEvalComboInput")).toHaveAttribute("aria-expanded", "false");
    page.expectNoErrors();
  });

  test("Enter bij meerdere resultaten kiest niets zonder pijltje", async ({ page }) => {
    const voor = await page.inputValue("#resEval");
    await page.fill("#resEvalComboInput", "e");
    await page.keyboard.press("Enter");
    await expect(page.locator("#resEvalComboPanel")).toBeVisible();
    await expect(page.locator("#resEval")).toHaveValue(voor);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#resEvalComboInput")).toHaveAttribute("aria-activedescendant", "resEvalComboPanel-o0");
  });

  test("heeft de ARIA-rollen van een combobox", async ({ page }) => {
    await expect(page.locator("#resEvalComboInput")).toHaveAttribute("role", "combobox");
    await expect(page.locator("#resEvalComboInput")).toHaveAttribute("aria-controls", "resEvalComboPanel");
    await expect(page.locator("#resEvalComboPanel")).toHaveAttribute("role", "listbox");
    await expect(page.locator("#resEvalComboPanel [role=option]").first()).toBeVisible();
  });

  test("de huidige keuze staat gemarkeerd", async ({ page }) => {
    const huidige = await page.inputValue("#resEval");
    await expect(page.locator("#resEvalComboPanel .current")).toHaveAttribute("data-value", huidige);
  });

  test("melding als er niets gevonden wordt", async ({ page }) => {
    await page.fill("#resEvalComboInput", "xyzxyz");
    await expect(page.locator("#resEvalComboPanel")).toContainText("Geen evaluaties of mappen gevonden");
  });
});

test("zoeklijst bij Evalueren werkt op dezelfde manier", async ({ page }) => {
  await openTool(page);
  const names = await seedFolders(page);
  await page.selectOption("#yearSelect", "1ste jaar");
  await page.click("#evalComboInput");
  expect((await koppen(page, "#evalComboPanel")).map((x) => x.toLowerCase())).toEqual(["september", "wetenschappelijk onderzoek", "geen map"]);
  await page.fill("#evalComboInput", "september");
  expect(await opties(page, "#evalComboPanel")).toEqual([names[0]]);
  await page.keyboard.press("Enter");
  await expect(page.locator("#evalSelect")).toHaveValue(names[0]);
  // de onzichtbare <select> heeft dezelfde mapindeling
  const groepen = await page.$$eval("#evalSelect optgroup", (g) => g.map((x) => x.label));
  expect(groepen).toEqual(["September", "Wetenschappelijk onderzoek", "Geen map"]);
  page.expectNoErrors();
});
