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

test("opslaan zonder alle criteria geeft een duidelijke melding", async ({ page }) => {
  await openTool(page);
  await kiesKlasEnEvaluatie(page);
  await page.locator("#studentGrid .student-cb").first().check();
  await page.click("#btnSave");
  await expect(page.locator("#notice")).toContainText("Nog niet alle criteria gescoord");
  expect(await page.evaluate(() => rows().length)).toBe(0);
  page.expectNoErrors();
});
