// lib/platform/costs/ledgerWrite.js
//
// The database half of PlatformCostDaily: the one upsert every provider's
// pull goes through, and the "when was this provider last fed" read the
// page prints as "last pulled". Separate from dailyLedger.js, which is pure
// and runs in the check scripts with no database.
import { db } from "@/lib/db";
import { dayDate } from "./dailyLedger";

/**
 * Write rows to the ledger. Upsert on the unique (day, provider, category)
 * — the same row pulled twice is replaced, never added to. `cents` may be
 * null: units known, price not (a Neon metric on an unpublished rate).
 * Returns how many were written.
 */
export async function writeDailyRows(rows, { client = db } = {}) {
  let written = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = dayDate(r.day);
    if (!day || !r.provider || !r.category) continue;
    const data = {
      cents: r.cents === undefined ? null : r.cents,
      currency: r.currency || "USD",
      units: r.units ?? null,
      unit: r.unit ?? null,
      count: r.count ?? null,
      source: r.source,
      fetchedAt: r.fetchedAt,
    };
    // eslint-disable-next-line no-await-in-loop
    await client.platformCostDaily.upsert({
      where: { day_provider_category: { day, provider: r.provider, category: r.category } },
      create: { day, provider: r.provider, category: r.category, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
}

/** When a provider's ledger was last fed. Null when never. */
export async function lastPullAt(provider, { client = db } = {}) {
  const row = await client.platformCostDaily.findFirst({
    where: { provider },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  return row?.fetchedAt || null;
}

/** Every provider's newest fetch in one query — { twilio: Date, openai: Date, … }. */
export async function lastPullsByProvider({ client = db } = {}) {
  const groups = await client.platformCostDaily.groupBy({ by: ["provider"], _max: { fetchedAt: true } });
  const out = {};
  for (const g of groups) out[g.provider] = g._max?.fetchedAt || null;
  return out;
}
