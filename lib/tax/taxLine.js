// lib/tax/taxLine.js
//
// What the tax line SAYS on the estimator's screens — "HST 13% (Ontario)",
// then in words where that came from: "from the job address", "from the
// client's address", "assumed from your own address", "your default rate".
//
// ── Why words beside the number ─────────────────────────────────────────────
//
// The rate is worked out automatically now (lib/tax/resolveTaxRate.js,
// owner 2026-09-21), and a figure that appears on its own with no
// explanation is worse than one the estimator picked, however correct it
// is: they cannot tell 13% from a stale default without opening the client.
// So every surface that prints the rate prints its provenance next to it,
// and the "Change" control beside them is the same rate box and tax switch
// the builder always had.
//
// Reads either a LIVE result (resolveDocumentTax) or the STORED record
// (Quote.taxResolution, lib/tax/taxResolution.js), which carry the same
// fields under slightly different names — the office copy of a sent quote
// must explain itself from the record, never from today's rows
// (non-negotiable #6).
//
// Returns i18n keys plus params, never sentences: the builder is read in
// nine languages and the numbers need the reader's decimal separator.
// Pure; scripts/check-tax-auto.mjs executes it.

import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { consumptionTaxName } from "@/lib/tax/jurisdictions";

// "13%" in English, "13 %" in French — the sign is spaced the way the
// catalogue's own French strings space it.
const pctIn = (lang) => (n) =>
  Number.isFinite(Number(n))
    ? Number(n).toLocaleString(numberLocaleFor(lang), { maximumFractionDigits: 3 }) + (lang === "fr" ? " %" : "%")
    : "";

/** "QST/TVQ" → QST or TVQ; GST → TPS in French; PST → TVP. */
function canadianTaxName(name, lang) {
  const n = String(name);
  if (/^QST\/TVQ$/i.test(n)) return lang === "fr" ? "TVQ" : "QST";
  if (lang !== "fr") return n;
  if (/^GST$/i.test(n)) return "TPS";
  if (/^PST$/i.test(n)) return "TVP";
  if (/^RST$/i.test(n)) return "TVD";
  return n;
}

/** Live result or stored record → one shape. */
function normalise(res) {
  if (!res || typeof res !== "object") return null;
  const d = res.detail && typeof res.detail === "object" ? res.detail : {};
  // The resolver reports "unknown_no_client_country" WITH the company's
  // default rate on it when it has one — the reason rides on the source so
  // explainTaxSource can say why the default applied. For the line's words
  // that is a default rate, and reads as one.
  const raw = String(res.source || "");
  const source = raw.startsWith("unknown_") && Number(res.rate ?? 0) > 0 ? "company_default" : raw;
  return {
    source,
    rate: Number(res.rate ?? 0),
    label: res.label || d.label || null,
    country: res.country || d.country || null,
    components: Array.isArray(res.components) ? res.components : Array.isArray(d.components) ? d.components : null,
    placeSource: res.placeSource || res.place?.source || (res.assumed ? "company" : null),
    assumed: Boolean(res.assumed),
  };
}

/**
 * The headline: which tax, at what rate, for where.
 *
 *   jurisdiction_ca        HST 13% (Ontario) · GST 5% + QST 9.975% (Quebec)
 *   jurisdiction_us        Texas sales tax 8.25%
 *   jurisdiction_vat       VAT 21% (Netherlands) · GST 10% (Australia)
 *   client_province        HST Ontario 13%          (the company's own row)
 *   us_company_override    Texas sales tax 7%       (their own word for it)
 *   company_default        Default rate 12% · "HST" 13%
 *   manual                 13%
 *   a stated zero          null — the line prints "None" and its reason
 *
 * @returns {{ key: string, params: object }|null}
 */
export function taxLineHeadline(res, lang = "en") {
  const r = normalise(res);
  if (!r) return null;
  const pct = pctIn(lang);
  switch (r.source) {
    case "jurisdiction_ca": {
      // The table splits HST into its federal and provincial parts for the
      // return; the line says what the homeowner sees, "HST 13%". Quebec's
      // "QST/TVQ" row reads as QST in English and TVQ in French.
      const comps = (r.components || []).filter((c) => c && c.name && Number.isFinite(Number(c.rate)));
      const hst = comps.filter((c) => /^HST/i.test(c.name));
      const rest = comps.filter((c) => !/^HST/i.test(c.name));
      const parts = [];
      if (hst.length) parts.push(`${lang === "fr" ? "TVH" : "HST"} ${pct(hst.reduce((a, c) => a + Number(c.rate), 0))}`);
      for (const c of rest) parts.push(`${canadianTaxName(c.name, lang)} ${pct(c.rate)}`);
      const taxes = parts.length ? parts.join(" + ") : pct(r.rate);
      return { key: "app.tax.headline.region", params: { taxes, region: r.label || "" } };
    }
    case "jurisdiction_us":
    case "us_company_override":
      return { key: "app.tax.headline.us", params: { state: r.label || "", rate: pct(r.rate) } };
    case "jurisdiction_vat":
      // "GST 10% (Australia)", never "VAT 10% (Australia)" — the name comes
      // from the table row (lib/tax/jurisdictions.js consumptionTaxName), and
      // the stored record carries the country, so a sent quote says it too.
      return {
        key: consumptionTaxName(r.country) === "GST" ? "app.tax.headline.gst" : "app.tax.headline.vat",
        params: { rate: pct(r.rate), country: r.label || "" },
      };
    case "client_province":
      return { key: "app.tax.headline.named", params: { label: r.label || "", rate: pct(r.rate) } };
    case "company_default":
      return r.label
        ? { key: "app.tax.headline.named", params: { label: r.label, rate: pct(r.rate) } }
        : { key: "app.tax.headline.default", params: { rate: pct(r.rate) } };
    case "manual":
      return { key: "app.tax.headline.manual", params: { rate: pct(r.rate) } };
    default:
      return null;
  }
}

/**
 * Where the province came from, in words. Null when there is nothing to
 * say (a typed rate explains itself; an unresolved line has its own hint).
 */
export function taxLineSource(res) {
  const r = normalise(res);
  if (!r) return null;
  if (r.source === "manual") return { key: "app.tax.source.typed", params: {} };
  if (r.source === "company_default") return { key: "app.tax.source.default", params: {} };
  if (!r.source || r.source.startsWith("unknown_")) return null;
  switch (r.placeSource) {
    case "site":
      return { key: "app.tax.source.site", params: {} };
    case "client":
      return { key: "app.tax.source.client", params: {} };
    case "client_address":
      return { key: "app.tax.source.clientAddress", params: {} };
    case "company":
      return { key: "app.tax.source.company", params: {} };
    default:
      return null;
  }
}

/**
 * Is the line resolved — a rate to print — or does it need the estimator?
 *
 *   resolved     a rate above zero, or a stated zero (a position, not a gap)
 *   unresolved   tax is on and nothing anywhere names a rate
 */
export function taxLineResolved(res) {
  const r = normalise(res);
  if (!r) return false;
  if (r.rate > 0) return true;
  return r.source === "us_company_none" || r.source === "vat_not_registered" || r.source === "us_exempt";
}

/**
 * The hint under an unresolved line: what to ADD, named — never "no rate is
 * known" when the thing that is missing is a province.
 *
 *   no place anywhere         "Add the client's province (or a job address)…"
 *   a place, no rate for it   "No tax rate is known for {place} yet…"
 *
 * @param place  a human place ("Ottawa, ON") when the address is known
 */
export function taxLineUnresolvedHint(res, { place = null } = {}) {
  const r = normalise(res);
  const src = r?.source || "";
  if (src === "unknown_no_client_country" || src === "unknown_unknown_region" || !r) {
    return place
      ? { key: "app.tax.line.unresolvedHintPlace", params: { place } }
      : { key: "app.tax.line.addProvince", params: {} };
  }
  if (src === "unknown_no_default") {
    return place
      ? { key: "app.tax.line.unresolvedHintPlace", params: { place } }
      : { key: "app.tax.line.addProvince", params: {} };
  }
  if (src === "unknown_supplier_country_unknown") return { key: "app.tax.line.addCompanyCountry", params: {} };
  if (src === "unknown_vat_status_unknown")
    return { key: consumptionTaxName(r.country) === "GST" ? "app.tax.line.answerGst" : "app.tax.line.answerVat", params: {} };
  return place
    ? { key: "app.tax.line.unresolvedHintPlace", params: { place } }
    : { key: "app.tax.line.unresolvedHint", params: {} };
}
