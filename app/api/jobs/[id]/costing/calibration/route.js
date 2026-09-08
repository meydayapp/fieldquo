// app/api/jobs/[id]/costing/calibration/route.js
//
// What this job's materials AND hours say about the rates that predicted them.
//
// The close-out (app/components/jobs/CostReview.js) fetches this when the job
// crossed the company's cost-revision threshold and the person pressed
// "Update" (lib/costing/costRevision.js), and shows, per derived material
// line, the rate the estimate used against the rate the job actually got —
// one roll of tape per 8 doors against one per 6, 350 sqft a gallon against
// 290 — plus one labour line: the hours the quote predicted against the
// hours approved, per unit of work, with a suggested crew-hours rate where
// exactly one saved rate produced the estimate. Where the company can save
// that rate today, a button writes the suggested value through the EXISTING
// settings route for the trade. This endpoint computes; it never writes.
// See lib/costing/materialCalibration.js and lib/costing/labourCalibration.js
// for what each refuses to guess.
//
// Gated exactly like the review endpoint beside it: the job's view level,
// the jobCosting toggle (a consumption rate is the cost basis — the same
// gate Settings > Material Costs sits behind), the job's edit level, and the
// caller's assigned-jobs scope on the query. A person who may not sign off
// the job's cost may not read what would move the recipe either.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle, assignedJobWhere, requireLevel } from "@/lib/permissions/enforce";
import { canWriteCostBasis } from "@/lib/permissions/costBasis";
import { QUOTE_COST_SELECT, quotedCostFor } from "@/lib/costing/quoteCostEstimate";
import { resolveCostingGroups, recipeOverridesFor } from "@/app/api/quotes/costingWrite";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";
import { actualJobCost } from "@/lib/costing/actualJobCost";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { getRecipe, hasRecipe } from "@/app/data/materialRecipes";
import { getPriceBook, hasPriceBook } from "@/app/data/tradePriceBooks";
import {
  materialCalibration,
  pickEstimateGroups,
  CALIBRATION_REASONS,
} from "@/lib/costing/materialCalibration";
import {
  labourBasisFor,
  labourCalibration,
  LABOUR_REASONS,
} from "@/lib/costing/labourCalibration";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json({ error: "You don't have access to job costing." }, { status: 403 });
  }
  try {
    requireLevel(full, "jobs", "view_create_edit", "edit jobs");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: {
      id: true,
      materials: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          unit: true,
          qty: true,
          actualQty: true,
          materialKey: true,
          categoryKey: true,
          addedByHand: true,
          purchasedAt: true,
        },
      },
      // Approved, pending and unrated hours, the same rows and the same
      // arithmetic the costing panel uses (actualJobCost), so the labour line
      // here cannot disagree with the panel about how many hours there were.
      timeEntries: {
        where: { worker: { companyId: member.companyId } },
        select: { hours: true, status: true, workerId: true, worker: { select: { hourlyRate: true } } },
      },
      quote: {
        select: {
          ...QUOTE_COST_SELECT,
          costing: { select: { groups: true } },
        },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // No quote means no estimate at all — nothing to calibrate against. Say so
  // with an empty answer rather than a 4xx: the close-out renders nothing for
  // it, which is the honest screen.
  if (!job.quote) {
    return NextResponse.json({ lines: [], hasActuals: false, source: null, labour: null });
  }

  const materials = job.materials.map((m) => ({
    ...m,
    qty: num(m.qty),
    actualQty: m.actualQty == null ? null : num(m.actualQty),
  }));

  // The company's rates as they stand today — the thing a suggestion would
  // change. Resolved server-side with the same helpers the quote's own cost
  // panel uses, so this cannot disagree with it about what the rate is.
  const [resolvedGroups, recipeOverrides, quotedCost] = await Promise.all([
    resolveCostingGroups(member.companyId, job.quote.scopeGroups),
    recipeOverridesFor(member.companyId),
    quotedCostFor({ companyId: member.companyId, quoteId: job.quote.id }),
  ]);
  const keyToCategoryId = new Map(
    job.quote.scopeGroups.map((g, i) => [resolvedGroups[i]?.categoryKey, g.categoryId]),
  );

  const currentRates = { recipes: {}, books: {} };
  for (const g of resolvedGroups) {
    if (!g.categoryKey) continue;
    if (hasRecipe(g.categoryKey) && !currentRates.recipes[g.categoryKey]) {
      currentRates.recipes[g.categoryKey] = getRecipe(
        g.categoryKey,
        recipeOverrides[g.categoryKey] || {},
      );
    }
    if (hasPriceBook(g.categoryKey) && !currentRates.books[g.categoryKey]) {
      currentRates.books[g.categoryKey] = getPriceBook(g.categoryKey, g.rateOverrides);
    }
  }

  // The estimate groups: frozen with the quote's costing when that freeze
  // carries a basis, else derived now. The denominators (doors, sqft of
  // coating) come from the quote's own scope either way; only the RATE
  // differs, and the comparison is against today's rate regardless.
  const derivedByIndex = resolvedGroups.map((g) =>
    estimateScopeGroupCost({
      categoryKey: g.categoryKey,
      intake: g.intakeValues || {},
      recipeOverrides: recipeOverrides[g.categoryKey] || {},
      takeoff: g.takeoff || null,
      rateOverrides: g.rateOverrides || null,
    }),
  );
  const derived = derivedByIndex
    .map((est, i) => (est ? { label: resolvedGroups[i].label, ...est } : null))
    .filter(Boolean);
  const { groups, source } = pickEstimateGroups({
    frozen: job.quote.costing?.groups,
    derived,
  });

  // ── Who may press the button ──────────────────────────────────────────────
  //
  // The two settings routes a suggestion writes through keep their own gates,
  // and those gates are the authority — this only decides whether to DRAW the
  // button, so a person is never handed one that 403s. Recipes: the cost-basis
  // grid (requireCostBasisWrite "materialRecipes"). Rate card: owners and
  // admins, which is what PATCH /api/settings/service-categories checks.
  const mayWrite = {
    recipe: canWriteCostBasis(full, "materialRecipes"),
    book: ["owner", "admin"].includes(member.role),
  };

  // Materials: only lines derived from an estimate can be calibrated. A job
  // whose list is entirely hand-added still gets the labour line below.
  const derivedRows = materials.filter((m) => !m.addedByHand);
  const lines = derivedRows.length
    ? materialCalibration({ materials: derivedRows, groups, currentRates })
    : [];

  const shaped = lines.map((l) => {
    const store = l.currentRate?.store || null;
    const permitted = store ? Boolean(mayWrite[store]) : false;
    const canApply = l.canApply && permitted;
    return {
      ...l,
      canApply,
      reason: l.canApply && !permitted ? CALIBRATION_REASONS.PERMISSION : l.reason,
      apply: canApply
        ? {
            store,
            categoryKey: l.categoryKey,
            categoryId: keyToCategoryId.get(l.categoryKey) || null,
            path: l.currentRate.path,
            value: l.suggestedRate,
          }
        : null,
    };
  });

  // ── Labour ────────────────────────────────────────────────────────────────
  //
  // Per group: the hours the estimate gave it and the denominator that
  // produced them. Hours come from the FROZEN groups when the quote was
  // costed (matched by trade and label — the freeze drops groups that
  // estimated to nothing, so index is not a key), else derived now the same
  // way quoteCostSummary derives them: the recipe's hours plus the takeoff's.
  const frozenGroups = Array.isArray(job.quote.costing?.groups) ? job.quote.costing.groups : [];
  const groupHoursFor = (g, i) => {
    const frozen =
      frozenGroups.find((f) => f?.categoryKey === g.categoryKey && (f?.label ?? null) === (g.label ?? null)) ||
      frozenGroups.find((f) => f?.categoryKey === g.categoryKey);
    if (frozen) return num(frozen.labourHours);
    let hours = derivedByIndex[i] ? num(derivedByIndex[i].labourHours) : 0;
    if (g.takeoff) {
      try {
        hours += num(tradeLabourHours(g.categoryKey, g.takeoff, g.rateOverrides || null));
      } catch {
        // A malformed takeoff predicts nothing rather than throwing the
        // whole calibration away — the same rule quoteCostSummary keeps.
      }
    }
    return hours;
  };
  const labourGroups = resolvedGroups.map((g, i) => ({
    categoryKey: g.categoryKey,
    label: g.label,
    labourHours: groupHoursFor(g, i),
    basis: labourBasisFor({
      categoryKey: g.categoryKey,
      intake: g.intakeValues || {},
      takeoff: g.takeoff || null,
      rateOverrides: g.rateOverrides || null,
      recipeOverrides: recipeOverrides[g.categoryKey] || {},
    }),
  }));
  const hours = actualJobCost([], job.timeEntries).labour;
  const labourLine = labourCalibration({
    estimatedHours: quotedCost?.labourHours ?? null,
    approvedHours: hours.approvedHours,
    pendingHours: hours.pendingHours,
    unratedHours: hours.unratedHours,
    groups: labourGroups,
  });
  let labour = null;
  if (labourLine) {
    const store = labourLine.currentRate?.store || null;
    const permitted = store ? Boolean(mayWrite[store]) : false;
    const canApply = labourLine.canApply && permitted;
    labour = {
      ...labourLine,
      canApply,
      reason: labourLine.canApply && !permitted ? LABOUR_REASONS.PERMISSION : labourLine.reason,
      apply: canApply
        ? {
            store,
            categoryKey: labourLine.categoryKey,
            categoryId: keyToCategoryId.get(labourLine.categoryKey) || null,
            path: labourLine.currentRate.path,
            value: labourLine.suggestedRate,
          }
        : null,
    };
  }

  return NextResponse.json({
    lines: shaped,
    hasActuals: shaped.some((l) => l.actualQty != null),
    source,
    labour,
  });
}
