// app/api/voice/calls/route.js
//
// The calls the receptionist has taken.
//
//   GET ?needsReview=1   only the ones flagged
//
// Read-only. Nothing here changes a call; the review action is a separate PATCH
// so "I've looked at this" can't happen by loading a page.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { formatNumber } from "@/lib/voice/numbers";
import { costForSeconds } from "@/lib/voice/credits";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const onlyReview = params.get("needsReview") === "1";

  const calls = await db.voiceCall.findMany({
    where: {
      companyId: member.companyId,
      ...(onlyReview ? { needsReview: true, reviewedAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fromE164: true,
      startedAt: true,
      durationSec: true,
      summary: true,
      disposition: true,
      recordingUrl: true,
      needsReview: true,
      reviewedAt: true,
      leadId: true,
      bookingId: true,
      number: { select: { numberType: true } },
    },
  });

  const pending = await db.voiceCall.count({
    where: { companyId: member.companyId, needsReview: true, reviewedAt: null },
  });

  return NextResponse.json({
    pending,
    calls: calls.map((c) => ({
      id: c.id,
      from: formatNumber(c.fromE164),
      at: c.startedAt,
      durationSec: c.durationSec,
      // What it cost, per call. "Where did my credit go" is the first question
      // anyone asks, and the answer belongs next to the call rather than only
      // in a running balance.
      costCents: costForSeconds(c.durationSec, c.number?.numberType),
      summary: c.summary,
      disposition: c.disposition,
      recordingUrl: c.recordingUrl,
      needsReview: c.needsReview && !c.reviewedAt,
      leadId: c.leadId,
      bookingId: c.bookingId,
    })),
  });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "No call" }, { status: 400 });

  // Scoped by company in the WHERE, not checked after fetching — a call id from
  // another tenant must not be markable from here.
  const updated = await db.voiceCall.updateMany({
    where: { id, companyId: member.companyId },
    data: { reviewedAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
