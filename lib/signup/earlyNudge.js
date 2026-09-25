// lib/signup/earlyNudge.js
//
// The FIRST follow-up to somebody who started a FieldQuo signup and went
// quiet: five minutes after their last activity, "your free month is
// waiting", the link back to where they stopped, and the three things
// FieldQuo does for their trade — the same three the sales reps' intro email
// prints (lib/sales/tradeSellingPoints.js), never a second copy.
//
// ══ Five minutes — the owner's number, 2026-09-21 ═════════════════════════
//
// lib/signup/abandoned.js argued for twenty-four hours, and its argument was
// about a Stripe Checkout session that stays open for a day: writing "we
// noticed you didn't finish" to somebody whose checkout tab is still live is
// writing to somebody mid-signup. The owner read that and overrode it:
//
//   "If they didn't complete the signup after 5 minutes they should get a
//    follow-up email prompting them to complete the signup so they can
//    enjoy the free month, and maybe a brief reminder of the benefits."
//
// His reason is the population. The 24-hour argument was written for people
// who reached Stripe; most of the people this file writes to never got past
// the first or second step, and for them there is no checkout tab to wait
// out — there is a form they closed. Five minutes of silence is the signal
// that they have stopped, and the letter's job is to be in the inbox while
// the thought is still warm. So the delay here is FIVE MINUTES OF SILENCE,
// measured from their last activity, not from when they started: a person
// still moving through the steps is not abandoned, whatever the clock says
// since step one.
//
// The 24-hour note (lib/signup/abandoned.js) is kept as the SECOND and last
// touch, for the people who reached the card screen and still have not paid
// a day later. Two letters per person, ever: this one, then that one.
//
// ══ One decision for two kinds of row ══════════════════════════════════════
//
// A person is a SignupLead until the account step creates a login and a
// Company — and a Company (with no Subscription) after it. The same person
// can be both in one afternoon. So the decision takes a PERSON, shaped the
// same way from either row (see the two shapers below), and the record of a
// send is keyed on the normalised address (SignupNudge, touch "early"), not
// on whichever row happened to be current.
//
// ══ Pure ═══════════════════════════════════════════════════════════════════
//
// No database, no clock of its own. scripts/check-abandoned-signup.mjs
// executes every branch, and the cron (app/api/cron/signup-recovery) is only
// responsible for the reads, the claim and the order of the side effects.

import { hasFinishedSignup, nudgeRecipient, NUDGE_WINDOW_DAYS } from "@/lib/signup/abandoned";
import { FINISHED_SAME_VISITOR, emailKeyOf, tradeKeyForIndustries } from "@/lib/signup/leads";
import { isDismissed } from "@/lib/signup/dismissal";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Five minutes of silence, then the letter. See the header. */
export const EARLY_NUDGE_DELAY_MINUTES = 5;

/** SignupNudge.touch for this letter, and for the 24-hour note it precedes. */
export const EARLY_TOUCH = "early";
export const RECOVERY_TOUCH = "recovery";

/**
 * The person behind a SignupLead row — somebody who has not created a login
 * yet. Their last activity is the row's lastSeenAt; a completed row is a
 * customer and is refused — and so is a row stamped FINISHED_SAME_VISITOR,
 * the half-typed address a browser left behind on its way to finishing under
 * another one (lib/signup/salesFloor.js recordSignupCompletion).
 */
export function earlyNudgePersonFromLead(lead) {
  if (!lead) return null;
  return {
    kind: "lead",
    signupLeadId: lead.id,
    companyId: lead.completedCompanyId || null,
    email: lead.email,
    firstName: lead.firstName || null,
    companyName: lead.companyName || null,
    language: lead.language || null,
    tradeKey: tradeKeyForIndustries(lead.trades),
    stepReached: lead.stepReached || null,
    lastActivityAt: lead.lastSeenAt || null,
    completed: Boolean(lead.completedCompanyId) || lead.skipReason === FINISHED_SAME_VISITOR,
    // For the same-browser rule in planEarlyNudges: which browser typed it,
    // and which business it was for.
    visitorKey: visitorCompanyKey(lead.visitorId, lead.companyName),
    // Removed from /platform/signups by the owner (lib/signup/dismissal.js).
    dismissed: isDismissed(lead),
    isDemo: false,
    resumeToken: lead.resumeToken || null,
  };
}

/**
 * The person behind a Company with no Subscription — they created a login
 * and a company. Their last activity is the later of the company's creation
 * and the linked SignupLead's lastSeenAt (the lead is stamped "checkout" when
 * the company is created, and keeps moving if they come back to /signup).
 *
 * ══ Completed means FINISHED SIGNING UP, not "has a card" ═══════════════
 *
 * This read `completed: company.subscription !== null` until 2026-09-25.
 * Since 38d3308d signup ends at Services with no card and no Subscription
 * row, so every new company read as "stopped at the card" — and jaspedo got
 * "you didn't finish" at 03:50 UTC, six minutes after finishing. `completed`
 * is now lib/signup/abandoned.js hasFinishedSignup: a Subscription row OR the
 * card-free trial. The same predicate every other reader asks.
 *
 * `company.subscription` AND `company.trialEndsAt` must be SELECTED —
 * hasFinishedSignup throws otherwise: undefined would read as "didn't
 * finish" and mail a customer.
 */
export function earlyNudgePersonFromCompany(company, { ownerName = null } = {}) {
  if (!company) return null;
  if (company.subscription === undefined) {
    throw new Error("earlyNudgePersonFromCompany: company.subscription was not selected — cannot tell 'no card' from 'not loaded'");
  }
  // A demo never signed up; hasFinishedSignup answers false for one, and the
  // isDemo refusal in decideEarlyNudge is what keeps it unmailed.
  const completed = company.isDemo ? false : hasFinishedSignup(company);
  const created = company.createdAt ? new Date(company.createdAt).getTime() : 0;
  const seen = company.signupLead?.lastSeenAt ? new Date(company.signupLead.lastSeenAt).getTime() : 0;
  const last = Math.max(created, seen);
  return {
    kind: "company",
    signupLeadId: company.signupLead?.id || null,
    companyId: company.id,
    email: company.email,
    firstName: company.signupLead?.firstName || (ownerName ? String(ownerName).split(" ")[0] : null),
    companyName: company.name || null,
    language: company.defaultLanguage || company.signupLead?.language || null,
    tradeKey: tradeKeyForIndustries(company.industries) || tradeKeyForIndustries(company.signupLead?.trades),
    stepReached: company.signupLead?.stepReached || "checkout",
    lastActivityAt: last ? new Date(last) : null,
    completed,
    dismissed: isDismissed(company),
    isDemo: Boolean(company.isDemo),
    resumeToken: null,
  };
}

/**
 * Should this person get the five-minute letter now?
 *
 * @param person      from one of the two shapers above
 * @param suppressed  FieldQuo's do-not-contact list closes their email — read
 *                    in the request that sends, never cached
 * @param alreadySent a SignupNudge row with touch "early" and sentAt set
 *                    exists for this address
 * @param heldByRep   a rep holds this person's row on the floor: the rep's
 *                    own intro email is the follow-up, and two letters in
 *                    five minutes from two senders is the thing to avoid
 * @returns { send, reason }
 */
export function decideEarlyNudge({ person, suppressed = false, alreadySent = false, heldByRep = false, now = new Date() } = {}) {
  if (!person) return { send: false, reason: "no_person" };
  if (person.isDemo) return { send: false, reason: "demo" };
  // The assertion this file exists to make: a customer never gets this.
  if (person.completed) return { send: false, reason: "completed" };
  // Removed from /platform/signups: the owner called the row junk.
  if (person.dismissed) return { send: false, reason: "dismissed" };
  if (!nudgeRecipient(person.email)) return { send: false, reason: "no_recipient" };
  if (suppressed) return { send: false, reason: "suppressed" };
  if (alreadySent) return { send: false, reason: "already_sent" };
  if (heldByRep) return { send: false, reason: "held_by_rep" };
  const last = person.lastActivityAt ? new Date(person.lastActivityAt) : null;
  if (!last || Number.isNaN(last.getTime())) return { send: false, reason: "no_activity" };
  const quiet = now.getTime() - last.getTime();
  if (quiet < EARLY_NUDGE_DELAY_MINUTES * MINUTE_MS) return { send: false, reason: "still_active" };
  // The same outer window as the 24-hour note, for the same CASL reason:
  // implied consent from an enquiry is not open-ended.
  if (quiet > NUDGE_WINDOW_DAYS * DAY_MS) return { send: false, reason: "too_late" };
  return { send: true, reason: "due" };
}

/**
 * One browser, one business: `${visitorId}|${company name, folded}`. Null
 * unless both are there — without either, "the same person" is a guess.
 */
export function visitorCompanyKey(visitorId, companyName) {
  const v = typeof visitorId === "string" ? visitorId.trim() : "";
  const c = typeof companyName === "string" ? companyName.trim().toLowerCase().replace(/\s+/g, " ") : "";
  return v && c ? `${v}|${c}` : null;
}

/**
 * The batch: one letter per ADDRESS, the row with the latest activity
 * winning when a person has both a lead and a company, the refusals counted
 * per reason so the cron's response says what it did not do.
 *
 * @param people               every candidate, both kinds, unfiltered
 * @param suppressedAddresses  Set of normalised addresses on the DNC list
 * @param sentKeys             Set of emailKeys with an "early" SignupNudge sent
 * @param heldKeys             Set of emailKeys a rep holds on the floor
 * @param finishedAddressKeys  Set of emailKeys that already own a FINISHED
 *                             signup somewhere — a company on that address,
 *                             or a login on it that owns one. Read by the
 *                             cron from Company/User, never from the rows
 *                             above (a paying company is not in them).
 * @param finishedVisitorKeys  Set of visitorCompanyKey()s whose signup
 *                             finished — the same browser, the same business,
 *                             completed under another address.
 * @returns { sends: [{ person, to, emailKey }], skipped: [{ person, reason }] }
 */
export function planEarlyNudges({ people = [], suppressedAddresses = new Set(), sentKeys = new Set(), heldKeys = new Set(), finishedAddressKeys = new Set(), finishedVisitorKeys = new Set(), now = new Date() } = {}) {
  const byKey = new Map();
  const skipped = [];
  // ── A finished (or removed) person closes the ADDRESS ─────────────────
  //
  // "Latest activity wins" below picks ONE row per address, and before this
  // pass a completed row could lose that pick: two companies at one inbox
  // (a finished trial, and an older attempt with a later lastSeenAt on its
  // lead) compared on the clock alone, and the unfinished one was mailed
  // "you didn't finish" at the address of somebody who had. Any completed
  // or dismissed row at an address now refuses the whole address, whatever
  // the clock says — the refusal can never be out-voted.
  //
  // ── …and so does a finish that is not in this batch at all ─────────────
  //
  // The owner, 2026-09-25: "your free month is waiting" reached his first
  // test address six minutes after he finished signing up. That address had owned a login since 09-13 with a PAYING company on it —
  // which the company query never fetches (it reads unfinished companies and
  // card-free trials), so nothing in the batch could close the address, and
  // the row he left on the account step (refused: login exists) was mailed.
  // The same run mailed an address half-typed on the way to the one he
  // finished under: the same browser, the same business name. Both are closed here, from facts the cron reads for the purpose.
  const closedKeys = new Map();
  for (const person of people) {
    const key = person ? emailKeyOf(person.email) : null;
    if (!key) continue;
    if (person.completed) closedKeys.set(key, "completed");
    else if (finishedAddressKeys.has(key) && closedKeys.get(key) !== "completed") closedKeys.set(key, "address_finished");
    else if (person.kind === "lead" && person.visitorKey && finishedVisitorKeys.has(person.visitorKey) && closedKeys.get(key) !== "completed") closedKeys.set(key, FINISHED_SAME_VISITOR);
    else if (person.dismissed && !closedKeys.has(key)) closedKeys.set(key, "dismissed");
  }
  for (const person of people) {
    if (!person) continue;
    const key = emailKeyOf(person.email);
    if (!key) {
      skipped.push({ person, reason: "no_recipient" });
      continue;
    }
    const prior = byKey.get(key);
    const at = person.lastActivityAt ? new Date(person.lastActivityAt).getTime() : 0;
    const priorAt = prior?.lastActivityAt ? new Date(prior.lastActivityAt).getTime() : 0;
    // A company row outranks a lead at the same address whatever the clock
    // says: it is the later state of the same person, and "completed" on it
    // is the refusal that must win.
    if (!prior || prior.kind === "lead" && person.kind === "company" || (prior.kind === person.kind && at > priorAt)) {
      if (prior) skipped.push({ person: prior, reason: "same_address_this_run" });
      byKey.set(key, person);
    } else {
      skipped.push({ person, reason: "same_address_this_run" });
    }
  }
  const sends = [];
  for (const [key, person] of byKey) {
    const to = nudgeRecipient(person.email);
    const closed = closedKeys.get(key);
    if (closed) {
      const reason = person.completed
        ? "completed"
        : closed === "address_finished" || closed === FINISHED_SAME_VISITOR
          ? closed
          : person.dismissed
            ? "dismissed"
            : `address_${closed}`;
      skipped.push({ person, reason });
      continue;
    }
    const verdict = decideEarlyNudge({
      person,
      suppressed: suppressedAddresses.has(to),
      alreadySent: sentKeys.has(key),
      heldByRep: heldKeys.has(key),
      now,
    });
    if (verdict.send) sends.push({ person, to, emailKey: key });
    else skipped.push({ person, reason: verdict.reason });
  }
  return { sends, skipped };
}
