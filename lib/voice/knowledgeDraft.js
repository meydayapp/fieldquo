// lib/voice/knowledgeDraft.js
//
// "Draft this from my company profile" — the model's half.
//
// ── What the model is and isn't asked to do ────────────────────────────────
//
// It CHOOSES which of a closed list of questions matter for this business, in
// what order, and it REWORDS them in the trade's own language. That is all.
//
// It does not decide what the gaps are, does not add one, does not write a
// sentence about the business, and never sees a chance to assert a fact. The
// gap catalogue is computed in lib/voice/knowledge.js from the company's own
// rows; anything the model returns that is not in that list is dropped, and
// any wording it returns that carries a figure, a date, a duration, a
// guarantee, a service name or an opening-hours phrase falls back to the
// catalogue's own wording.
//
// This is the same boundary lib/site/generateSite.js draws, and for the same
// reason. There the failure mode is a page claiming twenty years of
// experience; here it is worse, because the output is read aloud by something
// that sounds like the owner, to a stranger, who may hold them to it. Constrain
// the model to choosing and rephrasing, and the worst case is a blandly worded
// question — recoverable by typing over it.
//
// ── Never load-bearing ─────────────────────────────────────────────────────
//
// Every path returns a usable draft. No key, over quota, rate-limited, or
// nonsense back all produce the catalogue in its localised wording — plainer,
// same questions, same structure. `generated: false` says so out loud rather
// than passing the fallback off as AI output.

import { complete, isAiConfigured } from "@/lib/ai/provider";
import { forbiddenIn, restatesStructured, gapsFor, draftNote } from "./knowledge";

const SYSTEM = `You are helping a small trade or home-services business set up
the notes for the assistant that answers their phone.

You are NOT writing facts about the business. You do not know any. You are given
a fixed list of QUESTIONS to put to the owner, and your only job is:

  1. Decide which of them are worth asking THIS business, and in what order.
     Put first the one whose answer would change the most phone calls.
  2. Reword each one so it sounds like a question a person in this trade would
     be asked, in the language you are told to write in.

Return STRICT JSON, no markdown fence:

{ "use": ["<id>", "<id>", ...], "wording": { "<id>": "<the reworded question>" } }

Hard rules — breaking any of these means your wording is thrown away:

- Use ONLY ids from the list you are given. An id you invent is discarded.
- Every string must be a QUESTION addressed to the owner. Never a statement
  about the business, never an answer, never an example answer.
- NEVER put a number, a digit, a date, a day of the week, a length of time, a
  price, a warranty or a guarantee in your wording. Not even as an example.
- NEVER name one of the company's services, and never mention when they are
  open or where they work. The assistant is already told all three as facts,
  and repeating them here would go stale the day the owner changes one.
- Keep each question to one sentence. Plain trade words. No marketing language.
- Do not ask anything whose honest answer is a figure — "what is your minimum
  job", "what do you charge for a callout". Those are exactly what the
  assistant is forbidden to say out loud.

Drop a question rather than pad the list. Fewer, sharper questions get answered.`;

const LANGUAGE_NAMES = {
  en: "English", fr: "French", es: "Spanish",
  uk: "Ukrainian", pa: "Punjabi", tl: "Tagalog",
};

/**
 * Draft the receptionist's knowledge gaps for one company.
 *
 * @param company    { phone, city, province }
 * @param services   enabled trade labels in the company's language
 * @param areas      work-area names
 * @param hasHours   whether businessHours holds a real statement
 * @param canBook    whether any bookable availability exists
 * @param notes      what the owner has already written
 * @param trades     tradeGaps() output, seeded from serviceContent
 * @param language   the company's default language — the note is written for
 *                   the agent that speaks it, so it is drafted in it
 * @param text       (key) => localised catalogue wording
 * @param onUsage    metering hook; this module never touches the database
 *
 * @returns {{ questions, structured, note, generated }}
 */
export async function draftKnowledge({
  company = {},
  services = [],
  areas = [],
  hasHours = false,
  canBook = false,
  notes = "",
  trades = [],
  language = "en",
  text = null,
  // Set by the caller when it already knows the model is off the table — no
  // key, or the company is over its monthly allowance. Distinct from
  // isAiConfigured() below, which only knows about the key.
  skipModel = false,
  onUsage,
} = {}) {
  const base = gapsFor({ company, services, areas, hasHours, canBook, notes, trades, text });

  const fallback = {
    ...base,
    note: draftNote(base.questions),
    generated: false,
  };

  // Nothing to ask. A company that has answered everything gets told so rather
  // than handed an empty box — the screen renders the difference.
  if (!base.questions.length) return fallback;
  if (skipModel || !isAiConfigured()) return fallback;

  const languageName = LANGUAGE_NAMES[language] || "English";

  const raw = await complete({
    system:
      language === "en"
        ? SYSTEM
        : `${SYSTEM}

WRITE EVERY QUESTION IN ${languageName.toUpperCase()}, in the words a
${languageName}-speaking contractor would use. The ids are identifiers, not
prose — return them exactly as given.`,
    prompt: JSON.stringify({
      // Enough for the model to judge relevance, and deliberately no more. It is
      // told the trades so it can tell a roofer's questions from a dog walker's;
      // it is told, in the system prompt, never to repeat them back.
      trades: services,
      whereTheyWork: areas.length ? "stated" : "not stated",
      openingHours: hasHours ? "stated" : "not stated",
      canBookAppointments: canBook,
      ownerHasAlreadyWritten: String(notes || "").trim() ? "yes" : "no",
      questions: base.questions.map((q) => ({ id: q.id, question: q.question })),
    }),
    maxTokens: 1200,
    onUsage,
  });

  if (!raw) return fallback;

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
  } catch {
    // A model that cannot return JSON is a model problem, not the company's.
    console.error("[voice/knowledgeDraft] model returned unparseable JSON");
    return fallback;
  }

  const merged = mergeDraft(base, parsed, { services, areas });

  // A model that kept one question has misunderstood the task, and a one-line
  // draft is worse than the catalogue. Same floor generateSite puts on sections.
  if (merged.length < Math.min(3, base.questions.length)) return fallback;

  return {
    questions: merged,
    structured: base.structured,
    note: draftNote(merged),
    generated: true,
  };
}

/**
 * Folds the model's choices into the computed gaps.
 *
 * Merging rather than replacing is the guarantee: the ids come from our list,
 * the `forService` label comes from the database, and only the question TEXT is
 * ever taken from the model — and only after it survives the same two filters
 * every other string in this feature goes through.
 *
 * Exported so scripts/check-voice-knowledge.mjs can run hostile model output
 * through it without calling a model. This is the one function in the feature
 * where the safety property lives, and asserting it by reading is not the same
 * as asserting it by executing.
 */
export function mergeDraft(base, parsed, { services, areas }) {
  const byId = new Map(base.questions.map((q) => [q.id, q]));
  const order = Array.isArray(parsed?.use) ? parsed.use : [];
  const wording = parsed?.wording && typeof parsed.wording === "object" ? parsed.wording : {};

  const out = [];
  const seen = new Set();
  for (const id of order) {
    if (typeof id !== "string" || seen.has(id)) continue;
    const gap = byId.get(id);
    // An invented id has nowhere to land. This is the whole closed-vocabulary
    // property — the model can reorder and reword our questions, never add one.
    if (!gap) continue;
    seen.add(id);

    const candidate = typeof wording[id] === "string" ? wording[id].trim().slice(0, 240) : "";
    const usable =
      candidate &&
      !forbiddenIn(candidate) &&
      !restatesStructured(candidate, { services, areas });

    out.push({ ...gap, question: usable ? candidate : gap.question, reworded: Boolean(usable) });
  }
  return out;
}
