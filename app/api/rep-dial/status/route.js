// app/api/rep-dial/status/route.js
//
// What the carrier saw: when it rang, whether it was answered, how long it
// lasted, and what it cost.
//
// ══ Why this route exists at all ══════════════════════════════════════════
//
// Without it, in-browser calling would produce a beautiful dialer that leaves
// no trace — which is precisely the state lib/platform/salesCall.js was
// written to end for FieldQuo's inbound line, and the state AGENTS.md opens by
// forbidding. Everything a supervisor board can honestly claim about talk time
// arrives through here.
//
// ══ It never touches the disposition ══════════════════════════════════════
//
// The network saying `completed` and a rep saying `reached_not_interested` are
// two different statements about one call, and the case where they disagree —
// a 40-second `completed` call the rep logged as `no_answer` — is the one
// worth being able to see. Mapping one onto the other would delete exactly
// that. So the provider columns and the disposition column are written by
// different things and neither overwrites the other.
//
// ══ Idempotent, because Twilio retries ═══════════════════════════════════
//
// The same event can arrive twice, and `completed` can arrive before
// `answered` on a slow path. attachProviderCall() sets fields rather than
// accumulating them, so a redelivery writes identical values instead of
// doubling a duration, and an out-of-order pair leaves both facts present.
//
// ══ The answer is an EMPTY 204 — null body — and never a 500 ══════════════
//
// For a day every event here answered 500 from its last line: `new
// NextResponse("", { status: 204 })` is refused by the Response constructor
// (a 204 may carry no body, and "" is one), after attachProviderCall had
// already written. lib/sales/calls/twilioAck.js is where that is written
// down once; `acknowledged()` is what turns any other throw into a logged
// error and a 204, because Twilio sends a call-progress event exactly once
// and a 500 is a warning in a console nobody opens.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { attachProviderCall, callStoreState } from "@/lib/sales/calls/store";
import { callCostCents } from "@/lib/sales/calls/browserDial";
import { recordError } from "@/lib/platform/errorLog";
import { acknowledged, noContent } from "@/lib/sales/calls/twilioAck";
import { answeredAtFrom } from "@/lib/sales/calls/providerStatus";

function parseTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request) {
  return acknowledged(() => handle(request), {
    area: "sales_dial",
    code: "status_webhook_threw",
    what: `A call status for attempt ${new URL(request.url).searchParams.get("attemptId") || "(unnamed)"}`,
  });
}

async function handle(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  // From the query string we ourselves put on the callback URL in the bridge,
  // not from the body. Twilio echoes the URL it was given; a body parameter
  // would be whatever the call leg carried.
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return noContent();

  const store = callStoreState();
  if (!store.ready) {
    // The event is genuinely lost, so it is recorded as lost rather than
    // swallowed into a 200 that looks like success — the failure mode the
    // telephony audit found in reconcileCalls and named as unrecoverable.
    await recordError({
      area: "sales_dial",
      message: `A call status arrived for attempt ${attemptId} before SalesCallAttempt existed. The duration is lost.`,
    }).catch(() => {});
    return noContent();
  }

  const status = typeof params.CallStatus === "string" ? params.CallStatus : null;
  const seconds = Number(params.CallDuration);
  const at = parseTime(params.Timestamp) || new Date();
  // `completed` is stamped at the hang-up; the pickup is end minus duration.
  // lib/sales/calls/providerStatus.js says why that is not simply `at`.

  await attachProviderCall({
    attemptId,
    providerCallSid: typeof params.CallSid === "string" ? params.CallSid : null,
    providerStatus: status,
    ringingAt: status === "ringing" ? at : null,
    answeredAt: answeredAtFrom({ status, at, seconds }),
    endedAt: status === "completed" ? at : null,
    // Twilio sends CallDuration only on the terminal event. A zero here is a
    // real zero — a call that connected and lasted no seconds — so the guard
    // is finiteness, not truthiness, and an absent field stays absent.
    talkSeconds: Number.isFinite(seconds) ? seconds : null,
    providerCostCents: callCostCents(params.Price),
  }).catch(async (err) => {
    await recordError({
      area: "sales_dial",
      message: `Could not attach a call status to attempt ${attemptId}: ${err?.message}`,
    }).catch(() => {});
  });

  // Twilio wants a 2xx and reads nothing. An empty 204 rather than TwiML: this
  // is a notification, not a request for instructions, and returning a
  // document here would be answering a question nobody asked.
  return noContent();
}
