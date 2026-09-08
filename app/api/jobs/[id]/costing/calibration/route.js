// app/api/jobs/[id]/costing/calibration/route.js
//
// What this job's materials say about the recipe that predicted them.
//
// The close-out (app/components/jobs/CostReview.js) fetches this and shows,
// per derived material line, the rate the estimate used against the rate the
// job actually got — one roll of tape per 8 doors against one per 6, 350
// sqft a gallon against 290 — and, where the company can save that rate
// today, a button that writes the suggested value through the EXISTING
// settings route for the trade. This endpoint computes; it never writes.
// See lib/costing/materialCalibration.js for what it refuses to guess.
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
import { QUOTE_COST_SELECT } from "@/lib/costing/quoteCostEstimate";
import { resolveCostingGroups, recipeOverridesFor } from "@/app/api/quotes/costingWrite";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";
import { getRecipe, hasRecipe } from "@/app/data/materialRecipes";
import { getPriceBook, hasPriceBook } from "@/app/data/tradePriceBooks";
import {
  materialCalibration,
  pickEstimateGroups,
  CALIBRATION_REASONS,
} from "@/lib/costing/materialCalibration";

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
      quote: {
        select: {
          ...QUOTE_COST_SELECT,
          costing: { select: { groups: true } },
        },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const materials = job.materials.map((m) => ({
    ...m,
    qty: num(m.qty),
    actualQty: m.actualQty == null ? null : num(m.actualQty),
  }));

  // Nothing derived from an estimate, nothing to calibrate — and no quote
  // means no estimate at all. Say so with an empty list rather than a 4xx:
  // the close-out renders nothing for it, which is the honest screen.
  const derivedRows = materials.filter((m) => !m.addedByHand);
  if (!job.quote || derivedRows.length === 0) {
    return NextResponse.json({ lines: [], hasActuals: false, source: null });
  }

  // The company's rates as they stand today — the thing a suggestion would
  // change. Resolved server-side with the same helpers the quote's own cost
  // panel uses, so this cannot disagree with it about what the rate is.
  const [resolvedGroups, recipeOverrides] = await Promise.all([
    resolveCostingGroups(member.companyId, job.quote.scopeGroups),
    recipeOverridesFor(member.companyId),
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
  const derived = resolvedGroups
    .map((g) =>
      estimateScopeGroupCost({
        categoryKey: g.categoryKey,
        intake: g.intakeValues || {},
        recipeOverrides: recipeOverrides[g.categoryKey] || {},
        takeoff: g.takeoff || null,
        rateOverrides: g.rateOverrides || null,
      }),
    )
    .map((est, i) => (est ? { label: resolvedGroups[i].label, ...est } : null))
    .filter(Boolean);
  const { groups, source } = pickEstimateGroups({
    frozen: job.quote.costing?.groups,
    derived,
  });

  const lines = materialCalibration({ materials: derivedRows, groups, currentRates });

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

  return NextResponse.json({
    lines: shaped,
    hasActuals: shaped.some((l) => l.actualQty != null),
    source,
  });
}
