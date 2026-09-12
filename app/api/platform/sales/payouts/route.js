// app/api/platform/sales/payouts/route.js
//
// What FieldQuo owes its sales reps, and what it has paid: the read behind
// /platform/sales/payouts. Read-only — no money moves from this route or
// from the screen it feeds; a batch is paid by a person and marked paid at
// POST /api/platform/sales/payouts/[batchId]/paid.
//
// Superadmin and admin can read (see PAYOUT_VIEW_ROLES); support cannot — a
// rep's pay names the rep. The role comes from the admin row read for this
// request, never from the client.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { payoutsOverview, payoutViewerOrRefusal } from "@/lib/sales/payoutAdmin";
import { isPeriod } from "@/lib/sales/payoutLedger";

export async function GET(request) {
  const { admin, refusal } = await payoutViewerOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const wanted = new URL(request.url).searchParams.get("period");
  const period = isPeriod(wanted) ? wanted : "week";
  const view = await payoutsOverview({ period });
  return NextResponse.json({
    ...view,
    // So the screen can draw the Mark paid form only where it would work,
    // and say why it is absent otherwise.
    canMarkPaid: admin.role === "superadmin",
  });
}
