// app/api/quotes/[id]/costing/route.js
//
// What one quote was estimated to cost, and what margin that left.
//
// ── Why this is not part of GET /api/quotes/[id] ───────────────────────────
//
// Because that response is spread into a PDF and, through the share token,
// reaches a homeowner's browser. The whole reason QuoteCosting is a separate
// row is that nothing joins it by accident; hanging it off the quote's own GET
// would hand that guarantee straight back. A caller has to ask for the cost
// deliberately, and prove it may see it.
//
// ── Saved, or recomputed and honest about it ───────────────────────────────
//
// `saved: true` means these are the figures the quote was actually priced at,
// stored server-side when it was saved. `saved: false` means nothing was
// stored — an older quote, or one raised by someone who never opened the cost
// panel — and the figures were worked out just now from the quote's stored
// takeoffs against TODAY's price book. That is a different number from the one
// the estimator saw, and the flag is how the UI can say so rather than passing
// a fresh calculation off as a record.
//
// ── Saving is not here ─────────────────────────────────────────────────────
//
// The costing is written by POST /api/quotes and PATCH /api/quotes/[id], in
// the same write as the quote itself. A separate save button would let someone
// edit the crew, press Save on the quote, and lose them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasToggle } from "@/lib/permissions/enforce";
import {
  quoteCostSummary,
  shapeSavedQuoteCosting,
  shapeEstimate,
  costBasisMissing,
  MARGIN_TARGET_PCT,
  FALLBACK_OVERHEAD_PCT,
} from "@/lib/costing/quoteCosting";
import {
  resolveCostingGroups,
  recipeOverridesFor,
} from "@/app/api/quotes/costingWrite";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const full = await loadEnforceableMember(db, member.id);
  // The same gate as the job's and the invoice's cost panels. 403, not a
  // redacted body of zeroes: someone who may not see what a job costs must be
  // told they may not, because a panel full of zeroes reads as a job that cost
  // nothing and is the more dangerous of the two lies.
  if (!hasToggle(full, "jobCosting")) {
    return NextResponse.json(
      { error: "You don't have access to job costing." },
      { status: 403 },
    );
  }

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      subtotal: true,
      discount: true,
      costing: true,
      scopeGroups: {
        select: { id: true, categoryId: true, label: true, takeoff: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Saved wins, always, and nothing is recomputed ────────────────────────
  //
  // Not even partially. Recomputing one field — the overhead, say, because the
  // company's capacity figure has improved since — would put a figure on
  // screen that changes while nobody touches the quote, sitting next to
  // figures that don't. The row's existence is the flag: once a quote has been
  // costed, today's rate card stops having an opinion about it.
  if (quote.costing) {
    return NextResponse.json(shapeSavedQuoteCosting(quote.costing));
  }

  const price = (Number(quote.subtotal) || 0) - (Number(quote.discount) || 0);

  const [groups, recipeOverridesByCategory] = await Promise.all([
    resolveCostingGroups(member.companyId, quote.scopeGroups),
    recipeOverridesFor(member.companyId),
  ]);

  let overheadPerJob = null;
  try {
    const min = await calculateMinimumPrice({ companyId: member.companyId });
    if (!min?.error && Number.isFinite(Number(min?.costPerJob))) {
      overheadPerJob = Number(min.costPerJob);
    }
  } catch {
    // Unknown overhead is absent, not zero. The percentage fallback stands in
    // and `overheadBasis` says which one ran.
  }

  const estimate = quoteCostSummary({
    scopeGroups: groups,
    // No crew and no rate. Nothing recorded who was going to do this job, and
    // the company's current workers are not an answer to that question — the
    // ones on the payroll today are not necessarily the ones this quote
    // assumed. So the labour hours come back with no money against them and
    // `costIncomplete` is true, which is the truthful version of "we don't
    // know". Inventing a crew would produce a margin nobody ever quoted.
    crew: [],
    labourRate: 0,
    addedLabourHours: 0,
    addedMaterialCost: 0,
    overheadPct: FALLBACK_OVERHEAD_PCT,
    overheadPerJob,
    price,
    marginTargetPct: MARGIN_TARGET_PCT,
    recipeOverridesByCategory,
  });

  const shaped = shapeEstimate(estimate, { saved: false });

  // ── A margin computed from overhead alone is not a margin ────────────────
  //
  // Q-2026-0006 rendered "54.52% margin" against LABOUR $0.00 / 0 hrs and
  // MATERIALS $0.00 on a $6,650 cabinet quote. Nothing was wrong with the
  // arithmetic — $6,650 minus $3,024 of overhead really is 54.52%. What was
  // wrong is that it presented a subtraction with the two biggest terms
  // missing as if it were an answer, in green.
  //
  // Cabinet refinishing and exterior painting are priced from INTAKE ANSWERS
  // (doors, drawers, species) through app/data/materialRecipes.js, and
  // QuoteScopeGroup has never had a column to keep them in. A trade takeoff is
  // stored; intake answers are not. So for those trades a recompute has
  // literally nothing to work from, and it cannot be made to by trying harder.
  //
  // Absence of a cost is not a cost of zero. When a recompute produces neither
  // hours nor materials for a quote that plainly has work in it, the honest
  // answer is no margin at all — not a flattering one. `marginPct: null`
  // renders as "—", and `costBasisMissing` tells the panel what to say instead
  // of leaving somebody to wonder why the badge is blank.
  if (costBasisMissing({ ...shaped, price })) {
    const trades = [
      ...new Set(groups.map((g) => g.categoryKey).filter(Boolean)),
    ];
    return NextResponse.json({
      ...shaped,
      marginPct: null,
      profit: null,
      signal: "none",
      costIncomplete: true,
      costBasisMissing: true,
      // Named, because "we can't work it out" invites "why not", and the
      // answer is actionable: cost it on the quote and it is kept from now on.
      costBasisReason:
        "This quote was saved before costing was kept, and its trades are priced from intake answers that were never stored — so there is nothing left to work the cost out from. Open it in the editor, fill in the cost panel and save, and it will be recorded from then on.",
      costBasisTrades: trades,
    });
  }

  return NextResponse.json(shaped);
}
