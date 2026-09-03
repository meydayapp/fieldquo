// lib/sales/playbook/stages.js
//
// The nine stages of a sales call, in the order they happen.
//
// ══ Why the stages are code and the CONTENT is data ═══════════════════════
//
// The spec's §22 asks for a dynamic playbook, not one rigid script. Both halves
// of that sentence are load-bearing and they pull in opposite directions, so
// the split is drawn here:
//
//   - WHICH stages exist is fixed. A call that skips "current process" and
//     goes straight to the pitch is not a variant of a playbook, it is a
//     different call, and a superadmin inventing a tenth stage on one playbook
//     would make two playbooks incomparable — which is precisely what §38's
//     experiments need them to be.
//   - WHAT is said in each stage is a row in the database, editable per
//     playbook and per experiment variant.
//
// So a playbook is not "a script"; it is nine answers to nine fixed questions.
//
// ══ `usesTalkingPoints` is on exactly two stages, on purpose ══════════════
//
// Per-prospect, evidence-cited talking points belong in RELEVANCE and FIT, and
// nowhere else. Putting them in OPEN would mean a rep leading with "I see you
// have no booking page" — an opener that announces we have been reading their
// website before they have agreed to a conversation. Putting them in DISCOVERY
// or CURRENT PROCESS would answer the questions the rep is supposed to be
// asking, and the prospect is the authority on both. The rest of the call is
// the same call whoever the prospect is.
//
// ══ `usesObjections` likewise ═════════════════════════════════════════════
//
// The objection stage renders the configured objection library filtered to
// this prospect (lib/sales/playbook/objections.js), not authored prose. A
// playbook that hard-coded "if they say Jobber, say…" would be a second copy
// of the objection store that nobody maintains — failure class 4.

/**
 * The nine stages. `key` is stored on every stage row and every talking point,
 * so renaming one is a data migration, not a label change.
 */
export const STAGES = Object.freeze([
  {
    key: "open",
    name: "Open",
    purpose:
      "Say who is calling, where from, and why now — inside the first ten seconds, because that is how long a contractor on a ladder gives you.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
  {
    key: "relevance",
    name: "Establish relevance",
    purpose:
      "One sentence that could only have been said to this business. Not a compliment — a reason this call is not a cold list.",
    usesTalkingPoints: true,
    usesObjections: false,
  },
  {
    key: "discovery",
    name: "Discovery",
    purpose:
      "Questions, not statements. What the business actually is: trades, crew size, how far they travel, how busy.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
  {
    key: "current_process",
    name: "Current process",
    purpose:
      "How a job goes from a phone call to money in the bank today. Whatever we detected, they are the authority on this and we are guessing.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
  {
    key: "pain",
    name: "Pain",
    purpose:
      "Which part of that process costs them, in their own words. Never our words — a pain the rep names is a pain the prospect disputes.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
  {
    key: "fit",
    name: "FieldQuo fit",
    purpose:
      "What we do about the thing they just described. This is the only stage that carries per-prospect talking points, and every one of them cites something observed.",
    usesTalkingPoints: true,
    usesObjections: false,
  },
  {
    key: "objections",
    name: "Objection handling",
    purpose:
      "What to say when they push back. Rendered from the objection store, filtered to this prospect, never authored inline.",
    usesTalkingPoints: false,
    usesObjections: true,
  },
  {
    key: "next_step",
    name: "Next step",
    purpose:
      "One specific thing with a date on it. 'I'll send you some information' is not a next step.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
  {
    key: "close",
    name: "Close",
    purpose:
      "Confirm what was agreed, in their words, and get off the phone. A call that runs long after the agreement is a call that reopens it.",
    usesTalkingPoints: false,
    usesObjections: false,
  },
]);

export const STAGE_KEYS = Object.freeze(STAGES.map((s) => s.key));

const BY_KEY = new Map(STAGES.map((s) => [s.key, s]));

/** The stage, or null. Never a fabricated one — an unknown key is a bug upstream. */
export function stage(key) {
  return BY_KEY.get(key) || null;
}

/** Position in the call, or -1. Used to sort stage rows into call order. */
export function stageOrder(key) {
  return STAGE_KEYS.indexOf(key);
}

/** The only stages that carry per-prospect talking points. See the header. */
export const TALKING_POINT_STAGES = Object.freeze(
  STAGES.filter((s) => s.usesTalkingPoints).map((s) => s.key),
);

/**
 * Where a deterministically-generated point goes when there is no model.
 *
 * FIT rather than RELEVANCE: without a model the only sentence available is
 * `ProspectOpportunity.reason`, which is a statement about what we sell. That
 * is the fit stage's job. Dropping it into relevance would open the call with
 * a pitch.
 */
export const DEFAULT_POINT_STAGE = "fit";

/** The one stage that renders the objection store. */
export const OBJECTION_STAGE = "objections";

/**
 * Sort into call order and report what is missing.
 *
 * Deliberately does NOT pad. AGENTS.md failure class 5: absence of a statement
 * is not a statement, and a playbook with no `pain` stage must render as a
 * playbook with a gap the superadmin can see, not as a playbook with an
 * invented line in it. The screen shows the missing stages and the script
 * renders the stage with "nothing written for this stage yet".
 *
 * @param {Array<{stageKey:string}>} rows
 * @returns {{ ordered: Array, missing: string[], unknown: string[], duplicates: string[] }}
 */
export function orderStages(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const duplicates = [];
  const unknown = [];
  const kept = [];

  for (const row of list) {
    const key = typeof row?.stageKey === "string" ? row.stageKey : null;
    if (!key || !BY_KEY.has(key)) {
      unknown.push(key ?? String(row?.stageKey));
      continue;
    }
    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);
    kept.push(row);
  }

  kept.sort((a, b) => stageOrder(a.stageKey) - stageOrder(b.stageKey));

  return {
    ordered: kept,
    missing: STAGE_KEYS.filter((k) => !seen.has(k)),
    unknown,
    duplicates,
  };
}
