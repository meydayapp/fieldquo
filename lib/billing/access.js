// lib/billing/access.js
//
// What a company is allowed to do right now, given whether they've paid.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
//   paid / in trial       everything
//   unpaid, 0–7 days      READ-ONLY — they see all their work, can't add to it
//   unpaid, past 7 days   locked, billing screen only
//
// Seven days of read-only rather than an immediate lock-out, because the point
// of the grace period is to get the card fixed, not to punish. Someone whose
// card expired on a Friday needs to still see Monday's jobs while they sort it
// out, and a contractor locked out mid-job churns angry and tells people.
//
// ── Nothing is ever deleted ────────────────────────────────────────────────
//
// A locked account is inaccessible, not erased. Their quotes, invoices, clients
// and photos stay exactly where they are, and paying restores everything
// instantly. That distinction matters: this is a closed system, so a company
// that loses access can't take their data elsewhere — which is precisely why
// destroying it would be indefensible, and why the warnings below start early
// and say plainly what happens.
import { cache } from "react";
import { db } from "@/lib/db";
import { CHECKOUT_GRACE_MS } from "@/lib/signup/setupGate";

/**
 * Read-only windows, in days.
 *
 * Two different situations, deliberately different lengths:
 *
 *   GRACE_DAYS (7)   a payment FAILED. Urgent — they may not even know. Short
 *                    enough to be a real prompt, long enough to survive a
 *                    weekend and a bank's fraud hold.
 *
 *   CANCELLED_DAYS   they CHOSE to leave. Not urgent and not a punishment: they
 *          (30)      may need to pull an old invoice for their accountant, and
 *                    the data is already sitting there costing nothing. It also
 *                    buys a real win-back window, and it removes the entire
 *                    class of "help, I've lost my records" support that
 *                    otherwise lands the week after every cancellation.
 */
export const GRACE_DAYS = 7;
export const CANCELLED_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Resolve access from a subscription row.
 *
 * Pure, so it can be tested against every combination of status and date
 * without a database — which matters because the states nobody exercises by
 * hand (no subscription at all, past_due with a null timestamp) are exactly the
 * ones that would silently grant or deny too much.
 *
 * @param sub  the Subscription row, or null
 * @param now  injectable, so the tests aren't time-dependent
 * @returns {{ level, daysLeft, reason, since }}
 *          level: "full" | "readonly" | "locked"
 */
export function accessFor(sub, now = new Date()) {
  // No subscription row at all. Full access on purpose: a company created by
  // hand, or one whose checkout webhook hasn't landed yet, must not be locked
  // out of a product they may well have paid for. Being wrong in this direction
  // costs a few days of usage; being wrong the other way locks a paying
  // customer out of their own business.
  if (!sub) {
    return { level: "full", daysLeft: null, reason: "no_subscription", since: null };
  }

  // ── Locked by FieldQuo for a terms breach ─────────────────────────────
  //
  // Read before status, because Stripe's status says "canceled" and that
  // path hands out thirty days of read-only for a customer who CHOSE to
  // leave. This company did not choose. The platform route that sets the
  // column cancels the Stripe subscription first, so money stops in the
  // same step; the audit row carries the reason.
  if (sub.accessLockedAt) {
    return { level: "locked", daysLeft: 0, reason: "terms", since: new Date(sub.accessLockedAt) };
  }

  if (sub.status === "active" || sub.status === "trialing") {
    // A paid plan booked to end on its paid-to date (cancel_at_period_end —
    // app/api/platform/billing/cancel/route.js) is FULL access until then;
    // `endsAt` is carried so the banner can say "ends on {date}" and offer
    // Resume, without the access level pretending anything has ended yet.
    // Null on every other row: absence of a booking is not a date.
    const endsAt = sub.cancelAtPeriodEnd ? (sub.cancelAt ? new Date(sub.cancelAt) : sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null) : null;
    return { level: "full", daysLeft: null, reason: sub.status, since: null, endsAt };
  }

  // ── Cancelled ──────────────────────────────────────────────────────────
  //
  // A decision, not a failure, so it gets a LONGER window than a failed
  // payment rather than none at all. Thirty days of read-only: they can still
  // pull last year's invoices for their accountant, and we're not holding
  // their own records hostage the day after they left.
  //
  // No canceledAt means an older row from before this was tracked. Read-only
  // rather than locked — the safe direction when we genuinely don't know when
  // they left.
  if (sub.status === "canceled") {
    const since = sub.canceledAt ? new Date(sub.canceledAt) : null;
    if (!since) {
      return { level: "readonly", daysLeft: CANCELLED_DAYS, reason: "canceled", since: null };
    }
    const elapsed = Math.max(0, now.getTime() - since.getTime());
    const daysLeft = Math.max(0, CANCELLED_DAYS - Math.floor(elapsed / DAY));
    return daysLeft > 0
      ? { level: "readonly", daysLeft, reason: "canceled", since }
      : { level: "locked", daysLeft: 0, reason: "canceled_expired", since };
  }

  // past_due. The clock starts at pastDueSince; if that's somehow missing,
  // start it NOW rather than assuming the worst — a null timestamp is our bug,
  // and a company shouldn't be locked out for it.
  const since = sub.pastDueSince ? new Date(sub.pastDueSince) : now;
  const elapsed = Math.max(0, now.getTime() - since.getTime());
  const daysLeft = Math.max(0, GRACE_DAYS - Math.floor(elapsed / DAY));

  return daysLeft > 0
    ? { level: "readonly", daysLeft, reason: "past_due", since }
    : { level: "locked", daysLeft: 0, reason: "grace_expired", since };
}

/**
 * The Company columns FieldQuo writes when it ends a company that had no
 * Stripe subscription to cancel (schema: Company.platformEndsAt). Spread into
 * every select that feeds trialAccessFor / fieldquoEndAccessFor, so a reader
 * cannot forget one and read an ended trial as a live one.
 */
export const FIELDQUO_END_SELECT = Object.freeze({
  platformEndsAt: true,
  platformEndMode: true,
  platformEndReason: true,
});

/**
 * FieldQuo ended this company from the platform console (no Stripe
 * subscription existed to cancel). Pure; null when nothing was ended.
 *
 * The same three meanings the Stripe path has (app/api/platform/companies/
 * [id]/cancel-subscription), read off the Company instead of Stripe:
 *
 *   terms       locked at once — reason "terms", the same reason a
 *               subscribed company's Subscription.accessLockedAt produces,
 *               so the locked screen, the 402 and the phone-number release
 *               (lib/voice/spendGate.js) need no second vocabulary.
 *   period_end  full access until platformEndsAt (the trial's end), then
 *   now         CANCELLED_DAYS read-only, then locked — the window a
 *               cancelled subscription gets, because the owner asked for the
 *               subscribed semantics, not the trial's seven days.
 *
 * Its own reasons ("fieldquo_ending", "fieldquo_ended", "fieldquo_ended_
 * locked") rather than "canceled": every sentence keyed on "canceled" says
 * "start the plan again", and a company FieldQuo ended cannot (checkout
 * refuses it — fieldquoEndRefusal below).
 *
 * An unparseable date is not a statement: null, never a lock.
 */
export function fieldquoEndAccessFor(company, now = new Date()) {
  const raw = company?.platformEndsAt;
  const at = raw instanceof Date ? raw : raw ? new Date(raw) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const mode = company.platformEndMode || null;
  const lockedReason = company.platformEndReason || null;
  const base = { endedBy: "fieldquo", scope: "account", mode, endsAt: at, lockedReason };
  if (mode === "terms") {
    return { ...base, level: "locked", daysLeft: 0, reason: "terms", since: at };
  }
  const msLeft = at.getTime() - now.getTime();
  if (msLeft > 0) {
    return { ...base, level: "full", daysLeft: Math.ceil(msLeft / DAY), reason: "fieldquo_ending", since: null };
  }
  const daysLeft = Math.max(0, CANCELLED_DAYS - Math.floor(-msLeft / DAY));
  return daysLeft > 0
    ? { ...base, level: "readonly", daysLeft, reason: "fieldquo_ended", since: at }
    : { ...base, level: "locked", daysLeft: 0, reason: "fieldquo_ended_locked", since: at };
}

/**
 * Why this company may not buy or resume a plan by itself, or null.
 *
 * A company FieldQuo ended (either path) comes back only if FieldQuo brings
 * it back — the owner's rule for a terms breach, and the task's for a trial
 * ended "at the end of the free trial": no card may quietly undo it. Asked by
 * POST /api/platform/billing/checkout and /resume, which stay on the
 * ALWAYS_WRITABLE list for everyone else — hiding the button is not the gate.
 *
 * @param company  { platformEndsAt, platformEndMode } (or null)
 * @param sub      { accessLockedAt } (or null) — a subscribed terms lock
 */
export function fieldquoEndRefusal(company, sub) {
  if (sub?.accessLockedAt || company?.platformEndMode === "terms") {
    return "FieldQuo closed this account, so a plan can't be started from here. If you think this is a mistake, write to FieldQuo support.";
  }
  if (company?.platformEndsAt) {
    return "FieldQuo has ended this account, so a plan can't be chosen from here. If you think this is a mistake, write to FieldQuo support.";
  }
  return null;
}

/**
 * The same rule for a company that is on its free trial WITHOUT a plan.
 *
 * Since 2026-09-24 signup ends before the plan step — no card, no plan (the
 * owner: "move the credit card and plan selection out of the sign up and
 * just move it to the banner"). Such a company has no Subscription row at
 * all, and accessFor's "no row → full" reasoning above would have let the
 * trial run for ever. So the trial is read off Company.trialEndsAt, and it
 * ends the way a failed card does: the same GRACE_DAYS of read-only, then
 * locked, nothing deleted. One window, one number, so the banner, the 402
 * sentence and the reminder emails cannot disagree about how long is left.
 *
 * Pure, and null when the company has no trialEndsAt — a hand-made company
 * or a demo fixture is not on a trial, and inventing one for it would be
 * padding absent data with a lock-out.
 *
 * @param company  { trialEndsAt }
 * @returns {{ level, daysLeft, reason, since, trialEndsAt }} or null
 */
export function trialAccessFor(company, now = new Date()) {
  const raw = company?.trialEndsAt;
  const end = raw instanceof Date ? raw : raw ? new Date(raw) : null;
  // FieldQuo ended it from the console: that decision, not the trial clock,
  // is what the company may do — and every list that reads this function
  // (the buckets, /platform/signups, the subscriptions page) then agrees
  // with the banner, which is the reason it is folded in here rather than
  // asked separately by each of them.
  const ended = fieldquoEndAccessFor(company, now);
  if (ended) return { ...ended, trialEndsAt: end && !Number.isNaN(end.getTime()) ? end : null };
  if (!end || Number.isNaN(end.getTime())) return null;
  const msLeft = end.getTime() - now.getTime();
  if (msLeft > 0) {
    return { level: "full", daysLeft: Math.ceil(msLeft / DAY), reason: "trial_no_plan", since: null, trialEndsAt: end };
  }
  const daysLeft = Math.max(0, GRACE_DAYS - Math.floor(-msLeft / DAY));
  return daysLeft > 0
    ? { level: "readonly", daysLeft, reason: "trial_expired", since: end, trialEndsAt: end }
    : { level: "locked", daysLeft: 0, reason: "trial_expired_locked", since: end, trialEndsAt: end };
}

/**
 * Is this company PAYING for FieldQuo right now?
 *
 * A different question from `accessFor`, which asks what they may still DO.
 * This one gates the "Site by FieldQuo" credit in the public website footer —
 * the one sanctioned leak of our name onto a client-facing surface, and only
 * on a FREE site. A paying contractor advertising us to every homeowner who
 * lands on their page is the opposite of what they bought.
 *
 * A plan priced at zero is not a paid plan, however that row came to exist,
 * and neither is no subscription at all. The free FIRST MONTH is: that's
 * `trialing` on a priced plan with a card on file, and stamping our name on
 * their site during the month we told them was free is a bait-and-switch.
 *
 * The grace window counts as paying. This file's whole argument is that the
 * seven days after a failed payment are for getting the card fixed, not for
 * punishment — and re-branding a customer's public website the morning after a
 * bank's fraud hold is a punishment their clients would see before they did.
 * Once the window has genuinely expired (locked), they are on a free site
 * again and the credit comes back.
 *
 * @param sub  a Subscription row including `plan.priceMonthly`, or null
 */
export function isPaidSubscription(sub, now = new Date()) {
  if (!sub) return false;
  // Prisma Decimal — Number() goes through valueOf, so this is the same
  // conversion the billing screens do.
  const price = Number(sub.plan?.priceMonthly ?? 0);
  if (!(price > 0)) return false;
  return accessFor(sub, now).level !== "locked";
}

/** The same thing, for a company id. */
export async function accessForCompany(companyId, now = new Date()) {
  if (!companyId) {
    return { level: "full", daysLeft: null, reason: "no_company", since: null };
  }
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: {
      status: true, pastDueSince: true, canceledAt: true, cancelAtPeriodEnd: true, cancelAt: true, currentPeriodEnd: true,
      accessLockedAt: true, accessLockedReason: true, trialEndsAt: true,
      // Nested rather than a second query: a subscribed company pays nothing
      // extra on the hot path, and a trial FieldQuo ended whose late
      // checkout webhook then wrote a row is still ended.
      company: { select: { ...FIELDQUO_END_SELECT } },
    },
  });
  if (sub) {
    const ended = fieldquoEndAccessFor(sub.company, now);
    if (ended) return ended;
  }
  if (!sub) {
    // No subscription at all, and the company is younger than the checkout
    // grace: they closed the Stripe tab. Access stays FULL (accessFor says
    // why), but the reason says what is coming — lib/signup/setupGate.js
    // sends them back to /signup when the grace runs out, and until this
    // reason existed nothing on the screen said so. The card is required
    // (owner's decision, 2026-09-06); the banner's job is to say it before
    // the gate does.
    const company = await db.company.findUnique({ where: { id: companyId }, select: { createdAt: true, isDemo: true, trialEndsAt: true, ...FIELDQUO_END_SELECT } });
    // FieldQuo ended it (a trial, or a company made by hand with no trial
    // date at all) — before the trial and the no-row rules, which would
    // otherwise hand the latter full access for ever.
    const ended = fieldquoEndAccessFor(company, now);
    if (ended) return ended;
    // ── A trial with no plan, before the checkout grace ──────────────────
    //
    // Every company signup stamps trialEndsAt, and since 2026-09-24 signup
    // opens no checkout at all, so this — not "setup_pending" — is what a new
    // company is. The demo fixtures carry no trialEndsAt and stay on the
    // no-row rule; a real company with none (made by hand) does too.
    if (!company?.isDemo) {
      const trial = trialAccessFor(company, now);
      if (trial) return trial;
    }
    const age = company?.createdAt ? now.getTime() - company.createdAt.getTime() : Infinity;
    // A demo fixture never had a checkout to abandon — lib/signup/setupGate.js
    // already exempts isDemo from being sent back to /signup, but this banner
    // did not know, so a demo spun up for a call opened with "add your card
    // within 30 min to keep this account" (the owner, 2026-09-20). Same
    // exemption here; a real company still gets the sentence.
    if (age < CHECKOUT_GRACE_MS && !company?.isDemo) {
      return {
        level: "full",
        daysLeft: null,
        reason: "setup_pending",
        since: company.createdAt,
        minutesLeft: Math.max(1, Math.ceil((CHECKOUT_GRACE_MS - age) / 60_000)),
      };
    }
  }
  const access = accessFor(sub, now);
  // The trial's end date rides along for the banner ("Free trial · N days
  // left") on a trial that DID choose a plan. Attached here, not in accessFor,
  // so that pure function's shape — the one every check script executes —
  // is unchanged.
  if (sub?.status === "trialing" && sub.trialEndsAt) access.trialEndsAt = new Date(sub.trialEndsAt);
  // The reason typed on the platform panel for a terms lock, for the locked
  // screen — the panel has promised "the locked screen says FieldQuo ended
  // it, with your reason" since e6283647, and until now the screen never
  // received it. Attached here for the same reason trialEndsAt is.
  if (access.reason === "terms" && sub?.accessLockedReason) access.lockedReason = sub.accessLockedReason;
  return access;
}

/**
 * accessForCompany, read once per server render.
 *
 * For lib/currentMember.js, whose billing gate runs on every getCurrentMember
 * call — seven of them per /app navigation, from app/app/layout.js alone, each
 * re-reading the same Subscription row. React's cache() scopes this to one
 * render and keys on the company id (a primitive, so it actually hits); outside
 * a render (route handlers) it calls straight through, as before.
 *
 * `now` is deliberately not a parameter: a caller asking about a specific
 * moment wants the uncached function. Each caller gets its own copy of the
 * answer, so nothing one of them attaches is seen by another.
 */
const accessForCompanyCached = cache((companyId) => accessForCompany(companyId));

export async function accessForCompanyThisRequest(companyId) {
  return { ...(await accessForCompanyCached(companyId)) };
}

/**
 * Paths that stay writable even when locked.
 *
 * Without this the grace period is a trap: the only thing a locked-out company
 * needs to do is pay, and paying is a POST. Signing out has to keep working
 * too — being unable to leave an account you can't use is its own kind of
 * broken.
 *
 * Deliberately an ALLOW-list. A block-list would silently open every route
 * added later.
 */
const ALWAYS_WRITABLE = [
  "/api/platform/billing", // checkout, portal, cancel
  // status, reconcile, access AND retention. The save flow especially: "it
  // costs too much" is exactly why some overdue companies stopped paying, and
  // the offer that would keep them is the one they can't reach if we wall it
  // off behind the very lock they're trying to escape.
  "/api/settings/subscription",
  // The plan list. Missing this, a locked company reached the billing page with
  // NOTHING to buy — the "Update card" button led to an empty chooser. Every
  // request the billing screen makes has to be on this list, or the escape
  // hatch is decorative.
  "/api/settings/plans",
  "/api/auth", // sign out, session
  "/api/platform/feedback", // "I can't pay, help" has to reach someone
];

/** Is this request one of the few a locked account may still make? */
export function isBillingPath(pathname = "") {
  return ALWAYS_WRITABLE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Reads are always allowed, in every state. */
export function isReadMethod(method = "GET") {
  return ["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase());
}

/**
 * May this request proceed?
 *
 * @returns null when allowed, or { status, error } when not.
 */
export function denyReason(access, { method = "GET", pathname = "" } = {}) {
  if (!access || access.level === "full") return null;
  if (isBillingPath(pathname)) return null;

  if (access.level === "readonly") {
    if (isReadMethod(method)) return null;
    const days = `${access.daysLeft} more day${access.daysLeft === 1 ? "" : "s"}`;
    return {
      status: 402,
      // Different situation, different sentence. Telling someone who chose to
      // cancel that their "payment didn't go through" is both wrong and
      // alarming — they'd go and check a card that's perfectly fine.
      error:
        access.reason === "canceled"
          ? `Your plan is cancelled. You can still look at everything for ${days}, but not make changes. Start the plan again to pick up where you left off.`
          : access.reason === "fieldquo_ended"
            ? `FieldQuo has ended this account. You can still look at everything for ${days}, but not make changes — nothing has been deleted.`
          : access.reason === "trial_expired"
            ? `Your free trial has ended, so the account is read-only for ${days}. ` +
              `Choose a plan to start working again — nothing has been deleted.`
            : `Your payment didn't go through, so the account is read-only for ${days}. ` +
              `Update your card to start working again — nothing has been deleted.`,
    };
  }

  // Locked. Reads are blocked too, but the message says the data is safe,
  // because the first fear is that it's gone.
  return {
    status: 402,
    error:
      // FieldQuo closed it for a terms breach. This fell through to "payment
      // is overdue" until 2026-09-28 — for the subscribed terms lock too,
      // which sent a company FieldQuo had closed off to check a card.
      access.reason === "terms"
        ? "FieldQuo closed this account for a breach of the terms of service. Nothing has been deleted — write to FieldQuo support if you think this is a mistake."
        : access.reason === "fieldquo_ended_locked"
          ? "FieldQuo ended this account and the thirty days of read-only access are over. Nothing has been deleted — write to FieldQuo support to talk about it."
        : access.reason === "canceled_expired" || access.reason === "canceled"
        ? "This subscription was cancelled. Start it again to get back in — your data is still here."
        : access.reason === "trial_expired_locked"
          ? "Your free trial has ended and the read-only week is over. Choose a plan to get back in — nothing has been deleted."
          : "Your account is locked because payment is overdue. Update your card to restore it — nothing has been deleted.",
  };
}

/**
 * Move a subscription into past_due and start the clock.
 *
 * Idempotent on `pastDueSince`: a repeated webhook must not restart the grace
 * period, which would leave an account permanently 7 days from locking and
 * therefore never locking at all.
 */
export async function markPastDue(companyId, at = new Date()) {
  if (!companyId) return null;
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { id: true, pastDueSince: true },
  });
  if (!sub) return null;

  return db.subscription.update({
    where: { id: sub.id },
    data: {
      status: "past_due",
      pastDueSince: sub.pastDueSince ?? at,
    },
  });
}

/**
 * Payment worked. Clear the clock so a later failure gets a fresh 7 days.
 *
 * Both grace-warning markers are nulled here, not just the first — see the
 * schema comments on graceWarnedAt/graceFinalWarnedAt. A relapse after
 * recovery is a NEW episode and must be able to send both warnings again,
 * not inherit "already warned" from a payment problem that was fixed.
 */
export async function clearPastDue(companyId) {
  if (!companyId) return null;
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!sub) return null;
  return db.subscription.update({
    where: { id: sub.id },
    data: { pastDueSince: null, graceWarnedAt: null, graceFinalWarnedAt: null },
  });
}
