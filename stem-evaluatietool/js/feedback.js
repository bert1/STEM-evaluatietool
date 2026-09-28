/* ------------------------------------------------------------------
   FEEDBACK VOOR SMARTSCHOOL
   Bouwt uit de rubric en één beoordeling een korte feedbacktekst voor
   één leerling, om te plakken bij het resultaat in Skore. Volledig
   offline en zonder AI: dezelfde beoordeling geeft altijd dezelfde tekst.

   Steunt op Hattie en Timperley: goede feedback beantwoordt drie vragen.
     Waar ga je naartoe?      (feed-up: opdracht en criteria)
     Waar sta je nu?          (feedback: sterk punt en werkpunt)
     Wat is je volgende stap? (feed-forward: één concrete stap)
   De tool haalt enkel taak- en procesfeedback uit de rubric. Wat over
   zelfregulatie of de leerling zelf gaat, komt alleen uit de eigen
   tekst van de leerkracht (row.feedback en row.feedforward), die
   letterlijk en onverkort wordt overgenomen.

   Regels:
   - De rubric zoals hij was bij het beoordelen (row.rubricVersion).
   - Niet gescoorde criteria tellen niet mee.
   - Positie van een niveau = (score - laagste) / (hoogste - laagste),
     zodat criteria met een verschillend aantal niveaus vergelijkbaar zijn.
   - Werkpunt: laagste positie, bij gelijke stand het eerste criterium
     van de rubric. Geen werkpunt als dat al het hoogste niveau is.
   - Sterk punt: hoogste positie (zelfde volgorde bij gelijke stand),
     enkel vanaf het middelste niveau en enkel als het hoger ligt dan het
     werkpunt. Zo komt er nooit valse lof.
   - Volgende stap: de eigen feedforward als die er is, anders de
     beschrijving van het niveau net boven het werkpunt.
   - Nooit punten, percentages of niveaulabels: Smartschool toont het
     punt al, en een cijfer naast commentaar doet de commentaar vergeten.
   - Richtwaarde FEEDBACK_MAX_CHARS. Is het te lang, dan wordt eerst de
     lijst met criteria korter en valt daarna het sterke punt weg (dat
     laatste enkel als er een werkpunt is). Werkpunt, volgende stap en de
     tekst van de leerkracht blijven altijd staan en worden nooit afgekort.
   ------------------------------------------------------------------ */

var FEEDBACK_MAX_CHARS = 700;

/* "a", "a en b", "a, b en c" */
function joinNl(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " en " + list[list.length - 1];
}

/* Per gescoord criterium: naam, behaald niveau, niveau erboven, positie. */
function scoredCriteria(rubrics, scores) {
  var out = [];
  (rubrics || []).forEach(function (r) {
    var v = scores ? scores[r.id] : undefined;
    if (typeof v !== "number") return;
    var opts = (r.options || []).filter(function (o) { return isFinite(Number(o.score)); })
      .slice().sort(function (a, b) { return Number(a.score) - Number(b.score); });
    var idx = -1;
    opts.forEach(function (o, i) { if (Number(o.score) === v) idx = i; });
    if (idx === -1) return;
    var low = Number(opts[0].score), high = Number(opts[opts.length - 1].score);
    out.push({
      name: String(r.name || "").trim(),
      level: opts[idx],
      next: opts[idx + 1] || null,
      pos: high > low ? (v - low) / (high - low) : 1,
    });
  });
  return out;
}

function criterionLine(prefix, c, option) {
  var desc = String((option && option.desc) || "").trim();
  return prefix + " " + c.name + (desc ? ": " + desc : ".");
}

/* De tekst voor één leerling bij één beoordeling (rij). Puur: leest
   enkel dbObj en row, verandert niets. */
function buildSkoreFeedback(dbObj, year, evaluation, row, student) {
  var rubrics = rubricsForVersion(dbObj, year, evaluation, row.rubricVersion);
  var crit = scoredCriteria(rubrics, row.scores);
  var ownFeedback = String(row.feedback || "").trim();
  var ownForward = String(row.feedforward || "").trim();
  var isGroup = (row.students || []).length > 1;

  var werk = null, sterk = null;
  crit.forEach(function (c) {
    if (!werk || c.pos < werk.pos) werk = c;
    if (!sterk || c.pos > sterk.pos) sterk = c;
  });
  if (werk && !werk.next) werk = null;
  if (sterk && !(sterk.pos >= 0.5 && (!werk || sterk.pos > werk.pos))) sterk = null;

  function compose(fullList, withSterk) {
    var blocks = [];

    var up = ["Waar ga je naartoe?"];
    var names = crit.map(function (c) { return c.name; }).filter(Boolean);
    if (!names.length) {
      up.push("Bij \"" + evaluation + "\" werd je beoordeeld met de rubric.");
    } else if (fullList) {
      up.push("Bij \"" + evaluation + "\" werd je beoordeeld op: " + joinNl(names) + ".");
    } else {
      up.push("Bij \"" + evaluation + "\" werd je beoordeeld op " +
        (names.length === 1 ? "1 criterium" : "de " + names.length + " criteria") + " van de rubric.");
    }
    if (isGroup) up.push("Dit is een groepsbeoordeling: de beschrijvingen gaan over het werk van jullie groep.");
    blocks.push(up.join("\n"));

    var nu = [];
    if (sterk && withSterk) nu.push(criterionLine("Sterk punt bij", sterk, sterk.level));
    if (werk) nu.push(criterionLine("Werkpunt bij", werk, werk.level));
    if (ownFeedback) nu.push(ownFeedback);
    if (nu.length) blocks.push(["Waar sta je nu?"].concat(nu).join("\n"));

    if (ownForward) {
      blocks.push("Wat is je volgende stap?\n" + ownForward);
    } else if (werk && String(werk.next.desc || "").trim()) {
      blocks.push("Wat is je volgende stap?\nOm een niveau hoger te komen bij " + werk.name + ": " + String(werk.next.desc).trim());
    }

    return blocks.join("\n\n");
  }

  var text = compose(true, true);
  if (text.length <= FEEDBACK_MAX_CHARS) return text;
  text = compose(false, true);
  if (text.length <= FEEDBACK_MAX_CHARS || !werk) return text;
  return compose(false, false);
}
