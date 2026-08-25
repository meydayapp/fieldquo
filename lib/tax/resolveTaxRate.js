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
// ── The setting is opt-in and named honestly ────────────────────────────────
//
// Company.autoApplyLocalTax means "pick the rate matching the client's
// province instead of always using my default". It does NOT mean "work out
// the correct tax for me" — FieldQuo doesn't know a company's registrations,
// its exemptions, or whether a particular job is zero-rated. It matches a
// rate the company themselves created and named.
//
// That distinction is the whole safety argument: every rate this can return
// was entered by the company under Settings → Tax. Nothing is invented.
//
// ── Matching is by name, deliberately ───────────────────────────────────────
//
// TaxRate has `name` and `rate` and no province column. Rather than adding one
// and migrating, this matches the province against the rate's NAME — companies
// already name them things like "GST + QST (QC)" or "HST Ontario", because
// that's the only way to tell them apart in a dropdown.
//
// Naming-based matching is fuzzy, which is why a miss falls through to the
// default rather than guessing. If this proves useful, the honest next step is
// a real `province` column on TaxRate and a migration that asks companies to
// confirm — not a cleverer regex.
//
// ── The jurisdiction table, and where it sits in the ladder ─────────────────
//
// The paragraph above used to end the story, and the result was the screen the
// owner reported: "Apply tax (0%) — This client has no province set, so your
// default rate applies". A company that had never typed a rate got 0% on every
// quote, which is a claim ("this supply is not taxed") the app was in no
// position to make.
//
// lib/tax/jurisdictions.js now supplies a published rate as a LAST resort. The
// precedence below is the whole safety argument, in order:
//
//   1. autoApplyLocalTax off      → the company's default, untouched. The
//                                   feature is opt-in and this is the door.
//   2. a company TaxRate whose    → that rate wins. A contractor who typed
//      name matches the province    "HST Ontario 13" is never overruled by a
//                                   table, even if the table disagrees.
//   3. lib/tax/jurisdictions.js   → the published rate for the jurisdiction,
//                                   but ONLY where it is genuinely knowable.
//                                   Canada yes; the United States never (a
//                                   state figure is a floor, not a rate); the
//                                   EU only when the company has told us it is
//                                   VAT registered.
//   4. the company's default      → everything else, including every "we don't
//                                   know" the table returns.
//
// Step 3 can only ever ADD a rate where the contractor had not expressed one
// for that jurisdiction. It cannot overwrite step 2, and step 1 turns it off
// entirely.
//
// ── Historical documents are not re-priced ──────────────────────────────────
//
// Quote.tax stores a money AMOUNT, not a rate, so a sent quote carries its tax
// as a fact and nothing here can reach it. The quote builder only calls this on
// a CREATE (see the effect in QuoteBuilder.js). The `asOf` argument exists so
// that if a caller ever does resolve for a past date, it gets that date's rate
// or "unknown" — never today's number wearing a historical date.

import { lookupJurisdictionRate } from "@/lib/tax/jurisdictions";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

// Canonical abbreviations plus the full names people actually type.
const PROVINCE_ALIASES = {
  AB: ["ab", "alberta"],
  BC: ["bc", "british columbia"],
  MB: ["mb", "manitoba"],
  NB: ["nb", "new brunswick"],
  NL: ["nl", "newfoundland", "labrador"],
  NS: ["ns", "nova scotia"],
  NT: ["nt", "northwest territories"],
  NU: ["nu", "nunavut"],
  ON: ["on", "ontario"],
  PE: ["pe", "pei", "prince edward"],
  QC: ["qc", "quebec", "québec"],
  SK: ["sk", "saskatchewan"],
  YT: ["yt", "yukon"],
};

/** Normalises "Québec", "quebec", "QC" to "QC". Null when unrecognised. */
export function normaliseProvince(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return null;
  for (const [code, aliases] of Object.entries(PROVINCE_ALIASES)) {
    if (aliases.includes(v)) return code;
  }
  return null;
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
 * @param company   needs autoApplyLocalTax, taxRate (the flat fallback),
 *                  country and vatRegistered
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

  const fallback = {
    rate: Number(company.taxRate || 0),
    source: "company_default",
    label: null,
    detail: null,
    cautionKey: null,
  };

  if (!company.autoApplyLocalTax) return fallback;

  // ── 2. The company's own named rates come first ─────────────────────────
  //
  // Unchanged, and deliberately ahead of the jurisdiction table. A rate the
  // contractor typed is a decision; the table is a reference.
  const code = normaliseProvince(client?.province);
  if (code) {
    const match = taxRates.find((r) => nameMatchesProvince(r.name, code));
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

  // ── 3. The published rate for the jurisdiction ──────────────────────────
  const found = lookupJurisdictionRate({
    clientCountry: client?.country,
    // Not `code`: normaliseProvince only knows Canadian provinces, so a US
    // state or anything else would arrive as null and the table would never
    // see it. The raw value goes in and each region's own table validates it.
    clientRegion: client?.province,
    companyCountry: company.country,
    vatRegistered: company.vatRegistered ?? null,
    workType,
    asOf,
    lang,
  });

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

    // The United States, always. The state figure is carried in `detail` for
    // the UI to show as guidance and the RATE stays the company's own — see
    // the header of lib/tax/jurisdictions.js for why a state number must never
    // land in the tax box.
    case "base_only":
      return {
        ...fallback,
        source: "us_state_base_only",
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

  switch (result?.source) {
    case "client_province":
      return { key: "app.tax.note.companyRate", params: { label, client: clientName } };
    case "jurisdiction_ca":
      return {
        key: "app.tax.note.canadaRate",
        params: { label, rate: pct(result.rate) },
      };
    case "jurisdiction_vat":
      return result.detail?.appliedReduced
        ? { key: "app.tax.note.vatReduced", params: { label, rate: pct(result.rate) } }
        : { key: "app.tax.note.vatStandard", params: { label, rate: pct(result.rate) } };
    case "vat_not_registered":
      return { key: "app.tax.note.vatNotRegistered", params: { label } };
    case "us_state_base_only":
      return {
        key: "app.tax.note.usStateBase",
        params: { label, rate: pct(result.detail?.stateRate) },
      };
    case "unknown_no_client_country":
      return { key: "app.tax.note.noClientCountry", params: { client: clientName } };
    case "unknown_unknown_region":
      return { key: "app.tax.note.unknownRegion", params: { client: clientName } };
    case "unknown_supplier_country_unknown":
      return { key: "app.tax.note.noCompanyCountry", params: {} };
    case "unknown_vat_status_unknown":
      return { key: "app.tax.note.vatStatusUnknown", params: { label } };
    case "unknown_unsupported_country":
      return {
        key: "app.tax.note.unsupportedCountry",
        params: { country: result.detail?.country || "" },
      };
    case "unknown_no_data_for_date":
      return { key: "app.tax.note.noRateForDate", params: { label } };
    default:
      return null;
  }
}
