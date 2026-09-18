// app/api/sales/agency/call-quality/[attemptId]/route.js
//
// One of the agency's employees' calls, for review: the flagged transcript,
// the scorecard, and the agency's own human pass. The scope is read fresh
// on the GET and AGAIN on the POST — a review must not land on a call whose
// rep left the team between the page loading and the button. The review is
// recorded with reviewerKind "agency" and the agency's name, which is what
// the platform sees beside the number ("reviewed by Northline Contact").
//
// The gate is spelled out in each handler rather than folded into a helper:
// scripts/check-sales-auth.mjs reads every /api/sales handler for a declared
// gate and a refusal, and a helper would hide both from the reader it is
// written for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { agencyTeamIds, isAgency } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { callQaDetail, reviewCallQa } from "@/lib/sales/calls/qaQueue";

const NOT_AGENCY = { error: "Only an agency account reviews its team's calls.", code: "not_agency" };

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { attemptId } = await params;
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json(NOT_AGENCY, { status: 403 });
  const teamIds = await agencyTeamIds(rep.id);
  const repIds = visibleRepIds(repViewer(rep.id, teamIds));

  const call = await callQaDetail({ attemptId, repIds });
  // Out of scope and non-existent look the same: a 403 would confirm a row.
  if (!call) return NextResponse.json({ error: "No such recorded call." }, { status: 404 });
  return NextResponse.json({ call, audioHref: `/api/sales/agency/recording/${encodeURIComponent(attemptId)}/audio` });
}

export async function POST(request, { params }) {
  const { attemptId } = await params;
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  if (!isAgency(rep)) return NextResponse.json(NOT_AGENCY, { status: 403 });
  // Read again, not carried over from the GET: the team at the moment of
  // the write is the only team that matters.
  const teamIds = await agencyTeamIds(rep.id);
  const repIds = visibleRepIds(repViewer(rep.id, teamIds));

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const r = await reviewCallQa({ attemptId, reviewer: { id: rep.id, kind: "agency", name: rep.name }, body, repIds });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await db.platformAuditLog
    .create({
      data: {
        actorSalesRepId: rep.id,
        action: "call_qa_reviewed",
        details: { attemptId, overall: r.qa.reviewerOverall, note: r.qa.reviewerNote, by: "agency" },
      },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true, qa: r.qa });
}
