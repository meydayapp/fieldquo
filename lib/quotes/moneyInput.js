// lib/quotes/moneyInput.js
//
// A money figure a contractor typed or confirmed — the upload confirm form
// (app/app/quotes/[id]/SubQuoteUploads.js) and the server that validates the
// same figure again (lib/quotes/subQuoteUpload.js readConfirmation). One
// parser for both, with no imports, so the browser bundle carries nothing
// else and the two sides cannot disagree about what "12,345.67" means.

export const MAX_SUB_QUOTE_AMOUNT = 10_000_000;

/**
 * "12,345.67", "$12345.67", "12 345,67", "CAD 1,200" → dollars rounded to
 * cents, or null. Refuses negatives, an ambiguous "1.234" (three decimals),
 * anything that is not a figure, and anything over MAX_SUB_QUOTE_AMOUNT. The
 * confirm form starts from the printed string, so a printed figure that does
 * not parse is left blank for the contractor to type — never guessed.
 */
export function parseMoneyInput(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > MAX_SUB_QUOTE_AMOUNT) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== "string") return null;
  let s = value
    .trim()
    .replace(/^[A-Z]{3}\s*/i, "")
    .replace(/\s*[A-Z]{3}$/i, "")
    .replace(/[$€£¥₹\s ]/g, "");
  if (!s || s.startsWith("-") || s.startsWith("(")) return null;
  // "12.345,67" / "12345,67" → a decimal comma; "12,345.67" → a thousands comma.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot && s.length - lastComma - 1 <= 2) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n > MAX_SUB_QUOTE_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}
