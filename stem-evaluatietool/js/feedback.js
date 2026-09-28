/* ------------------------------------------------------------------
   FEEDBACK VOOR SMARTSCHOOL
   Bouwt uit de rubric en één beoordeling een korte feedbacktekst voor
   één leerling, om te plakken bij het resultaat in Skore. Volledig
   offline en zonder AI: dezelfde beoordeling geeft altijd dezelfde tekst.

   Theorie (zie ook HANDOFF.md, "Feedback voor leerlingen van 12 tot 14"):
   - Hattie en Timperley (2007): goede feedback beantwoordt drie vragen:
     waar ga je naartoe, waar sta je nu, wat is je volgende stap. Sinds
     1.25.0 met korte labels in leerlingentaal in plaats van die vragen.
   - Kluger en DeNisi (1996): feedback die de aandacht op de persoon
     richt, verlaagt de prestatie. Daarom enkel taak- en procesfeedback
     uit de rubric, nooit lof over de persoon.
   - Wisniewski, Zierer en Hattie (2020): informatierijke feedback werkt
     het sterkst. Daarom telkens het criterium en wat de leerling toonde.
   - Mueller en Dweck (1998): prijs de aanpak, niet het talent. De
     feedbackzinnen van de rubric gaan over wat de leerling deed.
   - Yeager en collega's (2014), wise feedback: leerlingen van 12 à 13
     jaar gebruiken feedback veel vaker als de leerkracht zegt dat ze
     gelooft dat de leerling het kan. Daarom één vaste vertrouwenszin bij
     een werkpunt: vertrouwen en hulp, zonder druk (sinds 1.25.2).
   - Butler (1988): geen cijfer naast de commentaar.
   - Shute (2008): kort, concreet, eenvoudige woorden. Hoogstens één
     sterk punt, één werkpunt en één volgende stap.
   - Ook een sterke leerling krijgt een concrete volgende stap: de
     uitdaging van de rubric, geen "doe zo verder".
   Wat over zelfregulatie of de leerling zelf gaat, komt alleen uit de
   eigen tekst van de leerkracht (row.feedback en row.feedforward), die
   letterlijk en onverkort wordt overgenomen. De tekst noemt geen naam:
   de je-vorm maakt hem persoonlijk (namen uit Smartschool staan niet
   betrouwbaar als voornaam in de klaslijst).

   Opbouw (sinds 1.25.0, aanhef en volgende stap aangepast in 1.25.1):
     Dit is je feedback bij "opdracht".
     Dit ging goed:        Bij [criterium]: [feedbackzin]
     Hier kan je groeien:  Bij [criterium]: [feedbackzin]
                           vertrouwenszin, daarna de eigen feedback
     Zo pak je het de volgende keer aan: eigen feedforward, anders de
       volgende stap van het werkpunt (zonder "Bij ...", die gaat over
       het werkpunt net erboven), anders het niveau erboven.
   Criterianamen zeggen sinds 1.25.1 wat de leerling maakte of deed
   ("Je voorspellingen vooraf"); de AI-prompt vraagt dat. Na "Bij" wordt
   "Je" dan "je".
     Zonder werkpunt: "Een uitdaging voor de volgende keer:" met de
       uitdaging van het eerste criterium dat er een heeft.

   Regels:
   - De rubric zoals hij was bij het beoordelen (row.rubricVersion).
   - Niet gescoorde criteria tellen niet mee.
   - Positie van een niveau = (score - laagste) / (hoogste - laagste),
     zodat criteria met een verschillend aantal niveaus vergelijkbaar zijn.
   - Werkpunt: laagste positie, bij gelijke stand het eerste criterium
     van de rubric. Geen werkpunt als dat al het hoogste niveau is.
   - Sterk punt: hoogste positie (zelfde volgorde bij gelijke stand),
     enkel als het hoger ligt dan het werkpunt, en enkel vanaf het niveau
     "doel behaald" (rubric.targetScore, sinds 1.24.0) of, zonder
     doelniveau, vanaf het middelste niveau. Zo komt er nooit valse lof.
   - Feedbackzin (option.say), volgende stap en uitdaging (option.next)
     van het behaalde niveau. Ontbreken ze in de rubricversie van de
     beoordeling, dan uit de huidige rubric (zelfde criterium en score):
     zo'n zin aanvullen maakt bewust geen nieuwe versie. Zonder
     feedbackzin valt de tool terug op de omschrijving (option.desc).
   - Nooit punten, percentages of niveaulabels: Smartschool toont het
     punt al, en een cijfer naast commentaar doet de commentaar vergeten.
   - Richtwaarde FEEDBACK_MAX_CHARS, zonder de eigen tekst van de
     leerkracht. Is het te lang, dan valt het sterke punt weg (enkel als
     er een werkpunt is). Werkpunt, volgende stap en de tekst van de
     leerkracht blijven altijd staan en worden nooit afgekort.
   ------------------------------------------------------------------ */

var FEEDBACK_MAX_CHARS = 500;

var FEEDBACK_LABELS = {
  good: "Dit ging goed:",
  grow: "Hier kan je groeien:",
  next: "Zo pak je het de volgende keer aan:",
  challenge: "Een uitdaging voor de volgende keer:",
};

var FEEDBACK_GROUP_NOTE = "Dit was een groepsopdracht, de feedback gaat over het werk van jullie groep.";

/* Wise feedback (Yeager en collega's, 2014): vertrouwen dat de leerling
   het kan leren, en hulp aanbieden. Sinds 1.25.2 bewust zonder "ik
   verwacht veel", "de lat hoog" of "streng": dat legt bij 12 tot 14 jaar
   te veel druk. Vast in de tool, niet door een AI geschreven. Enkel bij
   een werkpunt. */
var CONFIDENCE_SENTENCES = [
  "Ik geef je deze tip omdat ik weet dat je dit kan leren.",
  "Ik geloof dat je hier stap voor stap beter in wordt.",
  "Ik weet dat je hier sterker in kan worden, en ik help je daar graag bij.",
  "Ik weet dat je dit kan leren. Je mag me altijd om hulp vragen.",
  "Fouten maken hoort bij leren. Ik help je graag verder.",
  "Iedereen leert dit op eigen tempo. Vraag gerust hulp als je vastzit.",
  "Ik ben benieuwd naar je volgende poging.",
];

/* Eenvoudige, vaste hash: dezelfde leerling bij dezelfde evaluatie krijgt
   altijd dezelfde zin, klasgenoten meestal een andere. */
function feedbackHash(text) {
  var h = 0;
  text = String(text || "");
  for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 2147483647;
  return h;
}

function confidenceSentence(student, evaluation) {
  return CONFIDENCE_SENTENCES[feedbackHash(student + "|" + evaluation) % CONFIDENCE_SENTENCES.length];
}

/* Na "Bij criterium:" komt altijd een kleine letter, zodat alle regels
   er hetzelfde uitzien. Een woord met nog een hoofdletter erin (een
   afkorting zoals LED) blijft zoals het is. */
function feedbackSentence(text) {
  text = String(text || "").trim();
  if (!text) return "";
  var first = text.split(/\s+/)[0].replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (first.length > 1 && first.slice(1) === first.slice(1).toLowerCase()) {
    text = text.charAt(0).toLowerCase() + text.slice(1);
  }
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

/* Tekst van een veld van het behaalde niveau; ontbreekt die in de
   rubricversie van de beoordeling, dan uit de huidige rubric (zelfde
   criterium-id en score). */
function levelText(option, field, rubricId, score, currentRubrics) {
  var text = String((option && option[field]) || "").trim();
  if (text || !currentRubrics) return text;
  currentRubrics.forEach(function (cr) {
    if (cr.id !== rubricId) return;
    (cr.options || []).forEach(function (o) {
      if (Number(o.score) === score && String(o[field] || "").trim()) text = String(o[field]).trim();
    });
  });
  return text;
}

/* Per gescoord criterium: naam, behaald niveau, niveau erboven, positie,
   en of het doelniveau gehaald is (null als er geen doelniveau is).
   say: feedbackzin, anders de omschrijving. nextStep: volgende stap, of
   op het hoogste niveau de uitdaging. */
function scoredCriteria(rubrics, scores, currentRubrics) {
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
    var target = typeof r.targetScore === "number" ? r.targetScore : null;
    var say = levelText(opts[idx], "say", r.id, v, currentRubrics);
    out.push({
      name: String(r.name || "").trim(),
      level: opts[idx],
      next: opts[idx + 1] || null,
      say: say || String(opts[idx].desc || "").trim(),
      nextStep: levelText(opts[idx], "next", r.id, v, currentRubrics),
      pos: high > low ? (v - low) / (high - low) : 1,
      reachedTarget: target === null ? null : v >= target,
    });
  });
  return out;
}

/* Een zin als losse regel: met een hoofdletter en een punt. */
function standaloneSentence(text) {
  var sentence = feedbackSentence(text);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/* "Bij [criterium]:" met een naam als "Je voorspellingen vooraf" wordt
   "Bij je voorspellingen vooraf:" (sinds 1.25.1). */
function criterionName(name) {
  return /^(je|jouw|jullie)\s/i.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

function criterionLine(c, text) {
  return c.name ? "Bij " + criterionName(c.name) + ": " + feedbackSentence(text) : standaloneSentence(text);
}

/* De tekst voor één leerling bij één beoordeling (rij). Puur: leest
   enkel dbObj en row, verandert niets. student: de naam van de leerling,
   enkel gebruikt om de vertrouwenszin te kiezen (nooit in de tekst). */
function buildSkoreFeedback(dbObj, year, evaluation, row, student) {
  var rubrics = rubricsForVersion(dbObj, year, evaluation, row.rubricVersion);
  var crit = scoredCriteria(rubrics, row.scores, rubricsFor(dbObj, year, evaluation));
  var ownFeedback = String(row.feedback || "").trim();
  var ownForward = String(row.feedforward || "").trim();
  var isGroup = (row.students || []).length > 1;

  var werk = null, sterk = null;
  crit.forEach(function (c) {
    if (!werk || c.pos < werk.pos) werk = c;
    if (!sterk || c.pos > sterk.pos) sterk = c;
  });
  if (werk && !werk.next) werk = null;
  if (sterk) {
    var enough = sterk.reachedTarget === null ? sterk.pos >= 0.5 : sterk.reachedTarget;
    if (!(enough && (!werk || sterk.pos > werk.pos))) sterk = null;
  }
  // Zonder werkpunt: de uitdaging van het eerste criterium dat er een heeft.
  var challenge = null;
  if (!werk) {
    crit.forEach(function (c) { if (!challenge && !c.next && c.nextStep) challenge = c; });
  }

  function compose(withSterk, withOwn) {
    var blocks = [];
    var feedback = withOwn ? ownFeedback : "";
    var forward = withOwn ? ownForward : "";

    // Geen lijst met criterianamen: die zegt een leerling weken later
    // niets meer (1.25.1). Elke regel hieronder noemt zelf waarover hij gaat.
    var up = "Dit is je feedback bij \"" + evaluation + "\".";
    if (isGroup) up += "\n" + FEEDBACK_GROUP_NOTE;
    blocks.push(up);

    var showSterk = sterk && withSterk;
    if (showSterk) {
      var good = [FEEDBACK_LABELS.good, criterionLine(sterk, sterk.say)];
      if (!werk && feedback) good.push(feedback);
      blocks.push(good.join("\n"));
    }
    if (werk) {
      var grow = [FEEDBACK_LABELS.grow, criterionLine(werk, werk.say), confidenceSentence(student, evaluation)];
      if (feedback) grow.push(feedback);
      blocks.push(grow.join("\n"));
    } else if (!showSterk && feedback) {
      blocks.push(feedback);
    }

    if (forward) {
      blocks.push(FEEDBACK_LABELS.next + "\n" + forward);
    } else if (ownForward) {
      // Enkel bij het meten: de eigen feedforward telt niet mee, en de
      // automatische stap komt er dan toch niet.
    } else if (werk && werk.nextStep) {
      // Gaat over het werkpunt net erboven: zonder "Bij ...", de zin zegt
      // zelf wat de leerling moet doen.
      blocks.push(FEEDBACK_LABELS.next + "\n" + standaloneSentence(werk.nextStep));
    } else if (werk && String(werk.next.desc || "").trim()) {
      blocks.push(FEEDBACK_LABELS.next + "\nOm een niveau hoger te komen bij " + criterionName(werk.name) + ": " +
        feedbackSentence(werk.next.desc));
    } else if (challenge) {
      blocks.push(FEEDBACK_LABELS.challenge + "\n" + criterionLine(challenge, challenge.nextStep));
    }

    return blocks.join("\n\n");
  }

  /* Meten zonder de eigen tekst van de leerkracht: die telt niet mee en
     wordt nooit ingekort. */
  if (compose(true, false).length <= FEEDBACK_MAX_CHARS || !werk) return compose(true, true);
  return compose(false, true);
}

/* Heeft de huidige rubric van een evaluatie al feedbackzinnen? Zo niet,
   dan toont Skore een klein teken in de kolomkop (sinds 1.25.0). */
function evaluationHasFeedbackSentences(dbObj, year, evaluation) {
  var rubrics = rubricsFor(dbObj, year, evaluation) || [];
  return rubrics.some(function (r) {
    return (r.options || []).some(function (o) { return String(o.say || "").trim(); });
  });
}
