// lib/sales/discovery/licenceRegisters.js
//
// Which discovery providers are CONTRACTOR-LICENCE registers, and what their
// category strings say in words.
//
// ══ The classification that was wrong at the source ════════════════════════
//
// Measured in production on 2026-09-11: the Quebec RBQ campaigns found 49,187
// licensed contractors and accepted none. 39,654 sat in `needs_review` with
// the reason "Nothing in the source says whether this is a contractor or a
// shop." — which is classify.js's tier E, and for an Overture points-of-
// interest row it is the honest verdict. For a row read out of a register of
// ACTIVE CONTRACTOR LICENCES it is false: the source says exactly that. The
// Régie asserts, today, that this business holds a licence to do construction
// work. That is a stronger statement of "contractor" than any taxonomy
// Overture ships, and a classifier that ignores it sends 40,000 licensed
// contractors to a human to be told what the regulator already said.
//
// So a needs_review verdict is overridden to `contractor` for a row from one
// of these providers — in lib/sales/discovery/ingest.js's planIngest, and
// ONLY the needs_review verdict. A retailer verdict (tier A: the NAME says
// supply, wholesale, lumber) stands: a building-supply yard that also holds
// a licence is still a place a rep should not phone with a field-service
// pitch, and "holds a licence" does not contradict "sells materials".
//
// What this does NOT change: the trade. A licence says the holder may do
// construction work; which kind is what rbq/provider.js's header measures
// cannot be read off the authorisation set, and this file does not try. The
// row is a contractor with `tradeKey: null` — banked, in no rep's queue —
// until a human picks a trade in the Review folder or the crawler reads one
// off the business's own website.
//
// ══ Why a map keyed by provider key, and not a flag on the provider ═════════
//
// planIngest is pure and the discovery registry is not: it is populated by
// importing lib/sales/discovery/providers.js, and a check that drives
// planIngest against fixtures should not need the registry loaded to get the
// right verdict. scripts/check-review-folder.mjs asserts this map and the
// registry agree in both directions, so a fifth board cannot be added to one
// and not the other.

import { RBQ_PROVIDER_KEY } from "./rbq/snapshot";
import { describeRbqCategory } from "./rbq/subcategories";
import { classForNamespaced, classLabel } from "./usBoard/classes";

/**
 * Provider key → the register's name as the classification reason states it.
 *
 * The sentence written to `Prospect.classificationReason` is
 * "Holds a contractor licence (<name>)." — a rep or a superadmin reading it
 * should recognise the regulator, so the name is the one printed on the
 * contractor's own paperwork rather than the provider key.
 */
export const LICENCE_REGISTERS = Object.freeze({
  [RBQ_PROVIDER_KEY]: "Quebec RBQ",
  us_ca_cslb: "California CSLB",
  us_wa_lni: "Washington L&I",
  us_or_ccb: "Oregon CCB",
});

/** The register's name for a provider key, or null for a directory source. */
export function licenceRegisterName(providerKey) {
  return Object.prototype.hasOwnProperty.call(LICENCE_REGISTERS, providerKey || "")
    ? LICENCE_REGISTERS[providerKey]
    : null;
}

export function isLicenceRegister(providerKey) {
  return licenceRegisterName(providerKey) !== null;
}

/** The exact sentence planIngest writes. One place, so the check can quote it. */
export function licenceRegisterReason(providerKey) {
  const name = licenceRegisterName(providerKey);
  return name ? `Holds a contractor licence (${name}).` : null;
}

/**
 * A source category, in words a reviewer can read.
 *
 *   rbq:16            → "16 — Entrepreneur en électricité"
 *   us_ca_cslb_c33    → "C-33 — Painting and Decorating Contractor"
 *   painting          → "painting"   (an Overture slug is already words)
 *
 * The board classes come from usBoard/classes.js's vocabularies, which were
 * read out of the published files; the RBQ codes from rbq/subcategories.js.
 * A code neither knows is returned as itself — visible, never blank.
 */
export function describeSourceCategory(providerKey, category) {
  const text = typeof category === "string" ? category.trim() : "";
  if (!text) return null;
  if (providerKey === RBQ_PROVIDER_KEY || text.startsWith("rbq:")) {
    return describeRbqCategory(text) || text;
  }
  if (providerKey && providerKey.startsWith("us_") && text.startsWith(`${providerKey}_`)) {
    const token = classForNamespaced(providerKey, text);
    if (token) {
      const label = classLabel(providerKey, token);
      return label ? `${token} — ${label}` : token;
    }
  }
  return text;
}

/**
 * Every category on a row, described, deduplicated and in a stable order.
 * The US boards write a single-class licence's class into both `primary` and
 * `alternate`, so the stored array holds it twice; a reviewer needs it once.
 */
export function describeSourceCategories(providerKey, categories = []) {
  const seen = new Set();
  const out = [];
  for (const category of Array.isArray(categories) ? categories : []) {
    const line = describeSourceCategory(providerKey, category);
    if (line && !seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}
