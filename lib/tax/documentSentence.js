// lib/tax/documentSentence.js
//
// The sentence under a document's totals that explains a US tax line to the
// HOMEOWNER — in the document's language, from the stored record, and never
// from today's rows.
//
// The estimator's sentence (lib/tax/resolveTaxRate.js#explainTaxSource) says
// where the number came from and what was assumed; this one says what the
// line means to the person paying it: "New York sales tax at 8.875% (ZIP
// 10001). Rates as of September 2026." or "No Texas sales tax is charged on
// this work: the contractor pays tax on materials when buying them, and
// labour on real property is not taxed." A stated zero explained is what
// stops "None" reading as an oversight.

import { documentLabels } from "@/lib/i18n/documentLabels";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { readTaxResolution, ratesMonthDate } from "@/lib/tax/taxResolution";

const fill = (template, params) =>
  String(template || "").replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));

/**
 * @param stored    Quote/Invoice.taxResolution (or a live resolveDocumentTax
 *                  result already passed through recordTaxResolution)
 * @param language  the DOCUMENT's language
 * @returns string  "" when the record is not a US one, or says nothing
 *                  worth printing (a manual rate, a Canadian rate — those
 *                  have their own lines).
 */
export function documentTaxSentence(stored, language = "en") {
  const r = readTaxResolution(stored);
  if (!r || r.country !== "US") return "";
  const t = documentLabels(language);
  const pct = (n) =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString(numberLocaleFor(language), { maximumFractionDigits: 3 })
      : "";
  const state = r.label || r.region || "";

  if (r.source === "us_company_none") return fill(t.usTaxNoneCompany, { state });
  // Records written before 2026-09-19, when the rung zeroed the rate in
  // states that do not tax construction. Never produced now; still printed.
  if (r.source === "us_exempt" || r.applies === "none") {
    const capital = r.answer === "capitalImprovement";
    return fill(capital ? t.usTaxNoneCapital : t.usTaxNone, { state });
  }

  // A share is printed as the jurisdiction's rate on a share of the amount
  // ("5.6% on 65%"), never as the blended effective figure — nobody in
  // Arizona has heard of a 3.64% rate.
  const shown = r.applies === "share" && r.baseRate != null ? r.baseRate : r.rate;
  const scope =
    r.applies === "share"
      ? fill(t.usScopeShare, { share: pct(Math.round((r.share || 0) * 100)) })
      : r.applies === "fixed"
        ? t.usScopeFixed
        : "";

  // A ZIP row always carries the month it was loaded in; a record without
  // one is a state-level rate and gets the shorter line.
  const monthDate = r.precision === "zip" && r.zip ? ratesMonthDate(r.ratesMonth) : null;
  if (monthDate) {
    const month = monthDate.toLocaleDateString(numberLocaleFor(language), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    let line = fill(t.usTaxApplied, { state, rate: pct(shown), zip: r.zip, scope, month });
    if (r.maxRate != null && Number(r.maxRate) > Number(r.rate)) {
      line += fill(t.usTaxUpTo, { maxRate: pct(r.maxRate) });
    }
    return line;
  }
  return fill(t.usTaxAppliedState, { state, rate: pct(shown), scope });
}
