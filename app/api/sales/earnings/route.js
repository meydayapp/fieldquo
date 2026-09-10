// app/api/sales/earnings/route.js
//
// What this rep has earned. Their own rows, with the amounts on them.
//
// ══ Why this route is new, and why REP_MILESTONE_SELECT is not reused ═════
//
// /api/sales/companies reads milestones through REP_MILESTONE_SELECT, which
// omits amountCents deliberately: that screen is a list of companies and their
// stage, and a money column on it would have put a rep's pay on a screen they
// open to check on a customer. That was the right call for that screen and it
// stays.
//
// The consequence was that a rep could not see their pay ANYWHERE. Every
// figure existed — SalesCommissionEntry.amountCents, SalesPayoutBatch.paidAt,
// a Monday cron closing the weeks — and all of it was visible only at
// /platform/sales/performance, which is superadmin-only. So this route exists
// to answer the question on the screen where it belongs, rather than by
// widening the select on the screen where it does not.
//
// ══ Scoped twice, on purpose ══════════════════════════════════════════════
//
// `salesRepId: rep.id` on the entries AND on the batches. A commission entry
// written against another rep for a company this rep is also attributed to
// would be that other rep's earning, and it is not this rep's to see — the
// same reasoning /api/sales/companies already applies to milestones, and the
// reason neither query is keyed on the company list alone.
//
// Read-only. Nothing here writes: attribution and commission are recorded by
// the webhook, the billing sync and the crons, and a rep's own screen is not
// allowed to be a fourth writer of their own pay.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { earningsView } from "@/lib/sales/earnings";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) {
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const [entries, batches, payout] = await Promise.all([
    db.salesCommissionEntry.findMany({
      where: { salesRepId: rep.id },
      select: {
        id: true,
        companyId: true,
        milestone: true,
        amountCents: true,
        status: true,
        occurredAt: true,
        payoutBatchId: true,
        // The name, so the screen can say "Easy Roofers Inc." rather than a
        // cuid. Selected here rather than joined on the client, which would
        // have meant a second round trip per company.
        company: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    db.salesPayoutBatch.findMany({
      where: { salesRepId: rep.id },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        paidAt: true,
        totalCentsAtClose: true,
      },
      orderBy: { periodStart: "desc" },
    }),
    // Read HERE rather than by widening requireSalesRep's select. That gate
    // feeds every rep-facing route, and a payout destination is not something
    // most of them should be handed. The same reasoning in reverse is how
    // workEmail came to be selected by one gate and not the other, so this
    // route asks for exactly what this route renders.
    db.salesRep.findUnique({
      where: { id: rep.id },
      select: { payoutMethod: true, payoutHandle: true },
    }),
  ]);

  const flat = entries.map(({ company, ...e }) => ({ ...e, companyName: company?.name || null }));

  // Whether a destination is even set, so the screen can say "there is nowhere
  // to send this" beside a figure the rep is owed. A balance with no payout
  // method is the one state where showing the number alone is unhelpful.
  return NextResponse.json({
    ...earningsView({ entries: flat, batches }),
    payoutReady: Boolean(payout?.payoutMethod && payout?.payoutHandle),
  });
}
