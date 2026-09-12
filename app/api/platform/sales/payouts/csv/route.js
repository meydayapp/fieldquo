// app/api/platform/sales/payouts/csv/route.js
//
// The period table as a file. The same periodTable() the screen renders,
// through periodTableCsv() — scripts/check-sales-payout-proof.mjs asserts the
// CSV cells equal the table's. Read-only: an export of a ledger.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { payoutsOverview, payoutViewerOrRefusal } from "@/lib/sales/payoutAdmin";
import { isPeriod, periodTableCsv } from "@/lib/sales/payoutLedger";

export async function GET(request) {
  const { refusal } = await payoutViewerOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const wanted = new URL(request.url).searchParams.get("period");
  const period = isPeriod(wanted) ? wanted : "week";
  const { table } = await payoutsOverview({ period });
  const csv = periodTableCsv(table);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fieldquo-sales-payouts-by-${period}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
