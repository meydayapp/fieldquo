// lib/sales/intel/enrichmentSweep.js
//
// The free enrichment passes that ride the per-minute sales cron, and the
// status line /platform/sales/prospects prints for them.
//
// ══ Where this came from ══════════════════════════════════════════════════
//
// These two functions lived in lib/sales/intel/placesSweep.js beside the
// Google Places sweep. That sweep was retired on 2026-09-20 — the owner's
// rule of 2026-09-18 is that Google data is read from his Mac by
// scripts/scrape/maps.mjs, "API keys never involved", and the API had by
// then been refused 9,181 times in a row (see lib/sales/intel/places.js's
// header). The register lookup was never a Google call: it is a table read
// per row against the CSLB personnel file already loaded, no vendor, no
// money. It kept running and it keeps running; only its file changed,
// because a file named after a retired job is where the next agent looks
// LAST for a live one.
//
// ══ The order, shared ═════════════════════════════════════════════════════
//
// lib/sales/intel/enrichmentOrder.js is the one statement of the order:
// the held rows, per rep, in queue order, then the trades being worked in
// dispatch order, "just ahead of the reps". The register lookup walks both
// tiers at REGISTER_PER_TICK a tick; nothing here is metered because
// nothing here costs anything.
import { db as defaultDb } from "@/lib/db";
import { ENRICHMENT_TIERS, loadEnrichmentOrder } from "./enrichmentOrder";
import { PRINCIPAL_RECHECK_DAYS, lookupRegisterPeopleFor } from "./registerPeople";

/** Register lookups per tick: a table read each, no vendor, no money. */
export const REGISTER_PER_TICK = 100;

/**
 * The register personnel lookup, one tick: every row in the order (both
 * tiers) not checked in PRINCIPAL_RECHECK_DAYS, up to REGISTER_PER_TICK.
 * No per-rep cap applies — there is no spend to cap — so the tick's size
 * is the only bound.
 */
export async function sweepRegisterPeople({ db = defaultDb, now = new Date(), perTick = REGISTER_PER_TICK } = {}) {
  const since = new Date(now.getTime() - PRINCIPAL_RECHECK_DAYS * 24 * 60 * 60 * 1000);
  const order = await loadEnrichmentOrder({ db, now, stampField: "principalCheckedAt", since });
  const ids = order.rows.filter((r) => !r.done).slice(0, perTick).map((r) => r.id);
  if (!ids.length) return { asked: 0, checked: 0, found: 0, added: 0, remaining: 0 };
  const report = await lookupRegisterPeopleFor({ db, ids, now });
  return { asked: report.asked, checked: report.checked, found: report.found, added: report.added, errors: report.errors, remaining: order.rows.filter((r) => !r.done).length - ids.length };
}

/**
 * Where each source stands against the dispatcher, for
 * /platform/sales/prospects: per trade being worked, how many rows at the
 * head of its dispatch order each source has already done, and the row it
 * will do next.
 *
 * Three sources. `people` and `bbb` are passes this codebase runs. `maps`
 * is NOT a pass — it is the rows that carry a Google listing verdict
 * (`placesCheckedAt`), which the Maps scrape's matcher stamps when a
 * listing read on the owner's Mac matches (lib/sales/intel/listings.js;
 * 64 older rows were stamped by the API before it was blocked). It is
 * reported so the console can say how much of the head of the order has a
 * listing; nothing here schedules one, because nothing in production can.
 * `since` for it is null: a listing matched a year ago is still matched.
 */
export async function enrichmentSweepStatus({ db = defaultDb, now = new Date() } = {}) {
  const peopleSince = new Date(now.getTime() - PRINCIPAL_RECHECK_DAYS * 24 * 60 * 60 * 1000);
  const [maps, people, bbb] = await Promise.all([
    loadEnrichmentOrder({ db, now, stampField: "placesCheckedAt", since: null }),
    loadEnrichmentOrder({ db, now, stampField: "principalCheckedAt", since: peopleSince }),
    loadEnrichmentOrder({ db, now, stampField: "bbbCheckedAt", since: peopleSince }),
  ]);
  const byTrade = new Map();
  const fold = (source, order) => {
    for (const t of order.trades) {
      const row = byTrade.get(t.tradeKey) || { tradeKey: t.tradeKey, claims: t.claims, lastWorkedAt: t.lastWorkedAt, total: t.total, sources: {} };
      row.sources[source] = { ahead: t.ahead, total: t.total, nextId: t.nextId };
      byTrade.set(t.tradeKey, row);
    }
  };
  fold("maps", maps);
  fold("people", people);
  fold("bbb", bbb);
  return {
    claimed: { total: people.claimed.total, maps: maps.claimed.done, people: people.claimed.done, bbb: bbb.claimed.done },
    trades: [...byTrade.values()].sort((a, b) => new Date(b.lastWorkedAt || 0) - new Date(a.lastWorkedAt || 0)),
    tiers: ENRICHMENT_TIERS,
  };
}
