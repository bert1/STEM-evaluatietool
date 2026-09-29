const { test, expect } = require("@playwright/test");
const { openTool } = require("./helpers");

/* 29 september 2026, 10u00 lokale tijd. */
const START = new Date(2026, 8, 29, 10, 0).getTime();
const UUR = 60 * 60 * 1000;
const DAG = 24 * UUR;

/* Een nagemaakte gedeelde map in het geheugen, met submappen. De echte
   File System Access API werkt niet vanaf file:// in de testbrowser. */
async function verbindMap(page) {
  await page.evaluate(async () => {
    function nepMap(name) {
      const files = new Map();
      const dirs = new Map();
      function fileHandle(n) {
        return {
          kind: "file",
          name: n,
          async getFile() {
            const f = files.get(n);
            if (!f) throw new DOMException("weg", "NotFoundError");
            return { text: async () => f.text, lastModified: f.lastModified };
          },
          async createWritable() {
            let buf = "";
            return {
              write: async (b) => { buf = typeof b === "string" ? b : await b.text(); },
              close: async () => { files.set(n, { text: buf, lastModified: Date.now() }); },
            };
          },
        };
      }
      return {
        kind: "directory",
        name,
        files,
        dirs,
        async getFileHandle(n, opts = {}) {
          if (!files.has(n)) {
            if (!opts.create) throw new DOMException("weg", "NotFoundError");
            files.set(n, { text: "", lastModified: Date.now() });
          }
          return fileHandle(n);
        },
        async getDirectoryHandle(n, opts = {}) {
          if (!dirs.has(n)) {
            if (!opts.create) throw new DOMException("weg", "NotFoundError");
            dirs.set(n, nepMap(n));
          }
          return dirs.get(n);
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        async *values() {
          for (const n of [...files.keys()]) yield fileHandle(n);
          for (const d of [...dirs.values()]) yield d;
        },
      };
    }
    window.nepMap = nepMap;
    db.assessor = "BB";
    $("assessor").value = "BB";
    folderHandle = nepMap("Gedeeld");
    folderName = "Gedeeld";
    await attachOwnFile();
    await (backupBusy || Promise.resolve());
  });
}

async function kopieen(page) {
  return page.evaluate(() => {
    const d = folderHandle.dirs.get("backups");
    return d ? [...d.files.keys()].sort() : [];
  });
}

/* Eén beoordeelde leerling in het 1ste jaar; geeft de sessiesleutel en
   de rij-id terug. */
async function beoordeel(page, score) {
  return page.evaluate((score) => {
    const year = "1ste jaar";
    const klas = classesFor(db, year)[0];
    const ev = evaluationNames(db, year)[0];
    const key = sessionKey(year, klas, ev);
    const crit = rubricsFor(db, year, ev)[0].id;
    const student = studentsFor(db, year, klas)[0];
    if (!db.sessions[key]) db.sessions[key] = [];
    let row = db.sessions[key].find((r) => r.id === "BB-rij-1");
    if (!row) {
      row = { id: "BB-rij-1", assessor: "BB", students: [student], scores: {}, createdAt: Date.now(), updatedAt: 0 };
      db.sessions[key].push(row);
    }
    row.scores[crit] = score;
    row.updatedAt = Date.now();
    persist();
    return { key, crit, klas, ev };
  }, score);
}

async function opgeslagen(page) {
  await page.evaluate(async () => {
    clearTimeout(autoSaveTimer);
    await writeHandle();
    await (backupBusy || Promise.resolve());
  });
}

test.describe("namen en opruimen", () => {
  test("de naam bevat de initialen, de datum en het uur", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(() => {
      const d = new Date(2026, 8, 29, 14, 5);
      const name = backupFileName("bb", d);
      return { name, parsed: parseBackupName(name), time: d.getTime(), label: backupLabel(d.getTime()), other: parseBackupName("evaluaties-BB.json") };
    });
    expect(r.name).toBe("evaluaties-BB-2026-09-29-14u05.json");
    expect(r.parsed).toEqual({ name: r.name, assessor: "BB", time: r.time });
    expect(r.label).toBe("dinsdag 29 september 2026 om 14u05");
    expect(r.other).toBeNull();
    page.expectNoErrors();
  });

  test("alles van de laatste twee weken blijft, daarna één per week, na een jaar weg", async ({ page }) => {
    await openTool(page);
    const weg = await page.evaluate(({ START, UUR, DAG }) => {
      const list = [];
      // Elke dag van de laatste 400 dagen twee kopieën (9u en 15u).
      for (let d = 0; d < 400; d++) {
        [9, 15].forEach((h) => {
          const t = new Date(START - d * DAG);
          t.setHours(h, 0, 0, 0);
          list.push({ name: backupFileName("BB", t), time: t.getTime() });
        });
      }
      const remove = backupsToRemove(list, START + UUR);
      const kept = list.filter((b) => remove.indexOf(b.name) === -1);
      const isRecent = (b) => START + UUR - b.time < 14 * DAG;
      const recent = kept.filter(isRecent).length === list.filter(isRecent).length;
      const old = kept.filter((b) => START + UUR - b.time >= 14 * DAG);
      const weeks = old.map((b) => Math.floor((b.time / DAG + 3) / 7));
      return {
        recent,
        oldCount: old.length,
        uniqueWeeks: new Set(weeks).size,
        oldest: Math.max(...kept.map((b) => START + UUR - b.time)) / DAG,
      };
    }, { START, UUR, DAG });
    expect(weg.recent).toBe(true);
    expect(weg.oldCount).toBe(weg.uniqueWeeks);
    expect(weg.oldCount).toBeGreaterThan(45);
    expect(weg.oldest).toBeLessThanOrEqual(365);
    page.expectNoErrors();
  });

  test("na een lange pauze blijven de tien nieuwste altijd staan", async ({ page }) => {
    await openTool(page);
    const r = await page.evaluate(({ START, DAG }) => {
      const list = [];
      for (let i = 0; i < 12; i++) {
        const t = new Date(START - 500 * DAG - i * 60000);
        list.push({ name: backupFileName("BB", t), time: t.getTime() });
      }
      return backupsToRemove(list, START).length;
    }, { START, DAG });
    expect(r).toBe(2);
    page.expectNoErrors();
  });
});

test.describe("automatisch een reservekopie", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(START);
    await openTool(page);
  });

  test("bij het verbinden met de map komt er een kopie in de map backups", async ({ page }) => {
    await verbindMap(page);
    expect(await kopieen(page)).toEqual(["evaluaties-BB-2026-09-29-10u00.json"]);
    const inhoud = await page.evaluate(() => JSON.parse(folderHandle.dirs.get("backups").files.get("evaluaties-BB-2026-09-29-10u00.json").text));
    expect(inhoud.format).toBe("stem-eval");
    expect(inhoud.assessor).toBe("BB");
    expect(Object.keys(inhoud.schoolYears).length).toBeGreaterThan(0);
    expect(inhoud.localTombstones).toBeTruthy();
    page.expectNoErrors();
  });

  test("hoogstens één kopie per uur, en geen kopie als er niets veranderde", async ({ page }) => {
    await verbindMap(page);
    await beoordeel(page, 2);
    await page.clock.setFixedTime(START + 30 * 60000);
    await opgeslagen(page);
    expect((await kopieen(page)).length).toBe(1);

    await page.clock.setFixedTime(START + UUR + 60000);
    await beoordeel(page, 3);
    await opgeslagen(page);
    expect(await kopieen(page)).toEqual([
      "evaluaties-BB-2026-09-29-10u00.json",
      "evaluaties-BB-2026-09-29-11u01.json",
    ]);

    // Een uur later, maar niets veranderd: geen nieuwe kopie.
    await page.clock.setFixedTime(START + 3 * UUR);
    await opgeslagen(page);
    expect((await kopieen(page)).length).toBe(2);
    page.expectNoErrors();
  });

  test("na herladen geen dubbele kopie van dezelfde stand", async ({ page }) => {
    await verbindMap(page);
    await page.clock.setFixedTime(START + 5 * 60000);
    // Nieuwe sessie: het geheugen van de vorige kopie is weg, de map niet.
    await page.evaluate(async () => {
      lastBackupAt = 0;
      lastBackupContent = null;
      await writeHandle();
      await (backupBusy || Promise.resolve());
    });
    expect((await kopieen(page)).length).toBe(1);
    page.expectNoErrors();
  });

  test("oude kopieën worden opgeruimd, die van collega's niet", async ({ page }) => {
    await verbindMap(page);
    await page.evaluate(({ START, DAG }) => {
      const dir = folderHandle.dirs.get("backups");
      for (let i = 0; i < 20; i++) {
        dir.files.set(backupFileName("BB", new Date(START - (400 + i) * DAG)), { text: "{}", lastModified: 0 });
      }
      dir.files.set(backupFileName("MD", new Date(START - 500 * DAG)), { text: "{}", lastModified: 0 });
    }, { START, DAG });
    await page.clock.setFixedTime(START + 2 * UUR);
    await beoordeel(page, 1);
    await opgeslagen(page);
    const namen = await kopieen(page);
    expect(namen.filter((n) => n.startsWith("evaluaties-BB-")).length).toBe(10);
    expect(namen.filter((n) => n.startsWith("evaluaties-MD-")).length).toBe(1);
    page.expectNoErrors();
  });

  test("Team bijwerken leest de kopieën niet in", async ({ page }) => {
    await verbindMap(page);
    const r = await page.evaluate(async () => {
      const res = await readTeamFolder(folderHandle, teamFileName(db.assessor), CONFIG);
      return { files: res.files.length, problems: res.problems.length };
    });
    expect(r).toEqual({ files: 0, problems: 0 });
    page.expectNoErrors();
  });
});

test.describe("terugzetten", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(START);
    await openTool(page);
  });

  test("zonder gedeelde map staat er niets over reservekopieën", async ({ page }) => {
    await page.click("#btnSettings");
    await page.click("#btnTeam");
    await expect(page.locator("#backupSection")).toBeHidden();
    page.expectNoErrors();
  });

  test("een vorige versie terugzetten via het Teamscherm", async ({ page }) => {
    await verbindMap(page);
    const s = await beoordeel(page, 4);
    await page.clock.setFixedTime(START + UUR + 60000);
    await opgeslagen(page);

    // De fout: de beoordeling wordt gewist en een klas verwijderd voor iedereen.
    await page.clock.setFixedTime(START + 2 * UUR);
    await page.evaluate(({ key, klas }) => {
      db.sessions[key] = [];
      delete db.roster["1ste jaar"][klas];
      recordDeletion("roster", db.currentSchoolYear + "||1ste jaar||" + klas, "iedereen");
      persist();
    }, s);
    await opgeslagen(page);
    await page.clock.setFixedTime(START + 3 * UUR);

    await page.click("#btnSettings");

    await page.click("#btnTeam");
    await expect(page.locator("#backupSection")).toBeVisible();
    await expect(page.locator("#backupWhere")).toHaveText("Gedeeld/backups");
    // Om 12u00 nog geen nieuwe kopie (minder dan een uur na 11u01): die van
    // 11u01 heeft de fout dus niet.
    const rijen = page.locator("#backupList .backup-row");
    await expect(rijen).toHaveCount(2);
    await expect(rijen.first()).toContainText("dinsdag 29 september 2026 om 11u01");
    await expect(rijen.first()).toContainText("nieuwste");

    let vraag = "";
    page.once("dialog", (d) => { vraag = d.message(); d.accept(); });
    await rijen.filter({ hasText: "om 11u01" }).getByRole("button", { name: "Terugzetten" }).click();
    await expect(page.locator("#notice")).toContainText("Vorige versie teruggezet");
    expect(vraag).toContain("dinsdag 29 september 2026 om 11u01");
    expect(vraag).toContain("1 evaluatie(s), nu zijn het er 0");
    expect(vraag).not.toContain("—");

    const na = await page.evaluate(({ key, klas, crit }) => ({
      rows: (db.sessions[key] || []).length,
      score: db.sessions[key] && db.sessions[key][0].scores[crit],
      klas: !!db.roster["1ste jaar"][klas],
    }), s);
    expect(na).toEqual({ rows: 1, score: 4, klas: true });

    // Er kwam eerst een kopie bij van hoe het was, zodat dit ongedaan kan.
    await expect(rijen).toHaveCount(3);
    expect(await kopieen(page)).toContain("evaluaties-BB-2026-09-29-13u00.json");
    page.expectNoErrors();
  });

  test("terugzetten annuleren verandert niets", async ({ page }) => {
    await verbindMap(page);
    const s = await beoordeel(page, 4);
    await page.evaluate(({ key }) => { db.sessions[key] = []; persist(); }, s);
    await opgeslagen(page);
    await page.click("#btnSettings");
    await page.click("#btnTeam");
    page.once("dialog", (d) => d.dismiss());
    await page.locator("#backupList .backup-row").last().getByRole("button", { name: "Terugzetten" }).click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(({ key }) => (db.sessions[key] || []).length, s)).toBe(0);
    await expect(page.locator("#backupList .backup-row")).toHaveCount(1);
    page.expectNoErrors();
  });

  test("de teruggezette versie wint van een collega die de fout al had", async ({ page }) => {
    await verbindMap(page);
    const s = await beoordeel(page, 4);
    await page.clock.setFixedTime(START + UUR + 60000);
    await opgeslagen(page);
    const goed = (await kopieen(page)).pop();

    // De fout: score overschreven, klas verwijderd voor iedereen, rubric weg.
    await page.clock.setFixedTime(START + 2 * UUR);
    await beoordeel(page, 1);
    await page.evaluate(({ klas, ev }) => {
      delete db.roster["1ste jaar"][klas];
      recordDeletion("roster", db.currentSchoolYear + "||1ste jaar||" + klas, "iedereen");
      delete db.evaluations["1ste jaar"][ev];
      recordDeletion("evaluations", "1ste jaar||" + ev, "iedereen");
      persist();
    }, s);

    // Een collega nam de fout al over en slaat haar bestand op in de map.
    await page.evaluate(() => {
      const blob = JSON.parse(JSON.stringify({
        format: DB_FORMAT, version: DB_VERSION, assessor: "MD", schoolYears: db.schoolYears,
        currentSchoolYear: db.currentSchoolYear, activeSchoolYear: db.activeSchoolYear,
        evaluations: db.evaluations, evaluationFolders: db.evaluationFolders,
        tombstones: db.tombstones, team: db.team, settings: db.settings,
      }));
      folderHandle.files.set("evaluaties-MD.json", { text: JSON.stringify(blob), lastModified: Date.now() });
    });
    await opgeslagen(page);

    await page.clock.setFixedTime(START + 3 * UUR);
    page.once("dialog", (d) => d.accept());
    await page.evaluate((name) => restoreBackup(name), goed);
    await expect(page.locator("#notice")).toContainText("Vorige versie teruggezet");

    await page.evaluate(() => syncTeam(true));
    await expect(page.locator("#btnSyncTeam")).toHaveText("Team bijwerken");
    const na = await page.evaluate(({ key, klas, crit, ev }) => ({
      score: db.sessions[key][0].scores[crit],
      klas: !!db.roster["1ste jaar"][klas],
      rubric: !!db.evaluations["1ste jaar"][ev],
    }), s);
    expect(na).toEqual({ score: 4, klas: true, rubric: true });
    page.expectNoErrors();
  });

  test("de datum van de beoordeling blijft dezelfde na terugzetten", async ({ page }) => {
    await verbindMap(page);
    const s = await beoordeel(page, 4);
    const voor = await page.evaluate(({ key }) => db.sessions[key][0].createdAt, s);
    await page.clock.setFixedTime(START + UUR + 60000);
    await opgeslagen(page);
    const goed = (await kopieen(page)).pop();
    await page.clock.setFixedTime(START + 2 * UUR);
    await beoordeel(page, 1);
    await opgeslagen(page);
    page.once("dialog", (d) => d.accept());
    await page.evaluate((name) => restoreBackup(name), goed);
    await expect(page.locator("#notice")).toContainText("Vorige versie teruggezet");
    const na = await page.evaluate(({ key }) => db.sessions[key][0], s);
    expect(na.createdAt).toBe(voor);
    expect(na.updatedAt).toBeGreaterThan(START + 2 * UUR);
    page.expectNoErrors();
  });

  test("Nu een reservekopie maken", async ({ page }) => {
    await verbindMap(page);
    await beoordeel(page, 2);
    await page.clock.setFixedTime(START + 5 * 60000);
    await page.click("#btnSettings");
    await page.click("#btnTeam");
    await page.click("#btnBackupNow");
    await expect(page.locator("#notice")).toContainText("Reservekopie gemaakt");
    await expect(page.locator("#backupList .backup-row")).toHaveCount(2);
    page.expectNoErrors();
  });
});
