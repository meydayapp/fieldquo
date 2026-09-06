// lib/crew/platformNumber.js
//
// FieldQuo buying, and giving back, a number of its OWN.
//
// ══ Why this is separate from purchaseCrewLine ═════════════════════════════
//
// They look alike and they are not the same transaction. A contractor's line is
// sold: a month is reserved from their credit balance first, refunded if the
// provider refuses, and billed again every 30 days by a cron that will take the
// number back if the balance runs dry. FieldQuo's own number is BOUGHT — the
// money is FieldQuo's, there is no balance to check, no reservation to refund
// and no grace period to run.
//
// Folding both into one function would mean a `platform: true` flag switching
// off the reservation, the refund, the rent stamp and the tenant-facing
// refusals. That flag is how the platform path would eventually charge a tenant,
// or the tenant path skip its reservation. Two callers, two functions, one
// shared provider call.
//
// What they DO share is the thing that matters at the carrier: the number is
// bought with its webhook already set, so it is never live and unwired.

import { db } from "@/lib/db";
import { twilioRest, twilioConfigured, toE164 } from "@/lib/sms/twilioClient";
import { forgetSystemNumber } from "@/lib/sms/systemNumber";
import { isStillAvailable } from "@/lib/voice/numberSearch";
import { inboundWebhookUrl } from "@/lib/crew/line";
import { sharedTestLineE164 } from "@/lib/crew/capability";

/** Everything FieldQuo currently holds, newest first. */
export async function platformNumbers() {
  return db.platformSmsNumber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The number lent out as the shared crew test line — bought row first, then env.
 *
 * ══ A purpose that was written and never read ══════════════════════════════
 *
 * The console's purchase panel offers three purposes and writes them to
 * PlatformSmsNumber.purpose. `system` is read (lib/sms/systemNumber.js) and
 * `sales` is read (webhookUrlFor, above). `shared_test` was read by nothing at
 * all: the only thing that decided which number gets lent was
 * `sharedTestLineE164()`, which reads TWILIO_PHONE_NUMBER and nothing else. So
 * buying a "Shared test line" produced a row, a monthly Twilio bill, and no
 * change whatsoever to what a contractor could claim. AGENTS.md's first named
 * failure class, in a purchase flow.
 *
 * It matters to the answer this console gives about TWILIO_PHONE_NUMBER.
 * Production's value names +17372212163, a number the account has never held,
 * and the honest advice is to unset it — advice that would have been a lie
 * while unsetting it disabled the feature permanently regardless of what
 * FieldQuo bought.
 *
 * Same resolution order as systemSmsNumber, for the same reason: a number
 * FieldQuo actually bought beats one named in configuration, because only one
 * of those is evidence. The env var stays as the fallback so a self-hoster can
 * still point at a number by hand.
 *
 * @returns { e164, source } — source is "row" | "env" | null. The source is
 *          returned, not just the number, because the console has to be able to
 *          say WHICH of the two is answering: that is the whole difference
 *          between "the variable is load-bearing" and "the variable is dead
 *          weight you can now remove".
 */
export async function sharedTestLine() {
  let row = null;
  try {
    row = await db.platformSmsNumber.findFirst({
      where: { purpose: "shared_test", active: true },
      orderBy: { createdAt: "asc" },
      select: { e164: true },
    });
  } catch {
    // A database blip must not make a configured line vanish. Falls through to
    // the env var below, exactly as systemSmsNumber does.
  }
  if (row?.e164) return { e164: row.e164, source: "row" };
  const fromEnv = sharedTestLineE164();
  return fromEnv ? { e164: fromEnv, source: "env" } : { e164: null, source: null };
}

/**
 * What a platform number can be bought for, and the complete list.
 *
 * Exported so the console's selector and the purchase validation cannot drift
 * apart into two lists — one of which would offer a purpose the other refuses.
 */
// `sales_voice` joined this list on 2026-09-06. It had been READ for weeks —
// lib/sales/calls/store.js resolves the rep's caller id from a row with that
// purpose, app/api/rep-dial/inbound answers a contractor ringing one back, and
// inboundRouting.js told the owner to "buy one under Crew lines with the
// purpose set to Sales voice" — while nothing could WRITE one: this list did
// not name it, the page did not offer it, and no path anywhere created a row
// with it. An instruction pointing at a control that did not exist, which is
// the failure AGENTS.md opens with. Found the day the owner's Twilio profile
// was approved and calling still could not go green.
export const PLATFORM_NUMBER_PURPOSES = ["system", "shared_test", "sales", "sales_voice"];

/**
 * Where a number of each purpose has its inbound texts delivered.
 *
 * This is NOT cosmetic and it is not one URL. The crew endpoint resolves the
 * number it was texted against CrewInboxNumber; a sales number is not in that
 * table and never will be, so a STOP arriving there would resolve to nobody and
 * be dropped with a silent 200 — a "Reply STOP to opt out" line with nothing
 * listening behind it, which is the exact bug app/api/sms/inbound/route.js was
 * written to close in the first place.
 *
 * `sales_voice` is null on purpose — no SMS webhook at all. /api/sms/inbound
 * resolves `To` against a company's own number or a purpose-"sales" row and
 * would file a text to a voice number under nobody; Twilio then keeps such a
 * text in its own log and fires no webhook. The purchase screen says so in
 * words ("texts to it are not delivered"), because a line that quietly loses
 * texts is the other half of the same failure. Reps text from the Sales number.
 */
function webhookUrlFor(purpose, origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  if (purpose === "sales") return `${base}/api/sms/inbound`;
  if (purpose === "sales_voice") return null;
  return inboundWebhookUrl(origin);
}

/**
 * The VOICE webhook, for a "sales_voice" number only — the route that answers
 * a contractor ringing back the number a rep called them from. Null for every
 * other purpose, matching PlatformSmsNumber.voiceUrl's own rule: an SMS number
 * carrying a voice URL would answer calls nobody meant it to answer.
 */
function voiceWebhookUrlFor(purpose, origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  return purpose === "sales_voice" ? `${base}/api/rep-dial/inbound` : null;
}

/**
 * Buy a number for FieldQuo itself.
 *
 * @param purpose  "system" (the outbound From for companies with no number),
 *                 "shared_test" (the line lent out one company at a time), or
 *                 "sales" (FieldQuo's own first-party number, which its reps
 *                 text their signup link from — see lib/sales/salesSms.js for
 *                 why that must not be the system number).
 */
export async function buyPlatformNumber({ e164, purpose = "system", origin }) {
  const normalised = toE164(e164);
  if (!normalised) return { ok: false, reason: "That doesn't look like a phone number.", status: 400 };
  if (!PLATFORM_NUMBER_PURPOSES.includes(purpose)) {
    return { ok: false, reason: `Unknown purpose "${purpose}".`, status: 400 };
  }
  if (!twilioConfigured()) {
    return { ok: false, reason: "Twilio credentials aren't set on this deployment.", status: 503 };
  }

  const existing = await db.platformSmsNumber.findUnique({ where: { e164: normalised } });
  if (existing?.active) {
    return { ok: false, reason: "FieldQuo already holds that number.", status: 409 };
  }

  // null is "Twilio couldn't answer", which is NOT "it's taken". Buying on a
  // shrug sells a number that may be gone; refusing on it blocks every purchase
  // during a blip. Different answers, different refusals.
  const free = await isStillAvailable(normalised).catch(() => null);
  if (free === false) {
    return { ok: false, reason: `${normalised} was taken while you were choosing.`, status: 409 };
  }
  if (free === null) {
    return { ok: false, reason: "Couldn't check whether that number is still free. Try again in a moment.", status: 503 };
  }

  // The webhook is set in the same call that buys it. A shared_test line will be
  // repointed per loan by claimCrewLine, but it must never sit live and aimed at
  // nothing in between — an inbound text to an unpointed number is a message
  // that arrives, resolves to nobody, and vanishes.
  // Each webhook only when the purpose has one — see the two helpers above.
  // Passing `smsUrl: null` would not omit it; it would be a Twilio error.
  //
  // Resolved BEFORE the try, because the row written after it stores voiceUrl.
  // The first version declared both inside the block, where they are out of
  // scope by the upsert: a ReferenceError thrown after Twilio had sold the
  // number and before the row existed — precisely the "FieldQuo owns a number
  // and has no row for it" state the comment below the try describes as
  // recoverable, manufactured on every purchase. The build's no-undef pass
  // caught it; nothing at runtime would have, because the throw came after
  // the money moved.
  const smsUrl = webhookUrlFor(purpose, origin);
  const voiceUrl = voiceWebhookUrlFor(purpose, origin);
  let bought;
  try {
    bought = await twilioRest.incomingPhoneNumbers.create({
      phoneNumber: normalised,
      ...(smsUrl ? { smsUrl, smsMethod: "POST" } : {}),
      ...(voiceUrl ? { voiceUrl, voiceMethod: "POST" } : {}),
      friendlyName: `FieldQuo ${purpose}`,
    });
  } catch (err) {
    return { ok: false, reason: `Twilio refused: ${err.message}`, status: 502 };
  }

  // Bought. From here a failure leaves a number FieldQuo owns and has no row
  // for — recoverable, because this page lists what the ACCOUNT holds rather
  // than what our rows claim, which is the whole reason it was built that way.
  const row = await db.platformSmsNumber.upsert({
    where: { e164: normalised },
    // voiceUrl is stored so app/api/rep-dial/inbound can prove the number it
    // was rung on is one of ours (salesVoiceNumber selects it). Null for every
    // other purpose, on the update too, so a number re-bought for a different
    // purpose does not keep a voice webhook it no longer has.
    create: { e164: normalised, providerId: bought.sid, purpose, active: true, voiceUrl },
    update: { providerId: bought.sid, purpose, active: true, releasedAt: null, voiceUrl },
  });

  forgetSystemNumber();
  return { ok: true, number: row };
}

/**
 * Hand one back.
 *
 * Refuses while a tenant is holding it. A shared_test line that is on loan is
 * somebody's working crew inbox; releasing it out from under them would leave a
 * CrewInboxNumber row pointing at a number the account no longer owns, which is
 * precisely the our-records-disagree-with-the-provider state this area exists to
 * prevent.
 */
export async function releasePlatformNumber(e164) {
  const normalised = toE164(e164);
  const row = normalised
    ? await db.platformSmsNumber.findUnique({ where: { e164: normalised } })
    : null;
  if (!row || !row.active) return { ok: false, reason: "FieldQuo doesn't hold that number.", status: 404 };

  const onLoan = await db.crewInboxNumber.findUnique({ where: { e164: normalised } });
  if (onLoan) {
    return {
      ok: false,
      reason: "A company is using that number right now. Take it back from them first.",
      status: 409,
    };
  }

  if (row.providerId) {
    try {
      await twilioRest.incomingPhoneNumbers(row.providerId).remove();
    } catch (err) {
      // Not swallowed. Unlike a tenant release — where the row has to move or
      // the contractor is stuck holding a line they can't hand back — nobody is
      // blocked here, and marking it released while Twilio still bills for it
      // would hide a real cost from the only page that reports it.
      return { ok: false, reason: `Twilio wouldn't release it: ${err.message}`, status: 502 };
    }
  }

  const updated = await db.platformSmsNumber.update({
    where: { id: row.id },
    data: { active: false, releasedAt: new Date() },
  });

  forgetSystemNumber();
  return { ok: true, number: updated };
}
