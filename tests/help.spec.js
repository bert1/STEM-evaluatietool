/* Instellingen, Help (sinds 1.34.0): de handleiding README.md in de tool.
   build.js plakt de README bij elke build in het bestand, dus de Help is
   altijd dezelfde tekst. */
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
const voorLeerkrachten = readme.split(/^## \d+\. Voor ontwikkelaars/m)[0];

test("het gebouwde bestand bevat de huidige README, letterlijk", async () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "stem-evaluatietool", "dist", "STEM-Evaluatietool.html"), "utf8");
  const m = html.match(/<script type="text\/markdown" id="handleidingBron">\n([\s\S]*?)<\/script>/);
  expect(m, "de handleiding ontbreekt in het gebouwde bestand").not.toBeNull();
  expect(m[1]).toBe(readme);
});

test("Help staat als laatste onderdeel bij Instellingen en toont elk hoofdstuk", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSettings");
  await expect(page.locator("#settingsTabs .nav-btn")).toHaveText(["Algemeen", "Gebruiker", "Klaslijsten", "Vakken", "Team", "Help"]);
  await page.click("#btnSettingsHelp");
  await expect(page.locator("#helpCard")).toBeVisible();
  await expect(page.locator("#btnSettingsHelp")).toHaveClass(/active/);

  const koppen = [...voorLeerkrachten.matchAll(/^#{2,3} (.+)$/gm)].map((k) => k[1].replace(/[`*]/g, ""));
  expect(koppen.length).toBeGreaterThan(10);
  await expect(page.locator("#helpContent h2, #helpContent h3")).toHaveText(koppen);

  const tekst = await page.locator("#helpContent").innerText();
  const versie = await page.evaluate(() => APP_VERSION);
  expect(tekst).toContain("Huidige versie: " + versie + ".");
  // Niets voor ontwikkelaars, geen losse markdowntekens.
  expect(tekst).not.toContain("Voor ontwikkelaars");
  expect(tekst).not.toContain("npm");
  expect(tekst).not.toMatch(/\*\*|\]\(|^\|/m);
  await expect(page.locator("#helpContent table").first()).toBeVisible();
  page.expectNoErrors();
});

test("genummerde stappen lopen door, ook met een lijst erin", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const d = document.createElement("div");
    d.innerHTML = renderMarkdown("1. een\n2. twee\n   - a\n   - b\n\n3. drie\n   verder\n\nTekst **vet** en `code` en [link](#x) en [bestand](a.md).");
    return {
      ol: d.querySelectorAll(":scope > ol").length,
      items: [...d.querySelectorAll(":scope > ol > li")].map((li) => li.firstChild.textContent.trim()),
      sub: d.querySelectorAll("ol ul li").length,
      start: d.querySelectorAll("ol[start]").length,
      p: d.querySelector("p").innerHTML,
    };
  });
  expect(r.ol).toBe(1);
  expect(r.items).toEqual(["een", "twee", "drie verder"]);
  expect(r.sub).toBe(2);
  expect(r.start).toBe(0);
  expect(r.p).toBe('Tekst <strong>vet</strong> en <code>code</code> en <a href="#x" data-help-link="x">link</a> en bestand.');
  page.expectNoErrors();
});

test("een link in de inhoudstafel springt naar het hoofdstuk", async ({ page }) => {
  await openTool(page);
  await page.click("#btnSettings");
  await page.click("#btnSettingsHelp");
  const links = page.locator("#helpContent a[data-help-link]");
  expect(await links.count()).toBeGreaterThan(10);
  // Geen enkele link loopt dood (ook niet naar het hoofdstuk voor ontwikkelaars).
  const dood = await page.evaluate(() => [...document.querySelectorAll("#helpContent a[data-help-link]")]
    .filter((a) => !document.getElementById(a.getAttribute("data-help-link"))).map((a) => a.textContent));
  expect(dood).toEqual([]);
  await page.locator("#helpContent a", { hasText: "Problemen oplossen" }).first().click();
  await expect(page.locator('[id="11-problemen-oplossen"]')).toBeInViewport();
  page.expectNoErrors();
});
