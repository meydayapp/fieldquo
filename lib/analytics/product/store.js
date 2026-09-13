// lib/analytics/product/store.js
//
// The two writers: a batch of hits, and a day's compaction. Every function
// takes the Prisma client as an argument so scripts/check-product-analytics.mjs
// can hand in a stub and read back exactly what would have been written.
//
// ══ One transaction per beacon ═════════════════════════════════════════════
//
// recordRows() writes the raw rows with one createMany and the daily
// increments with one upsert per key, all inside $transaction. A beacon is
// one page view plus whatever that page produced, so the key count is small
// (a view, maybe a referrer row, maybe a search); the point of the
// transaction is not speed but agreement — a daily count that moved while
// the raw insert failed is a number no later compaction can reconcile.
//
// ══ Availability ═══════════════════════════════════════════════════════════
//
// `analyticsAvailable()` is the same shape lib/sales/signupProgress.js uses:
// the tables are additive and pushed with `prisma db push`, and the day the
// code deploys before the push, every writer must fail soft. A missing table
// costs a page view, not a page.

import { rollup, compactionPlan, retentionCutoff, addUtcDays } from "./rollup";

/** True when the client has both delegates — the schema has been pushed. */
export function analyticsAvailable(client) {
  return Boolean(
    client?.analyticsEvent && typeof client.analyticsEvent.createMany === "function" &&
      client?.analyticsDaily && typeof client.analyticsDaily.upsert === "function",
  );
}

/**
 * Write a batch of row-shaped hits. `rows` are already sanitised (events.js)
 * and already carry their context (companyId, memberId, repId, visitorId,
 * isDemo). Returns the number of raw rows written.
 */
export async function recordRows(client, rows, now = new Date()) {
  if (!analyticsAvailable(client) || !Array.isArray(rows) || rows.length === 0) return 0;
  const stamped = rows.map((r) => ({ ...r, createdAt: r.createdAt || now }));
  const daily = rollup(stamped);

  const ops = [
    client.analyticsEvent.createMany({
      data: stamped.map((r) => ({
        createdAt: r.createdAt,
        event: r.event,
        surface: r.surface,
        path: r.path,
        language: r.language || "",
        visitorId: r.visitorId || null,
        companyId: r.companyId || null,
        memberId: r.memberId || null,
        repId: r.repId || null,
        isDemo: Boolean(r.isDemo),
        referrerHost: r.referrerHost || null,
        utmSource: r.utmSource || null,
        utmMedium: r.utmMedium || null,
        utmCampaign: r.utmCampaign || null,
        viewport: r.viewport || null,
        meta: r.meta ?? undefined,
      })),
    }),
    ...[...daily.values()].map((d) =>
      client.analyticsDaily.upsert({
        where: { key: d.key },
        create: {
          key: d.key,
          date: d.date,
          surface: d.surface,
          event: d.event,
          path: d.path,
          language: d.language || "",
          companyId: d.companyId || null,
          isDemo: Boolean(d.isDemo),
          count: d.count,
        },
        update: { count: { increment: d.count } },
      }),
    ),
  ];
  await client.$transaction(ops);
  return stamped.length;
}

/**
 * Compact every UTC day older than the retention window, oldest first, up to
 * `maxDays` in one run (the nightly cron normally finds exactly one).
 *
 * Per day: read the raw rows, write distinct visitors onto the daily rows,
 * delete the day's raw rows. The delete is the last statement and is scoped
 * to the exact createdAt range the plan aggregated — see rollup.js for why
 * that scoping is the whole safety argument.
 *
 * @returns {{ days: [{ day, rowsRead, dailyWritten, deleted }], cutoff }}
 */
export async function compactOlderThan(client, { now = new Date(), maxDays = 10 } = {}) {
  const cutoff = retentionCutoff(now);
  const out = { cutoff, days: [] };
  if (!analyticsAvailable(client)) return out;

  for (let i = 0; i < maxDays; i += 1) {
    const oldest = await client.analyticsEvent.findFirst({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (!oldest) break;

    const day = new Date(Date.UTC(
      oldest.createdAt.getUTCFullYear(), oldest.createdAt.getUTCMonth(), oldest.createdAt.getUTCDate(),
    ));
    const end = addUtcDays(day, 1);
    const rows = await client.analyticsEvent.findMany({
      where: { createdAt: { gte: day, lt: end } },
      select: {
        id: true, createdAt: true, event: true, surface: true, path: true, language: true,
        visitorId: true, companyId: true, isDemo: true,
      },
    });
    const plan = compactionPlan(day, rows);

    const writes = plan.writes.map((w) =>
      client.analyticsDaily.upsert({
        where: { key: w.key },
        create: {
          key: w.key,
          date: w.fields.date,
          surface: w.fields.surface,
          event: w.fields.event,
          path: w.fields.path,
          language: w.fields.language || "",
          companyId: w.fields.companyId || null,
          isDemo: Boolean(w.fields.isDemo),
          count: w.countIfMissing,
          uniqueVisitors: w.uniqueVisitors,
        },
        update: { uniqueVisitors: w.uniqueVisitors },
      }),
    );
    // The one deletion. Same range the rows above were read from, nothing
    // else, and only after the daily rows carry what those rows knew.
    const deletion = client.analyticsEvent.deleteMany({
      where: { createdAt: { gte: plan.deleteWhere.createdAt.gte, lt: plan.deleteWhere.createdAt.lt } },
    });
    const results = await client.$transaction([...writes, deletion]);
    const deleted = results[results.length - 1]?.count ?? 0;
    out.days.push({ day, rowsRead: plan.rowsRead, dailyWritten: writes.length, deleted });
  }
  return out;
}
