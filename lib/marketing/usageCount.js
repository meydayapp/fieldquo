// lib/marketing/usageCount.js
//
// "N contractors run their business on FieldQuo" — the homepage's usage
// proof (site audit D3.1), READ from the database and shown only when the
// number is worth saying.
//
// ══ Why there is no number typed anywhere ══════════════════════════════════
//
// The owner asked for "150 contractors running FieldQuo". On 2026-10-15 the
// production database held 39 companies in total — demo and test accounts
// included — with 2 active subscriptions and 8 companies that created a quote
// in the last 30 days. 150 would have been false on the most-read page of
// the site, so the block counts instead of claiming, and stays hidden until
// the count earns it.
//
// ══ What is counted ═══════════════════════════════════════════════════════
//
// A company counts as "running FieldQuo" when it is a real customer — not a
// seeded demo (isDemo) and not one FieldQuo marked as a test company
// (isTestCompany) — AND it is actually using it: either it pays (a
// subscription whose status is `active`) or it created at least one quote in
// the last ACTIVE_WINDOW_DAYS days. A trial nobody has touched does not
// count: signing up is not running a business on something.
//
// ══ The threshold ═════════════════════════════════════════════════════════
//
// Below USAGE_COUNT_THRESHOLD the block renders NOTHING — no placeholder, no
// "join our growing community". A small true number reads as a warning on a
// page whose job is to convince, and absence of a statement is not a
// statement. The owner can lower the constant; that is a decision about what
// to say, not a different count.

export const USAGE_COUNT_THRESHOLD = 100;
export const ACTIVE_WINDOW_DAYS = 30;

/** The `where` for a company that counts — exported so the check can read it. */
export function runningCompanyWhere(now = new Date()) {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    isDemo: false,
    isTestCompany: false,
    OR: [
      { subscription: { is: { status: "active" } } },
      { quotes: { some: { createdAt: { gte: since } } } },
    ],
  };
}

/** How many companies are running FieldQuo right now. Throws on a database error. */
export async function runningCompanyCount(db, now = new Date()) {
  return db.company.count({ where: runningCompanyWhere(now) });
}

/**
 * What the homepage may say: { count } at or above the threshold, else null.
 * A non-number (a failed read) is null too — never a zero, never a guess.
 */
export function usageProof(count, threshold = USAGE_COUNT_THRESHOLD) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 0) return null;
  return n >= threshold ? { count: n } : null;
}
