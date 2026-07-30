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
import { db } from "@/lib/db";

/** How long read-only lasts before the account locks. */
export const GRACE_DAYS = 7;

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

  if (sub.status === "active" || sub.status === "trialing") {
    return { level: "full", daysLeft: null, reason: sub.status, since: null };
  }

  // Cancelled is a decision, not a failure — they asked to stop. No grace,
  // because there is nothing to fix; they left.
  if (sub.status === "canceled") {
    return { level: "locked", daysLeft: 0, reason: "canceled", since: null };
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

/** The same thing, for a company id. */
export async function accessForCompany(companyId, now = new Date()) {
  if (!companyId) {
    return { level: "full", daysLeft: null, reason: "no_company", since: null };
  }
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { status: true, pastDueSince: true },
  });
  return accessFor(sub, now);
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
  "/api/settings/subscription", // status, reconcile, access
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
    return {
      status: 402,
      error:
        `Your payment didn't go through, so the account is read-only for ${access.daysLeft} more ` +
        `day${access.daysLeft === 1 ? "" : "s"}. Update your card to start working again — ` +
        `nothing has been deleted.`,
    };
  }

  // Locked. Reads are blocked too, but the message says the data is safe,
  // because the first fear is that it's gone.
  return {
    status: 402,
    error:
      access.reason === "canceled"
        ? "This subscription was cancelled. Start it again to get back in — your data is still here."
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

/** Payment worked. Clear the clock so a later failure gets a fresh 7 days. */
export async function clearPastDue(companyId) {
  if (!companyId) return null;
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!sub) return null;
  return db.subscription.update({
    where: { id: sub.id },
    data: { pastDueSince: null, graceWarnedAt: null },
  });
}
