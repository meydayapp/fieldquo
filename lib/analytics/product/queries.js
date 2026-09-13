// lib/analytics/product/queries.js
//
// What /platform/analytics and the sales card READ. Server-only (Prisma).
// Every number here comes from AnalyticsDaily; AnalyticsEvent is touched for
// exactly two things a count cannot answer — distinct visitors inside the
// retention window, and where a signup visitor stopped — and both are one
// GROUP BY each, never a row scan into JavaScript.
//
// ══ Two windows, one answer ════════════════════════════════════════════════
//
// Days older than RAW_RETENTION_DAYS have `uniqueVisitors` on their daily
// rows (compaction wrote it). Days inside the window do not, so
// rawUniques() fills them from the raw table and the two are merged before
// aggregate.js sees anything. A 90-day range therefore reads 60 compacted
// days plus 30 live ones and the console cannot tell — which is the point.
//
// ══ Client-facing conversions come from the product's own tables ═══════════
//
// "Quote approval page: 40 views, 6 approved" — the 6 is Quote.acceptedAt in
// the range, not a beacon. The writers already record the outcome (the
// public approval route stamps acceptedAt; finalizeBooking creates the
// Booking row; recordStripePayment writes the Payment); counting those rows
// is the honest conversion, and a second beacon saying "approved" would be a
// number that could disagree with the invoice.

import { db } from "@/lib/db";
import { RAW_RETENTION_DAYS, utcDay, addUtcDays } from "./rollup";
import { SIGNUP_FUNNEL } from "./events";

export const RANGES = Object.freeze([7, 30, 90]);

export function rangeFor(days, now = new Date()) {
  const n = RANGES.includes(Number(days)) ? Number(days) : 30;
  const end = addUtcDays(utcDay(now), 1); // exclusive: through today
  const start = addUtcDays(end, -n);
  return { days: n, start, end };
}

/** Every daily row in [start, end), optionally one surface or one company. */
export async function dailyRows({ start, end, surface = null, companyId = null } = {}) {
  return db.analyticsDaily.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(surface ? { surface } : {}),
      ...(companyId ? { companyId } : {}),
    },
    select: {
      date: true, surface: true, event: true, path: true, language: true,
      companyId: true, isDemo: true, count: true, uniqueVisitors: true,
    },
  });
}

/**
 * Distinct visitors per (day, surface, event, path, language, companyId,
 * isDemo) from the raw rows still inside the retention window — the same
 * key the daily table uses, so the merge below is exact.
 */
export async function rawUniques({ start, end } = {}) {
  const cutoff = addUtcDays(utcDay(new Date()), -RAW_RETENTION_DAYS);
  const from = start > cutoff ? start : cutoff;
  if (from >= end) return [];
  const rows = await db.$queryRaw`
    SELECT date_trunc('day', "createdAt") AS day, surface, event, path, language,
           "companyId", "isDemo", COUNT(DISTINCT "visitorId")::int AS uniques
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${end} AND "visitorId" IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5, 6, 7`;
  return rows.map((r) => ({
    date: utcDay(r.day), surface: r.surface, event: r.event, path: r.path, language: r.language,
    companyId: r.companyId, isDemo: r.isDemo, uniqueVisitors: Number(r.uniques) || 0,
  }));
}

const keyOf = (r) =>
  [utcDay(r.date).toISOString().slice(0, 10), r.surface, r.event, r.path, r.language || "", r.companyId || "", r.isDemo ? 1 : 0].join("|");

/** Daily rows with the live window's uniques written in. Compacted rows keep theirs. */
export function mergeUniques(daily, uniques) {
  const byKey = new Map(uniques.map((u) => [keyOf(u), u.uniqueVisitors]));
  return daily.map((r) => (Number.isInteger(r.uniqueVisitors) ? r : { ...r, uniqueVisitors: byKey.get(keyOf(r)) ?? null }));
}

/**
 * The signup funnel's visitor counts: distinct visitors per step inside the
 * raw window, plus where each visitor's LAST step was. Outside the raw
 * window only counts exist (the daily table), and the caller says so.
 */
export async function signupVisitors({ start, end } = {}) {
  const cutoff = addUtcDays(utcDay(new Date()), -RAW_RETENTION_DAYS);
  const from = start > cutoff ? start : cutoff;
  if (from >= end) return null;
  const rows = await db.$queryRaw`
    SELECT "visitorId",
           MAX(CASE WHEN event = 'page_view' AND path = '/signup' THEN 1 ELSE 0 END)::int AS visited,
           MAX(CASE WHEN event = 'signup_step' AND path = 'account' THEN 1 ELSE 0 END)::int AS account,
           MAX(CASE WHEN event = 'signup_step' AND path = 'trades' THEN 1 ELSE 0 END)::int AS trades,
           MAX(CASE WHEN event = 'signup_step' AND path = 'services' THEN 1 ELSE 0 END)::int AS services,
           MAX(CASE WHEN event = 'signup_step' AND path = 'plan' THEN 1 ELSE 0 END)::int AS plan,
           MAX(CASE WHEN event = 'checkout_started' THEN 1 ELSE 0 END)::int AS checkout_started
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${end}
      AND "visitorId" IS NOT NULL AND "isDemo" = false
      AND ((event = 'page_view' AND path = '/signup') OR event = 'signup_step' OR event = 'checkout_started')
    GROUP BY "visitorId"`;
  const counts = Object.fromEntries(SIGNUP_FUNNEL.map((k) => [k, 0]));
  const stoppedAt = Object.fromEntries(SIGNUP_FUNNEL.map((k) => [k, 0]));
  const browserSteps = SIGNUP_FUNNEL.filter((k) => k !== "completed");
  for (const r of rows) {
    let last = null;
    for (const k of browserSteps) {
      if (Number(r[k]) === 1) {
        counts[k] += 1;
        last = k;
      }
    }
    if (last) stoppedAt[last] += 1;
  }
  // Completed is a server event with no visitor; counted from the daily table.
  const completed = await db.analyticsDaily.aggregate({
    _sum: { count: true },
    where: { event: "signup_step", path: "completed", isDemo: false, date: { gte: from, lt: end } },
  });
  counts.completed = completed._sum.count || 0;
  return { counts, stoppedAt, from };
}

/**
 * Conversions on the client-facing surfaces, from the rows the writers
 * already create. Demo companies excluded unless asked for.
 */
export async function clientConversions({ start, end, includeDemo = false } = {}) {
  const companyFilter = includeDemo ? {} : { company: { isDemo: false } };
  const [approved, booked, paid, sitesLive] = await Promise.all([
    db.quote.count({ where: { acceptedAt: { gte: start, lt: end }, ...companyFilter } }),
    db.booking.count({ where: { createdAt: { gte: start, lt: end }, ...(includeDemo ? {} : { eventType: { company: { isDemo: false } } }) } }),
    db.payment.count({
      where: {
        createdAt: { gte: start, lt: end }, kind: "payment", method: "stripe",
        ...(includeDemo ? {} : { invoice: { company: { isDemo: false } } }),
      },
    }),
    db.company.count({ where: { sitePublished: true, ...(includeDemo ? {} : { isDemo: false }) } }),
  ]);
  return { approved, booked, paid, sitesLive };
}

/** How many companies could have used a page: active, non-demo (or all). */
export async function companyDenominator({ includeDemo = false } = {}) {
  return db.company.count({ where: includeDemo ? {} : { isDemo: false } });
}

/** Names for the drill-down picker and the "used by" lists. Read-only. */
export async function companyNames(ids) {
  if (!ids.length) return new Map();
  const rows = await db.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, isDemo: true } });
  return new Map(rows.map((r) => [r.id, r]));
}
