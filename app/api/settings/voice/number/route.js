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
//
// ── The duplicate guard is a transaction, not a read ───────────────────────
//
// "One number per company" used to be a read at the top of the handler and a
// row written several seconds later, on the far side of a call to Retell. Two
// requests inside that window both passed and both bought. Every write that
// claims the company's one slot — the reservation on the purchase path, the row
// itself on the port path — now happens in a SERIALIZABLE transaction with the
// guard that authorised it, and the purchase path's guard reads the reservation
// as well as the number, because the reservation is the only thing that exists
// while the provider is being called. See lib/voice/spendGate.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { buyNumber, voiceConfigured, RetellError } from "@/lib/voice/retell";
import { toE164, isSharedTestNumber, isTollFreeNumber, heldNumber } from "@/lib/voice/numbers";
import { isStillAvailable } from "@/lib/voice/numberSearch";
import { recordError } from "@/lib/platform/errorLog";
import { monthlyCentsFor, NUMBER_TYPES, grantFreeTrial } from "@/lib/voice/credits";
import {
  reserveSpend,
  refundReservation,
  spendAvailable,
  purchaseInFlight,
  numberSetupRef,
  isSerialisationFailure,
  CLAIM_WINDOW_MS,
  RENT_PERIOD_DAYS,
} from "@/lib/voice/spendGate";
import { provisionAgent } from "@/lib/voice/provision";
import { diagnoseNumber } from "@/lib/voice/diagnose";
import { provisionSimulatedNumber } from "@/lib/voice/demoLine";
import { getAppOrigin } from "@/lib/appUrl";

/**
 * Why they can't buy one, said in terms of what is actually wrong.
 *
 * The stalled case used to read "contact support before buying another —
 * you're being charged for that one", which was two assertions nobody had
 * checked. Now it asks the provider (lib/voice/diagnose.js) and answers with
 * the truth, because the two possible truths need opposite actions from the
 * contractor: a `ghost` row is a purchase that never happened, costs nothing,
 * and should be cleared so they CAN buy — while a number that really exists
 * should be repaired rather than duplicated.
 *
 * Each refusal carries an i18n key as well as the English. A route has no t(),
 * and this message reached French contractors in English.
 */
async function refusalFor(companyId, existing) {
  if (existing.status === "porting") {
    return {
      errorKey: "app.setVoice.numberBusy.porting",
      errorParams: { number: existing.e164 },
      error: `A port of ${existing.e164} is already in progress. Cancel that request first if you'd rather do something else.`,
    };
  }
  if (existing.status !== "provisioning") {
    return {
      errorKey: "app.setVoice.numberBusy.held",
      error: "You already have a number set up. Release it first to change.",
    };
  }

  // Best-effort: a diagnosis that throws must not turn a clear refusal into a
  // 500. The unspecific wording is still true of every stalled row.
  const diag = await diagnoseNumber(companyId).catch(() => null);
  if (diag?.verdict === "ghost") {
    return {
      verdict: diag.verdict,
      errorKey: "app.setVoice.numberBusy.ghost",
      error:
        "Your last attempt stopped halfway and no number was actually created, so nothing is being charged. Clear it with the Fix button above and you can set one up again.",
    };
  }
  return {
    verdict: diag?.verdict || null,
    errorKey: "app.setVoice.numberBusy.stuck",
    errorParams: { number: existing.e164 },
    error: `A number (${existing.e164}) is already set up for you but hasn't finished. Use the Fix button above rather than buying another — you're paying the rental on that one.`,
  };
}

/**
 * "We're already getting you one — don't press it again."
 *
 * The refusal for the window between a purchase starting and the number row
 * existing, and also for the loser of a genuinely simultaneous pair. Both are
 * the same fact from the contractor's side, so they get the same sentence
 * rather than two that have to be told apart — and neither is an error: nothing
 * was charged to the request that got refused.
 *
 * `retryAt` is carried so the screen can say when, rather than showing a
 * spinner with no end. Same reasoning as portExpectedAt above.
 */
function inFlightRefusal(flight) {
  return {
    errorKey: "app.setVoice.numberBusy.inFlight",
    error:
      "We're already setting a number up for you — that started moments ago and is still going through. " +
      "Give it a minute and reload the page rather than pressing again: a second number is a second monthly rental.",
    reason: "purchase_in_flight",
    retryAt: flight?.retryAt || new Date(Date.now() + CLAIM_WINDOW_MS),
  };
}

/**
 * A transaction that failed for a reason the caller cannot fix and did not cause.
 *
 * Answered 503, not 500, and it says nothing was charged because nothing was:
 * a transaction that throws rolls back, so the reservation inside it never
 * committed. A refusal that arrives as an empty 500 is the shape this codebase
 * shipped once already.
 */
function txFailure(err) {
  console.error("[voice/number] the claim transaction failed", err);
  return NextResponse.json(
    {
      errorKey: "app.setVoice.numberBusy.tryAgain",
      error: "We couldn't start setting a number up just now. Nothing has been charged — please try again.",
    },
    { status: 503 },
  );
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
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

  // ── A demo account never buys, or moves, a REAL telephone number ────────
  //
  // Refused server-side, before the permission-holding owner of a demo account
  // can reach the provider, because everything about a purchased number
  // outlives the demo that bought it.
  //
  // The reset does not release it. lib/demo/seedDemo.js deletes quotes, jobs,
  // invoices, clients, appointments, leads and products — and deliberately
  // never touches VoicePhoneNumber or VoiceAgent, which is right, since a
  // routine reseed must not perform an irreversible release. So a real number
  // would survive every reset and Retell would bill for it every month,
  // attached to a company nobody owns.
  //
  // And it would be a REAL line a stranger could dial. A demo is re-dressed as
  // different trades between prospects (lib/demo/industries.js), so the same
  // number would answer as a painter one week and a roofer the next — and
  // anyone who rang it after the demo would reach a receptionist for a
  // business that does not exist.
  //
  // ── What changed: PURCHASED and FORWARDED are no longer refused ─────────
  //
  // They are SIMULATED instead — lib/voice/demoLine.js provisions a real
  // receptionist (real Retell agent, real prompt, real greeting) on a
  // fictional number nobody can dial, so a prospect can watch the whole setup
  // happen and a salesperson can show the settings working. $0, always: no
  // credit is reserved, and lib/voice/spendGate.js's rentDecision skips the
  // resulting row for a stated reason (`simulated`) so it is never billed.
  //
  // PORTED still refuses. A port needs a real carrier and real trunk details
  // that do not exist for a demo, and letting one through would file a request
  // a human is expected to action for a company that isn't real.
  // Named `demoCompany`, not `company` — the handler already declares its own
  // `company` further down for the real purchase path.
  const demoCompany = await db.company.findUnique({
    where: { id: member.companyId },
    select: { isDemo: true },
  });
  if (demoCompany?.isDemo) {
    if (source === "ported") {
      return NextResponse.json(
        {
          errorKey: "app.setVoice.number.demoBlocked",
          error:
            "This is a demo account, so it can't take a real phone number — a real line would keep billing after the demo and could be dialled by anyone. Everything else about the receptionist works here, including a demo line to try it.",
          reason: "demo_account",
        },
        { status: 403 },
      );
    }
    const result = await provisionSimulatedNumber({
      member,
      source,
      ownNumber,
      origin: getAppOrigin(request),
    });
    return NextResponse.json(result.body, { status: result.status });
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
  //
  // The three sentences carry a KEY as well as the English. A route has no t()
  // — the catalogue is a client-side hook — so a hardcoded string here reached
  // a French contractor in English, and this particular one is the message that
  // stops them buying a second number. The page resolves the key and falls back
  // to the English attached here, exactly as t() does everywhere else.
  const existing = await heldNumber(member.companyId);
  if (existing) {
    const refusal = await refusalFor(member.companyId, existing);
    return NextResponse.json({ ...refusal, status: existing.status }, { status: 409 });
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
    // ── The guard and the row, in one transaction ────────────────────────
    //
    // The purchase path needs a durable claim because its row is written on the
    // far side of a provider call (see lib/voice/spendGate.js). A port has no
    // provider call at all, so the row IS the claim — it just has to be created
    // in the same transaction that checked for one, or two clicks a millisecond
    // apart both read "no number" and file two port requests against the same
    // line. Serialisable because the read and the write are on the same rows:
    // that is a conflict Postgres can see, and it aborts one of the pair.
    let ported;
    try {
      ported = await db.$transaction(
        async (tx) => {
          const raced = await heldNumber(member.companyId, tx);
          if (raced) return { raced };
          return {
            row: await tx.voicePhoneNumber.create({
              data: {
                companyId: member.companyId,
                e164: ownNumber,
                publicNumber: ownNumber,
                source: "ported",
                status: "porting",
                numberType,
                monthlyCents: monthlyCentsFor(numberType),
                portRequestedAt: new Date(),
                // Three weeks is the honest middle of "two to four", and the UI
                // shows it so the wait has an end rather than an open-ended
                // spinner.
                portExpectedAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
              },
            }),
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (portErr) {
      // The loser of a simultaneous pair gets the refusal the winner's row will
      // give every request after it, not a 500.
      if (isSerialisationFailure(portErr)) {
        return NextResponse.json(inFlightRefusal(null), { status: 409 });
      }
      // `e164` is unique across the whole table, so a number already in FieldQuo
      // — this company's own released row, or another tenant's line — lands
      // here. Said without naming anyone: who else holds a number is not this
      // company's business.
      if (portErr?.code === "P2002") {
        return NextResponse.json(
          {
            errorKey: "app.setVoice.portTaken",
            errorParams: { number: ownNumber },
            error: `${ownNumber} can't be set up here — it's already registered in FieldQuo. Check the digits, and get in touch if it really is yours.`,
          },
          { status: 409 },
        );
      }
      return txFailure(portErr);
    }

    if (ported.raced) {
      const refusal = await refusalFor(member.companyId, ported.raced);
      return NextResponse.json({ ...refusal, status: ported.raced.status }, { status: 409 });
    }
    const row = ported.row;

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

  // ── The number they actually picked ──────────────────────────────────────
  //
  // Only for a LOCAL line. Toll-free numbers come out of the 800/833 pools,
  // have no area to be in, and are not what the picker searches — the picker
  // lists `availablePhoneNumbers(...).local`, so a toll-free order carrying a
  // chosen number would be a local number bought at the toll-free price.
  //
  // Absent, everything below behaves exactly as it did: Retell picks. That is
  // the honest fallback for a deployment with no Twilio credentials, where
  // there is no inventory to choose from and Retell's own `area_code` hint is
  // documented US-only — inert for the Canadian companies this product mostly
  // serves. Better to say "we'll get you the closest we can" than to render a
  // picker whose choice nothing can honour.
  const chosenE164 = tollFree ? null : toE164(body.phoneNumber);

  // Checked BEFORE the reservation, not after. Everything below this line
  // moves money: reserveSpend takes a month's rental up front, and a number
  // sold to somebody else in the seconds since the picker rendered would
  // otherwise surface as a provider error on the far side of a
  // reserve-then-refund round trip. Here it costs nothing and can say what
  // actually happened.
  //
  // `null` means Twilio could not answer — an outage, a revoked key. Distinct
  // from `false`, and deliberately allowed through: refusing every purchase
  // because a SEARCH is down would take the feature offline over a check that
  // is an optimisation. Retell is the one that has to succeed, and if the
  // number really is gone it refuses and the money comes back.
  // Read once, here, and reused for the purchase below. The country decides
  // which national inventory is searched AND which one is bought from, and
  // reading it twice is how those two come to disagree.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { country: true },
  });
  const country = company?.country || "CA";

  if (chosenE164) {
    const stillFree = await isStillAvailable(chosenE164, { country });
    if (stillFree === false) {
      return NextResponse.json(
        {
          errorKey: "app.setVoice.pick.taken",
          errorParams: { number: chosenE164 },
          error: `${chosenE164} was taken while you were choosing. Nothing has been charged — search again and pick another.`,
          taken: chosenE164,
        },
        { status: 409 },
      );
    }
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
  //
  // ── …and the guard is re-asked HERE, with the reservation ────────────────
  //
  // The check at the top of this handler is a fast refusal, not a lock. Between
  // it and the VoicePhoneNumber row below sit provisionAgent() and buyNumber() —
  // a network call to Retell, seconds long — and a second request arriving
  // inside that window used to find no held number either. Both bought. Company
  // cmsl36it7000004juyw4qyn0u has two numbers and two $4 debits 31 seconds
  // apart to prove it.
  //
  // So the guard runs again, in the same transaction as the reservation, and it
  // now asks two questions: is there a number, and is there a reservation with
  // no number behind it yet. The second is what spans the provider call —
  // lib/voice/spendGate.js explains why the transaction alone cannot, and why
  // neither a unique index nor a placeholder row was the answer.
  //
  // SERIALIZABLE on top of that read handles the pair that overlap to the
  // millisecond, where neither has committed anything for the other to see.
  // Postgres aborts one with SQLSTATE 40001; that is a lost race, not a fault,
  // and it answers the same 409 as every other "we're already on it".
  const reservationRef = numberSetupRef(randomUUID());

  // Resolved out here on purpose: this reads a platform-wide table and swallows
  // its own errors (lib/features/gate.js), and neither belongs inside a
  // serialisable transaction.
  const offered = await spendAvailable(member.companyId);

  let claim;
  try {
    claim = await db.$transaction(
      async (tx) => {
        const raced = await heldNumber(member.companyId, tx);
        if (raced) return { raced };

        const flight = await purchaseInFlight({ companyId: member.companyId, prisma: tx });
        if (flight.inFlight) return { flight };

        return {
          reserved: await reserveSpend({
            companyId: member.companyId,
            kind: "number_setup",
            numberType,
            ref: reservationRef,
            note: `First month's rental — ${numberType === "toll_free" ? "toll-free" : "local"} number`,
            prisma: tx,
            available: offered,
          }),
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (claimErr) {
    if (isSerialisationFailure(claimErr)) {
      return NextResponse.json(inFlightRefusal(null), { status: 409 });
    }
    return txFailure(claimErr);
  }

  if (claim.raced) {
    const refusal = await refusalFor(member.companyId, claim.raced);
    return NextResponse.json({ ...refusal, status: claim.raced.status }, { status: 409 });
  }
  if (claim.flight) {
    return NextResponse.json(inFlightRefusal(claim.flight), { status: 409 });
  }

  const reserved = claim.reserved;
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
  const agent = await db.voiceAgent.findUnique({
    where: { companyId: member.companyId },
    select: { providerAgentId: true },
  });

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
      // ── The number they chose, when they chose one ────────────────────
      //
      // `phoneNumber` supersedes `areaCode` inside buyNumber, and the two are
      // never sent together — see lib/voice/retell.js. The area code is still
      // forwarded for the no-picker path, and it is worth being clear-eyed
      // about what it does there: Retell documents `area_code` as "Currently
      // only supports US area code", so on a Canadian order it is inert. That
      // is precisely why the picker exists, and why the screen offers no
      // area-code box when it cannot search — a preference the provider throws
      // away is a dead control.
      phoneNumber: chosenE164 || undefined,
      areaCode: tollFree || chosenE164 ? undefined : body.areaCode,
      // The type the company is being charged for. Sent because it wasn't:
      // toll-free was billed at $9/month and a 5¢/minute surcharge while the
      // request asked for nothing in particular, so Retell returned a local
      // number and the contractor paid the toll-free rate for a local line.
      tollFree,
      // Their own country, not the provider's US default. `area_code` is
      // documented US-only, so a Quebec 819 against a US default is not the
      // number it looks like.
      country,
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

    // ── Showed one number, bought another ────────────────────────────────
    //
    // Should not happen: naming `phone_number` asks for exactly one number, and
    // a provider that cannot supply it should refuse rather than substitute.
    // But "should refuse" is an assumption about somebody else's code, and the
    // cost of it being wrong is the exact failure this feature was built to
    // remove — a contractor who picked 819 and prints 437 on a van.
    //
    // NOT released. Releasing is irreversible (the number goes back to the pool
    // and cannot be got again), it is the one destructive provider call in the
    // system, and nothing else in this codebase performs it without a human
    // deciding. So the number is kept and the swap is made LOUD instead: logged
    // for us, and returned to the browser so the screen can say "you picked X,
    // you were given Y" in the same breath as it announces success. Silence
    // here is what turns a provider quirk into a wrong number on a van.
    if (chosenE164 && e164 !== chosenE164) {
      await recordError({
        area: "voice-number",
        message: `Asked the provider for ${chosenE164} and it returned ${e164}`,
        companyId: member.companyId,
      }).catch(() => {});
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
      // Only ever set when the two genuinely differ, so the screen can print an
      // extra sentence without having to compare anything itself. Null on the
      // normal path — including when no number was chosen at all — because
      // "you asked for nothing and got a number" is not a substitution.
      requestedE164: chosenE164 && chosenE164 !== e164 ? chosenE164 : null,
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
 * ── Why only a port, and why database-only is CORRECT here ─────────────────
 *
 * This writes `status: "released"` and never calls the provider, which is the
 * shape of a real bug elsewhere — a row that says released while Retell keeps
 * billing FieldQuo for ever. It is not that bug, and the reason is specific
 * rather than general: Retell's API has no porting endpoint at all. The
 * `ported` branch in the POST above records an intent and stops; importNumber()
 * is a SIP import of a number the company KEEPS at their own carrier and is
 * wired to nothing. So a `porting` row has no provider object behind it, no
 * rental was reserved for it (see the POST), and there is literally nothing to
 * DELETE. Withdrawing it is a status change and nothing more.
 *
 * That reasoning depends on a fact that could change, so it is CHECKED rather
 * than trusted: the branch below refuses a porting row that carries a
 * `providerId`. The day anyone wires importNumber up, a port will have a real
 * provider object and this path would otherwise start abandoning live numbers
 * while telling the contractor it cancelled some paperwork.
 *
 * Releasing a LIVE number is a different operation and lives in
 * ./release/route.js — a real DELETE at the provider, read back before the row
 * moves, behind two confirmations. It is not here because overloading DELETE
 * with "withdraw a request" and "destroy a phone line" is how the two get
 * confused by a caller.
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
    // Named rather than refused generically, and it now points at the door that
    // does exist: releasing a live number is POST ./release, which needs the
    // number typed back because it is irreversible. This used to end on "get in
    // touch and we'll sort it out", which was true when nothing could release a
    // number and is a dead end now that something can.
    return NextResponse.json(
      {
        errorKey: "app.setVoice.cancelNotPort",
        error:
          "This number is live, so there's no request to cancel — use Release this number instead, and read what it warns you about first.",
        reason: "not_a_port",
      },
      { status: 409 },
    );
  }

  // See the header: database-only is right for a port precisely because no
  // provider object exists. A `providerId` would mean one does, and this path
  // would be abandoning a number FieldQuo keeps paying for.
  if (held.providerId) {
    return NextResponse.json(
      {
        errorKey: "app.setVoice.cancelPortProvisioned",
        error:
          "This number already exists at the phone provider, so cancelling the paperwork wouldn't give it back. Use Release this number instead.",
        reason: "port_has_provider_number",
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
