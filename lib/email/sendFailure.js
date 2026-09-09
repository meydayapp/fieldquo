// lib/email/sendFailure.js
//
// What a send that did not happen IS, and who gets told.
//
// ══ The two jobs this file exists to stop being done twice ═════════════════
//
// sendEmail (lib/email/resend.js) never throws. It answers `{ skipped }` when
// the deployment has no key, `{ error }` when Resend refused or the call blew
// up, and `{ id }` on success. Three shapes, and every caller reads them
// differently — or, in the follow-up cron's case, did not read them at all:
// it incremented `sent` on a return value it never looked at, having already
// written the FollowUpLog row that guarantees it will never try again.
//
// So there are two things here and nothing else: `sendOutcome` reads that
// return value once, and `reportQuoteNotDelivered` tells the contractor
// through the one notification path.
//
// ══ What this deliberately does NOT do ═════════════════════════════════════
//
// Bounces. There is no Resend webhook in this deployment — no route, no svix
// dependency, no delivery-event store, and no column on Quote or Client that
// could hold one. Once Resend's API accepts a message, FieldQuo learns nothing
// further about it, so Basir Mohmand's quote sitting in a spam folder for
// three weeks remains invisible to this code and would still be invisible if
// this file pretended otherwise. Manny Conto's half is covered, and it is
// covered twice: the address is refused at capture (lib/validation.js's
// emailProblem) and the refusal to send is reported here.
//
// Adding the bounce half means a `POST /api/webhooks/resend` verifying svix
// signatures, a place to put `email.bounced` and `email.complained`, and a
// cause value below to carry them. It is a real piece of work and naming it
// here is more honest than a `bouncedAt` column nothing ever writes.

import { notifyEvent } from "@/lib/notifications/notify";

/**
 * The closed vocabulary of `quote.undelivered`'s `cause` param.
 *
 * Three values because there are three DIFFERENT things the contractor has to
 * do, and that is the only test a vocabulary like this has to pass:
 *
 *   address       the address cannot be delivered to — fix the client record.
 *   rejected      Resend refused — usually an unverified sending domain or a
 *                 rate limit, and the fix is in Settings, not on the client.
 *   unconfigured  this deployment has no mail set up at all. FieldQuo's
 *                 problem, and the contractor should know it is not theirs.
 */
export const SEND_FAILURE_CAUSES = Object.freeze(["address", "rejected", "unconfigured"]);

/**
 * Read one sendEmail() return value.
 *
 * @returns {{ ok: boolean, cause: string|null, message: string|null }}
 *
 * `ok` is TRUE only for a result that carries neither `skipped` nor `error`.
 * A null/undefined result is a failure, not a success: a caller that lost the
 * value entirely is exactly the caller the follow-up cron was.
 */
export function sendOutcome(result) {
  if (!result || typeof result !== "object") {
    return { ok: false, cause: "rejected", message: "No result from the mail service." };
  }
  if (result.skipped) {
    return { ok: false, cause: "unconfigured", message: "RESEND_API_KEY is not set on this deployment." };
  }
  if (result.error) {
    const message = typeof result.error === "string" ? result.error : result.error?.message || "Send failed";
    // Resend's own wording for a malformed recipient. Mapped to `address`
    // because that is the only cause whose fix is on the client record — the
    // difference decides which screen the contractor opens.
    const cause = /invalid.*(email|recipient|to\b)|recipient.*invalid|not a valid email/i.test(message)
      ? "address"
      : "rejected";
    return { ok: false, cause, message };
  }
  return { ok: true, cause: null, message: null };
}

/**
 * Tell the company a quote did not go out.
 *
 * Best-effort and never throws, like every other notifyEvent call site: the
 * send has already failed and a feed problem must not turn that into a 500 on
 * a cron or a bodyless error on a Send button.
 *
 * @param actorUserId  the member who pressed Send, or null for the cron.
 *                     Passed through so notifyEvent's "nobody is told what
 *                     they themselves just did" rule applies — the person
 *                     looking at the 502 does not also need a feed row.
 */
export async function reportQuoteNotDelivered({
  companyId,
  quoteId,
  quoteNumber,
  clientName,
  cause,
  actorUserId = null,
}) {
  if (!companyId || !quoteId) return { created: false, delivered: 0, reason: "no_company" };
  return notifyEvent({
    companyId,
    type: "quote.undelivered",
    entityId: quoteId,
    actorUserId,
    params: {
      quoteNumber: quoteNumber || null,
      clientName: clientName || null,
      // An unrecognised cause renders NO secondary line rather than a raw
      // token — see lib/notifications/render.js — so a value from outside the
      // vocabulary degrades to a quieter row, never to a leaked provider
      // string.
      cause: SEND_FAILURE_CAUSES.includes(cause) ? cause : null,
    },
  }).catch(() => ({ created: false, delivered: 0, reason: "threw" }));
}
