// lib/sms/demoSms.js
//
// What happens instead of Twilio when the company sending is a sales demo.
//
// ══ The hazard, stated plainly ═════════════════════════════════════════════
//
// This is the SMS twin of lib/email/demoMail.js, and the hole was worse. Mail
// at least had accidental cover: lib/demo/seedDemo.js gives its fictional
// clients @example.com addresses, so a demo's mail usually went nowhere real.
// A phone number has no such convention — seedDemo writes plausible NANP
// numbers, and app/api/settings/referral/invite/route.js will happily take a
// phone number a rep types in and text it. A prospect the rep spoke to an hour
// ago receives a real SMS, from a real Twilio number, inviting them to a
// company that does not exist and will be re-dressed as a roofer next week
// (lib/demo/industries.js).
//
// It is the same object-that-outlives-the-demo shape lib/voice/demoLine.js
// describes for a Retell number, arriving through a different vendor.
//
// ══ Why this is a SUBSTITUTION and not a refusal ═══════════════════════════
//
// The owner's distinction, carried over verbatim from demoMail.js: a demo must
// not text a stranger, but this must not become "demos can't text", which
// breaks the thing the demo exists to show. A rep needs to watch the on-my-way
// text go out when they flip a visit to "on the way", the reminder cron mark an
// appointment reminded, the crew-line test say it sent.
//
// So all of that still happens. sendSms() returns the SAME success shape a real
// send returns ({ success: true, sid }), every caller writes its row and its
// timestamp on the line it always did, and the only thing that changes is that
// api.twilio.com is never called.
//
// ══ Why the record is an ActivityLog row ═══════════════════════════════════
//
// Same answer demoMail.js gives, and deliberately the same table rather than a
// second one: the activity trail renders arbitrary dotted verbs by their
// `summary` (app/app/activity/page.js reads /api/activity, which selects
// `summary` and nothing action-specific), so a row written here is visible to
// the rep today with no UI change — and to support through the platform
// console's copy of the same query. A demo walkthrough that shows the email
// that would have gone out and hides the text that would have gone out is
// half a demo.
//
// The row is written with `action: "sms.simulated"`, never the caller's own
// verb. The caller writes that one itself, unchanged, immediately afterwards.
// Two rows, because they are two different facts: the reminder WAS sent as far
// as the product is concerned, and the text was NOT put on the wire.
import { db } from "@/lib/db";

/**
 * A message SID shaped like Twilio's but unmistakable in a log.
 *
 * Deliberately prefixed rather than a plausible "SM" + 32 hex: this value is
 * handed back to callers as `sid` and is STORED — lib/crew/messaging.js's
 * chargeOutboundCrewReply keys its ledger idempotency on it. A support
 * engineer reading "demo_..." in a provider-id column learns the truth
 * immediately; a well-formed SM SID would send them to the Twilio console to
 * hunt for a message that was never created.
 */
function simulatedSid() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `demo_sms_${Date.now().toString(36)}${rand}`;
}

/**
 * Stand in for one Twilio call on behalf of a demo company.
 *
 * Returns the success shape sendSms() returns for a real send, plus
 * `simulated: true` for the callers that want to tell the rep rather than
 * leaving them to infer it from a phone that never buzzes.
 *
 * Never throws, and never lets its own failure become a send. If the log write
 * dies the text still did not go out, which is the property that matters; the
 * failure goes to the console rather than becoming an error the caller would
 * report as "the text couldn't be sent", because that is not what happened.
 */
export async function recordSimulatedSms({ companyId, to, from, body }) {
  const sid = simulatedSid();

  try {
    await db.activityLog.create({
      data: {
        companyId,
        // No actor. This is not somebody's action — it is the absence of one,
        // recorded beside the action that DID happen, which the caller writes
        // with its own real actor a moment later.
        action: "sms.simulated",
        entityType: "sms",
        summary: `Demo account — this text was NOT sent. To ${to || "nobody"}: “${String(body || "").slice(0, 120)}”`,
        metadata: {
          to: to || null,
          // The number it would have gone FROM, which is the detail that makes
          // this legible later: "from" being null means the send would have
          // fallen back to the shared system number, and that is a different
          // fact from a company texting off its own line.
          from: from || null,
          body: String(body || "").slice(0, 1600),
          sid,
        },
      },
    });
  } catch (err) {
    console.error("[demo sms] couldn't record the simulated send:", err?.message);
  }

  return { success: true, sid, simulated: true };
}
