// app/api/crew/line/route.js
//
// The crew inbox's setup surface: which number the crew text, whether it is
// actually wired, and a way to PROVE it from inside the app.
//
// ══ Why this isn't on the voice settings screen ════════════════════════════
//
// Because that is what went wrong. The crew inbox lived as step 6 of "your
// phone agent", so it inherited the assumption that its number was the voice
// number — which is bought from Retell, answers calls, and cannot receive a text
// (see lib/crew/capability.js). Two different lines from two different providers
// were shown as one, with a toggle that saved a column and connected nothing.
// They get separate screens because they are separate things.
//
// ══ Nothing here reports success it hasn't verified ════════════════════════
//
// GET asks TWILIO what it actually has — the number's real `smsUrl`, its real
// SMS capability — rather than echoing our own stored intent back. The whole
// failure being repaired is a screen that looked configured while the provider
// had never been told anything.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { sendSms, toE164, twilioConfigured } from "@/lib/sms/twilioClient";
import {
  crewInboxCapability,
  crewSignatureConfigured,
  sharedTestLineE164,
} from "@/lib/crew/capability";
import { balanceFor } from "@/lib/voice/credits";
import {
  crewSpendVerdict,
  CREW_SMS_CENTS,
  CREW_MMS_CENTS,
  CREW_OVERDRAFT_FLOOR_CENTS,
} from "@/lib/crew/messaging";
import {
  crewLineFor,
  claimCrewLine,
  releaseCrewLine,
  twilioNumberState,
  listSmsCapableNumbers,
  inboundWebhookUrl,
  SHARED_LOAN_DAYS,
} from "@/lib/crew/line";

/**
 * @param read  true only on GET — non-negotiable #3, the platform console views
 *              everything and edits nothing. Same shape as the voice settings
 *              gate, deliberately: two adjacent setup screens with different
 *              admin rules is a bug waiting to be found by a customer.
 */
async function requireAdmin(request, { read = false } = {}) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  if (read && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only an owner or admin can set up crew texting.", status: 403 };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request, { read: true });
  if (error) return NextResponse.json({ error }, { status });

  const origin = getAppOrigin(request);
  const webhookUrl = inboundWebhookUrl(origin);
  const line = await crewLineFor(member.companyId);

  const capability = crewInboxCapability({
    line,
    signatureConfigured: crewSignatureConfigured(),
    expectedWebhookUrl: webhookUrl,
  });

  // What the PROVIDER says, not what we stored. Best-effort: Twilio being
  // unreachable must not blank the screen, and `null` here renders as "couldn't
  // check" rather than as "not connected", because those are different problems
  // and only one of them is the contractor's.
  let provider = null;
  let providerError = null;
  if (line?.e164 && twilioConfigured()) {
    try {
      provider = await twilioNumberState(line.e164);
    } catch (err) {
      providerError = err.message;
    }
  }

  // The mobile a test text would go to: the admin's own staff phone. Nothing
  // else is offered, so this can never become a way to text an arbitrary number.
  const worker = member.userId
    ? await db.worker.findUnique({
        where: { userId: member.userId },
        select: { phone: true, name: true },
      })
    : null;
  const testTo = toE164(worker?.phone);

  // The same pooled balance the phone agent draws on, read through the same
  // ledger — one number, so "where did my credit go" has one answer covering
  // both. Rendered next to the rates, because a price nobody was shown before
  // being charged is a hidden fee.
  const balanceCents = await balanceFor(member.companyId);
  const spend = crewSpendVerdict({ balanceCents });

  // What the Twilio account really has. Probed rather than assumed: the env var
  // names a number, and naming one is not owning one.
  let owned = [];
  let ownedError = null;
  if (twilioConfigured()) {
    try {
      owned = await listSmsCapableNumbers();
    } catch (err) {
      ownedError = err.message;
    }
  }

  const shared = sharedTestLineE164();
  const sharedHolder = shared
    ? await db.crewInboxNumber.findUnique({
        where: { e164: shared },
        select: { companyId: true, expiresAt: true },
      })
    : null;

  return NextResponse.json({
    // What the crew must text. Null is an answer, not a blank — the screen says
    // "you don't have a texting number yet" instead of showing an empty box.
    line: line
      ? {
          e164: line.e164,
          source: line.source,
          connectedAt: line.connectedAt,
          expiresAt: line.expiresAt,
        }
      : null,
    capability,
    // Everything a person needs to diagnose this without a Vercel login. No
    // secret is included — only whether each one is present.
    deployment: {
      webhookUrl,
      twilioConfigured: twilioConfigured(),
      // The single sentence that would have saved an afternoon. An API key can
      // send texts and manage numbers but cannot verify an inbound signature,
      // so this is checked separately from twilioConfigured above.
      signatureConfigured: crewSignatureConfigured(),
    },
    provider: provider
      ? {
          smsUrl: provider.smsUrl,
          sms: provider.sms,
          mms: provider.mms,
          pointedHere: provider.smsUrl === webhookUrl,
        }
      : null,
    providerError,
    // Offered by the screen as the numbers a crew line can be. Empty is the
    // honest answer when the account owns none, and the panel says what to do
    // about it instead of showing a button that would fail on press.
    owned: owned.map((n) => ({
      e164: n.e164,
      mms: n.mms,
      pointedHere: n.smsUrl === webhookUrl,
      // Taken by another company right now. Shown rather than hidden, so
      // "why can't I pick that one" has an answer on the screen.
      taken: false,
    })),
    ownedError,
    sharedLine: shared
      ? {
          e164: shared,
          loanDays: SHARED_LOAN_DAYS,
          available:
            !sharedHolder ||
            sharedHolder.companyId === member.companyId ||
            (sharedHolder.expiresAt && new Date(sharedHolder.expiresAt) <= new Date()),
        }
      : null,
    test: { to: testTo, crewName: worker?.name || null },
    // Stated before anything is charged, and read from the same constants the
    // webhook bills with — a rate card that can drift from the meter is worse
    // than none.
    spend: {
      balanceCents,
      canReply: spend.canReply,
      canReceive: spend.canReceive,
      low: spend.low,
      smsCents: CREW_SMS_CENTS,
      mmsCents: CREW_MMS_CENTS,
      overdraftCents: CREW_OVERDRAFT_FLOOR_CENTS,
    },
  });
}

export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  // ── Claim (and wire) a line ───────────────────────────────────────────────
  if (action === "claim") {
    if (!crewSignatureConfigured()) {
      // Refused rather than half-done. Claiming would repoint a number at an
      // endpoint that rejects every message it receives, which looks exactly
      // like the bug this replaces.
      return NextResponse.json(
        {
          error:
            "This deployment can't verify incoming texts yet — TWILIO_AUTH_TOKEN isn't set, " +
            "so every text sent to the line would be refused. Set it and try again.",
        },
        { status: 409 },
      );
    }

    // Reconnecting a line that the overdraft floor just cut would take one more
    // message and cut it again. Refused with the shortfall named, so the fix is
    // "top up", not "press it harder".
    const spendNow = crewSpendVerdict({ balanceCents: await balanceFor(member.companyId) });
    if (!spendNow.canReceive) {
      return NextResponse.json(
        {
          error:
            "Your credit is spent, so crew texting is paused. Top up and this will reconnect.",
          balanceCents: spendNow.balanceCents,
        },
        { status: 402 },
      );
    }

    // Only the platform's own shared line, or a number this Twilio account
    // already owns. A contractor cannot name an arbitrary number: claimCrewLine
    // verifies ownership at the provider, because "point our webhook at a number
    // somebody else controls" is not a setup step, it's an invitation.
    const e164 = toE164(body?.e164) || sharedTestLineE164();
    if (!e164) {
      return NextResponse.json(
        { error: "There's no shared test line configured on this deployment." },
        { status: 409 },
      );
    }

    const result = await claimCrewLine({
      companyId: member.companyId,
      e164,
      origin: getAppOrigin(request),
      source: e164 === sharedTestLineE164() ? "shared_test" : "dedicated",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status || 400 });
    }

    await recordActivity(member, {
      action: "crew_inbox.line_claimed",
      entityType: "settings",
      summary: `Crew texting turned on — crew text ${result.line.e164}`,
      metadata: { e164: result.line.e164, source: result.line.source },
    });

    return NextResponse.json({
      ok: true,
      line: {
        e164: result.line.e164,
        source: result.line.source,
        connectedAt: result.line.connectedAt,
        expiresAt: result.line.expiresAt,
      },
    });
  }

  // ── Prove it ──────────────────────────────────────────────────────────────
  //
  // Sends a text FROM the crew line TO the admin's own staff phone, and nowhere
  // else. That proves the credentials, the number and the send path in one
  // press; the receiving half is proved by texting back and watching the inbox
  // fill. Restricted to their own roster number on purpose — a "send a test to
  // any number" button is an SMS blaster with a friendly label.
  if (action === "test") {
    const line = await crewLineFor(member.companyId);
    if (!line) {
      return NextResponse.json(
        { error: "Set up a crew texting number first." },
        { status: 409 },
      );
    }

    const worker = member.userId
      ? await db.worker.findUnique({ where: { userId: member.userId }, select: { phone: true } })
      : null;
    const to = toE164(worker?.phone);
    if (!to) {
      return NextResponse.json(
        {
          error:
            "Add your own mobile to your staff profile under Settings → Team first — " +
            "it's also what lets the inbox recognise your texts.",
        },
        { status: 409 },
      );
    }

    const sent = await sendSms({
      to,
      from: line.e164,
      body:
        "This is your FieldQuo crew line. Reply to this text with a photo and " +
        "it'll file to the job you're on today.",
    });
    if (!sent.success) {
      return NextResponse.json(
        { error: `Twilio refused the test text: ${sent.error}` },
        { status: 502 },
      );
    }

    await recordActivity(member, {
      action: "crew_inbox.test_sent",
      entityType: "settings",
      summary: "Sent a crew-line test text",
    });
    return NextResponse.json({ ok: true, to });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  await releaseCrewLine(member.companyId);
  await recordActivity(member, {
    action: "crew_inbox.line_released",
    entityType: "settings",
    summary: "Crew texting turned off",
  });
  return NextResponse.json({ ok: true });
}
