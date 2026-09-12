// app/api/settings/whatsapp/manual/route.js
//
// The second door onto a WhatsApp number: Cloud API credentials, pasted.
//
// ══ Why a second door exists ═══════════════════════════════════════════════
//
// Embedded Signup (app/api/settings/whatsapp/connect) is the door Meta wants
// businesses walked through, and it is shut until Meta's Access Verification
// of FieldQuo's app lands (submitted 2026-09-11). Meta's own get-started guide
// says what an app admin can do in the meantime: WhatsApp → API Setup, add
// the business number, create a system user, generate a PERMANENT token with
// whatsapp_business_messaging + whatsapp_business_management, and use the
// Cloud API directly. This route takes those three values — the WhatsApp
// Business Account id, the phone number id, the token — and makes them the
// same MessagingChannel row Embedded Signup would have written.
//
// ══ Nothing is stored until the token has been PROVEN ══════════════════════
//
// A pasted string is a claim, and this route stores nothing on a claim. Four
// reads, with the pasted token, all of which have to succeed:
//
//   1. GET /debug_token             it was minted by FieldQuo's Meta app (a
//                                   token from another app would route every
//                                   inbound webhook to that app), and it
//                                   carries both WhatsApp scopes (management
//                                   reads the number; messaging is what a
//                                   reply needs, and a token that lacked it
//                                   would pass every read and fail on the
//                                   first send)
//   2. GET /<phone-number-id>       the token reaches the number
//   3. GET /<waba-id>               the token reaches the account
//   4. GET /<waba-id>/phone_numbers the number is ON that account — inside
//                                   the shared finish, which also subscribes
//                                   the app and writes the row
//
// A refusal at any step is Meta's classified reason, and the token is gone
// with the request. It is never logged, never returned, never written to the
// error log — the only place it is ever written is MessagingChannel
// .accessTokenEnc, encrypted, inside lib/messaging/channels.js's saveChannel.
//
// ══ The gates, and why each ════════════════════════════════════════════════
//
//   memberOrRefusal      the session, the feature gate (`whatsapp_messaging`
//                        claims /api/settings/whatsapp), the billing gate, and
//                        the impersonation gate — a POST under a support
//                        session is refused inside getCurrentMember before
//                        this handler runs (non-negotiable #3: the platform
//                        console edits nothing).
//   isBillingAdmin       connecting a number is a company-level act, the same
//                        rule as /connect and /disconnect.
//   metaWhatsAppEnabled  the same flag the other door checks. This door does
//                        not need Meta's approval to work — that is the whole
//                        point of it — but FieldQuo's own switch for "WhatsApp
//                        is offered here" is one switch, not two.
//   metaFullyConfigured  the app credentials (debug_token needs them) and the
//                        encryption key (without which nothing can be stored).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaFullyConfigured, metaWhatsAppEnabled } from "@/lib/meta/client";
import {
  inspectWhatsAppToken,
  getWhatsAppNumber,
  getWhatsAppBusinessAccount,
} from "@/lib/meta/whatsappConnect";
import { finishWhatsAppConnection } from "@/lib/messaging/whatsappConnect";
import { publicChannelShape } from "@/lib/messaging/channels";
import { recordActivity } from "@/lib/activity/log";
import { rateLimit } from "@/lib/rateLimit";
import { validateManualCredentials, MANUAL_REQUIRED_SCOPES } from "@/lib/messaging/whatsappManual";

/**
 * A refusal, in the shape the panel maps to a sentence in the reader's
 * language: `code` is the vocabulary app/components/settings/WhatsAppPanel.js
 * already speaks for the signup door, plus the handful this door adds. The
 * English `error` is the fallback for a code the panel does not know.
 */
function refuse(code, message, status = 400) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  // Every attempt costs Meta four reads with a credential someone typed.
  // Tight, because a paste is a deliberate act and ten of them in ten minutes
  // is not a person connecting a number.
  const limited = rateLimit(request, `whatsapp-manual:${member.companyId}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
    message: "Too many attempts. Wait a few minutes and try again.",
  });
  if (limited) return limited;

  if (!metaWhatsAppEnabled()) {
    return refuse("awaiting_review", "WhatsApp messaging is not switched on for this deployment.", 409);
  }
  if (!metaFullyConfigured()) {
    return refuse("not_configured", "This deployment cannot store a WhatsApp connection yet.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const validated = validateManualCredentials(body);
  if (!validated.ok) return refuse(validated.code, validated.message);
  const { wabaId, phoneNumberId, accessToken } = validated;

  // ── 1. The token's own identity ─────────────────────────────────────────
  const inspected = await inspectWhatsAppToken({ accessToken });
  if (!inspected.ok) return refuse(inspected.kind, inspected.message, 502);
  if (!inspected.data.isValid) {
    return refuse("auth_error", "Meta reports that token as invalid.", 502);
  }
  if (inspected.data.appId && inspected.data.appId !== String(process.env.META_APP_ID)) {
    // The single most likely mistake, and the one no other read catches: a
    // token generated under the business's OWN Meta app reads the number
    // perfectly and sends every inbound webhook to that app instead of here.
    return refuse(
      "wrong_app",
      "That token was generated under a different Meta app. Generate it under the app whose WhatsApp product points at FieldQuo.",
    );
  }
  const missingScopes = MANUAL_REQUIRED_SCOPES.filter((s) => !inspected.data.scopes.includes(s));
  if (missingScopes.length) {
    return refuse(
      "missing_scope",
      `That token is missing ${missingScopes.join(" and ")}. Generate it again with both WhatsApp permissions ticked.`,
    );
  }

  // ── 2. The token reaches the number ─────────────────────────────────────
  const number = await getWhatsAppNumber({ accessToken, phoneNumberId });
  if (!number.ok) return refuse(number.kind, number.message, 502);

  // ── 3. The token reaches the account ────────────────────────────────────
  const account = await getWhatsAppBusinessAccount({ accessToken, wabaId });
  if (!account.ok) return refuse(account.kind, account.message, 502);

  // ── 4. Subscribe, prove the number is on the account, store ─────────────
  let finished;
  try {
    finished = await finishWhatsAppConnection({
      companyId: member.companyId,
      connectedByUserId: member.userId || null,
      accessToken,
      wabaId,
      phoneNumberId,
      connectedVia: "manual",
    });
  } catch (err) {
    // The message only — never the body, never the token. A storage failure
    // is FieldQuo's problem and reads as such.
    console.error("[whatsapp-manual] failed to store channel:", err?.message);
    return refuse("unknown_error", "The connection could not be stored. Nothing was connected.", 500);
  }
  if (!finished.ok) return refuse(finished.kind, finished.message || "Nothing was connected.", 502);

  // Logged AFTER the row is committed, with the facts and not the credential:
  // which number, which account, which door. recordActivity never throws.
  await recordActivity(member, {
    action: "whatsapp.connected",
    entityType: "settings",
    entityId: finished.channel.id,
    summary: `Connected WhatsApp number ${finished.number.display_phone_number || phoneNumberId} with Cloud API credentials`,
    summaryKey: "app.activity.event.whatsappConnectedManual",
    summaryParams: { number: finished.number.display_phone_number || phoneNumberId },
    metadata: { wabaId, phoneNumberId, connectedVia: "manual" },
  });

  // publicChannelShape has no token field, and this route returns nothing
  // else that came from the request body.
  return NextResponse.json({ connected: true, channel: publicChannelShape(finished.channel) });
}
