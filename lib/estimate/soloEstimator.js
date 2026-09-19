// lib/estimate/soloEstimator.js
//
// Who an auto-estimated draft opens assigned to, when nobody was signed in to
// create it.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// A hand-built quote defaults its assignee to the person who saved it (POST
// /api/quotes). An instant estimate has no such person — a homeowner's form
// created it — so the draft used to open on "Unassigned — needs review" for
// every company, including the one-person shop where there is exactly one
// person it could possibly be for. The owner: "the default should be the same
// as when the quote is created manually — if solo then the only person that
// can create an estimate."
//
// So: when exactly ONE active member holds quote:create, the draft is theirs.
// With several, it stays unassigned and the review queue's "assign to me" is
// where a human decides — guessing between two estimators would hand a
// homeowner's job to whoever happened to be listed first. Zero is left null
// too; a company with nobody allowed to write quotes has a bigger problem
// than an unassigned draft, and inventing an assignee would hide it.
//
// The decision is a pure function over the roster so scripts/
// check-instant-quote-draft.mjs executes it; the loader beside it is the one
// database read.

import { can } from "@/lib/permissions";

/**
 * @param {Array<{ userId: string, role: string, active?: boolean }>} members
 * @returns {string|null} the one estimator's User id, or null
 */
export function soloEstimatorFrom(members) {
  const able = (Array.isArray(members) ? members : []).filter(
    (m) => m && m.userId && m.active !== false && can(m.role, "quote:create"),
  );
  return able.length === 1 ? able[0].userId : null;
}

/**
 * @param {object} prisma
 * @param {string} companyId
 */
export async function soloEstimatorFor(prisma, companyId) {
  if (!companyId) return null;
  const members = await prisma.member.findMany({
    where: { companyId, active: true },
    select: { userId: true, role: true, active: true },
  });
  return soloEstimatorFrom(members);
}
