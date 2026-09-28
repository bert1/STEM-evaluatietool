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

test("de opstartwizard verschijnt enkel bij de eerste keer", async ({ page }) => {
  await openTool(page, { skipWizard: false });
  await expect(page.locator("#setupWizard")).toBeVisible();
  await page.fill("#wizardInitials", "TST");
  await page.click("#wizardFinish");
  await expect(page.locator("#setupWizard")).toBeHidden();
  await page.reload();
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
    ["#btnRoster", "Klaslijsten"],
    ["#btnEvals", "Rubrics"],
    ["#btnResults", "Resultaten"],
    ["#btnTeam", "Team"],
    ["#btnHome", "Evalueren"],
  ]) {
    await page.click(knop);
    await expect(page.locator(knop), tekst).toHaveClass(/active/);
  }
  await page.click("#btnTeam");
  await expect(page.locator("#folderButtons")).toBeVisible();
  page.expectNoErrors();
});

test("de handleiding (README.md) vermeldt de huidige versie", async () => {
  const version = fs.readFileSync(path.join(src, "js", "state.js"), "utf8").match(/var APP_VERSION = "([^"]+)"/)[1];
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  const m = readme.match(/Huidige versie: ([\d.]+)\./);
  expect(m, "README.md moet 'Huidige versie: X.Y.Z.' bevatten").not.toBeNull();
  expect(m[1], "werk README.md bij voor deze versie").toBe(version);
});
