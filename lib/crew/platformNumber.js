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

/** Everything FieldQuo currently holds, newest first. */
export async function platformNumbers() {
  return db.platformSmsNumber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Buy a number for FieldQuo itself.
 *
 * @param purpose  "system" (the outbound From for companies with no number) or
 *                 "shared_test" (the line lent out one company at a time).
 */
export async function buyPlatformNumber({ e164, purpose = "system", origin }) {
  const normalised = toE164(e164);
  if (!normalised) return { ok: false, reason: "That doesn't look like a phone number.", status: 400 };
  if (!["system", "shared_test"].includes(purpose)) {
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
  let bought;
  try {
    bought = await twilioRest.incomingPhoneNumbers.create({
      phoneNumber: normalised,
      smsUrl: inboundWebhookUrl(origin),
      smsMethod: "POST",
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
    create: { e164: normalised, providerId: bought.sid, purpose, active: true },
    update: { providerId: bought.sid, purpose, active: true, releasedAt: null },
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
