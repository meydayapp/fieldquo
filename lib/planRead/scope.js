// lib/planRead/scope.js
//
// What a drawing read is FOR — the services on its quote or request — read
// from the company's own records. The owner (2026-10-04): "the trade comes
// from the quote's selected service … if they are doing a roofing quote the
// AI should understand that the drawings are about the roof and not inside".
// So there is no trade picker: a read inherits the service of the lead it was
// started from or of the quote being built, and the screen offers the
// company's OWN switched-on services — the same list the quote builder
// offers — when neither said.
//
// Every key a browser sends is looked up against the company's enabled
// categories here; nothing is trusted (lib/planRead/tradeCatalogue.js
// sanitiseScope does the filtering).

import { db as realDb } from "@/lib/db";
import { CATEGORY_TRADES, sanitiseScope, TRADE_LABELS } from "./tradeCatalogue";

/**
 * The company's switched-on services, as scope options: { key, label, trade }
 * — `trade` null for a service the drawing read has no trade for (cleaning,
 * general contracting), which is shown but cannot steer a read.
 */
export async function loadScopeOptions(companyId, { prisma = realDb } = {}) {
  if (!companyId) return [];
  const rows = await prisma.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: { category: { select: { key: true, label: true } } },
  });
  return rows
    .map((r) => r.category)
    .filter((c) => c && typeof c.key === "string")
    .map((c) => {
      const hit = Object.hasOwn(CATEGORY_TRADES, c.key) ? CATEGORY_TRADES[c.key] : null;
      return { key: c.key, label: c.label || c.key, trade: hit?.trade || null, tradeLabel: hit ? TRADE_LABELS[hit.trade] : null, focus: hit?.focus || null };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Browser-sent category keys → a stored scope, or null. */
export async function resolveScope(keys, { companyId, from = "estimator", prisma = realDb } = {}) {
  const options = await loadScopeOptions(companyId, { prisma });
  return sanitiseScope(keys, { companyCategories: options, from });
}
