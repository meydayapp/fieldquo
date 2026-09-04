// lib/status/tone.js
//
// The tone → chip-class map. One copy, for every enum that renders as a badge.
//
// ── Why it moved out of lib/invoices/statusPresentation.js ─────────────────
//
// That file wrote up, at length, why the invoice list and the invoice detail
// page must not each carry their own STATUS_STYLES: two copies rotted the same
// way, and the badge that mattered most — a live chargeback — came out with no
// colour at all. It then held the class strings itself, which was correct while
// invoices were the only enum on a money screen.
//
// They are not. Subscription status (what the company owes FieldQuo) and payout
// status (what the company owes its crew) both render badges too, and both were
// printing the raw enum in plain grey. Writing the same five class strings into
// each of them would be the third copy — the exact move statusPresentation.js
// exists to argue against.
//
// So the classes live here and the three domain modules carry only the mapping
// from THEIR enum to a tone. lib/invoices/statusPresentation.js re-exports this
// under its old name, so nothing that imports INVOICE_TONE_CLASSES changes.
//
// ── The tones ──────────────────────────────────────────────────────────────
//
//   neutral   nothing to do, nothing wrong. Draft, not started.
//   info      in flight. Somebody else has it; waiting is the correct action.
//   positive  done, and done well. Paid, active.
//   urgent    money the reader should act on TODAY. Kept scarce on purpose —
//             colouring a routine state red teaches people to ignore red on the
//             screen where red has to keep working.
//   reversed  a settled reversal. The money went back out; nothing to chase.

export const STATUS_TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  positive:
    "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  urgent: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  reversed:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
};

/**
 * Classes for a tone. Never returns undefined and never returns a
 * half-built string — an unknown tone falls back to the neutral chip rather
 * than dropping the literal word "undefined" into a className, which is how
 * the original invoice bug rendered.
 */
export function toneClasses(tone) {
  return STATUS_TONE_CLASSES[tone] || STATUS_TONE_CLASSES.neutral;
}
