// lib/sales/discovery/provider.js
//
// The seam between "the pipeline wants businesses" and "somebody knows where
// businesses come from" — spec §62's provider interface, for discovery.
//
// ══ Why this is an interface and not a function ════════════════════════════
//
// `ProspectCampaign.discoverySources` has NO default, and the schema comment
// explains at length why: the obvious default was Google, and the compliance
// audit found the Maps Platform ToS forbids storing business names and
// addresses (§3.2.3(a)(iii)) and forbids building a directory at all
// (§3.2.3(d)(iii)). A campaign therefore NAMES its sources. That is only
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

// ══ Why the licence is REQUIRED and not documentation ══════════════════════
//
// A campaign draws from a SET of sources now, so a superadmin can tick three
// boxes and take on three different obligations in one gesture — RBQ's CC-BY
// makes attribution a CONDITION OF THE GRANT, Overture Places is
// CDLA-Permissive-2.0 and travels with its notice. The single `<select>` this
// replaces protected against that by making the choice singular and
// deliberate; nothing protects it now except saying, against each checkbox,
// what ticking it costs.
//
// So registration THROWS on a provider with no licence. A prose paragraph in a
// header would have been the version that rots: the next provider gets added
// by copying this file's shape, and a shape that does not include a licence
// produces a source whose obligation nobody ever wrote down.

/** Everything a provider must implement. Checked at registration. */
const REQUIRED_METHODS = ["describeConfig", "fetchPage"];

/** Every licence field that must actually say something. */
const REQUIRED_LICENCE_FIELDS = ["name", "url", "obligation"];

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
 *   /// What ticking this source obliges FieldQuo to do. Rendered against the
 *   /// checkbox itself, because several sources can be ticked at once and
 *   /// each one carries its own terms. `obligation` is the sentence a human
 *   /// reads; `attribution`, when present, is the exact notice the licence
 *   /// requires, so the two surfaces that render it cannot drift.
 *   licence: {name:string, url:string, obligation:string, attribution?:string},
 *   describeConfig: (config:object) => {ok:boolean, problems:string[], summary:string},
 *   /// Optional. A sentence when this source cannot run WHATEVER it is
 *   /// configured with, null when it can. Separate from describeConfig,
 *   /// which answers "are these settings usable" — a form has to disable a
 *   /// checkbox before there are any settings to judge.
 *   unavailableReason?: () => string|null,
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
  const licence = provider.licence;
  if (!licence || typeof licence !== "object" || Array.isArray(licence)) {
    throw new Error(
      `discovery provider "${key}": a licence { name, url, obligation } is required — a campaign can tick ` +
        `several sources at once, and a checkbox that does not say what it costs hides the obligation it takes on`,
    );
  }
  for (const field of REQUIRED_LICENCE_FIELDS) {
    if (typeof licence[field] !== "string" || !licence[field].trim()) {
      throw new Error(`discovery provider "${key}": licence.${field} must say something`);
    }
  }
  if (provider.unavailableReason !== undefined && typeof provider.unavailableReason !== "function") {
    throw new Error(`discovery provider "${key}": unavailableReason must be a function or absent`);
  }
  providers.set(key, provider);
  return provider;
}

/** The provider a campaign named, or null when nobody ships one by that name. */
export function getDiscoveryProvider(key) {
  return providers.get(key) || null;
}

/**
 * Every provider this build ships, for the campaign form.
 *
 * `unavailable` is resolved HERE rather than left to the screen. A form that
 * had to remember to call `unavailableReason()` itself is a form that renders
 * a tickable checkbox for a source that cannot run the day somebody adds a
 * third provider — a dead control, which AGENTS.md opens by forbidding.
 */
export function discoveryProviders() {
  return [...providers.values()].map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description || "",
    configFields: p.configFields || [],
    licence: p.licence,
    unavailable: typeof p.unavailableReason === "function" ? p.unavailableReason() || null : null,
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
