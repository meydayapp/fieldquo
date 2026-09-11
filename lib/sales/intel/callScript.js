// lib/sales/intel/callScript.js
//
// The call script a model writes for ONE claimed prospect — what goes in,
// what may come out, and how to tell whether it needs writing again.
//
// ══ Where this sits between the brief and the playbook ════════════════════
//
// lib/sales/intel/brief.js composes the pre-call card from rows and lets a
// model rephrase two slots of it. lib/sales/playbook builds the nine-stage
// script from rules and templates, the same for every prospect of a tier. The
// owner read both on a claimed prospect and asked for "more details on the
// company from the crawler and AI revision with the Script" — one page that
// takes what the crawler actually saw and turns it into what THIS rep says to
// THIS business. That is this file's output: a structured script, generated
// once per claimed prospect by the GENERATE_CALL_SCRIPT stage, stored on
// ProspectCallScript, and read on every page view without a model in the
// loop.
//
// ══ What the model is shown, and what it is not ════════════════════════════
//
// Sentences. The brief's known facts as "label: detail", its gaps as "label:
// why we do not know", the talking points as the rule's own reason, the tier
// playbook's name and its stage lines, the objection library's labels and
// answers. No ids, no evidence rows, no scores, no counts, no phone number —
// nothing that could be quoted as a fact the model did not receive as a
// sentence. The model's job is arrangement and phrasing, and the prompt says
// so in as many words.
//
// ══ English only, by decision ═════════════════════════════════════════════
//
// Reps read the portal in nine languages. Generating a script per language
// would multiply the cost by the number of languages a claimed prospect's
// reps might speak, for words that are read to an English- (or French-)
// speaking contractor anyway. So the script is generated in English, the
// headings around it are keyed and translated by the screen, and the rep's
// own rules-built script — which already renders the SalesPlaybook rows
// verbatim — stays below it in full.
//
// ══ No digits ════════════════════════════════════════════════════════════
//
// The same gate brief.js keeps, for the same reason: the commonest way a
// model invents a fact is a number — a price, a year in business, a review
// count. The schema has no numeric field and every string is checked for a
// digit afterwards. A script that fails is not stored; the rules-built
// script below it carries whatever numbers the SalesPlaybook rows carry,
// written by a person.
//
// ══ Version 2: it has to sound like a person ══════════════════════════════
//
// The owner read the first script written for a real prospect and rewrote
// its opener by hand. His sentence is in the prompt below as the ONE style
// example, and lib/sales/scriptVoice.js holds the mechanical half of the
// same correction — the lint the handler runs on every reply. What changed
// in the prompt: contractions, one idea per sentence, plain verbs (bring in,
// book, get paid), the rep's first name, a benefit said before any feature
// is named, no "rather than", no clever inversions, and the next step is a
// fifteen-minute demo — never a promise to build anything on their site.
//
// The version is INSIDE the hashed inputs, so bumping it regenerates every
// stored script on its next open. That is deliberate and it costs money:
// every ProspectCallScript row is one model call again. The cost is in the
// commit that bumped it.
//
// ══ Unique to this company, or honestly generic ═══════════════════════════
//
// The owner's second note on the same script: "shouldn't the SCRIPT be
// unique to this company, based on the information found and what is
// inferred?" So the model now reads what the crawler read — excerpts of the
// about, services and home pages (lib/sales/intel/pageExcerpts.js, about two
// thousand tokens) — plus every ProspectInference row by kind and value, and
// the directory's own facts (trade, town, rating, review count, source). The
// prompt REQUIRES the opener and the why-them paragraph to each use a
// specific detail from that material and to cite it: `citations` carries the
// field, the quote and where it came from, and the handler verifies every
// quote against the text it was given before the script is stored. A
// prospect with no crawled text and no inferences gets the plain opener, and
// the task note says so rather than the script pretending.
import { createHash } from "node:crypto";
import { integerInWords, ratingInWords } from "./pageExcerpts";

/** Bumped when the prompt or the schema changes. A stored script with an
 *  older version is regenerated on the next claim, whatever its input hash. */
export const CALL_SCRIPT_VERSION = "2";

/**
 * The one style example. The owner's own rewrite of the opener, verbatim —
 * the register every sentence of the script is held to. Exported so the
 * check can lint it and assert it passes.
 */
export const CALL_SCRIPT_STYLE_EXAMPLE =
  "Hi — is that South County Electric, LLC? My name's Daniel and I'm from FieldQuo. " +
  "I'm calling because I've been through your website and we noticed a few things that " +
  "are missing that could help you bring in more clients and book more jobs. Do you have " +
  "a few minutes so I can show you how?";

/** The next step every script asks for. The rep is not tech support. */
export const CALL_SCRIPT_NEXT_STEP =
  "a fifteen-minute demo of the features that matter to them — \"I can show you in fifteen " +
  "minutes how it works for a business like yours\"";

/** The PlatformAiUsage.area this stage's spend is filed under. */
export const CALL_SCRIPT_AI_AREA = "call_script";

/**
 * The completion budget. A floor rather than a ceiling — provider.js raises
 * it to its own per-model minimum for a reasoning model. Sized for the shape
 * below: roughly three hundred words of script inside the JSON envelope.
 */
export const CALL_SCRIPT_MAX_TOKENS = 1_600;

/** How many items each list may carry. Bounds, so a verbose model cannot
 *  turn a script into a page. */
export const CALL_SCRIPT_LIMITS = Object.freeze({
  whatWeSaw: { min: 1, max: 6 },
  threeQuestions: { min: 3, max: 3 },
  objections: { min: 2, max: 5 },
  doNotSay: { min: 1, max: 6 },
  /** One list line — a thing we saw, a question, a thing not to say. */
  sentence: 320,
  /** A spoken paragraph — the opener, whyThemNow, an objection's answer, the
   *  close. The prompt asks for "two or three sentences" here, and the first
   *  live run rejected 17 of 73 paid scripts at 320 characters for exactly
   *  that: a three-sentence paragraph is longer than one line. */
  paragraph: 800,
});

/** How much of each input reaches the prompt. The playbook has nine stages
 *  and the objection library has a dozen entries; a prompt that carried all
 *  of them verbatim would cost four times the script it produces. */
export const CALL_SCRIPT_INPUT_LIMITS = Object.freeze({
  known: 16,
  unknown: 8,
  talkingPoints: 5,
  stages: 6,
  objections: 6,
  text: 240,
  /** ProspectInference rows, generic by kind: the two rules' kinds plus the
   *  ten INFER_FROM_SITE writes (lib/sales/inferenceKinds.js), read the
   *  same way. */
  inferences: 12,
  /** Page excerpts are bounded by characters in pageExcerpts.js, not here. */
  pages: 4,
});

/** The fields that must cite something about THIS business. */
export const CITED_FIELDS = Object.freeze(["opener", "whyThemNow"]);

/** A citation's quote — long enough to be found, short enough to be one. */
export const MAX_QUOTE_CHARS = 200;

/** Known-fact ids the model is not shown. See callScriptInputs. */
export const OMITTED_FACTS = Object.freeze(new Set(["phone", "record_age"]));

/** "Daniel Ortega" → "Daniel". A rep says their first name on the phone. */
export function firstName(name) {
  const s = typeof name === "string" ? name.trim() : "";
  return s ? s.split(/\s+/)[0] : "";
}

const clip = (value, n = CALL_SCRIPT_INPUT_LIMITS.text) => {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/**
 * The material the model is shown, as plain sentences.
 *
 * @param brief        composeBrief() output — the plain card is enough
 * @param playbook     the tier playbook: { name, describe, selectorLabel }
 *                     or null when no rule opened one
 * @param stages       the rules-built script's stages [{ name, say: { text }, prompts }]
 * @param objections   objectionsForProspect() rows [{ label, response }]
 * @param unchecked    the index's "we did not look" list, as labels
 * @param repName      the claiming rep's first name, or null when the
 *                     prospect has no rep. In the hash: a prospect handed
 *                     to a different rep is read by a different voice.
 * @param pages        selectPageExcerpts() output [{ url, text }] — what the
 *                     crawler read, already chosen and capped
 * @param inferences   ProspectInference rows [{ kind, value }], every kind
 * @param prospect     the row, for the directory facts: tradeKey, city,
 *                     province, googleRating, googleReviewCount, sourceProvider
 *
 * Every field is a string or a list of strings. The hash is taken over this
 * object, so anything that changes what the model sees changes the hash.
 */
export function callScriptInputs({
  brief = null,
  playbook = null,
  stages = [],
  objections = [],
  unchecked = [],
  repName = null,
  pages = [],
  inferences = [],
  prospect = null,
} = {}) {
  const L = CALL_SCRIPT_INPUT_LIMITS;
  const known = (brief?.known || [])
    .filter((k) => k?.label && k?.detail)
    // The phone number and the directory's refresh date are on the rep's card
    // already and are the two facts a model can only misuse in a script: one
    // is digits, and the other invites "you updated your listing in August".
    .filter((k) => !OMITTED_FACTS.has(k.id))
    // The card's inference-layer lines — the owner's name, the years, the
    // crew, from INFER_FROM_SITE — are printed under WHAT WE INFERRED below,
    // framed as a guess the contractor can correct. Printed here too they
    // would be facts, which is the collapse the three layers exist to
    // prevent, and the model would read the same line twice.
    .filter((k) => k.layer !== "inference")
    .slice(0, L.known)
    .map((k) => `${clip(k.label, 60)}: ${clip(k.detail)}`);
  const unknown = (brief?.unknown || [])
    .filter((u) => u?.label)
    .slice(0, L.unknown)
    .map((u) => `${clip(u.label, 60)}: ${clip(u.reasonText || u.reason || "not known")}`);
  const talkingPoints = (brief?.talkingPoints || [])
    .filter((t) => t?.label && (t?.reason || t?.angle))
    .slice(0, L.talkingPoints)
    .map((t) => `${clip(t.label, 60)}: ${clip(t.angle || t.reason)}`);
  const stageLines = (Array.isArray(stages) ? stages : [])
    .filter((s) => s?.name && (s?.say?.text || (s?.prompts || []).some((p) => p?.text)))
    .slice(0, L.stages)
    .map((s) => {
      const say = clip(s.say?.text || "");
      const prompts = (s.prompts || []).map((p) => clip(p?.text || "")).filter(Boolean).slice(0, 3);
      return `${clip(s.name, 60)}${say ? ` — ${say}` : ""}${prompts.length ? ` [${prompts.join(" / ")}]` : ""}`;
    });
  const objectionLines = (Array.isArray(objections) ? objections : [])
    .filter((o) => o?.label && o?.response)
    .slice(0, L.objections)
    .map((o) => `${clip(o.label, 120)} → ${clip(o.response)}`);

  // Generic by kind: "trade: electrical", "derived_site: example.com", and
  // whatever the AI inference stage adds next — crew size, years, service
  // area, owner name. Not a hard-coded list, on purpose; a new kind reaches
  // the script the day it is written.
  const inferenceLines = (Array.isArray(inferences) ? inferences : [])
    .filter((r) => r?.kind && r?.value != null && String(r.value).trim())
    .slice(0, L.inferences)
    .map((r) => `${clip(String(r.kind).replace(/_/g, " "), 60)}: ${clip(String(r.value), 200)}`);

  // Page text is NOT clipped again here: pageExcerpts.js already chose and
  // bounded it, and a second clip at 240 characters would throw the about
  // page away. The URL is kept so a citation can name its page.
  const pageExcerpts = (Array.isArray(pages) ? pages : [])
    .filter((p) => p?.text)
    .slice(0, L.pages)
    .map((p) => ({ url: String(p.url || ""), text: String(p.text).replace(/\s+/g, " ").trim() }));

  return {
    version: CALL_SCRIPT_VERSION,
    repName: clip(firstName(repName), 40),
    business: clip(brief?.known?.find((k) => k?.id === "business_name")?.detail || "", 120),
    opening: clip(brief?.opening || ""),
    crawled: brief?.crawled === true,
    facts: directoryFacts(prospect),
    pages: pageExcerpts,
    inferences: inferenceLines,
    known,
    unknown,
    talkingPoints,
    competitor: clip(brief?.competitor?.technologyCode || ""),
    playbook: playbook
      ? clip([playbook.name, playbook.selectorLabel || playbook.describe].filter(Boolean).join(" — "))
      : "",
    stages: stageLines,
    objections: objectionLines,
    unchecked: (Array.isArray(unchecked) ? unchecked : []).map((u) => clip(String(u), 80)).filter(Boolean).slice(0, 8),
  };
}

/**
 * What the directory said about the business, in words the script may use.
 *
 * Rating and review count are spelled out because the script may not carry
 * a digit; a number the directory supplied is a real fact and the model may
 * say it, but only in the form the gate lets through.
 */
export function directoryFacts(prospect) {
  const p = prospect || {};
  const rating = Number(p.googleRating);
  const reviews = Number(p.googleReviewCount);
  const place = [p.city, p.province].filter(Boolean).join(", ");
  return {
    trade: clip(String(p.tradeKey || "").replace(/_/g, " "), 60),
    place: clip(place, 120),
    rating: Number.isFinite(rating) && rating > 0 ? `${ratingInWords(rating)} out of five` : "",
    reviews: Number.isInteger(reviews) && reviews > 0
      ? `${integerInWords(reviews)} review${reviews === 1 ? "" : "s"}`
      : "",
    source: clip(String(p.sourceProvider || ""), 60),
  };
}

/**
 * Everything a citation may be checked against: the page text and the
 * inference lines, exactly as the prompt printed them. Pure, so the lint and
 * the check share one definition of "the material the model was given".
 */
export function citationSources(inputs) {
  const i = inputs || {};
  return [
    ...(i.pages || []).map((p) => ({ url: p.url || "", text: p.text || "" })),
    ...(i.inferences || []).map((line) => ({ url: "inference", text: String(line) })),
  ].filter((s) => s.text);
}

/**
 * The hash a stored script is compared against.
 *
 * Over the inputs the model is shown, canonically serialised, so two claims
 * of the same prospect between the same two crawls hash the same and spend
 * nothing the second time — and a new crawl, a corrected capability or an
 * edited objection changes it and regenerates. The version is inside the
 * inputs, so a prompt change regenerates too.
 */
export function callScriptInputHash(inputs) {
  return createHash("sha256").update(JSON.stringify(inputs ?? null)).digest("hex").slice(0, 40);
}

/**
 * The strict schema. No numeric field anywhere, additionalProperties false at
 * every level, every property required — the subset provider.js lints for.
 */
export function callScriptSchema() {
  const strings = { type: "array", items: { type: "string" } };
  return {
    type: "object",
    additionalProperties: false,
    required: ["opener", "whatWeSaw", "whyThemNow", "threeQuestions", "objections", "closeAsk", "doNotSay", "citations"],
    properties: {
      opener: { type: "string" },
      whatWeSaw: strings,
      whyThemNow: { type: "string" },
      threeQuestions: strings,
      objections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["they", "you"],
          properties: { they: { type: "string" }, you: { type: "string" } },
        },
      },
      closeAsk: { type: "string" },
      doNotSay: strings,
      // Which detail about THIS business each cited field used, and where it
      // came from. `sourceUrl` is the page's URL, or "inference" for a row
      // from ProspectInference. Verified against the supplied material
      // before the script is stored — a quote nothing was given is a fact
      // the model made up.
      citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "quote", "sourceUrl"],
          properties: { field: { type: "string" }, quote: { type: "string" }, sourceUrl: { type: "string" } },
        },
      },
    },
  };
}

export const CALL_SCRIPT_SYSTEM =
  "You write what a salesperson SAYS on a phone call to a small field-service contractor — " +
  "a painter, an electrician, a plumber, often in a van. Spoken English, as a person talks. " +
  "You arrange and phrase ONLY the notes you are given. You never add a fact, a name, a figure, " +
  "a price, a year, a count or a guess about the business that is not in the notes. Where the " +
  "notes say something is not known, the script asks about it instead of asserting it. " +
  "No digits anywhere.";

/**
 * The register, spelled out. One list, quoted in the prompt and asserted by
 * the check, so the rules the lint enforces are the rules the model was
 * told. A ban the model was never told about is a rejection it cannot
 * avoid, paid for.
 */
export const CALL_SCRIPT_STYLE_RULES = Object.freeze([
  "Use contractions: I'm, I've, you're, we've, that's, don't.",
  "Complete sentences. Every sentence has a subject and a verb. No fragments.",
  "One idea per sentence. Thirty words or fewer per sentence.",
  "Plain verbs: bring in, book, get paid, show, send. Not leverage, streamline, optimise, enable.",
  "No clever inversions. Say the plain thing first, then the reason.",
  "Never say \"rather than\". Never say \"that's not why I called\".",
  "An em dash may carry an aside of four words or fewer. Longer than that is its own sentence.",
  "Say the benefit before any feature: more clients, more booked jobs, paid faster. Then, if at all, the name of the thing.",
  "The rep says their first name and the business's name in the first two sentences.",
  "The next step is always " + CALL_SCRIPT_NEXT_STEP + ". Never offer to build, install, set up or put anything on their website. The rep is not tech support.",
  "No day of the week and no clock time anywhere. The rep reads the time off their calendar.",
]);

/**
 * The prompt. Sentences only — see the header.
 *
 * The shape is spelled out in words as well as enforced by the schema,
 * because a schema says what a field is called and not what it is for.
 */
function factLines(facts) {
  const f = facts || {};
  const out = [];
  if (f.trade) out.push(`Trade: ${f.trade}`);
  if (f.place) out.push(`Where: ${f.place}`);
  if (f.rating || f.reviews) out.push(`Directory rating: ${[f.rating, f.reviews].filter(Boolean).join(", from ")}`);
  if (f.source) out.push(`Listed by: ${f.source}`);
  return out;
}

export function callScriptPrompt(inputs) {
  const i = inputs || {};
  const list = (rows) => (rows.length ? rows.map((r) => `- ${r}`).join("\n") : "- (nothing)");
  return [
    `Business: ${i.business || "(unnamed)"}`,
    `The rep's first name: ${i.repName || "(not known — write \"my name's\" and leave the name out)"}`,
    ...factLines(i.facts),
    i.crawled
      ? "The crawler read their website. Everything under WHAT WE KNOW came from it or from the directory that listed them."
      : "The crawler has NOT read their website. Everything under WHAT WE KNOW came from the directory listing only.",
    "",
    "WHAT WE KNOW",
    list(i.known || []),
    "",
    "WHAT WE DO NOT KNOW (ask, never assert)",
    list(i.unknown || []),
    ...(i.unchecked?.length ? ["", "NOT LOOKED AT", list(i.unchecked)] : []),
    ...(i.inferences?.length ? ["", "WHAT WE INFERRED ABOUT THEM (from their own site — say it as a guess they can correct)", list(i.inferences)] : []),
    ...((i.pages || []).length
      ? [
          "",
          "WHAT THEIR OWN WEBSITE SAYS (excerpts, in the business's own words — the one place a detail nobody else could say to them comes from)",
          ...(i.pages || []).flatMap((p) => [`[${p.url || "page"}]`, p.text]),
        ]
      : ["", "THEIR WEBSITE TEXT: none was read. Do not invent a detail about them; the opener stays plain and true."]),
    "",
    "WHY THIS BUSINESS IS WORTH A CALL (the rule that fired, in its own words)",
    list(i.talkingPoints || []),
    ...(i.competitor ? ["", `They appear to already run: ${i.competitor}`] : []),
    "",
    `TIER PLAYBOOK: ${i.playbook || "(no tier playbook opened for this business — use the objection library and the notes alone)"}`,
    "Its stage lines, which the rep also has verbatim:",
    list(i.stages || []),
    "",
    "OBJECTION LIBRARY (label → the answer the team uses)",
    list(i.objections || []),
    "",
    "HOW IT HAS TO SOUND",
    "This is read out loud by a person to a person. Here is the one example of the register, an opener the owner wrote himself:",
    `"${CALL_SCRIPT_STYLE_EXAMPLE}"`,
    "Every sentence you write is held to that register:",
    ...CALL_SCRIPT_STYLE_RULES.map((r) => `- ${r}`),
    "",
    "Write the script for THIS call:",
    "- opener: two to four sentences the rep says first, in the shape of the example. Name the business, say the rep's first name, say what we noticed in plain words and the benefit it could bring, then ask for a few minutes.",
    ...((i.pages || []).length || i.inferences?.length
      ? [
          "- THIS SCRIPT IS FOR ONE COMPANY. The opener and whyThemNow must EACH use at least one specific detail that appears under WHAT THEIR OWN WEBSITE SAYS or WHAT WE INFERRED — their owner's name, how long they have been going, what they emphasise, where they work, a service they lead with — quoted or paraphrased in the rep's words. A script that could be read to any electrician in the state is wrong.",
          `- citations: for every such detail, one entry: field (opener or whyThemNow), quote (the exact words from the material, ${MAX_QUOTE_CHARS} characters or fewer, copied verbatim so they can be checked), sourceUrl (the page URL in brackets above, or "inference"). At least one for opener and one for whyThemNow.`,
        ]
      : [
          "- citations: an empty list. Nothing about their own site was read, so there is nothing to cite; keep the opener plain and do not invent a detail.",
        ]),
    `- whatWeSaw: the ${CALL_SCRIPT_LIMITS.whatWeSaw.max} or fewer things under WHAT WE KNOW most worth saying out loud, one full sentence each, as the rep would say it. Only from the notes.`,
    "- whyThemNow: two or three sentences turning the rule under WHY THIS BUSINESS IS WORTH A CALL into the reason for the call. Benefit first: more clients, more booked jobs, paid faster.",
    "- threeQuestions: exactly three questions, each about something under WHAT WE DO NOT KNOW or NOT LOOKED AT.",
    `- objections: for the ${CALL_SCRIPT_LIMITS.objections.min} to ${CALL_SCRIPT_LIMITS.objections.max} likeliest objections from the library, \`they\` is what they say and \`you\` is the team's answer in the rep's own spoken voice — same register as the example.`,
    "- closeAsk: one or two sentences asking for " + CALL_SCRIPT_NEXT_STEP + ", then \"What works better for you, mornings or afternoons?\" No day, no time.",
    `- doNotSay: up to ${CALL_SCRIPT_LIMITS.doNotSay.max} things the rep must not claim about this business, because the notes do not support them.`,
    "No digits anywhere. English.",
  ].join("\n");
}

/** Why a generated script was rejected. A closed list, for the task note. */
export const CALL_SCRIPT_PROBLEMS = Object.freeze({
  not_object: "the reply was not an object",
  empty_field: "a required line was empty",
  too_long: `a line was longer than ${CALL_SCRIPT_LIMITS.sentence} characters, or a paragraph longer than ${CALL_SCRIPT_LIMITS.paragraph}`,
  digits: "a line contained a digit",
  list_short: "a list had fewer entries than the script needs",
  bad_objection: "an objection was missing `they` or `you`",
  bad_citation: "a citation was missing its field, its quote or its source, or the quote was too long",
});

/**
 * Check a reply against the rules the prompt stated.
 *
 * @returns { ok, script, problems: [code], trimmed: [field] }
 *
 * `script` is the cleaned copy — trimmed, whitespace collapsed — and is only
 * returned when `ok`. A script with one bad line is rejected whole rather
 * than patched: the rep would read a script with a hole in it as complete.
 *
 * A list that is too LONG is cut to its bound and the field named in
 * `trimmed`, not rejected. The first live run rejected the first script ever
 * generated for exactly this: seventeen known facts, a prompt that said "one
 * line per thing", and a bound of six. The vendor had been paid; throwing
 * the reply away over a surplus of true sentences is the wrong economy.
 * Too SHORT is still rejected — fewer than three questions is a script with
 * a hole in it.
 */
export function validateCallScript(raw) {
  const problems = new Set();
  const trimmed = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, script: null, problems: ["not_object"], trimmed };
  }
  const L = CALL_SCRIPT_LIMITS;
  const line = (v, max = L.sentence) => {
    const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (!s) problems.add("empty_field");
    if (s.length > max) problems.add("too_long");
    if (/\d/.test(s)) problems.add("digits");
    return s;
  };
  const paragraph = (v) => line(v, L.paragraph);
  const bounded = (field, v, bounds) => {
    const arr = Array.isArray(v) ? v : [];
    if (arr.length < bounds.min) problems.add("list_short");
    if (arr.length > bounds.max) trimmed.push(field);
    return arr.slice(0, bounds.max);
  };
  // Not `.map(line)`: map would hand the index in as `max`.
  const lines = (field, v, bounds) => bounded(field, v, bounds).map((v) => line(v));

  const script = {
    opener: paragraph(raw.opener),
    whatWeSaw: lines("whatWeSaw", raw.whatWeSaw, L.whatWeSaw),
    whyThemNow: paragraph(raw.whyThemNow),
    threeQuestions: lines("threeQuestions", raw.threeQuestions, L.threeQuestions),
    objections: bounded("objections", raw.objections, L.objections).map((o) => {
      if (!o || typeof o !== "object") { problems.add("bad_objection"); return { they: "", you: "" }; }
      return { they: line(o.they), you: paragraph(o.you) };
    }),
    closeAsk: paragraph(raw.closeAsk),
    doNotSay: lines("doNotSay", raw.doNotSay, L.doNotSay),
    // Citations are quotes of the SOURCE, so the digit rule does not apply to
    // them — "since 1998" copied off the about page is the source's number,
    // not the model's. Whether each quote really is in the source is the
    // voice lint's job (lib/sales/scriptVoice.js), with the material in hand.
    citations: (Array.isArray(raw.citations) ? raw.citations : []).slice(0, 12).map((c) => {
      const field = typeof c?.field === "string" ? c.field.trim() : "";
      const quote = typeof c?.quote === "string" ? c.quote.replace(/\s+/g, " ").trim() : "";
      const sourceUrl = typeof c?.sourceUrl === "string" ? c.sourceUrl.trim() : "";
      if (!field || !quote || quote.length > MAX_QUOTE_CHARS) problems.add("bad_citation");
      return { field, quote, sourceUrl };
    }),
  };

  const list = [...problems];
  return { ok: list.length === 0, script: list.length ? null : script, problems: list, trimmed };
}

/**
 * Does a stored script still stand for these inputs?
 *
 * Same hash and same version: yes, spend nothing. Anything else: regenerate.
 * Pure, so the handler's "skip when unchanged" is one line and a check can
 * drive it.
 */
export function callScriptCurrent(existing, { inputHash, version = CALL_SCRIPT_VERSION } = {}) {
  return Boolean(existing && existing.inputHash === inputHash && existing.promptVersion === version);
}
