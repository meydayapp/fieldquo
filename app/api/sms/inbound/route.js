// app/api/sms/inbound/route.js
//
// A homeowner texted a company's CLIENT-FACING number. Twilio posts here.
//
// ══ The bug this closes ═════════════════════════════════════════════════
//
// lib/sms/templates.js tells every client "Reply STOP to opt out" (see
// appointmentReminderText). Nothing in this repo ever listened for it — the
// only inbound SMS webhook was app/api/crew/inbound, which resolves against
// CrewInboxNumber (the CREW line) and would 200-and-ignore a homeowner's text
// even if Twilio somehow routed one there. A promise with no listener behind
// it is exactly the class of bug AGENTS.md keeps naming: a control that
// appears to work and doesn't.
//
// ══ Which number, which company ════════════════════════════════════════
//
// Resolved from `To` against Company.smsFromNumber, which is now @unique in
// the schema for exactly this lookup (see its doc comment) — mirroring how
// crew/inbound resolves against CrewInboxNumber.e164. A company with NO
// smsFromNumber (using the shared system fallback, per lib/sms/
// systemNumber.js) is NOT reachable through this route: the shared number
// can't be attributed to one tenant from `To` alone, the same limitation
// crew/inbound's "shared_test" line solves with a claim table this number has
// no equivalent of. A company on the shared number gets no working STOP today
// — that's a real gap, not a silently-dropped one: see the report this PR
// shipped with for what the owner needs to decide about it.
//
// ══ This is not a client inbox ══════════════════════════════════════════
//
// The only thing this route does with an inbound message is check it against
// the opt-out/opt-in keyword list. Anything else — a real question from a
// homeowner — is acknowledged (200, so Twilio doesn't retry) and otherwise
// ignored. Building a two-way client-texting inbox is a different, much
// bigger feature; this route exists to make "Reply STOP" true, not to read
// everything that arrives.
//
// ══ Twilio may already be doing this — genuinely unknown from this repo ═══
//
// Twilio has an account/number-level "Advanced Opt-Out" feature that can
// auto-detect STOP-family keywords, send its own confirmation text, and block
// future sends to that number — independently of whatever this webhook does.
// Whether it's ON for the number(s) FieldQuo's companies use is a Twilio
// CONSOLE setting (Phone Numbers → Manage → the number → Messaging
// configuration, or account-wide under Messaging → Settings, depending on
// which Twilio product tier and console version this account is on) — it is
// not visible anywhere in this codebase or its environment variables, and
// nothing here should claim to know it.
//
// So: this webhook ALWAYS records the opt-out/opt-in (that's the durable,
// idempotent, side-effect-free-if-run-twice half — see lib/sms/optOut.js).
// It only sends ITS OWN confirmation text when SMS_OPT_OUT_SEND_CONFIRMATION
// is explicitly set to "true". Left unset (the default), the safer assumption
// wins: Twilio's own Advanced Opt-Out may already be replying, and a SECOND
// confirmation from this route would be a double-reply that contradicts or
// duplicates carrier-level behaviour — which is worse than one company's
// clients getting no confirmation text for a few days.
//
// ═══ WHAT THE OWNER MUST CONFIRM IN THE TWILIO CONSOLE ═══════════════════
//   1. For each number in Company.smsFromNumber, check whether Advanced
//      Opt-Out (or equivalent STOP/START auto-handling) is ON or OFF.
//   2. If OFF everywhere — set SMS_OPT_OUT_SEND_CONFIRMATION=true so this
//      route's own confirmation actually goes out.
//   3. If ON — leave the env var unset. This route still records every
//      opt-out/opt-in either way; only the extra text is gated.
//   4. Point each smsFromNumber's Messaging webhook at this route's URL
//      (this app's origin + /api/sms/inbound) — nothing in this codebase can
//      do that from here; it's a per-number Twilio console action, same as
//      the crew line's webhook being FieldQuo's to set, not a tenant's.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { classifyInboundSms } from "@/lib/sms/optOutKeywords";
import { recordSmsOptOut, recordSmsOptIn } from "@/lib/sms/optOut";
import { sendSms } from "@/lib/sms/twilioClient";
import { recordError } from "@/lib/platform/errorLog";

function twiml() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

// See the file header's "WHAT THE OWNER MUST CONFIRM" section. Any value
// other than the literal string "true" is treated as unset/false — the safe
// default of not double-replying.
function shouldSendOwnConfirmation() {
  return process.env.SMS_OPT_OUT_SEND_CONFIRMATION === "true";
}

function optOutConfirmation(companyName) {
  return `${companyName}: You're unsubscribed and won't receive any more texts from this number. Reply START to receive texts again.`;
}

function optInConfirmation(companyName) {
  return `${companyName}: You're resubscribed. Reply STOP at any time to opt out.`;
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = params.To;
  const from = params.From;
  const body = params.Body || "";
  if (!to || !from) return twiml();

  const company = await db.company.findUnique({
    where: { smsFromNumber: to },
    select: { id: true, name: true },
  });
  // Not a company's client-facing number (a stray webhook, the shared
  // system number, a stale row). Nothing to do — silent 200 so Twilio
  // doesn't retry, same as crew/inbound's "not ours" case.
  if (!company) return twiml();

  const verdict = classifyInboundSms(body);
  if (!verdict) return twiml(); // not a keyword — this route isn't an inbox

  try {
    if (verdict === "opt_out") {
      await recordSmsOptOut({ companyId: company.id, phone: from, body });
      if (shouldSendOwnConfirmation()) {
        await sendSms({ to: from, from: to, body: optOutConfirmation(company.name) }).catch((err) =>
          recordError({
            area: "sms_opt_out",
            message: `Opt-out confirmation text failed: ${err.message}`,
            companyId: company.id,
          }).catch(() => {}),
        );
      }
    } else {
      await recordSmsOptIn({ companyId: company.id, phone: from, body });
      if (shouldSendOwnConfirmation()) {
        await sendSms({ to: from, from: to, body: optInConfirmation(company.name) }).catch((err) =>
          recordError({
            area: "sms_opt_out",
            message: `Opt-in confirmation text failed: ${err.message}`,
            companyId: company.id,
          }).catch(() => {}),
        );
      }
    }
  } catch (err) {
    // The opt-out/opt-in record failing to WRITE is the one failure mode
    // worth logging loudly — it's the entire point of this route. A failed
    // confirmation text (handled above) is not: the record still landed.
    await recordError({
      area: "sms_opt_out",
      message: `Failed to record SMS ${verdict}: ${err.message}`,
      companyId: company.id,
      detail: { to, from },
    }).catch(() => {});
  }

  return twiml();
}
