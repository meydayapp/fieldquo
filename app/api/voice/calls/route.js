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
import { memberOrRefusal } from "@/lib/apiMember";
import { formatNumber } from "@/lib/voice/numbers";
import { costForSeconds } from "@/lib/voice/credits";
import { isAiConfigured } from "@/lib/ai/provider";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
      direction: true,
      fromE164: true,
      toE164: true,
      startedAt: true,
      durationSec: true,
      summary: true,
      disposition: true,
      recordingUrl: true,
      needsReview: true,
      reviewedAt: true,
      leadId: true,
      bookingId: true,
      // Whether a quote can be drafted from this call at all, and whether one
      // already has been. Never the transcript itself — the list would carry a
      // hundred call recordings to render a button.
      transcript: true,
      quoteDraftAt: true,
      number: { select: { numberType: true } },
    },
  });

  // The visits those calls booked, so the badge on the row can say WHEN and
  // link to it. It used to be a green pill with no time, no name and no href:
  // the contractor was told a visit existed and given no way to find it.
  //
  // `VoiceCall.bookingId` is a plain column rather than a relation, so this is
  // a second query. Scoped through the event type's company, because a booking
  // has no companyId of its own and the id on the call is only as trustworthy
  // as the row it came from.
  const bookingIds = calls.map((c) => c.bookingId).filter(Boolean);
  const bookings = bookingIds.length
    ? await db.booking.findMany({
        where: {
          id: { in: bookingIds },
          eventType: { companyId: member.companyId },
        },
        select: { id: true, startTime: true, status: true, appointmentId: true },
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const pending = await db.voiceCall.count({
    where: { companyId: member.companyId, needsReview: true, reviewedAt: null },
  });

  // ── Is it set up, and is it switched on? ─────────────────────────────────
  //
  // The empty state used to offer "Set it up" to anyone with no calls, which is
  // most of the reason this page exists to answer. A company whose receptionist
  // is bought, configured and answering — and has simply had a quiet week, or,
  // as tonight, has had every delivery rejected at the door — was told to go and
  // set up the thing they had already set up.
  //
  // Two cheap booleans, no provider call. Not sensitive: whether a company has a
  // phone number and whether it is switched on is not something a member of that
  // company should be kept from.
  const [heldCount, voiceAgent] = await Promise.all([
    db.voicePhoneNumber.count({
      where: {
        companyId: member.companyId,
        status: { in: ["provisioning", "active", "porting"] },
      },
    }),
    db.voiceAgent.findUnique({
      where: { companyId: member.companyId },
      select: { enabled: true },
    }),
  ]);

  return NextResponse.json({
    pending,
    setup: {
      hasNumber: heldCount > 0,
      // Three states, not two: no number at all, a number with the receptionist
      // switched off, and running-but-quiet. Each needs a different sentence,
      // and collapsing them is what produced the wrong one.
      answering: heldCount > 0 && Boolean(voiceAgent?.enabled),
    },
    // Whether the "draft a quote from this call" button can do anything.
    // OPENAI_API_KEY is Sensitive in Vercel and absent in local dev, so this is
    // genuinely false some of the time — and a button that is always going to
    // fail should not be on the screen at all.
    aiAvailable: isAiConfigured(),
    calls: calls.map((c) => ({
      id: c.id,
      direction: c.direction,
      // The OTHER party, not our own number. On an outbound call `fromE164` is
      // us — showing it would label every call we placed with our own number.
      from: formatNumber(c.direction === "outbound" ? c.toE164 : c.fromE164),
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
      // Null when the call carries a booking id we can't resolve inside this
      // company. Absent rather than padded — the badge then says a visit was
      // booked without inventing a time for it.
      booking: c.bookingId
        ? (() => {
            const b = bookingById.get(c.bookingId);
            return b
              ? { at: b.startTime, status: b.status, onCalendar: Boolean(b.appointmentId) }
              : null;
          })()
        : null,
      hasTranscript: Boolean(c.transcript),
      quoteDraftedAt: c.quoteDraftAt,
    })),
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
