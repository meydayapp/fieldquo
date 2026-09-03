// lib/receipts/money.js
//
// Reading money off a receipt, into integer cents.
//
// ══ Why the model never returns a number ═══════════════════════════════════
//
// lib/ai/jsonSchema.js's header states the rule this file exists to honour:
//
//   "a numeric field in a schema is a claim that a model's guess is good
//    enough to show a contractor as a fact. Almost always it is not, and the
//    number should be computed from the model's WORDS in code instead."
//
// So the receipt schema declares every amount as a STRING — what the printed
// characters say, transcribed — and this file turns those characters into
// cents. The model transcribes; the arithmetic happens here, in code that can
// be executed against hostile input by scripts/check-purchasing.mjs.
//
// The project this was ported from did the opposite: it extracted a total with
// one model, then asked a SECOND model to re-derive it by "summing all the
// items". The number passed through an LLM twice and nothing ever checked it.
// See docs/construction/AUDIT-port-candidates.md.
//
// ══ Why null, and never 0 ══════════════════════════════════════════════════
//
// A crumpled corner where the total should be is not a receipt for $0.00. Zero
// is a statement — "this cost nothing" — and it would flow straight into a job
// cost as a fact. Unreadable is unreadable, and something further up has to
// say so on screen.
//
// Pure. No imports.

/**
 * Cents from a printed amount.
 *
 * Handles what actually appears on till receipts across the markets FieldQuo
 * sells into:
 *
 *   "$1,234.56"  "1 234,56 $"  "12.34"  "12,34"  "€9,99"  "-4.50"  "4.50-"
 *
 * The separator problem is real and is decided by POSITION, not by guessing a
 * locale: whichever of `.` or `,` appears LAST and is followed by exactly two
 * (or one) digits is the decimal point; every other separator is a thousands
 * mark. "1,234.56" and "1.234,56" both come out as 123456.
 *
 * @returns {number|null} integer cents, or null when it cannot be read.
 */
export function toCents(text) {
  if (text === null || text === undefined) return null;
  if (typeof text === "number") {
    if (!Number.isFinite(text)) return null;
    return Math.round(text * 100);
  }

  let s = String(text).trim();
  if (!s) return null;

  // A trailing minus is how a lot of till software prints a refund line.
  let negative = false;
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, "");
  }
  if (/^\s*[-(]/.test(s)) negative = true;

  // Currency symbols, letters, brackets and spaces go. Whatever is left must
  // be digits and separators, or this is not an amount.
  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);

  let whole = cleaned;
  let frac = "";

  if (decimalAt !== -1) {
    const tail = cleaned.slice(decimalAt + 1);
    // Three digits after the last separator is a thousands group, not cents:
    // "1,234" is twelve hundred and thirty-four, not one and a bit.
    if (/^\d{1,2}$/.test(tail)) {
      whole = cleaned.slice(0, decimalAt);
      frac = tail;
    }
  }

  whole = whole.replace(/[.,]/g, "");
  if (!whole && !frac) return null;
  if (/[.,]/.test(frac)) return null;

  const cents = Number(`${whole || "0"}${frac.padEnd(2, "0")}`);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** Cents to a plain decimal string. No symbol — the caller knows the currency. */
export function centsToText(cents) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "";
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Cents to a number, for a Decimal(12,2) column or for the browser. */
export function centsToAmount(cents) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
  return Math.trunc(cents) / 100;
}

/** The other direction, for a figure a person typed into a form. */
export function amountToCents(amount) {
  return toCents(amount);
}
