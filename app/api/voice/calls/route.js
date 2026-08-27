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
import { voiceConfigured } from "@/lib/voice/retell";
import { can } from "@/lib/permissions";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

// ── Why the client dial and not `user:manage` ──────────────────────────────
//
// Everything else under /api/voice and /api/settings/voice gates on
// `user:manage`, because those routes BUY a number, change the agent's script
// or spend credit. This one hands over a hundred callers' phone numbers, what
// they said, and a link to the recording of them saying it. That is not a
// billing decision, it is the client book arriving by another door.
//
// `clientsProperties` at `full_view` is the dial that already draws exactly
// this line. It is the level lib/permissions/enforce.js strips a lead's
// `phone` below, and the level lib/permissions/nav.js hides the Clients row
// below, for the reason stated there: a crew member gets the address of the
// job they are driving to, not the company's customer list.
//
// It also keeps the person whose job this is. An Estimator (role `employee`,
// so `user:manage` would refuse them) sits at clientsProperties full_edit and
// is precisely who rings a missed call back. Gating on the coarse role would
// have hidden the inbox from its main user to protect it from Crew.
const CALLS_LEVEL = ["clientsProperties", "full_view"];

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Non-negotiable #3 again. loadEnforceableMember returns null for a support
  // session (it has no Member row and therefore no id), and hasLevel denies a
  // null member — correctly, for a real caller it cannot identify. Here that
  // would newly blind the console to a screen it could read yesterday, so the
  // read opts out explicitly. The PATCH below does NOT, and does not need to:
  // getCurrentMember refuses every write from an impersonation session.
  if (!member.impersonation) {
    const { response: denied } = await levelOrRefusal(
      member,
      ...CALLS_LEVEL,
      "see who has called",
    );
    if (denied) return denied;
  }

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
      // Whether this call reached us at the time or was pulled back from the
      // provider afterwards. A two-day-old call appearing in the list is
      // otherwise unexplained, and the explanation is not the contractor's
      // fault — see VoiceCall.recoveredAt.
      recoveredAt: true,
      leadRecoveredAt: true,
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
  const [heldCount, everHeldCount, voiceAgent] = await Promise.all([
    db.voicePhoneNumber.count({
      where: {
        companyId: member.companyId,
        status: { in: ["provisioning", "active", "porting"] },
      },
    }),
    // ANY number this company has ever held, whatever its status. A number
    // released last month still took calls that were rejected at our door, and
    // the reconciler matches on every VoicePhoneNumber row rather than the live
    // ones — so the recovery control has to be offered on the same basis, or it
    // would be hidden from exactly the company with lost calls to find.
    db.voicePhoneNumber.count({ where: { companyId: member.companyId } }),
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
    // ── Whether "Recover missed calls" can do anything ────────────────────
    //
    // All three have to be true, and each absence makes the button a lie:
    // no permission and the POST 403s, no provider key and it 503s, no number
    // ever held and there is nothing at the provider to find. A control that
    // is always going to fail should not be on the screen — AGENTS.md, the
    // rule that matters most.
    canRecover:
      can(member.role, "user:manage") && voiceConfigured() && everHeldCount > 0,
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
      recoveredAt: c.recoveredAt,
      // The lead on this call was read back off the recording rather than
      // taken by the agent on the line. Shown beside the lead link, because
      // "the assistant saved this" and "we reconstructed this from what they
      // said" are different levels of confidence and the person ringing back
      // should know which one they have.
      leadRecovered: Boolean(c.leadRecoveredAt),
    })),
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate as the read, deliberately, rather than a stricter one.
  // "I've looked at this" is triage ON the list — somebody allowed to see the
  // call and ring the person back is the somebody who clears the flag, and a
  // review queue only the owner can empty is a queue that never empties. What
  // it must not be is open to a member who cannot see the row it clears.
  const { response: denied } = await levelOrRefusal(
    member,
    ...CALLS_LEVEL,
    "mark a call reviewed",
  );
  if (denied) return denied;

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
