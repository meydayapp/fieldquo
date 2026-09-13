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
// ══ And one number with no company behind it ═══════════════════════════
//
// FieldQuo's own sales number posts here too. It is a PlatformSmsNumber with
// purpose "sales" — no tenant, no Company row — so the lookup below can never
// resolve it, and before this branch existed a prospect replying STOP to a
// rep's text would have been dropped with a silent 200. That opt-out binds
// FieldQuo rather than any one company, so it is written to the platform-wide
// do-not-contact list instead of to SmsOptOut, which is per-tenant. See
// handleSalesInboundSms in lib/sales/salesSms.js, including why START does NOT
// reverse it there while it does here.
//
// ══ Which number, which company ════════════════════════════════════════
//
// Resolved by lib/sms/clientLine.js, which is also where every client text
// picks its `from` — one decision, both directions. Two cases:
//
//   1. `To` is a company's own Company.smsFromNumber (@unique for exactly this
//      lookup, mirroring CrewInboxNumber.e164 on the crew line). One tenant.
//
//   2. `To` is FieldQuo's shared system number (lib/sms/systemNumber.js). As
//      of this writing NOTHING writes smsFromNumber — no settings screen, no
//      provisioning path; the crew line and the receptionist's number are
//      different tables for different jobs — so this is the case every
//      company is in, and before clientLine.js it resolved to nobody: the
//      STOP fell through to the sales branch below, matched no sales number,
//      and was dropped with a 200. "Reply STOP to opt out" was on every
//      reminder and had never worked. The shared number cannot be attributed
//      from `To`, so it is attributed from the SENDER: the STOP is recorded
//      for every company holding that phone on a client record, which is the
//      only honest reading of "stop" sent to a line that texts for many.
//
// Neither case is a lookup on the body. The body decides only STOP vs START.
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
//   1. For each number in Company.smsFromNumber AND the shared system number
//      (PlatformSmsNumber purpose "system"), check whether Advanced Opt-Out
//      (or equivalent STOP/START auto-handling) is ON or OFF.
//   2. If OFF everywhere — set SMS_OPT_OUT_SEND_CONFIRMATION=true so this
//      route's own confirmation actually goes out.
//   3. If ON — leave the env var unset. This route still records every
//      opt-out/opt-in either way; only the extra text is gated.
//   4. Point each smsFromNumber's Messaging webhook — and the shared system
//      number's — at this route's URL (this app's origin + /api/sms/inbound).
//      Nothing in this codebase can do that from here; it's a per-number
//      Twilio console action, same as the crew line's webhook being
//      FieldQuo's to set, not a tenant's. One caveat the schema itself
//      records: `system` and `shared_test` may be ONE number, and a number
//      on loan as a crew test line has its webhook pointed at
//      /api/crew/inbound, which resolves the sender as crew and never reads
//      STOP. While that loan is out, a homeowner's STOP to the shared line
//      does not reach this route at all.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { classifyInboundSms } from "@/lib/sms/optOutKeywords";
import { recordSmsOptOut, recordSmsOptIn } from "@/lib/sms/optOut";
import { sendSms } from "@/lib/sms/twilioClient";
import { handleSalesInboundSms } from "@/lib/sales/salesSms";
import { resolveInboundTenants } from "@/lib/sms/clientLine";
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

  // The dedicated owner of `to`, else every holder of `from` when `to` is
  // the shared line — see the header and lib/sms/clientLine.js. Empty when
  // the number is neither, which is the sales branch's cue below.
  const tenants = await resolveInboundTenants({ to, from });
  const company = tenants.companies[0] || null;

  // ── Not a tenant's number. It may be FieldQuo's OWN sales number ─────────
  //
  // A sales number is a PlatformSmsNumber with purpose "sales", which has no
  // tenant behind it at all, so the lookup above can never find it. The STOP
  // that arrives there is FieldQuo's to honour — it binds the company, not one
  // rep's copy of a lead — and it is written to the platform-wide
  // do-not-contact list rather than to SmsOptOut, which is per-tenant and would
  // silence exactly one company. See lib/sales/salesSms.js.
  //
  // Handled here rather than at a route of its own because this endpoint
  // already does the two hard parts: it verifies the Twilio signature, and it
  // is the URL a number's messaging webhook points at. A second public webhook
  // would be a second signature check to keep correct.
  if (!company) {
    // `schedule: after` — the reply's AI triage (lib/sales/replyTriage.js)
    // runs once the TwiML below has gone out. Twilio retries a webhook that
    // is slow to answer, and a retry here is the same text filed twice; the
    // store and the STOP are awaited, the model is not.
    await handleSalesInboundSms({ to, from, body, schedule: after }).catch(async (err) => {
      await recordError({
        area: "sales_sms",
        message: `Inbound sales SMS handling threw: ${err.message}`,
        detail: { to, from },
      }).catch(() => {});
    });
    // Whether it was ours or a stray webhook, Twilio gets the same empty 200 —
    // a retry would not change the answer.
    return twiml();
  }

  const verdict = classifyInboundSms(body);
  if (!verdict) return twiml(); // not a keyword — this route isn't an inbox

  // One record per tenant. On a dedicated number that is one company; on the
  // shared line it is every company holding the sender's phone. Each write
  // is its own try — a failure to file one company's opt-out must not skip
  // the next company's, and the record is the whole point of the route.
  for (const tenant of tenants.companies) {
    try {
      if (verdict === "opt_out") {
        await recordSmsOptOut({ companyId: tenant.id, phone: from, body });
      } else {
        await recordSmsOptIn({ companyId: tenant.id, phone: from, body });
      }
    } catch (err) {
      await recordError({
        area: "sms_opt_out",
        message: `Failed to record SMS ${verdict}: ${err.message}`,
        companyId: tenant.id,
        detail: { to, from, resolvedBy: tenants.kind },
      }).catch(() => {});
    }
  }

  // ── One confirmation, not one per tenant ─────────────────────────────────
  //
  // On the shared line three companies may hold the phone; three "you're
  // unsubscribed" texts for one STOP would read as the opposite of stopping.
  // The confirmation carries the first tenant's name — on a dedicated number
  // the only one — and its companyId, so a demo tenant simulates it rather
  // than sending. The opt-out itself is recorded above either way: the
  // record is the part that must be real, and it is.
  if (shouldSendOwnConfirmation()) {
    const text = verdict === "opt_out" ? optOutConfirmation(company.name) : optInConfirmation(company.name);
    await sendSms({ to: from, from: to, body: text, companyId: company.id }).catch((err) =>
      recordError({
        area: "sms_opt_out",
        message: `${verdict === "opt_out" ? "Opt-out" : "Opt-in"} confirmation text failed: ${err.message}`,
        companyId: company.id,
      }).catch(() => {}),
    );
  }

  return twiml();
}
