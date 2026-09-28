const { test, expect } = require("@playwright/test");
const { openTool, seedFolders } = require("./helpers");

const opties = (page, panel) => page.locator(panel + " .eval-combo-option").allInnerTexts();
const koppen = (page, panel) => page.locator(panel + " .eval-combo-group").allInnerTexts();
const zonderVinkje = (list) => list.map((t) => t.replace(/\s*✓$/, ""));

/* Sinds 1.22.0 heeft enkel het Evalueren-scherm nog een zoeklijst (het
   tabblad Resultaten werd Controle). Het is dezelfde makeSearchCombo(),
   dus deze testen dekken de zoeklijst volledig. */
test.describe("zoeklijst bij Evalueren", () => {
  test.beforeEach(async ({ page }) => {
    await openTool(page);
    await seedFolders(page);
    await page.selectOption("#yearSelect", "1ste jaar");
    await page.click("#evalComboInput");
  });

  test("toont mappen als koppen, in volgorde", async ({ page }) => {
    const k = await koppen(page, "#evalComboPanel");
    expect(k.map((x) => x.toLowerCase())).toEqual(["september", "wetenschappelijk onderzoek", "geen map"]);
    page.expectNoErrors();
  });

  test("zoekt zonder accenten en hoofdletters", async ({ page }) => {
    await page.fill("#evalComboInput", "CREME brulee");
    expect(zonderVinkje(await opties(page, "#evalComboPanel"))).toEqual(["Crème brûlée proef"]);
  });

  test("zoekt op mapnaam", async ({ page }) => {
    await page.fill("#evalComboInput", "septemb");
    expect((await koppen(page, "#evalComboPanel")).map((x) => x.toLowerCase())).toEqual(["september"]);
    expect(await opties(page, "#evalComboPanel")).toHaveLength(1);
  });

  test("Enter kiest meteen bij één resultaat", async ({ page }) => {
    await page.fill("#evalComboInput", "brulee");
    await page.keyboard.press("Enter");
    await expect(page.locator("#evalSelect")).toHaveValue("Crème brûlée proef");
    await expect(page.locator("#evalComboPanel")).toBeHidden();
    await expect(page.locator("#evalComboInput")).toHaveAttribute("aria-expanded", "false");
    page.expectNoErrors();
  });

  test("Enter bij meerdere resultaten kiest niets zonder pijltje", async ({ page }) => {
    const voor = await page.inputValue("#evalSelect");
    await page.fill("#evalComboInput", "e");
    await page.keyboard.press("Enter");
    await expect(page.locator("#evalComboPanel")).toBeVisible();
    await expect(page.locator("#evalSelect")).toHaveValue(voor);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#evalComboInput")).toHaveAttribute("aria-activedescendant", "evalComboPanel-o0");
  });

  test("heeft de ARIA-rollen van een combobox", async ({ page }) => {
    await expect(page.locator("#evalComboInput")).toHaveAttribute("role", "combobox");
    await expect(page.locator("#evalComboInput")).toHaveAttribute("aria-controls", "evalComboPanel");
    await expect(page.locator("#evalComboPanel")).toHaveAttribute("role", "listbox");
    await expect(page.locator("#evalComboPanel [role=option]").first()).toBeVisible();
  });

  test("de huidige keuze staat gemarkeerd", async ({ page }) => {
    await page.locator("#evalComboPanel .eval-combo-option").first().click();
    const huidige = await page.inputValue("#evalSelect");
    await page.click("#klasMultiInput"); // focus weg, zodat het paneel opnieuw opent
    await page.click("#evalComboInput");
    await expect(page.locator("#evalComboPanel .current")).toHaveAttribute("data-value", huidige);
  });

  test("melding als er niets gevonden wordt", async ({ page }) => {
    await page.fill("#evalComboInput", "xyzxyz");
    await expect(page.locator("#evalComboPanel")).toContainText("Geen evaluaties of mappen gevonden");
  });
});

test("zoeklijst bij Evalueren: onzichtbare keuzelijst met dezelfde mapindeling", async ({ page }) => {
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
