// lib/platform/metricFormat.js
//
// How a number is written on FieldQuo's own console, and what is written when
// there isn't one.
//
// ── Absent is not zero ─────────────────────────────────────────────────────
//
// These lived inside app/components/platform/MetricCard.js and read
// `Number(value || 0)`, which turns undefined, null, "" and NaN into a
// confident 0. Zero is finite, so nothing downstream could tell the difference
// afterwards — and on this console every tile answers a question about the
// business, where "we have no MRR" and "MRR didn't load" are opposite answers
// that were rendering as identical pixels.
//
// A real zero still prints $0.00 / 0. Only absence prints UNKNOWN.
//
// Being strict at this layer is safe because the platform routes coalesce
// their aggregates where the meaning is known: Prisma returns
// `_sum.amount === null` for "no payments", and
// app/api/platform/analytics/overview/route.js turns that into 0 at the query.
// So a null arriving here is not an empty table — it is a field that did not
// come back.
//
// ── Why they are here and not in the component ─────────────────────────────
//
// So a check can run them. MetricCard.js contains JSX, which bare node cannot
// parse, so the rule could only ever have been asserted by reading the source
// as text — and a regex looking for `|| 0` proves nothing about what the
// function returns. scripts/check-platform-truth.mjs imports these and calls
// them. MetricCard re-exports both, so every existing call site is unchanged.

/** The glyph for "the number did not arrive". */
export const UNKNOWN = "—";

/**
 * null for anything that is not a real, finite number.
 *
 * Types are checked before Number() rather than after, because Number() is
 * where the fabrication happens: `Number([])` is 0 and `Number([7])` is 7, so
 * an empty array — the shape a route returns when it means "no rows" and the
 * caller reached for the wrong field — used to render as a confident $0.00.
 * `Number({})` is at least NaN. Only a number, or a string that parses as one,
 * counts as a number here.
 */
function finite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Mixed currencies: DECIDED 2026-10-03 — split, never summed ─────────────
//
// Every figure the console prints about revenue is either ONE company's money
// or a sum across tenants, and the tenants are not all in one currency: MRR
// adds Subscription rows whose Plan.currency is CAD, USD, AUD, EUR or GBP, and
// a contractor's quotes and invoices are in Company.currency. Until this date
// the console added them together and printed the result as CAD (here) or a
// bare "$" (TenantBoard, CompanyInsight) — a euro invoice and a Canadian one
// in one total wearing one symbol, wrong by more with every non-CAD signup.
//
// Three options were written down here (convert at a published rate; group by
// currency; CAD subtotal plus a count of the rest). The owner chose, on
// 2026-10-03: "it should be relevant based on the stripe currency set by the
// company USA -> USD CANADA -> CAD AUSTRALIA -> AUD etc." So:
//
//   · one company's figure is written in THAT company's currency — moneyIn();
//   · a total across companies is split per currency — sumByCurrency() then
//     moneyByCurrency(): "CAD 1,240 · USD 890 · AUD 120". Never one number.
//
// No converted single figure is printed. If one is ever added it must say it
// is converted, use the ExchangeRate table's daily rate and print the rate's
// date beside it; a converted total presented as a native amount is the same
// lie as the sum it would replace.
//
// money() itself is unchanged — en-CA, CAD, exactly the string it always
// produced — because the one console screen still calling it without a
// currency (/platform/costs) formats FieldQuo's OWN costs, not revenue. A
// revenue figure passes `currency`, and then it is written with the ISO code
// ("USD 99.00"), because en-CA writes CAD as a bare "$" and US$/A$ beside it
// are easy to misread across a row of tiles.

/** "CAD" for "cad" / " CAD ", null for anything that is not a 3-letter code. */
export function normaliseCurrency(code) {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** The key sumByCurrency() files an amount under when its currency is unknown. */
export const UNKNOWN_CURRENCY = "unknown";

function fractionDigits(n, compact) {
  return compact && Math.abs(n) >= 10000 ? 0 : 2;
}

export function money(value, options = {}) {
  const { compact = false } = options || {};
  // Present-but-undefined counts as PASSED: `{ currency: row.currency }` on a
  // row that never carried one must print "(currency unknown)", not fall back
  // to CAD and look native.
  if (options && Object.hasOwn(options, "currency")) return moneyIn(value, options.currency, { compact });
  const n = finite(value);
  if (n === null) return UNKNOWN;
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: compact && n >= 10000 ? 0 : 2,
    minimumFractionDigits: compact && n >= 10000 ? 0 : 2,
  });
}

/**
 * One amount in its own currency: "USD 99.00". An amount whose currency is
 * missing or malformed is still printed — the number is known — but says so
 * rather than borrowing a symbol: "99.00 (currency unknown)".
 */
export function moneyIn(value, currency, { compact = false } = {}) {
  const n = finite(value);
  if (n === null) return UNKNOWN;
  const digits = fractionDigits(n, compact);
  const code = normaliseCurrency(currency);
  if (!code) {
    return `${n.toLocaleString("en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits })} (currency unknown)`;
  }
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: code,
    currencyDisplay: "code",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Add amounts up PER CURRENCY: { CAD: 1240, USD: 890 }. Rows whose amount is
 * not a number are skipped (absent is not zero — and not a reason to drop the
 * rest); rows whose currency is not a code are filed under UNKNOWN_CURRENCY,
 * never under a guessed one. Rounded to cents.
 *
 * @param rows        anything iterable
 * @param amountOf    row → amount
 * @param currencyOf  row → ISO code
 */
export function sumByCurrency(rows, amountOf, currencyOf) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const n = finite(amountOf(row));
    if (n === null) continue;
    const key = normaliseCurrency(currencyOf(row)) || UNKNOWN_CURRENCY;
    out[key] = Math.round(((out[key] || 0) + n) * 100) / 100;
  }
  return out;
}

/**
 * A per-currency total, written: "CAD 1,240.00 · USD 890.00". Largest first,
 * then by code, so the order is stable. `null`/`undefined` (the figure did not
 * arrive) is UNKNOWN; an empty object (nothing to add up) is "0" — a real
 * zero, but with no currency, because none was stated.
 */
export function moneyByCurrency(totals, { compact = false, separator = " · " } = {}) {
  if (totals === null || totals === undefined || typeof totals !== "object" || Array.isArray(totals)) return UNKNOWN;
  const entries = Object.entries(totals)
    .map(([code, v]) => [code, finite(v)])
    .sort((a, b) => (b[1] ?? -Infinity) - (a[1] ?? -Infinity) || a[0].localeCompare(b[0]));
  if (!entries.length) return "0";
  return entries
    .map(([code, v]) => (code === UNKNOWN_CURRENCY ? moneyIn(v, null, { compact }) : moneyIn(v, code, { compact })))
    .join(separator);
}

/**
 * One field out of a per-currency breakdown: pickByCurrency(outlook.byCurrency,
 * (m) => m.collectableMrr) → { CAD: 845, USD: 99 }. Null in, null out, so a
 * breakdown that did not arrive stays UNKNOWN through moneyByCurrency().
 */
export function pickByCurrency(byCurrency, pick) {
  if (byCurrency === null || byCurrency === undefined || typeof byCurrency !== "object") return null;
  const out = {};
  for (const [code, entry] of Object.entries(byCurrency)) {
    const v = pick(entry);
    if (finite(v) !== null) out[code] = v;
  }
  return out;
}

/** Does any currency in this breakdown hold more than zero? */
export function anyPositive(totals) {
  if (!totals || typeof totals !== "object") return false;
  return Object.values(totals).some((v) => (finite(v) ?? 0) > 0);
}

export function count(value) {
  const n = finite(value);
  if (n === null) return UNKNOWN;
  return n.toLocaleString("en-CA");
}

/**
 * The same "absent is not zero" rule, for a caller that formats its own money.
 *
 * money() without a currency is fixed to CAD (see the 2026-10-03 note above for
 * revenue, which passes one). /platform/sales/performance formats the COMMISSION
 * ledger's cents and so cannot use it — and, formatting its own, it reproduced
 * exactly the bug this module exists for: `Number(cents) || 0`, printing a
 * confident $0.00 for every field that failed to arrive, on the four tiles that
 * say what FieldQuo owes its own reps.
 *
 * Exported rather than duplicated so a check can execute it: the page is JSX
 * and bare node cannot parse it, which is the same reason money() and count()
 * left MetricCard.js.
 *
 * @returns {number|null} the number, or null for anything that is not one
 */
export function centsOrNull(value) {
  return finite(value);
}
