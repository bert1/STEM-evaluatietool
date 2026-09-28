const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* AI-rubriekhulp (1.24.0): contextvragen, vast aantal niveaus met labels
   uit de tool, de lat, kwaliteitsregels, volgende stap per niveau,
   "ook passend" en "zonder doel", controle zonder blokkeren, en de knop
   "Laat AI deze rubric nakijken". */

const DASH = /—|\s–\s/;

/* Een antwoord zoals de AI het in het nieuwe formaat geeft. */
function nieuwAntwoord(levels = 4) {
  const niveau = (crit, i, n) => {
    const lv = { omschrijving: `${crit}: de leerling toont niveau ${i + 1} met een eigen, waarneembare omschrijving nummer ${i + 1} ${"x".repeat(i)}.` };
    if (i < n - 1) lv.volgendeStap = `Doe bij ${crit} dit om niveau ${i + 2} te halen.`;
    lv.label = "Label van de AI";
    return lv;
  };
  return "Hier is je rubric:\n```json\n" + JSON.stringify({
    criteria: [
      { naam: "Ontwerpschets", beschrijving: "De schets vooraf", leerplandoelen: ["SW21", "XX99"], niveaus: Array.from({ length: levels }, (_, i) => niveau("schets", i, levels)) },
      { naam: "Testen en bijsturen", beschrijving: "Hoe de groep test", leerplandoelen: [], niveaus: Array.from({ length: levels }, (_, i) => niveau("test", i, levels)) },
    ],
    ookPassend: [{ doel: "SW01", uitleg: "Ze werken met gereedschap." }, { doel: "SW21", uitleg: "Al gekoppeld." }, { doel: "ZZ00", uitleg: "Bestaat niet." }],
    zonderDoel: ["Samenwerking in de groep"],
  }, null, 2) + "\n```\nSucces!";
}

test.describe("prompt", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("enkel de beantwoorde contextvragen, zonder lege regels of 'niet ingevuld'", async ({ page }) => {
    const r = await page.evaluate(() => ({
      leeg: buildAiRubricPrompt({ year: "1ste jaar", description: "Een windei maken.", levels: 5, context: { evaluate: "", deliver: [], extraCriteria: true } }),
      deels: buildAiRubricPrompt({ year: "1ste jaar", description: "Een windei maken.", levels: 5, context: { evaluate: "de hypothese, de conclusie", deliver: ["een verslag of werkbundel"], deliverOther: "een foto", workform: "", time: "2 tot 3 lesuren", prior: "", extraCriteria: false } }),
    }));
    expect(r.leeg).not.toContain("CONTEXT");
    expect(r.leeg).not.toMatch(/niet ingevuld/i);
    expect(r.leeg).not.toContain("criteria voorstellen die ik niet noemde"); // hoort bij vraag 1
    const ctx = r.deels.split("CONTEXT\n")[1].split("\n\n")[0].split("\n");
    expect(ctx).toEqual([
      "Wat ik wil evalueren: de hypothese, de conclusie.",
      "Wat de leerlingen afleveren: een verslag of werkbundel en een foto.",
      "Lestijd: 2 tot 3 lesuren.",
      "Beperk je tot de aspecten die ik noemde.",
    ]);
    expect(r.deels).not.toContain("Werkvorm");
    expect(r.deels).not.toContain("vooraf al leerden");
    expect(r.deels).not.toMatch(/\n\n\n/);
  });

  test("het gekozen aantal niveaus met de labels uit de tool en het doelniveau", async ({ page }) => {
    const r = await page.evaluate(() => [3, 4, 5].map((n) => buildAiRubricPrompt({ year: "1ste jaar", description: "x", levels: n })));
    expect(r[0]).toContain("precies 3 niveaus, van laag naar hoog:\n1. Onvoldoende\n2. Voldoende (doel behaald)\n3. Sterk\n");
    expect(r[1]).toContain("precies 4 niveaus, van laag naar hoog:\n1. Onvoldoende\n2. Bijna\n3. Voldoende (doel behaald)\n4. Sterk\n");
    expect(r[2]).toContain("precies 5 niveaus, van laag naar hoog:\n1. Onvoldoende\n2. Bijna\n3. Voldoende (doel behaald)\n4. Sterk\n5. Uitstekend\n");
    expect(r[1]).toContain("Niveau 3 (Voldoende) beschrijft wat je minimaal verwacht");
    expect(r[1]).toContain("- Heeft elk criterium precies 4 niveaus?");
    // Het voorbeeld in het antwoordformaat heeft ook 4 niveaus, zonder volgende stap bij het hoogste.
    expect(r[1]).toContain("{ \"omschrijving\": \"Wat je ziet bij niveau 4\" }");
    expect(r[1]).not.toContain("niveau 5");
  });

  test("leerplandoelen met hun Bloom-niveau, de lat en de lijsten ook passend en zonder doel", async ({ page }) => {
    const r = await page.evaluate(() => ({
      p: buildAiRubricPrompt({ year: "2de jaar", description: "Een brug bouwen.", levels: 4 }),
      aantal: goalsForYear("2de jaar").length,
      voorbeeld: goalsForYear("2de jaar").map((g) => g.id + " [" + g.bloom + "]: " + g.text),
    }));
    r.voorbeeld.forEach((line) => expect(r.p).toContain(line + "\n"));
    expect(r.p).toContain("Niveau 3 (Voldoende) beschrijft wat een leerling toont die het gekoppelde leerplandoel behaalt, op het Bloom-niveau van dat doel.");
    expect(r.p).toContain("\"ookPassend\"");
    expect(r.p).toContain("\"zonderDoel\"");
    expect(r.p).toContain("- Sluit niveau 3 aan bij het Bloom-niveau van het gekoppelde doel?");
    expect(r.p).toContain("Geen criteria over de persoon");
    expect(r.p).toContain("VOLGENDE STAP");
    // 1ste jaar: geen doelen, dus ook geen doelenlijsten.
    const eerste = await page.evaluate(() => buildAiRubricPrompt({ year: "1ste jaar", description: "x", levels: 4 }));
    expect(eerste).not.toContain("ookPassend");
    expect(eerste).not.toContain("Bloom");
  });

  test("nergens een gedachtestreep, in geen enkele variant", async ({ page }) => {
    const prompts = await page.evaluate(() => {
      const out = [];
      const ctx = { evaluate: "a", deliver: ["een toets"], workform: "in groep", time: "1 lesuur", prior: "b", extraCriteria: true };
      ["1ste jaar", "2de jaar"].forEach((year) => {
        [3, 4, 5].forEach((levels) => out.push(buildAiRubricPrompt({ year, description: "x", levels, context: ctx })));
        const ev = evaluationNames(db, year)[0];
        out.push(buildAiRubricPrompt({ year, mode: "nakijken", context: ctx, rubrics: rubricsFor(db, year, ev) }));
      });
      return out;
    });
    prompts.forEach((p) => expect(p).not.toMatch(DASH));
  });

  test("nakijkprompt: huidige rubric met id, doelniveau en de regels", async ({ page }) => {
    const p = await page.evaluate(() => buildAiRubricPrompt({ year: "1ste jaar", mode: "nakijken", rubrics: rubricsFor(db, "1ste jaar", "Maken van pinkers") }));
    expect(p).toContain("HUIDIGE RUBRIC");
    expect(p).toContain("\"id\": \"elektrische-schakeling\"");
    expect(p).toContain("\"doelNiveau\": 3");
    expect(p).toContain("Voeg geen criteria toe en verwijder er geen.");
    expect(p).toContain("Eén aspect per criterium.");
    expect(p).not.toContain("precies 5 niveaus");
  });
});

test.describe("inlezen", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("nieuw formaat: labels uit de tool, volgende stap per niveau, ook passend en zonder doel", async ({ page }) => {
    const r = await page.evaluate((t) => {
      const p = parseAiRubricResponse(t, "2de jaar", []);
      return { criteria: p.criteria, also: p.alsoFitting.map((a) => a.goal.id + ": " + a.uitleg), without: p.withoutGoal, skipped: p.goalsSkipped };
    }, nieuwAntwoord(4));
    expect(r.criteria).toHaveLength(2);
    const c = r.criteria[0];
    expect(c.options.map((o) => o.label)).toEqual(["Onvoldoende", "Bijna", "Voldoende", "Sterk"]);
    expect(c.targetScore).toBe(3);
    expect(c.options.map((o) => o.next)).toEqual([
      "Doe bij schets dit om niveau 2 te halen.",
      "Doe bij schets dit om niveau 3 te halen.",
      "Doe bij schets dit om niveau 4 te halen.",
      "",
    ]);
    expect(c.goals).toEqual(["SW21"]);
    expect(r.also).toEqual(["SW01: Ze werken met gereedschap."]); // SW21 is al gekoppeld
    expect(r.without).toEqual(["Samenwerking in de groep"]);
    expect(r.skipped).toBe(2); // XX99 en ZZ00
  });

  test("oud formaat blijft leesbaar; labels uit de tool, behalve bij een aantal zonder standaardreeks", async ({ page }) => {
    const r = await page.evaluate(() => {
      const oud = (n) => JSON.stringify({ criteria: [{ naam: "Meten", beschrijving: "b", niveaus: Array.from({ length: n }, (_, i) => ({ label: "AI " + i, omschrijving: "Omschrijving " + i })) }] });
      return [4, 6].map((n) => parseAiRubricResponse(oud(n), "1ste jaar", []).criteria[0]);
    });
    expect(r[0].options.map((o) => o.label)).toEqual(["Onvoldoende", "Bijna", "Voldoende", "Sterk"]);
    expect(r[0].options[0].desc).toBe("Omschrijving 0");
    expect(r[0].options.every((o) => o.next === "")).toBe(true);
    expect(r[1].options.map((o) => o.label)).toEqual(["AI 0", "AI 1", "AI 2", "AI 3", "AI 4", "AI 5"]);
    expect(r[1].targetScore).toBeUndefined();
  });

  test("nakijken: vergelijkt per criterium en behoudt scores, labels en het aantal niveaus", async ({ page }) => {
    const r = await page.evaluate(() => {
      const cur = JSON.parse(JSON.stringify(rubricsFor(db, "1ste jaar", "Maken van pinkers")));
      const antwoord = JSON.stringify({
        criteria: [
          { id: "elektrische-schakeling", naam: "Elektrische schakeling", beschrijving: cur[0].description, niveaus: cur[0].options.map((o, i) => ({ omschrijving: i === 1 ? "Eén LED brandt, de tweede niet door een losse draad." : o.desc, volgendeStap: i < 4 ? "Stap " + (i + 1) : undefined })) },
          { id: "realisatie-soldeerwerk", naam: cur[1].name, beschrijving: cur[1].description, niveaus: [{ omschrijving: "a" }, { omschrijving: "b" }] },
          { id: "behuizing-fietsmontage", naam: cur[2].name, beschrijving: cur[2].description, niveaus: cur[2].options.map((o) => ({ omschrijving: o.desc })) },
        ],
      });
      return buildAiReview(cur, antwoord, "1ste jaar").map((x) => ({
        changes: x.changes.map((c) => c.what), problem: x.problem,
        labels: x.proposed ? x.proposed.options.map((o) => o.label) : null,
        desc1: x.proposed ? x.proposed.options[1].desc : null,
        nexts: x.proposed ? x.proposed.options.map((o) => o.next) : null,
      }));
    });
    expect(r[0].changes).toEqual(["Naam", "Volgende stap bij niveau 1", "Niveau 2 (Matig)", "Volgende stap bij niveau 2", "Volgende stap bij niveau 3", "Volgende stap bij niveau 4"]);
    expect(r[0].labels).toEqual(["Onvoldoende", "Matig", "Voldoende", "Goed", "Zeer Goed"]);
    expect(r[0].desc1).toBe("Eén LED brandt, de tweede niet door een losse draad.");
    expect(r[0].nexts).toEqual(["Stap 1", "Stap 2", "Stap 3", "Stap 4", ""]);
    expect(r[1].problem).toContain("2 niveaus in plaats van 5");
    expect(r[1].changes).toEqual([]);
    expect(r[2].changes).toEqual([]);
    expect(r[3].problem).toBe("Geen voorstel voor dit criterium.");
  });

  test("duidelijke fout bij een antwoord zonder json", async ({ page }) => {
    const msg = await page.evaluate(() => { try { parseAiRubricResponse("geen json hier", "1ste jaar", []); } catch (e) { return e.message; } });
    expect(msg).toContain("Geen json-blok gevonden");
  });
});

test.describe("controle van een rubric", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("elke waarschuwing in het juiste geval, en geen valse meldingen bij de bestaande rubrics", async ({ page }) => {
    const r = await page.evaluate(() => {
      const lv = (descs) => descs.map((d, i) => ({ score: i + 1, label: "L" + i, desc: d }));
      const goed = ["De meting staat in een tabel met eenheid bij elke waarde.", "De tabel bevat alle metingen en de gemiddelde waarde per reeks.", "De grafiek toont alle metingen met een passende schaal en assen.", "De grafiek toont het verband en de leerling benoemt de afwijkende meting."];
      const rubrics = [
        { name: "Meten", goals: ["SW21"], options: lv(goed) },
        { name: "Besluit", goals: [], options: lv(["", "Zeer goed.", "Kort maar.", "De conclusie verwijst naar de hypothese — en de metingen."]) },
        { name: "Tabel", goals: ["SW21"], options: lv(["De tabel bevat de metingen van de eerste reeks.", "De tabel bevat de metingen van de eerste reeks!", "De tabel bevat alle reeksen met eenheden en een titel.", "De tabel bevat alle reeksen en een berekend gemiddelde per reeks."].concat(["De tabel is volledig en de leerling verklaart elke afwijkende waarde."])) },
      ];
      const seed = [];
      ["1ste jaar", "2de jaar"].forEach((y) => evaluationNames(db, y).forEach((n) => {
        rubricWarnings(rubricsFor(db, y, n), y, 0).forEach((w) => { if (!/leerplandoel/.test(w)) seed.push(n + ": " + w); });
      }));
      return {
        editor: rubricWarnings(rubrics, "2de jaar", 0),
        ai: rubricWarnings(rubrics, "2de jaar", 4),
        eersteJaar: rubricWarnings(rubrics, "1ste jaar", 0),
        seed,
      };
    });
    expect(r.editor).toEqual([
      "Criterium 2, niveau 1: nog geen omschrijving.",
      "Criterium 2, niveau 2: enkel \"zeer goed\". Wat zie je concreet?",
      "Criterium 2, niveau 3: erg kort. Wat zie je concreet?",
      "Criterium 2, niveau 4: bevat een gedachtestreep.",
      "Criterium 2: nog geen leerplandoel gekoppeld.",
      "Criterium 3 heeft 5 niveaus, de andere 4. Dan weegt het zwaarder door.",
      "Criterium 3, niveau 1: bijna dezelfde tekst als niveau 2.",
    ]);
    expect(r.ai).toContain("Criterium 3: 5 niveaus, je koos er 4.");
    expect(r.eersteJaar.some((w) => /leerplandoel/.test(w))).toBe(false);
    expect(r.seed).toEqual([]);
  });
});

test.describe("feedback in Skore: volgorde bij Wat is je volgende stap?", () => {
  test("eigen feedforward, dan de volgende-stapzin, dan het niveau erboven; doelniveau als drempel", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar", ev = "Maken van pinkers";
      const e = db.evaluations[year][ev];
      const scores = { "elektrische-schakeling": 4, "realisatie-soldeerwerk": 2, "behuizing-fietsmontage": 3, "werkproces-veiligheid": 3 };
      const row = (extra) => Object.assign({ id: "r", students: ["A"], scores }, extra || {});
      const out = {};
      out.zonder = buildSkoreFeedback(db, year, ev, row(), "A");
      e.rubrics[1].options[1].next = "Laat elke verbinding afkoelen voor je eraan trekt.";
      out.metZin = buildSkoreFeedback(db, year, ev, row(), "A");
      out.eigen = buildSkoreFeedback(db, year, ev, row({ feedforward: "Eigen stap." }), "A");
      // Zin enkel in de huidige rubric, beoordeling met een oudere versie zonder die zin.
      archiveVersion(e);
      e.history["1"].rubrics[1].options[1].next = "";
      out.oudeVersie = buildSkoreFeedback(db, year, ev, row({ rubricVersion: 1 }), "A");
      // Doelniveau 5: niveau 4 is dan geen sterk punt meer.
      e.rubrics[0].targetScore = 5;
      out.drempel = buildSkoreFeedback(db, year, ev, row({ rubricVersion: 2 }), "A");
      return out;
    });
    expect(r.zonder).toContain("Wat is je volgende stap?\nOm een niveau hoger te komen bij Realisatie & Soldeerwerk: Functioneel gesoldeerd, maar oogt wat slordig.");
    expect(r.metZin).toContain("Wat is je volgende stap?\nBij Realisatie & Soldeerwerk: Laat elke verbinding afkoelen voor je eraan trekt.");
    expect(r.metZin).not.toContain("Om een niveau hoger");
    expect(r.eigen.endsWith("Wat is je volgende stap?\nEigen stap.")).toBe(true);
    expect(r.oudeVersie).toContain("Bij Realisatie & Soldeerwerk: Laat elke verbinding afkoelen");
    expect(r.zonder).toContain("Sterk punt bij Elektrische Schakeling");
    expect(r.drempel).not.toContain("Sterk punt");
    page.expectNoErrors();
  });
});

/* ---- op het scherm ---- */

async function nieuweEvaluatie(page, year) {
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", year);
  await page.click("#btnNewEval");
  await page.fill("#draftName", "Brug bouwen");
}

test("volledige flow: vragen, prompt kopiëren, antwoord plakken, ook passend koppelen, opslaan", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTool(page);
  page.on("dialog", (d) => d.accept());
  await nieuweEvaluatie(page, "2de jaar");

  await page.click("#aiRubricHelper summary");
  await expect(page.locator("#aiLevels [aria-pressed=true]")).toHaveText("5"); // standaard 5
  await page.click("#aiLevels [data-value='4']");
  await expect(page.locator("#aiLevelLabels")).toHaveText("Onvoldoende · Bijna · Voldoende (doel behaald) · Sterk");

  await page.click("#btnAiGeneratePrompt");
  await expect(page.locator("#aiImportState")).toContainText("Beschrijf eerst de opdracht");

  await page.fill("#aiDescription", "Leerlingen bouwen een brug van houten staafjes en testen de draagkracht.");
  await page.fill("#aiEvaluate", "de schets, het testen");
  await page.click("#aiWorkform [data-value='in groep']");
  await page.click("#aiTime [data-value='1 lesuur']");
  await page.click("#aiTime [data-value='1 lesuur']"); // opnieuw klikken zet de keuze uit
  await page.click("#btnAiGeneratePrompt");
  const prompt = await page.inputValue("#aiPromptOut");
  expect(prompt).toContain("Wat ik wil evalueren: de schets, het testen.");
  expect(prompt).toContain("Werkvorm: in groep.");
  expect(prompt).not.toContain("Lestijd");
  expect(prompt).toContain("precies 4 niveaus");
  await page.click("#btnAiCopyPrompt");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);

  await page.fill("#aiResponseIn", nieuwAntwoord(4));
  await page.click("#btnAiImport");
  await expect(page.locator("#aiImportState")).toContainText("2 criteria toegevoegd (leeg startcriterium vervangen)");
  await expect(page.locator("#draftRubrics .rubric-edit")).toHaveCount(2);
  const eerste = page.locator("#draftRubrics .rubric-edit").first();
  await expect(eerste.locator(".level-row input[type=text]:not(.desc-in):not(.level-next)").first()).toHaveValue("Onvoldoende");
  await expect(eerste.locator(".level-next")).toHaveCount(3);
  await expect(eerste.locator(".level-next").first()).toHaveValue("Doe bij schets dit om niveau 2 te halen.");
  await expect(eerste.locator(".level-target input").nth(2)).toBeChecked();

  const res = page.locator("#aiImportResult");
  await expect(res.locator(".ai-linked")).toContainText("Ontwerpschets: SW21");
  await expect(res.locator(".ai-linked")).toContainText("Testen en bijsturen: geen doel");
  await expect(res.locator(".ai-also-row")).toHaveCount(1);
  await expect(res.locator(".ai-also-row")).toContainText("Ze werken met gereedschap.");
  await expect(res.locator(".ai-without")).toContainText("Samenwerking in de groep");
  await res.locator(".ai-also-target").selectOption("1");
  await res.locator(".ai-also-link").click();
  await expect(res.locator(".ai-also-row")).toContainText("gekoppeld aan Testen en bijsturen");
  await expect(page.locator("#draftRubrics .rubric-edit").nth(1).locator(".goal-chips")).toContainText("SW01");

  // Waarschuwingen blokkeren niets.
  await eerste.locator(".desc-in").first().fill("Goed.");
  await expect(page.locator("#draftChecks")).toContainText("Criterium 1, niveau 1: enkel \"goed\". Wat zie je concreet?");
  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("Evaluatie aangemaakt");

  const opgeslagen = await page.evaluate(() => db.evaluations["2de jaar"]["Brug bouwen"].rubrics);
  expect(opgeslagen[0].targetScore).toBe(3);
  expect(opgeslagen[0].options[0].next).toBe("Doe bij schets dit om niveau 2 te halen.");
  expect(opgeslagen[0].options[3].next).toBeUndefined();
  expect(opgeslagen[1].goals).toEqual(["SW01"]);
  page.expectNoErrors();
});

test("de nieuwe velden overleven opslaan, opnieuw openen en een synchronisatie tussen twee personen", async ({ page }) => {
  await openTool(page);
  page.on("dialog", (d) => d.accept());
  await nieuweEvaluatie(page, "1ste jaar");
  const kaart = page.locator("#draftRubrics .rubric-edit").first();
  await kaart.locator("input[type=text]").first().fill("Meten");
  const descs = kaart.locator(".desc-in");
  for (let i = 0; i < 5; i++) await descs.nth(i).fill("De leerling noteert " + (i + 1) + " metingen met eenheid in de tabel.");
  await expect(kaart.locator(".level-target input").nth(2)).toBeChecked(); // standaard Voldoende
  await kaart.locator(".level-target input").nth(3).check();
  await kaart.locator(".level-next").nth(0).fill("Noteer bij elke meting de eenheid.");
  await expect(kaart.locator(".level-next")).toHaveCount(4); // niet bij het hoogste niveau
  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("Evaluatie aangemaakt");

  await page.reload();
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", "1ste jaar");
  await page.locator(".eval-row", { hasText: "Brug bouwen" }).getByRole("button", { name: "Bewerk" }).click();
  const k2 = page.locator("#draftRubrics .rubric-edit").first();
  await expect(k2.locator(".level-target input").nth(3)).toBeChecked();
  await expect(k2.locator(".level-next").first()).toHaveValue("Noteer bij elke meting de eenheid.");

  // Twee personen: Bert heeft de rubric, Marie nog niet. Na samenvoegen
  // via het gedeelde bestand heeft Marie dezelfde velden.
  const r = await page.evaluate(async () => {
    // Zoals bij echt synchroniseren: het gedeelde bestand als tekst.
    const tekst = await dbBlob().text();
    const bert = readAnyFile(JSON.parse(tekst), CONFIG).db;
    const marie = readAnyFile(JSON.parse(tekst), CONFIG).db;
    delete marie.evaluations["1ste jaar"]["Brug bouwen"];
    mergeDb(marie, bert);
    const opnieuw = normaliseDb(JSON.parse(JSON.stringify(marie))); // opnieuw openen bij Marie
    const r0 = opnieuw.evaluations["1ste jaar"]["Brug bouwen"].rubrics[0];
    return { target: r0.targetScore, next: r0.options[0].next };
  });
  expect(r).toEqual({ target: 4, next: "Noteer bij elke meting de eenheid." });
  page.expectNoErrors();
});

test("Laat AI deze rubric nakijken: voorstel bekijken, kiezen, overnemen, nieuwe versie bij een gebruikte rubric", async ({ page }) => {
  await openTool(page);
  page.on("dialog", (d) => d.accept());
  const ev = "Maken van pinkers";
  await page.evaluate((ev) => {
    const key = sessionKey("1ste jaar", "1WM", ev);
    const scores = {};
    rubricsFor(db, "1ste jaar", ev).forEach((r) => { scores[r.id] = 3; });
    db.sessions[key] = [{ id: "r1", assessor: "TST", students: ["X"], studentKlas: { X: "1WM" }, scores, rubricVersion: 1, updatedAt: 1, createdAt: 1 }];
    persist();
  }, ev);

  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", "1ste jaar");
  await page.locator(".eval-row", { hasText: ev }).getByRole("button", { name: "Bewerk" }).click();
  await page.click("#btnAiReview");
  await expect(page.locator("#aiRubricHelper")).toHaveAttribute("open", "");
  await expect(page.locator("#aiModeReview")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#aiLevels")).toBeHidden();
  await page.click("#btnAiGeneratePrompt"); // beschrijving is hier optioneel
  const prompt = await page.inputValue("#aiPromptOut");
  expect(prompt).toContain("HUIDIGE RUBRIC");
  expect(prompt).toContain("\"id\": \"werkproces-veiligheid\"");

  const antwoord = await page.evaluate((ev) => {
    const cur = rubricsFor(db, "1ste jaar", ev);
    return JSON.stringify({ criteria: cur.map((r, ci) => ({
      id: r.id, naam: r.name, beschrijving: r.description,
      niveaus: r.options.map((o, i) => ({ omschrijving: ci < 2 && i === 0 ? "NIEUW " + r.name : o.desc, volgendeStap: i < 4 ? "Volgende stap " + ci + "." + i : undefined })),
    })) });
  }, ev);
  await page.fill("#aiResponseIn", antwoord);
  await page.click("#btnAiImport");
  await expect(page.locator("#aiImportState")).toContainText("Voorstel voor 4 criteria");
  const kaarten = page.locator(".ai-review-card");
  await expect(kaarten).toHaveCount(4);
  await expect(kaarten.first()).toContainText("Was: Werkt niet (kortsluiting) of compleet fout aangesloten.");
  await expect(kaarten.first()).toContainText("Wordt: NIEUW Elektrische Schakeling");
  // Er verandert nog niets zonder bevestiging.
  expect(await page.evaluate(() => draft.rubrics[0].options[0].desc)).toBe("Werkt niet (kortsluiting) of compleet fout aangesloten.");

  await kaarten.nth(1).locator(".ai-review-take input").uncheck();
  await page.click("#btnAiApplyReview");
  await expect(page.locator("#aiImportState")).toContainText("3 criteria bijgewerkt");
  const d = await page.evaluate(() => draft.rubrics.map((r) => [r.options[0].desc, r.options[0].next]));
  expect(d[0]).toEqual(["NIEUW Elektrische Schakeling", "Volgende stap 0.0"]);
  expect(d[1][0]).toBe("Losse draden, blote koperdraden (gevaar op kortsluiting)."); // niet overgenomen
  expect(d[2][1]).toBe("Volgende stap 2.0");

  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("bewaard als versie 1");
  const v = await page.evaluate((ev) => {
    const e = db.evaluations["1ste jaar"][ev];
    return {
      version: e.version,
      oud: rubricsForVersion(db, "1ste jaar", ev, 1)[0].options[0].desc,
      nieuw: e.rubrics[0].options[0].desc,
      next: e.rubrics[2].options[0].next,
    };
  }, ev);
  expect(v).toEqual({ version: 2, oud: "Werkt niet (kortsluiting) of compleet fout aangesloten.", nieuw: "NIEUW Elektrische Schakeling", next: "Volgende stap 2.0" });
  page.expectNoErrors();
});

test("enkel volgende stappen aanvullen maakt geen nieuwe rubricversie", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const a = rubricsFor(db, "1ste jaar", "Maken van pinkers");
    const b = JSON.parse(JSON.stringify(a));
    b[0].options[0].next = "Nieuwe zin.";
    b[0].targetScore = 4;
    return rubricsDiffer(a, b);
  });
  expect(r).toBe(false);
});

test("zichtbare teksten van de AI-hulp bevatten geen gedachtestreep", async ({ page }) => {
  await openTool(page);
  await page.click("#btnEvals");
  await page.click("#btnNewEval");
  await page.click("#aiRubricHelper summary");
  const tekst = await page.locator("#aiRubricHelper").innerText();
  expect(tekst).not.toMatch(DASH);
  const editor = await page.locator("#evalEditView").innerText();
  expect(editor).not.toMatch(DASH);
  page.expectNoErrors();
});
