// lib/sales/discovery/trades.js
//
// Which trade a discovered business is in, and which FieldQuo quote types that
// trade corresponds to.
//
// ══ Why trade segmentation is a first-class column and not a filter ════════
//
// The owner's reasoning, recorded so nobody optimises it away: a rep who says
// the same script forty times gets better at it; one who switches trade every
// call never does. So a campaign targets a territory AND a trade, and the
// queue that comes out of it is single-trade. `Prospect.tradeKey` is the spine
// of that — it is what the queue is grouped by, not a tag added afterwards.
//
// ══ Why this is NOT the ServiceCategory key space ══════════════════════════
//
// The obvious move is to make `tradeKey` a lib/trades/catalog.js key. It does
// not survive contact with the first trade FieldQuo ever sold.
//
// A catalogue key is a QUOTE TYPE: `interior_painting` and `exterior_painting`
// are two of them. A painting contractor sells both. Overture has one
// `painting` category and it means the business, not the quote. Forcing the
// business into the quote key space would require choosing one — and the
// catalogue has already refused to make exactly that choice: neither painting
// category is marked `primary`, and primaryCategoryForInstantTrade()'s comment
// says outright that answering it by array order "would file every exterior job
// under Interior Painting while looking deliberate".
//
// So a discovery trade is a COARSER unit that names the catalogue keys it
// covers. That is the same shape `industries` already has in the catalogue: a
// grouping over catalogue keys, declared once. It is not a second key space
// that rots, because scripts/check-sales-discovery.mjs asserts every
// `categoryKeys` entry is a real catalogue key — a renamed or deleted trade
// fails the build rather than silently pointing at nothing.
//
// ══ Unmapped means null, never a guess ═════════════════════════════════════
//
// Overture ships 2,118 categories. This map covers the ones FieldQuo actually
// sells to. A category that is not here produces `tradeKey: null` and the row
// is counted as unmapped — it does NOT fall into the nearest-looking trade.
// A prospect filed under the wrong trade is worse than one filed under none:
// it lands in a single-trade queue and a rep opens a painting script on a
// locksmith.
// ══ A source category that does not exist matches ZERO rows, silently ══════
//
// This is the failure another agent hit the same day, on the same dataset:
// four hand-typed category keys did not exist in Overture's 2,118-row taxonomy
// and quietly matched nothing, which looks exactly like a category with no
// businesses in it. Nothing in the code can tell the two apart.
//
// So every `sourceCategories` entry below was READ OUT OF THE DATA, not typed
// from memory, and all 46 were re-verified present in a 278,879-row eastern
// North America extract of release 2026-08-19.0 on 2026-09-02. To re-verify
// after adding one:
//
//   duckdb -c "SELECT categories.primary, count(*) FROM read_parquet(
//     's3://overturemaps-us-west-2/release/<release>/theme=places/type=place/*.parquet')
//     WHERE bbox.xmin BETWEEN -95.5 AND -71.5 AND bbox.ymin BETWEEN 40 AND 57
//     GROUP BY 1 ORDER BY 2 DESC"
//
// scripts/check-sales-discovery.mjs holds the SHAPE of these keys, which
// catches a mistyped one that is not even a plausible category name. It cannot
// prove existence without the dataset, and it says so rather than implying it.
import { TRADE_CATALOG } from "@/lib/trades/catalog";

/**
 * The trades a campaign may target.
 *
 *   label            what the campaign form and the rep's queue call it
 *   categoryKeys     lib/trades/catalog.js keys this trade sells. Checked.
 *   sourceCategories provider category strings that mean this trade. Today
 *                    they are all Overture's; a second provider adds its own
 *                    strings here rather than a second map, because the thing
 *                    being declared is "what counts as a painter", which is a
 *                    product fact and not a provider fact.
 */
export const DISCOVERY_TRADES = {
  painting: {
    label: "Painting",
    categoryKeys: ["interior_painting", "exterior_painting"],
    sourceCategories: ["painting"],
  },
  cabinets: {
    label: "Cabinets",
    categoryKeys: ["cabinet_refinishing", "cabinet_refacing", "kitchen_design"],
    sourceCategories: ["cabinet_sales_service"],
  },
  flooring: {
    label: "Flooring",
    categoryKeys: ["flooring", "flooring_install", "stairs"],
    sourceCategories: ["flooring_contractors", "carpet_installation"],
  },
  countertops: {
    label: "Countertops",
    categoryKeys: ["countertop"],
    sourceCategories: ["countertop_installation"],
  },
  roofing: {
    label: "Roofing",
    categoryKeys: ["roofing_service"],
    sourceCategories: ["roofing"],
  },
  plumbing: {
    label: "Plumbing",
    categoryKeys: ["plumbing"],
    sourceCategories: ["plumbing"],
  },
  electrical: {
    label: "Electrical",
    categoryKeys: ["electrical"],
    sourceCategories: ["electrician"],
  },
  hvac: {
    label: "Heating and cooling",
    categoryKeys: ["hvac_install", "hvac_repair"],
    sourceCategories: ["hvac_services"],
  },
  landscaping: {
    label: "Landscaping",
    categoryKeys: ["landscaping_design", "lawn_care", "lawn_mowing"],
    // `gardener` and `landscape_architect` are deliberately absent. A garden
    // designer and a lawn-maintenance crew are not the same sales
    // conversation, and merging them is the trade-mixing this file exists to
    // prevent — a rep would open a lawn script on a landscape architect.
    sourceCategories: ["landscaping", "lawn_service"],
  },
  carpentry: {
    label: "Carpentry",
    categoryKeys: ["carpentry"],
    sourceCategories: ["carpenter"],
  },
  drywall: {
    label: "Drywall",
    categoryKeys: ["drywall", "drywall_install"],
    sourceCategories: ["drywall_services"],
  },
  tiling: {
    label: "Tiling",
    categoryKeys: ["tiling"],
    sourceCategories: ["tiling"],
  },
  siding: {
    label: "Siding",
    categoryKeys: ["siding"],
    sourceCategories: ["siding"],
  },
  gutters: {
    label: "Gutters",
    categoryKeys: ["gutter_services"],
    sourceCategories: ["gutter_service"],
  },
  fencing: {
    label: "Fencing",
    categoryKeys: ["fence_services", "fence_repair", "fence_restoration"],
    sourceCategories: ["fence_and_gate_sales_service"],
  },
  masonry_concrete: {
    label: "Masonry and concrete",
    categoryKeys: ["masonry", "concrete", "parging"],
    sourceCategories: ["masonry_concrete"],
  },
  paving: {
    label: "Paving",
    categoryKeys: ["paving", "driveway_sealing"],
    sourceCategories: ["paving_contractor"],
  },
  insulation: {
    label: "Insulation",
    categoryKeys: ["insulation"],
    sourceCategories: ["insulation_installation"],
  },
  restoration: {
    label: "Damage restoration",
    categoryKeys: ["restoration"],
    sourceCategories: ["damage_restoration", "fire_and_water_damage_restoration"],
  },
  chimney: {
    label: "Chimney",
    categoryKeys: ["chimney_sweep"],
    sourceCategories: ["chimney_sweep"],
  },
  pressure_washing: {
    label: "Pressure washing",
    categoryKeys: ["pressure_washing_house", "pressure_washing_driveway"],
    sourceCategories: ["pressure_washing"],
  },
  junk_removal: {
    label: "Junk removal",
    categoryKeys: ["junk_removal"],
    sourceCategories: ["junk_removal_and_hauling"],
  },
  house_cleaning: {
    label: "House cleaning",
    categoryKeys: ["residential_cleaning", "deep_cleaning"],
    sourceCategories: ["home_cleaning"],
  },
  carpet_cleaning: {
    label: "Carpet cleaning",
    categoryKeys: ["carpet_cleaning"],
    sourceCategories: ["carpet_cleaning"],
  },
  window_cleaning: {
    label: "Window cleaning",
    categoryKeys: ["window_cleaning"],
    sourceCategories: ["window_washing"],
  },
  handyman: {
    label: "Handyman",
    categoryKeys: ["handyman"],
    sourceCategories: ["handyman"],
  },
  excavation: {
    label: "Excavation",
    categoryKeys: ["excavation"],
    sourceCategories: ["excavation_service"],
  },
  demolition: {
    label: "Demolition",
    categoryKeys: ["demolition", "demolition_contractor"],
    sourceCategories: ["demolition_service"],
  },
  garage_door: {
    label: "Garage doors",
    categoryKeys: ["garage_door"],
    sourceCategories: ["garage_door_service"],
  },
  locksmith: {
    label: "Locksmith",
    categoryKeys: ["locksmith"],
    sourceCategories: ["key_and_locksmith"],
  },
  appliance_repair: {
    label: "Appliance repair",
    categoryKeys: ["appliance_repair"],
    sourceCategories: ["appliance_repair_service"],
  },
  pest_control: {
    label: "Pest control",
    categoryKeys: ["pest_control"],
    sourceCategories: ["pest_control_service"],
  },
  tree_care: {
    label: "Tree care",
    categoryKeys: ["tree_care_service"],
    sourceCategories: ["tree_services"],
  },
  pool_spa: {
    label: "Pools and spas",
    categoryKeys: ["pool_spa"],
    sourceCategories: ["pool_cleaning", "pool_and_hot_tub_services"],
  },
  irrigation: {
    label: "Irrigation",
    categoryKeys: ["irrigation"],
    sourceCategories: ["irrigation"],
  },
  snow_removal: {
    label: "Snow removal",
    categoryKeys: ["snow_removal"],
    sourceCategories: ["snow_removal_service"],
  },
  home_inspection: {
    label: "Home inspection",
    categoryKeys: ["home_inspection"],
    sourceCategories: ["home_inspector"],
  },
  remodeling: {
    label: "Remodelling",
    categoryKeys: ["remodeling", "general_contracting_reno"],
    sourceCategories: ["kitchen_remodeling", "bathroom_remodeling", "altering_and_remodeling_contractor"],
  },
  general_contracting: {
    label: "General contracting",
    // Overture's plain `contractor` is its largest home-service bucket and it
    // says only "a contractor". Mapped here rather than left unmapped because
    // "general contractor" is a real FieldQuo trade with its own script — but
    // it is the WIDEST trade in this file and a campaign targeting it should
    // expect the least homogeneous queue.
    categoryKeys: ["general_contracting", "construction"],
    sourceCategories: ["contractor", "building_contractor"],
  },
};

/** Trade keys, alphabetical — the order the campaign form lists them in. */
export function discoveryTradeKeys() {
  return Object.keys(DISCOVERY_TRADES).sort();
}

/** One trade's declaration, or null for a key this build does not ship. */
export function discoveryTrade(tradeKey) {
  return Object.prototype.hasOwnProperty.call(DISCOVERY_TRADES, tradeKey)
    ? DISCOVERY_TRADES[tradeKey]
    : null;
}

export function isDiscoveryTradeKey(tradeKey) {
  return Boolean(discoveryTrade(tradeKey));
}

/** What the campaign form and the rep's queue call this trade. */
export function discoveryTradeLabel(tradeKey) {
  return discoveryTrade(tradeKey)?.label || tradeKey || "";
}

/** The catalogue keys a trade sells, for a screen that wants to say so. */
export function categoryKeysForDiscoveryTrade(tradeKey) {
  return [...(discoveryTrade(tradeKey)?.categoryKeys || [])];
}

// Built once. The map is static, and rebuilding it per row would turn a
// discovery run's hottest loop into a full scan of every trade.
const BY_SOURCE_CATEGORY = (() => {
  const index = new Map();
  for (const [tradeKey, trade] of Object.entries(DISCOVERY_TRADES)) {
    for (const category of trade.sourceCategories) {
      // First declaration wins and a second is a mistake worth seeing rather
      // than a silent overwrite — the check asserts there are none.
      if (!index.has(category)) index.set(category, tradeKey);
    }
  }
  return index;
})();

/** Every provider category string this build maps, for the extractor's filter. */
export function mappedSourceCategories() {
  return [...BY_SOURCE_CATEGORY.keys()].sort();
}

/** Source categories claimed by more than one trade. Empty, and checked. */
export function duplicateSourceCategories() {
  const seen = new Map();
  const dupes = [];
  for (const [tradeKey, trade] of Object.entries(DISCOVERY_TRADES)) {
    for (const category of trade.sourceCategories) {
      if (seen.has(category)) dupes.push({ category, trades: [seen.get(category), tradeKey] });
      else seen.set(category, tradeKey);
    }
  }
  return dupes;
}

/** Catalogue keys named here that the catalogue does not ship. Empty, checked. */
export function unknownCategoryKeys() {
  const bad = [];
  for (const [tradeKey, trade] of Object.entries(DISCOVERY_TRADES)) {
    for (const key of trade.categoryKeys) {
      if (!Object.prototype.hasOwnProperty.call(TRADE_CATALOG, key)) {
        bad.push({ tradeKey, categoryKey: key });
      }
    }
  }
  return bad;
}

/**
 * The trade a source row belongs to, or null.
 *
 * The PRIMARY category decides. Alternates are read only when the primary maps
 * to nothing, and even then only when they agree with each other — two
 * alternates naming two different trades is a row whose trade is genuinely
 * unknown, and picking the first would be array order masquerading as a
 * decision (the same failure primaryCategoryForInstantTrade refuses).
 *
 * @param {{primary?: string|null, alternate?: string[]}} categories
 * @returns {{ tradeKey: string|null, via: "primary"|"alternate"|null }}
 */
export function tradeForCategories(categories = {}) {
  // `?.` rather than the default parameter alone: a default only fires for
  // `undefined`, and an explicit null is exactly what a malformed provider row
  // hands over. Caught by scripts/check-sales-discovery.mjs, which passes null
  // on purpose.
  const primary = typeof categories?.primary === "string" ? categories.primary.trim() : "";
  if (primary && BY_SOURCE_CATEGORY.has(primary)) {
    return { tradeKey: BY_SOURCE_CATEGORY.get(primary), via: "primary" };
  }

  const alternates = Array.isArray(categories?.alternate) ? categories.alternate : [];
  const found = new Set();
  for (const alternate of alternates) {
    if (typeof alternate !== "string") continue;
    const tradeKey = BY_SOURCE_CATEGORY.get(alternate.trim());
    if (tradeKey) found.add(tradeKey);
  }
  if (found.size === 1) return { tradeKey: [...found][0], via: "alternate" };

  return { tradeKey: null, via: null };
}
