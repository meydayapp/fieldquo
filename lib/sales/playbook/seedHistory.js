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
  // Rep notes and the objection scope (defaults.js) are part of what a
  // playbook says, so they are in the hash — appended only when a stage HAS
  // them, which keeps every fingerprint recorded below for the four starter
  // playbooks (none of which carry either) exactly what it was.
  const extra = (s) =>
    [
      Array.isArray(s.tips) && s.tips.length ? `|tips:${s.tips.join("~")}` : "",
      Array.isArray(s.ownObjectionCodes) && s.ownObjectionCodes.length ? `|own:${s.ownObjectionCodes.join(",")}` : "",
      Array.isArray(s.hideObjectionCodes) && s.hideObjectionCodes.length ? `|hide:${s.hideObjectionCodes.join(",")}` : "",
    ].join("");
  const body = stages
    .map((s) => `${s.stageKey}|${s.say}|${(s.prompts || []).join("~")}${extra(s)}`)
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
  // The second-to-last entry on each of the original thirteen is the answer
  // as it stood before 2026-09-11, when every "I will build / set it up" next
  // step became the fifteen-minute demo — the owner's rule that reps are not
  // tech support. The LAST entry on every one of the twenty below is the
  // answer as it stood before 2026-09-18, when the whole library was rewritten
  // out of the "I am not going to" register into the spoken one the AI script
  // is held to (lib/sales/scriptVoice.js: contractions, a sentence under
  // thirty words, no "rather than"). The four brush-off answers added on
  // 2026-09-17 were written in that register already and are unchanged.
  ALREADY_USE_COMPETITOR: Object.freeze(["ddbee1f9d28065db", "e77bc7311b3a3d00", "a50e09db2d094deb", "896baff063e70ab2"]),
  TOO_EXPENSIVE: Object.freeze(["b6dc335f7c592d00", "3a18502974d36d99", "6b839e63aaebbcb0"]),
  NO_TIME_TO_SWITCH: Object.freeze(["de80faed75fb917a", "a7b897f64907da12", "de95391a0b5cbf51"]),
  DONT_NEED_A_WEBSITE: Object.freeze(["c219d55859cd7814", "ef03a0665ff81bbb", "cfedfe03992dc657"]),
  BOOKING_NOT_FOR_US: Object.freeze(["9b52bc0de7590658", "7b989e63002c4d80", "5fadf9fa04ff2d63"]),
  EMAIL_WORKS_FINE: Object.freeze(["0d14f350526b1488", "dc9c0ba8444a0c24", "d6b104dcf8300dc1"]),
  SEND_ME_INFO: Object.freeze(["ea84fba440da6583", "90ed104462869717", "e2d5fe8429e447dd"]),
  NOT_INTERESTED: Object.freeze(["30e191b29103c5d5", "76291b850bc7e53e"]),
  NOT_THE_DECISION_MAKER: Object.freeze(["97279c931644e327", "94566247b3cdcb3e"]),
  CALL_ME_BACK_LATER: Object.freeze(["478ee06896304347", "9ffc907c28ff8ace"]),
  TOO_SMALL_FOR_THIS: Object.freeze(["04c5d38e3d8b054b", "4f1de7f26a03274a"]),
  PAPER_WORKS_FINE: Object.freeze(["49f5e7ae66677603", "1e45cf96bc0adf00"]),
  HOW_DID_YOU_GET_MY_NUMBER: Object.freeze(["8660e813f7978e3c"]),
  PLENTY_OF_WORK: Object.freeze(["7824f23258a537d3"]),
  TRIED_SOFTWARE_BEFORE: Object.freeze(["280a53c18334577e"]),
  JUST_TELL_ME_THE_PRICE: Object.freeze(["9e8b76a33ef8da5e"]),
  CONTRACT_LOCK_IN: Object.freeze(["f17adc3e05e2e451"]),
  // The second entry on each of these two is the answer as it stood before
  // 2026-09-24, when both stopped offering an export — "want it all back" and
  // "an export of the invoices and the job costs" — because companies can
  // import but not export (lib/export/companyDataExport.js).
  WHO_OWNS_MY_DATA: Object.freeze(["dc7081308edc0d6e", "65a24d0fe49eb4f4"]),
  BOOKKEEPER_USES_SOMETHING_ELSE: Object.freeze(["d1902169820e4604", "6c15b0a25f738b23"]),
  NEED_TO_THINK: Object.freeze(["73f9eeafea63a50e", "c95e30510d06e917"]),
  // ── The Reverse Selling playbook's own answers (reverseSelling.js) ──────
  //
  // Version 1 (2026-09-30): the owner's closer script, long answers that
  // closed on the free trial during the call. Retired 2026-10-01, when the
  // owner made the first call's job booking the demo and every answer became
  // two to four sentences that redirect to it. The long words are not gone —
  // they are the Backup panel beside the scripts (REVERSE_SELLING_BACKUP) —
  // but a row that still says them is an unedited v1 install, and "refresh the
  // built-ins" has to be able to recognise it. The playbook was installed
  // switched off, so refreshing its rows changes no rep's screen.
  RS_IM_BUSY: Object.freeze(["f5a6e8572599de0b", "d9db6d806a674e40"]),
  RS_PARTNER: Object.freeze(["b4d6c6867993764d", "ca2c5d46859811af"]),
  RS_NO_TIME_TO_LEARN: Object.freeze(["525ee2289f5d80c5", "56506b039800e379"]),
  RS_PAPER_WORKS: Object.freeze(["04bfa2b6218deab0", "213a0bd860f5e82d"]),
  RS_TOO_EXPENSIVE: Object.freeze(["5c4ff2d002ac5278", "c1ccd09d359c96af"]),
  RS_TRIED_SOFTWARE: Object.freeze(["58824a49a0c50ce2", "8ef81e33c9937a34"]),
  RS_SEND_INFO: Object.freeze(["29cbc5a608724988", "64e1a02d7a2ccc99"]),
  RS_THINK_ABOUT_IT: Object.freeze(["4e10fe3a6ebb19e4", "f5c149899e7940ba"]),
  RS_ALREADY_USE_APP: Object.freeze(["19842ced709a812e", "ce35ef79ea56a862"]),
  RS_DO_YOU_HAVE: Object.freeze(["258705f2e79075db", "8a4908b93640cf45"]),
  RS_NOT_INTERESTED: Object.freeze(["8dace9586526b4c3"]),
  RS_BEST_WORST_CASE: Object.freeze(["f2fe97c64c611130", "b5a94a7dfc5aba90"]),
  RS_BELIEF_BIG_COMPANIES: Object.freeze(["f4bbf01a97d0e068", "834e4ddf2f841e3b"]),
  RS_BELIEF_NOT_COMPUTER_GUY: Object.freeze(["44155139cc205da0", "b64dd023e4c35620"]),
  RS_BELIEF_PAPERWORK_IS_THE_JOB: Object.freeze(["38a7a05360928a70", "b3bf96d12366f5ce"]),
  RS_BELIEF_QUOTE_LOOKS: Object.freeze(["de756859659d820d", "a086424fc4148f66"]),
  RS_BELIEF_PAY_WHEN_THEY_PAY: Object.freeze(["408cfd3bceb0213c", "2852ea8a0e9a95ea"]),
  RS_BELIEF_HIRE_OFFICE_LATER: Object.freeze(["14ecdd6acdd2c429", "e9cab3319cacd04e"]),
  // Version 2 (2026-10-01) → 3 (2026-10-02): the demo the answers offer became
  // thirty minutes (REP_DEMO_MINUTES, one number with the call panel). The
  // LAST entry on each RS_ code above, and the single entry on each below
  // (answers first shipped in version 2), is the v2 wording, so "refresh the
  // built-ins" can bring an unedited v2 install up to version 3. The four
  // answers that never offer the demo (RS_NOT_INTERESTED, RS_WRONG_PERSON,
  // RS_HOW_DID_YOU_GET_MY_NUMBER, RS_IS_THIS_A_SALES_CALL) did not change.
  RS_NEVER_HEARD_OF_YOU: Object.freeze(["1b8e1cae56fbf40f"]),
  RS_JUST_TELL_ME_THE_PRICE: Object.freeze(["67573ed425512b7e"]),
  RS_CONTRACT_LOCK_IN: Object.freeze(["9c1c8cfe7e0d64c3"]),
  RS_WHO_OWNS_MY_DATA: Object.freeze(["fe87e622b5d76b42"]),
  RS_BOOKKEEPER_USES_SOMETHING_ELSE: Object.freeze(["609e9f5a6a38f930"]),
  RS_DONT_NEED_A_WEBSITE: Object.freeze(["1405b7f76f57caea"]),
  RS_BOOKING_NOT_FOR_US: Object.freeze(["c60ff50690228cb2"]),
  RS_EMAIL_WORKS_FINE: Object.freeze(["15f0b927e0c0b918"]),
  RS_PLENTY_OF_WORK: Object.freeze(["cd8c5e25f8e2703e"]),
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
  // The four the call data said were missing (2026-09-17): the brush-offs
  // that end most cold calls before the pitch — Gong's top five are 74% of
  // all objections and two of them had no answer here.
  "IM_BUSY_RIGHT_NOW",
  "IS_THIS_A_SALES_CALL",
  "WRONG_PERSON",
  "NEVER_HEARD_OF_YOU",
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
  // The second-to-last entry on each is the script as it stood before
  // 2026-09-11: the one whose next step promised to build something on the
  // contractor's site and whose close said "Thursday at eight then". Both
  // retired by the owner's rules — reps are not tech support, and no rule
  // line names a day.
  //
  // The LAST entry on each is the script as it stood before 2026-09-14, when
  // the turnaround question went into every discovery stage, its
  // implication into every pain stage and the owner's contrast into every
  // fit stage (lib/sales/playbook/turnaround.js). Every live row installed
  // between the two dates says exactly that, so it has to be recognisable
  // as unedited or "refresh the built-ins" cannot reach it.
  //
  // The entry after THAT on each is the script as it stood before 2026-09-17,
  // when the close gained Gong's calendar question and the invite sent while
  // the contractor is still on the line (CLOSE_ASK). The recording aside had
  // already gone into the opener on the same day; both changes are inside
  // this one retired fingerprint.
  //
  // The LAST entry on each is the script as it stood before 2026-09-19, when
  // every fit stage gained the trade's own three selling points as a prompt
  // (`{tradePitch}`, lib/sales/tradeSellingPoints.js) — the owner's "each
  // trade should have the selling points for that".
  COMPETITIVE_DISPLACEMENT: Object.freeze([
    "21c9e0ccc26cca43",
    "42fadbb938d51add",
    "cafa9083f46a9e36",
    "89dc175b4b5e6389",
    "74bfe1079e72c3d4",
    "33123b1971688ec0",
    "e56c4c59a6b9820e",
  ]),
  ONLINE_PRESENCE: Object.freeze(["109abfd42db840dc", "90bbf111d380209d", "490bd45baa6e8329", "fbd7f021722f3807", "90bd974ab7cd7900", "42e44db58431231f"]),
  BOOKING_GAP: Object.freeze(["8f1c5419e0e9857e", "193d71e31495aa71", "356f3400e9f25bd0", "c1c32a694193a45c", "82d6a2e17074b467", "9a8c744a4de28878"]),
  QUOTE_AUTOMATION: Object.freeze(["f25c200502cd71e9", "1d6e4de2059716d4", "2246010ff83da57b", "c190952a24539d12", "09f61bc7365c40e5", "2e5f9b42f26f421f"]),
  // Version 1 of the Reverse Selling playbook (2026-09-30), the one that
  // closed on the trial during the cold call. Retired 2026-10-01 for the
  // book-the-demo version; see RETIRED_OBJECTIONS above for why it is listed.
  // Version 2 (2026-10-01), retired 2026-10-02: the fifteen-minute demo, and
  // the anything_observed rule that left a prospect with nothing recorded on
  // no playbook. Version 3 offers thirty minutes and opens on every prospect.
  REVERSE_SELLING: Object.freeze(["52fdf67b9aaed479", "9243007f25309fb7"]),
});

/** Is this row still exactly some version we shipped? */
export function isUnedited(kind, code, fingerprint) {
  const table = kind === "playbook" ? RETIRED_PLAYBOOKS : RETIRED_OBJECTIONS;
  const known = table[code];
  return Array.isArray(known) && known.includes(fingerprint);
}
