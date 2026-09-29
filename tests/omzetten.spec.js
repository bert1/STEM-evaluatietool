const path = require("path");
const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* AI-hulp, stand "Bestaande evaluatie omzetten" (1.27.0): een oude
   evaluatiefiche of een stuk cursus inlezen (Excel, Word, PowerPoint,
   tekst of plakken) en met een prompt laten omzetten naar criteria.
   De Excel-fiches in tests/fixtures zijn echte fiches van de school
   (lege sjablonen, zonder leerlingen). */

const DASH = /—|\s–\s/;
const fixture = (name) => path.join(__dirname, "fixtures", name);

async function nieuweEvaluatie(page, year = "2de jaar") {
  // Een nieuwe evaluatie heeft sinds 1.31.0 altijd een vak nodig.
  await page.evaluate((y) => { addSubject(db, y, "STEM"); persist(); }, year);
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", year);
  await page.click("#btnNewEval");
  await page.selectOption("#draftSubject", "STEM");
  await page.fill("#draftName", "Bio-plastics");
  await page.click("#aiRubricHelper summary");
  await page.click("#aiModeConvert");
}

/* Het voorbeeld onder ANTWOORD moet geldige json zijn. */
function voorbeeldJson(prompt) {
  const blok = prompt.split("ANTWOORD\n")[1].split("```json\n")[1].split("\n```")[0];
  return JSON.parse(blok.replace(/"Je-vorm[^"]*"/g, "\"x\""));
}

test.describe("inlezen", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("Excel: samengevoegde cellen, fases over meerdere rijen, invulstreepjes", async ({ page }) => {
    const tekst = await page.evaluate(() => xlsxSheetText({
      sheetName: "Blad1",
      rows: [
        ["Klas: ____", "naam: ________"],
        ["STEM", "EVALUATIE", "", ""],
        ["", "Zeer goed", "Goed", "Zwak"],
        ["Oriënteren", "Een goede hypothese.", "Twijfel over de hypothese.", "", ""],
        ["", "Zes vragen juist.", "Vijf vragen juist.", "Vier."],
        ["", "", "", ""],
      ],
      rowNumbers: [1, 2, 3, 5, 6, 9],
      merges: ["B2:D2", "C5:D5", "A5:A6"],
    }));
    expect(tekst.split("\n")).toEqual([
      "Klas: | naam:",
      "STEM | EVALUATIE (over 3 kolommen)",
      " | Zeer goed | Goed | Zwak",
      "Oriënteren | Een goede hypothese. | Twijfel over de hypothese. (over 2 kolommen)",
      "Oriënteren | Zes vragen juist. | Vijf vragen juist. | Vier.",
    ]);
    page.expectNoErrors();
  });

  test("bestanden kiezen: Excel, Word en PowerPoint na elkaar, PDF met uitleg", async ({ page }) => {
    await nieuweEvaluatie(page);
    await expect(page.locator("#aiSource")).toBeVisible();
    await page.setInputFiles("#aiSourceFile", [
      fixture("evaluatiefiche_1_bioplastics.xlsx"),
      fixture("cursus_windturbine.docx"),
      fixture("cursus_krachten.pptx"),
      fixture("handleiding.pdf"),
    ]);
    await expect(page.locator("#aiSourceState")).toContainText("3 bestanden ingelezen");
    await expect(page.locator("#aiSourceState")).toContainText("handleiding.pdf: Een PDF kan de tool niet lezen. Open het, selecteer alles (Ctrl+A)");
    const tekst = await page.inputValue("#aiSource");

    // Excel: de echte fiche van bio-plastics.
    expect(tekst).toContain("[Bestand: evaluatiefiche_1_bioplastics.xlsx]\nKlas: | naam: |  | nummer: | datum:\n");
    expect(tekst).toContain("BIO-PLASTICS | Zeer goed | Goed | Zwak | Zeer zwak | leerkracht\n");
    expect(tekst).toContain("Oriënteren <cursus> Onderzoeksvraag: Waarom zijn bio-plastics goed voor het milieu? | Het is me gelukt een goede hypothese te formuleren. | Ik twijfelde over mijn hypothese en de leerkrachten hebben hierdoor mijn hypothese moeten bijsturen. (over 2 kolommen) | Ik heb geen hypothese geformuleerd.\n");
    expect(tekst).toContain("Oriënteren <cursus> Onderzoeksvraag: Waarom zijn bio-plastics goed voor het milieu? | Ik heb alle(=6) vragen");
    expect(tekst).toContain("Reflecteren <STEM-lab> | Opmerkingen: (over 4 kolommen)\n");
    expect(tekst).not.toContain("___");

    // Word: alinea's, tabel, cel over twee kolommen, tab als spatie.
    expect(tekst).toContain("[Bestand: cursus_windturbine.docx]\nEvaluatie windturbine\nNaam: Klas:\nCriterium | Zeer goed | Goed | Zwak\nWieken | De wieken draaien bij de ventilator. | De wieken draaien niet. (over 2 kolommen)\n\nLeerlingen meten de spanning met een multimeter.");

    // PowerPoint: dia's in de juiste volgorde (10 na 2).
    expect(tekst).toContain("[Bestand: cursus_krachten.pptx]\nDia 1:\nKrachten meten\nGebruik de dynamometer.\n\nDia 2:\nFz = m × g\n\nDia 10:\nTiende dia");
    expect(tekst).not.toContain("handleiding.pdf");

    // Een tweede keer kiezen voegt toe, zonder te wissen.
    await page.setInputFiles("#aiSourceFile", [fixture("evaluatiefiche_4_krachten.xlsx")]);
    await expect(page.locator("#aiSourceState")).toContainText("1 bestand ingelezen");
    const meer = await page.inputValue("#aiSource");
    expect(meer.startsWith(tekst)).toBe(true);
    expect(meer).toContain("Domein | Beoordelingscriteria | 4 – Uitstekend | 3 – Goed | 2 – Voldoende | 1 – Onvoldoende");
    page.expectNoErrors();
  });

  test("enkel een onleesbaar bestand: melding, niets toegevoegd", async ({ page }) => {
    await nieuweEvaluatie(page);
    await page.setInputFiles("#aiSourceFile", [fixture("handleiding.pdf")]);
    await expect(page.locator("#aiSourceState")).toContainText("Niets ingelezen");
    await expect(page.locator("#aiSource")).toHaveValue("");
    page.expectNoErrors();
  });

  test("lange tekst geeft een tip, geen blokkade", async ({ page }) => {
    await nieuweEvaluatie(page);
    await expect(page.locator("#aiSourceLength")).toBeHidden();
    await page.fill("#aiSource", "Een zin over de opdracht. ".repeat(1500));
    await expect(page.locator("#aiSourceLength")).toBeVisible();
    await expect(page.locator("#aiSourceLength")).toContainText("De tekst is lang");
    await page.click("#btnAiGeneratePrompt");
    await expect(page.locator("#aiPromptBlock")).toBeVisible();
    page.expectNoErrors();
  });
});

test.describe("prompt", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("omzetregels, het materiaal onderaan, geen gedachtestreep, geldig antwoordformaat", async ({ page }) => {
    const bron = "Domein | 4 – Uitstekend | 3 – Goed\nMeting — tabel | Nauwkeurig | Enkele fouten\n```\nIk heb alles gedaan.";
    const r = await page.evaluate((source) => ({
      tweede: buildAiRubricPrompt({ year: "2de jaar", mode: "omzetten", levels: 4, source, description: "",
        context: { evaluate: "de metingen", deliver: [], extraCriteria: true } }),
      eerste: buildAiRubricPrompt({ year: "1ste jaar", mode: "omzetten", levels: 5, source }),
      nieuw: buildAiRubricPrompt({ year: "2de jaar", mode: "nieuw", levels: 5, description: "x" }),
    }), bron);

    for (const p of [r.tweede, r.eerste]) {
      expect(p).toMatch(/^Ik ben leerkracht STEM .*Zet het bestaande materiaal hieronder \(een evaluatiefiche of een stuk cursus\) om/);
      expect(p).toContain("\nOMZETTEN\n1. Het materiaal staat onderaan bij BESTAAND MATERIAAL.");
      expect(p).toContain("\"(over 2 kolommen)\"");
      expect(p).toContain("ik-vorm (een zelfevaluatie)");
      expect(p).toContain("\"nietOvergenomen\"");
      expect(p).toContain("- Staat alles wat het materiaal beoordeelt in een criterium, of in \"nietOvergenomen\" met de reden?");
      expect(p).not.toContain("Maak 4 tot 7 criteria die samen de opdracht dekken.");
      expect(p).not.toMatch(DASH);
      // Het materiaal staat vóór de zelfcontrole, met streepjes als dubbelpunt en zonder extra ```.
      const materiaal = p.split("BESTAAND MATERIAAL\n```text\n")[1].split("\n```\n")[0];
      expect(materiaal).toBe("Domein | 4: Uitstekend | 3: Goed\nMeting: tabel | Nauwkeurig | Enkele fouten\n``\nIk heb alles gedaan.");
      expect(p.indexOf("\nBESTAAND MATERIAAL\n")).toBeLessThan(p.indexOf("\nZELFCONTROLE\n"));
    }
    expect(r.tweede).toContain("precies 4 niveaus, van laag naar hoog:\n1. Onvoldoende\n2. Bijna\n3. Voldoende (doel behaald)\n4. Sterk\n");
    expect(r.tweede).toContain("Zet elk criterium om naar precies 4 niveaus");
    expect(r.tweede).toContain("Wat ik wil evalueren: de metingen.");
    expect(r.tweede).not.toContain("criteria voorstellen die ik niet noemde");
    expect(r.tweede.indexOf("\nLEERPLANDOELEN\n")).toBeLessThan(r.tweede.indexOf("\nBESTAAND MATERIAAL\n"));
    expect(r.eerste).toContain("Zet elk criterium om naar precies 5 niveaus");
    expect(r.eerste).not.toContain("LEERPLANDOELEN");

    const vb2 = voorbeeldJson(r.tweede);
    expect(Object.keys(vb2)).toEqual(["criteria", "ookPassend", "zonderDoel", "nietOvergenomen"]);
    expect(vb2.criteria[0].niveaus).toHaveLength(4);
    expect(Object.keys(voorbeeldJson(r.eerste))).toEqual(["criteria", "nietOvergenomen"]);
    // De andere standen blijven zoals ze waren.
    expect(Object.keys(voorbeeldJson(r.nieuw))).toEqual(["criteria", "ookPassend", "zonderDoel"]);
    expect(r.nieuw).not.toContain("nietOvergenomen");
    expect(r.nieuw).not.toContain("BESTAAND MATERIAAL");
    page.expectNoErrors();
  });

  test("nietOvergenomen inlezen, ook als losse tekst", async ({ page }) => {
    const r = await page.evaluate(() => parseAiRubricResponse(JSON.stringify({
      criteria: [{ naam: "Je hypothese", niveaus: [{ omschrijving: "a" }, { omschrijving: "b" }, { omschrijving: "c" }, { omschrijving: "d" }] }],
      nietOvergenomen: [{ onderdeel: "Samenwerking", reden: "Gaat over de persoon." }, "Opmerkingen", { reden: "" }],
    }), "1ste jaar", []).notTaken);
    expect(r).toEqual([
      { part: "Samenwerking", reason: "Gaat over de persoon." },
      { part: "Opmerkingen", reason: "" },
    ]);
    page.expectNoErrors();
  });
});

test("volledige flow: fiche inlezen, prompt, antwoord plakken, niet overgenomen, opslaan", async ({ page }) => {
  await openTool(page);
  page.on("dialog", (d) => d.accept());
  await nieuweEvaluatie(page);

  // Standen: het materiaal enkel bij omzetten; de vraag over extra criteria enkel bij nieuw.
  await expect(page.locator("#aiModeConvert")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#aiExtra")).toBeHidden();
  await expect(page.locator("#aiLevels")).toBeVisible();
  await expect(page.locator("label[for=aiDescription]")).toContainText("(optioneel)");
  await page.click("#aiModeNew");
  await expect(page.locator("#aiSource")).toBeHidden();
  await expect(page.locator("#aiExtra")).toBeVisible();
  await expect(page.locator("label[for=aiDescription]")).toContainText("(verplicht)");
  await page.click("#aiModeConvert");

  await page.click("#btnAiGeneratePrompt");
  await expect(page.locator("#aiImportState")).toContainText("Voeg eerst je materiaal toe");
  await expect(page.locator("#aiPromptBlock")).toBeHidden();

  await page.setInputFiles("#aiSourceFile", [fixture("evaluatiefiche_1_bioplastics.xlsx")]);
  await expect(page.locator("#aiSourceState")).toContainText("1 bestand ingelezen");
  await page.click("#aiLevels [data-value='4']");
  await page.click("#btnAiGeneratePrompt");
  const prompt = await page.inputValue("#aiPromptOut");
  expect(prompt).toContain("Zet elk criterium om naar precies 4 niveaus");
  expect(prompt).toContain("BIO-PLASTICS | Zeer goed | Goed | Zwak | Zeer zwak | leerkracht");
  expect(prompt).not.toMatch(DASH);
  // Het promptvak is even breed als de andere velden.
  const breed = await page.evaluate(() => [$("aiPromptOut").offsetWidth, $("aiResponseIn").offsetWidth]);
  expect(breed[0]).toBe(breed[1]);

  const niveaus = (wat) => [1, 2, 3, 4].map((i) => ({
    omschrijving: `Je ${wat} toont niveau ${i} met een eigen, waarneembare omschrijving ${"x".repeat(i)}.`,
    feedbackZin: `Je ${wat} zit op niveau ${i}.`,
    [i < 4 ? "volgendeStap" : "uitdaging"]: `Werk aan je ${wat}.`,
  }));
  await page.fill("#aiResponseIn", "```json\n" + JSON.stringify({
    criteria: [
      { naam: "Je hypothese", beschrijving: "Je schrijft vooraf op wat je verwacht.", leerplandoelen: ["SW21"], niveaus: niveaus("hypothese") },
      { naam: "Je stappenplan", beschrijving: "Je vult het stappenplan aan.", leerplandoelen: [], niveaus: niveaus("stappenplan") },
      { naam: "Je mal voor de lasercutter", beschrijving: "Je ontwerpt de mal.", leerplandoelen: [], niveaus: niveaus("mal") },
    ],
    ookPassend: [],
    zonderDoel: [],
    nietOvergenomen: [{ onderdeel: "Opmerkingen", reden: "Dit is een vrij vak, geen criterium." }],
  }) + "\n```");
  await page.click("#btnAiImport");
  await expect(page.locator("#aiImportState")).toContainText("3 criteria toegevoegd (leeg startcriterium vervangen)");
  await expect(page.locator("#draftRubrics .rubric-edit")).toHaveCount(3);
  const res = page.locator("#aiImportResult");
  await expect(res).toContainText("Niet overgenomen");
  await expect(res.locator(".ai-not-taken li")).toHaveText(["Opmerkingen: Dit is een vrij vak, geen criterium."]);

  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("Evaluatie aangemaakt");
  const opgeslagen = await page.evaluate(() => db.evaluations["2de jaar"]["Bio-plastics"].rubrics);
  expect(opgeslagen.map((r) => r.name)).toEqual(["Je hypothese", "Je stappenplan", "Je mal voor de lasercutter"]);
  expect(opgeslagen[0].options.map((o) => o.label)).toEqual(["Onvoldoende", "Bijna", "Voldoende", "Sterk"]);
  expect(opgeslagen[0].options[3].next).toBe("Werk aan je hypothese.");
  expect(opgeslagen[0].goals).toEqual(["SW21"]);

  // Een andere evaluatie openen wist het materiaal en zet de stand terug op nieuw.
  await page.click("#btnEvals");
  await page.click("#btnNewEval");
  await page.click("#aiRubricHelper summary");
  await expect(page.locator("#aiModeNew")).toHaveAttribute("aria-pressed", "true");
  await page.click("#aiModeConvert");
  await expect(page.locator("#aiSource")).toHaveValue("");
  await expect(page.locator("#aiSourceState")).toBeEmpty();
  page.expectNoErrors();
});
