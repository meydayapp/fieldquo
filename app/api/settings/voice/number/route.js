// app/api/settings/voice/number/route.js
//
// Getting the company a number.
//
//   POST { source: "forwarded" | "purchased" | "ported", ... }
//
// Three genuinely different products — see lib/voice/numbers.js for why
// forwarding is the recommended default and porting is the one that can hurt.
//
// ── The first month is paid before the number exists ───────────────────────
//
// Buying a number bills FIELDQUO, immediately and every month after, because
// FieldQuo holds the one Retell account. This route used to buy one with no
// balance check at all and then grant 30 free minutes on top, so a company that
// had paid nothing could cost real money on their first click. Now the rental is
// reserved from their prepaid balance BEFORE the provider is called, through the
// one gate in lib/voice/spendGate.js, and refunded if the provider then refuses.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { buyNumber, voiceConfigured, RetellError } from "@/lib/voice/retell";
import { toE164, isSharedTestNumber, isTollFreeNumber, heldNumber } from "@/lib/voice/numbers";
import { recordError } from "@/lib/platform/errorLog";
import { monthlyCentsFor, NUMBER_TYPES, grantFreeTrial } from "@/lib/voice/credits";
import { reserveSpend, refundReservation, RENT_PERIOD_DAYS } from "@/lib/voice/spendGate";
import { provisionAgent } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  // ── One number per company, and the guard has to see the stalled ones ────
  //
  // heldNumber() rather than activeNumber(): a row stuck on the old
  // `provisioning` default is a number that EXISTS at the provider and is being
  // paid for, and activeNumber() can't see it. That blind spot is how the same
  // company bought two — the screen showed no number, so the guard found none
  // either, and the second click went through.
  //
  // Each state gets its own sentence. "You already have a number" is useless to
  // someone who cannot see one on the page.
  const existing = await heldNumber(member.companyId);
  if (existing) {
    const message =
      existing.status === "porting"
        ? `A port of ${existing.e164} is already in progress. Cancel that request first if you'd rather do something else.`
        : existing.status === "provisioning"
          ? `A number (${existing.e164}) was already set up for you but didn't finish activating. Contact support before buying another — you're being charged for that one.`
          : "You already have a number set up. Release it first to change.";
    return NextResponse.json({ error: message, status: existing.status }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const source = ["forwarded", "purchased", "ported"].includes(body.source)
    ? body.source
    : "purchased";
  const numberType = NUMBER_TYPES[body.numberType] ? body.numberType : "local";
  // One derivation, used by both the price and the provider request. Two reads
  // of `body.numberType` is how the charge and the purchase came apart in the
  // first place: the price knew it was toll-free and the order didn't.
  const tollFree = numberType === "toll_free";

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
  //
  // No money is reserved here, deliberately: a port costs FieldQuo nothing until
  // the number actually lands at the provider, which is weeks away and may never
  // happen. Taking a month's rental now for a number that doesn't exist yet
  // would be charging for a wait. The row is created with a null
  // `rentPaidThroughAt`, which the rent cron reads as "due the moment this goes
  // active" — so the first month is still paid, on the day it starts costing.
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

  // ── The gate. Nothing above this line has cost anything ─────────────────
  //
  // Reserved before the provider is touched, not after: "buy, then charge"
  // leaves FieldQuo holding a live number whenever the charge is the half that
  // fails. The token is server-generated — the browser posts a number TYPE, never
  // an amount (non-negotiable #5), and the price is read from our own rows.
  //
  // Both `purchased` and `forwarded` land here, because forwarding still buys a
  // number to forward TO. Only `ported`, handled above, buys nothing.
  const reservationRef = `number_setup:${randomUUID()}`;
  const reserved = await reserveSpend({
    companyId: member.companyId,
    kind: "number_setup",
    numberType,
    ref: reservationRef,
    note: `First month's rental — ${numberType === "toll_free" ? "toll-free" : "local"} number`,
  });
  if (!reserved.allowed) {
    return NextResponse.json(
      {
        error:
          `This number's rental is $${(reserved.needCents / 100).toFixed(2)} a month and it's charged up front. ` +
          `Your balance is $${(reserved.balanceCents / 100).toFixed(2)} — add at least $${(reserved.shortfallCents / 100).toFixed(2)} of credit first.`,
        needCents: reserved.needCents,
        balanceCents: reserved.balanceCents,
        shortfallCents: reserved.shortfallCents,
      },
      // 402: they may do this, they just haven't paid for it yet. Distinct from
      // the 403 a non-admin gets, so the UI can offer a top-up rather than
      // telling someone to ask their boss.
      { status: 402 },
    );
  }

  // Provision the agent FIRST, so the number can be bought already pointing at
  // it. Buying first and attaching later leaves a live number with no agent —
  // for however long that window is, a caller gets silence.
  const provisioned = await provisionAgent(member.companyId, getAppOrigin(request));
  const [agent, company] = await Promise.all([
    db.voiceAgent.findUnique({
      where: { companyId: member.companyId },
      select: { providerAgentId: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { country: true },
    }),
  ]);

  // Whether the number made it into our database. The refund below keys on
  // this, not on "something threw": once the row exists the company HAS the
  // number and is paying for it, and refunding after a later hiccup (the free
  // minutes, the activity log) would hand back the rental on a live line.
  let row = null;

  try {
    const bought = await buyNumber({
      // An area code is a LOCAL concept. Toll-free numbers come from the 800/833
      // pools and have no area to be in — sending one alongside toll_free asks
      // the provider for two contradictory things, and whichever it honours,
      // one of them is a surprise on the invoice.
      areaCode: tollFree ? undefined : body.areaCode,
      // The type the company is being charged for. Sent because it wasn't:
      // toll-free was billed at $9/month and a 5¢/minute surcharge while the
      // request asked for nothing in particular, so Retell returned a local
      // number and the contractor paid the toll-free rate for a local line.
      tollFree,
      // Their own country, not the provider's US default. `area_code` is
      // documented US-only, so a Quebec 819 against a US default is not the
      // number it looks like.
      country: company?.country || "CA",
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

    // ── Bill for what arrived, not for what was asked for ─────────────────
    //
    // The request now says toll-free explicitly, but "we asked" is still not
    // "we got", and the gap is money in a customer's pocket. The number itself
    // is the only authority: a +1833 line IS toll-free and a +1514 one is not,
    // whatever the order said. Anything stored from the request instead would
    // reproduce the original bug one layer down.
    const gotTollFree = isTollFreeNumber(e164);
    const actualType = gotTollFree ? "toll_free" : "local";
    const actualMonthly = monthlyCentsFor(actualType);

    row = await db.voicePhoneNumber.create({
      data: {
        companyId: member.companyId,
        e164,
        publicNumber: source === "forwarded" ? ownNumber : e164,
        source,
        // ── Written explicitly, because the schema default is a lie here ────
        //
        // VoicePhoneNumber.status defaults to `provisioning`, which would be
        // right for a row created BEFORE the provider is called. This row is
        // created after buyNumber() has already returned a live number, so it
        // is active the instant it exists — and nothing anywhere ever promoted
        // a `provisioning` row to `active`.
        //
        // The cost of leaving it defaulted was the whole feature: every reader
        // filters on status "active" — activeNumber(), the settings GET, the
        // crew-inbox webhook, outbound dialling, agent attachment, the rent
        // cron — so a number that had been bought and paid for was invisible to
        // all of them. The contractor saw the setup screen come back unchanged,
        // pressed it again, and bought a second one, because the duplicate
        // guard reads the same column.
        status: "active",
        // What they actually have. This drives the per-minute rate on every
        // future call and the rent every month, so getting it from the number
        // rather than the order is what keeps both honest for the whole life of
        // the line — not just today.
        numberType: actualType,
        // The E.164, not `phone_number_pretty`. The display string is not an
        // identifier and every provider call keys on the E.164 — storing the
        // pretty form here is how a release ends up looking up nothing.
        providerId: bought?.phone_number || e164,
        monthlyCents: actualMonthly,
        // Paid up for one period from now — the reservation above IS this
        // month. The rent cron won't look at it again until this passes.
        rentPaidThroughAt: new Date(Date.now() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    if (actualType !== numberType) {
      // Asked for one thing, got another. Recorded loudly because it means the
      // provider ignored an explicit flag, and refunded immediately if they were
      // charged more than the line they received is worth — an overcharge that
      // waits for someone to notice is an overcharge.
      await recordError({
        area: "voice-number",
        message: `Asked for a ${numberType} number and got a ${actualType} one (${e164})`,
        companyId: member.companyId,
      }).catch(() => {});

      const overpaid = reserved.needCents - actualMonthly;
      if (overpaid > 0) {
        await refundReservation({
          companyId: member.companyId,
          ref: reservationRef,
          cents: overpaid,
          note: `Refund — a local number was issued, not toll-free`,
        }).catch(() => {});
      }
      // The other direction (a toll-free line issued against a local order)
      // leaves the first month short by the difference. Not clawed back: taking
      // money nobody agreed to is worse than one logged $5 gap, and every month
      // after bills at the right rate because monthlyCents above is the real one.
    }

    // Free minutes with the first number. Nobody puts a voice in front of their
    // own customers without hearing it answer their line first, and a demo
    // recording isn't the same thing.
    //
    // Once per COMPANY, enforced by a unique ref in the ledger rather than by
    // "they have no number yet" — the release path below (rent unpaid) would
    // otherwise turn this into 30 free minutes on tap, one per re-purchase.
    // FieldQuo's exposure here is bounded and deliberate: 30 minutes costs us
    // about $4.80 of provider time against the month's rental they just paid.
    await grantFreeTrial({ companyId: member.companyId, numberType: row.numberType });

    await recordActivity(member, {
      action: "voice.number_added",
      entityType: "settings",
      summary: `Added a ${row.numberType === "toll_free" ? "toll-free" : "local"} number (${source})`,
      metadata: { e164, source, numberType: row.numberType, chargedCents: row.monthlyCents },
    });

    return NextResponse.json({
      // The number we ACTUALLY got, not the area code they asked for — the
      // provider gives what it has, and a contractor who requested 819 and
      // silently received 437 would print the wrong one on a van. Same for the
      // type: reporting back the one that was ordered would hide a mismatch the
      // contractor is entitled to see.
      e164,
      source,
      numberType: row.numberType,
      publicNumber: row.publicNumber,
      agentReady: provisioned.ok,
      chargedCents: row.monthlyCents,
    });
  } catch (err) {
    // The money came off before the provider was called, so a failure here has
    // to put it back. Not doing so would leave a company down a month's rental
    // for a number that doesn't exist — and the error message below promises
    // exactly the opposite.
    if (!row) {
      await refundReservation({
        companyId: member.companyId,
        ref: reservationRef,
        cents: reserved.needCents,
        note: "Refund — the number couldn't be set up",
      }).catch(() => {});
    }

    const message =
      err instanceof RetellError
        ? err.message
        : "We couldn't get a number just now. Nothing has been charged.";
    console.error("[voice/number] failed", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Cancel a port REQUEST.
 *
 *   DELETE  (no body)
 *
 * ── Why only a port, and nothing else ──────────────────────────────────────
 *
 * A port request is the one number state that costs nothing and exists nowhere
 * but our own database: no number was bought, no provider object was created,
 * no rental was reserved (see the POST above). Withdrawing it is a status
 * change and nothing more, so it is safe to hand the contractor.
 *
 * Releasing a LIVE number is a different operation and is deliberately NOT here.
 * It means a real DELETE at the provider, it is irreversible — the number goes
 * back to the pool and cannot be got again — and it needs an answer to "what
 * happens to the month already paid" that nobody has given yet. Only the rent
 * cron releases numbers today (lib/voice/spendGate.js), and that is the honest
 * state of it. A "release" button here that silently did nothing, or that
 * destroyed a number the company advertises, would be worse than its absence.
 *
 * ── Why this exists at all ─────────────────────────────────────────────────
 *
 * Without it a port request is a one-way door. The row matches the duplicate
 * guard, so every other setup path returns 409 "you already have a number",
 * while the port itself is waiting on a human process that has no queue. A
 * contractor who tried porting to see what it did could not get a working
 * number by any route, forever, and there was no control on the page to undo it.
 */
export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  const held = await heldNumber(member.companyId);
  if (!held) {
    return NextResponse.json({ error: "There's nothing to cancel." }, { status: 404 });
  }
  if (held.status !== "porting") {
    // Named rather than refused generically: the difference between "this isn't
    // cancellable" and "we can't release a live number yet" is the difference
    // between a user error and a missing feature, and they deserve to know
    // which one they've hit.
    return NextResponse.json(
      {
        error:
          "This number is live, and releasing a live number isn't something you can do yourself yet — get in touch and we'll sort it out.",
      },
      { status: 409 },
    );
  }

  // `released`, not deleted. The row is the only record that the request was
  // ever made, and a port that a carrier has quietly started acting on is not
  // something to erase from our own history.
  await db.voicePhoneNumber.update({
    where: { id: held.id },
    data: { status: "released", releasedAt: new Date() },
  });

  await recordActivity(member, {
    action: "voice.port_cancelled",
    entityType: "settings",
    summary: `Cancelled the port request for ${held.e164}`,
    metadata: { e164: held.e164 },
  });

  return NextResponse.json({ ok: true, cancelled: held.e164 });
}
