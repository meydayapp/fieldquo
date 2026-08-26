// lib/voice/outbound.js
//
// May we ring this number, and is now a reasonable time?
//
// ══ The only gate ══════════════════════════════════════════════════════════
//
// Every outbound call goes through `mayCall`. There is no other path, and
// nothing accepts a raw phone number from a form — the caller passes a lead, a
// client or a job, and consent is looked up from what that record proves.
//
// That's the difference between "we discourage cold calling" and "cold calling
// doesn't work here". A contractor who pastes in a purchased list gets a list of
// numbers with no consent rows, and every one of them is refused. TCPA is up to
// $1,500 PER CALL and CASL up to $10M; the liability lands on the contractor,
// but they will blame the tool that made it easy.
//
// ══ What counts as consent ═════════════════════════════════════════════════
//
// Only an evidenced request to be contacted:
//
//   self_quote      they submitted a quote request that SAID we would call
//   booking         they booked a visit
//   quote_approved  a quote they asked for was approved
//   job_completed   we did work at their property
//   manual          staff recorded a verbal request, with a note
//
// Note what isn't on that list: "they're in our database", "we met them at a
// trade show", "they're a realtor who might refer work". Those are cold.
import { db } from "@/lib/db";
import { toE164 } from "./numbers";

/** Sources we accept, and how long each one stays good for. */
export const CONSENT_SOURCES = {
  self_quote: { label: "Asked for a quote", months: 12 },
  booking: { label: "Booked a visit", months: 12 },
  quote_approved: { label: "Quote approved", months: 12 },
  // Shorter on purpose. "We finished your kitchen, how did we do" is welcome
  // for a few weeks and creepy a year later.
  job_completed: { label: "We did work for them", months: 3 },
  manual: { label: "Asked us to call", months: 6 },
};

/**
 * Reasonable calling hours, in the CLIENT's local day.
 *
 * 9am–8pm is inside the US/Canada telemarketing window (8am–9pm) with an hour's
 * margin at each end, because an agent that starts dialling at 8:01 and runs
 * until 20:59 is technically compliant and still the reason somebody blocks the
 * number.
 */
export const CALL_WINDOW = { startHour: 9, endHour: 20 };

/** Is it a sane time to ring, where they are? */
export function withinCallingHours(now = new Date(), timeZone = "America/Toronto") {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-CA", { hour: "numeric", hour12: false, timeZone }).format(now),
    );
    if (!Number.isFinite(hour)) return false;
    return hour >= CALL_WINDOW.startHour && hour < CALL_WINDOW.endHour;
  } catch {
    // An unknown timezone means we don't know what time it is for them, and
    // "probably fine" is not good enough to ring a stranger's phone.
    return false;
  }
}

/**
 * Record that someone asked to be contacted.
 *
 * `disclosure` is the exact wording they were shown, stored rather than
 * referenced — the form copy will change, and the defence has to be what THIS
 * person actually saw.
 */
export async function recordConsent({
  companyId,
  phone,
  source,
  disclosure,
  leadId,
  clientId,
  quoteId,
  jobId,
  note,
}) {
  const e164 = toE164(phone);
  if (!companyId || !e164 || !CONSENT_SOURCES[source]) return null;

  return db.callConsent.create({
    data: { companyId, e164, source, disclosure, leadId, clientId, quoteId, jobId, note },
  });
}

/** They asked us to stop. Never deleted, and it beats everything. */
export async function optOut({ companyId, phone, note }) {
  const e164 = toE164(phone);
  if (!companyId || !e164) return null;

  // Marks every existing consent row for this number, and leaves one behind if
  // there were none — so "don't call me" is recorded even from someone we had
  // no permission to call in the first place.
  const updated = await db.callConsent.updateMany({
    where: { companyId, e164, optedOutAt: null },
    data: { optedOutAt: new Date() },
  });

  if (updated.count === 0) {
    await db.callConsent.create({
      data: {
        companyId,
        e164,
        source: "manual",
        note: note || "Asked not to be called",
        optedOutAt: new Date(),
      },
    });
  }
  return true;
}

/**
 * The decision itself, given rows that have already been read.
 *
 * Split out of mayCall so the compliance rules can be EXECUTED without a
 * database — a stop-listed number, an expired consent, a call at three in the
 * morning. These are the assertions that matter most in this file and they were
 * the ones no check could reach, because the only way in was an async function
 * that queried Postgres. Reading the conditions and agreeing with them is not
 * the same as running them.
 *
 * mayCall below is now just the two queries plus this.
 *
 * @param optedOut  a CallConsent row with optedOutAt set, or null
 * @param consents  live consent rows, newest first
 * @returns { allowed, reason, retryLater?, consent? }
 */
export function consentVerdict({ optedOut, consents = [], now = new Date(), timeZone }) {
  // ── Opt-out first, always ────────────────────────────────────────────────
  //
  // Checked before consent, not after. A number can have both — someone asks
  // for a quote in March and asks to be left alone in April — and the later
  // wish is the one that counts.
  if (optedOut) {
    return { allowed: false, reason: "They've asked not to be called." };
  }

  if (!consents.length) {
    return {
      allowed: false,
      reason:
        "Nobody at this number has asked to be contacted, so the agent won't call it. " +
        "It can call people who requested a quote, booked a visit, or had work done.",
    };
  }

  // Still in date? Each source has its own window — see CONSENT_SOURCES.
  const live = consents.find((c) => {
    const months = CONSENT_SOURCES[c.source]?.months ?? 0;
    const expires = new Date(c.createdAt);
    expires.setMonth(expires.getMonth() + months);
    return expires > now;
  });
  if (!live) {
    return {
      allowed: false,
      reason: "It's been too long since they last asked to hear from you.",
    };
  }

  if (!withinCallingHours(now, timeZone)) {
    return {
      allowed: false,
      // Not a refusal so much as a "not yet" — the caller can queue it.
      reason: `Outside calling hours (${CALL_WINDOW.startHour}:00–${CALL_WINDOW.endHour}:00 their time).`,
      retryLater: true,
      consent: live,
    };
  }

  return { allowed: true, reason: CONSENT_SOURCES[live.source].label, consent: live };
}

/**
 * The decision, for a real number in a real company.
 *
 * @returns { allowed, reason, consent }
 *          `reason` is written to be shown to staff — "no consent on file" is
 *          something they can act on, where a boolean isn't.
 */
export async function mayCall({ companyId, phone, now = new Date(), timeZone }) {
  const e164 = toE164(phone);
  if (!companyId || !e164) {
    return { allowed: false, reason: "That isn't a number we can dial." };
  }

  const [optedOut, consents] = await Promise.all([
    db.callConsent.findFirst({
      where: { companyId, e164, optedOutAt: { not: null } },
      select: { optedOutAt: true },
    }),
    db.callConsent.findMany({
      where: { companyId, e164, optedOutAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return consentVerdict({ optedOut, consents, now, timeZone });
}

// The disclosure strings live in ./disclosure.js — no imports there, so a FORM
// can render the same string this module stores, without dragging the database
// into a browser bundle. Re-exported so server code has one place to import
// from either way.
export { DISCLOSURE } from "./disclosure";
