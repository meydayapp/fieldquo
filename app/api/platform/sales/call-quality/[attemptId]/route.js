// app/api/platform/sales/call-quality/[attemptId]/route.js
//
// One call for review: the flagged transcript, the scorecard, and the
// human pass. GET reads; POST writes the reviewer's score and note, which
// from then on is the number the performance page shows for this call
// (lib/sales/callQuality.js effectiveOverall). Superadmin only, and the
// review is audit-logged — a number that overrides a model's should say
// whose it is.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { callQaDetail, reviewCallQa } from "@/lib/sales/calls/qaQueue";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { attemptId } = await params;
  const { refusal } = await requireSuperadmin(request, "review call quality");
  if (refusal) return refusal;
  const call = await callQaDetail({ attemptId, repIds: null });
  if (!call) return NextResponse.json({ error: "No such recorded call." }, { status: 404 });
  return NextResponse.json({ call, audioHref: `/api/platform/sales/recording/${encodeURIComponent(attemptId)}/audio` });
}

export async function POST(request, { params }) {
  const { attemptId } = await params;
  const { admin, refusal } = await requireSuperadmin(request, "review call quality");
  if (refusal) return refusal;
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const r = await reviewCallQa({
    attemptId,
    reviewer: { id: admin.id, kind: "platform", name: "FieldQuo" },
    body,
    repIds: null,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await db.platformAuditLog
    .create({
      data: {
        platformAdminId: admin.id,
        action: "call_qa_reviewed",
        details: { attemptId, overall: r.qa.reviewerOverall, note: r.qa.reviewerNote },
      },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true, qa: r.qa });
}
