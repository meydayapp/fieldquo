// lib/jobs/sourcingList.js
//
// The job's sourcing list: what has to be bought before the crew leaves the
// yard, and whether it has been.
//
// ── One list, two questions ─────────────────────────────────────────────────
//
// The lines come from lib/costing/tradeMaterials.js — the same bill of
// materials the cost panel prices. That is deliberate: "what does this job
// consume" is the question behind both "is this price above my cost" and "have
// we bought everything". Deriving them separately is how the two end up
// disagreeing about how many bundles a roof needs.
//
// ── Regenerating never destroys a tick ──────────────────────────────────────
//
// A quote gets revised and the list goes stale. Regenerating replaces the
// derived lines that nobody has bought yet, and leaves alone:
//
//   PURCHASED lines — those are a record of money that left the account, and a
//   quote revision does not un-buy a pallet of pavers.
//   HAND-ADDED lines — nobody derived "gas for the compactor" from a takeoff,
//   so nothing derived should delete it.
//
// The result is that a regenerate is always safe to press, which is the only
// way a button like this gets pressed at all.

import { db } from "@/lib/db";
import {
  tradeMaterialsFor,
  hasTradeMaterials,
} from "@/lib/costing/tradeMaterials";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Derive the lines a job's quote implies. PURE apart from the read — takes the
 * job with its quote's scope groups, returns plain rows.
 */
export function deriveSourcingLines(job) {
  const groups = job?.quote?.scopeGroups;
  if (!Array.isArray(groups)) return [];

  const lines = [];
  let sortOrder = 0;
  for (const g of groups) {
    const key = g?.category?.key;
    if (!key || !hasTradeMaterials(key) || !g.takeoff) continue;
    const bill = tradeMaterialsFor(
      key,
      g.takeoff,
      g.companySettings?.rates || null,
    );
    if (!bill) continue;
    for (const m of bill.materials) {
      lines.push({
        name: m.name,
        qty: num(m.qty),
        unit: m.unit || "each",
        categoryKey: key,
        // Null, not zero, when nobody has priced it. The panel shows a
        // quantity with no money rather than a free pallet.
        estUnitCost: m.unitCost == null ? null : num(m.unitCost),
        sortOrder: sortOrder++,
      });
    }
  }
  return lines;
}

/**
 * Rebuild a job's sourcing list from its quote.
 *
 * @returns {{created:number, kept:number, removed:number}}
 */
export async function regenerateSourcingList(jobId, companyId) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    include: {
      quote: {
        include: {
          scopeGroups: { include: { category: true } },
        },
      },
      materials: true,
    },
  });
  if (!job) return null;

  // A company's rate overrides live on CompanyServiceCategory, not on the
  // scope group, so they are fetched once and attached — otherwise a company
  // that edited its gravel cost would source against the default.
  const categoryIds = (job.quote?.scopeGroups || [])
    .map((g) => g.categoryId)
    .filter(Boolean);
  const settings = categoryIds.length
    ? await db.companyServiceCategory.findMany({
        where: { companyId, categoryId: { in: categoryIds } },
        select: { categoryId: true, rates: true },
      })
    : [];
  const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));
  for (const g of job.quote?.scopeGroups || []) {
    g.companySettings = { rates: ratesById.get(g.categoryId) || null };
  }

  const keep = job.materials.filter((m) => m.purchasedAt || m.addedByHand);
  const toRemove = job.materials.filter(
    (m) => !m.purchasedAt && !m.addedByHand,
  );
  const derived = deriveSourcingLines(job);

  // Anything already bought is not offered again. Matched on name AND unit,
  // because "Granular base — cu yd" and "Granular base — tonne" are different
  // purchases and collapsing them would hide one of them.
  const bought = new Set(keep.map((m) => `${m.name}|${m.unit}`));
  const fresh = derived.filter((l) => !bought.has(`${l.name}|${l.unit}`));

  await db.$transaction([
    ...(toRemove.length
      ? [
          db.jobMaterial.deleteMany({
            where: { id: { in: toRemove.map((m) => m.id) } },
          }),
        ]
      : []),
    ...(fresh.length
      ? [
          db.jobMaterial.createMany({
            data: fresh.map((l) => ({ ...l, jobId })),
          }),
        ]
      : []),
  ]);

  return { created: fresh.length, kept: keep.length, removed: toRemove.length };
}

/**
 * Record what a line actually cost, into the company's own price history.
 *
 * This is the loop closing. The trade price books ship with unit costs unset
 * for roofing, siding and insulation because nobody read a supplier's prices —
 * and the right way to fill them is not a guess, it is what this company
 * actually paid. `Material` and `MaterialPriceEntry` already exist for exactly
 * this, so a tick with a receipt on it becomes a data point rather than a
 * checkbox.
 *
 * Per-unit is derived here rather than asked for: a receipt is a total, and
 * asking somebody at a till to divide it by seventeen bags is asking for a
 * wrong number.
 */
export async function recordMaterialPrice({
  companyId,
  name,
  unit,
  qty,
  actualCost,
}) {
  const total = num(actualCost);
  const quantity = num(qty);
  if (!companyId || !name || total <= 0 || quantity <= 0) return null;

  try {
    const existing = await db.material.findFirst({
      where: { companyId, name },
      select: { id: true },
    });
    const material =
      existing ||
      (await db.material.create({
        data: { companyId, name, unit: unit || null, category: "job_material" },
        select: { id: true },
      }));

    const unitPrice = Math.round((total / quantity) * 100) / 100;
    await db.materialPriceEntry.create({
      data: { materialId: material.id, price: unitPrice },
    });

    // The rolling average is what a future estimate would read, so it is
    // recomputed from every entry rather than nudged — one mistyped receipt
    // should be diluted by the others, not baked in.
    const entries = await db.materialPriceEntry.findMany({
      where: { materialId: material.id },
      select: { price: true },
    });
    const avg =
      entries.reduce((s, e) => s + Number(e.price || 0), 0) /
      (entries.length || 1);
    await db.material.update({
      where: { id: material.id },
      data: { currentAvgCost: Math.round(avg * 100) / 100 },
    });
    return { materialId: material.id, unitPrice };
  } catch (err) {
    // A price-history write must never fail the tick. The purchase is the
    // fact; the analytics are a by-product.
    console.error("[sourcing] price history:", err?.message);
    return null;
  }
}

/** How far along the list is. */
export function sourcingProgress(materials = []) {
  const total = materials.length;
  const bought = materials.filter((m) => m.purchasedAt).length;
  return {
    total,
    bought,
    outstanding: total - bought,
    complete: total > 0 && bought === total,
    // Only the lines somebody has actually priced. A total that silently
    // included the unpriced ones would read as "we spent $180 on this roof".
    estimatedTotal: round2(
      materials.reduce((s, m) => s + num(m.estUnitCost) * num(m.qty), 0),
    ),
    actualTotal: round2(materials.reduce((s, m) => s + num(m.actualCost), 0)),
    unpriced: materials.filter((m) => m.estUnitCost == null).length,
  };
}

function round2(n) {
  const v = num(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
