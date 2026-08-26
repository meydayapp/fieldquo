// app/api/platform/crew-lines/route.js
//
// The Twilio side of crew texting, for the account that actually holds it.
//
// ── Why it isn't on the tenant's screen any more ───────────────────────────
//
// It was, and it read as a broken page. /app/crew-inbox printed this
// deployment's `https://…/api/crew/inbound` under "Setup details"; the owner
// clicked it and got nothing, because it is a POST-only webhook address. He was
// right about the deeper problem too — that address is FieldQuo's to configure,
// not a contractor's. We hold the Twilio account and lend numbers out of it,
// exactly as we hold the Retell account and provision voice, and no contractor
// has ever been shown a Retell agent id. Publishing the inbound URL also
// invited someone to wire a private number straight at it, bypassing the claim
// that makes CrewInboxNumber.e164 one-to-one — the single guarantee that a crew
// photo cannot land on a stranger's job.
//
// ── Read-only, deliberately ────────────────────────────────────────────────
//
// AGENTS.md rule 3. Repointing a number's smsUrl decides which tenant receives
// which crew's photos; that is a customer's data flow, and the console does not
// move it. This reports, names the drift, and says what to do. The claim route
// on the tenant's side is where a number is actually wired, with the row
// written first so the unique constraint decides ownership before anything is
// repointed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { twilioConfigured } from "@/lib/sms/twilioClient";
import { crewSignatureConfigured, sharedTestLineE164 } from "@/lib/crew/capability";
import { listSmsCapableNumbers, inboundWebhookUrl } from "@/lib/crew/line";
import {
  platformNumbers,
  buyPlatformNumber,
  releasePlatformNumber,
} from "@/lib/crew/platformNumber";
import { searchLocalNumbers } from "@/lib/voice/numberSearch";
import { auditCrewLines } from "@/lib/crew/lineAudit";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhookUrl = inboundWebhookUrl(getAppOrigin(request));
  const signatureConfigured = crewSignatureConfigured();
  const configured = twilioConfigured();

  // Asked of Twilio, not read from our own rows. The entire class of failure
  // this page exists to catch is our record and the provider's disagreeing, and
  // a screen built from one of them can never see it.
  let numbers = [];
  let numbersError = null;
  if (configured) {
    try {
      numbers = await listSmsCapableNumbers({ limit: 100 });
    } catch (err) {
      // Surfaced verbatim. This reader is the one person for whom a Twilio
      // error code is the useful form of the answer.
      numbersError = err.message;
    }
  }

  const rows = await db.crewInboxNumber.findMany({
    include: { company: { select: { name: true, crewInboxEnabled: true } } },
    orderBy: { createdAt: "desc" },
  });

  const audit = auditCrewLines({
    numbers,
    rows,
    expectedWebhookUrl: webhookUrl,
    signatureConfigured,
    now: new Date(),
  });

  return NextResponse.json({
    deployment: {
      webhookUrl,
      twilioConfigured: configured,
      // Checked separately from twilioConfigured on purpose: an API key can
      // send texts and manage numbers but cannot verify an inbound signature,
      // which is an HMAC keyed on the ACCOUNT's auth token. A deployment with
      // keys and no token is fully able to text a crew and completely unable to
      // hear them answer — and that is the state production is in.
      signatureConfigured,
      // Named, because the reader of this page is the person who can set it.
      missingEnv: signatureConfigured ? [] : ["TWILIO_AUTH_TOKEN"],
      // Configuration names a number; naming is not owning. Probing the account
      // once found it holding none at all, which is why every path asks.
      // What FieldQuo has actually BOUGHT, as opposed to what configuration
      // names. The two disagreeing is the entire failure this page reports:
      // TWILIO_PHONE_NUMBER named +17372212163 while the account owned nothing.
      platformNumbers: await platformNumbers(),
      sharedLineEnv: sharedTestLineE164(),
      sharedLineHeld: numbers.some((n) => n.e164 === sharedTestLineE164()),
    },
    numbersError,
    ...audit,
  });
}

/**
 * FieldQuo's own numbers: find one, buy one, hand one back.
 *
 * Superadmin only, and gated exactly as GET is — this spends FieldQuo's money
 * at a carrier, which is the narrowest authority on the platform.
 *
 * Deliberately NOT reachable from any tenant route. The company-facing purchase
 * is /api/crew/line { action: "buy" }, which reserves from that company's credit
 * balance; this one reserves nothing because the money is FieldQuo's. Two doors,
 * because they spend two different people's money.
 */
export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === "search") {
    const found = await searchLocalNumbers({
      country: (body?.country || "CA").toUpperCase(),
      areaCode: body?.areaCode || null,
    }).catch(() => null);
    if (!found) {
      return NextResponse.json(
        { error: "Couldn't reach the number directory just now." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, ...found });
  }

  if (action === "buy") {
    const result = await buyPlatformNumber({
      e164: body?.e164,
      purpose: body?.purpose || "system",
      origin: getAppOrigin(request),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status || 400 });
    }
    return NextResponse.json({ ok: true, number: result.number });
  }

  if (action === "release") {
    const result = await releasePlatformNumber(body?.e164);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: result.status || 400 });
    }
    return NextResponse.json({ ok: true, number: result.number });
  }

  return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
}
