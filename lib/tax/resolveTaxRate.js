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
 * @param company   needs autoApplyLocalTax and taxRate (the flat fallback)
 * @param taxRates  the company's TaxRate rows
 * @param client    needs `province`
 *
 * @returns {{ rate: number, source: string, label: string|null }}
 *   `source` is returned so the UI can SAY why a rate was chosen. A tax figure
 *   that changes on its own with no explanation is worse than one the user
 *   picked, however correct it is.
 */
export function resolveTaxRate({ company = {}, taxRates = [], client } = {}) {
  const fallback = {
    rate: Number(company.taxRate || 0),
    source: "company_default",
    label: null,
  };

  if (!company.autoApplyLocalTax) return fallback;

  const code = normaliseProvince(client?.province);
  if (!code) return { ...fallback, source: "no_client_province" };

  const match = taxRates.find((r) => nameMatchesProvince(r.name, code));
  if (!match) return { ...fallback, source: "no_matching_rate" };

  return {
    rate: Number(match.rate),
    source: "client_province",
    label: match.name,
  };
}

/** One sentence explaining the choice, for the quote builder to display. */
export function explainTaxSource(result, client) {
  switch (result?.source) {
    case "client_province":
      return `Using ${result.label} — matched to ${client?.name || "this client"}'s province.`;
    case "no_client_province":
      return "This client has no province set, so your default rate applies.";
    case "no_matching_rate":
      return `No tax rate is set up for this client's province, so your default rate applies.`;
    default:
      return null;
  }
}
