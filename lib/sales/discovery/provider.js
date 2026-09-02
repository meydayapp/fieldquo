// lib/sales/discovery/provider.js
//
// The seam between "the pipeline wants businesses" and "somebody knows where
// businesses come from" — spec §62's provider interface, for discovery.
//
// ══ Why this is an interface and not a function ════════════════════════════
//
// `ProspectCampaign.discoveryProvider` has NO default, and its schema comment
// explains at length why: the obvious default was Google, and the compliance
// audit found the Maps Platform ToS forbids storing business names and
// addresses (§3.2.3(a)(iii)) and forbids building a directory at all
// (§3.2.3(d)(iii)). A campaign therefore NAMES its source. That is only
// meaningful if naming a different one actually changes what runs.
//
// So the handler resolves a provider by key and calls it. Adding a second
// provider — a bought list, a registry, a per-city extract — is a new file
// that calls registerDiscoveryProvider and an entry in providers/index.js.
// Nothing in lib/sales/pipeline/ changes, and nothing in this file knows what
// Overture is.
//
// ══ The shape every provider emits ═════════════════════════════════════════
//
// A DiscoveredBusiness. Deliberately NOT the Prospect columns: mapping to
// those is normalise.js's job, and doing it inside each provider would give
// every provider its own phone normaliser, which is the failure
// suppressionRules.js's header describes.
//
//   {
//     sourceRecordId: string        stable id within this provider
//     name: string|null
//     categories: { primary: string|null, alternate: string[] }
//     taxonomyHierarchy: string[]   coarse→fine, e.g. ["services_and_business",
//                                   "home_service","painting"]. [] when the
//                                   provider has no taxonomy.
//     phones: string[]              as the source spells them
//     websites: string[]
//     emails: string[]
//     address: { line, city, province, postalCode, country }
//     latitude: number|null
//     longitude: number|null
//     operatingStatus: string|null  VERBATIM. null means the source said
//                                   nothing — never "open".
//     sourceConfidence: number|null stored, never gated on
//     sourceDataset: string|null    which contributor the row came from
//     sourceUpdatedAt: string|null  ISO. null means unknown, never "now".
//   }
//
// ══ Paging, and why the cursor is the provider's own ═══════════════════════
//
// `fetchPage` returns a `nextCursor` the provider itself understands and the
// pipeline only carries. An offset works for a file; a continuation token
// works for an API; a date works for an incremental feed. The pipeline storing
// an integer would quietly force every future provider to be offset-shaped.

/** Everything a provider must implement. Checked at registration. */
const REQUIRED_METHODS = ["describeConfig", "fetchPage"];

const providers = new Map();

/**
 * Register a discovery provider.
 *
 * A second registration under the same key THROWS rather than overwriting.
 * The pipeline registry made the same choice for the same reason: letting the
 * later import win makes behaviour depend on import order, which changes when
 * an unrelated file gains an import.
 *
 * @param {{
 *   key: string,
 *   label: string,
 *   /// One sentence the campaign form shows under the provider's name. It
 *   /// must say where the data comes from, because a superadmin choosing a
 *   /// source is choosing a licence as well as a dataset.
 *   description: string,
 *   /// Free-form, provider-specific settings held on
 *   /// ProspectCampaign.providerConfig. Validated by the provider itself:
 *   /// only it knows what it needs.
 *   configFields: Array<{name:string,label:string,help?:string,required?:boolean}>,
 *   describeConfig: (config:object) => {ok:boolean, problems:string[], summary:string},
 *   fetchPage: (args:object) => Promise<{release:string|null,
 *                                        businesses:object[],
 *                                        nextCursor:string|null}>,
 *   currentRelease?: (deps:object) => Promise<{release:string|null, checkedAt:Date}>,
 * }} provider
 */
export function registerDiscoveryProvider(provider) {
  const key = provider?.key;
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("discovery provider: a key is required");
  }
  if (providers.has(key)) {
    throw new Error(
      `discovery provider: "${key}" is already registered — two registrations make behaviour depend on import order`,
    );
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof provider[method] !== "function") {
      throw new Error(`discovery provider "${key}": ${method}() is required`);
    }
  }
  providers.set(key, provider);
  return provider;
}

/** The provider a campaign named, or null when nobody ships one by that name. */
export function getDiscoveryProvider(key) {
  return providers.get(key) || null;
}

/** Every provider this build ships, for the campaign form. */
export function discoveryProviders() {
  return [...providers.values()].map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description || "",
    configFields: p.configFields || [],
  }));
}

/** Test seam ONLY: forget a registration so a check can install its own. */
export function __resetDiscoveryProvidersForTests() {
  providers.clear();
}

/**
 * The shape check every provider's rows are held to before ingest.
 *
 * Pure, and applied by the handler rather than trusted from the provider. A
 * provider that returns a row missing its id would otherwise produce a
 * Prospect with no provenance at all — the one thing this whole design exists
 * to keep.
 */
export function shapeProblems(business) {
  const problems = [];
  if (!business || typeof business !== "object") return ["not_an_object"];
  if (typeof business.sourceRecordId !== "string" || !business.sourceRecordId.trim()) {
    problems.push("no_source_record_id");
  }
  if (business.categories && typeof business.categories !== "object") problems.push("bad_categories");
  for (const field of ["phones", "websites", "emails"]) {
    if (business[field] !== undefined && !Array.isArray(business[field])) problems.push(`bad_${field}`);
  }
  if (business.taxonomyHierarchy !== undefined && !Array.isArray(business.taxonomyHierarchy)) {
    problems.push("bad_taxonomy");
  }
  return problems;
}
