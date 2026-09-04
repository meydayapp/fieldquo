// lib/platform/numericField.js
//
// A cleared number box is not a zero.
//
// ══ The bug this exists to kill ═══════════════════════════════════════════
//
// Four editors on /platform/sales did `Number(e.target.value)` or
// `Number(draft.priority)` on the way to the server. `Number("")` is 0, 0 is
// finite, and every one of those routes accepts 0 as a legal value — so
// selecting a priority and pressing Delete did not clear the field, it SET it.
//
//   /platform/sales/capabilities  salesPriority — 0 is "read out last"
//   /platform/sales/confidence    weight        — 0 is "this signal counts
//                                                 for nothing"
//   /platform/sales/rules         priority      — 0 loses every duplicate-
//                                                 capability tie-break (see
//                                                 SEMANTIC_FIELDS in
//                                                 lib/sales/intel/versioning.js:
//                                                 priority decides which of two
//                                                 rules survives)
//   /platform/sales/playbooks     priority      — same, on playbooks and
//                                                 objections
//
// On capabilities it was visible and still wrong: the substituted 0 went into
// the draft, the controlled input re-rendered with "0" in it, and the operator
// watched a number they had just deleted come back. On the other three it was
// invisible until the save landed.
//
// Zero is a real, meaningful setting on all four. That is exactly why it must
// not be what "I have not typed anything yet" turns into.
//
// ══ Why null and not a thrown error ══════════════════════════════════════
//
// Blank is a legitimate transient state — it is what a box looks like halfway
// through being retyped. So the parser reports "there is no number here" and
// the SAVE refuses, with a sentence naming the field. Refusing at the keystroke
// would make the field impossible to clear and retype.

/**
 * The number in a form field, or null when the field does not hold one.
 *
 * Blank, whitespace, a partially-typed "-" or "1e", NaN and Infinity all give
 * null. A real 0 gives 0.
 *
 * Deliberately narrower than Number(): Number(null), Number([]), Number(false)
 * and Number("  ") are all 0, and every one of them is a way a missing value
 * reaches a numeric column looking like a decision.
 *
 * @param {unknown} value  typically an input's .value, so usually a string
 * @returns {number|null}
 */
export function numberOrNull(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * The message shown when a save is refused for a blank number.
 *
 * One sentence, in one place, because the four screens must not drift into
 * four different explanations of the same refusal — and because the whole
 * point is to say the thing the old code silently assumed: blank and zero are
 * different.
 *
 * @param {string} label  the field's own on-screen label, e.g. "Sales priority"
 */
export function blankNumberMessage(label) {
  return `${label} is empty. Type a number — an empty box is not the same as 0, and 0 is a real setting here.`;
}
