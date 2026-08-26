// lib/voice/knowledge.js
//
// What the receptionist still doesn't know, worked out from what we already
// have. Pure — no database, no model, no network.
//
// ══ The thing this must NOT do ═════════════════════════════════════════════
//
// Write the company's opening hours, services or work areas into prose.
//
// Those three already reach the agent as STRUCTURED facts: factsFor() in
// provision.js reads them from the database on every push, and companyFacts()
// in prompt.js renders them. A drafted sentence saying "we're open weekdays and
// we cover Gatineau" would be the same information stored a second time, in the
// one place nothing updates — so the day somebody edits their hours, the
// structured fact changes and the sentence doesn't, and the phone starts
// telling callers something that was true last year.
//
// So the draft covers only what the structured data CANNOT say. The real owner
// of this feature typed exactly one thing into the note box:
//
//     "we don't do commercial work."
//
// which has nowhere structured to live. `services` says WHAT they do; it never
// says WHO FOR, and the prompt's "they do exactly these things" does not
// exclude a commercial caller. That is the shape of everything below.
//
// ══ Questions, never invented facts ════════════════════════════════════════
//
// Every line this module produces is a QUESTION wrapped in [brackets], reusing
// the placeholder convention from lib/documents/serviceContent.js. Two
// consequences, both deliberate:
//
//   * A draft nobody edited contributes NOTHING to the live agent. Every line
//     is unfilled, and usableNotes() below withholds unfilled lines at the
//     boundary where the note becomes what the phone says.
//   * Nothing is asserted on the contractor's behalf. We do not know how long
//     they have been trading, what they guarantee, or where they would travel
//     to — and a sentence saying so, spoken in their voice to a stranger, is a
//     liability they never agreed to.
//
// ══ No question whose answer is a number ═══════════════════════════════════
//
// "What's your minimum job?" is the obvious gap and it is deliberately absent.
// Its honest answer is a figure; a figure in the note is a figure the model is
// holding while being told never to say one, and rule 1 of SYSTEM_RULES is the
// rule this whole feature must not erode. Gaps here ask about KINDS of work,
// not sizes or prices.

// ── The same [placeholder] syntax as a quote, a longer leash ───────────────
//
// lib/documents/contractTerms.js owns `unfilledPlaceholders`, and this file
// deliberately writes the SAME `[...]` convention so a contractor who has seen
// one has seen both. What it cannot reuse is that helper's 80-character cap:
// there a placeholder is a fragment inside a bullet ("[how many coats]"),
// whereas here the whole line is the question, and a receptionist question is
// a sentence. The check script caught this — every drafted line was sailing
// past the guard untouched, which would have put unanswered questions on the
// phone.
const UNFILLED = /\[[^\]\n]{1,400}\]/;

// ── What may never appear in a drafted line ────────────────────────────────
//
// Checked against our own catalogue AND against anything a model rewrote, in
// both gated languages. A figure or a duration inside a question is the seed of
// a figure or a duration inside the answer, and the answer is what the phone
// reads out.
const FORBIDDEN = [
  // Any digit at all. Cheapest and strictest guard against a price, a year, a
  // count of coats or a "24/7" that a caller will hear as a commitment.
  { name: "a figure", re: /\d/ },
  {
    name: "a date",
    re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|today|tomorrow|weekday|weekend|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|janvier|février|mars|avril|juin|juillet|août|septembre|octobre|novembre|décembre|aujourd'hui|demain|semaine)\b/i,
  },
  {
    name: "a duration",
    // French `an`/`ans` are deliberately absent: "an" is an English article and
    // the check caught it firing on "an actual person". A false positive here
    // silently deletes a good question, which is the failure mode nobody
    // notices — `année` and `mois` cover the French case without the collision.
    re: /\b(hour|hours|minute|minutes|day|days|week|weeks|month|months|year|years|same.day|next.day|overnight|turnaround|heure|heures|jour|jours|mois|année|années|délai|semaine|semaines)\b/i,
  },
  {
    name: "a guarantee",
    re: /\b(guarantee|guaranteed|guarantees|warranty|warranties|warrant|promise|promised|no.obligation|money.back|garantie|garanti|garantie|promesse|sans.engagement)\b/i,
  },
];

/**
 * Why a line may not be used, or null when it is clean.
 *
 * Returns the REASON rather than a boolean so the check script prints which
 * rule a string broke — "contains a duration" is actionable, "false" is not.
 */
export function forbiddenIn(text) {
  const s = String(text ?? "");
  for (const { name, re } of FORBIDDEN) if (re.test(s)) return name;
  return null;
}

// Opening hours STATED in prose. A clock time or a weekday is already refused
// as a figure or a date; what is left is the worded form — "we're open
// evenings", "mornings only".
//
// Deliberately not "closed" / "fermé". Saying somebody is shut is not a
// statement of WHEN, and the check caught this rejecting the one question that
// exists to ask what happens on an out-of-hours call. Over-broad matching here
// deletes good questions silently, which is worse than the duplication it was
// guarding against.
const HOURS_SHAPE =
  /\b(open|opening|evening|evenings|morning|mornings|afternoon|afternoons|overnight|ouvert|ouverture|soir|soirs|matin|matins|après-midi)\b/i;

/**
 * True when a line restates something the agent already receives as fact.
 *
 * The staleness guard. A service label, a work-area name or an opening-hours
 * phrase inside the note is a second copy of a database row, and the copy is
 * the one nobody updates. Matched loosely on purpose: a near-miss here costs a
 * rephrased question, and a miss costs a phone saying something untrue.
 */
export function restatesStructured(text, { services = [], areas = [] } = {}) {
  const s = String(text ?? "");
  if (!s.trim()) return null;
  if (HOURS_SHAPE.test(s)) return "opening hours";
  const flat = s.toLowerCase();
  for (const label of services) {
    const l = String(label || "").trim().toLowerCase();
    if (l.length > 2 && flat.includes(l)) return `the service name "${label}"`;
  }
  for (const area of areas) {
    const a = String(area || "").trim().toLowerCase();
    if (a.length > 2 && flat.includes(a)) return `the work area "${area}"`;
  }
  return null;
}

// ══ The gap catalogue ══════════════════════════════════════════════════════
//
// A CLOSED set. The model may choose from it and reword it; it can neither add
// to it nor decide that something absent from the database is present. Same
// boundary lib/site/generateSite.js draws around section keys.
//
// `answered` is the regex that means "the owner already covered this in their
// own words". Re-asking a question somebody answered is how a helpful screen
// becomes noise, and the owner's real note — "we don't do commercial work" —
// must switch OFF the audience question rather than prompt for it again.
//
// `en` is the fallback wording, used verbatim when there is no AI. The
// localised versions live in app/i18n/appMessages.js under the same id, so the
// no-AI path is a fully translated screen rather than an English one.

/** Gaps the note is the right home for. */
const NOTE_GAPS = [
  {
    id: "audience",
    // Always. Nothing in the schema records who a company will work for —
    // `services` is what, never who for.
    applies: () => true,
    answered:
      /\b(residential|commercial|homeowner|home.owner|domestic|industrial|landlord|property manager|tenant|strata|condo board|business(es)?|résidentiel|commercial|particulier|propriétaire|entreprise|locataire|syndicat)\b/i,
    en: "Who do you work for — people in their own homes, or businesses and property managers as well?",
  },
  {
    id: "turnDown",
    // Only worth asking once they have a service list, because the question is
    // about the EDGE of that list.
    applies: ({ services }) => services.length > 0,
    answered: /\b(don'?t do|do not do|won'?t|never take|turn down|not something we|refuse|ne fait|ne faisons|refuse|refusons)\b/i,
    en: "Inside the work you do, is there any kind of job you turn down — and what should the receptionist say instead of taking it?",
  },
  {
    id: "urgent",
    applies: () => true,
    answered: /\b(urgent|emergency|asap|straight away|right away|leak|urgence|urgent|immédiat)\b/i,
    en: "What counts as urgent in your trade, and who should the receptionist say will ring the caller back?",
  },
  {
    id: "closed",
    // Only when hours EXIST. The agent will state them, and the caller's very
    // next question is "so what happens now?" — which the hours themselves
    // cannot answer. With no hours set the structured fix comes first instead.
    applies: ({ hasHours }) => hasHours,
    answered: /\b(after.hours|out of hours|voicemail|message|answering|call back|ring back|répondeur|rappel|rappeler)\b/i,
    en: "Somebody rings when you are shut. What should the receptionist tell them?",
  },
  {
    id: "outsideArea",
    applies: ({ areas }) => areas.length > 0,
    answered: /\b(travel|further afield|out of area|outside|anywhere|drive to|déplace|déplacer|hors secteur|ailleurs)\b/i,
    en: "A caller is somewhere you do not normally go. Would you still look at the job, or should the receptionist say no?",
  },
  {
    id: "askFor",
    applies: () => true,
    answered: /\b(ask for|speak to|put through|transfer|by name|demander|parler à|transférer)\b/i,
    en: "Is there anyone a returning client might ask for by name, and what should the receptionist do when they do?",
  },
  {
    id: "howYouQuote",
    // Deliberately about METHOD, not money. "Do you charge for a visit" invites
    // a figure; "do you come and look" does not.
    applies: () => true,
    answered: /\b(site visit|come out|come and look|photos|measure|walkthrough|estimate in person|visite|sur place|photos|mesur)\b/i,
    en: "Do you go and look at the job before quoting, or work from photos and measurements? Say it in words — never a price.",
  },
  {
    id: "sound",
    applies: () => true,
    // Tone is what the owner's note is FOR, per prompt.js. Nothing structured
    // will ever hold it.
    answered: /\b(friendly|blunt|formal|casual|polite|chatty|straight|plain|amical|direct|poli|formel)\b/i,
    en: "How should it come across — the way you would answer the phone yourself?",
  },
];

/**
 * Gaps that belong in a database field, NOT in the note.
 *
 * Rendered separately and never written into the drafted text. Telling somebody
 * to type their opening hours into a free-text box, when the agent already
 * reads a structured column, is exactly the duplication this file exists to
 * prevent — so an absent fact produces a QUESTION and a place to answer it,
 * never a sentence.
 */
const STRUCTURED_GAPS = [
  {
    id: "hours",
    applies: ({ hasHours }) => !hasHours,
    href: "/app/settings/company",
    en: "When are you open? Nothing is set, so the receptionist has to tell callers it does not know. Set it in Settings, and leave it out of the note — it is read automatically.",
  },
  {
    id: "services",
    applies: ({ services }) => services.length === 0,
    href: "/app/settings/services",
    en: "What work do you take on? No services are switched on, so the receptionist cannot tell a caller whether you do their job. Switch them on in Settings — they reach the phone on their own.",
  },
  {
    id: "areas",
    applies: ({ areas }) => areas.length === 0,
    href: "/app/settings/work-areas",
    en: "Where do you work? No areas are listed, so a caller from the next town over gets no answer either way. Add them in Settings — they reach the phone on their own.",
  },
  {
    id: "phone",
    applies: ({ company }) => !company?.phone,
    href: "/app/settings/company",
    en: "What is your own number? It is blank, so the receptionist cannot give a caller a way to reach an actual person.",
  },
  {
    id: "place",
    applies: ({ company }) => !company?.city && !company?.province,
    href: "/app/settings/company",
    en: "Where are you based? It is blank, so the receptionist cannot say where you are when somebody asks.",
  },
  {
    id: "booking",
    applies: ({ canBook }) => !canBook,
    href: "/app/settings/availability",
    en: "Should it be able to book visits? Nobody has bookable availability set up, so it can only take preferred times and say someone will confirm.",
  },
];

export const NOTE_GAP_IDS = NOTE_GAPS.map((g) => g.id);
export const STRUCTURED_GAP_IDS = STRUCTURED_GAPS.map((g) => g.id);

/** The i18n key for a gap's fallback wording. */
export const gapKey = (id) => `app.setVoice.kb.${id}`;

/**
 * The per-trade questions, seeded from the quote content the company already
 * has (lib/documents/serviceContent.js).
 *
 * `mayChange` is the list of things a trade genuinely cannot know at quoting
 * time — how many layers of shingle are under the old roof, what the decking
 * looks like once it is off. Those are precisely what a caller asks on the
 * phone, and the receptionist currently has nothing to say about them.
 *
 * The service NAME is deliberately not in the question text: it would be a
 * second copy of a row that a contractor can switch off tomorrow. The trade is
 * carried alongside as `forService`, which the screen shows as a label and the
 * note never contains.
 *
 * @param entries [{ key, label, content }] — content is resolveServiceContent()
 */
export function tradeGaps(entries = []) {
  const out = [];
  for (const entry of entries) {
    const items = Array.isArray(entry?.content?.mayChange) ? entry.content.mayChange : [];
    for (const item of items) {
      const topic = String(item?.title || "").trim();
      if (!topic) continue;
      const question = `Callers ask about "${topic.toLowerCase()}". What should the receptionist say?`;
      // Scrubbed like everything else: a trade whose mayChange title carries a
      // count or a duration must not smuggle one in through this door.
      if (forbiddenIn(question)) continue;
      out.push({
        id: `trade:${entry.key}:${slug(topic)}`,
        kind: "note",
        question,
        forService: entry.label || null,
        source: "serviceContent",
      });
    }
  }
  // Two per company is a prompt; ten is a form nobody fills in.
  return out.slice(0, 3);
}

const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Everything worth asking this company, in order.
 *
 * @param company    { phone, city, province }
 * @param services   enabled trade labels, already in the company's language
 * @param areas      work-area names
 * @param hasHours   whether businessHours holds a real statement
 * @param canBook    whether any bookable availability exists
 * @param notes      VoiceAgent.instructions — what the owner has already said
 * @param trades     see tradeGaps()
 * @param text       (id) => localised question, defaults to the English above
 */
export function gapsFor({
  company = {},
  services = [],
  areas = [],
  hasHours = false,
  canBook = false,
  notes = "",
  trades = [],
  text = null,
} = {}) {
  const ctx = { company, services, areas, hasHours, canBook };
  // Only the filled part counts as an answer. A note still carrying
  // "[who you work for]" has not answered anything, and re-asking is right.
  const said = usableNotes(notes).text;

  const wording = (gap) => {
    const localised = text ? text(gapKey(gap.id)) : null;
    return typeof localised === "string" && localised.trim() ? localised.trim() : gap.en;
  };

  const questions = NOTE_GAPS.filter((g) => g.applies(ctx))
    .filter((g) => !(g.answered && g.answered.test(said)))
    .map((g) => ({ id: g.id, kind: "note", question: wording(g), forService: null, source: "catalogue" }));

  const structured = STRUCTURED_GAPS.filter((g) => g.applies(ctx)).map((g) => ({
    id: g.id,
    kind: "structured",
    question: wording(g),
    href: g.href,
    source: "catalogue",
  }));

  // ── The staleness filter, applied to DERIVED text only ──────────────────
  //
  // Trade questions are built from database content, so they can pick up a
  // trade name or an hours phrase without anybody reading them first. The
  // hand-written catalogue above is not filtered at runtime on purpose: a
  // company whose work area happens to be called "Home" would otherwise
  // silently lose the audience question, which is the single most useful one on
  // the list. The catalogue's cleanliness is asserted statically instead —
  // see scripts/check-voice-knowledge.mjs.
  const safeTrades = trades.filter(
    (t) => !forbiddenIn(t.question) && !restatesStructured(t.question, { services, areas }),
  );

  // Trade questions last: they are the specialised ones, and the general
  // "who do you work for" is the line that changes the most calls.
  return { questions: [...questions, ...safeTrades], structured };
}

/**
 * The drafted note.
 *
 * Every line is wholly bracketed, so an owner who pastes this in and saves it
 * without editing has added nothing the phone will read. That is the point: the
 * draft is a set of prompts, and a prompt that leaks to a caller as a statement
 * would be the invented fact this module refuses to produce.
 */
export function draftNote(questions = []) {
  return questions
    .filter((q) => q && q.kind !== "structured" && String(q.question || "").trim())
    .map((q) => `[${String(q.question).trim().replace(/[[\]]/g, "")}]`)
    .join("\n");
}

/**
 * What of the owner's note the agent may actually be told.
 *
 * The boundary between "what somebody typed" and "what a stranger hears", the
 * way sanitiseBlocks is for the website. A line still carrying an unfilled
 * [placeholder] is WITHHELD — not blanked in the database, where the owner can
 * still see it and fill it in, but never sent to the model.
 *
 * Withholding rather than printing is the same call serviceContent.js makes and
 * for the same reason: a bracket on a quote is a typo somebody spots, whereas a
 * bracket read aloud by something that sounds like the business is the business
 * asking a homeowner to fill in a form.
 *
 * @returns {{ text, withheld }} withheld is the lines, so a screen can say so.
 */
export function usableNotes(notes) {
  const raw = typeof notes === "string" ? notes : "";
  if (!raw.trim()) return { text: "", withheld: [] };

  const kept = [];
  const withheld = [];
  for (const line of raw.split("\n")) {
    if (UNFILLED.test(line)) {
      if (line.trim()) withheld.push(line.trim());
    } else {
      kept.push(line);
    }
  }
  return { text: kept.join("\n").trim(), withheld };
}
