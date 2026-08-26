// lib/trades/definition.js
//
// Everything known about one trade, from one call.
//
// ── Why this is separate from lib/trades/catalog.js ────────────────────────
//
// catalog.js is the DECLARATION and imports nothing, because `node
// prisma/seed.js` runs without the `@/` alias loader and a seeder that cannot
// import the catalogue is a catalogue with a second copy. This file is the
// JOIN, and it needs the app's modules — so it lives one door along.
//
// ── Why the joined facts are not re-declared in the catalogue ──────────────
//
// "Does this trade have a takeoff" already has exactly one home
// (lib/pricing/takeoffTrades.js), and it is guarded: check-takeoff-render
// asserts the list and the form components match, so a takeoff form added
// without a list entry fails the build. Copying that answer into the catalogue
// would give the question two homes and lose the guard on one of them — the
// copy-that-rots failure AGENTS.md names, one indirection further out. Same for
// the price book, the intake fields and the tickable add-ons.
//
// So the catalogue declares only what had NO home — a trade's industry and its
// instant estimator — and this file is where all six questions get one answer.
//
// ── Not the same thing as lib/pricing/offerings.js ─────────────────────────
//
// offerings.js answers "what can THIS COMPANY sell", with their overrides
// applied and their own Product rows folded in; it needs rows loaded from the
// database. This answers "what is this trade, in this build" and needs nothing.
// A settings screen deciding which cards to render wants this one; a model
// prompt deciding whether a caller asked for something real wants that one.

import {
  tradeKeys,
  tradeEntry,
  instantTradeForCategory,
} from "@/lib/trades/catalog";
import {
  hasPriceBook,
  priceBookBasis,
  priceBookComplexity,
} from "@/app/data/tradePriceBooks";
import { hasTakeoff } from "@/lib/pricing/takeoffTrades";
import { INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";
import { hasStandardAddOns } from "@/app/data/standardAddOns";
import { isTieredPackageCategory } from "@/app/data/tieredPackages";
import { ADD_ON_FLAGS } from "@/lib/pricing/offerings";

/**
 * One trade, joined. Null for a key this build doesn't ship — callers get to
 * decide whether that's an error, because a company's own custom quote type is
 * a real category with no catalogue entry and that is not a fault.
 *
 *   key, label, icon, sortOrder   the catalogue row
 *   industries                    slugs whose preset offers it
 *   instantTrade                  estimator key, or null
 *   hasPriceBook / priceBookBasis
 *   priceBookComplexity           what it charges by, and whether the rates
 *                                 move with a complexity picked on the quote
 *   hasTakeoff                    quoted from a structured takeoff form
 *   hasIntakeFields               ships a default intake question set
 *   hasStandardAddOns             ships seedable Products
 *   hasTieredPackages             priced from a menu of tiers
 *   addOnFlagKeys                 upgrades a scope group carries as a boolean
 */
export function tradeDefinition(categoryKey) {
  const entry = tradeEntry(categoryKey);
  if (!entry) return null;
  return {
    key: categoryKey,
    label: entry.label,
    icon: entry.icon,
    sortOrder: entry.sortOrder,
    industries: [...entry.industries],
    instantTrade: instantTradeForCategory(categoryKey),
    hasPriceBook: hasPriceBook(categoryKey),
    // What it charges by, and whether its rates move with a complexity picked
    // on the quote. Both read straight off the book — a trade quoted from a
    // supplier's invoice has no per-unit basis and reports none, which is the
    // truth about it rather than an empty-looking bug.
    priceBookBasis: priceBookBasis(categoryKey),
    priceBookComplexity: priceBookComplexity(categoryKey),
    hasTakeoff: hasTakeoff(categoryKey),
    hasIntakeFields: Object.prototype.hasOwnProperty.call(
      INTAKE_FIELDS,
      categoryKey,
    ),
    hasStandardAddOns: hasStandardAddOns(categoryKey),
    hasTieredPackages: isTieredPackageCategory(categoryKey),
    addOnFlagKeys: (Object.prototype.hasOwnProperty.call(
      ADD_ON_FLAGS,
      categoryKey,
    )
      ? ADD_ON_FLAGS[categoryKey]
      : []
    ).map((f) => f.key),
  };
}

/** The whole catalogue, joined, in render order. */
export function allTradeDefinitions() {
  return tradeKeys().map((key) => tradeDefinition(key));
}

/**
 * Trades this build can price but cannot ask about — a price book or an
 * estimator with no intake questions behind it.
 *
 * Exists because it is the shape of the bug that started this: a capability
 * wired on one screen and invisible on another. Reported by
 * scripts/check-trade-catalog.mjs rather than fixed silently, since the fix is
 * writing intake questions and that is content, not plumbing.
 */
export function tradesMissingIntake() {
  return tradeKeys().filter((key) => {
    const d = tradeDefinition(key);
    return (d.hasPriceBook || d.instantTrade) && !d.hasIntakeFields;
  });
}
