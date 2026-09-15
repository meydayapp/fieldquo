// app/api/influencer/earnings/route.js
//
// What this influencer has earned — the same answer, in the same shape, as
// /api/sales/earnings gives a rep, so the same EarningsPanel renders both.
//
// The rep route is not reused directly because its gate is the sales cookie,
// and an influencer has none (lib/influencers/index.js). The BODY of the read
// is the same two queries plus earningsView(), keyed on the ledger id the
// company gate resolved — never on anything the request named.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { influencerOrRefusal } from "@/lib/influencers/gate";
import { earningsView } from "@/lib/sales/earnings";

export async function GET(request) {
  const { ledger, response } = await influencerOrRefusal(request);
  if (response) return response;
  const ledgerId = ledger.id;

  const [entries, batches] = await Promise.all([
    db.salesCommissionEntry.findMany({
      where: { salesRepId: ledgerId },
      select: {
        id: true,
        companyId: true,
        milestone: true,
        amountCents: true,
        status: true,
        occurredAt: true,
        payoutBatchId: true,
        company: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    db.salesPayoutBatch.findMany({
      where: { salesRepId: ledgerId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        paidAt: true,
        totalCentsAtClose: true,
        paidVia: true,
        paymentReference: true,
        paymentNote: true,
        proofUrl: true,
        proofFilename: true,
      },
      orderBy: { periodStart: "desc" },
    }),
  ]);

  const flat = entries.map(({ company, ...e }) => ({ ...e, companyName: company?.name || null }));

  return NextResponse.json({
    ...earningsView({ entries: flat, batches }),
    payoutReady: Boolean(ledger.payoutMethod && ledger.payoutHandle),
  });
}
