// lib/tax/resolveTaxRate.js
//
// Which tax rate applies to a given client.
//
// ── Why this is the careful one ─────────────────────────────────────────────
//
// The other two unapplied settings — date format and week start — change how
// something LOOKS. This one changes what a client is charged, and a wrong
// rate on a sent quote is a number the company has to honour or a conversation
// they have to have. So the rules here are conservative by design: when
// there's any doubt, it falls back to the company's single default rate, which
// is exactly the behaviour before this existed.
//
// ── Automatic by default (owner, 2026-09-21) ────────────────────────────────
//
// This file used to open with a gate: unless the company had switched
// autoApplyLocalTax on, everything below was skipped and the company's flat
// default — 0 for a company that never typed one — went on the quote. The
// setting was described as opt-in ("nothing is invented"). The owner, on a
// new quote for a client in Ottawa that opened on "No tax rate is known for
// Ottawa, ON yet": "That should not be true — taxes should be automatically
// set based on the province / state."
//
// He is right about what is knowable. Canada's rate IS determined by the
// province: lib/tax/jurisdictions.js holds the CRA's GST/HST/PST/QST by
// province with sources and effective dates. For the United States his
// decision of 2026-09-19 stands (docs/US-SALES-TAX.md): apply the full
// combined rate by default, like Canada, and print the state's own rule as a
// hint — "the contractor can charge the tax, I'm not here to police them".
// Tax lives on the document, never on Stripe.
//
// So the ladder runs for every company in `auto` mode, which is the default
// and the mode every existing company is on (lib/tax/taxMode.js has the
// migration rule). `manual` keeps only the company's own rows and default.
//
// ── Matching a company's own rate is by name, deliberately ──────────────────
//
// TaxRate has `name` and `rate` and no province column. Rather than adding one
// and migrating, this matches the province against the rate's NAME — companies
// already name them things like "GST + QST (QC)" or "HST Ontario", because
// that's the only way to tell them apart in a dropdown. Word-boundary matched;
// a miss falls through to the table rather than guessing.
//
// ── The ladder ──────────────────────────────────────────────────────────────
//
//   1. a company TaxRate whose    → that rate wins. A contractor who typed
//      name matches the province    "HST Ontario 13" is never overruled by a
//                                   table, even if the table disagrees.
//      ── `manual` mode stops here and takes the default (5). ──
//   2. Company.usTaxOverrides     → US only: the company's own word for that
//                                   state — a typed rate, or "we collect
//                                   nothing there". lib/tax/usOverrides.js.
//   3. lib/tax/jurisdictions.js   → the published rate for the jurisdiction.
//                                   Canada by province; the EU only when the
//                                   company has said it is VAT registered;
//                                   the United States by ZIP from the states'
//                                   own files, by state where the state has
//                                   no local tax, and by the state floor WITH
//                                   A SENTENCE SAYING SO otherwise. The full
//                                   combined rate goes on the whole quote,
//                                   exactly as a Canadian province's does;
//                                   lib/tax/usTaxability.js's state rule
//                                   rides beside it as a HINT, never as a
//                                   change to the number.
//   4. the company's default      → everything the table cannot answer: the
//                                   TaxRate row flagged default, else
//                                   Company.taxRate (lib/tax/taxMode.js).
//   5. nothing                    → rate 0 with an `unknown_*` source, which
//                                   every screen prints as "not worked out",
//                                   never as $0.00.
//
// WHICH province or state the ladder is asked about is not decided here.
// lib/tax/documentTax.js reads it from the job address first (services on
// real property are taxed where the property is), then the client's record,
// then the company's own address, and says which one it used. This file
// takes a `client` shaped { province, country, postalCode, usTaxRate } and
// answers for that place.
//
// `workType` carries the EU "renovation" flag only. An earlier version also
// carried a per-quote US answer (capital improvement vs repair) that zeroed
// or scaled the rate; the owner's decision of 2026-09-19 retired it — see
// the US rung below.
//
// ── Historical documents are not re-priced ──────────────────────────────────
//
// Quote.tax stores a money AMOUNT, not a rate, so a sent quote carries its tax
// as a fact and nothing here can reach it. The quote builder only calls this on
// a CREATE (see the effect in QuoteBuilder.js). The `asOf` argument exists so
// that if a caller ever does resolve for a past date, it gets that date's rate
// or "unknown" — never today's number wearing a historical date.

import { lookupJurisdictionRate, normaliseCountry, consumptionTaxName } from "@/lib/tax/jurisdictions";
import { usTaxHint, US_TAXABILITY } from "@/lib/tax/usTaxability";
import { usOverrideFor } from "@/lib/tax/usOverrides";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { CA_PROVINCE_ALIASES, normaliseProvince, normaliseUsState } from "@/lib/tax/addressRegion";
import { effectiveTaxMode, companyDefaultRate } from "@/lib/tax/taxMode";

// The alias tables live in lib/tax/addressRegion.js so the address parser,
// the client-record reader and this resolver agree on what "Québec" is.
// Re-exported because every existing caller imports them from here.
export { normaliseProvince, normaliseUsState };
const PROVINCE_ALIASES = CA_PROVINCE_ALIASES;

/**
 * Does this rate's name refer to the given US state?
 *
 * Full names match case-insensitively at a word boundary ("Texas sales tax").
 * The two-letter code matches only in UPPER CASE, because "in", "or", "me",
 * "ok", "hi" and "de" are words, and "GST in Ontario" must not become an
 * Indiana rate.
 */
function nameMatchesUsState(name, code) {
  const raw = String(name || "");
  const row = US_TAXABILITY[code];
  if (!row) return false;
  const full = row.label.replace(/\s+/g, "\\s+");
  if (new RegExp(`\\b${full}\\b`, "i").test(raw)) return true;
  return new RegExp(`(^|[^A-Za-z])${code}([^A-Za-z]|$)`).test(raw);
}

/**
 * Does this rate's name refer to the given province?
 *
 * Word-boundary matched so "ON" doesn't match "Toronto" or "Construction" —
 * a substring check here would pick the wrong rate roughly every time a
 * company named one after a city.
 */
function nameMatchesProvince(name, code) {
  const lower = String(name || "").toLowerCase();
  const aliases = PROVINCE_ALIASES[code] || [];
  return aliases.some((alias) =>
    new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower),
  );
}

/**
 * @param company   needs taxMode (or the older autoApplyLocalTax), taxRate,
 *                  country, vatRegistered and usTaxOverrides
 * @param taxRates  the company's TaxRate rows
 * @param client    needs `province` and `country`
 * @param workType  "renovation" to request an EU reduced rate. Never inferred
 *                  — the caller has to mean it.
 * @param asOf      which day's rate. Defaults to today.
 * @param lang      which language to name the jurisdiction in.
 *
 * @returns {{
 *   rate: number, source: string, label: string|null,
 *   detail: object|null, cautionKey: string|null,
 * }}
 *   `source` is returned so the UI can SAY why a rate was chosen. A tax figure
 *   that changes on its own with no explanation is worse than one the user
 *   picked, however correct it is. `detail` carries the jurisdiction result —
 *   components, the US state base, the EU reduced-rate conditions — so the
 *   screen can show the breakdown rather than a bare number.
 */
export function resolveTaxRate({
  company: companyArg,
  taxRates: taxRatesArg,
  client,
  workType = null,
  asOf = new Date(),
  // Which language to NAME the jurisdiction in. The rate is the same either
  // way; "Colombie-Britannique" in a French sentence is not.
  lang = "en",
} = {}) {
  // Coalesced rather than defaulted in the signature: a default parameter only
  // fires on `undefined`, and every caller here reads these out of a fetch
  // response where the miss is `null`. `{ company: null }` used to throw on
  // `company.taxRate` and take the quote builder down with it.
  const company = companyArg || {};
  const taxRates = Array.isArray(taxRatesArg) ? taxRatesArg : [];

  // The company's own default: the TaxRate row it flagged, else the flat
  // column. A default of nothing is "unknown", not 0% — the screens print
  // "not worked out" for it and the send gate refuses it.
  const own = companyDefaultRate(company, taxRates);
  const fallback = {
    rate: own.rate,
    source: own.rate > 0 ? "company_default" : "unknown_no_default",
    label: own.label,
    detail: null,
    cautionKey: null,
  };
  const mode = effectiveTaxMode(company);

  // ── 1. The company's own named rates come first ─────────────────────────
  //
  // Deliberately ahead of the jurisdiction table. A rate the contractor
  // typed is a decision; the table is a reference.
  const clientCountry = normaliseCountry(client?.country);
  const usState = clientCountry === "US" ? normaliseUsState(client?.province) : null;
  const code = usState ? null : normaliseProvince(client?.province);
  if (code || usState) {
    const match = taxRates.find((r) =>
      usState ? nameMatchesUsState(r.name, usState) : nameMatchesProvince(r.name, code),
    );
    if (match) {
      return {
        rate: Number(match.rate),
        source: "client_province",
        label: match.name,
        detail: null,
        cautionKey: null,
      };
    }
  }

  // ── `manual`: the company's own rows and default, nothing published ────
  //
  // The door out of automation, for a contractor with a reason the tables
  // cannot know. The default it lands on is the one Settings → Tax shows.
  if (mode === "manual") return fallback;

  // ── 2. The company's per-state US override ──────────────────────────────
  //
  // Their registration, their word. A typed rate goes on the whole quote; a
  // "none" is a stated zero with the company's reason on the document.
  if (usState) {
    const override = usOverrideFor(company, usState);
    if (override?.mode === "rate") {
      return {
        rate: Number(override.rate),
        source: "us_company_override",
        label: US_TAXABILITY[usState].label,
        detail: { country: "US", region: usState, label: US_TAXABILITY[usState].label, override },
        cautionKey: null,
      };
    }
    if (override?.mode === "none") {
      return {
        rate: 0,
        source: "us_company_none",
        label: US_TAXABILITY[usState].label,
        detail: { country: "US", region: usState, label: US_TAXABILITY[usState].label, override },
        cautionKey: null,
      };
    }
  }

  // ── 3. The published rate for the jurisdiction ──────────────────────────
  const found = lookupJurisdictionRate({
    clientCountry: client?.country,
    // The normalised code when the province is Canadian or American —
    // "Ontario" and "Québec" used to reach the Canadian table as typed and
    // come back "unknown region" — and the raw value otherwise, so a VAT
    // country's region still arrives for its own table to judge.
    clientRegion: usState || code || client?.province,
    // The ZIP row lib/tax/usRates.js attached, when the server did. Absent
    // in the browser for a client it has not been attached to, and the US
    // lookup then says "state rate only" rather than inventing a local rate.
    clientZipRate: client?.usTaxRate || null,
    companyCountry: company.country,
    vatRegistered: company.vatRegistered ?? null,
    workType,
    asOf,
    lang,
  });

  // ── The US rung: the full combined rate, on the whole quote ──────────────
  //
  // Both "known" (ZIP or no-local-tax state) and "state_only" (the floor,
  // with its caution) apply the published rate to the whole quote — the
  // same thing Canada does with a province. lib/tax/usTaxability.js still
  // says what the state's own rule is (most states do not tax residential
  // construction to the customer; NY and TX depend on the kind of work), but
  // that is printed as a HINT beside the rate, never applied for the
  // contractor. The owner, 2026-09-19, on the earlier version that zeroed
  // the tax in "exempt" states: "the contractor can charge the tax, I'm not
  // here to police them — they are responsible for what they charge. If
  // they charge the full tax then the system should allow them to, by
  // default." So: the rate by default, one press to switch tax off on a
  // quote, and the hint says when that press is probably the right one.
  if (found.country === "US" && (found.status === "known" || found.status === "state_only")) {
    // `hint` names the case in which the state's own rule says the customer
    // is not charged — for a "depends" state, whichever kind of job that is
    // (a capital improvement in NY, residential work in TX, building work
    // in OH) — so the note can say "switch tax off if that's this job".
    // `applies` is forced to "all" so no reader of the treatment ever scales
    // or zeroes the rate again.
    const hint = usTaxHint(found.region);
    const detail = { ...found, treatment: { applies: "all", labour: hint.labour, hint: hint.reason } };
    return {
      rate: Number(found.rate),
      source: "jurisdiction_us",
      label: found.label,
      detail,
      cautionKey: found.cautionKey || null,
      // Nothing is assumed on the contractor's behalf: the rate is the
      // rate, and the hint is a sentence.
      assumedAnswer: null,
    };
  }

  switch (found.status) {
    // A published rate we can stand behind. Applied.
    case "known":
      return {
        rate: Number(found.rate),
        source: found.country === "CA" ? "jurisdiction_ca" : "jurisdiction_vat",
        label: found.label,
        detail: found,
        cautionKey: found.cautionKey || null,
      };

    // The company told us it is below the VAT registration threshold. Zero
    // here is the company's own stated position, not an absence padded into a
    // number — which is why it needs `vatRegistered === false` and not merely
    // a missing VAT number.
    case "not_registered":
      return {
        rate: 0,
        source: "vat_not_registered",
        label: found.label,
        detail: found,
        cautionKey: found.cautionKey,
      };

    // Everything else: we don't know. The company's default applies and the
    // screen says which flavour of "don't know" this was, because each one has
    // a different fix (set the client's country, set yours, answer the VAT
    // question) and a generic shrug tells the contractor none of them.
    default:
      return { ...fallback, source: `unknown_${found.reason}`, detail: found };
  }
}

/**
 * "September 2026" for the rates-table line, in the reader's language. Reads
 * the ZIP row's effective date, else the fetch date, else nothing — a
 * state-only fallback has no table month to cite and the sentence says so
 * instead.
 */
export function usRatesMonth(detail, lang = "en") {
  const iso = detail?.fetchedAt || detail?.effectiveFrom || null;
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(numberLocaleFor(lang), { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The US sentence, built from parts so every surface says the same thing:
 *
 *   8.875% New York sales tax (ZIP 10001: state 4% + local 4.875%), on the
 *   whole quote. Rates table: September 2026. Note: a capital improvement
 *   is not taxed in New York; you pay tax on materials when you buy them —
 *   switch tax off on this quote if that applies to you; what you charge
 *   is your call.
 *
 * Returned as ONE key with pre-composed parts rather than four keys glued in
 * code, so a translator can reorder the sentence. The parts are themselves
 * keys resolved here into params — `where`, `scope`, `reason`, `month` —
 * which is why this takes the caller's `t` indirectly through explainTaxSource
 * returning keys: the screen calls t() on the top key and each part key.
 */
function usExplanation(result, lang, pct) {
  const d = result.detail || {};
  const tr = d.treatment || {};
  const state = d.label || d.region || "";
  const where =
    d.precision === "zip"
      ? { key: "app.tax.us.where.zip", params: { rate: pct(d.rate), state, zip: d.zip, stateRate: pct(d.stateRate), localRate: pct(d.localRate) } }
      : d.precision === "state_uniform"
        ? d.uniformLocalRate > 0
          ? { key: "app.tax.us.where.uniformLocal", params: { rate: pct(d.rate), state, stateRate: pct(d.stateRate), localRate: pct(d.uniformLocalRate) } }
          : { key: "app.tax.us.where.uniform", params: { rate: pct(d.rate), state } }
        : { key: "app.tax.us.where.stateOnly", params: { rate: pct(d.rate), state } };
  // The rate is always applied to the whole quote; the state's own rule,
  // when it says the customer is usually NOT charged, is a hint for the
  // contractor ("switch tax off if that's you"), never the number.
  const scope = { key: "app.tax.us.scope.all", params: {} };
  return {
    key: tr.hint ? "app.tax.note.usAppliedHint" : "app.tax.note.usApplied",
    params: {},
    parts: {
      where,
      scope,
      // No hint → no reason: "8.875% on the whole quote" needs no defence,
      // any more than Ontario's 13% does.
      reason: tr.hint ? { key: `app.tax.us.reason.${tr.hint}`, params: { state } } : null,
      month: usRatesMonth(d, lang),
      upTo: d.maxRate != null ? { key: "app.tax.us.upTo", params: { zip: d.zip, maxRate: pct(d.maxRate) } } : null,
      assumed: null,
    },
  };
}

/**
 * Turns explainTaxSource's result into one string with the caller's t().
 * Non-US notes are a single key; the US note is assembled from its parts.
 */
export function renderTaxNote(note, t) {
  if (!note) return "";
  if (!note.parts) return t(note.key, note.params);
  const p = note.parts;
  const answer = p.assumed?.params?.answer ? t(p.assumed.params.answer.key) : "";
  return t(note.key, {
    where: t(p.where.key, p.where.params),
    scope: t(p.scope.key, p.scope.params),
    reason: p.reason ? t(p.reason.key, p.reason.params) : "",
    // Only a ZIP row has a table month; the state-level sentences already
    // say what they rest on.
    month: p.month ? t("app.tax.us.month", { month: p.month }) : "",
    upTo: p.upTo ? " " + t(p.upTo.key, p.upTo.params) : "",
    assumed: p.assumed ? " " + t(p.assumed.key, { answer }) : "",
  })
    // A part left out leaves its template punctuation behind ("quote. .")
    // and double spaces; the template cannot know which parts are present.
    .replace(/\.\s+\./g, ".")
    // An empty part leaves a double space behind; the template cannot know
    // which parts are present.
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The message explaining the choice, as an i18n key plus params.
 *
 * Returns a key rather than a sentence: this used to hand back hardcoded
 * English that went straight to the screen, so a French contractor read
 * "This client has no province set" in the middle of a French quote builder.
 *
 * Null means say nothing. A note under the tax box is worth reading only when
 * it explains something the contractor did not already know — "your default
 * rate applies, because that's your setting" is noise.
 */
export function explainTaxSource(result, client, lang = "en") {
  // Quebec's rate is 14.975, and a French reader expects 14,975. The rate is
  // formatted here rather than left to the catalogue string because a
  // placeholder cannot carry a decimal separator, and "14.975 %" inside
  // otherwise-correct French is the kind of detail that reads as a bug to
  // exactly the people it is aimed at.
  const pct = (n) =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString(numberLocaleFor(lang), {
          maximumFractionDigits: 3,
        })
      : "";

  // The unknown branches carry the jurisdiction's name on `detail`, not on
  // `label` — `label` is null there because no rate was chosen. Reading only
  // the top-level one printed "we'll use 's published rate", with the country
  // missing from the middle of the sentence.
  const label = result?.label || result?.detail?.label || "";
  const clientName = client?.name || "";
  // "GST" for Australia's row, "VAT" for the rest — the three VAT sentences
  // below each have a GST twin rather than a {tax} placeholder, because the
  // French and German forms decline differently around the two names.
  const gst = consumptionTaxName(result?.detail?.country) === "GST";

  switch (result?.source) {
    case "client_province":
      return { key: "app.tax.note.companyRate", params: { label, client: clientName } };
    case "jurisdiction_ca":
      return {
        key: "app.tax.note.canadaRate",
        params: { label, rate: pct(result.rate) },
      };
    // Australia's row is a VAT by another name (lib/tax/jurisdictions.js):
    // same rungs, sentences that say GST. It has no reduced rate, so the
    // reduced branch can only ever be a VAT one.
    case "jurisdiction_vat":
      if (gst) return { key: "app.tax.note.gstStandard", params: { label, rate: pct(result.rate) } };
      return result.detail?.appliedReduced
        ? { key: "app.tax.note.vatReduced", params: { label, rate: pct(result.rate) } }
        : { key: "app.tax.note.vatStandard", params: { label, rate: pct(result.rate) } };
    case "vat_not_registered":
      return { key: gst ? "app.tax.note.gstNotRegistered" : "app.tax.note.vatNotRegistered", params: { label } };
    case "jurisdiction_us":
    case "us_exempt":
      return usExplanation(result, lang, pct);
    case "us_company_override":
      return { key: "app.tax.note.usCompanyOverride", params: { label, rate: pct(result.rate) } };
    case "us_company_none":
      return { key: "app.tax.note.usCompanyNone", params: { label } };
    case "unknown_no_client_country":
      return { key: "app.tax.note.noClientCountry", params: { client: clientName } };
    case "unknown_unknown_region":
      return { key: "app.tax.note.unknownRegion", params: { client: clientName } };
    case "unknown_supplier_country_unknown":
      return { key: "app.tax.note.noCompanyCountry", params: {} };
    case "unknown_vat_status_unknown":
      return { key: gst ? "app.tax.note.gstStatusUnknown" : "app.tax.note.vatStatusUnknown", params: { label } };
    case "unknown_unsupported_country":
      return {
        key: "app.tax.note.unsupportedCountry",
        params: { country: result.detail?.country || "" },
      };
    case "unknown_no_data_for_date":
      return { key: "app.tax.note.noRateForDate", params: { label } };
    // "Your default rate applies, because that's your setting" is noise —
    // the tax line's own source words say it (lib/tax/taxLine.js). And a
    // company with no default and no jurisdiction gets the unresolved hint,
    // which names what to add; a second sentence here would say it twice.
    case "company_default":
    case "unknown_no_default":
    default:
      return null;
  }
}
