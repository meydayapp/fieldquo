// lib/ai/deepReadView.js
//
// What a stored deep read looks like to the screen that shows it: the pass
// as it was paid for, plus two things computed NOW against the document's
// current scope groups —
//
//   check.mismatch   do the photos look like this document's trade at all
//   check.measured   each photo estimate beside the figure the document
//                    already measured, the measured one kept as it is
//
// — and the names of every trade mentioned, in each language the catalogue
// row carries, so the panel can say "Roofing" in the reader's language rather
// than print `roofing_service`.
//
// One helper for the quote's route, the invoice's route and the estimate-
// review queue, so the three can never disagree about whether the same
// photos match the same quote. The rules themselves are pure and live in
// lib/ai/deepReadEvidence.js; this file only adds the one database read.

import { db } from "@/lib/db";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { deepReadMismatch, measuredBeside, tradeKeysOf } from "./deepReadEvidence";

/** Every catalogue key a set of passes and a document mention. */
function keysMentioned(passes, documentTrades) {
  const keys = new Set(documentTrades);
  for (const p of passes) {
    for (const ph of Array.isArray(p?.photos) ? p.photos : []) {
      for (const k of Array.isArray(ph?.trades) ? ph.trades : []) if (TRADE_CATALOG[k]) keys.add(k);
    }
  }
  return [...keys];
}

/**
 * The trade names, from the system ServiceCategory rows (the same rows the
 * services screen reads, translations and all). The catalogue's English
 * label is the fallback for a key whose row is missing — never the raw key.
 */
export async function tradeNamesFor(keys) {
  const out = {};
  for (const k of keys) out[k] = { label: TRADE_CATALOG[k]?.label || k, labelTranslations: null };
  if (!keys.length) return out;
  try {
    const rows = await db.serviceCategory.findMany({
      where: { key: { in: keys }, companyId: null },
      select: { key: true, label: true, labelTranslations: true },
    });
    for (const r of rows) {
      out[r.key] = {
        label: r.label || out[r.key]?.label,
        labelTranslations: r.labelTranslations && typeof r.labelTranslations === "object" ? r.labelTranslations : null,
      };
    }
  } catch {
    // Names are a nicety on top of a read the company already paid for; a
    // failed lookup falls back to the catalogue's English, not to an error.
  }
  return out;
}

/** Pure: passes + the document's scope groups → passes with `check` attached. */
export function withChecks(passes, scopeGroups) {
  const documentTrades = tradeKeysOf(scopeGroups);
  return (Array.isArray(passes) ? passes : []).map((p) => ({
    ...p,
    check: {
      mismatch: deepReadMismatch({ photos: p?.photos, documentTrades }),
      measured: measuredBeside({ evidence: p?.evidence, scopeGroups }),
    },
  }));
}

/**
 * @param passes       the stored Quote/Invoice.aiVisionPasses array
 * @param scopeGroups  the document's scope groups with `category.key`,
 *                     `takeoff` and `intakeValues` — an invoice passes its
 *                     source quote's, or [] when it has none
 */
export async function deepReadView(passes, scopeGroups) {
  const viewed = withChecks(passes, scopeGroups);
  const tradeNames = await tradeNamesFor(keysMentioned(viewed, tradeKeysOf(scopeGroups)));
  return { passes: viewed, tradeNames };
}

/** The select a route adds to read the scope groups this view needs. */
export const DEEP_READ_SCOPE_SELECT = {
  orderBy: { sortOrder: "asc" },
  select: { takeoff: true, intakeValues: true, category: { select: { key: true } } },
};
