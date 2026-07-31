// lib/gallery/stages.js
//
// The four stages a job photo can belong to, and how to guess one from a crew
// message.
//
// ══ Why a stage at all ═════════════════════════════════════════════════════
//
// A wall of undated photos is a shoebox. Grouped by stage, the same photos
// become a story: what it looked like when the crew arrived, the work under
// way, and the finished result — and "start" beside "finish" of one job is the
// before/after that actually wins a painter their next job. "Issue" is kept
// apart on purpose: a photo of water damage found behind a cabinet is a record
// for the office, never a thing to accidentally publish to the website.
//
// ══ Guessing is a hint, never a silent decision ════════════════════════════
//
// inferStage reads what the crew actually texted. When the words are clear
// ("all done", "before we start") it returns that stage; when they're not, it
// returns "progress" — the safe middle — rather than pretending to know. The
// owner can always re-stage a photo by hand; the guess just saves them doing it
// for every one.
//
// Pure. No database, no network.

/** The stages, in the order a job moves through them. */
export const STAGES = {
  start: { key: "start", label: "Before / start", order: 0 },
  progress: { key: "progress", label: "In progress", order: 1 },
  finish: { key: "finish", label: "Finished", order: 2 },
  // Not part of the before→after arc; it's a flag for the office.
  issue: { key: "issue", label: "Issue / snag", order: 3 },
};

export const STAGE_KEYS = Object.keys(STAGES);

export function isStage(key) {
  return Object.prototype.hasOwnProperty.call(STAGES, key);
}

export function stageLabel(key) {
  return STAGES[key]?.label || STAGES.progress.label;
}

// Word lists, most-specific intent first. An "issue" wins over everything —
// "finished but there's a problem with the trim" is an issue to flag, not a
// finish shot to publish.
const SIGNALS = [
  { stage: "issue", words: ["issue", "problem", "damage", "damaged", "leak", "leaking", "broken", "crack", "cracked", "mould", "mold", "rot", "rotten", "concern", "snag", "wrong", "not right", "on hold", "hold up"] },
  { stage: "finish", words: ["done", "finished", "complete", "completed", "all set", "wrapped", "wrapped up", "final", "finished up", "after", "all done", "signed off"] },
  { stage: "start", words: ["before", "starting", "start", "arrived", "just got", "day one", "day 1", "prep", "setup", "set up", "kicking off", "getting started", "demo", "tear out", "tear-out"] },
];

/** Normalise for matching: lowercase, spaces around, punctuation to spaces. */
function norm(text) {
  return ` ${String(text || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Guess the stage from a crew message.
 *
 * @param text   the message body (may be empty — a bare photo)
 * @returns one of STAGE_KEYS; "progress" when nothing points elsewhere.
 */
export function inferStage(text) {
  const t = norm(text);
  if (t.trim() === "") return "progress"; // a bare photo mid-job

  for (const { stage, words } of SIGNALS) {
    for (const w of words) {
      // Word-ish boundary: surround the needle with spaces so "start" doesn't
      // fire on "restart" and "after" doesn't fire on "aftermath".
      if (t.includes(` ${w} `)) return stage;
    }
  }
  return "progress";
}

/** Coerce a stored/submitted stage to a real one, defaulting safely. */
export function normaliseStage(key) {
  return isStage(key) ? key : "progress";
}
