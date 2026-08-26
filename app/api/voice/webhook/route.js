// app/api/voice/webhook/route.js
//
// What Retell tells us about a call.
//
//   call_started   someone rang
//   call_ended     they hung up — this is where we bill
//   call_analyzed  the transcript and summary are ready
//
// ── This endpoint is PUBLIC ────────────────────────────────────────────────
//
// It has to be — the provider posts to it with no session. So the signature is
// the only thing standing between a stranger and the ability to write calls,
// leads and charges into any company's account. Verified first, before the body
// is parsed for anything, and rejected outright when no key is set:
// "unverified because unconfigured" is how a staging misconfiguration becomes a
// public write endpoint.
//
// ── The verification was wrong, and it rejected EVERY real delivery ────────
//
// It hand-rolled `hmac(RETELL_WEBHOOK_SECRET, rawBody) === header`. Retell
// sends `v=<unix-ms>,d=<hex>`, signs `rawBody + timestamp`, and keys it with an
// API KEY rather than any secret we could invent. The comparison could not
// match, and the 401 it returned looks exactly like a phone nobody rang — which
// is why the owner's account has zero VoiceCall rows. See
// lib/voice/webhookSignature.js for the whole autopsy.
//
// A refusal is now recorded, rate-limited, so the readiness check on the
// settings screen can say "Retell is calling us and we are turning it away".
//
// ── Which company ──────────────────────────────────────────────────────────
//
// Resolved from the NUMBER that was dialled, not from anything in the payload
// claiming a company id. The number is ours, it's unique, and it can't be
// spoofed into pointing at a different tenant.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toE164 } from "@/lib/voice/numbers";
import { chargeCall, canTakeCall } from "@/lib/voice/credits";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { pushCallCeiling } from "@/lib/voice/callCeiling";
import { recordError } from "@/lib/platform/errorLog";
import { verifyRetellSignature, signingKeys } from "@/lib/voice/webhookSignature";
import { recordRejectedDelivery } from "@/lib/voice/webhookHealth";

export async function POST(request) {
  const raw = await request.text();

  const check = verifyRetellSignature({
    rawBody: raw,
    header: request.headers.get("x-retell-signature"),
    keys: signingKeys(),
  });
  if (!check.ok) {
    // Written down before the 401. Silence here is what let a completely
    // broken verifier look like an idle phone for months.
    await recordRejectedDelivery({ reason: check.reason, endpoint: "/api/voice/webhook" });
    // 401 and nothing else on the wire. No hint about whether a key is missing
    // or the digest is wrong — that difference is only useful to someone
    // probing, and it is already in our own log for the people who need it.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const type = event?.event;
  const call = event?.call || {};
  const providerCallId = call.call_id;
  if (!providerCallId) {
    return NextResponse.json({ error: "No call id" }, { status: 400 });
  }

  // Which number is OURS depends on direction. Inbound: they dialled our
  // number, so it's `to_number`. Outbound: WE dialled them, so ours is
  // `from_number` and `to_number` is the customer's. Resolving the tenant from
  // the customer's number on an outbound call would find nothing and drop every
  // outbound result on the floor.
  const isOutbound = call.direction === "outbound";
  const ourNumber = toE164(isOutbound ? call.from_number : call.to_number);
  const number = ourNumber
    ? await db.voicePhoneNumber.findUnique({
        where: { e164: ourNumber },
        select: { id: true, companyId: true, agentId: true, numberType: true },
      })
    : null;

  if (!number) {
    // A call to a number we don't have on file. Logged rather than 404'd: it
    // means a number was provisioned at the provider and never recorded here,
    // and the symptom otherwise is calls silently vanishing.
    await recordError({
      area: "voice_webhook",
      message: `Call to an unknown number: ${ourNumber || call.to_number}`,
      detail: { providerCallId, type },
    }).catch(() => {});
    return NextResponse.json({ ok: true, ignored: "unknown_number" });
  }

  try {
    if (type === "call_started") {
      await db.voiceCall.upsert({
        where: { providerCallId },
        create: {
          providerCallId,
          companyId: number.companyId,
          numberId: number.id,
          agentId: number.agentId,
          direction: call.direction === "outbound" ? "outbound" : "inbound",
          fromE164: toE164(call.from_number),
          toE164: toE164(call.to_number),
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
        },
        // Retell retries. A second call_started must not create a duplicate row
        // or reset the one already there.
        update: {},
      });
      return NextResponse.json({ ok: true });
    }

    if (type === "call_ended" || type === "call_analyzed") {
      const seconds = Math.max(
        0,
        Math.round(
          Number(call.duration_ms ? call.duration_ms / 1000 : call.duration_seconds) || 0,
        ),
      );

      await db.voiceCall.upsert({
        where: { providerCallId },
        create: {
          providerCallId,
          companyId: number.companyId,
          numberId: number.id,
          agentId: number.agentId,
          direction: call.direction === "outbound" ? "outbound" : "inbound",
          fromE164: toE164(call.from_number),
          toE164: toE164(call.to_number),
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
          endedAt: new Date(),
          durationSec: seconds,
          disposition: call.disconnection_reason || null,
          transcript: call.transcript_object || call.transcript || null,
          summary: call.call_analysis?.call_summary || null,
          recordingUrl: call.recording_url || null,
        },
        update: {
          endedAt: new Date(),
          // Fill in the number/agent on a row that was created before the
          // webhook — an outbound call's VoiceCall is created at dial time with
          // its subject links but no number id. Stable values, safe to set.
          numberId: number.id,
          agentId: number.agentId,
          // call_analyzed arrives after call_ended and can report a slightly
          // different duration. Overwriting is fine — BILLING is idempotent on
          // the call id, so whichever event arrives first is what was charged,
          // and this column is the record of the call rather than the invoice.
          durationSec: seconds,
          disposition: call.disconnection_reason || undefined,
          transcript: call.transcript_object || call.transcript || undefined,
          summary: call.call_analysis?.call_summary || undefined,
          recordingUrl: call.recording_url || undefined,
        },
      });

      // Charged once, idempotent on the call id — call_ended and call_analyzed
      // both carry a duration, and billing twice for one call costs the trust
      // rather than the money.
      if (seconds > 0) {
        await chargeCall({
          companyId: number.companyId,
          callId: providerCallId,
          seconds,
          numberType: number.numberType,
        });
      }

      // ── The balance moved, so both enforcement points have to follow ──────
      //
      // Priced against the number that took the call. Asking canTakeCall
      // without a type checks a toll-free customer against the 35¢ local rate,
      // which lets the next call start 5¢ short of what it will cost.
      const after = await canTakeCall(number.companyId, number.numberType);

      if (!after.allowed) {
        await recordError({
          area: "voice_credit",
          message: `Voice credit exhausted for company ${number.companyId}`,
          detail: { balanceCents: after.cents },
        }).catch(() => {});
        // Stop answering rather than keep taking calls we can't bill. Detaching
        // the agent is the only enforcement point we control — Retell has already
        // accepted the call by the time we see it, so a check here can't refuse
        // THIS one, but it does refuse the next. Reversed automatically on top-up.
        await syncNumberAttachment(number.companyId).catch(() => {});
      }

      // The ceiling, EVERY time and not only on exhaustion. It is the only
      // thing standing between a two-minute balance and an hour-long call, and
      // it has to come down as the balance does — a company that started the
      // day with an hour's credit keeps an hour-long ceiling otherwise, right
      // up to the call that takes them negative. Cheap: writing an unchanged
      // value is a no-op at the provider.
      await pushCallCeiling(number.companyId).catch(() => {});

      return NextResponse.json({ ok: true, billedSeconds: seconds });
    }

    // An event type we don't handle yet. 200, so the provider doesn't retry it
    // forever — an unknown event is not a failure.
    return NextResponse.json({ ok: true, ignored: type });
  } catch (err) {
    await recordError({
      area: "voice_webhook",
      message: `Voice webhook failed: ${err.message}`,
      detail: { providerCallId, type },
    }).catch(() => {});
    // 500 so Retell retries — a database blip should be retried.
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
