// lib/sales/playbook/seedHistory.js
//
// The fingerprints of every set of built-in words this repository has shipped.
//
// ══ The problem this solves ═══════════════════════════════════════════════
//
// The starter playbooks and objection answers live in the DATABASE. They are
// put there once, by "install the starter library", and installDefaults()
// creates and never updates — deliberately, because a superadmin who has
// rewritten COMPETITIVE_DISPLACEMENT must not have their words replaced by a
// button labelled "install defaults".
//
// The cost of that rule showed up the day the scripts were rebuilt from the
// selling literature. The seeds in source were correct; the rows in production
// were the old ones, word for word, and a deploy changed nothing. The owner
// opened a prospect and read back to me the exact sentence the rebuild had
// deleted — "if that is not a problem you have, I will leave you alone" — and
// there was no path, anywhere in the product, to fix it short of editing eight
// rows by hand.
//
// ══ How a refresh can be safe ═════════════════════════════════════════════
//
// The only question that matters is: has a human touched this row? A row that
// still says exactly what some shipped version of the seed said has not been
// edited, and replacing it loses nobody's work. A row that says anything else
// is somebody's writing and is never touched.
//
// So every version of every built-in gets fingerprinted here as it is retired.
// refreshBuiltIns() hashes each row, looks it up, and updates only on a match.
// It cannot clobber an edit, and it says which rows it skipped and why.
//
// ══ Why hashes and not the old text ═══════════════════════════════════════
//
// Equality is the whole test, and the retired scripts are four playbooks of
// nine stages plus eight objection answers per version. Keeping them in full
// would put tens of kilobytes of deleted prose in the bundle to answer a
// yes-or-no question. The words themselves are in git, which is where deleted
// words belong.
//
// Truncated to 16 hex characters — 64 bits. This is a "have these exact words
// changed" check against a handful of known strings, not a security boundary:
// nothing is authorised by a match, the worst case of a collision is one row
// refreshed that a superadmin had edited into a string that collides, and the
// audit log records every refresh.
//
// ══ Adding to it ══════════════════════════════════════════════════════════
//
// When the built-in words change, append the OUTGOING fingerprint here. The
// check script computes the CURRENT seeds' fingerprints and fails if they are
// already listed — which is what catches a rewrite that forgot to record what
// it retired, because that rewrite would silently lose the ability to refresh
// the rows it just made stale.
import { createHash } from "node:crypto";

/**
 * The fingerprint of one objection answer.
 *
 * Label and response, because a superadmin editing either has edited the row.
 * `cues` and `priority` are deliberately NOT included: they are how a rep
 * finds the row mid-call, they get tuned independently of the words, and a
 * refresh that skipped a row because somebody added a cue would fail exactly
 * the people who use the library most.
 */
export function objectionFingerprint({ label = "", response = "" } = {}) {
  return createHash("sha256").update(`${label}\n${response}`).digest("hex").slice(0, 16);
}

/**
 * The fingerprint of one playbook: its name, and every stage in order.
 *
 * Stage order is part of it. Two playbooks with the same sentences in a
 * different order are different scripts.
 */
export function playbookFingerprint({ name = "", key = "", stages = [] } = {}) {
  const body = stages
    .map((s) => `${s.stageKey}|${s.say}|${(s.prompts || []).join("~")}`)
    .join("\n");
  return createHash("sha256").update(`${name || key}\n${body}`).digest("hex").slice(0, 16);
}


/**
 * Every fingerprint each built-in has ever had, oldest first.
 *
 * A row matching ANY of these is unedited — it may be several versions behind
 * if the install predates two rewrites, and it is still nobody's writing.
 */
export const RETIRED_OBJECTIONS = Object.freeze({
  ALREADY_USE_COMPETITOR: Object.freeze(["ddbee1f9d28065db", "e77bc7311b3a3d00"]),
  TOO_EXPENSIVE: Object.freeze(["b6dc335f7c592d00", "3a18502974d36d99"]),
  NO_TIME_TO_SWITCH: Object.freeze(["de80faed75fb917a"]),
  DONT_NEED_A_WEBSITE: Object.freeze(["c219d55859cd7814"]),
  BOOKING_NOT_FOR_US: Object.freeze(["9b52bc0de7590658"]),
  EMAIL_WORKS_FINE: Object.freeze(["0d14f350526b1488"]),
  SEND_ME_INFO: Object.freeze(["ea84fba440da6583"]),
  NOT_INTERESTED: Object.freeze(["30e191b29103c5d5"]),
});

/**
 * Codes whose FIRST shipped version is the one in source right now.
 *
 * ══ Why "no history" has to be DECLARED rather than inferred ══════════════
 *
 * A code with an empty retired list is one of two completely different things:
 * a built-in that has never shipped before and therefore has nothing to
 * refresh, or a rewrite whose author forgot to record what they retired —
 * which silently loses the ability to fix the stale rows they just created,
 * and which is the exact failure the tables above exist to catch. An empty
 * list cannot tell those apart, so the check would have to accept both and
 * catch neither.
 *
 * So a new built-in says so by name. AGENTS.md failure class 5, applied to a
 * check rather than to a screen: the absence of a statement is not a statement.
 *
 * Entries LEAVE this list the moment their words change — at that point the
 * outgoing fingerprint goes into the table above and the code has a history
 * like any other. The check asserts no code is in both, and that every name
 * here is still a real seed, so a stale entry cannot hide the next forgotten
 * history.
 */
export const NEVER_SHIPPED_BEFORE = Object.freeze([
  "NOT_THE_DECISION_MAKER",
  "CALL_ME_BACK_LATER",
  "HOW_DID_YOU_GET_MY_NUMBER",
  "TOO_SMALL_FOR_THIS",
  "PLENTY_OF_WORK",
  "TRIED_SOFTWARE_BEFORE",
  "PAPER_WORKS_FINE",
  "NEED_TO_THINK",
  "JUST_TELL_ME_THE_PRICE",
  "CONTRACT_LOCK_IN",
  "WHO_OWNS_MY_DATA",
  "BOOKKEEPER_USES_SOMETHING_ELSE",
]);

/**
 * The same, for the four starter playbooks.
 *
 * The third entry on each is the script as it stood before the owner's
 * permission-based opener landed on 2026-09-10 — the version whose opener
 * carried the reason for the call in its second sentence and ended "Is this a
 * good time?". Every one of those four rows in a live database still says
 * exactly that, so every one of them has to be recognisable as unedited or the
 * refresh cannot reach them, which is the failure this whole file was written
 * the day after.
 */
export const RETIRED_PLAYBOOKS = Object.freeze({
  COMPETITIVE_DISPLACEMENT: Object.freeze([
    "21c9e0ccc26cca43",
    "42fadbb938d51add",
    "cafa9083f46a9e36",
  ]),
  ONLINE_PRESENCE: Object.freeze(["109abfd42db840dc", "90bbf111d380209d"]),
  BOOKING_GAP: Object.freeze(["8f1c5419e0e9857e", "193d71e31495aa71"]),
  QUOTE_AUTOMATION: Object.freeze(["f25c200502cd71e9", "1d6e4de2059716d4"]),
});

/** Is this row still exactly some version we shipped? */
export function isUnedited(kind, code, fingerprint) {
  const table = kind === "playbook" ? RETIRED_PLAYBOOKS : RETIRED_OBJECTIONS;
  const known = table[code];
  return Array.isArray(known) && known.includes(fingerprint);
}
