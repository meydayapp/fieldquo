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

import { db as realDb } from "@/lib/db";
import { pricePerUnit } from "@/lib/quotes/primaryMeasure";

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
export function summariseSimilar(rows, { companyId, family = null, sqft = 0 } = {}) {
  const out = [];
  for (const q of Array.isArray(rows) ? rows : []) {
    if (!q || q.companyId !== companyId) continue;
    let measured = 0;
    let subtotal = 0;
    for (const g of q.scopeGroups || []) {
      const key = g.category?.key;
      if (!PAINT_CATEGORIES.includes(key)) continue;
      const p = pricePerUnit({ categoryKey: key, takeoff: g.takeoff, intakeValues: g.intakeValues, subtotal: g.subtotal });
      if (!p || p.unit !== "sqft") continue;
      measured += p.quantity;
      subtotal += num(g.subtotal);
    }
    if (!(measured > 0) || !(subtotal > 0)) continue;
    const words = [q.notes, q.siteAddress, q.client?.name, ...(q.scopeGroups || []).map((g) => g.label)].join(" ");
    const fam = buildingFamily(words);
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
    });
  }
  const sizeGap = (x) => (sqft > 0 ? Math.abs(Math.log((x.sqft || 1) / sqft)) : 0);
  out.sort((a, b) => Number(b.sameType) - Number(a.sameType) || sizeGap(a) - sizeGap(b) || (a.date < b.date ? 1 : -1));
  const matches = out.slice(0, 6);
  const won = matches.filter((m) => m.status === "accepted" && (m.sameType || !family));
  const range = won.length
    ? { low: Math.min(...won.map((m) => m.perSqft)), high: Math.max(...won.map((m) => m.perSqft)), count: won.length, sameType: Boolean(family) }
    : null;
  return { family, matches, range };
}

/** The company's own painting quotes, loaded and summarised. */
export async function similarPastQuotes({ companyId, buildingType, clientRequest, sqft }, { prisma = realDb } = {}) {
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
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return summariseSimilar(rows, { companyId, family: buildingFamily(buildingType, clientRequest), sqft });
}
