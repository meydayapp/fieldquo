// lib/i18n/companyName.js
//
// A company's name as client copy prints it.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// TrueFinish's pay-over-time guide printed "If you have a question, contact
// TrueFinish Cabinets Inc. ." (2026-10-10). Two things stacked: the stored
// name is "TrueFinish Cabinets Inc. " — a trailing space typed into Settings —
// and the sentence adds its own full stop after a name that already ends in
// one. Neither is the company's mistake to fix: "Inc.", "Ltd.", "Co." and
// "& Sons Ltd." are how businesses are legally named, and a stray space is
// invisible in the form.
//
// So the fix is at display, never in the data (the stored name is left as
// typed): every client-facing sentence that ENDS on the company's name goes
// through nameThenStop(), which trims the name and adds the full stop only
// when the name doesn't already end with one. Builders that take a company
// name (the pay-over-time guide, the "how to pay" payee) trim it once on the
// way in with companyDisplayName().
//
// scripts/check-company-name-stop.mjs renders every such sentence in all
// eight languages with "TrueFinish Cabinets Inc. " and with a plain name, and
// fails on " ." or "..".

/** The name trimmed, inner runs of whitespace folded to one space. */
export function companyDisplayName(name) {
  if (name == null) return "";
  return String(name).replace(/\s+/g, " ").trim();
}

// A name that already ends a sentence on its own: "Inc.", "Ltd.", "Co.",
// "Yes!" — and the ellipsis, in either spelling.
const ENDS_SENTENCE = /(?:[.!?…])$/;

/**
 * The name followed by a full stop — unless it already ends with one.
 * Use it in place of `${company}.` at the end of a sentence:
 *
 *   `If you have a question, contact ${nameThenStop(company)}`
 *     "TrueFinish Cabinets Inc. " → "… contact TrueFinish Cabinets Inc."
 *     "Acme Painting"             → "… contact Acme Painting."
 *
 * When the sentence ends on the name only SOMETIMES — "contact Acme." but
 * "contact Acme at 555-0100." — pass the optional tail as further arguments;
 * the stop goes after whatever ends up last:
 *
 *   `Contact ${nameThenStop(company, phone ? ` at ${phone}` : "")}`
 *
 * An empty name with no tail stays empty (the caller's sentence decides what
 * to do), so this never prints a lone ".".
 */
export function nameThenStop(name, ...tail) {
  const text = `${companyDisplayName(name)}${tail.filter((t) => typeof t === "string").join("")}`.trimEnd();
  if (!text) return "";
  return ENDS_SENTENCE.test(text) ? text : `${text}.`;
}
