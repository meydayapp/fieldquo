// app/api/sales/calls/reviews/route.js
//
// The owner's verdicts on this rep's own outcomes (lib/sales/calls/dispositionAudit.js):
// the count of rejections in the last thirty days for the dashboard badge,
// and the rejected calls themselves — when, which business, what was logged,
// what the owner wrote. A rep sees their own and nobody else's.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState } from "@/lib/sales/calls/store";
import { AUDIT_REJECTED, rejectedAuditCount } from "@/lib/sales/calls/dispositionAudit";

const DAYS = 30;

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  if (!callStoreState().ready) return NextResponse.json({ rejected: null, days: DAYS, items: [], serverNow: now.toISOString() });
  const [rejected, rows] = await Promise.all([
    rejectedAuditCount({ salesRepId: rep.id, sinceDays: DAYS, now }),
    db.salesDispositionAudit.findMany({
      where: { verdict: AUDIT_REJECTED, attempt: { salesRepId: rep.id }, updatedAt: { gte: new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000) } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        attemptId: true,
        verdict: true,
        notes: true,
        disposition: true,
        subDisposition: true,
        updatedAt: true,
        attempt: { select: { dialledAt: true, toE164: true, prospect: { select: { businessName: true } }, lead: { select: { businessName: true } } } },
      },
    }),
  ]);
  return NextResponse.json({
    rejected,
    days: DAYS,
    items: rows.map((r) => ({
      attemptId: r.attemptId,
      verdict: r.verdict,
      note: r.notes,
      disposition: r.disposition,
      subDisposition: r.subDisposition,
      reviewedAt: r.updatedAt.toISOString(),
      dialledAt: r.attempt?.dialledAt?.toISOString?.() || null,
      businessName: r.attempt?.prospect?.businessName || r.attempt?.lead?.businessName || null,
    })),
    serverNow: now.toISOString(),
  });
}
