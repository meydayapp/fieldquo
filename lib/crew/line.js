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
import { twilioRest, toE164 } from "@/lib/sms/twilioClient";

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
      },
      update: {
        e164: normalised,
        provider: "twilio",
        source,
        providerId: state.sid,
        expiresAt,
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

  if (line.providerId && line.connectedAt) {
    // Best-effort: a provider we can't reach must not strand the company with a
    // line they can't hand back. The row goes either way.
    await twilioRest
      .incomingPhoneNumbers(line.providerId)
      .update({ smsUrl: "", smsMethod: "POST" })
      .catch(() => {});
  }

  await db.crewInboxNumber.delete({ where: { id: line.id } });
  await db.company.update({ where: { id: companyId }, data: { crewInboxEnabled: false } });
  return { ok: true, released: true };
}
