// app/api/rep-dial/inbound/route.js
//
// A contractor rings back one of the numbers a FieldQuo rep called them from.
// Until this existed, they reached nothing at all.
//
// ══ The sequence this ends ════════════════════════════════════════════════
//
// A closer rings a roofer from a local number, because a contractor in Tulsa
// answers a 918 number and lets an unknown one ring out. The roofer is on a
// roof. Two hours later they see a missed call and ring it back — and the
// number was bought, pointed at nothing, and answered by nobody. That is the
// most qualified inbound call this business can receive.
//
// ══ Why it is NOT under /api/sales ════════════════════════════════════════
//
// Identical to its siblings /api/rep-dial/bridge and /api/rep-dial/status, and
// their reasoning is copied here rather than referenced because it is the kind
// of thing that gets undone by a rename: middleware.js refuses everything
// under `/api/sales` that does not carry a rep's cookie, and Twilio posts from
// its own infrastructure with no session at all. Note also that a path
// beginning `/api/sales-` would still match the prefix —
// `"/api/sales-inbound".startsWith("/api/sales")` is true — so the sibling
// namespace is the answer rather than a hyphen.
//
// ══ The signature IS the access control ═══════════════════════════════════
//
// Through the same lib/sms/verifyTwilioWebhook.js the crew inbound route and
// both rep-dial siblings use, so a fix to the URL reconstruction lands on all
// of them at once. Note what it requires: the account's AUTH TOKEN
// specifically. A deployment holding only API keys can mint access tokens and
// place calls while being unable to verify a single webhook.
//
// An unsigned endpoint here would be worse than an unsigned SMS one: a
// stranger who could post to it would make FieldQuo's Twilio account dial the
// transfer destination, on FieldQuo's bill, as often as they liked.
//
// ══ NOTHING IN THE REQUEST CHOOSES A DESTINATION ══════════════════════════
//
// The same property that makes the bridge safe. `To` selects a row from
// PlatformSmsNumber and is otherwise inert; the number dialled on the transfer
// leg comes from FIELDQUO_SALES_TRANSFER_TO, an environment variable. There is
// no request shape that reaches a number of the caller's choosing, which is
// what stops this being an open relay for toll fraud.
//
// ══ The calling window is NOT consulted, and that is the point ════════════
//
// lib/sales/callingRules.js governs when FieldQuo may RING a business. A
// business ringing FieldQuo has chosen the moment. Gating an inbound answer on
// the outbound window would refuse a prospect who is trying to buy — see
// lib/sales/calls/inboundRouting.js's header, and
// docs/sales-intel/CALL-HANDLING.md §6, which said so before this was built.
// scripts/check-sales-inbound-call.mjs asserts this file imports no part of
// the calling-window module.
//
// ══ Nothing is recorded ═══════════════════════════════════════════════════
//
// No `record` attribute on the Dial, no <Record>, no transcription. The
// decision and its reasoning live on the plan in inboundRouting.js so that a
// future change has to argue with the comment rather than add a parameter.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { checkSuppression } from "@/lib/sales/suppression";
import { canAuthenticate } from "@/lib/sales/invite";
import { matchInboundCaller } from "@/lib/sales/calls/inboundMatch";
import {
  INBOUND_CONNECT,
  afterTransfer,
  anyRepLive,
  fallbackSayFor,
  inboundPlan,
} from "@/lib/sales/calls/inboundRouting";
import {
  attachProviderCall,
  callStoreState,
  lastOutboundBetween,
  presenceFor,
  recordInbound,
  salesVoiceNumber,
} from "@/lib/sales/calls/store";

/** The voice Twilio's <Say> uses. The same one the bridge refuses with. */
const VOICE = "alice";

/**
 * TwiML that speaks the lines and hangs up.
 *
 * Always a 200 with a document. Twilio treats a non-2xx as a failed webhook
 * and plays its own error announcement — "an application error has occurred" —
 * which is the worst possible thing for a prospect to hear on a number a
 * salesperson gave them. So every branch of this file answers with TwiML that
 * says something true, and the machine-readable failure goes to
 * /platform/errors instead.
 */
function speak(lines) {
  const twiml = new twilio.twiml.VoiceResponse();
  for (const line of lines || []) twiml.say({ voice: VOICE }, line);
  twiml.hangup();
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * The rep to attribute this call to, re-read and re-checked in this request.
 *
 * ── A rep who has left is not the answer ────────────────────────────────
 *
 * canAuthenticate() is the same predicate the calling gate uses, applied for a
 * different purpose: a departed rep's console will never be opened again, so
 * attributing a callback to them files it where nobody will look. That is
 * worse than filing it nowhere, because a row with a rep's name on it reads as
 * handled. With no eligible rep the row is written unattributed and shows on
 * the superadmin floor board, which is a place somebody actually looks.
 */
async function repToTell(candidateIds) {
  for (const id of candidateIds) {
    if (!id) continue;
    const row = await db.salesRep
      .findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          active: true,
          endedAt: true,
          acceptedAt: true,
          passwordHash: true,
        },
      })
      .catch(() => null);
    if (row && canAuthenticate(row)) return { id: row.id, name: row.name };
  }
  return null;
}

/**
 * The second leg: the transfer ended, one way or another.
 *
 * Twilio posts back here with DialCallStatus because the <Dial> below carries
 * an `action`. Answering with an empty document would hang up on a caller who
 * has just listened to twenty seconds of ringing and been told nothing, so a
 * call nobody took gets the same sentence it would have got if we had never
 * tried to transfer it — carried on the plan rather than recomputed, so the
 * two cannot drift apart.
 */
async function afterDial(request, params) {
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  const status = typeof params.DialCallStatus === "string" ? params.DialCallStatus : null;
  const seconds = Number(params.DialCallDuration);

  // The rep's name is re-read from the attempt rather than carried across the
  // two legs in the query string. Two reasons, and the second is the one that
  // decided it: a name in a URL is a name in Twilio's request logs, and a
  // value round-tripped through a webhook is a value the webhook could have
  // been handed by somebody else. The row is ours and is scoped by id.
  let repName = null;
  if (attemptId && callStoreState().ready) {
    const row = await db.salesCallAttempt
      .findFirst({
        where: { id: attemptId, direction: "in" },
        select: { salesRep: { select: { name: true } } },
      })
      .catch(() => null);
    repName = row?.salesRep?.name || null;
  }

  const result = afterTransfer({
    dialCallStatus: status,
    plan: { fallbackSay: fallbackSayFor({ repName }) },
  });

  if (attemptId && callStoreState().ready) {
    // What the carrier saw about the leg we placed to the desk. Never a
    // disposition: the network saying `completed` and a person saying what the
    // conversation was are two different statements, and /api/rep-dial/status
    // holds the same line for outbound.
    await attachProviderCall({
      attemptId,
      providerStatus: status,
      answeredAt: result.answered ? new Date() : null,
      endedAt: new Date(),
      // Zero is a real answer — answered and hung up immediately — so the
      // guard is finiteness, not truthiness.
      talkSeconds: Number.isFinite(seconds) ? seconds : null,
    }).catch(async (err) => {
      await recordError({
        area: "sales_inbound",
        message: `Could not attach a transfer result to attempt ${attemptId}: ${err?.message}`,
      }).catch(() => {});
    });
  }

  if (result.answered) {
    // Somebody took it. Nothing left to say; ending the document ends the call
    // that has already ended.
    const twiml = new twilio.twiml.VoiceResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  return speak(result.say);
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    // 403 with no body, exactly as the bridge and status siblings answer. An
    // unsigned request is not a caller to explain ourselves to.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("stage") === "after-dial") {
    return afterDial(request, params);
  }

  const store = callStoreState();
  const rung = normalisePhone(params.To);
  const caller = normalisePhone(params.From);
  const callSid = typeof params.CallSid === "string" ? params.CallSid : null;

  // ── Is this one of ours, and is it a SALES number? ──────────────────────
  //
  // Scoped in the query to purpose "sales_voice" and active, so a number whose
  // purpose is `system` — which sends and receives on behalf of TENANTS —
  // resolves to nothing here rather than to a row a later branch might use. A
  // contractor's crew line answering with FieldQuo's sales message would be a
  // white-label breach as well as a wrong answer.
  const numberRung = rung ? await salesVoiceNumber(rung).catch(() => null) : null;

  if (!numberRung) {
    await recordError({
      area: "sales_inbound",
      code: "unknown_number",
      message: `A call arrived at the sales inbound webhook for ${rung || "an unreadable number"}, which is not an active sales_voice number.`,
      detail: { to: params.To || null, callSid },
    }).catch(() => {});
    return speak(inboundPlan({ numberRung: null }).say);
  }

  if (!store.ready) {
    await recordError({
      area: "sales_inbound",
      code: "call_store_unavailable",
      message: `A contractor rang ${numberRung.e164} and the call could not be recorded: ${store.missing.join(", ")} missing.`,
      detail: { missing: store.missing, callSid },
    }).catch(() => {});
    return speak(inboundPlan({ numberRung, storeReady: false }).say);
  }

  // ── Who is ringing, and who should hear about it ────────────────────────
  //
  // Every read is scoped and none of them is allowed to fail the call: a
  // database hiccup must produce a call that is answered and logged plainly,
  // not a Twilio error announcement. Hence the catch on each, and hence `null`
  // rather than `[]` where the difference matters — matchInboundCaller draws
  // the distinction between "nobody carries this number" and "we could not
  // look", and so does the presence read.
  const [prospects, leads, lastOut, suppression, presence] = await Promise.all([
    caller
      ? db.prospect
          .findMany({
            where: { phoneE164: caller },
            select: { id: true, businessName: true, assignedRepId: true },
            take: 5,
          })
          .catch(() => [])
      : Promise.resolve([]),
    caller
      ? db.salesLead
          .findMany({
            where: { phone: caller },
            select: { id: true, businessName: true, salesRepId: true, prospectId: true },
            take: 5,
          })
          .catch(() => [])
      : Promise.resolve([]),
    caller
      ? lastOutboundBetween({ contactE164: caller, ourE164: numberRung.e164 }).catch(() => null)
      : Promise.resolve(null),
    // The do-not-contact list still binds, and answering is not a breach of
    // it — they rang us. What it changes is that this call is not an opening
    // to sell, and NOTHING on this path clears the entry: there is no write to
    // salesSuppression anywhere in this file, in either direction.
    caller
      ? checkSuppression(db, { channel: "phone", phone: caller }).catch(() => null)
      : Promise.resolve(null),
    db.salesRep
      .findMany({ where: { active: true }, select: { id: true } })
      .then((reps) => presenceFor(reps.map((r) => r.id)))
      .catch(() => null),
  ]);

  const match = matchInboundCaller({ fromE164: params.From, prospects, leads });

  // The rep who rang them from THIS number wins over the rep who happens to
  // hold the claim: the contractor is ringing back the number on their screen,
  // and the person who put it there is the person with the context. The claim
  // holder is the fallback, and inboundMatch.js is explicit that reporting a
  // claim holder is telling somebody their prospect rang — never authority to
  // give them anything.
  const rep = await repToTell([lastOut?.salesRepId, match.salesRepId]);

  const plan = inboundPlan({
    numberRung,
    storeReady: true,
    fromE164: caller,
    match,
    rep,
    anyRepLive: anyRepLive(presence),
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
    suppressed: Boolean(suppression?.suppressed),
  });

  // ── The row, before anything is answered ────────────────────────────────
  //
  // A failure to write it does not drop the call — the contractor is on the
  // line and hanging up on them to protect a log would be the wrong trade —
  // but it is recorded loudly, because a call that leaves no trace is the
  // state this route exists to end.
  let attempt = null;
  if (plan.recordAttempt) {
    const written = await recordInbound({
      salesRepId: rep?.id || null,
      // Only ever the single unambiguous match. `ambiguous` deliberately
      // attaches to nothing: two businesses carry this number, prospect
      // dedupe flags rather than merges, and picking one would file a call
      // against the wrong company with no way to notice afterwards.
      prospectId: match.prospectId,
      leadId: match.salesLeadId,
      contactE164: caller,
      ourE164: numberRung.e164,
      providerCallSid: callSid,
      matchedBy: match.matchedBy,
    }).catch(async (err) => {
      await recordError({
        area: "sales_inbound",
        code: "attempt_write_failed",
        message: `A contractor rang ${numberRung.e164} and the attempt row could not be written: ${err?.message}`,
        detail: { callSid, matchOutcome: match.outcome },
      }).catch(() => {});
      return null;
    });
    attempt = written?.attempt || null;
  }

  if (plan.action !== INBOUND_CONNECT) {
    return speak(plan.say);
  }

  const origin = getAppOrigin(request);
  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({
    // The CALLER's number, so whoever picks the desk up sees who is ringing.
    // Twilio's rule is that a callerId must be a number the account owns or a
    // verified one, with an explicit exception for forwarding an incoming
    // call, which is exactly what this is. A withheld caller ID falls back to
    // the sales_voice number that was rung — a number FieldQuo owns, so the
    // leg is placeable either way.
    callerId: caller || numberRung.e164,
    timeout: plan.timeoutSeconds,
    answerOnBridge: true,
    // The attempt id travels in the query string we build, never in the body:
    // Twilio echoes the URL it was given, and a body parameter would be
    // whatever the leg happened to carry. Same rule /api/rep-dial/status
    // states for the outbound direction.
    action: attempt
      ? `${origin}/api/rep-dial/inbound?stage=after-dial&attemptId=${encodeURIComponent(attempt.id)}`
      : `${origin}/api/rep-dial/inbound?stage=after-dial`,
    method: "POST",
    // No `record`. See lib/sales/calls/inboundRouting.js — recording a
    // two-party call is consent law rather than an attribute, and its absence
    // here is the decision, not an oversight.
  });
  dial.number(plan.transferTo);

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
