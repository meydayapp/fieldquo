// lib/trades/catalog.js
//
// What a trade IS, once, for the whole product.
//
// ── The screen that made this necessary ─────────────────────────────────────
//
// A cabinet-refinishing and painting company opened three settings screens and
// got three different answers about what it sells:
//
//   Settings > Services         cabinet refinishing, refacing, countertop,
//                               flooring, stairs, interior + exterior painting
//   Settings > Instant Quotes   roofing, parging, lawn mowing, junk removal —
//                               and NOT cabinet refinishing
//   Settings > Products         every add-on filed under "Cabinet Refacing",
//                               including the handles a refinishing job sells
//
// The owner's words: "somehow the instant quote has roofing, which is not
// displayed in the services, so who does roofing?"
//
// Nothing was corrupt. Every screen was reading a different list. The instant-
// quote screen renders `INSTANT_ESTIMATE_TRADES` — every estimator FieldQuo has
// ever wired — with no relationship to the trades the company actually enabled,
// so a painter is offered a roofing rate card and, having been shown one,
// reasonably assumes he is meant to fill it in. (He did: six rows written in
// twenty seconds on 13/08, one card after another down the page.)
//
// ── The key spaces did not even agree ───────────────────────────────────────
//
// The catalogue key space is `ServiceCategory.key` — 68 rows, seeded below. The
// estimator key space is its own: `roofing` for `roofing_service`, `stair` for
// `stairs`, and one `painting` estimator serving BOTH `interior_painting` and
// `exterior_painting`. Two modules mapped between them and disagreed:
// CATEGORY_TO_TRADE (lib/estimate/callEstimate.js) had no entry for painting or
// stairs, and TRADE_CATEGORY_KEY (lib/estimate/instantQuoteServer.js) mapped
// `stair` to a category key called "stair" that has never existed — so an
// instant stair estimate filed its draft under no category at all.
//
// The bridge is declared here, once, and both directions are derived from it.
// TRADE_CATEGORY_KEY has since been corrected in place by the work adding
// cabinet refinishing to the estimator; scripts/check-trade-catalog.mjs asserts
// it and this map still agree, so the next hand-edit to either cannot drift.
//
// ── Why the label and icon live here too ────────────────────────────────────
//
// They used to live in prisma/seed.js. A trade's name and its industry are the
// same kind of fact and splitting them meant the seeder held half the answer,
// so both seeders now import this map instead of carrying their own array.
// That is also why this file imports NOTHING: `node prisma/seed.js` runs
// without the `@/` alias loader, and a dependency here would break the seed.
//
// Facts that already have exactly one home stay there and are joined onto a
// trade by lib/trades/definition.js — the price book (app/data/tradePriceBooks),
// the takeoff (lib/pricing/takeoffTrades), the intake fields
// (app/data/quoteIntakeFields), the tickable add-ons (lib/pricing/offerings).
// Restating them here would create the second copy that rots, which is the
// failure this file exists to end, one layer further out.
//
// ── Keyed map, not an array ─────────────────────────────────────────────────
//
// Same reason getPriceBook merges keys and REPLACES arrays: a company override
// or a partial edit against an array silently discards every entry it did not
// mention. Order is carried by `sortOrder`, which is what the UI already reads.

/**
 * Every quote type FieldQuo ships, keyed by ServiceCategory.key.
 *
 *   label        what the row is called; seeded into ServiceCategory.label
 *   icon         a lucide name curated by app/components/ServiceTiles.js — an
 *                unlisted name falls back to a generic box rather than erroring
 *   sortOrder    seeded; the order the settings list renders in
 *   industries   marketing industry slugs (app/data/industries.js) whose preset
 *                offers this trade. EMPTY means no industry surfaces it, so it
 *                is reachable only through "show other trades" — see
 *                categoriesWithoutIndustry() below, which is not a tidy list.
 *   instantTrade the INSTANT_ESTIMATE_TRADES key that can price this category
 *                instantly, or absent. Several categories may share one
 *                estimator; `primary: true` marks the one an instant draft
 *                files under.
 */
export const TRADE_CATALOG = {
  // ── Cabinets / TrueFinish origin categories ──
  cabinet_refinishing: {
    label: "Cabinet Refinishing",
    icon: "Paintbrush",
    sortOrder: 1,
    industries: ["painting"],
    instantTrade: "cabinet_refinishing",
    primary: true,
  },
  cabinet_refacing: {
    label: "Cabinet Refacing",
    icon: "Layers",
    sortOrder: 2,
    industries: ["painting"],
    instantTrade: "cabinet_refacing",
    primary: true,
  },
  countertop: {
    label: "Countertop Installation",
    icon: "Square",
    sortOrder: 3,
    industries: ["painting"],
    instantTrade: "countertop",
    primary: true,
  },
  flooring: {
    label: "Flooring",
    icon: "Grid2x2",
    sortOrder: 4,
    industries: ["painting"],
    instantTrade: "flooring",
    primary: true,
  },
  stairs: {
    label: "Stairs",
    icon: "MoveUp",
    sortOrder: 5,
    industries: ["painting"],
    instantTrade: "stair",
    primary: true,
  },
  // Interior and exterior painting share ONE estimator: `painting` asks for the
  // scope as a measurement and applies a surcharge, so a company enabling
  // either category has the trade covered. Neither is marked `primary`, which
  // means an instant painting estimate files under no category — deliberately.
  // Picking one would file every exterior job under Interior Painting, and
  // that is a product decision (see TRADE_CATEGORY_KEY in
  // lib/estimate/instantQuoteServer.js, which reaches the same conclusion).
  interior_painting: {
    label: "Interior Painting",
    icon: "PaintRoller",
    sortOrder: 6,
    industries: ["painting"],
    instantTrade: "painting",
  },
  exterior_painting: {
    label: "Exterior Painting",
    icon: "Home",
    sortOrder: 7,
    industries: ["painting"],
    instantTrade: "painting",
  },
  drywall: {
    label: "Drywall",
    icon: "PanelTop",
    sortOrder: 8,
    industries: ["construction-contracting"],
  },
  demolition: {
    label: "Demolition",
    icon: "Hammer",
    sortOrder: 9,
    industries: ["construction-contracting"],
  },
  general_contracting: {
    label: "General Contracting",
    icon: "HardHat",
    sortOrder: 10,
    industries: ["construction-contracting"],
  },
  construction: {
    label: "New Construction",
    icon: "Building2",
    sortOrder: 11,
    industries: ["construction-contracting"],
  },

  // ── Cleaning ──
  residential_cleaning: {
    label: "Residential Cleaning",
    icon: "Sparkles",
    sortOrder: 12,
    industries: ["cleaning"],
  },
  deep_cleaning: {
    label: "Deep Cleaning",
    icon: "Sparkles",
    sortOrder: 13,
    industries: ["cleaning"],
  },
  commercial_cleaning: {
    label: "Commercial Cleaning",
    icon: "Building",
    sortOrder: 14,
    industries: ["cleaning"],
  },
  janitorial: {
    label: "Janitorial Services",
    icon: "Building",
    sortOrder: 15,
    industries: ["cleaning"],
  },
  carpet_cleaning: {
    label: "Carpet Cleaning",
    icon: "Sparkles",
    sortOrder: 16,
    industries: ["cleaning"],
  },
  window_cleaning: {
    label: "Window Cleaning",
    icon: "Sparkles",
    sortOrder: 17,
    industries: ["cleaning"],
  },

  // ── Handyman / General ──
  handyman: {
    label: "Handyman Services",
    icon: "Wrench",
    sortOrder: 18,
    industries: ["handyman"],
  },
  general_contracting_reno: {
    label: "General Renovation",
    icon: "HardHat",
    sortOrder: 19,
    industries: ["construction-contracting"],
  },
  remodeling: {
    label: "Remodeling",
    icon: "HardHat",
    sortOrder: 20,
    industries: ["construction-contracting"],
  },
  carpentry: {
    label: "Carpentry",
    icon: "Hammer",
    sortOrder: 21,
    industries: ["construction-contracting"],
  },
  drywall_install: {
    label: "Drywall Installation",
    icon: "PanelTop",
    sortOrder: 22,
    industries: ["construction-contracting"],
  },
  tiling: {
    label: "Tiling",
    icon: "Grid2x2",
    sortOrder: 23,
    industries: ["construction-contracting"],
  },
  flooring_install: {
    label: "Flooring Installation",
    icon: "Grid2x2",
    sortOrder: 24,
    industries: ["construction-contracting"],
  },

  // ── Trades ──
  plumbing: {
    label: "Plumbing",
    icon: "Wrench",
    sortOrder: 25,
    industries: ["plumbing"],
  },
  electrical: {
    label: "Electrical",
    icon: "Zap",
    sortOrder: 26,
    industries: ["electrical"],
  },
  hvac_install: {
    label: "HVAC Installation",
    icon: "Wind",
    sortOrder: 27,
    industries: ["hvac"],
  },
  hvac_repair: {
    label: "HVAC Repair",
    icon: "Wind",
    sortOrder: 28,
    industries: ["hvac"],
  },
  appliance_repair: {
    label: "Appliance Repair",
    icon: "Wrench",
    sortOrder: 29,
    industries: ["handyman"],
  },
  locksmith: {
    label: "Locksmith Services",
    icon: "Lock",
    sortOrder: 30,
    industries: ["handyman"],
  },
  // Garage doors are sold by more than the handyman trade: a general
  // contractor or carpenter fits them on a reno, and the category carries a
  // real price book, so surfacing it under contracting too is the difference
  // between "quotable" and "type the total in yourself".
  garage_door: {
    label: "Garage Door Services",
    icon: "DoorClosed",
    sortOrder: 31,
    industries: ["construction-contracting", "handyman"],
  },
  elevator_services: {
    label: "Elevator Services",
    icon: "Building",
    sortOrder: 32,
    industries: [],
  },
  well_water: {
    label: "Well Water Services",
    icon: "Droplet",
    sortOrder: 33,
    industries: ["plumbing"],
  },
  mechanical_contracting: {
    label: "Mechanical Contracting",
    icon: "Wrench",
    sortOrder: 34,
    industries: [],
  },

  // ── Construction / Structural ──
  concrete: {
    label: "Concrete",
    icon: "Square",
    sortOrder: 35,
    industries: ["construction-contracting"],
  },
  masonry: {
    label: "Masonry",
    icon: "Square",
    sortOrder: 36,
    industries: ["construction-contracting"],
  },
  excavation: {
    label: "Excavation",
    icon: "Truck",
    sortOrder: 37,
    industries: ["construction-contracting"],
  },
  demolition_contractor: {
    label: "Demolition Contractor",
    icon: "Hammer",
    sortOrder: 38,
    industries: ["construction-contracting"],
  },
  // Paving belongs to landscaping as much as to construction: interlock,
  // patios and walkways are landscaping work as often as they are contracting
  // work. It was in no preset at all for a while, which meant a driveway
  // contractor signed up and found his own trade missing from his own list —
  // reachable only by knowing to press "show other trades".
  paving: {
    label: "Paving",
    icon: "Square",
    sortOrder: 39,
    industries: ["construction-contracting", "landscaping"],
  },
  fence_services: {
    label: "Fence Installation",
    icon: "Fence",
    sortOrder: 40,
    industries: [],
  },
  roofing_service: {
    label: "Roofing",
    icon: "Home",
    sortOrder: 41,
    industries: ["roofing"],
    instantTrade: "roofing",
    primary: true,
  },
  siding: {
    label: "Siding",
    icon: "Home",
    sortOrder: 42,
    industries: ["roofing"],
  },
  // Gutters hang off the roof and are sold by the same crews — and by
  // handymen, by window cleaners, and by a general contractor quoting a reno,
  // since they come off on a re-roof and go back on at the end. Four presets,
  // deliberately.
  gutter_services: {
    label: "Gutters & Eavestroughs",
    icon: "Home",
    sortOrder: 43,
    industries: ["cleaning", "construction-contracting", "handyman", "roofing"],
  },
  // Insulation belongs to more than the roofing trade. A garden suite or a
  // basement finish is framing, insulation and drywall in sequence, so a
  // general contractor who never opens "show other trades" would otherwise
  // have a quotable trade missing from his own list.
  insulation: {
    label: "Insulation",
    icon: "Layers",
    sortOrder: 44,
    industries: ["construction-contracting", "roofing"],
  },
  restoration: {
    label: "Restoration",
    icon: "Home",
    sortOrder: 45,
    industries: ["roofing"],
  },
  chimney_sweep: {
    label: "Chimney Sweep",
    icon: "Flame",
    sortOrder: 46,
    industries: [],
  },

  // ── Outdoor / Landscaping ──
  landscaping_design: {
    label: "Landscaping",
    icon: "Trees",
    sortOrder: 47,
    industries: ["landscaping"],
  },
  lawn_care: {
    label: "Lawn Care",
    icon: "Sprout",
    sortOrder: 48,
    industries: ["lawn-care"],
  },
  lawn_mowing: {
    label: "Lawn Mowing",
    icon: "Sprout",
    sortOrder: 49,
    industries: ["lawn-care"],
    instantTrade: "lawn_mowing",
    primary: true,
  },
  irrigation: {
    label: "Irrigation Services",
    icon: "Droplet",
    sortOrder: 50,
    industries: ["landscaping"],
  },
  tree_care_service: {
    label: "Tree Care",
    icon: "Trees",
    sortOrder: 51,
    industries: ["tree-care"],
  },
  snow_removal: {
    label: "Snow Removal",
    icon: "Snowflake",
    sortOrder: 52,
    industries: ["lawn-care"],
  },
  pest_control: {
    label: "Pest Control",
    icon: "Bug",
    sortOrder: 53,
    industries: ["landscaping"],
  },
  pool_spa: {
    label: "Pool & Spa Services",
    icon: "Waves",
    sortOrder: 54,
    industries: ["landscaping"],
  },
  junk_removal: {
    label: "Junk Removal",
    icon: "Trash2",
    sortOrder: 55,
    industries: [],
    instantTrade: "junk_removal",
    primary: true,
  },
  property_maintenance: {
    label: "Property Maintenance",
    icon: "Wrench",
    sortOrder: 56,
    industries: ["handyman"],
  },

  // ── Pressure Washing / Auto ──
  pressure_washing_house: {
    label: "House Pressure Washing",
    icon: "Droplet",
    sortOrder: 57,
    industries: ["pressure-washing"],
  },
  pressure_washing_driveway: {
    label: "Driveway/Walkway Washing",
    icon: "Droplet",
    sortOrder: 58,
    industries: ["pressure-washing"],
  },
  auto_detailing: {
    label: "Auto Detailing",
    icon: "Car",
    sortOrder: 59,
    industries: [],
  },

  // ── Pet services ──
  dog_walking: {
    label: "Dog Walking",
    icon: "PawPrint",
    sortOrder: 60,
    industries: [],
  },
  pooper_scooper: {
    label: "Pooper Scooper Service",
    icon: "PawPrint",
    sortOrder: 61,
    industries: [],
  },

  // ── Installation / misc ──
  installation_services: {
    label: "Installation Services",
    icon: "Package",
    sortOrder: 62,
    industries: ["handyman"],
  },
  // ── Coatings / concrete (added for the instant estimator) ──
  //
  // Both belong to no industry preset, and both are wired estimators — which is
  // half of what put roofing in front of a cabinet painter. An epoxy or parging
  // card is offered to every company on the instant-quote screen while no
  // industry a company can pick at signup ever surfaces the trade itself.
  // Giving them a slug is a product decision (epoxy is sold by painters, by
  // flooring installers and by concrete contractors, and picking for them
  // publishes an answer nobody chose), so the gap is reported by
  // scripts/check-trade-catalog.mjs rather than papered over here.
  epoxy: {
    label: "Epoxy & Concrete Coatings",
    icon: "Square",
    sortOrder: 63,
    industries: [],
    instantTrade: "epoxy",
    primary: true,
  },
  parging: {
    label: "Parging",
    icon: "Square",
    sortOrder: 64,
    industries: [],
    instantTrade: "parging",
    primary: true,
  },

  // Sealcoating is maintenance, not paving: it recoats a driveway that is
  // already there, is priced per square foot of surface rather than by depth
  // and tonnage, and is resold to the same client every two to four years.
  // Folding it into `paving` would have meant one rate card answering two
  // different questions.
  driveway_sealing: {
    label: "Driveway Sealing",
    icon: "Square",
    sortOrder: 65,
    industries: ["construction-contracting", "landscaping", "pressure-washing"],
  },

  // Home inspection is not a trade that BUILDS anything, which is why it fits
  // no existing category: it sells a visit and a report, priced from the
  // house's square footage rather than from a quantity of work. Folding it
  // into `general_contracting` would have meant one rate card answering both
  // "what does a reno cost" and "what does an inspection cost".
  //
  // Icon: "Home" because ServiceTiles.js curates its lucide imports by hand
  // (a deliberate bundle-size decision documented there) and the obvious
  // ClipboardCheck / Search is not in that map — an unlisted name falls back
  // to a generic Package box rather than erroring, which is worse than reusing
  // an accurate one.
  home_inspection: {
    label: "Home Inspection",
    icon: "Home",
    sortOrder: 66,
    industries: ["construction-contracting"],
  },

  // Fencing was seeded by a second file of its own (prisma/seed-fence-
  // categories.js) months after the main catalogue, which is how both entries
  // ended up with sortOrder values already taken and in no industry preset at
  // all. Both seeders read this map now, so the next trade cannot be added
  // half-way again.
  fence_repair: {
    label: "Fence Repair",
    icon: "Wrench",
    sortOrder: 67,
    industries: [],
  },
  fence_restoration: {
    label: "Fence Restoration",
    icon: "Sparkles",
    sortOrder: 68,
    industries: [],
  },
};

/* ── Reading the catalogue ─────────────────────────────────────────────────── */

const own = (key) =>
  key && Object.prototype.hasOwnProperty.call(TRADE_CATALOG, key)
    ? TRADE_CATALOG[key]
    : null;

/** One trade's declaration, or null for a key this build doesn't ship. */
export function tradeEntry(categoryKey) {
  return own(categoryKey);
}

/** Every catalogue key, in the order the settings list renders. */
export function tradeKeys() {
  return Object.keys(TRADE_CATALOG).sort(
    (a, b) =>
      TRADE_CATALOG[a].sortOrder - TRADE_CATALOG[b].sortOrder ||
      a.localeCompare(b),
  );
}

/**
 * The seeder's shape: what prisma/seed.js writes into ServiceCategory.
 *
 * Not `Object.entries(TRADE_CATALOG)` at the call site, because the seeder must
 * never write `industries` or `instantTrade` — they are code facts about a
 * trade, not tenant data, and a column holding a stale copy of one is exactly
 * the "written and never read" failure AGENTS.md lists first.
 */
export function seedRows() {
  return tradeKeys().map((key) => ({
    key,
    label: TRADE_CATALOG[key].label,
    icon: TRADE_CATALOG[key].icon,
    sortOrder: TRADE_CATALOG[key].sortOrder,
  }));
}

/** The catalogue name of a trade, or the raw key if this build doesn't ship it. */
export function categoryLabel(categoryKey) {
  return own(categoryKey)?.label || categoryKey;
}

/* ── Industry ⇄ trade ──────────────────────────────────────────────────────── */

/** The marketing industry slugs whose preset offers this trade. */
export function industriesForCategory(categoryKey) {
  return [...(own(categoryKey)?.industries || [])];
}

/**
 * Union of the trades the given industries sell, de-duplicated and in
 * catalogue order. Unknown slugs contribute nothing rather than throwing, so a
 * stale slug on a company row never breaks signup.
 */
export function categoryKeysForIndustries(industrySlugs = []) {
  const wanted = new Set(
    Array.isArray(industrySlugs) ? industrySlugs.filter(Boolean) : [],
  );
  if (!wanted.size) return [];
  return tradeKeys().filter((key) =>
    TRADE_CATALOG[key].industries.some((slug) => wanted.has(slug)),
  );
}

/**
 * Trades no industry preset surfaces.
 *
 * NOT a bug list and not padded into one. Some genuinely have no home among the
 * twelve marketing industries (dog walking, auto detailing, elevator servicing
 * — none of them is a contractor trade); others look like oversights (fencing,
 * junk removal) but picking a slug for them is a product decision about what
 * FieldQuo says it sells, not a data tidy-up. Naming them here beats each
 * reader rediscovering the gap, and beats inventing a membership that then
 * ships to signup as though somebody chose it.
 */
export function categoriesWithoutIndustry() {
  return tradeKeys().filter((key) => TRADE_CATALOG[key].industries.length === 0);
}

/* ── Instant estimator ⇄ trade ─────────────────────────────────────────────── */

/** The estimator key that can price this category instantly, or null. */
export function instantTradeForCategory(categoryKey) {
  return own(categoryKey)?.instantTrade || null;
}

/** Whether this category has an instant estimator wired at all. */
export function isInstantQuotable(categoryKey) {
  return Boolean(instantTradeForCategory(categoryKey));
}

/**
 * Every category an estimator prices. Plural because one `painting` estimator
 * serves interior AND exterior painting — it asks for the scope as a
 * measurement — and a company enabling either one has the trade covered.
 */
export function categoryKeysForInstantTrade(trade) {
  if (!trade) return [];
  return tradeKeys().filter((key) => TRADE_CATALOG[key].instantTrade === trade);
}

/**
 * The category an instant estimate files its draft under.
 *
 * This is the lookup that went wrong: instantQuoteServer.js mapped `stair` to a
 * category key "stair", which no seed has ever created, so
 * `findUnique({ key })` returned null and every instant stair estimate filed a
 * draft with no scope group. Declared once here, and
 * scripts/check-trade-catalog.mjs asserts the estimator's own map matches.
 */
export function primaryCategoryForInstantTrade(trade) {
  if (!trade) return null;
  // No fallback to "the first one". An estimator shared by two categories with
  // neither marked is an OPEN product question (which category does an instant
  // painting estimate belong to?), and answering it by array order would file
  // every exterior job under Interior Painting while looking deliberate.
  return categoryKeysForInstantTrade(trade).find((k) => TRADE_CATALOG[k].primary) || null;
}

/** Every estimator key the catalogue claims a category for. */
export function instantTrades() {
  const seen = new Set();
  for (const key of tradeKeys()) {
    const trade = TRADE_CATALOG[key].instantTrade;
    if (trade) seen.add(trade);
  }
  return [...seen];
}

/* ── Where a company's two lists disagree ──────────────────────────────────── */
//
// Reporting, never repair. The owner has roofing switched on; that is his row
// and his decision, and a migration that quietly switched it off on his behalf
// would be this codebase's own "destructive operation labelled as cosmetic".
// So this returns findings for a screen to show, and the only thing that ever
// changes a row is him clicking something.
//
// Two directions, and they are NOT symmetrical:
//
//   instantWithoutService   an instant quote is live for a trade the company
//                           does not list as a service. A homeowner can be
//                           quoted for work nobody here sells, so this is the
//                           one that can cost money.
//
//   serviceWithoutInstant   a service is sold, an estimator exists for it, and
//                           the company has never once opened that card. A
//                           missed instant quote, not a wrong one.
//
// The second deliberately ignores a trade whose row exists and is OFF. That is
// a decision already taken — this company saved `stair`, `epoxy` and
// `flooring` disabled — and flagging it would be telling a contractor he is
// wrong about his own business every time he loads the page.

/**
 * @param enabledCategoryKeys  ServiceCategory keys with CompanyServiceCategory
 *                             .enabled true. Keys, not rows: the caller has
 *                             already joined, and this stays pure.
 * @param instantRows          the company's InstantQuoteConfig rows, as they
 *                             are: [{ trade, enabled }]. A trade with no row
 *                             has never been considered, which is the state the
 *                             second finding is about — so an absent row and a
 *                             disabled row must stay distinguishable here.
 * @param wiredTrades          estimator keys this build actually ships
 *                             (INSTANT_ESTIMATE_TRADES). Passed in rather than
 *                             imported so this file keeps no dependencies and a
 *                             check can hand it a fixture.
 */
export function catalogueMismatches({
  enabledCategoryKeys = [],
  instantRows = [],
  wiredTrades = null,
} = {}) {
  const enabled = new Set(
    (Array.isArray(enabledCategoryKeys) ? enabledCategoryKeys : []).filter(Boolean),
  );
  const rows = Array.isArray(instantRows) ? instantRows : [];
  const wired = wiredTrades ? new Set(wiredTrades) : null;
  const shipped = (trade) => (wired ? wired.has(trade) : true);

  const rowFor = new Map();
  for (const r of rows) if (r && r.trade) rowFor.set(r.trade, r);

  const instantWithoutService = [];
  for (const [trade, row] of rowFor) {
    if (!row.enabled) continue;
    const keys = categoryKeysForInstantTrade(trade);
    // An estimator with no catalogue category at all is a build problem, not a
    // company one — check-trade-catalog fails on it. Don't tell a contractor
    // his data is wrong because ours is.
    if (!keys.length) continue;
    if (keys.some((k) => enabled.has(k))) continue;
    instantWithoutService.push({
      trade,
      categoryKeys: keys,
      // The catalogue name, so the screen can say "Roofing, which isn't one of
      // your services" using the same word the services screen uses.
      categoryLabels: keys.map(categoryLabel),
    });
  }

  const serviceWithoutInstant = [];
  const claimed = new Set();
  for (const key of tradeKeys()) {
    if (!enabled.has(key)) continue;
    const trade = TRADE_CATALOG[key].instantTrade;
    if (!trade || !shipped(trade)) continue;
    if (rowFor.has(trade)) continue; // considered already — on or deliberately off
    if (claimed.has(trade)) {
      // Interior and exterior painting are one estimator. One finding.
      const hit = serviceWithoutInstant.find((f) => f.trade === trade);
      hit.categoryKeys.push(key);
      hit.categoryLabels.push(categoryLabel(key));
      continue;
    }
    claimed.add(trade);
    serviceWithoutInstant.push({
      trade,
      categoryKeys: [key],
      categoryLabels: [categoryLabel(key)],
    });
  }

  return { instantWithoutService, serviceWithoutInstant };
}
