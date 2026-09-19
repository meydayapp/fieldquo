// lib/tax/taxResolution.js
//
// The record of what a document's tax line SAID when it was written — the
// shape stored in Quote.taxResolution and copied to Invoice.taxResolution.
//
// ── Why a stored record, when the amount is already stored ──────────────────
//
// Quote.tax holds the money. It cannot say "8.875%, New York, ZIP 10001,
// repair work, September 2026 table" — and the document has to keep saying
// exactly that after the table moves to October's rates, after the company
// changes an override, after the client's address is corrected. Re-deriving
// the sentence at render time from today's rows would make a signed PDF
// explain itself differently next month (non-negotiable #6). So the
// resolution is recorded at creation and the renderers read the record.
//
// An invoice raised from the quote copies the record verbatim: the invoice
// mirrors the quote's tax — rate, what it applied to, the rates month — and
// never re-resolves.
//
// ── What is recorded, and what is not ────────────────────────────────────────
//
// Only what the sentence needs. Not the whole resolver result, which carries
// the taxability question and its options — those are for the estimator's
// screen, not the homeowner's PDF, and freezing them would freeze a UI.
// `source: "manual"` records a rate a human typed with no jurisdiction behind
// it; the document then prints the figure and no sentence, which is the
// truth about it.

const num = (v) => (v == null || v === "" ? null : Number(v));

export const TAX_RESOLUTION_VERSION = 1;

/** Sources that are a STATED zero — a position, not an absence. */
const STATED_ZERO = new Set(["us_exempt", "us_company_none", "vat_not_registered"]);

/**
 * From a resolveDocumentTax() result to the stored shape. Null when the rate
 * came from nowhere in particular (the company default), because a record
 * saying "we used the default" would be padding.
 */
export function recordTaxResolution(result) {
  if (!result || typeof result !== "object") return null;
  const d = result.detail || {};
  const tr = d.treatment || null;
  const src = String(result.source || "");
  if (!src || src === "company_default" || src.startsWith("unknown_")) return null;
  return {
    v: TAX_RESOLUTION_VERSION,
    source: src,
    rate: num(result.rate) ?? 0,
    // The jurisdiction's own rate before a share was applied — 5.6% behind
    // Arizona's 3.64% effective — so the document can name the real figure.
    baseRate: num(d.rate),
    country: d.country || null,
    region: d.region || null,
    label: result.label || d.label || null,
    precision: d.precision || null,
    zip: d.zip || null,
    stateRate: num(d.stateRate),
    localRate: num(d.localRate),
    maxRate: num(d.maxRate),
    applies: tr?.applies || (src === "us_company_none" ? "none" : src.startsWith("us_") || src === "jurisdiction_us" ? "all" : null),
    share: num(tr?.share),
    fixedRate: num(tr?.fixedRate),
    answer: tr?.answer || null,
    assumedAnswer: Boolean(tr?.assumedAnswer),
    // "2026-09": the month of the rates table, from the loader's fetch date.
    ratesMonth: monthOf(d.fetchedAt) || monthOf(d.effectiveFrom) || null,
    sourceText: d.source || null,
    // The company-province assumption, carried so the document keeps
    // printing "based on our address" once it has said it.
    assumed: Boolean(result.assumed),
    assumedRegion: result.assumedRegion || null,
  };
}

/** A rate somebody typed. */
export function manualTaxResolution(rate) {
  const r = num(rate);
  if (r == null || !Number.isFinite(r)) return null;
  return { v: TAX_RESOLUTION_VERSION, source: "manual", rate: Math.round(r * 10000) / 10000 };
}

/** Prisma Json column → the record, or null for anything that is not one. */
export function readTaxResolution(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.source !== "string") return null;
  return raw;
}

/** Does the record say tax is nothing on purpose? */
export function resolutionStatesZero(resolution) {
  return Boolean(resolution && STATED_ZERO.has(resolution.source));
}

/**
 * Should the stored record be replaced because the document's money no
 * longer matches it? A quote saved at 8.875% and later edited to 7% by hand
 * must not keep printing "8.875% New York sales tax" under a 7% figure.
 *
 * @param resolution  the stored record
 * @param tax         the money amount now on the document
 * @param taxableBase subtotal − discount
 */
export function resolutionMatchesAmount(resolution, tax, taxableBase) {
  if (!resolution) return false;
  const base = num(taxableBase) || 0;
  const amount = num(tax) || 0;
  if (base <= 0) return amount === 0;
  const implied = (amount / base) * 100;
  return Math.abs(implied - (num(resolution.rate) || 0)) < 0.005;
}

/**
 * The record to store for a document with this money on it: the resolver's
 * record when it explains the amount, a manual record when a human overrode
 * it, and null when tax is switched off (nothing was resolved).
 */
export function resolutionForDocument({ resolution, tax, taxableBase, taxEnabled }) {
  if (taxEnabled === false) return null;
  const rec = recordTaxResolution(resolution);
  if (rec && resolutionMatchesAmount(rec, tax, taxableBase)) return rec;
  const base = num(taxableBase) || 0;
  if (base <= 0) return rec;
  return manualTaxResolution(((num(tax) || 0) / base) * 100);
}

function monthOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → a Date on the first of that month (UTC), for formatting. */
export function ratesMonthDate(ratesMonth) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ratesMonth || ""));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : null;
}
