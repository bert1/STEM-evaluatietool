const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

const src = path.join(__dirname, "..", "stem-evaluatietool");

test("de build schrijft het bestand met en zonder versienummer", async () => {
  const version = fs.readFileSync(path.join(src, "js", "state.js"), "utf8").match(/var APP_VERSION = "([^"]+)"/)[1];
  expect(fs.existsSync(path.join(src, "dist", "STEM-Evaluatietool.html"))).toBe(true);
  expect(fs.existsSync(path.join(src, "dist", `STEM-Evaluatietool-v${version}.html`))).toBe(true);
});

test("elk scriptbestand uit index.html bestaat", async () => {
  const html = fs.readFileSync(path.join(src, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)">/g)].map((m) => m[1]);
  expect(scripts.length).toBeGreaterThan(5);
  scripts.forEach((s) => expect(fs.existsSync(path.join(src, s)), s).toBe(true));
});

test("de tool start zonder fouten en toont de versie", async ({ page }) => {
  await openTool(page);
  await expect(page.locator("#appVersion")).toHaveText(/^v\d+\.\d+\.\d+$/);
  page.expectNoErrors();
});

test("na het koppelen komt de opstartwizard niet meer terug", async ({ page }) => {
  await openTool(page);
  await page.reload();
  await expect(page.locator("#status")).toHaveText("Opgeslagen in evaluaties-TST.json");
  await expect(page.locator("#setupWizard")).toBeHidden();
  page.expectNoErrors();
});

test("de losse ontwikkelversie (index.html) start ook zonder fouten", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(src, "index.html"));
  await expect(page.locator("#appVersion")).toHaveText(/^v\d/);
  expect(errors).toEqual([]);
});

test("alle tabbladen openen zonder fouten", async ({ page }) => {
  await openTool(page);
  for (const [knop, tekst] of [
    ["#btnEvals", "Rubrics"],
    ["#btnResults", "Controle"],
    ["#btnSkore", "Skore"],
    ["#btnSettings", "Instellingen"],
    ["#btnHome", "Evalueren"],
  ]) {
    await page.click(knop);
    await expect(page.locator(knop), tekst).toHaveClass(/active/);
  }
  await page.click("#btnSettings");
  await page.click("#btnSettingsUser");
  await expect(page.locator("#userStorage")).toContainText("evaluaties-TST.json");
  page.expectNoErrors();
});

test("de handleiding (README.md) vermeldt de huidige versie", async () => {
  const version = fs.readFileSync(path.join(src, "js", "state.js"), "utf8").match(/var APP_VERSION = "([^"]+)"/)[1];
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  const m = readme.match(/Huidige versie: ([\d.]+)\./);
  expect(m, "README.md moet 'Huidige versie: X.Y.Z.' bevatten").not.toBeNull();
  expect(m[1], "werk README.md bij voor deze versie").toBe(version);
});

test("bij Rubrics staat de knop Nieuwe evaluatie boven de lijst", async ({ page }) => {
  await openTool(page);
  await page.click("#btnEvals");
  const knop = await page.locator("#btnNewEval").boundingBox();
  const lijst = await page.locator("#evalList").boundingBox();
  expect(knop.y).toBeLessThan(lijst.y);
  page.expectNoErrors();
});

test("Instellingen: bovenaan één tab, met Algemeen, Gebruiker, Klaslijsten, Vakken en Team eronder", async ({ page }) => {
  await openTool(page);
  // Bovenaan geen aparte tabs meer voor Klaslijsten en Team.
  await expect(page.locator(".topbar .nav-btn")).toHaveText(["Evalueren", "Rubrics", "Controle", "Skore", "Instellingen"]);
  await expect(page.locator("#settingsTabs")).toBeHidden();

  await page.click("#btnSettings");
  await expect(page.locator("#settingsTabs")).toBeVisible();
  await expect(page.locator("#settingsTabs .nav-btn")).toHaveText(["Algemeen", "Gebruiker", "Klaslijsten", "Vakken", "Team"]);
  await expect(page.locator("#btnSettingsGeneral")).toHaveClass(/active/);
  await expect(page.locator("#generalCard")).toBeVisible();
  await expect(page.locator("#generalVersion")).toContainText(await page.evaluate(() => APP_VERSION));

  await page.click("#btnRoster");
  await expect(page.locator("#rosterCard")).toBeVisible();
  await expect(page.locator("#btnRoster")).toHaveClass(/active/);
  await expect(page.locator("#btnSettings")).toHaveClass(/active/);
  await expect(page.locator("#generalCard")).toBeHidden();

  await page.click("#btnTeam");
  await expect(page.locator("#teamCard")).toBeVisible();
  await expect(page.locator("#rosterCard")).toBeHidden();

  // Weg en terug: Instellingen opent het onderdeel van daarnet.
  await page.click("#btnEvals");
  await expect(page.locator("#settingsTabs")).toBeHidden();
  await expect(page.locator("#btnSettings")).not.toHaveClass(/active/);
  await page.click("#btnSettings");
  await expect(page.locator("#teamCard")).toBeVisible();

  await page.click("#btnCloseTeam");
  await expect(page.locator("#mainView")).toBeVisible();
  await expect(page.locator("#settingsTabs")).toBeHidden();
  page.expectNoErrors();
});

test("Instellingen, Algemeen: een nieuw schooljaar maken", async ({ page }) => {
  await openTool(page);
  const huidig = await page.evaluate(() => db.activeSchoolYear);
  await page.click("#btnSettings");
  await expect(page.locator("#generalActiveYear")).toHaveText(huidig);
  page.once("dialog", (d) => d.accept("2099-2100"));
  await page.click("#btnAddSchoolYear");
  await expect(page.locator("#generalActiveYear")).toHaveText("2099-2100");
  await expect(page.locator("#schoolYearSelect")).toHaveValue("2099-2100");
  page.expectNoErrors();
});
