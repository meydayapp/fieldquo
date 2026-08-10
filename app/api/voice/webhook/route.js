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
// is parsed for anything, and rejected outright when the secret isn't set:
// "unverified because unconfigured" is how a staging misconfiguration becomes a
// public write endpoint.
//
// ── Which company ──────────────────────────────────────────────────────────
//
// Resolved from the NUMBER that was dialled, not from anything in the payload
// claiming a company id. The number is ours, it's unique, and it can't be
// spoofed into pointing at a different tenant.
export const runtime = "nodejs";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toE164 } from "@/lib/voice/numbers";
import { chargeCall, canTakeCall } from "@/lib/voice/credits";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { recordError } from "@/lib/platform/errorLog";

/**
 * Timing-safe signature check.
 *
 * A plain `===` on an HMAC leaks its own answer through how long it takes to
 * fail, which is enough to forge one given patience. `timingSafeEqual` doesn't —
 * but it throws on a length mismatch, so the lengths are compared first.
 */
function verify(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request) {
  const raw = await request.text();
  const signature = request.headers.get("x-retell-signature");
  const secret = process.env.RETELL_WEBHOOK_SECRET;

  if (!verify(raw, signature, secret)) {
    // 401 and nothing else. No hint about whether the secret is missing or the
    // signature is wrong — that difference is only useful to someone probing.
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
      source: "voice_webhook",
      message: `Call to an unknown number: ${ourNumber || call.to_number}`,
      metadata: { providerCallId, type },
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

      // Out of credit after this call — worth knowing at the moment it happens,
      // because the next caller gets nothing.
      const after = await canTakeCall(number.companyId);
      if (!after.allowed) {
        await recordError({
          source: "voice_credit",
          message: `Voice credit exhausted for company ${number.companyId}`,
          metadata: { balanceCents: after.cents },
        }).catch(() => {});
        // Stop answering rather than keep taking calls we can't bill. Detaching
        // the agent is the only enforcement point we control — Retell has already
        // accepted the call by the time we see it, so a check here can't refuse
        // THIS one, but it does refuse the next. Reversed automatically on top-up.
        await syncNumberAttachment(number.companyId).catch(() => {});
      }

      return NextResponse.json({ ok: true, billedSeconds: seconds });
    }

    // An event type we don't handle yet. 200, so the provider doesn't retry it
    // forever — an unknown event is not a failure.
    return NextResponse.json({ ok: true, ignored: type });
  } catch (err) {
    await recordError({
      source: "voice_webhook",
      message: `Voice webhook failed: ${err.message}`,
      metadata: { providerCallId, type },
    }).catch(() => {});
    // 500 so Retell retries — a database blip should be retried.
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
