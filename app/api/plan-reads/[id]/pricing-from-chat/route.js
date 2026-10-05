// app/api/plan-reads/[id]/pricing-from-chat/route.js
//
// POST — "Update pricing from this conversation": the manual button that
// lets the chat change a pricing input (the owner, 2026-10-04). One metered
// call finds the figures the ESTIMATOR stated in their own messages; code
// keeps only those whose number is printed in the quoted words of a message
// they sent on this read (lib/planRead/pricingChat.js); the answer is a DIFF —
// the pricing now, and the pricing with those figures — and NOTHING is
// stored. Applying is a separate person's act: PATCH /api/plan-reads/[id]
// with { op: "set_pricing_assumptions" }, which re-checks every figure.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { can } from "@/lib/permissions";
import { publicTopupOffer } from "@/lib/ai/topupOffer";
import { featureAllowsSpend } from "@/lib/features/gate";
import { loadPlanRead } from "@/lib/planRead/load";
import { findPricingInputs, mergeAssumptions, pricingDiff } from "@/lib/planRead/pricingChat";
import { priceReadNow, pricingContextFor } from "@/lib/planRead/priceRead";
import { tradesFromScope } from "@/lib/planRead/tradeCatalogue";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "change a drawing read's pricing");
  if (denied) return denied;
  if (!hasToggle(full, "showPricing")) return NextResponse.json({ error: "Prices are hidden by your access level." }, { status: 403 });

  const read = await loadPlanRead(id, member.companyId);
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!read.model) return NextResponse.json({ error: "Run the read first." }, { status: 409 });
  if (read.status === "reading") return NextResponse.json({ error: "The read is still running." }, { status: 409 });
  if (!(await featureAllowsSpend(member.companyId, "ai_vision"))) {
    return NextResponse.json({ error: "The deep read isn't available on your account yet.", code: "feature_unavailable" }, { status: 403 });
  }

  const messages = (read.messages || []).map((m) => ({ id: m.id, role: m.role, text: m.text }));
  const trades = tradesFromScope(read.scope).trades.map((t) => t.tradeKey);
  const found = await findPricingInputs(
    { read, companyId: member.companyId, userId: member.userId || null, messages, trades: trades.length ? trades : ["painting"] },
    { turnId: randomUUID() },
  );
  if (!found.ok) {
    if (found.error === "no_messages") return NextResponse.json({ error: "Say your figures in the chat first — e.g. \"my crew hangs 600 sq ft a day\"." }, { status: 400 });
    if (found.error === "no_credit") {
      return NextResponse.json(
        {
          error: found.reason || "Your AI credit is empty. Top up to continue.",
          code: "no_credit",
          topup: publicTopupOffer(Math.max(0, (found.needCents || 0) - (found.balanceCents || 0)), can(member.role, "user:manage")),
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Couldn't read the conversation just now. Nothing was charged — try again." }, { status: 502 });
  }

  // The diff: today's pricing, and the pricing with these figures — the same
  // context for both, so only the figures differ.
  const ctx = await pricingContextFor(member.companyId, { prisma: db });
  const before = await priceReadNow(read, { companyId: member.companyId, prisma: db, ctx });
  const tried = { ...read.model, pricingAssumptions: mergeAssumptions(read.model.pricingAssumptions, found.proposals) };
  const after = await priceReadNow(read, { companyId: member.companyId, prisma: db, ctx, model: tried });
  return NextResponse.json({
    proposals: found.proposals,
    rejected: found.rejected.map((r) => ({ quote: String(r.proposal?.quote || "").slice(0, 160), reason: r.reason })),
    reply: found.reply,
    diff: pricingDiff(before?.pricing, after?.pricing),
    currency: ctx.currency,
    chargedCents: found.chargedCents,
  });
}
