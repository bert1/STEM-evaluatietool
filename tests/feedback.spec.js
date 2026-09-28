const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* Feedback kopiëren vanuit het tabblad Skore (1.23.0, opbouw 1.25.0).
   Eerst de tekst zelf (buildSkoreFeedback in js/feedback.js), daarna de
   knop in de tabel. Meestal op de rubric "Maken van pinkers" (1ste jaar):
   vier criteria met niveaus 1 tot 5, nog zonder feedbackzinnen, dus met
   de omschrijvingen als terugval. */

const YEAR = "1ste jaar";
const PINKERS = "Maken van pinkers";
const IDS = ["elektrische-schakeling", "realisatie-soldeerwerk", "behuizing-fietsmontage", "werkproces-veiligheid"];
const DASH = /—|\s–\s/;

const FEED_UP =
  "Bij \"Maken van pinkers\" werd je beoordeeld op: Elektrische Schakeling, Realisatie & Soldeerwerk, " +
  "Behuizing & Fietsmontage en Werkproces & Veiligheid.";
const FEED_UP_KORT = "Bij \"Maken van pinkers\" werd je beoordeeld op 4 onderdelen.";

/* Bouwt de tekst voor een rij met deze scores (in de volgorde van IDS). */
async function feedback(page, scores, extra, evaluation, student) {
  return page.evaluate(({ YEAR, PINKERS, IDS, scores, extra, evaluation, student }) => {
    const ev = evaluation || PINKERS;
    const ids = evaluation ? rubricsFor(db, YEAR, ev).map((r) => r.id) : IDS;
    const row = Object.assign({ id: "r1", students: [student], scores: {}, updatedAt: 1 }, extra || {});
    ids.forEach((id, i) => { if (scores[i] !== null && scores[i] !== undefined) row.scores[id] = scores[i]; });
    return buildSkoreFeedback(db, YEAR, ev, row, student);
  }, { YEAR, PINKERS, IDS, scores, extra: extra || null, evaluation: evaluation || null, student: student || "Peeters Ruben" });
}

async function vertrouwen(page, student, evaluation) {
  return page.evaluate(({ s, e }) => confidenceSentence(s, e), { s: student || "Peeters Ruben", e: evaluation || PINKERS });
}

/* Zet feedbackzinnen in je-vorm op "Maken van pinkers": say op elk
   niveau, next als volgende stap en als uitdaging op het hoogste. */
async function metZinnen(page) {
  await page.evaluate(({ YEAR, PINKERS }) => {
    db.evaluations[YEAR][PINKERS].rubrics.forEach((r, ri) => {
      r.options.forEach((o, i) => {
        o.say = "Je toont bij criterium " + (ri + 1) + " niveau " + (i + 1) + ".";
        o.next = i < r.options.length - 1
          ? "Zet bij criterium " + (ri + 1) + " de stap naar niveau " + (i + 2) + "."
          : "Probeer bij criterium " + (ri + 1) + " een zwaardere uitdaging.";
      });
    });
  }, { YEAR, PINKERS });
}

test.describe("feedbacktekst", () => {
  test.beforeEach(async ({ page }) => { await openTool(page); });

  test("sterke leerling zonder feedbackzinnen: enkel wat goed ging, geen lof, geen naam", async ({ page }) => {
    const t = await feedback(page, [5, 5, 5, 5]);
    expect(t).toBe(
      FEED_UP + "\n\n" +
      "Dit ging goed:\n" +
      "Bij Elektrische Schakeling: perfect functionerend, helder en logisch bekabeld.",
    );
    expect(t).not.toMatch(/goed gedaan|proficiat|knap|super/i);
    expect(t).not.toMatch(/Ruben|Peeters/);
    page.expectNoErrors();
  });

  test("sterke leerling met feedbackzinnen: krijgt de uitdaging van het eerste criterium", async ({ page }) => {
    await metZinnen(page);
    const t = await feedback(page, [5, 5, 5, 5]);
    expect(t).toBe(
      FEED_UP + "\n\n" +
      "Dit ging goed:\n" +
      "Bij Elektrische Schakeling: je toont bij criterium 1 niveau 5.\n\n" +
      "Een uitdaging voor de volgende keer:\n" +
      "Bij Elektrische Schakeling: probeer bij criterium 1 een zwaardere uitdaging.",
    );
    expect(t).not.toContain("Hier kan je groeien");
    // Geen werkpunt, dus ook geen vertrouwenszin.
    const zinnen = await page.evaluate(() => CONFIDENCE_SENTENCES);
    zinnen.forEach((z) => expect(t).not.toContain(z));
    page.expectNoErrors();
  });

  test("gemiddelde leerling: sterk punt, werkpunt met vertrouwenszin en het niveau erboven", async ({ page }) => {
    const t = await feedback(page, [4, 3, 3, 4]);
    const zin = await vertrouwen(page);
    expect(t).toBe(
      FEED_UP_KORT + "\n\n" +
      "Dit ging goed:\n" +
      "Bij Elektrische Schakeling: schakeling is correct en werkt zeer betrouwbaar.\n\n" +
      "Hier kan je groeien:\n" +
      "Bij Realisatie & Soldeerwerk: functioneel gesoldeerd, maar oogt wat slordig.\n" +
      zin + "\n\n" +
      "Zo pak je het de volgende keer aan:\n" +
      "Om een niveau hoger te komen bij Realisatie & Soldeerwerk: nette, glanzende verbindingen. Isolatie correct toegepast.",
    );
  });

  test("met feedbackzinnen: de feedbackzin en de volgende stap van het behaalde niveau", async ({ page }) => {
    await metZinnen(page);
    const t = await feedback(page, [4, 2, 3, 4]);
    expect(t).toContain("Dit ging goed:\nBij Elektrische Schakeling: je toont bij criterium 1 niveau 4.");
    expect(t).toContain("Hier kan je groeien:\nBij Realisatie & Soldeerwerk: je toont bij criterium 2 niveau 2.");
    expect(t).toContain("Zo pak je het de volgende keer aan:\nBij Realisatie & Soldeerwerk: zet bij criterium 2 de stap naar niveau 3.");
    expect(t).not.toContain("Om een niveau hoger");
    // Ontbreekt een feedbackzin, dan de omschrijving.
    await page.evaluate(({ YEAR, PINKERS }) => { db.evaluations[YEAR][PINKERS].rubrics[1].options[1].say = ""; }, { YEAR, PINKERS });
    const terug = await feedback(page, [4, 2, 3, 4]);
    expect(terug).toContain("Bij Realisatie & Soldeerwerk: klonterig en dof gesoldeerd, rommelig afgewerkt.");
    page.expectNoErrors();
  });

  test("zwakke leerling met eigen feedback en feedforward: eigen tekst letterlijk, geen automatische stap", async ({ page }) => {
    const eigenFb = "Je schakeling was goed getekend, maar twee draden aan de schakelaar zaten niet vast.";
    const eigenFf = "Controleer elke soldeerverbinding door er zacht aan te trekken voor je de krimpkous erover schuift.";
    const t = await feedback(page, [2, 1, 2, 3], { feedback: eigenFb, feedforward: eigenFf });
    const zin = await vertrouwen(page);
    expect(t).toBe(
      FEED_UP + "\n\n" +
      "Dit ging goed:\n" +
      "Bij Werkproces & Veiligheid: basisregels gevolgd, had nog wat sturing nodig.\n\n" +
      "Hier kan je groeien:\n" +
      "Bij Realisatie & Soldeerwerk: losse draden, blote koperdraden (gevaar op kortsluiting).\n" +
      zin + "\n" +
      eigenFb + "\n\n" +
      "Zo pak je het de volgende keer aan:\n" + eigenFf,
    );
    expect(t).not.toContain("Om een niveau hoger");
  });

  test("eigen feedback: bij Hier kan je groeien, of bij Dit ging goed als er geen werkpunt is", async ({ page }) => {
    const t = await feedback(page, [4, 2, 3, 3], { feedback: "Eigen tekst." });
    const groei = t.split("Hier kan je groeien:\n")[1].split("\n\n")[0].split("\n");
    expect(groei[0]).toMatch(/^Bij Realisatie & Soldeerwerk/);
    expect(groei[2]).toBe("Eigen tekst.");
    const top = await feedback(page, [5, 5, 5, 5], { feedback: "Eigen tekst." });
    expect(top).toContain("Dit ging goed:\nBij Elektrische Schakeling: perfect functionerend, helder en logisch bekabeld.\nEigen tekst.");
  });

  test("zonder eigen feedforward de automatische stap, met eigen feedforward enkel die", async ({ page }) => {
    const zonder = await feedback(page, [3, 3, 3, 3]);
    expect(zonder).toContain("Zo pak je het de volgende keer aan:\nOm een niveau hoger te komen bij Elektrische Schakeling: schakeling is correct en werkt zeer betrouwbaar.");
    const met = await feedback(page, [3, 3, 3, 3], { feedforward: "Test eerst met de multimeter." });
    expect(met.endsWith("Zo pak je het de volgende keer aan:\nTest eerst met de multimeter.")).toBe(true);
    // Overal het hoogste niveau, maar wel een eigen feedforward: die blijft staan, in plaats van de uitdaging.
    await metZinnen(page);
    const top = await feedback(page, [5, 5, 5, 5], { feedforward: "Help volgende week een klasgenoot." });
    expect(top).toContain("Zo pak je het de volgende keer aan:\nHelp volgende week een klasgenoot.");
    expect(top).not.toContain("uitdaging");
  });

  test("alles even middelmatig: geen sterk punt, dus geen valse lof", async ({ page }) => {
    const t = await feedback(page, [3, 3, 3, 3]);
    expect(t).not.toContain("Dit ging goed");
    expect(t).toContain("Hier kan je groeien:\nBij Elektrische Schakeling");
    const zwak = await feedback(page, [2, 1, 2, 2]);
    expect(zwak).not.toContain("Dit ging goed"); // niveau 2 van 5 is niet voldoende
  });

  test("de vertrouwenszin: enkel bij een werkpunt, voorspelbaar, en verschillend tussen klasgenoten", async ({ page }) => {
    const r = await page.evaluate(() => {
      const names = studentsFor(db, "1ste jaar", "1WM");
      const gekozen = names.map((n) => confidenceSentence(n, "Maken van pinkers"));
      return {
        verschillend: new Set(gekozen).size,
        vast: confidenceSentence(names[0], "Maken van pinkers") === confidenceSentence(names[0], "Maken van pinkers"),
        lijst: CONFIDENCE_SENTENCES,
      };
    });
    expect(r.verschillend).toBeGreaterThan(2);
    expect(r.vast).toBe(true);
    expect(r.lijst.length).toBeGreaterThanOrEqual(6);
    expect(r.lijst.length).toBeLessThanOrEqual(8);
    r.lijst.forEach((z) => { expect(z).toMatch(/^Ik /); expect(z).not.toMatch(DASH); });
    const a = await feedback(page, [4, 3, 3, 4], null, null, "Janssens Lotte");
    expect(a).toContain(await vertrouwen(page, "Janssens Lotte"));
  });

  test("de eigen tekst van de leerkracht wordt nooit ingekort en telt niet mee voor de lengte", async ({ page }) => {
    const lang = ("Dit is een lange eigen opmerking van de leerkracht die niet ingekort mag worden. ").repeat(12).trim();
    const t = await feedback(page, [5, 3, 5, 5], { feedback: lang, feedforward: lang + " Einde." });
    expect(t).toContain(lang + "\n");
    expect(t).toContain(lang + " Einde.");
    // De eigen tekst telt niet mee: de volledige lijst en het sterke punt blijven staan.
    expect(t).toContain(FEED_UP);
    expect(t).toContain("Dit ging goed:");
  });

  test("lengtegrens van 500 tekens zonder eigen tekst: eerst een kortere criterialijst, dan geen sterk punt", async ({ page }) => {
    const windei = await page.evaluate(() => rubricsFor(db, "1ste jaar", "Challenge windei").length);
    expect(windei).toBe(7);
    // Een oude rubric met lange omschrijvingen: maximaal ingekort. Het
    // werkpunt en de volgende stap zelf worden nooit afgekapt.
    const t = await feedback(page, [5, 4, 4, 2, 4, 4, 4], null, "Challenge windei");
    expect(t).toContain("werd je beoordeeld op 7 onderdelen.");
    expect(t).not.toContain("Dit ging goed");
    expect(t).toContain("Hier kan je groeien:\nBij Lichttest en fotografie: de foto is erg onduidelijk, onscherp of overbelicht, waardoor het rubberachtige gloeieffect van het ei nauwelijks te beoordelen is.");
    expect(t).toContain("Zo pak je het de volgende keer aan:\nOm een niveau hoger te komen bij Lichttest en fotografie: er is een herkenbare foto in het donker gemaakt waarbij het doorschijnen van het licht door het ei zichtbaar is gemaakt.");
    t.split("\n").filter(Boolean).forEach((line) => expect(line).toMatch(/[.?!:)]$/));
    // Past alles, dan blijft de volledige lijst staan.
    const kort = await feedback(page, [5, 5, 5, 5]);
    expect(kort.length).toBeLessThanOrEqual(500);
    expect(kort).toContain("beoordeeld op: Elektrische Schakeling");
    // Met korte feedbackzinnen blijft ook een tekst met werkpunt onder 500 tekens.
    await metZinnen(page);
    const zinnen = await feedback(page, [4, 2, 3, 4]);
    expect(zinnen.length).toBeLessThanOrEqual(500);
    expect(zinnen).toContain("Dit ging goed:");
  });

  test("niet gescoorde criteria worden overgeslagen", async ({ page }) => {
    const t = await feedback(page, [null, 2, 4, null]);
    expect(t).not.toContain("Elektrische Schakeling");
    expect(t).not.toContain("Werkproces");
    expect(t).toMatch(/beoordeeld op: Realisatie & Soldeerwerk en Behuizing & Fietsmontage\.|beoordeeld op 2 onderdelen\./);
    expect(t).toContain("Hier kan je groeien:\nBij Realisatie & Soldeerwerk");
  });

  test("groepswerk wordt vermeld, de individuele correctie niet", async ({ page }) => {
    const t = await feedback(page, [4, 3, 3, 4], { students: ["Peeters Ruben", "Janssens Lotte"], corrections: { "Peeters Ruben": 2 } });
    expect(t).toContain("Dit was een groepsopdracht, de feedback gaat over het werk van jullie groep.");
    expect(t).not.toMatch(/correctie|\+2/);
    const solo = await feedback(page, [4, 3, 3, 4]);
    expect(solo).not.toContain("groepsopdracht");
  });

  test("nooit punten, percentages, niveaulabels, een gedachtestreep of een naam", async ({ page }) => {
    const teksten = await page.evaluate(() => {
      const out = [];
      evaluationNames(db, "1ste jaar").concat(evaluationNames(db, "2de jaar")).forEach((ev) => {
        const year = rubricsFor(db, "1ste jaar", ev).length ? "1ste jaar" : "2de jaar";
        const rubrics = rubricsFor(db, year, ev);
        for (let seed = 0; seed < 12; seed++) {
          const scores = {};
          rubrics.forEach((r, i) => { scores[r.id] = r.options[(seed * 7 + i * 3) % r.options.length].score; });
          out.push({ ev, rubrics, text: buildSkoreFeedback(db, year, ev, { id: "x", students: ["Aerts Anna", "Bosmans Bram"], scores }, "Aerts Anna") });
        }
      });
      return out;
    });
    const labels = ["Onvoldoende", "Matig", "Voldoende", "Goed", "Zeer Goed"];
    teksten.forEach(({ text }) => {
      expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
      expect(text).not.toContain("%");
      expect(text).not.toMatch(DASH);
      expect(text).not.toMatch(/Anna|Bram|Aerts|Bosmans/);
      text.split("\n").forEach((line) => {
        labels.forEach((l) => {
          expect(line.startsWith(l)).toBe(false);
          expect(line).not.toContain("(" + l + ")");
          expect(line).not.toContain(": " + l + "\n");
        });
      });
    });
    page.expectNoErrors();
  });

  test("gebruikt de rubricversie waarmee de leerling beoordeeld werd", async ({ page }) => {
    const r = await page.evaluate(({ YEAR, PINKERS }) => {
      const ev = db.evaluations[YEAR][PINKERS];
      archiveVersion(ev); // versie 1 gaat naar history, de huidige wordt 2
      ev.rubrics[1].options[1].desc = "NIEUWE TEKST voor niveau 2.";
      const scores = { "elektrische-schakeling": 4, "realisatie-soldeerwerk": 2, "behuizing-fietsmontage": 4, "werkproces-veiligheid": 4 };
      return {
        oud: buildSkoreFeedback(db, YEAR, PINKERS, { id: "a", students: ["R"], scores, rubricVersion: 1 }, "R"),
        nieuw: buildSkoreFeedback(db, YEAR, PINKERS, { id: "b", students: ["R"], scores, rubricVersion: 2 }, "R"),
      };
    }, { YEAR, PINKERS });
    expect(r.oud).toContain("Hier kan je groeien:\nBij Realisatie & Soldeerwerk: klonterig en dof gesoldeerd, rommelig afgewerkt.");
    expect(r.nieuw).toContain("Hier kan je groeien:\nBij Realisatie & Soldeerwerk: NIEUWE TEKST voor niveau 2.");
  });

  test("zinnen die na de beoordeling aangevuld zijn, gelden ook voor die beoordeling, zonder nieuwe versie", async ({ page }) => {
    const r = await page.evaluate(({ YEAR, PINKERS }) => {
      const ev = db.evaluations[YEAR][PINKERS];
      const voor = JSON.parse(JSON.stringify(ev.rubrics));
      const key = sessionKey(YEAR, "1WM", PINKERS);
      const naam = studentsFor(db, YEAR, "1WM")[0];
      const scores = { "elektrische-schakeling": 5, "realisatie-soldeerwerk": 2, "behuizing-fietsmontage": 4, "werkproces-veiligheid": 4 };
      db.sessions[key] = [{ id: "r1", assessor: "TST", students: [naam], studentKlas: { [naam]: "1WM" }, scores, rubricVersion: 1, createdAt: 1, updatedAt: 1 }];
      ev.rubrics[1].options[1].say = "Je soldeerde, maar de verbindingen zijn dof.";
      ev.rubrics[1].options[1].next = "Verwarm de draad en het tin samen tot het tin glanst.";
      ev.rubrics[0].options[4].next = "Teken je schakeling ook als schema met symbolen.";
      const tekst = buildSkoreFeedback(db, YEAR, PINKERS, db.sessions[key][0], naam);
      // Zoals op het tabblad Controle: geen melding "oudere versie van de rubric".
      const check = controleCheck(YEAR, PINKERS, "1WM", controleScan(YEAR)[PINKERS + "||1WM"]);
      return { tekst, differ: rubricsDiffer(voor, ev.rubrics), version: ev.version || 1, oud: check.oldVersion };
    }, { YEAR, PINKERS });
    expect(r.differ).toBe(false);
    expect(r.oud).toEqual([]);
    expect(r.version).toBe(1);
    expect(r.tekst).toContain("Bij Realisatie & Soldeerwerk: je soldeerde, maar de verbindingen zijn dof.");
    expect(r.tekst).toContain("Bij Realisatie & Soldeerwerk: verwarm de draad en het tin samen tot het tin glanst.");
    page.expectNoErrors();
  });

  test("dezelfde beoordeling geeft altijd dezelfde tekst", async ({ page }) => {
    const a = await feedback(page, [2, 4, 3, 5], { feedback: "x" });
    const b = await feedback(page, [2, 4, 3, 5], { feedback: "x" });
    expect(a).toBe(b);
  });
});

/* ---- welke beoordeling telt, en het punt met de juiste rubricversie ---- */

async function seedPinkers(page, rowsSpec) {
  return page.evaluate(({ YEAR, PINKERS, IDS, rowsSpec }) => {
    const klas = "1WM";
    const students = studentsFor(db, YEAR, klas).slice().sort((a, b) => a.localeCompare(b, "nl"));
    const t = (iso, h) => new Date(iso + "T" + String(h || 10).padStart(2, "0") + ":00:00").getTime();
    const key = sessionKey(YEAR, klas, PINKERS);
    db.sessions[key] = [];
    rowsSpec.forEach((spec, i) => {
      const scores = {};
      IDS.forEach((id, j) => { scores[id] = spec.scores[j]; });
      db.sessions[key].push(Object.assign({
        id: "row" + i, assessor: "TST", students: spec.students.map((n) => students[n]), scores,
        studentKlas: Object.fromEntries(spec.students.map((n) => [students[n], klas])),
        createdAt: t(spec.date, spec.hour), updatedAt: t(spec.date, spec.hour), corrections: {},
        feedback: spec.feedback || "", feedforward: spec.feedforward || "",
      }, spec.extra || {}));
    });
    persist();
    return students;
  }, { YEAR, PINKERS, IDS, rowsSpec });
}

test("dubbel beoordeeld: de recentste telt; tussentijdse checks tellen niet mee", async ({ page }) => {
  await openTool(page);
  const students = await seedPinkers(page, [
    { students: [0], scores: [2, 2, 2, 2], date: "2026-09-15", hour: 9 },
    { students: [0], scores: [4, 3, 3, 4], date: "2026-09-15", hour: 11 }, // recentste
    { students: [0], scores: [1, 1, 1, 1], date: "2026-09-20", extra: { formative: true } },
  ]);
  const r = await page.evaluate(({ student }) => {
    const data = collectSkore(db, "1ste jaar", "1WM", periodsFor(db, db.currentSchoolYear), 0);
    const v = data.evaluations[0].byStudent[student];
    return { rowId: v.row.id, total: v.total, text: buildSkoreFeedback(db, "1ste jaar", "Maken van pinkers", v.row, student) };
  }, { student: students[0] });
  expect(r.rowId).toBe("row1");
  expect(r.total).toBe(14);
  expect(r.text).toContain("Hier kan je groeien:\nBij Realisatie & Soldeerwerk: functioneel gesoldeerd");
  page.expectNoErrors();
});

test("Skore rekent het punt met de rubricversie van de beoordeling", async ({ page }) => {
  await openTool(page);
  const students = await seedPinkers(page, [
    { students: [0], scores: [4, 4, 4, 4], date: "2026-09-15", extra: { rubricVersion: 1 } },
  ]);
  await page.evaluate(({ YEAR, PINKERS }) => {
    // Na het beoordelen komt er een vijfde criterium bij: versie 2, max 25.
    const ev = db.evaluations[YEAR][PINKERS];
    archiveVersion(ev);
    ev.rubrics.push({ id: "extra", name: "Extra", description: "", options: [1, 2, 3, 4, 5].map((s) => ({ score: s, label: "L" + s, desc: "d" + s })) });
    persist();
  }, { YEAR, PINKERS });
  await page.click("#btnSkore");
  await page.selectOption("#skoreYear", YEAR);
  await page.selectOption("#skoreKlas", "1WM");
  await page.selectOption("#skorePeriod", "0");
  const cel = page.locator(".skore-table tbody tr").first().locator("td").nth(1);
  // 16 op 20 in versie 1, omgerekend naar het kolommaximum 25 = 20.
  await expect(page.locator(".skore-table th .skore-th-max").first()).toHaveText("/25");
  await expect(cel.locator(".skore-score")).toHaveText("20");
  await expect(cel).toHaveAttribute("title", /oudere rubric \(op 20\), omgerekend naar 25/);
  await page.selectOption("#skoreScale", "10");
  await expect(cel.locator(".skore-score")).toHaveText("8");
  expect(students.length).toBeGreaterThan(0);
  page.expectNoErrors();
});

/* ---- de knop in het tabblad Skore ---- */

async function openSkore(page) {
  await page.click("#btnSkore");
  await page.selectOption("#skoreYear", YEAR);
  await page.selectOption("#skoreKlas", "1WM");
  await page.selectOption("#skorePeriod", "0");
}

test.describe("kopieerknop in Skore", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openTool(page);
  });

  test("enkel bij cellen met een punt, met een duidelijke naam", async ({ page }) => {
    const students = await seedPinkers(page, [
      { students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" },
      { students: [1, 2], scores: [5, 5, 5, 5], date: "2026-09-16" },
    ]);
    await page.evaluate(({ student }) => {
      const bucket = db.schoolYears[db.currentSchoolYear];
      bucket.exemptions = bucket.exemptions || {};
      bucket.exemptions[["1ste jaar", "Maken van pinkers", "1WM", student].join("||")] = { reason: "ziek", by: "TST", updatedAt: Date.now() };
      persist();
    }, { student: students[3] });
    await openSkore(page);

    await expect(page.locator(".skore-copy-hint")).toHaveText(
      "Klik op het kopieericoon naast een punt om de feedback te kopiëren. Plak die in Smartschool bij het resultaat.",
    );
    await expect(page.locator(".skore-table .skore-copy")).toHaveCount(3);
    const rij = (i) => page.locator(".skore-table tbody tr").nth(i).locator("td").nth(1);
    await expect(rij(0).locator(".skore-copy")).toHaveAttribute("aria-label", "Feedback voor " + students[0] + " kopiëren");
    await expect(rij(0).locator(".skore-copy")).toHaveAttribute("title", "Feedback voor " + students[0] + " kopiëren");
    await expect(rij(0)).toHaveText("14"); // het punt blijft even leesbaar
    await expect(rij(3)).toHaveText("vrijgesteld");
    await expect(rij(3).locator(".skore-copy")).toHaveCount(0);
    await expect(rij(4)).toHaveText("–");
    await expect(rij(4).locator(".skore-copy")).toHaveCount(0);

    // De kolom wordt niet breder door de knop.
    const breedte = await page.evaluate(() => {
      const td = document.querySelector(".skore-table tbody td.num");
      const w1 = td.getBoundingClientRect().width;
      document.querySelectorAll(".skore-table .skore-copy").forEach((b) => { b.style.display = "none"; });
      const w2 = td.getBoundingClientRect().width;
      return { w1, w2 };
    });
    expect(breedte.w1 - breedte.w2).toBeLessThanOrEqual(1);
    page.expectNoErrors();
  });

  test("klikken kopieert de juiste tekst, met bevestiging en vinkje voor deze sessie", async ({ page }) => {
    const students = await seedPinkers(page, [
      { students: [0], scores: [2, 1, 2, 3], date: "2026-09-15", feedback: "Eigen feedback.", feedforward: "Eigen stap." },
      { students: [1], scores: [4, 3, 3, 4], date: "2026-09-15" },
    ]);
    await openSkore(page);
    const cel = page.locator(".skore-table tbody tr").first().locator("td").nth(1);
    await cel.locator(".skore-copy").click();

    const verwacht = await page.evaluate(() => {
      const row = db.sessions[sessionKey("1ste jaar", "1WM", "Maken van pinkers")][0];
      return buildSkoreFeedback(db, "1ste jaar", "Maken van pinkers", row, row.students[0]);
    });
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(verwacht);
    expect(verwacht).toContain("Eigen feedback.");
    expect(verwacht.endsWith("Zo pak je het de volgende keer aan:\nEigen stap.")).toBe(true);

    await expect(page.locator("#toast")).toHaveText("Feedback voor " + students[0] + " gekopieerd");
    await expect(page.locator("#toast")).toHaveClass(/show/);
    await expect(page.locator("#toast")).toHaveAttribute("role", "status");
    await expect(cel).toHaveClass(/skore-copied/);
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(1);

    // Blijft staan bij een andere periode en terug.
    await page.click("#skoreNext");
    await page.click("#skorePrev");
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(1);

    // Wordt niet bewaard: weg na opnieuw openen, en ook niet in het werkbestand.
    const inDb = await page.evaluate(() => JSON.stringify(db).indexOf("skoreCopied") !== -1 || JSON.stringify(db).indexOf("copied") !== -1);
    expect(inDb).toBe(false);
    await page.reload();
    await openSkore(page);
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(0);
    page.expectNoErrors();
  });

  test("het vinkje verdwijnt als de beoordeling daarna aangepast wordt", async ({ page }) => {
    await seedPinkers(page, [{ students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" }]);
    await openSkore(page);
    await page.locator(".skore-table .skore-copy").first().click();
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(1);
    await page.evaluate(() => {
      const row = db.sessions[sessionKey("1ste jaar", "1WM", "Maken van pinkers")][0];
      row.scores["realisatie-soldeerwerk"] = 4;
      row.updatedAt += 1000;
      persist();
      renderSkore();
    });
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(0);
    page.expectNoErrors();
  });

  test("terugvaloptie zonder navigator.clipboard", async ({ page }) => {
    await seedPinkers(page, [{ students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" }]);
    await openSkore(page);
    await page.evaluate(() => {
      window.__gekopieerd = null;
      const echt = document.execCommand.bind(document);
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      document.execCommand = (cmd) => {
        if (cmd === "copy") { window.__gekopieerd = document.activeElement.value; return true; }
        return echt(cmd);
      };
    });
    await page.locator(".skore-table .skore-copy").first().click();
    const tekst = await page.evaluate(() => window.__gekopieerd);
    expect(tekst).toContain("werd je beoordeeld op");
    await expect(page.locator("#toast")).toContainText("gekopieerd");
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(1);
    page.expectNoErrors();
  });

  test("melding als kopiëren helemaal niet lukt", async ({ page }) => {
    await seedPinkers(page, [{ students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" }]);
    await openSkore(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      document.execCommand = () => false;
    });
    await page.locator(".skore-table .skore-copy").first().click();
    await expect(page.locator("#toast")).toHaveText("Kopiëren lukte niet. Probeer het nog eens.");
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(0);
    page.expectNoErrors();
  });

  test("kolomkop: een klein teken bij een rubric zonder feedbackzinnen", async ({ page }) => {
    await seedPinkers(page, [{ students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" }]);
    await openSkore(page);
    const hint = page.locator(".skore-table th .skore-th-hint");
    await expect(hint).toHaveCount(1);
    await expect(hint).toHaveAttribute("title", "De feedback wordt persoonlijker als je deze rubric laat nakijken door de AI.");
    // Met feedbackzinnen verdwijnt het teken.
    await metZinnen(page);
    await page.evaluate(() => renderSkore());
    await expect(hint).toHaveCount(0);
    page.expectNoErrors();
  });

  test("werkt ook in een gearchiveerd schooljaar", async ({ page }) => {
    await seedPinkers(page, [{ students: [0], scores: [4, 3, 3, 4], date: "2026-09-15" }]);
    await page.evaluate(() => {
      // Een nieuwer schooljaar is actief: het huidige wordt alleen-lezen.
      db.activeSchoolYear = "2099-2100";
      persist();
    });
    expect(await page.evaluate(() => isArchivedSchoolYear(db))).toBe(true);
    await openSkore(page);
    await expect(page.locator(".skore-done-toggle input").first()).toBeDisabled();
    await page.locator(".skore-table .skore-copy").first().click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Hier kan je groeien:");
    await expect(page.locator(".skore-table td.skore-copied")).toHaveCount(1);
    page.expectNoErrors();
  });
});
