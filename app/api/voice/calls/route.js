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
import { CALL_AUDIO_LEVEL, callRecordingHref } from "@/lib/voice/recording";

// The dial, and the whole argument for it, now live in lib/voice/recording.js:
// /api/voice/calls/[id]/recording asks the identical question, and two copies
// of "who may hear a customer's call" is one copy that stays open after the
// other is tightened.
const CALLS_LEVEL = CALL_AUDIO_LEVEL;

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
      // ...and why one wasn't, when one wasn't. A skip that shows as nothing
      // reads as the AI not working, and the likeliest cause — a service the
      // company has never added — is only fixable by somebody who is told.
      quoteDraftSkipped: true,
      // Whether this one is off the working list, and who put it there.
      archivedAt: true,
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

  // ── The quote this call became, if it became one ────────────────────────
  //
  // Derived from Quote.sourceCallId rather than stored on the call. The quote
  // already carries the link; a second copy here would be the one that lies
  // after somebody deletes the quote, and "this call was dealt with" would then
  // point at nothing.
  //
  // Scoped by companyId as well as the id list, for the same reason the booking
  // join above is: a source id on a row is only as trustworthy as the row.
  const callIds = calls.map((c) => c.id);
  const quotes = callIds.length
    ? await db.quote.findMany({
        where: { companyId: member.companyId, sourceCallId: { in: callIds } },
        select: { id: true, quoteNumber: true, needsReview: true, sourceCallId: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  // First wins, and the list is newest-first: a call re-drafted after its first
  // quote was deleted shows the quote that still exists.
  const quoteByCall = new Map();
  for (const q of quotes) if (!quoteByCall.has(q.sourceCallId)) quoteByCall.set(q.sourceCallId, q);

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
      // ── The recording, as a path rather than the provider's link ─────────
      //
      // This used to be `recordingUrl: c.recordingUrl` — the provider's own
      // URL, handed to the browser. It is a bearer link (lib/voice/recording.js)
      // and nothing about it says so, so it survived into history, into
      // referrers and into anything that copied a link address, playable
      // forever by anyone who ended up with it.
      //
      // A boolean and a path instead: the audio is fetched by
      // /api/voice/calls/[id]/recording, which re-checks the session and the
      // tenant and streams it. The provider's URL now never leaves the server.
      recordingHref: c.recordingUrl ? callRecordingHref(c.id) : null,
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
      quoteDraftSkipped: c.quoteDraftSkipped || null,
      // What the call turned into, so the row can link to it rather than
      // announcing that a quote exists somewhere and leaving them to find it.
      quote: quoteByCall.get(c.id)
        ? {
            id: quoteByCall.get(c.id).id,
            number: quoteByCall.get(c.id).quoteNumber,
            needsReview: quoteByCall.get(c.id).needsReview,
          }
        : null,
      // Archived because somebody said so, or because it became a quote. Both
      // are reported; the screen does not have to know the rule.
      archivedAt: c.archivedAt,
      archived: Boolean(c.archivedAt) || quoteByCall.has(c.id),
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
    "update a call",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "No call" }, { status: 400 });

  // ── Two different verbs on one row, and they are not the same act ────────
  //
  // `reviewed` clears the FLAG: the agent marked something wrong — an
  // emergency, a failed call — and somebody has looked.
  //
  // `archived` clears it off the WORKING LIST: there is nothing left to do with
  // this call. Most calls are never flagged and still need this, because the
  // ordinary call that should have become a quote and didn't is the one nobody
  // remembers. Reversible on purpose: archiving is triage, and triage is wrong
  // sometimes.
  //
  // A call whose quote already exists is archived without either being set —
  // see the Quote.sourceCallId join in GET. Nothing writes that here, because a
  // stored copy would outlive a deleted quote.
  const data =
    body.archived === undefined
      ? { reviewedAt: new Date() }
      : {
          archivedAt: body.archived ? new Date() : null,
          archivedById: body.archived ? member.userId : null,
        };

  // Scoped by company in the WHERE, not checked after fetching — a call id from
  // another tenant must not be markable from here.
  const updated = await db.voiceCall.updateMany({
    where: { id, companyId: member.companyId },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
