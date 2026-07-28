// lib/documents/paymentSchedule.js
//
// Turns a company's free-text payment terms into a milestone schedule.
//
// Lives in its own file rather than inside PaymentTermsSection because that
// module imports @react-pdf/renderer at the top. The public quote page and the
// approval endpoint both want this parser and neither wants a PDF engine
// pulled into the bundle to get it.
//
// ── Why parse rather than add a structured field ────────────────────────────
//
// Company.paymentTerms already exists and companies already fill it in — "50%
// deposit, 50% on completion", "Net 30", "Due on receipt". Adding a second,
// structured version means asking every existing company to enter the same
// information twice, and then keeping the two in sync forever.
//
// ── The fallback matters more than the parser ───────────────────────────────
//
// A company whose terms are "Payment by e-transfer within 14 days of invoice"
// gets that sentence printed verbatim. That's correct. A mangled attempt at
// milestone cards would be worse than the plain sentence it replaced, so the
// parser is deliberately conservative: it declines whenever it isn't sure.

/**
 * @returns {{pct: string, label: string}[] | null}
 *   null means "couldn't read a schedule out of this" — print the raw text.
 */
export function parsePaymentSchedule(text) {
  if (!text || typeof text !== "string") return null;

  const matches = [...text.matchAll(/(\d{1,3})\s*%\s*([^,;.\n]*)/g)].map(
    (m) => ({
      pct: Number(m[1]),
      label: m[2]
        .trim()
        .replace(/^(on|at|upon|due|due on)\s+/i, "")
        .trim(),
    }),
  );

  // One percentage isn't a schedule, it's a sentence with a number in it.
  if (matches.length < 2) return null;

  // Guards against "10% discount for cash" turning into a payment milestone:
  // a real schedule adds up. The tolerance covers rounding like 33/33/34.
  const sum = matches.reduce((s, m) => s + m.pct, 0);
  if (sum < 95 || sum > 105) return null;

  return matches.map((m, i) => ({
    pct: `${m.pct}%`,
    label: titleCase(m.label) || defaultLabel(i, matches.length),
  }));
}

function titleCase(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Used when the company wrote bare percentages ("50%, 40%, 10%") with no
// words attached. Naming the first one "Deposit" is a safe reading; naming a
// middle one anything specific isn't, so it stays generic.
function defaultLabel(i, total) {
  if (i === 0) return "Deposit";
  if (i === total - 1) return "On completion";
  return "Progress payment";
}
