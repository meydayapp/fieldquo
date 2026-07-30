// app/api/settings/voice/number/route.js
//
// Getting the company a number.
//
//   POST { source: "forwarded" | "purchased" | "ported", ... }
//
// Three genuinely different products — see lib/voice/numbers.js for why
// forwarding is the recommended default and porting is the one that can hurt.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { buyNumber, voiceConfigured, RetellError } from "@/lib/voice/retell";
import { toE164, isSharedTestNumber, activeNumber } from "@/lib/voice/numbers";
import { monthlyCentsFor, NUMBER_TYPES, FREE_TRIAL_MINUTES, ratePerMinute, addCredit } from "@/lib/voice/credits";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  const existing = await activeNumber(member.companyId);
  if (existing) {
    return NextResponse.json(
      { error: "You already have a number set up. Release it first to change." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const source = ["forwarded", "purchased", "ported"].includes(body.source)
    ? body.source
    : "purchased";
  const numberType = NUMBER_TYPES[body.numberType] ? body.numberType : "local";

  // ── Forwarding ────────────────────────────────────────────────────────
  //
  // They keep their own number, so we still buy them one to forward TO — but
  // what gets advertised, and what goes on their booking page, stays theirs.
  const ownNumber = toE164(body.publicNumber);
  if (source === "forwarded" && !ownNumber) {
    return NextResponse.json(
      { error: "We need the number you already give out, so we can tell you what to forward." },
      { status: 400 },
    );
  }

  // ── Porting is a request, not a purchase ──────────────────────────────
  //
  // A real port needs the losing carrier's trunk details and account
  // information that no button on this page can obtain, and it takes weeks.
  // Falling through to buyNumber() here would hand the company a BRAND NEW
  // number while they believed their own was moving — they'd advertise it,
  // and their real line would keep ringing somewhere else.
  //
  // So it records the intent and stops. Someone picks it up.
  if (source === "ported") {
    if (!ownNumber) {
      return NextResponse.json(
        { error: "Which number do you want to move?" },
        { status: 400 },
      );
    }
    const row = await db.voicePhoneNumber.create({
      data: {
        companyId: member.companyId,
        e164: ownNumber,
        publicNumber: ownNumber,
        source: "ported",
        status: "porting",
        numberType,
        monthlyCents: monthlyCentsFor(numberType),
        portRequestedAt: new Date(),
        // Three weeks is the honest middle of "two to four", and the UI shows
        // it so the wait has an end rather than an open-ended spinner.
        portExpectedAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    });

    await recordActivity(member, {
      action: "voice.port_requested",
      entityType: "settings",
      summary: `Requested a port of ${ownNumber}`,
      metadata: { e164: ownNumber },
    });

    return NextResponse.json({
      e164: ownNumber,
      source: "ported",
      status: "porting",
      expectedAt: row.portExpectedAt,
    });
  }

  if (!voiceConfigured()) {
    return NextResponse.json(
      { error: "The phone agent isn't set up on this deployment yet." },
      { status: 503 },
    );
  }

  const agent = await db.voiceAgent.findUnique({
    where: { companyId: member.companyId },
    select: { providerAgentId: true },
  });

  try {
    const bought = await buyNumber({
      areaCode: body.areaCode,
      agentId: agent?.providerAgentId || undefined,
      nickname: `FieldQuo ${member.companyId.slice(-6)}`,
    });

    const e164 = toE164(bought?.phone_number);
    if (!e164) throw new RetellError("The provider didn't return a usable number.");

    // The shared test line must never be handed to a tenant: two companies
    // answering on one number means a caller reaches the wrong business, which
    // is worse than the feature not existing.
    if (isSharedTestNumber(e164)) {
      throw new RetellError("That number is reserved for testing.");
    }

    const row = await db.voicePhoneNumber.create({
      data: {
        companyId: member.companyId,
        e164,
        publicNumber: source === "forwarded" ? ownNumber : e164,
        source,
        status: "active",
        numberType,
        providerId: bought?.phone_number_pretty || bought?.phone_number || null,
        monthlyCents: monthlyCentsFor(numberType),
      },
    });

    // Free minutes with the first number. Nobody puts a voice in front of their
    // own customers without hearing it answer their line first, and a demo
    // recording isn't the same thing.
    await addCredit({
      companyId: member.companyId,
      cents: FREE_TRIAL_MINUTES * ratePerMinute(numberType),
      kind: "adjustment",
      note: `${FREE_TRIAL_MINUTES} free minutes to try it out`,
    });

    await recordActivity(member, {
      action: "voice.number_added",
      entityType: "settings",
      summary: `Added a ${numberType === "toll_free" ? "toll-free" : "local"} number (${source})`,
      metadata: { e164, source, numberType },
    });

    return NextResponse.json({
      // The number we ACTUALLY got, not the area code they asked for — the
      // provider gives what it has, and a contractor who requested 819 and
      // silently received 437 would print the wrong one on a van.
      e164,
      source,
      numberType,
      publicNumber: row.publicNumber,
    });
  } catch (err) {
    const message =
      err instanceof RetellError
        ? err.message
        : "We couldn't get a number just now. Nothing has been charged.";
    console.error("[voice/number] failed", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
