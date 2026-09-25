// lib/services/confirmServices.js
//
// "Confirm what you quote" — the set-up step for a company whose trade FieldQuo
// ships no service list for, or too short a one (lib/setupSteps.js). The owner,
// 2026-09-24: "based on everything we have i'm sure some [services] can be
// applied to multiple [industries] logically … if we don't have [services for
// their industry] we should ask to confirm which are the items they quote."
//
// This file decides WHAT is offered. It is pure — no database — so
// scripts/check-confirm-services.mjs can execute the resolver and the candidate
// builder against hostile input (an unknown trade, a custom quote type, keys
// the company already holds). The route (app/api/settings/products/confirm-services)
// reads the company and hands the answers in; the write goes through the same
// createSeededServices the signup seeder uses (lib/products/seedServices.js).
//
// ══ Where a candidate comes from, in order ═════════════════════════════════
//
//   1. the trade's OWN seed file (app/data/serviceSeeds/<trade>.js), and every
//      row another file tags for it — serviceSeedsForCompanyTrade, exactly
//      what signup installs, so a company whose seeding half-failed sees the
//      missing rows here too;
//   2. the NEAREST TRADES below — seeded trades whose services a company in
//      this trade plausibly quotes, and their tagged rows.
//
// Deduplicated by seedKey, first source wins, so a shared row (caulking lives
// once, in handyman's file) is offered once. Rows a seed keeps as a takeoff
// reference (`pricedBy`) are never offered: the rate card prices them, and a
// flat-priced copy would contradict it (lib/services/seeds.js#seedableServices).
//
// ══ Why an explicit table rather than the catalogue's `industries` ═════════
//
// lib/trades/catalog.js groups trades by MARKETING industry, which is too
// coarse to borrow services by: "construction-contracting" puts tiling beside
// excavation, and "handyman" puts locksmith beside garage doors. Offering an
// excavator a tile-grout row is the "padding absent data" failure (AGENTS.md
// class 5) wearing a helpful face. The table below is written trade by trade
// from what the neighbour's seed file actually holds (the HCP-industry
// grouping map of 2026-09-24 was the starting point), and says so where the
// honest answer is "nothing we have fits" — an empty list, and the reader adds
// their own. scripts/check-confirm-services.mjs fails if a catalogue trade
// without a seed file is missing from the table, if a neighbour is not a
// seeded trade, or if a trade names itself.

import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { serviceSeedsFor, serviceSeedsForCompanyTrade, seedableServices, seedText } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { QUOTE_COVERAGE_MIN } from "@/lib/setupSteps";

export { QUOTE_COVERAGE_MIN };

/**
 * Trade → the seeded trades whose services it borrows, nearest first.
 * Every catalogue trade WITHOUT its own seed file has an entry; a seeded trade
 * needs none (its own file is the list). Reasons beside the non-obvious ones.
 */
export const NEAREST_TRADES = {
  // ── Cabinets, counters, floors, stairs (the TrueFinish origin trades) ──
  // Rate cards price the core work; the neighbours supply the extras a
  // cabinet or stair job also sells (trim, hardware, touch-up painting).
  cabinet_refinishing: ["interior_painting", "carpentry"],
  cabinet_refacing: ["carpentry", "interior_painting"],
  countertop: ["carpentry", "general_contracting"],
  flooring: ["flooring_install"],
  stairs: ["carpentry", "flooring_install"],

  // ── Building and renovation ──
  drywall: ["general_contracting", "handyman", "interior_painting"],
  drywall_install: ["general_contracting", "handyman", "interior_painting"],
  demolition: ["general_contracting"],
  demolition_contractor: ["general_contracting"],
  construction: ["general_contracting", "carpentry"],
  general_contracting_reno: ["general_contracting", "carpentry"],
  remodeling: ["general_contracting", "carpentry"],
  kitchen_design: ["general_contracting", "carpentry"],
  tiling: ["flooring_install", "general_contracting"],
  // general_contracting's concrete & masonry and site-prep headings, and
  // deck_patio's slabs, pavers and steps.
  concrete: ["general_contracting", "deck_patio"],
  masonry: ["general_contracting", "deck_patio"],
  paving: ["deck_patio", "general_contracting"],
  excavation: ["general_contracting"],
  // Siding is exterior-envelope work: the painter's prep and trim rows, the
  // roofer's soffit/fascia rows, the GC's openings.
  siding: ["exterior_painting", "roofing_service", "general_contracting"],
  insulation: ["general_contracting", "roofing_service"],
  // Water / fire / mould: the rebuild half is general contracting; the
  // mitigation half has no seed, and the panel says "add your own".
  restoration: ["general_contracting", "handyman"],
  epoxy: ["flooring_install", "general_contracting"],
  parging: ["general_contracting", "exterior_painting"],
  driveway_sealing: ["deck_patio", "general_contracting"],
  doors_windows: ["handyman", "carpentry", "general_contracting"],
  glass: ["general_contracting", "handyman"],
  // Inspection companies quote the inspections the seeded trades carry
  // (roof inspection, HVAC diagnostics, plumbing camera work).
  home_inspection: ["roofing_service", "hvac_repair", "plumbing"],

  // ── Cleaning ──
  deep_cleaning: ["residential_cleaning"],
  commercial_cleaning: ["janitorial", "residential_cleaning"],
  furniture_upholstery: ["carpet_cleaning", "handyman"],
  home_organization: ["handyman", "residential_cleaning"],
  pressure_washing_house: ["window_cleaning", "exterior_painting", "deck_patio"],
  pressure_washing_driveway: ["window_cleaning", "deck_patio"],
  chimney_sweep: ["roofing_service", "air_duct_cleaning"],

  // ── Handyman family ──
  // The owner's own example: caulking is handyman work, and the exterior
  // painter's prep rows (caulk, seal, patch) are the rest of it.
  caulking_sealants: ["handyman", "exterior_painting"],
  property_maintenance: ["handyman", "lawn_care", "gutter_services"],
  installation_services: ["handyman", "appliance_repair"],
  locksmith: ["handyman", "garage_door"],
  baby_proofing: ["handyman"],
  moving: ["handyman"],
  junk_removal: ["handyman", "general_contracting"],

  // ── Mechanical, electrical, plumbing ──
  well_water: ["plumbing"],
  sewer_septic: ["plumbing"],
  mechanical_contracting: ["hvac_install", "hvac_repair", "plumbing"],
  lighting: ["electrical"],
  security_systems: ["electrical"],
  smart_home: ["electrical", "handyman"],
  solar_energy: ["electrical", "roofing_service"],
  // Pumps, heaters, lines — the plumbing half of pool work. The chemistry
  // and opening/closing visits have no seed anywhere.
  pool_spa: ["plumbing"],

  // ── Outdoors ──
  landscaping_design: ["lawn_care", "tree_care_service", "deck_patio"],
  lawn_mowing: ["lawn_care"],
  irrigation: ["lawn_care", "plumbing"],
  // lawn_care carries the one pest row a seed holds (grub/insect treatment).
  pest_control: ["lawn_care"],
  pooper_scooper: ["lawn_care"],
  fence_repair: ["fence_services"],
  fence_restoration: ["fence_services", "exterior_painting"],

  // ── Nothing we hold fits. An empty list is the honest answer: the panel
  // offers "Add my own service" and nothing borrowed. ──
  elevator_services: [],
  wildlife_control: [],
  auto_detailing: [],
  dog_walking: [],
  marine_services: [],
};

const isTradeKey = (v) => typeof v === "string" && /^[a-z0-9_]+$/.test(v);

/** True when the trade ships its own seed file. */
export function hasOwnSeed(trade) {
  return Boolean(serviceSeedsFor(trade));
}

/**
 * The seeded trades a trade borrows from, nearest first. Unknown keys, custom
 * quote types (custom_<cuid>) and garbage all answer [] — never a guess, and
 * never the trade itself.
 */
export function nearestTradesFor(trade) {
  if (!isTradeKey(trade) || !Object.hasOwn(NEAREST_TRADES, trade)) return [];
  return NEAREST_TRADES[trade].filter((t) => t !== trade && hasOwnSeed(t));
}

/** The file a seeded row lives in — "fq.<trade>.<category>.<slug>". */
export function fileTradeOf(seedKey) {
  const m = typeof seedKey === "string" ? /^fq\.([a-z0-9_]+)\./.exec(seedKey) : null;
  return m && Object.hasOwn(SERVICE_SEEDS, m[1]) ? m[1] : null;
}

/**
 * How well a trade's seeds cover it for one company.
 *   ownSeed    the trade has a seed file of its own
 *   installed  how many of the trade's seedable rows (own + tagged) the
 *              company actually holds, by seedKey — measured, not assumed:
 *              a signup whose seeding failed shows 0 here
 */
export function tradeCoverage(trade, heldSeedKeys = []) {
  const held = new Set((Array.isArray(heldSeedKeys) ? heldSeedKeys : []).filter((k) => typeof k === "string"));
  const seed = isTradeKey(trade) ? serviceSeedsForCompanyTrade(trade) : null;
  const installed = seedableServices(seed).filter((s) => held.has(s.seedKey)).length;
  return { key: trade, ownSeed: hasOwnSeed(trade), installed };
}

/**
 * Every candidate service for the given company trades, deduplicated.
 *
 * @returns [{ service, forTrade, fromTrade, via }] — `forTrade` is the
 *   company's trade the row is offered FOR (the quote type it will be linked
 *   to), `fromTrade` the seed file it lives in, `via` "own" | "shared" |
 *   "related".
 */
export function candidateServicesFor(tradeKeys = []) {
  const trades = [...new Set((Array.isArray(tradeKeys) ? tradeKeys : []).filter(isTradeKey))];
  const seen = new Set();
  const out = [];
  const push = (service, forTrade, via) => {
    if (!service?.seedKey || seen.has(service.seedKey) || service.pricedBy) return;
    const fromTrade = fileTradeOf(service.seedKey);
    if (!fromTrade) return;
    seen.add(service.seedKey);
    out.push({ service, forTrade, fromTrade, via });
  };
  // Every trade's own and shared rows before ANY borrowed row, so a service a
  // company's second trade sells outright is filed under that trade rather
  // than borrowed by the first.
  for (const trade of trades) {
    const seed = serviceSeedsForCompanyTrade(trade);
    for (const s of seed?.services || []) push(s, trade, fileTradeOf(s.seedKey) === trade ? "own" : "shared");
  }
  for (const trade of trades) {
    for (const near of nearestTradesFor(trade)) {
      const seed = serviceSeedsForCompanyTrade(near);
      for (const s of seed?.services || []) push(s, trade, "related");
    }
  }
  return out;
}

/** The trades that make the step apply: no seed file, or too few installed. */
export function thinTrades(coverage = []) {
  return (Array.isArray(coverage) ? coverage : []).filter(
    (c) => c && isTradeKey(c.key) && (c.ownSeed !== true || !(Number(c.installed) >= QUOTE_COVERAGE_MIN)),
  );
}

/** A seed file's category heading, in the language asked for, else English. */
export function seedCategoryName(fileTrade, categoryKey, language) {
  const cat = (SERVICE_SEEDS[fileTrade]?.categories || []).find((c) => c.key === categoryKey);
  const names = cat?.name && typeof cat.name === "object" ? cat.name : {};
  return names[language] || names.en || categoryKey || "";
}

/**
 * The company's seeded rows, folded by key — what candidateGroups and
 * planServiceChanges need to know about each key the company has ever held.
 *
 * @param rows [{ seedKey, active, addedForYou? }] — every Product row with a
 *             seedKey, active or not
 * @returns { active: Set, archived: Set, addedForYou: Set } — `archived` is a
 *          key held ONLY by inactive rows (a key with any active row is in
 *          the list); `addedForYou` a key whose active row is still the seed's
 *          own (lib/services/addedForYou.js)
 */
export function heldState(rows = []) {
  const active = new Set();
  const seen = new Set();
  const addedForYou = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.seedKey !== "string" || !r.seedKey) continue;
    seen.add(r.seedKey);
    if (r.active !== false) {
      active.add(r.seedKey);
      if (r.addedForYou === true) addedForYou.add(r.seedKey);
    }
  }
  const archived = new Set([...seen].filter((k) => !active.has(k)));
  return { active, archived, addedForYou };
}

/**
 * The panel's rows, grouped by the seed file's own category heading — what
 * the GET route returns. Text in the company's language (seedText: English
 * when the seed does not carry it, never machine-guessed), the price the row
 * WOULD be created with (the median converted by the same suggestedIn the
 * seeder uses; null = "set your rate"), and the row's standing:
 *
 *   held         in the company's list now — ticked; unticking removes it
 *   archived     removed earlier — listed unticked, "tick to add back"
 *   addedForYou  held AND still exactly what the seed wrote (the badge)
 *
 * `heldSeedKeys` is the ACTIVE keys; a caller that knows nothing of
 * archiving passes only that and gets the behaviour it always had.
 */
export function candidateGroups(
  candidates,
  { language = "en", currency = "CAD", heldSeedKeys = [], archivedSeedKeys = [], addedForYouKeys = [] } = {},
) {
  const keys = (v) => new Set((Array.isArray(v) ? v : v instanceof Set ? [...v] : []).filter((k) => typeof k === "string"));
  const held = keys(heldSeedKeys);
  const archived = keys(archivedSeedKeys);
  const mine = keys(addedForYouKeys);
  const groups = new Map();
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const key = `${c.fromTrade}.${c.service.category}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        fromTrade: c.fromTrade,
        forTrade: c.forTrade,
        via: c.via,
        name: seedCategoryName(c.fromTrade, c.service.category, language),
        services: [],
      });
    }
    const { name, description } = seedText(c.service, language);
    const k = c.service.seedKey;
    const isHeld = held.has(k);
    groups.get(key).services.push({
      seedKey: k,
      name,
      description,
      unit: c.service.unit || null,
      price: suggestedIn(c.service.benchmark?.median, currency),
      held: isHeld,
      archived: !isHeld && archived.has(k),
      addedForYou: isHeld && mine.has(k),
    });
  }
  return [...groups.values()];
}

/**
 * What a POST may create: the requested keys, checked against the candidate
 * set the SERVER built, split by the trade each will be linked to. Pure, so
 * the check can throw garbage at it.
 *
 * @returns { byTrade: Map<trade, service[]>, unknown: string[], requested }
 */
export function planConfirmedKeys(requestedKeys, candidates) {
  const wanted = [...new Set((Array.isArray(requestedKeys) ? requestedKeys : []).filter((k) => typeof k === "string" && k))];
  const byKey = new Map((Array.isArray(candidates) ? candidates : []).map((c) => [c.service.seedKey, c]));
  const byTrade = new Map();
  const unknown = [];
  for (const key of wanted) {
    const c = byKey.get(key);
    if (!c) {
      unknown.push(key);
      continue;
    }
    if (!byTrade.has(c.forTrade)) byTrade.set(c.forTrade, []);
    byTrade.get(c.forTrade).push(c.service);
  }
  return { byTrade, unknown, requested: wanted.length };
}

/**
 * Everything a POST may do, decided before anything is written.
 *
 *   add     keys to have in the list. A suggestion is CREATED (filed under
 *           the trade it was offered for, planConfirmedKeys above); a key the
 *           company removed earlier is RESTORED — the same row, with the
 *           price and template lines it had, never a second copy; a key
 *           already in the list is nothing to do. A key that is neither a
 *           candidate the server built nor one the company holds is unknown.
 *   remove  keys to take out of the list: ARCHIVED (Product.active = false,
 *           never deleted — lib/products/offered.js says who stops offering
 *           it). Only a key the company holds may be removed; any other — a
 *           seed it never had, a key only another company holds, garbage —
 *           is unknown. One unknown key refuses the whole request, the same
 *           rule the add half always had.
 *
 * A key in both lists is a contradiction the screen cannot produce; it is
 * refused rather than resolved in either direction.
 *
 * @param heldRows  every Product row of THIS company with a seedKey,
 *                  { seedKey, active } — the tenant boundary is the caller's
 *                  query, and this function never sees another company's rows
 * @returns { create: Map<trade, service[]>, restore: string[], archive: string[],
 *            unknown: string[], conflicting: string[], requested }
 */
export function planServiceChanges({ add = [], remove = [], candidates = [], heldRows = [] } = {}) {
  const clean = (v) => [...new Set((Array.isArray(v) ? v : []).filter((k) => typeof k === "string" && k))];
  const wantAdd = clean(add);
  const wantRemove = clean(remove);
  const { active, archived } = heldState(heldRows);
  const removeSet = new Set(wantRemove);
  const conflicting = wantAdd.filter((k) => removeSet.has(k));

  const restore = wantAdd.filter((k) => archived.has(k) && !removeSet.has(k));
  const toCreate = wantAdd.filter((k) => !active.has(k) && !archived.has(k) && !removeSet.has(k));
  const plan = planConfirmedKeys(toCreate, candidates);

  const archive = [];
  const unknown = [...plan.unknown];
  for (const k of wantRemove) {
    if (conflicting.includes(k)) continue;
    if (active.has(k)) archive.push(k);
    else if (!archived.has(k)) unknown.push(k);
    // Already removed (two tabs, one press): nothing to do, and not an error.
  }
  return {
    create: plan.byTrade,
    restore,
    archive,
    unknown,
    conflicting,
    requested: wantAdd.length + wantRemove.length,
  };
}
