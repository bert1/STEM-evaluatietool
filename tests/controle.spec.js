const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* Stap 1: de dekkingstelling moet de echte klas per leerling gebruiken
   (row.studentKlas), niet enkel sessies met exact één klas. */
test.describe("telling per klas (coverageMatrix)", () => {
  test("een combinatiesessie telt mee voor elke echte klas", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const a = studentsFor(db, year, "1WM")[0];
      const b = studentsFor(db, year, "1WTa")[0];
      db.sessions[sessionKey(year, "1WM+1WTa", ev)] = [{
        id: "combi", assessor: "TST", students: [a, b], scores: {},
        studentKlas: { [a]: "1WM", [b]: "1WTa" }, createdAt: Date.now(), updatedAt: Date.now(),
      }];
      const cov = coverageMatrix(db, year);
      return [cov.cells["1WM||" + ev].done, cov.cells["1WTa||" + ev].done, cov.cells["1WM||" + ev].started];
    });
    expect(r).toEqual([1, 1, true]);
  });

  test("een leerling die van klas veranderde telt bij de nieuwe klas", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const [a, b] = studentsFor(db, year, "1WM");
      // Groepsrij blijft in de sessie van 1WM staan, maar b zit nu in 1WTa.
      db.roster[year]["1WM"].students = db.roster[year]["1WM"].students.filter((s) => s !== b);
      db.roster[year]["1WTa"].students.push(b);
      db.sessions[sessionKey(year, "1WM", ev)] = [{
        id: "groep", assessor: "TST", students: [a, b], scores: {},
        studentKlas: { [a]: "1WM", [b]: "1WTa" }, createdAt: Date.now(), updatedAt: Date.now(),
      }];
      const cov = coverageMatrix(db, year);
      return [cov.cells["1WM||" + ev].done, cov.cells["1WTa||" + ev].done, cov.cells["1WTa||" + ev].started];
    });
    expect(r).toEqual([1, 1, true]);
  });

  test("oudere rijen zonder studentKlas vallen terug op de klas van de sessie", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const year = "1ste jaar";
      const ev = evaluationNames(db, year)[0];
      const a = studentsFor(db, year, "1WM")[0];
      db.sessions[sessionKey(year, "1WM", ev)] = [{ id: "oud", assessor: "TST", students: [a], scores: {}, updatedAt: 1 }];
      return coverageMatrix(db, year).cells["1WM||" + ev].done;
    });
    expect(r).toBe(1);
  });
});

/* ------------------------------------------------------------------
   Het Controle-scherm
   ------------------------------------------------------------------ */

/* Zet beoordelingen klaar in 1WM (1ste jaar). Elke leerling krijgt het
   hoogste niveau, tenzij anders gevraagd. Datums bepalen de periode. */
async function seed(page, fn) {
  return page.evaluate((body) => {
    const year = "1ste jaar", klas = "1WM";
    const names = evaluationNames(db, year);
    const st = studentsFor(db, year, klas).slice().sort((a, b) => a.localeCompare(b, "nl"));
    const t = (iso) => new Date(iso + "T10:00:00").getTime();
    function add(ev, iso, studs, extra, kl, assessor) {
      kl = kl || klas;
      const rubrics = rubricsFor(db, year, ev);
      const scores = {};
      rubrics.forEach((r) => { scores[r.id] = Math.max(...r.options.map((o) => o.score)); });
      const key = sessionKey(year, kl, ev);
      (db.sessions[key] = db.sessions[key] || []).push(Object.assign({
        id: "r" + Math.random(), assessor: assessor || "TST", students: studs, scores,
        studentKlas: Object.fromEntries(studs.map((s) => [s, kl])),
        createdAt: t(iso), updatedAt: t(iso), corrections: {},
        rubricVersion: evaluationVersion(db, year, ev),
      }, extra || {}));
    }
    // eslint-disable-next-line no-new-func
    new Function("add", "names", "st", "year", "klas", body)(add, names, st, year, klas);
    persist();
    return { names, st };
  }, fn.toString().replace(/^[^{]*{|}$/g, ""));
}

async function openControle(page, filters) {
  await page.click("#btnResults");
  await page.selectOption("#resYear", (filters && filters.year) || "1ste jaar");
  if (filters && filters.klas) await page.selectOption("#resKlas", filters.klas);
  if (filters && filters.period !== undefined) await page.selectOption("#resPeriod", String(filters.period));
}

const item = (page, ev, klas) => page.locator(`.controle-item[data-evaluation="${ev}"][data-klas="${klas}"]`);

test("elk controlepunt per klas verschijnt met de juiste namen", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => {
    st.slice(0, 9).forEach((s) => add(names[0], "2026-09-15", [s]));
    add(names[0], "2026-09-16", [st[0]]);                                 // dubbel
    add(names[0], "2026-09-16", [st[9]], { scores: {} });                // onvolledig
    add(names[0], "2026-09-16", [st[10]], { formative: true });          // enkel tussentijds
    add(names[0], "2026-09-16", ["Iemand Anders"]);                      // niet in de klaslijst
    add(names[0], "2026-09-16", [st[11]], { rubricVersion: 0.5 });       // oudere rubricversie
  });
  await openControle(page, { klas: "1WM" });
  const it = item(page, d.names[0], "1WM");
  await expect(it).toHaveClass(/controle-open/);
  await expect(it.locator(".controle-issue-ontbreekt")).toContainText(d.st[12]);
  await expect(it.locator(".controle-issue-onvolledig")).toContainText(d.st[9]);
  await expect(it.locator(".controle-issue-tussentijds")).toContainText(d.st[10]);
  await expect(it.locator(".controle-issue-dubbel")).toContainText(d.st[0]);
  await expect(it.locator(".controle-issue-nietInLijst")).toContainText("Iemand Anders");
  await expect(it.locator(".controle-issue-oudeVersie")).toContainText(d.st[11]);
  await expect(it.locator(".controle-issue-oudeVersie")).toHaveClass(/controle-info/);

  // detail: één status per leerling, geen punten
  await it.locator(".controle-detail-btn").click();
  const status = (naam) => page.locator(".controle-table tr", { hasText: naam }).locator(".status-badge");
  await expect(status(d.st[1])).toHaveText("In orde");
  await expect(status(d.st[0])).toHaveText("Dubbel");
  await expect(status(d.st[9])).toHaveText("Onvolledig");
  await expect(status(d.st[10])).toHaveText("Enkel tussentijds");
  await expect(status(d.st[12])).toHaveText("Ontbreekt");
  await expect(status("Iemand Anders")).toHaveText("Niet in de klaslijst");
  await expect(page.locator(".controle-detail")).not.toContainText("%");
  await expect(page.locator("#btnPrintAll")).toBeVisible();
  page.expectNoErrors();
});

test("bij veel namen staan de eerste vier en een '+ X meer' die openklapt", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => { add(names[0], "2026-09-15", [st[0]]); });
  await openControle(page, { klas: "1WM" });
  const lijn = item(page, d.names[0], "1WM").locator(".controle-issue-ontbreekt");
  const rest = d.st.length - 1 - 4;
  await expect(lijn.locator(".controle-more")).toHaveText("+ " + rest + " meer");
  await expect(lijn).not.toContainText(d.st[d.st.length - 1]);
  await lijn.locator(".controle-more").click();
  await expect(item(page, d.names[0], "1WM").locator(".controle-issue-ontbreekt")).toContainText(d.st[d.st.length - 1]);
});

test("controlepunten per evaluatie: criteria zonder leerplandoel en opvallend verschil tussen beoordelaars", async ({ page }) => {
  await openTool(page);
  const r = await page.evaluate(() => {
    const year = "2de jaar";
    const ev = evaluationNames(db, year)[0];
    const klas = classesFor(db, year)[0];
    const rubrics = rubricsFor(db, year, ev);
    rubrics[0].goals = [];
    const st = studentsFor(db, year, klas);
    const key = sessionKey(year, klas, ev);
    db.sessions[key] = st.slice(0, 6).map((s, i) => {
      const hoog = i < 3;
      const scores = {};
      rubrics.forEach((rb) => {
        const opts = rb.options.map((o) => o.score);
        scores[rb.id] = hoog ? Math.max(...opts) : Math.min(...opts);
      });
      return { id: "k" + i, assessor: hoog ? "AB" : "CD", students: [s], scores, studentKlas: { [s]: klas },
        createdAt: Date.now(), updatedAt: Date.now(), rubricVersion: evaluationVersion(db, year, ev) };
    });
    persist();
    return { ev, klas, crit: rubrics[0].name };
  });
  await openControle(page, { year: "2de jaar" });
  const note = page.locator(".controle-note", { hasText: r.ev });
  await expect(note.locator(".controle-issue-doelen")).toContainText(r.crit);
  await expect(note.locator(".controle-issue-kalibratie")).toContainText("procentpunt verschil");
  await expect(note.locator("button", { hasText: "Naar Rubrics" })).toBeVisible();
  await expect(page.locator("#resultsCard2 svg")).toHaveCount(0); // geen grafieken
  page.expectNoErrors();
});

test("een combinatiesessie telt mee op het scherm", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => {
    const b = studentsFor(db, year, "1WTa")[0];
    add(names[0], "2026-09-15", [st[0], b], { studentKlas: { [st[0]]: "1WM", [b]: "1WTa" } }, "1WM+1WTa");
  });
  await openControle(page);
  await expect(item(page, d.names[0], "1WM")).toContainText("1/" + d.st.length + " beoordeeld");
  await expect(item(page, d.names[0], "1WTa")).toContainText("1/");
  await expect(item(page, d.names[0], "1WM").locator(".controle-issue-ontbreekt")).not.toContainText(d.st[0]);
});

test("'Nu beoordelen' opent Evalueren met leerjaar, klas en evaluatie al gekozen", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => { add(names[1], "2026-09-15", [st[0]]); });
  await openControle(page);
  await item(page, d.names[1], "1WM").locator(".controle-go").click();
  await expect(page.locator("#mainView")).toBeVisible();
  await expect(page.locator("#formCard")).toBeVisible();
  const r = await page.evaluate(() => ({ year: $("yearSelect").value, klassen: selectedKlassen(), ev: $("evalSelect").value, key: cur.key, combo: $("evalComboInput").value }));
  expect(r).toEqual({ year: "1ste jaar", klassen: ["1WM"], ev: d.names[1], key: "1ste jaar||1WM||" + d.names[1], combo: d.names[1] });
  await expect(page.locator("#klasMultiInput")).toHaveText("1WM");
  page.expectNoErrors();
});

test("'Alles in orde' als er niets openstaat", async ({ page }) => {
  await openTool(page);
  await seed(page, () => { st.forEach((s) => add(names[0], "2026-09-15", [s])); });
  await openControle(page, { klas: "1WM", period: 0 });
  await expect(page.locator(".controle-summary")).toHaveText(/Alles in orde voor 1WM in GE1\./);
  await expect(page.locator(".controle-open")).toHaveCount(0);
  // de rapporten blijven bereikbaar via "In orde"
  await page.locator("summary", { hasText: "In orde (1)" }).click();
  await page.locator(".controle-detail-btn").first().click();
  await expect(page.locator("#btnPrintAll")).toBeVisible();
  page.expectNoErrors();
});

test("het periodefilter toont enkel evaluaties met beoordelingen in die periode", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => {
    add(names[0], "2026-09-15", [st[0]]);   // GE1
    add(names[1], "2026-10-20", [st[0]]);   // GE2
  });
  await openControle(page, { klas: "1WM", period: 1 });
  await expect(item(page, d.names[1], "1WM")).toBeVisible();
  await expect(item(page, d.names[0], "1WM")).toHaveCount(0);
  await page.selectOption("#resPeriod", "0");
  await expect(item(page, d.names[0], "1WM")).toBeVisible();
  await expect(item(page, d.names[1], "1WM")).toHaveCount(0);
  await page.selectOption("#resPeriod", "-1");
  await expect(page.locator(".controle-open")).toHaveCount(2);
  // "Nog niet gestart" staat apart en is standaard ingeklapt
  await expect(page.locator("#controleNotStarted")).not.toHaveAttribute("open", "");
  await expect(page.locator("#controleNotStarted summary")).toContainText("Nog niet gestart (1)");
});

test("het blok Leerplandoelen toont drie toestanden, zonder balkjes", async ({ page }) => {
  await openTool(page);
  await openControle(page, { year: "2de jaar" });
  await page.click("#goalsWrap summary");
  await expect(page.locator(".goal-status-summary")).toContainText("niet gekoppeld");
  await expect(page.locator(".goal-bar, .stat-grid, .threshold-row")).toHaveCount(0);
  await expect(page.locator("#goalsBody button", { hasText: "Overzicht afdrukken" })).toBeVisible();
  await page.selectOption("#resYear", "1ste jaar");
  await expect(page.locator("#goalsBody")).toContainText("geen leerplandoelen");
  page.expectNoErrors();
});

/* ------------------------------------------------------------------
   Vrijstelling ("niet te beoordelen")
   ------------------------------------------------------------------ */

test("vrijstellen met reden, ongedaan maken, en later toch beoordeeld", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => { st.slice(0, -1).forEach((s) => add(names[0], "2026-09-15", [s])); });
  const laatste = d.st[d.st.length - 1];
  await openControle(page, { klas: "1WM" });
  const it = item(page, d.names[0], "1WM");
  await expect(it.locator(".controle-issue-ontbreekt")).toHaveText(new RegExp(laatste));
  await it.locator(".controle-detail-btn").click();

  // markeren, met bevestiging en reden
  page.once("dialog", (dlg) => dlg.accept("langdurig ziek"));
  await page.locator(".controle-table tr", { hasText: laatste }).locator(".controle-exempt").click();
  await expect(page.locator(".controle-summary")).toHaveText(/Alles in orde voor 1WM/);
  // het detail blijft open, het blok "In orde" klapt daarvoor vanzelf open
  await expect(it).toContainText((d.st.length - 1) + "/" + d.st.length + " beoordeeld, 1 vrijgesteld");
  const rij = page.locator(".controle-table tr", { hasText: laatste });
  await expect(rij.locator(".status-badge")).toHaveText("Niet te beoordelen");
  await expect(rij).toContainText("Reden: langdurig ziek");

  // annuleren bij het markeren doet niets
  // (hier gecontroleerd via ongedaan maken en opnieuw annuleren)
  await rij.locator(".controle-unexempt").click();
  await expect(item(page, d.names[0], "1WM")).toHaveClass(/controle-open/);
  page.once("dialog", (dlg) => dlg.dismiss());
  await page.locator(".controle-table tr", { hasText: laatste }).locator(".controle-exempt").click();
  await expect(page.locator(".controle-table tr", { hasText: laatste }).locator(".status-badge")).toHaveText("Ontbreekt");

  // opnieuw vrijstellen en daarna toch beoordelen: de beoordeling wint
  page.once("dialog", (dlg) => dlg.accept(""));
  await page.locator(".controle-table tr", { hasText: laatste }).locator(".controle-exempt").click();
  await seed(page, `() => { add(names[0], "2026-09-20", ["${laatste}"]); }`.replace("`", ""));
  await page.selectOption("#resKlas", "*");
  await page.selectOption("#resKlas", "1WM");
  const it2 = item(page, d.names[0], "1WM");
  await expect(it2.locator(".controle-issue-vrijgesteldToch")).toContainText(laatste);
  await expect(it2).toContainText(d.st.length + "/" + d.st.length + " beoordeeld");
  const rij2 = page.locator(".controle-table tr", { hasText: laatste });
  await expect(rij2.locator(".status-badge")).toHaveText("In orde");
  await expect(rij2.locator(".controle-remark")).toContainText("Vrijgesteld, maar toch beoordeeld");
  await rij2.locator(".controle-unexempt").click();
  await expect(page.locator(".controle-summary")).toHaveText(/Alles in orde voor 1WM/);
  page.expectNoErrors();
});

test("een vrijstelling verhuist mee als de leerling van klas verandert", async ({ page }) => {
  await openTool(page);
  const d = await seed(page, () => { add(names[0], "2026-09-15", [st[0]]); });
  const wie = d.st[1];
  await page.evaluate(([ev, s]) => { setExemption("1ste jaar", ev, "1WM", s, "verhuist"); persist(); }, [d.names[0], wie]);

  // via het echte Klaslijsten-scherm
  await page.click("#btnSettings");
  await page.click("#btnRoster");
  await page.locator("summary", { hasText: "Leerling van klas veranderen" }).click();
  await page.selectOption("#moveYear", "1ste jaar");
  await page.selectOption("#moveFromKlas", "1WM");
  await page.selectOption("#moveStudent", wie);
  await page.selectOption("#moveToKlas", "1WTa");
  page.once("dialog", (dlg) => dlg.accept());
  await page.click("#btnMoveStudent");

  const r = await page.evaluate(([ev, s]) => ({
    oud: !!getExemption("1ste jaar", ev, "1WM", s),
    nieuw: getExemption("1ste jaar", ev, "1WTa", s),
  }), [d.names[0], wie]);
  expect(r.oud).toBe(false);
  expect(r.nieuw && r.nieuw.reason).toBe("verhuist");
  page.expectNoErrors();
});

test("vrijstellingen synchroniseren tussen twee collega's, ook ongedaan maken", async ({ browser }) => {
  const maak = async (initialen) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await openTool(page);
    await page.evaluate((i) => { db.assessor = i; persist(); }, initialen);
    return { ctx, page };
  };
  const A = await maak("AB");
  const B = await maak("CD");
  const ev = await A.page.evaluate(() => evaluationNames(db, "1ste jaar")[0]);
  const wie = await A.page.evaluate(() => studentsFor(db, "1ste jaar", "1WM")[0]);
  const bestand = (p) => p.evaluate(() => dbBlob().text());
  const voegToe = (p, tekst) => p.evaluate((t) => { mergeDb(db, readAnyFile(JSON.parse(t), CONFIG).db); persist(); }, tekst);
  const vrij = (p) => p.evaluate(([e, s]) => !!getExemption("1ste jaar", e, "1WM", s), [ev, wie]);

  // A stelt vrij, B voegt het werk van A toe
  await A.page.evaluate(([e, s]) => { setExemption("1ste jaar", e, "1WM", s, "ziek"); persist(); }, [ev, wie]);
  const aMetVrijstelling = await bestand(A.page);
  await voegToe(B.page, aMetVrijstelling);
  expect(await vrij(B.page)).toBe(true);

  // B maakt ongedaan; A voegt B toe en ziet het ook
  await B.page.evaluate(([e, s]) => { clearExemption("1ste jaar", e, "1WM", s); persist(); }, [ev, wie]);
  await voegToe(A.page, await bestand(B.page));
  expect(await vrij(A.page)).toBe(false);

  // Het oude bestand van A opnieuw toevoegen brengt de vrijstelling niet terug
  await voegToe(B.page, aMetVrijstelling);
  expect(await vrij(B.page)).toBe(false);

  // A stelt later opnieuw vrij: dat wint, ook bij B
  await A.page.waitForTimeout(5);
  await A.page.evaluate(([e, s]) => { setExemption("1ste jaar", e, "1WM", s, "opnieuw"); persist(); }, [ev, wie]);
  await voegToe(B.page, await bestand(A.page));
  expect(await vrij(B.page)).toBe(true);
  expect(await B.page.evaluate(([e, s]) => getExemption("1ste jaar", e, "1WM", s).reason, [ev, wie])).toBe("opnieuw");

  // Samenvoegen verwijdert nooit: B voegt een bestand zonder vrijstellingen toe (oudere versie van de tool)
  const oudObj = JSON.parse(await bestand(B.page));
  Object.values(oudObj.schoolYears).forEach((b) => { delete b.exemptions; });
  delete oudObj.tombstones.exemptions;
  const oud = JSON.stringify(oudObj);
  await voegToe(B.page, oud);
  expect(await vrij(B.page)).toBe(true);

  // en een oud bestand zonder die velden opent gewoon
  const opent = await B.page.evaluate((t) => { const r = readAnyFile(JSON.parse(t), CONFIG); return !!r && !!r.db.tombstones.exemptions; }, oud);
  expect(opent).toBe(true);

  A.page.expectNoErrors();
  B.page.expectNoErrors();
  await A.ctx.close();
  await B.ctx.close();
});
