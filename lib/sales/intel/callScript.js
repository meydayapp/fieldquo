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
// ══ Three languages, one of them by default ═══════════════════════════════
//
// The first version was English only, on cost: reps read the portal in nine
// languages and a script per language multiplies the spend for words read
// to an English-speaking contractor. The owner then asked for the option —
// "just in case we find ourselves with a French speaker in Quebec or a
// Latino contractor in the USA" — so the script comes in English, French
// and Spanish (SCRIPT_LANGUAGES), and the cost argument is answered by
// WHICH of them is written when:
//
//   · the pipeline writes ONE, the prospect's default language
//     (defaultScriptLanguage: Quebec → fr; otherwise the rep's own portal
//     language when it is one of the three; otherwise en) — so the backlog
//     costs exactly what it did;
//   · the other two are written on demand, when a rep flips the switch on
//     the Script tab, by /api/sales/playbook, metered and rate-limited.
//
// The structure is the same in every language — same keys, same bounds,
// same lint — so the screen renders all three one way. What changes is the
// register the prompt asks for (REGISTER, below): Quebec French with "vous",
// "soumission", "cellulaire"; neutral Latin-American Spanish with "usted".
// The QUOTED EVIDENCE does not change: a citation is the site's own words,
// verbatim, in whatever language the site is in, because the lint checks
// it against the crawled text and a translated quote is a quote of nothing.
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
//
// ══ Version 3: the shape the call data favours ═══════════════════════════
//
// The owner handed over Gong's cold-call research (100k calls in 2019, 300M
// in 2024), Cognism's script and objection guides, and SurveySensum's note
// on open against closed questions, and asked for "better AI instructions
// for the script generation". docs/sales/RESEARCH-cold-calling-2026.md is
// the reading, source by source, with what is evidence and what is opinion
// and what applies to a contractor in a van. What it changed here:
//
//   · the OPENER is Gong's permission-based opener (11.18% against 2.15% for
//     "did I catch you at a bad time"): name, company, the recording aside,
//     an honest pattern interrupt ("this is a cold call, but I've read your
//     site"), the reason for the call stated out loud (2.1x) on a cited
//     detail, and a request for thirty seconds that hands the decision back;
//   · whyThemNow is a PITCH the rep can say in one go — Gong's longest burst
//     in a successful cold call is about thirty-seven seconds and a rep who
//     talks for under twenty-five is half as likely to book — written in
//     problem language (16%) and not buzzwords (5.5%) or other customers
//     (12%, and barred here by non-negotiable 8 anyway);
//   · the questions are LEADING, with their answers in them (Saylor's ladder,
//     Gong's "limit open-ended questions", SurveySensum's closed-first), and
//     they come after the pitch — Gong found no difference in the number of
//     questions on successful and unsuccessful cold calls;
//   · objections follow Cognism's shape: acknowledge, one clarifying
//     question, the library's answer, a check that it landed, the next step
//     — and the two commonest brush-offs (Gong: "not interested" 17%,
//     Cognism: "I'm busy" first) are always among the ones written;
//   · the close sells the fifteen minutes and gets the invite sent while the
//     contractor is still on the line (Gong's "do you have your calendar
//     handy?" and "get the meeting before you hang up");
//   · a new field, ifSomeoneElseAnswers, for the apprentice, the office or
//     the spouse who picks up — the sales floor had no gatekeeper line at
//     all, and Gong puts a gatekeeper at minus thirty-nine per cent;
//   · "we" and "our" for what FieldQuo does, "I" for what the rep asks
//     (Gong: successful calls use "we" thirty-five per cent more);
//   · the opener must name FieldQuo — the first live v2 script for a real
//     prospect dropped the company name entirely, and nothing refused it;
//   · the voice lint now runs the banned-moves table over every spoken
//     sentence (lib/sales/scriptVoice.js rule 8), so a generated "did I
//     catch you at a bad time" is refused and quoted back, not read out.
//
// Every stored v2 script regenerates on its next open (the version is in
// the hash). About six hundred rows at under a cent each; the owner said
// the cost is fine.
import { createHash } from "node:crypto";
import { SERVICES_INFERENCE_KIND, servicesNamesFromValue } from "@/lib/sales/inferenceKinds";
import { integerInWords, ratingInWords } from "./pageExcerpts";
import { requiredLanguageFor } from "@/lib/sales/leadLanguage";
import { repLanguageOrNull } from "@/lib/sales/repLanguage";
import { weaveDisclosure } from "@/lib/sales/playbook/recordingDisclosure";

/** Bumped when the prompt or the schema changes. A stored script with an
 *  older version is regenerated on the next claim, whatever its input hash. */
export const CALL_SCRIPT_VERSION = "3";

/**
 * The one style example — the register every sentence of the script is held
 * to, and now also the SHAPE of the opener.
 *
 * The owner's own rewrite (version 2) is the register: "My name's Daniel and
 * I'm from FieldQuo", "quick heads-up, this call may be recorded", short
 * plain sentences with a verb in each. Version 3 keeps his sentences and
 * puts the call data's structure round them, in order:
 *
 *   1. the business's name, the rep's first name, FieldQuo, the recording
 *      aside in the same breath (the owner's line, unchanged);
 *   2. the honest pattern interrupt — "this is a cold call, but I've read
 *      your site" — which is Gong's permission-based opener (11.18%) and
 *      Cognism's enterprise script ("a well-researched B2B sales call"),
 *      and NOT "how've you been" (Gong's 2019 6.6x, which their 2024 data
 *      ranks below permission and which claims an acquaintance we do not
 *      have) and NOT "did I catch you at a bad time" (2.15%);
 *   3. "The reason I'm calling is…" on a detail from THEIR site — stating
 *      the reason is 2.1x in Gong's data, and a cited detail is what the
 *      owner already required of every opener;
 *   4. a request for thirty seconds phrased so YES is the helpful answer,
 *      that hands the decision back ("then you tell me if it's worth
 *      talking") — Gong's talk track ends the same way.
 *
 * Exported so the check can lint it and assert it passes, and so the
 * printed playbook can quote it.
 */
export const CALL_SCRIPT_STYLE_EXAMPLE =
  "Hi — is that South County Electric, LLC? My name's Daniel and I'm from FieldQuo — quick heads-up, this call may be recorded. " +
  "I'll be straight with you, this is a cold call, but I've read your website. " +
  "The reason I'm calling is your site promises a same-day quote, and I wanted to ask how it " +
  "gets to the customer. Can I take thirty seconds on why, and then you tell me if it's " +
  "worth talking?";

/**
 * The reason line, as the model is told to say it. Gong: stating the reason
 * for the call is 2.1x — "human beings crave reasons", and the prospect's
 * second question after "who is this?" is "why are you calling me?". The
 * plain spoken form, not Gong's "the reason for my call is", which nobody
 * says in a van. Exported so the check can assert the prompt carries it.
 */
export const CALL_SCRIPT_REASON_LINE = "The reason I'm calling is";

/**
 * The words the opener may not open with, by name, so the model is told
 * rather than caught. Each is in docs/sales/RESEARCH-cold-calling-2026.md
 * with the number beside it.
 */
export const CALL_SCRIPT_OPENER_BANS = Object.freeze([
  "did I catch you at a bad time",
  "is now a bad time",
  "how are you today",
  "how've you been",
  "have you got a minute",
]);

/** The next step every script asks for. The rep is not tech support. */
export const CALL_SCRIPT_NEXT_STEP =
  "a fifteen-minute demo of the features that matter to them — \"I can show you in fifteen " +
  "minutes how it works for a business like yours\"";

/** The PlatformAiUsage.area this stage's spend is filed under. */
export const CALL_SCRIPT_AI_AREA = "call_script";

/**
 * The languages a script can be written in. Three, not the portal's nine:
 * the owner named these three, and each one below carries a register the
 * prompt has to be able to describe in words a model will follow. A fourth
 * is a REGISTER entry and a catalogue name, not a flag.
 */
export const SCRIPT_LANGUAGES = Object.freeze(["en", "fr", "es"]);
export const DEFAULT_SCRIPT_LANGUAGE = "en";

/** "fr-CA" → "fr"; anything not in SCRIPT_LANGUAGES → null, never "en". */
export function normalizeScriptLanguage(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase().split(/[-_]/)[0];
  return SCRIPT_LANGUAGES.includes(code) ? code : null;
}

/**
 * Which language the pipeline writes, and the screen opens on.
 *
 * The lead's required language first — Quebec is sold in French
 * (lib/sales/leadLanguage.js requiredLanguageFor), and a French script for
 * a Quebec contractor is the one the owner asked for by name. Then the
 * rep's own portal language, when it is one of the three: a Spanish-
 * speaking rep working a Texas list reads Spanish. Then English. The rep's
 * language is read through repLanguageOrNull so a dropped or hand-edited
 * code reads as "no statement" rather than as a language.
 *
 * @param prospect  { province } — or anything requiredLanguageFor accepts
 * @param rep       { language } — the SalesRep row, or null
 */
export function defaultScriptLanguage({ prospect = null, rep = null } = {}) {
  const required = normalizeScriptLanguage(requiredLanguageFor(prospect));
  if (required) return required;
  const repChoice = normalizeScriptLanguage(repLanguageOrNull(rep?.language));
  return repChoice || DEFAULT_SCRIPT_LANGUAGE;
}

/**
 * The register per language — what the prompt says about HOW to write, in
 * the language's own terms. English is the owner's example and the style
 * rules and needs no more. French is Quebec French: "vous" throughout
 * (tutoiement is not assumed on a first call to a stranger), "soumission"
 * for a quote (a Quebec contractor does not say "devis"), "cellulaire" for
 * the phone. Spanish is neutral Latin-American: "usted", no vosotros, no
 * Peninsular vocabulary. Exported so the check can read the words into the
 * prompt and assert they are there.
 */
export const REGISTER = Object.freeze({
  en: Object.freeze({
    name: "English",
    write: "Write every line of the script in English.",
    rules: Object.freeze([]),
  }),
  fr: Object.freeze({
    name: "Quebec French",
    write: "Write every line of the script in French — the French spoken in Quebec, as a person on the phone in Montreal or Quebec City talks.",
    rules: Object.freeze([
      "Vouvoiement throughout: \"vous\", never \"tu\". This is a first call to a stranger.",
      "A quote is a \"soumission\", never a \"devis\". A phone is a \"cellulaire\". A job is a \"contrat\" or a \"job\". A client is a \"client\".",
      "Contractions and spoken rhythm as Quebec French has them: \"j'ai\", \"c'est\", \"on a\". Short sentences. No anglicisms a francophone would notice, but no Parisian words either.",
      "No day of the week and no clock time — \"lundi\", \"demain à dix heures\", \"vers midi\" are all out. The rep reads the time off their calendar.",
      "Aucun chiffre, nulle part — pas de 24/7, pas d'année, pas de numéro de licence. Un nombre s'écrit en lettres (\"vingt-quatre heures sur vingt-quatre\", \"depuis les années quatre-vingt-dix\") ou ne se dit pas.",
    ]),
  }),
  es: Object.freeze({
    name: "Latin-American Spanish",
    write: "Write every line of the script in Spanish — neutral Latin-American Spanish, as a person on the phone in Texas, Florida or California talks.",
    rules: Object.freeze([
      "\"Usted\" throughout, never \"tú\" and never \"vosotros\". This is a first call to a stranger.",
      "A quote is a \"cotización\" or \"presupuesto\". A job is a \"trabajo\". A client is a \"cliente\". No Peninsular vocabulary (no \"vale\", no \"ordenador\", no \"móvil\" — \"celular\").",
      "Short sentences, spoken rhythm. One idea per sentence.",
      "No day of the week and no clock time — \"el martes\", \"mañana a las diez\", \"al mediodía\" are all out. The rep reads the time off their calendar.",
      "Ningún dígito, en ninguna parte — nada de 24/7, ni años, ni números de licencia. Un número se escribe con letras (\"las veinticuatro horas\", \"desde los años noventa\") o no se dice.",
    ]),
  }),
});

/** The register for a language, or English's when the code is not one of the three. */
export function registerFor(language) {
  return REGISTER[normalizeScriptLanguage(language) || DEFAULT_SCRIPT_LANGUAGE];
}

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
   *  close, the line for whoever else answers. The prompt asks for "two or
   *  three sentences" here, and the first live run rejected 17 of 73 paid
   *  scripts at 320 characters for exactly that: a three-sentence paragraph
   *  is longer than one line. */
  paragraph: 800,
  /** The pitch (whyThemNow) has a FLOOR as well: Gong's longest burst in a
   *  successful cold call is about thirty-seven seconds, and a rep who talks
   *  for under twenty-five is half as likely to book. At roughly a hundred
   *  and fifty words a minute that is sixty to a hundred words — the first
   *  live v2 scripts wrote two sentences of about forty-five, which is the
   *  under-twenty-five-second pitch. Measured in words, not characters, so
   *  French and Spanish are held to the same breath. */
  pitchWords: { min: 60, max: 110 },
});

/** How much of each input reaches the prompt. The playbook has nine stages
 *  and the objection library has a dozen entries; a prompt that carried all
 *  of them verbatim would cost four times the script it produces. */
export const CALL_SCRIPT_INPUT_LIMITS = Object.freeze({
  known: 16,
  unknown: 8,
  talkingPoints: 5,
  stages: 6,
  /** Eight, from six (2026-09-17): the two brush-offs the prompt says are
   *  always written (CALL_SCRIPT_ALWAYS_OBJECTIONS) are put first, and six
   *  more by the library's own priority — the competitor, the price, the
   *  wrong person, the partner. "Not interested" sits at priority 50 on the
   *  rep's panel and never reached the model at six. */
  objections: 8,
  text: 240,
  /** ProspectInference rows, generic by kind: the two rules' kinds, the
   *  eleven INFER_FROM_SITE writes (lib/sales/inferenceKinds.js) and the
   *  evidence-cited `services` list, read the same way. */
  inferences: 14,
  /** Page excerpts are bounded by characters in pageExcerpts.js, not here. */
  pages: 4,
});

/**
 * The objections the model is always shown, whatever the library's
 * priority order, when the library has them. Gong: "not interested" is the
 * commonest objection there is (17%); Cognism: "I'm busy" is first on their
 * floor. Both end the call before the pitch, so the two answers a rep needs
 * word-perfect are the two the prompt must have seen.
 */
export const CALL_SCRIPT_ALWAYS_OBJECTIONS = Object.freeze(["IM_BUSY_RIGHT_NOW", "NOT_INTERESTED"]);

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
 * @param language     "en" | "fr" | "es" — the language the script is
 *                     written in. In the inputs, and so in the hash, because
 *                     it changes what the model is asked; each language is
 *                     its own row and its own hash.
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
  language = DEFAULT_SCRIPT_LANGUAGE,
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
  const objectionRows = (Array.isArray(objections) ? objections : []).filter((o) => o?.label && o?.response);
  const always = CALL_SCRIPT_ALWAYS_OBJECTIONS.map((code) => objectionRows.find((o) => o.code === code)).filter(Boolean);
  const objectionLines = [...always, ...objectionRows.filter((o) => !always.includes(o))]
    .slice(0, L.objections)
    .map((o) => `${clip(o.label, 120)} → ${clip(o.response)}`);

  // Generic by kind: "trade: electrical", "derived_site: example.com", and
  // whatever the AI inference stage adds next — crew size, years, service
  // area, owner name. Not a hard-coded list, on purpose; a new kind reaches
  // the script the day it is written.
  //
  // The one exception is the `services` row, whose value is a JSON list
  // (inferenceKinds.js): the model gets the names, not the brackets.
  const inferenceLines = (Array.isArray(inferences) ? inferences : [])
    .filter((r) => r?.kind && r?.value != null && String(r.value).trim())
    .slice(0, L.inferences)
    .map((r) =>
      r.kind === SERVICES_INFERENCE_KIND
        ? `services they list: ${clip(servicesNamesFromValue(r.value).join(", "), 200)}`
        : `${clip(String(r.kind).replace(/_/g, " "), 60)}: ${clip(String(r.value), 200)}`,
    )
    .filter((line) => !/^services they list: $/.test(line));

  // Page text is NOT clipped again here: pageExcerpts.js already chose and
  // bounded it, and a second clip at 240 characters would throw the about
  // page away. The URL is kept so a citation can name its page.
  const pageExcerpts = (Array.isArray(pages) ? pages : [])
    .filter((p) => p?.text)
    .slice(0, L.pages)
    .map((p) => ({ url: String(p.url || ""), text: String(p.text).replace(/\s+/g, " ").trim() }));

  return {
    version: CALL_SCRIPT_VERSION,
    language: normalizeScriptLanguage(language) || DEFAULT_SCRIPT_LANGUAGE,
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
    required: ["opener", "ifSomeoneElseAnswers", "whatWeSaw", "whyThemNow", "threeQuestions", "objections", "closeAsk", "doNotSay", "citations"],
    properties: {
      opener: { type: "string" },
      // For the apprentice, the office or the spouse who picks up. Version 3;
      // a stored v2 script has no such key and the screen draws nothing for it.
      ifSomeoneElseAnswers: { type: "string" },
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
  "You write what a salesperson SAYS on a cold call to a small field-service contractor — " +
  "a painter, an electrician, a plumber, a roofer, often in a van or up a ladder. Spoken language, as a person talks, " +
  "in the language the notes name. " +
  "The call has one job: earn fifteen minutes on a screen. Not to close, not to price, not to run a discovery session. " +
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
  "Use contractions: I'm, I've, you're, we've, that's, don't. \"I am calling\" is a robot; \"I'm calling\" is a person.",
  "Complete sentences. Every sentence has a subject and a verb. No fragments. Not \"Daniel here, from FieldQuo.\" — \"My name's Daniel and I'm from FieldQuo.\"",
  "One idea per sentence. Thirty words or fewer per sentence. If a sentence needs a second comma, split it.",
  "Plain verbs: bring in, book, get paid, show, send. Not leverage, streamline, optimise, enable.",
  "No buzzwords, ever: not all-in-one, not platform, not solution, not seamless, not game-changer, not single source of truth. Describe the problem in the trade's own words instead: \"the quote you type up at the kitchen table at nine at night\".",
  "No clever inversions. Say the plain thing first, then the reason.",
  "Never say \"rather than\". Never say \"that's not why I called\".",
  "An em dash may carry an aside of four words or fewer. Longer than that is its own sentence. The recording aside is the one exception.",
  "Say the benefit before any feature: more clients, more booked jobs, paid faster. Then, if at all, the name of the thing.",
  "Say we and our for what FieldQuo does — \"we build the quote while you're still in the driveway\". Say I for what the rep asks — \"can I take thirty seconds\". Never I for the product, never we for the ask.",
  "The rep says their first name, the business's name and FieldQuo in the first two sentences. An opener that does not say FieldQuo is refused.",
  "Never open with \"" + CALL_SCRIPT_OPENER_BANS.join("\", \"") + "\". Do not ask how they are. The pattern interrupt is honesty: say it is a cold call and that their site was read, then say " + CALL_SCRIPT_REASON_LINE + "….",
  "No promise about the rep's own time — not \"I'll be quick\", not \"I won't waste your time\", not \"I promise\". A request for thirty seconds is a question, and they answer it.",
  "No other customer, no \"contractors like you\", no counts of anybody, no \"most of our customers\". Nothing about another business is in the notes and nothing may be invented. Describe their problem instead.",
  "Every question carries its own answers so a one-word correction is a full reply: \"same day, or a couple of days later?\" — never an open \"how do you handle…\" or \"what's your process\" on a cold call. The open questions belong in the fifteen minutes.",
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
  const language = normalizeScriptLanguage(i.language) || DEFAULT_SCRIPT_LANGUAGE;
  const register = registerFor(language);
  const list = (rows) => (rows.length ? rows.map((r) => `- ${r}`).join("\n") : "- (nothing)");
  return [
    `LANGUAGE: ${register.name}. ${register.write}`,
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
    ...(language === "en"
      ? ["Every sentence you write is held to that register:"]
      : [`That example is English. Write the SAME register in ${register.name} — the same plainness, the same warmth, the same shape — and every sentence you write is held to it:`]),
    ...CALL_SCRIPT_STYLE_RULES.map((r) => `- ${r}`),
    ...(register.rules.length ? [`In ${register.name} specifically:`, ...register.rules.map((r) => `- ${r}`)] : []),
    "",
    "Write the script for THIS call:",
    "- opener: four or five sentences, in the SHAPE of the example, in this order. First: is that the business, the rep's first name, FieldQuo, and in the SAME breath — as an aside, the way the example does it — that the call may be recorded. The recording aside is one short clause inside the sentence that says who the rep is, never a sentence of its own and never an announcement. Second: own it — this is a cold call, but their site was read. Third: \"" + CALL_SCRIPT_REASON_LINE + "…\" and the reason is one specific detail from WHAT THEIR OWN WEBSITE SAYS or WHAT WE INFERRED, said in plain words, with what it made the rep want to ask. Fourth: ask for thirty seconds, phrased so a yes is the easy answer, and hand the decision back — \"then you tell me if it's worth talking\". Under seventy words after the business's name: that is thirty seconds, and the thirty seconds have not been granted yet. No feature and no product name anywhere in it.",
    "- ifSomeoneElseAnswers: two or three sentences for when the person who picks up is not the owner — the apprentice with the phone on speaker in the van, the office, the spouse who does the paperwork. Say the rep's first name and FieldQuo, ask for the owner by first name when WHAT WE INFERRED gives one, and otherwise ask who prices the work. If the person who answered writes the quotes up, they are the right person — say so and carry on with them. Never say the owner is expecting the call, never say you're following up on an email, never pitch to somebody who cannot buy. Ask when the owner is easiest to catch: first thing, or the end of the day.",
    ...((i.pages || []).length || i.inferences?.length
      ? [
          "- THIS SCRIPT IS FOR ONE COMPANY. The opener and whyThemNow must EACH use at least one specific detail that appears under WHAT THEIR OWN WEBSITE SAYS or WHAT WE INFERRED — their owner's name, how long they have been going, what they emphasise, where they work, a service they lead with — quoted or paraphrased in the rep's words. A script that could be read to any electrician in the state is wrong.",
          `- citations: for every such detail, one entry: field (opener or whyThemNow), quote (the exact words from the material, ${MAX_QUOTE_CHARS} characters or fewer, copied verbatim so they can be checked), sourceUrl (the page URL in brackets above, or "inference"). At least one for opener and one for whyThemNow.${language === "en" ? "" : " The quote stays in the language the material is in — copy it, never translate it; the script sentence that uses it is in " + register.name + "."}`,
        ]
      : [
          "- citations: an empty list. Nothing about their own site was read, so there is nothing to cite; keep the opener plain and do not invent a detail.",
        ]),
    `- whatWeSaw: the ${CALL_SCRIPT_LIMITS.whatWeSaw.max} or fewer things under WHAT WE KNOW most worth saying out loud, one full sentence each, as the rep would say it. Only from the notes.`,
    `- whyThemNow: the pitch — what the rep says in one go after the contractor says yes to the thirty seconds. Between ${CALL_SCRIPT_LIMITS.pitchWords.min} and ${CALL_SCRIPT_LIMITS.pitchWords.max} words, four to six short sentences, said without stopping: that is about thirty-five seconds, which is how long a rep who books the meeting talks for. Shorter than that and the contractor has nothing to react to. It turns the rule under WHY THIS BUSINESS IS WORTH A CALL into their problem, in the trade's own words: what happens today between the homeowner reaching out and a price landing, and what it costs them — the evening at the kitchen table, the enquiry that went cold while they were on a roof. Benefit before feature: more clients, more booked jobs, paid faster. We and our for what FieldQuo does. It ends by selling the fifteen minutes, not the product. It uses a second detail from their site or the inferences and cites it. No buzzword, no other customer, no figure.`,
    "- threeQuestions: exactly three, asked AFTER the pitch, each about something under WHAT WE DO NOT KNOW or NOT LOOKED AT. Every one is a leading question with two or three answers in it, so the cheapest reply is a correction: \"is it you writing the quote up in the evening, or does somebody in the office do it?\" Never an open \"how do you…\" and never a question one word ends.",
    `- objections: the ${CALL_SCRIPT_LIMITS.objections.min} to ${CALL_SCRIPT_LIMITS.objections.max} likeliest from the library for THIS business. Two of them are always the brush-offs that end most cold calls when the library has them: \"I'm busy\" and \"not interested\". \`they\` is what they say, in their words. \`you\` is the team's answer in the rep's spoken voice — same register as the example — in this shape: acknowledge what they said in one clause; where the objection is vague, one short clarifying question; the library's answer; a check that it landed (\"does that cover it, or is there more to it?\"); the next step. Never \"I'll be quick, I promise\". Never a sentence that ends the sequence.`,
    "- closeAsk: sell the meeting, in three parts a contractor can say yes to: what it costs him (fifteen minutes on a screen, nothing to set up), what he gets (" + CALL_SCRIPT_NEXT_STEP + " — say what he will see, in his words), and what he has to do: \"What works better for you, mornings or afternoons?\" Then \"Have you got your calendar handy? I'll send the invite while we're on the phone.\" No day, no time. Nothing after the question.",
    `- doNotSay: up to ${CALL_SCRIPT_LIMITS.doNotSay.max} things the rep must not claim about this business, because the notes do not support them.`,
    `No digits anywhere. ${register.name}.`,
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
  no_company: "the opener did not say FieldQuo — the first live v2 script for a real prospect dropped the company name and nothing refused it",
  pitch_length: `the pitch (whyThemNow) was outside ${CALL_SCRIPT_LIMITS.pitchWords.min} to ${CALL_SCRIPT_LIMITS.pitchWords.max} words — under twenty-five seconds of talking halves the odds of a meeting; over forty is a speech`,
});

/** Words in a spoken paragraph, as a person would count them. */
export function pitchWordCount(text) {
  return String(text || "")
    .replace(/[—–-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

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
export function validateCallScript(raw, { language = DEFAULT_SCRIPT_LANGUAGE } = {}) {
  const problems = new Set();
  const trimmed = [];
  // Which line broke which rule, with enough of it to quote back. The first
  // live French and Spanish drafts were refused on "digits" and the task
  // note could not say where; the retry note below needs the sentence.
  const findings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, script: null, problems: ["not_object"], trimmed, findings: [{ field: "", problem: "not_object", snippet: "" }] };
  }
  const L = CALL_SCRIPT_LIMITS;
  const snippetOf = (s, re) => {
    const at = re ? s.search(re) : 0;
    const start = Math.max(0, (at < 0 ? 0 : at) - 60);
    return `${start ? "…" : ""}${s.slice(start, start + 140)}${s.length > start + 140 ? "…" : ""}`;
  };
  const note = (field, problem, s, re) => { problems.add(problem); findings.push({ field, problem, snippet: snippetOf(s, re) }); };
  const line = (field, v, max = L.sentence) => {
    const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (!s) note(field, "empty_field", s);
    if (s.length > max) note(field, "too_long", s);
    if (/\d/.test(s)) note(field, "digits", s, /\d/);
    return s;
  };
  const paragraph = (field, v) => line(field, v, L.paragraph);
  const bounded = (field, v, bounds) => {
    const arr = Array.isArray(v) ? v : [];
    if (arr.length < bounds.min) note(field, "list_short", `${arr.length} of ${bounds.min}`);
    if (arr.length > bounds.max) trimmed.push(field);
    return arr.slice(0, bounds.max);
  };
  const lines = (field, v, bounds) => bounded(field, v, bounds).map((v, i) => line(`${field}[${i}]`, v));

  const script = {
    // The recording aside is woven in when the model left it out — the fact
    // has to be said on every call and a missing clause is not a reason to
    // throw a script away (lib/sales/playbook/recordingDisclosure.js).
    opener: weaveDisclosure(paragraph("opener", raw.opener), language),
    // Version 3. Optional on the way IN so a v2 reply shape is still
    // readable by the check fixtures; the prompt requires it and the schema
    // lists it, so a live reply always carries it.
    ifSomeoneElseAnswers: raw.ifSomeoneElseAnswers == null ? "" : paragraph("ifSomeoneElseAnswers", raw.ifSomeoneElseAnswers),
    whatWeSaw: lines("whatWeSaw", raw.whatWeSaw, L.whatWeSaw),
    whyThemNow: paragraph("whyThemNow", raw.whyThemNow),
    threeQuestions: lines("threeQuestions", raw.threeQuestions, L.threeQuestions),
    objections: bounded("objections", raw.objections, L.objections).map((o, i) => {
      if (!o || typeof o !== "object") { note(`objections[${i}]`, "bad_objection", ""); return { they: "", you: "" }; }
      return { they: line(`objections[${i}].they`, o.they), you: paragraph(`objections[${i}].you`, o.you) };
    }),
    closeAsk: paragraph("closeAsk", raw.closeAsk),
    doNotSay: lines("doNotSay", raw.doNotSay, L.doNotSay),
    // Citations are quotes of the SOURCE, so the digit rule does not apply to
    // them — "since 1998" copied off the about page is the source's number,
    // not the model's. Whether each quote really is in the source is the
    // voice lint's job (lib/sales/scriptVoice.js), with the material in hand.
    citations: (Array.isArray(raw.citations) ? raw.citations : []).slice(0, 12).map((c, i) => {
      const field = typeof c?.field === "string" ? c.field.trim() : "";
      const quote = typeof c?.quote === "string" ? c.quote.replace(/\s+/g, " ").trim() : "";
      const sourceUrl = typeof c?.sourceUrl === "string" ? c.sourceUrl.trim() : "";
      if (!field || !quote || quote.length > MAX_QUOTE_CHARS) {
        note(`citations[${i}]`, "bad_citation", !field ? "(no field)" : !quote ? "(no quote)" : `${quote.length} characters: ${quote}`);
      }
      return { field, quote, sourceUrl };
    }),
  };

  // The company name is the one word an opener cannot drop. Gong: name and
  // company up front, so the next question is the rep's and not "who is
  // this?" — and the first live v2 script for a real prospect said "My
  // name's Muhammad and I went through your website" with no FieldQuo in it.
  if (script.opener && !/fieldquo/i.test(script.opener)) note("opener", "no_company", script.opener);
  // The pitch has a floor as well as a ceiling — see CALL_SCRIPT_LIMITS.
  if (script.whyThemNow) {
    const n = pitchWordCount(script.whyThemNow);
    if (n < L.pitchWords.min || n > L.pitchWords.max) note("whyThemNow", "pitch_length", `${n} words: ${script.whyThemNow}`);
  }

  const list = [...problems];
  return { ok: list.length === 0, script: list.length ? null : script, problems: list, trimmed, findings };
}

/**
 * The sentence appended to the prompt when a draft failed the SHAPE rules —
 * the validator's, not the voice lint's — so the second attempt is told
 * which line and which rule. Same economy as voiceRetryNote: the vendor was
 * paid for the first draft, and a second one with the fault named is
 * cheaper than a claim with no script. In the language the script is in,
 * the digit rule is restated with an example of the fix, because "no
 * digits" said once in English is the rule the first live French and
 * Spanish drafts both broke.
 */
export function validationRetryNote(checked, { language = DEFAULT_SCRIPT_LANGUAGE, limit = 6 } = {}) {
  const findings = (checked?.findings || []).slice(0, limit);
  if (!findings.length) return "";
  const why = {
    ...CALL_SCRIPT_PROBLEMS,
    digits: "a digit — write the number in words, or leave it out",
    bad_citation: `a citation must carry its field, its quote and its source, and the quote must be ${MAX_QUOTE_CHARS} characters or fewer, copied verbatim`,
    no_company: "the opener has to say FieldQuo in the sentence that says who the rep is",
    pitch_length: `the pitch has to be ${CALL_SCRIPT_LIMITS.pitchWords.min} to ${CALL_SCRIPT_LIMITS.pitchWords.max} words — four to six short sentences said in one go`,
  };
  const register = registerFor(language);
  return [
    "YOUR PREVIOUS DRAFT BROKE THE SHAPE RULES. Fix these and keep everything else:",
    ...findings.map((f) => `- ${f.field || "(reply)"}: "${f.snippet}" — ${why[f.problem] || f.problem}`),
    `No digits anywhere, in any field but citations. ${register.name}.`,
  ].join("\n");
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
