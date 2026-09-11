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
import { createHash } from "node:crypto";

/** Bumped when the prompt or the schema changes. A stored script with an
 *  older version is regenerated on the next claim, whatever its input hash. */
export const CALL_SCRIPT_VERSION = "1";

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
});

/** Known-fact ids the model is not shown. See callScriptInputs. */
export const OMITTED_FACTS = Object.freeze(new Set(["phone", "record_age"]));

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
 *
 * Every field is a string or a list of strings. The hash is taken over this
 * object, so anything that changes what the model sees changes the hash.
 */
export function callScriptInputs({ brief = null, playbook = null, stages = [], objections = [], unchecked = [] } = {}) {
  const L = CALL_SCRIPT_INPUT_LIMITS;
  const known = (brief?.known || [])
    .filter((k) => k?.label && k?.detail)
    // The phone number and the directory's refresh date are on the rep's card
    // already and are the two facts a model can only misuse in a script: one
    // is digits, and the other invites "you updated your listing in August".
    .filter((k) => !OMITTED_FACTS.has(k.id))
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

  return {
    version: CALL_SCRIPT_VERSION,
    business: clip(brief?.known?.find((k) => k?.id === "business_name")?.detail || "", 120),
    opening: clip(brief?.opening || ""),
    crawled: brief?.crawled === true,
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
    required: ["opener", "whatWeSaw", "whyThemNow", "threeQuestions", "objections", "closeAsk", "doNotSay"],
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
    },
  };
}

export const CALL_SCRIPT_SYSTEM =
  "You write cold-call scripts for a salesperson phoning a small field-service contractor. " +
  "You arrange and phrase ONLY the notes you are given. You never add a fact, a name, a figure, a price, " +
  "a year, a count or a guess about the business that is not in the notes. Where the notes say something " +
  "is not known, the script asks about it instead of asserting it. Plain spoken English, short sentences, " +
  "no greeting boilerplate, no digits anywhere.";

/**
 * The prompt. Sentences only — see the header.
 *
 * The shape is spelled out in words as well as enforced by the schema,
 * because a schema says what a field is called and not what it is for.
 */
export function callScriptPrompt(inputs) {
  const i = inputs || {};
  const list = (rows) => (rows.length ? rows.map((r) => `- ${r}`).join("\n") : "- (nothing)");
  return [
    `Business: ${i.business || "(unnamed)"}`,
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
    "Write the script for THIS call:",
    "- opener: one or two sentences the rep says first. Name the business. Reference one thing under WHAT WE KNOW.",
    `- whatWeSaw: the ${CALL_SCRIPT_LIMITS.whatWeSaw.max} or fewer things under WHAT WE KNOW most worth saying out loud, one line each, phrased as the rep would say it. Only from the notes.`,
    "- whyThemNow: two or three sentences turning the rule under WHY THIS BUSINESS IS WORTH A CALL into the reason for the call.",
    "- threeQuestions: exactly three questions, each about something under WHAT WE DO NOT KNOW or NOT LOOKED AT.",
    `- objections: for the ${CALL_SCRIPT_LIMITS.objections.min} to ${CALL_SCRIPT_LIMITS.objections.max} likeliest objections from the library, \`they\` is what they say and \`you\` is the team's answer in the rep's voice.`,
    "- closeAsk: one sentence asking for the next step the tier playbook's last stage asks for.",
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
