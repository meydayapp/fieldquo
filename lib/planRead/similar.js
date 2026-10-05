// lib/planRead/similar.js
//
// "Your last two churches came in at $2.10–$2.60 per sq ft" — from THIS
// company's own quotes, never another tenant's.
//
// ══ Tenant scope ═══════════════════════════════════════════════════════════
//
// The one query below names `companyId` in its where, and summariseSimilar()
// drops any row whose companyId is not the caller's — belt and braces, and
// what scripts/check-plan-deep-read.mjs executes against a stub holding two
// companies' quotes. lib/pricing/benchmarkData.js is cross-tenant ON PURPOSE
// (an anonymised cohort) and is deliberately not used here: this tile names
// the company's own jobs by number, which only its own history may do.
//
// ══ What "similar" means ═══════════════════════════════════════════════════
//
// Painting quotes (interior or exterior) the company sent, won or lost, with
// a measured painted area — the same per-unit rule the quote review's price
// check uses (lib/quotes/primaryMeasure.js), so the two never disagree on
// what a job's $/sq ft was. Ranked by building type first (church, school,
// office…, read from the quote's own words), then by size. The range is
// built only from ACCEPTED quotes of the same type: a lost quote says what
// did not sell, which is worth listing and not worth averaging.
//
// ══ Per trade, in hours too (the first pass, 2026-10-05) ════════════════════
//
// The owner's live test: "I didn't use any past-job comparison". Now each
// painting category is compared on its own — an exterior draft against the
// company's exterior jobs — in $ per sq ft AND hours per sq ft: hours from the
// accepted quote's own takeoff (priced by the company's book, the engine every
// typed quote uses), and, where the job is COMPLETED, the hours actually
// clocked on it (TimeEntry), split across a quote's painting categories by
// their share of its price — said on the figure. compareToPast() places the
// draft in that range and names the likely reason for a large gap from what
// the draft itself is made of (height, prep, access, rate set, size).

import { db as realDb } from "@/lib/db";
import { pricePerUnit } from "@/lib/quotes/primaryMeasure";
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";

export const PAINT_CATEGORIES = ["interior_painting", "exterior_painting"];

const FAMILIES = [
  ["church", /\b(church|chapel|cathedral|parish|sanctuary|synagogue|mosque|temple|steeple|bell tower)\b/i],
  ["school", /\b(school|college|university|campus|daycare|classroom|gymnasium)\b/i],
  ["office", /\b(office|offices|corporate|clinic|medical|dental)\b/i],
  ["retail", /\b(retail|store|shop|restaurant|cafe|mall|plaza)\b/i],
  ["industrial", /\b(warehouse|industrial|factory|plant|shop floor)\b/i],
  ["multi_unit", /\b(condo|condominium|apartment|apartments|multi-?unit|townhouses?|strata)\b/i],
  ["residential", /\b(house|home|residence|residential|bungalow|cottage|duplex)\b/i],
];

/** The building family a piece of text names, or null. Pure. */
export function buildingFamily(...texts) {
  const t = texts.filter(Boolean).join(" ");
  for (const [key, re] of FAMILIES) if (re.test(t)) return key;
  return null;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Rank and summarise. Pure — the check feeds it rows from two companies.
 *
 * @param rows  quotes as loaded below
 * @param opts  { companyId, family, sqft }
 */
export function summariseSimilar(rows, { companyId, family = null, sqft = 0, books = null } = {}) {
  const out = [];
  for (const q of Array.isArray(rows) ? rows : []) {
    if (!q || q.companyId !== companyId) continue;
    let measured = 0;
    let subtotal = 0;
    const byCategory = {};
    for (const g of q.scopeGroups || []) {
      const key = g.category?.key;
      if (!PAINT_CATEGORIES.includes(key)) continue;
      const p = pricePerUnit({ categoryKey: key, takeoff: g.takeoff, intakeValues: g.intakeValues, subtotal: g.subtotal });
      if (!p || p.unit !== "sqft") continue;
      measured += p.quantity;
      subtotal += num(g.subtotal);
      const c = (byCategory[key] = byCategory[key] || { sqft: 0, subtotal: 0, hours: 0, hoursKnown: true });
      c.sqft += p.quantity;
      c.subtotal += num(g.subtotal);
      // The quoted hours: the group's own takeoff through the company's book.
      const book = books?.[key] || null;
      const h = book && g.takeoff && typeof g.takeoff === "object" ? num(paintTakeoff(g.takeoff, book).hours) : 0;
      if (h > 0) c.hours += h;
      else c.hoursKnown = false;
    }
    if (!(measured > 0) || !(subtotal > 0)) continue;
    const words = [q.notes, q.siteAddress, q.client?.name, ...(q.scopeGroups || []).map((g) => g.label)].join(" ");
    const fam = buildingFamily(words);
    // Hours actually clocked, when the job is done — split across categories
    // by their share of the quote's painting price.
    const done = (q.jobs || []).filter((j) => j && j.status === "completed");
    const clocked = done.reduce((n, j) => n + (j.timeEntries || []).reduce((m, t) => m + num(t.hours), 0), 0);
    const cats = Object.fromEntries(
      Object.entries(byCategory).map(([k, c]) => {
        const share = subtotal > 0 ? c.subtotal / subtotal : 0;
        const actual = clocked > 0 ? clocked * share : null;
        return [
          k,
          {
            sqft: Math.round(c.sqft),
            subtotal: Math.round(c.subtotal * 100) / 100,
            perSqft: c.sqft > 0 ? Math.round((c.subtotal / c.sqft) * 100) / 100 : null,
            hoursPerSqft: c.hoursKnown && c.hours > 0 && c.sqft > 0 ? Math.round((c.hours / c.sqft) * 10000) / 10000 : null,
            actualHoursPerSqft: actual && c.sqft > 0 ? Math.round((actual / c.sqft) * 10000) / 10000 : null,
            actualSplit: actual !== null && Object.keys(byCategory).length > 1,
          },
        ];
      }),
    );
    out.push({
      quoteId: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      date: q.createdAt instanceof Date ? q.createdAt.toISOString().slice(0, 10) : String(q.createdAt || "").slice(0, 10),
      sqft: Math.round(measured),
      subtotal: Math.round(subtotal * 100) / 100,
      perSqft: Math.round((subtotal / measured) * 100) / 100,
      family: fam,
      sameType: Boolean(family && fam === family),
      completed: done.length > 0,
      byCategory: cats,
    });
  }
  const sizeGap = (x) => (sqft > 0 ? Math.abs(Math.log((x.sqft || 1) / sqft)) : 0);
  out.sort((a, b) => Number(b.sameType) - Number(a.sameType) || sizeGap(a) - sizeGap(b) || (a.date < b.date ? 1 : -1));
  const matches = out.slice(0, 6);
  const won = matches.filter((m) => m.status === "accepted" && (m.sameType || !family));
  const range = won.length
    ? { low: Math.min(...won.map((m) => m.perSqft)), high: Math.max(...won.map((m) => m.perSqft)), count: won.length, sameType: Boolean(family) }
    : null;
  return { family, matches, range, byCategory: categoryRanges(out, family) };
}

/**
 * Per painting category: the accepted (or completed) jobs' $/sq ft and
 * hours/sq ft ranges — same building type first, any type when there is
 * none. Pure.
 */
export function categoryRanges(matches, family = null) {
  const out = {};
  for (const key of PAINT_CATEGORIES) {
    const has = matches.filter((m) => m.byCategory?.[key] && (m.status === "accepted" || m.completed));
    const same = family ? has.filter((m) => m.family === family) : [];
    const use = same.length ? same : has;
    if (!use.length) continue;
    const per = use.map((m) => m.byCategory[key].perSqft).filter((v) => v > 0);
    const hrs = use.map((m) => m.byCategory[key].actualHoursPerSqft ?? m.byCategory[key].hoursPerSqft).filter((v) => v > 0);
    out[key] = {
      count: use.length,
      sameType: same.length > 0,
      range: per.length ? { low: Math.min(...per), high: Math.max(...per) } : null,
      hoursRange: hrs.length ? { low: Math.min(...hrs), high: Math.max(...hrs), actual: use.some((m) => m.byCategory[key].actualHoursPerSqft) } : null,
      jobs: use.slice(0, 5).map((m) => ({ quoteId: m.quoteId, quoteNumber: m.quoteNumber, status: m.status, completed: m.completed, ...m.byCategory[key] })),
    };
  }
  return out;
}

/** A gap this large is flagged, with its likely reason. */
export const PAST_GAP = 0.25;

/**
 * Where a draft sits against the company's own past jobs of the same trade,
 * and — when it is far outside — the likely reason, from what the draft is
 * made of. Pure.
 *
 * @param past     categoryRanges()[categoryKey] (or null)
 * @param draft    { perSqft, hoursPerSqft, highShare (area above 8 ft),
 *                   prepShare (prep hours ÷ hours), accessShare (equipment ÷
 *                   price), commercial, sqft, pastSqft }
 */
export function compareToPast(past, draft) {
  if (!past || !past.range || !(draft?.perSqft > 0)) return null;
  const { low, high } = past.range;
  const position = draft.perSqft < low ? "below" : draft.perSqft > high ? "above" : "within";
  const gap = position === "below" ? (draft.perSqft - low) / low : position === "above" ? (draft.perSqft - high) / high : 0;
  const reasons = [];
  if (Math.abs(gap) > PAST_GAP) {
    if (position === "above") {
      if (draft.highShare > 0.25) reasons.push(`${Math.round(draft.highShare * 100)}% of this area is worked above 8 ft — the height factors raise its hours`);
      if (draft.accessShare > 0.08) reasons.push(`access equipment is ${Math.round(draft.accessShare * 100)}% of this price`);
      if (draft.prepShare > 0.15) reasons.push(`prep is ${Math.round(draft.prepShare * 100)}% of the hours (substrate and condition)`);
      if (draft.commercial) reasons.push("it is priced on your commercial rate set");
      if (draft.sqft && draft.pastSqft && draft.sqft < draft.pastSqft * 0.5) reasons.push("it is much smaller than those jobs, so fixed costs weigh more per sq ft");
    } else {
      if (draft.sqft && draft.pastSqft && draft.sqft > draft.pastSqft * 2) reasons.push("it is much larger than those jobs");
      if (draft.highShare < 0.05) reasons.push("almost all of it is ground-level work");
      if (draft.unpricedAccess) reasons.push("some access equipment has no price yet");
      if (draft.estimatedShare > 0.3) reasons.push("a large share of its quantities are scaled or estimated — check them");
    }
    if (!reasons.length) reasons.push(position === "above" ? "nothing in the draft explains it — check the quantities and rates" : "check that nothing is missing from the scope");
  }
  const hours =
    past.hoursRange && draft.hoursPerSqft > 0
      ? { position: draft.hoursPerSqft < past.hoursRange.low ? "below" : draft.hoursPerSqft > past.hoursRange.high ? "above" : "within", ...past.hoursRange }
      : null;
  return { position, gapPct: Math.round(gap * 100), flagged: Math.abs(gap) > PAST_GAP, reasons, range: past.range, hours, count: past.count, sameType: past.sameType, jobs: past.jobs };
}

/** The company's own painting quotes, loaded and summarised. */
export async function similarPastQuotes({ companyId, buildingType, clientRequest, sqft, books = null }, { prisma = realDb } = {}) {
  if (!companyId) return { family: null, matches: [], range: null };
  const rows = await prisma.quote.findMany({
    where: {
      companyId,
      status: { in: ["accepted", "declined", "sent"] },
      scopeGroups: { some: { category: { key: { in: PAINT_CATEGORIES } } } },
    },
    select: {
      id: true,
      companyId: true,
      quoteNumber: true,
      status: true,
      createdAt: true,
      notes: true,
      siteAddress: true,
      client: { select: { name: true } },
      scopeGroups: {
        select: { label: true, takeoff: true, intakeValues: true, subtotal: true, category: { select: { key: true } } },
      },
      // The job the quote became, for the hours actually clocked on it.
      jobs: { where: { companyId, status: "completed" }, select: { status: true, timeEntries: { select: { hours: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return summariseSimilar(rows, { companyId, family: buildingFamily(buildingType, clientRequest), sqft, books });
}
