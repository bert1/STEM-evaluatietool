const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* AI-rubriekhulp (1.24.0): contextvragen, vast aantal niveaus met labels
   uit de tool, de lat, kwaliteitsregels, volgende stap per niveau,
   "ook passend" en "zonder doel", controle zonder blokkeren, en de knop
   "Laat AI deze rubric nakijken".
   Sinds 1.25.0: leerlingentaal (leeftijd, je-vorm), feedbackzinnen,
   uitdaging op het hoogste niveau, en de waarschuwingen daarbij. */

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
    // Het voorbeeld in het antwoordformaat heeft ook 4 niveaus, met een uitdaging bij het hoogste.
    expect(r[1]).toContain("{ \"omschrijving\": \"Je-vorm: wat de leerling toont bij niveau 4\", \"feedbackZin\": \"Je-vorm: wat de leerling toonde\", \"uitdaging\": \"Je-vorm: hoe de leerling nog verder gaat\" }");
    expect(r[1]).toContain("niveau 3\", \"feedbackZin\": \"Je-vorm: wat de leerling toonde\", \"volgendeStap\"");
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
    expect(r.p).toContain("FEEDBACKZINNEN");
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

  test("leerlingentaal: leeftijd per leerjaar, sectie LEERLINGENTAAL, feedbackzinnen en uitdaging, in beide standen", async ({ page }) => {
    const r = await page.evaluate(() => {
      const rub = rubricsFor(db, "1ste jaar", "Maken van pinkers");
      return {
        eerste: buildAiRubricPrompt({ year: "1ste jaar", description: "x", levels: 5 }),
        tweede: buildAiRubricPrompt({ year: "2de jaar", description: "x", levels: 4 }),
        ander: buildAiRubricPrompt({ year: "3de jaar", description: "x", levels: 4 }),
        nakijken: buildAiRubricPrompt({ year: "1ste jaar", mode: "nakijken", rubrics: rub }),
        metVooraf: buildAiRubricPrompt({ year: "1ste jaar", description: "x", levels: 5, context: { prior: "een hypothese opstellen" } }),
      };
    });
    expect(r.eerste).toContain("voor leerlingen uit het 1ste jaar (12 tot 13 jaar).");
    expect(r.tweede).toContain("voor leerlingen uit het 2de jaar (13 tot 14 jaar).");
    expect(r.nakijken).toContain("voor leerlingen uit het 1ste jaar (12 tot 13 jaar), en verbeter ze");
    expect(r.ander).toContain("voor leerlingen uit het 3de jaar.");
    expect(r.ander).not.toMatch(/\d+ tot \d+ jaar/);
    [r.eerste, r.nakijken].forEach((p) => {
      expect(p).toContain("LEERLINGENTAAL\nDe leerlingen lezen deze rubric zelf. Schrijf zo dat een leerling van 12 tot 13 jaar elk niveau begrijpt zonder uitleg.");
      expect(p).toContain("Schrijf elk niveau in de je-vorm");
      expect(p).toContain("De naam van een criterium zegt concreet wat de leerling in deze opdracht maakte of deed");
      expect(p).toContain("Elke zin is duidelijk zonder de rubric erbij");
      expect(p).toContain("- Begrijpt een leerling elke naam en elke feedbackzin ook weken later, zonder de rubric erbij?");
      expect(p).toContain("hoogstens 15 woorden");
      expect(p).toContain("\"adequaat\", \"coherent\", \"relevant\", \"optimaal\", \"systematisch\" of \"correct\"");
      expect(p).toContain("Schrijf actief: \"je meet\", niet \"er wordt gemeten\".");
      expect(p).toContain("FEEDBACKZINNEN");
      expect(p).toContain("\"feedbackZin\"");
      expect(p).toContain("\"uitdaging\", enkel bij het hoogste niveau");
      expect(p).toContain("geen tijdelijke aanduiding zoals {naam}");
      expect(p).toContain("- Kan een leerling van 12 tot 13 jaar elk niveau lezen en zeggen: dit zie ik in mijn werk, of dit zie ik er niet in?");
      expect(p).toContain("- Heeft elk niveau een feedbackZin, elk niveau behalve het hoogste een volgendeStap, en het hoogste niveau een uitdaging?");
      expect(p).not.toMatch(DASH);
    });
    expect(r.tweede).toContain("Schrijf zo dat een leerling van 13 tot 14 jaar");
    expect(r.ander).toContain("Schrijf zo dat een leerling elk niveau begrijpt");
    // De vakterm-regel verwijst enkel naar de context als die ingevuld is.
    expect(r.metVooraf).toContain("(zie \"Wat ze vooraf al leerden of oefenden\")");
    expect(r.eerste).toContain("Gebruik alledaagse woorden en vermijd vaktermen.");
    // Nakijken: herschrijven in leerlingentaal en aanvullen, id en niveaus blijven.
    expect(r.nakijken).toContain("Herschrijf namen, beschrijvingen en omschrijvingen in leerlingentaal");
    expect(r.nakijken).toContain("Vul ontbrekende feedbackzinnen, volgende stappen en uitdagingen aan");
    expect(r.nakijken).toContain("Behoud bij elk criterium het aantal niveaus en hun namen");
    // De huidige rubric: feedbackZin bij elk niveau, uitdaging bij het hoogste.
    const json = JSON.parse(r.nakijken.split("HUIDIGE RUBRIC\n```json\n")[1].split("\n```")[0]);
    const nv = json.criteria[0].niveaus;
    expect(nv[0]).toHaveProperty("feedbackZin");
    expect(nv[0]).toHaveProperty("volgendeStap");
    expect(nv[4]).toHaveProperty("uitdaging");
    expect(nv[4]).not.toHaveProperty("volgendeStap");
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

  test("formaat 1.25.0: feedbackzin per niveau en uitdaging op het hoogste niveau", async ({ page }) => {
    const r = await page.evaluate(() => {
      const antwoord = JSON.stringify({ criteria: [{ naam: "Meten", beschrijving: "Je meet.", niveaus: [
        { omschrijving: "Je meet één keer.", feedbackZin: "Je deed één meting.", volgendeStap: "Meet drie keer." },
        { omschrijving: "Je meet drie keer.", feedbackZin: "Je deed drie metingen.", volgendeStap: "Noteer de eenheid." },
        { omschrijving: "Je meet drie keer met eenheid.", feedbackZin: "Je noteerde de eenheid.", volgendeStap: "Bereken het gemiddelde." },
        { omschrijving: "Je berekent het gemiddelde.", feedbackZin: "Je berekende het gemiddelde.", uitdaging: "Leg uit waarom één meting afwijkt." },
      ] }, { naam: "Zonder zinnen", beschrijving: "b", niveaus: [{ omschrijving: "a" }, { omschrijving: "b" }, { omschrijving: "c" }, { omschrijving: "d" }] }] });
      const p = parseAiRubricResponse(antwoord, "1ste jaar", []);
      return { c: p.criteria, warnings: rubricWarnings(p.criteria, "1ste jaar", 4) };
    });
    expect(r.c[0].options.map((o) => o.say)).toEqual(["Je deed één meting.", "Je deed drie metingen.", "Je noteerde de eenheid.", "Je berekende het gemiddelde."]);
    expect(r.c[0].options.map((o) => o.next)).toEqual(["Meet drie keer.", "Noteer de eenheid.", "Bereken het gemiddelde.", "Leg uit waarom één meting afwijkt."]);
    // Ontbrekende zinnen: gewoon leeg, wel gemeld, en niets blokkeert.
    expect(r.c[1].options.every((o) => o.say === "" && o.next === "")).toBe(true);
    expect(r.c).toHaveLength(2);
  });

  test("nakijken: nieuwe feedbackzinnen en uitdaging verschijnen als aparte wijziging", async ({ page }) => {
    const r = await page.evaluate(() => {
      const cur = JSON.parse(JSON.stringify(rubricsFor(db, "1ste jaar", "Maken van pinkers")));
      const antwoord = JSON.stringify({ criteria: [{
        id: cur[0].id, naam: cur[0].name, beschrijving: cur[0].description,
        niveaus: cur[0].options.map((o, i) => (i < 4
          ? { omschrijving: o.desc, feedbackZin: "Zin " + i + ".", volgendeStap: "Stap " + i + "." }
          : { omschrijving: o.desc, feedbackZin: "Zin 4.", uitdaging: "Uitdaging." })),
      }] });
      const x = buildAiReview(cur, antwoord, "1ste jaar")[0];
      return { changes: x.changes.map((c) => c.what), say: x.proposed.options.map((o) => o.say), top: x.proposed.options[4].next };
    });
    expect(r.changes).toContain("Feedbackzin bij niveau 1");
    expect(r.changes).toContain("Volgende stap bij niveau 4");
    expect(r.changes).toContain("Uitdaging bij niveau 5");
    expect(r.say).toEqual(["Zin 0.", "Zin 1.", "Zin 2.", "Zin 3.", "Zin 4."]);
    expect(r.top).toBe("Uitdaging.");
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
    const LEERLINGENTAAL = "Deze rubric is nog niet in leerlingentaal geschreven. Gebruik Laat AI deze rubric nakijken.";
    // Nog in de derde persoon: één melding voor de hele rubric, niet per
    // niveau, en (nog) geen meldingen over lange zinnen of moeilijke woorden.
    expect(r.editor).toEqual([
      LEERLINGENTAAL,
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
    // De ingebouwde rubrics staan allemaal in de derde persoon: bewust één
    // melding per rubric, en verder geen enkele valse melding (1.25.0).
    const aantal = await page.evaluate(() => evaluationNames(db, "1ste jaar").length + evaluationNames(db, "2de jaar").length);
    expect(r.seed).toHaveLength(aantal);
    r.seed.forEach((w) => expect(w).toMatch(/: Deze rubric is nog niet in leerlingentaal geschreven\. Gebruik Laat AI deze rubric nakijken\.$/));
  });

  test("in de je-vorm: lange zinnen, moeilijke woorden en ontbrekende feedbackzinnen, nooit blokkerend", async ({ page }) => {
    const r = await page.evaluate(() => {
      const opt = (desc, i, extra) => Object.assign({ score: i + 1, label: "L" + i, desc }, extra || {});
      const descs = [
        "Je noteert enkele metingen in een tabel.",
        "Je noteert alle metingen in een tabel, maar je vergeet bij sommige waarden de eenheid te schrijven zodat een lezer niet weet wat je precies hebt gemeten.",
        "Je noteert alle metingen systematisch met eenheid.",
        "Je noteert alle metingen en je berekent het gemiddelde.",
      ];
      const zonder = [{ name: "Meten", description: "Je meet en noteert.", goals: [], options: descs.map((d, i) => opt(d, i)) }];
      const met = [{ name: "Meten", description: "Je meet en noteert.", goals: [], options: ["Je noteert één meting.", "Je noteert drie metingen zonder eenheid.", "Je schrijft bij elke meting de eenheid.", "Je berekent ook het gemiddelde van alle reeksen."].map((d, i) => opt(d, i, { say: "Je deed " + i + ".", next: "Doe " + i + "." })) }];
      const hardInName = [{ name: "Adequaat meten", description: "Je meet relevante waarden.", goals: [], options: met[0].options }];
      return {
        zonder: rubricWarnings(zonder, "1ste jaar", 0),
        met: rubricWarnings(met, "1ste jaar", 0),
        naam: rubricWarnings(hardInName, "1ste jaar", 0),
        halfLeeg: rubricWarnings([{ name: "x", goals: [], options: [opt("Je doet het.", 0, { say: "a" }), opt("Je doet het beter.", 1, { say: "b", next: "c" })] }], "1ste jaar", 0),
      };
    });
    expect(r.zonder).toEqual([
      "Criterium 1, niveau 2: een zin is langer dan 20 woorden. Maak er twee korte zinnen van.",
      "Criterium 1, niveau 3: moeilijk woord voor leerlingen (systematisch).",
      "Nog niet elk niveau heeft feedbackzinnen voor leerlingen. Gebruik Laat AI deze rubric nakijken.",
    ]);
    expect(r.zonder.join(" ")).not.toContain("leerlingentaal geschreven");
    expect(r.met).toEqual([]);
    expect(r.naam).toEqual(["Criterium 1: moeilijk woord in de naam of uitleg (adequaat, relevante)."]);
    expect(r.halfLeeg).toContain("Nog niet elk niveau heeft feedbackzinnen voor leerlingen. Gebruik Laat AI deze rubric nakijken.");
  });
});

test.describe("feedback in Skore: volgorde bij Zo pak je het de volgende keer aan", () => {
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
    const NEXT = "Zo pak je het de volgende keer aan:\n";
    expect(r.zonder).toContain(NEXT + "Om een niveau hoger te komen bij Realisatie & Soldeerwerk: functioneel gesoldeerd, maar oogt wat slordig.");
    expect(r.metZin).toContain(NEXT + "Laat elke verbinding afkoelen voor je eraan trekt.");
    expect(r.metZin).not.toContain("Om een niveau hoger");
    expect(r.eigen.endsWith(NEXT + "Eigen stap.")).toBe(true);
    expect(r.oudeVersie).toContain(NEXT + "Laat elke verbinding afkoelen");
    expect(r.zonder).toContain("Dit ging goed:\nBij Elektrische Schakeling");
    expect(r.drempel).not.toContain("Dit ging goed");
    page.expectNoErrors();
  });
});

/* ---- op het scherm ---- */

async function nieuweEvaluatie(page, year) {
  // Een nieuwe evaluatie heeft sinds 1.31.0 altijd een vak nodig.
  await page.evaluate((y) => { addSubject(db, y, "STEM"); persist(); }, year);
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", year);
  await page.click("#btnNewEval");
  await page.selectOption("#draftSubject", "STEM");
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
  await expect(eerste.locator(".level-next")).toHaveCount(4); // ook de uitdaging bij het hoogste niveau
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
  await expect(kaart.locator(".level-next").first()).toBeHidden(); // standaard dichtgeklapt
  await kaart.locator(".feedback-sentences summary").click();
  await kaart.locator(".level-next").nth(0).fill("Noteer bij elke meting de eenheid.");
  await expect(kaart.locator(".level-next")).toHaveCount(5); // bij het hoogste niveau de uitdaging
  await kaart.locator(".level-say").nth(1).fill("Je noteert twee metingen, zonder eenheid.");
  await kaart.locator(".level-next").nth(4).fill("Meet ook bij een andere temperatuur.");
  await expect(kaart.locator(".feedback-sentences summary")).toContainText("3 van 10 ingevuld");
  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("Evaluatie aangemaakt");

  await page.reload();
  await page.click("#btnEvals");
  await page.selectOption("#evalListYear", "1ste jaar");
  await page.locator(".eval-row", { hasText: "Brug bouwen" }).getByRole("button", { name: "Bewerk" }).click();
  const k2 = page.locator("#draftRubrics .rubric-edit").first();
  await expect(k2.locator(".level-target input").nth(3)).toBeChecked();
  await expect(k2.locator(".level-next").first()).toHaveValue("Noteer bij elke meting de eenheid.");
  await expect(k2.locator(".level-say").nth(1)).toHaveValue("Je noteert twee metingen, zonder eenheid.");

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
    return { target: r0.targetScore, next: r0.options[0].next, say: r0.options[1].say, uitdaging: r0.options[4].next };
  });
  expect(r).toEqual({
    target: 4, next: "Noteer bij elke meting de eenheid.",
    say: "Je noteert twee metingen, zonder eenheid.", uitdaging: "Meet ook bij een andere temperatuur.",
  });
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

test("de AI-hulp biedt enkel 4 of 5 niveaus aan; bestaande rubrics met 3 niveaus blijven werken", async ({ page }) => {
  await openTool(page);
  await page.click("#btnEvals");
  await page.click("#btnNewEval");
  await page.click("#aiRubricHelper summary");
  await expect(page.locator("#aiLevels .chip-toggle")).toHaveText(["4", "5"]);
  const r = await page.evaluate(() => {
    const drie = JSON.stringify({ criteria: [{ naam: "A", niveaus: [{ omschrijving: "a" }, { omschrijving: "b" }, { omschrijving: "c", uitdaging: "u" }] }] });
    return parseAiRubricResponse(drie, "1ste jaar", []).criteria[0];
  });
  expect(r.options.map((o) => o.label)).toEqual(["Onvoldoende", "Voldoende", "Sterk"]);
  expect(r.options[2].next).toBe("u");
  page.expectNoErrors();
});

test("feedbackzinnen in de editor: aanvullen bij een gebruikte rubric maakt geen nieuwe versie", async ({ page }) => {
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

  // Nog in de derde persoon en zonder zinnen: één melding met een knop.
  const tip = page.locator("#draftChecks .feedback-tip");
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText("Deze rubric is nog niet in leerlingentaal geschreven.");
  const checks = await page.locator("#draftChecks").innerText();
  expect(checks.split("nog niet in leerlingentaal").length - 1).toBe(1); // niet dubbel

  const kaart = page.locator("#draftRubrics .rubric-edit").first();
  await kaart.locator(".feedback-sentences summary").click();
  await expect(kaart.locator(".feedback-level-title").first()).toHaveText("Niveau 1 (Onvoldoende)");
  await expect(kaart.locator(".level-next").nth(4)).toHaveAttribute("aria-label", "Uitdaging bij niveau 5");
  await kaart.locator(".level-say").nth(2).fill("Je schakeling werkt, maar soms is er slecht contact.");
  await kaart.locator(".level-next").nth(4).fill("Teken je schakeling ook als schema.");
  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).not.toContainText("bewaard als versie");
  const r = await page.evaluate((ev) => {
    const e = db.evaluations["1ste jaar"][ev];
    return { version: e.version || 1, say: e.rubrics[0].options[2].say, top: e.rubrics[0].options[4].next };
  }, ev);
  expect(r).toEqual({ version: 1, say: "Je schakeling werkt, maar soms is er slecht contact.", top: "Teken je schakeling ook als schema." });

  // De knop in de melding opent het nakijken door de AI.
  await page.locator(".eval-row", { hasText: ev }).getByRole("button", { name: "Bewerk" }).click();
  await page.locator("#draftChecks .feedback-tip button").click();
  await expect(page.locator("#aiRubricHelper")).toHaveAttribute("open", "");
  await expect(page.locator("#aiModeReview")).toHaveAttribute("aria-pressed", "true");

  // Dupliceren neemt de zinnen mee.
  const kopie = await page.evaluate((ev) => {
    duplicateEvaluation("1ste jaar", ev);
    return draft.rubrics[0].options[2].say;
  }, ev);
  expect(kopie).toBe("Je schakeling werkt, maar soms is er slecht contact.");
  page.expectNoErrors();
});

test("volledige flow in leerlingentaal: rubric met AI-hulp, beoordelen, feedback kopiëren in Skore", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTool(page);
  page.on("dialog", (d) => d.accept());
  await nieuweEvaluatie(page, "1ste jaar");
  await page.click("#aiRubricHelper summary");
  await page.click("#aiLevels [data-value='4']");
  await page.fill("#aiDescription", "Leerlingen maken een windei en testen het.");
  await page.click("#btnAiGeneratePrompt");
  expect(await page.inputValue("#aiPromptOut")).toContain("(12 tot 13 jaar)");

  // Zoals de AI het sinds 1.25.1 moet schrijven: namen die zeggen wat de
  // leerling maakte of deed, en zinnen die zonder rubric duidelijk zijn.
  const lv = (omschrijving, feedbackZin, stap, top) => (top
    ? { omschrijving, feedbackZin, uitdaging: stap }
    : { omschrijving, feedbackZin, volgendeStap: stap });
  await page.fill("#draftName", "Windei maken");
  await page.fill("#aiResponseIn", JSON.stringify({ criteria: [
    { naam: "Je voorspellingen vooraf", beschrijving: "Je schrijft vooraf op wat er met het ei zal gebeuren.", niveaus: [
      lv("Je schrijft vooraf niets op over het ei.", "Je schreef vooraf niet op wat er met het ei zou gebeuren.", "Schrijf voor elke proef op wat er volgens jou met het ei gebeurt."),
      lv("Je schrijft op wat er zal gebeuren, zonder reden.", "Je schreef op wat er met het ei zou gebeuren, maar niet waarom.", "Schrijf bij elke voorspelling het woord \"omdat\" en je reden erbij."),
      lv("Je schrijft bij elke proef op wat er gebeurt en waarom.", "Je schreef bij elke proef op wat je verwachtte, met een reden.", "Zeg ook hoe je na de proef ziet of je gelijk had."),
      lv("Je zegt ook hoe je ziet of je voorspelling klopt.", "Je schreef op wat je verwachtte, waarom, en hoe je dat zou nagaan.", "Vergelijk na de proef je voorspelling met wat je echt zag.", true),
    ] },
    { naam: "Je filmpjes van het ei", beschrijving: "Je filmt hoe het ei verandert en vertelt wat je ziet.", niveaus: [
      lv("Je maakt geen enkel filmpje van het ei.", "Je maakte geen filmpjes van het ei.", "Film het ei na 12, 24 en 36 uur."),
      lv("Je maakt één of twee filmpjes van het ei.", "Je maakte niet op elk moment een filmpje.", "Zet een wekker voor elk moment dat je moet filmen."),
      lv("Je filmt het ei na 12, 24 en 36 uur.", "Je filmde op de drie momenten, maar zei weinig over het ei.", "Vertel in elk filmpje wat er aan het ei veranderde."),
      lv("Je filmt op tijd en vertelt wat er verandert.", "Je filmde na 12, 24 en 36 uur en vertelde wat er veranderde.", "Leg in je laatste filmpje uit waarom het ei zo veranderde.", true),
    ] },
  ] }));
  await page.click("#btnAiImport");
  await expect(page.locator("#draftRubrics .rubric-edit")).toHaveCount(2);
  await expect(page.locator("#draftChecks .feedback-tip")).toHaveCount(0);
  await page.click("#btnSaveEval");
  await expect(page.locator("#notice")).toContainText("Evaluatie aangemaakt");

  // Beoordelen: meteen de rij klaarzetten zoals het Evalueren-scherm doet.
  const naam = await page.evaluate(() => {
    const n = studentsFor(db, "1ste jaar", "1WM")[0];
    const ids = rubricsFor(db, "1ste jaar", "Windei maken").map((r) => r.id);
    const scores = {}; scores[ids[0]] = 2; scores[ids[1]] = 4;
    db.sessions[sessionKey("1ste jaar", "1WM", "Windei maken")] = [{ id: "r1", assessor: "TST", students: [n], studentKlas: { [n]: "1WM" }, scores, rubricVersion: 1, createdAt: Date.now(), updatedAt: Date.now(), corrections: {}, feedback: "", feedforward: "" }];
    persist();
    return n;
  });
  await page.click("#btnSkore");
  await page.selectOption("#skoreYear", "1ste jaar");
  await page.selectOption("#skoreKlas", "1WM");
  const kop = page.locator(".skore-table th", { hasText: "Windei maken" });
  await expect(kop.locator(".skore-th-hint")).toHaveCount(0); // heeft feedbackzinnen
  await page.locator(".skore-table tbody tr").first().locator(".skore-copy").click();
  const zin = await page.evaluate((n) => confidenceSentence(n, "Windei maken"), naam);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Dit is je feedback bij \"Windei maken\".\n\n" +
    "Dit ging goed:\nBij je filmpjes van het ei: je filmde na 12, 24 en 36 uur en vertelde wat er veranderde.\n\n" +
    "Hier kan je groeien:\nBij je voorspellingen vooraf: je schreef op wat er met het ei zou gebeuren, maar niet waarom.\n" + zin + "\n\n" +
    "Zo pak je het de volgende keer aan:\nSchrijf bij elke voorspelling het woord \"omdat\" en je reden erbij.",
  );
  page.expectNoErrors();
});
