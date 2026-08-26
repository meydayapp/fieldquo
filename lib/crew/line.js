// lib/crew/line.js
//
// The number a company's crew texts: claiming it, wiring it, proving it works.
//
// ══ Why claiming and wiring are one operation ══════════════════════════════
//
// The bug this feature shipped with was a switch that saved a column while the
// thing it claimed to enable was never connected to anything. The repair is not
// a better-worded switch — it's making the act of turning it on BE the act of
// connecting it. Claiming a line here writes the row AND points that number's
// SMS webhook at this deployment in the same call, and a failure at the second
// step fails the first. There is no state where a company holds a line that
// nothing has been pointed at, except the one the row names honestly
// (`connectedAt` null) after a partial failure someone can retry.
//
// ══ Lending one number safely ══════════════════════════════════════════════
//
// A crew line is any SMS-capable number FieldQuo's own Twilio account owns. One
// of them — TWILIO_PHONE_NUMBER — is lent to a single company at a time so a
// contractor can prove the crew inbox works before anybody buys anything.
//
// That lending is safe for exactly one reason: CrewInboxNumber.e164 is UNIQUE.
// While a company holds a number, the inbound webhook resolving `To` → row can
// only ever land on that tenant, and a second company claiming it is a database
// constraint violation rather than a race. The loan expires, or the first
// contractor to press the button would own the only test line forever.
//
// ── What owning actually means, and why it is checked ──────────────────────
//
// TWILIO_PHONE_NUMBER names a number in configuration. Naming is not owning:
// probing the account these credentials belong to found it holds ZERO numbers,
// so the "shared line" that variable describes is not there to lend. Every path
// below therefore asks Twilio what exists rather than trusting the env var, and
// listSmsCapableNumbers is what the setup screen offers from. A screen that
// offered a number the account does not hold would be the original bug wearing
// a different hat.
import { db } from "@/lib/db";
import { twilioRest, toE164, twilioConfigured } from "@/lib/sms/twilioClient";
import { crewSignatureConfigured } from "@/lib/crew/capability";
import { isStillAvailable } from "@/lib/voice/numberSearch";
import {
  reserveSpend,
  refundReservation,
  crewLineSetupRef,
  crewLinePurchaseInFlight,
  RENT_PERIOD_DAYS,
  isSerialisationFailure,
  spendAvailable,
} from "@/lib/voice/spendGate";
import { CREW_LINE_MONTHLY_CENTS } from "@/lib/voice/credits";
import { randomUUID } from "node:crypto";

/** How long a shared-line loan lasts. Long enough to test, short enough to free. */
export const SHARED_LOAN_DAYS = 7;

/** Where Twilio must deliver. One definition; the setup screen prints this exact string. */
export function inboundWebhookUrl(origin) {
  return `${String(origin || "").replace(/\/+$/, "")}/api/crew/inbound`;
}

/** This company's crew line, or null. */
export function crewLineFor(companyId) {
  return db.crewInboxNumber.findUnique({ where: { companyId } });
}

/**
 * The number as TWILIO currently has it — SID, where its texts are delivered,
 * and whether it can carry SMS/MMS at all.
 *
 * Read rather than assumed. A number we own can have had its webhook changed in
 * the Twilio console by a person, and a screen that reports our own stored
 * intent instead of the provider's actual state is how "it says connected" and
 * "nothing arrives" coexist for an afternoon.
 *
 * @returns {{ sid, smsUrl, smsMethod, sms, mms }|null}  null when the account
 *          doesn't own the number, which is itself the answer to "why is
 *          nothing arriving".
 */
export async function twilioNumberState(e164) {
  const normalised = toE164(e164);
  if (!normalised) return null;
  const found = await twilioRest.incomingPhoneNumbers.list({
    phoneNumber: normalised,
    limit: 1,
  });
  const row = found?.[0];
  if (!row) return null;
  return {
    sid: row.sid,
    smsUrl: row.smsUrl || null,
    smsMethod: row.smsMethod || null,
    // A voice-only number silently accepts an smsUrl it will never call. Read
    // the capability so the screen can say "this number can't do texts" instead
    // of showing a green tick over a dead line.
    sms: Boolean(row.capabilities?.sms),
    mms: Boolean(row.capabilities?.mms),
  };
}

/**
 * Every SMS-capable number this Twilio account owns.
 *
 * ══ Asked, not assumed ═════════════════════════════════════════════════════
 *
 * TWILIO_PHONE_NUMBER names a number in configuration; configuration is not
 * evidence. Probing the real account found it owns ZERO numbers, which means
 * the "shared test line" the env var describes does not exist to be lent — and
 * a setup screen that offered it anyway would be the same lie in a new place.
 *
 * So the screen lists what is actually there. An empty list is a real answer
 * with a real next step (buy one), rather than a button that fails on press.
 *
 * Voice-only numbers are filtered out here rather than offered and then
 * refused: a number that cannot carry SMS is not a candidate for a texting
 * inbox, however much it looks like a phone number.
 */
export async function listSmsCapableNumbers({ limit = 20 } = {}) {
  const rows = await twilioRest.incomingPhoneNumbers.list({ limit });
  return rows
    .filter((n) => n.capabilities?.sms)
    .map((n) => ({
      e164: n.phoneNumber,
      sid: n.sid,
      mms: Boolean(n.capabilities?.mms),
      smsUrl: n.smsUrl || null,
    }));
}

/**
 * Point a number's inbound-message webhook at this deployment.
 *
 * Twilio is the source of truth and it is written, not just read: the whole
 * failure being repaired is a config nobody ever set.
 */
export async function pointWebhookAtUs(sid, url) {
  await twilioRest.incomingPhoneNumbers(sid).update({
    smsUrl: url,
    smsMethod: "POST",
  });
}

/**
 * Claim a line for a company and connect it, in that order.
 *
 * @returns {{ ok: true, line }} or {{ ok: false, reason, status }}
 *
 * Ordering note: the row is written FIRST so that the unique constraint on
 * `e164` decides who owns the number before anyone repoints it. Repointing
 * first would let two companies both succeed at Twilio and only then discover
 * which of them owns the row — with the loser's crew texting a number that now
 * delivers to the winner.
 */
export async function claimCrewLine({ companyId, e164, origin, source = "shared_test" }) {
  const normalised = toE164(e164);
  if (!normalised) {
    return { ok: false, reason: "That doesn't look like a phone number.", status: 400 };
  }

  const state = await twilioNumberState(normalised).catch(() => null);
  if (!state) {
    return {
      ok: false,
      reason: "FieldQuo's Twilio account doesn't own that number, so it can't receive texts for you.",
      status: 400,
    };
  }
  if (!state.sms) {
    return {
      ok: false,
      reason: "That number can't receive texts — it's a voice-only line.",
      status: 400,
    };
  }

  const url = inboundWebhookUrl(origin);
  const expiresAt =
    source === "shared_test"
      ? new Date(Date.now() + SHARED_LOAN_DAYS * 24 * 60 * 60 * 1000)
      : null;

  // Someone else's live loan is not ours to take. An EXPIRED one is, which is
  // the whole point of the expiry — otherwise the shared line is claimed once
  // and gone.
  const holder = await db.crewInboxNumber.findUnique({ where: { e164: normalised } });
  if (holder && holder.companyId !== companyId) {
    const stillTheirs = !holder.expiresAt || new Date(holder.expiresAt) > new Date();
    if (stillTheirs) {
      return {
        ok: false,
        reason: "Another company is using the shared test line right now. Try again shortly.",
        status: 409,
      };
    }
    await db.crewInboxNumber.delete({ where: { id: holder.id } });
  }

  let line;
  try {
    line = await db.crewInboxNumber.upsert({
      where: { companyId },
      create: {
        companyId,
        e164: normalised,
        provider: "twilio",
        source,
        providerId: state.sid,
        expiresAt,
        ...(source === "dedicated"
          ? { rentPaidThroughAt: new Date(Date.now() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000) }
          : {}),
      },
      update: {
        e164: normalised,
        provider: "twilio",
        source,
        providerId: state.sid,
        expiresAt,
        // A CLAIM charges nothing, so its first month is on FieldQuo — which is
        // right, because FieldQuo already owns the number either way. Without
        // this a `dedicated` claim lands with a null paid-through, which the
        // rent cron reads as "never charged" and bills on its very next run.
        // Being invoiced the day after accepting a number nobody said was
        // rented is the surprise this codebase exists to avoid.
        ...(source === "dedicated"
          ? { rentPaidThroughAt: new Date(Date.now() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000) }
          : { rentPaidThroughAt: null, rentGraceUntilAt: null, rentWarnedAt: null }),
        // Cleared, not carried over. Until the webhook below actually succeeds
        // this row must not claim a connection it doesn't have.
        webhookUrl: null,
        connectedAt: null,
      },
    });
  } catch (err) {
    // P2002 on e164 — someone claimed it between the check above and here.
    if (err?.code === "P2002") {
      return {
        ok: false,
        reason: "Another company just claimed the shared test line. Try again shortly.",
        status: 409,
      };
    }
    throw err;
  }

  try {
    await pointWebhookAtUs(state.sid, url);
  } catch (err) {
    // The row stands with connectedAt null — an honest "yours, not wired yet"
    // that the screen renders as a retry rather than as success.
    return {
      ok: false,
      reason: `The number is reserved for you, but pointing its texts at FieldQuo failed: ${err.message}`,
      status: 502,
      line,
    };
  }

  line = await db.crewInboxNumber.update({
    where: { id: line.id },
    data: { webhookUrl: url, connectedAt: new Date() },
  });

  await db.company.update({ where: { id: companyId }, data: { crewInboxEnabled: true } });
  return { ok: true, line };
}

/**
 * Buy a crew texting line for one company.
 *
 * ══ Why this exists at all ═════════════════════════════════════════════════
 *
 * `source: "dedicated"` — "a number bought for this company alone" — has been
 * documented on CrewInboxNumber since the model was written, and until now
 * NOTHING could create one. claimCrewLine only ever CLAIMED a number the
 * account already held, which in practice meant the single shared test line.
 * A schema field that is described and unreachable is the first failure class
 * in AGENTS.md, and this is the read half arriving.
 *
 * ══ The order of operations is the whole design ════════════════════════════
 *
 * Availability, then money, then provider, then row. Each step is placed where
 * its failure costs the least:
 *
 *   1. Refuse if this deployment cannot RECEIVE. Selling a texting line to a
 *      company whose texts will 401 at the door is the dead control this
 *      codebase keeps getting swept for — and unlike everything below it, the
 *      contractor cannot fix it by trying again.
 *   2. Check the number is still free BEFORE reserving. Losing a race here
 *      costs the contractor nothing; losing it after the debit means a
 *      reserve-and-refund round trip they see on their statement.
 *   3. Reserve the first month BEFORE calling Twilio. "Buy, then charge" leaves
 *      FieldQuo holding a live number whenever the charge is the half that
 *      fails — see the voice route, which learned this the same way.
 *   4. Buy WITH the webhook in the same create() call. Twilio accepts smsUrl on
 *      creation, so there is no window in which the number exists, bills us,
 *      and points nowhere. claimCrewLine has that window and needs it, because
 *      it operates on numbers that already exist.
 *   5. Refund on any provider failure. The company must not be down a month's
 *      rental for a number they never got.
 *
 * @param origin  this deployment's origin — the webhook is pointed at it, so a
 *                preview build buying a number wires it to the preview. That is
 *                correct: a number bought from a branch belongs to that branch.
 */
export async function purchaseCrewLine({ companyId, e164, origin }) {
  if (!companyId) return { ok: false, reason: "No company.", status: 400 };

  const normalised = toE164(e164);
  if (!normalised) {
    return { ok: false, reason: "That doesn't look like a phone number.", status: 400 };
  }

  if (!twilioConfigured()) {
    return {
      ok: false,
      reason: "Crew texting isn't available on your account yet. There's nothing for you to do — it'll appear here when it's ready.",
      status: 503,
    };
  }

  // Step 1. Deliberately before anything reversible: a line that cannot hear
  // the crew is not a line, and no retry fixes a missing deployment secret.
  if (!crewSignatureConfigured()) {
    return {
      ok: false,
      reason: "Crew texting isn't available on your account yet. There's nothing for you to do — it'll appear here when it's ready.",
      status: 503,
    };
  }

  const existing = await db.crewInboxNumber.findUnique({ where: { companyId } });
  if (existing) {
    return {
      ok: false,
      reason: "You already have a crew texting number. Give that one back first if you want a different one.",
      status: 409,
    };
  }

  // Step 2. null means Twilio could not answer — which is NOT the same as
  // "taken", and must not be collapsed into one. Buying on "I don't know" sells
  // a number that may already be gone; refusing on it blocks every purchase
  // during a Twilio blip. So the two get different refusals.
  const free = await isStillAvailable(normalised).catch(() => null);
  if (free === false) {
    return {
      ok: false,
      reason: `${normalised} was taken while you were choosing. Nothing has been charged — search again and pick another.`,
      status: 409,
    };
  }
  if (free === null) {
    return {
      ok: false,
      reason: "We couldn't check whether that number is still free. Nothing has been charged — please try again in a moment.",
      status: 503,
    };
  }

  // Step 3. The browser posts a NUMBER, never an amount (non-negotiable #5);
  // the price is read from our own rows inside reserveSpend.
  const ref = crewLineSetupRef(randomUUID());
  const offered = await spendAvailable(companyId);

  let claim;
  try {
    claim = await db.$transaction(
      async (tx) => {
        // Re-asked inside the transaction, not just above: between the read at
        // the top of this function and this line sits an availability call to
        // Twilio, and a second request arriving in that window used to find no
        // line either. Same lesson as the voice route, same fix.
        const raced = await tx.crewInboxNumber.findUnique({ where: { companyId } });
        if (raced) return { raced };

        const flight = await crewLinePurchaseInFlight({ companyId, prisma: tx });
        if (flight.inFlight) return { flight };

        return {
          reserved: await reserveSpend({
            companyId,
            kind: "crew_line_setup",
            ref,
            note: "First month — crew texting number",
            prisma: tx,
            available: offered,
          }),
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    // A lost race is not a fault. The caller owes the same refusal it would
    // have given had the two arrived a second apart, never a 500.
    if (isSerialisationFailure(err)) {
      return {
        ok: false,
        reason: "We're already setting a number up for you. Give it a moment and refresh.",
        status: 409,
      };
    }
    return {
      ok: false,
      reason: "We couldn't start setting a number up just now. Nothing has been charged — please try again.",
      status: 503,
    };
  }

  if (claim.raced) {
    return {
      ok: false,
      reason: "You already have a crew texting number.",
      status: 409,
    };
  }
  if (claim.flight?.inFlight) {
    return {
      ok: false,
      reason: "We're already setting a number up for you. Give it a moment and refresh.",
      status: 409,
    };
  }
  if (!claim.reserved?.allowed) {
    // spendVerdict carries the figures so the screen can say WHY rather than
    // "insufficient balance" after the fact.
    return {
      ok: false,
      reason: "You don't have enough credit for the first month of a crew texting number.",
      verdict: claim.reserved,
      status: 402,
    };
  }

  const url = inboundWebhookUrl(origin);

  // Step 4. smsUrl on creation — the number is never live and unwired.
  let bought;
  try {
    bought = await twilioRest.incomingPhoneNumbers.create({
      phoneNumber: normalised,
      smsUrl: url,
      smsMethod: "POST",
      friendlyName: `FieldQuo crew line — ${companyId}`,
    });
  } catch (err) {
    // Step 5.
    await refundReservation({
      companyId,
      ref,
      cents: CREW_LINE_MONTHLY_CENTS,
      note: "Refund — crew texting number could not be bought",
    }).catch(() => {});
    return {
      ok: false,
      reason: `We couldn't buy that number: ${err.message}. Nothing has been charged.`,
      status: 502,
    };
  }

  // Twilio has our money now, so a failure from here does NOT refund — the
  // number exists and is ours. It gets recorded, and the row is what makes it
  // releasable; losing it is how a number bills forever with nothing pointing
  // at it. If the write fails the number is orphaned at the provider, which
  // /platform/crew-lines lists precisely so it can be found and released.
  try {
    const line = await db.crewInboxNumber.create({
      data: {
        companyId,
        e164: normalised,
        provider: "twilio",
        source: "dedicated",
        providerId: bought.sid,
        webhookUrl: url,
        connectedAt: new Date(),
        // The first month is the reservation that was just debited, so rent is
        // paid through 30 days out and the cron leaves it alone until then.
        // Null here would read as "never charged" and bill them twice on the
        // next run.
        rentPaidThroughAt: new Date(Date.now() + RENT_PERIOD_DAYS * 24 * 60 * 60 * 1000),
        // Null on purpose: a bought number does not lapse. Only a loan does.
        expiresAt: null,
      },
    });
    await db.company.update({
      where: { id: companyId },
      data: { crewInboxEnabled: true },
    });
    return { ok: true, line, chargedCents: CREW_LINE_MONTHLY_CENTS };
  } catch (err) {
    console.error("[crew] bought a number but could not record it:", err?.message, bought.sid);
    return {
      ok: false,
      reason: "The number was bought but we couldn't finish setting it up. Contact support and quote this number — nothing further will be charged.",
      orphanSid: bought.sid,
      status: 500,
    };
  }
}

/**
 * Give the line back.
 *
 * The webhook is un-pointed at Twilio too. Leaving it aimed here would keep
 * delivering a released number's texts to an endpoint that no longer resolves
 * them to anybody — messages that arrive, resolve to no tenant, and vanish,
 * which looks exactly like the bug we started with.
 */
export async function releaseCrewLine(companyId) {
  const line = await db.crewInboxNumber.findUnique({ where: { companyId } });
  if (!line) return { ok: true, released: false };

  // ── A loan is un-pointed. A PURCHASE is handed back ──────────────────────
  //
  // These are different numbers with different owners and the same row shape,
  // and treating them alike breaks one of them:
  //
  //   shared_test  FieldQuo's own line, lent out. Un-point it and it is free
  //                for the next company. Deleting it would destroy the only
  //                test line every tenant shares.
  //   dedicated    Bought for this company. Un-pointing alone leaves FieldQuo
  //                renting a number nobody uses and nothing points at, for
  //                ever — the exact shape of the voice-number bug that took a
  //                release path to fix. It has to go back to the carrier.
  //
  // Both are best-effort: a provider we cannot reach must not strand a company
  // with a line they cannot hand back. The row goes either way, and the number
  // is recoverable from /platform/crew-lines, which lists what the account
  // actually holds rather than what our rows claim.
  if (line.providerId) {
    if (line.source === "dedicated") {
      await twilioRest
        .incomingPhoneNumbers(line.providerId)
        .remove()
        .catch((err) => {
          console.error(
            "[crew] released a dedicated line but Twilio kept it:",
            line.e164,
            line.providerId,
            err?.message,
          );
        });
    } else if (line.connectedAt) {
      await twilioRest
        .incomingPhoneNumbers(line.providerId)
        .update({ smsUrl: "", smsMethod: "POST" })
        .catch(() => {});
    }
  }

  await db.crewInboxNumber.delete({ where: { id: line.id } });
  await db.company.update({ where: { id: companyId }, data: { crewInboxEnabled: false } });
  return { ok: true, released: true, source: line.source };
}
