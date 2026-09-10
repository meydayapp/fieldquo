// lib/sales/demoPool.js
//
// Which demo tenant a rep asking for one should get — decided over rows the
// caller has already read, with no database in it.
//
// ══ Why a pure function for something this small ══════════════════════════
//
// lib/sales/calls/inboundDistribution.js is the pattern, and its header gives
// the reason this file copies: a decision made inline inside a route can only
// be proven by reading it, and the branches that matter here are the ones that
// never happen on a good day — no demos seeded, every demo taken, a rep whose
// demoCompanyId points at a company that is not a demo any more. Those are
// exactly the branches a manual test does not reach, so they get executed by
// scripts/check-demo-assignment.mjs instead.
//
// ══ What "taken" means, and why it is not "taken by an ACTIVE rep" ════════
//
// `SalesRep.demoCompanyId` is @unique. The constraint does not know or care
// whether the rep holding it has left — a demo pointed at by a rep who ended
// in March is still un-insertable for anybody else. So a demo is TAKEN if any
// SalesRep row at all points at it.
//
// The obvious alternative — treat a departed rep's demo as free, since nobody
// is using it — was rejected because it produces a candidate whose write is
// guaranteed to fail with P2002, every attempt, for ever: the claim loop would
// burn its whole retry budget and then refuse, and the refusal would say "all
// in use" while the screen showed a free one. Releasing a departed rep's demo
// is a deliberate act on /platform/demo, not a thing the pool infers.
//
// ══ Why it never picks at random ══════════════════════════════════════════
//
// Deterministic order (slug, then id) so the answer is the same twice and a
// check can assert WHICH demo comes back rather than only that one did. Two
// reps claiming at the same instant therefore both aim at the same company —
// which is fine and intended: the @unique index settles it, the loser gets a
// P2002, and `excludeIds` lets it come straight back here for the next one.
// Randomising would paper over that race rather than resolving it, and would
// leave the resolution untested because it would rarely fire.

/** How many demos a claim will try before giving up. See claimDemoForRep(). */
export const MAX_CLAIM_ATTEMPTS = 5;

/**
 * The demo companies that exist, deduped, ordered, and with anything that is
 * not actually a demo dropped.
 *
 * The isDemo assertion is defence in depth, not distrust of the caller's
 * query: it is the same rule repDemoWhere() and lib/demo/seedDemo.js apply for
 * the same reason — the day somebody points this at a real tenant by hand, the
 * failure must be "no demo available", never "here is a customer's company".
 */
export function usableDemos(demos) {
  const seen = new Set();
  const out = [];
  for (const d of Array.isArray(demos) ? demos : []) {
    const id = typeof d?.id === "string" ? d.id.trim() : "";
    if (!id || seen.has(id)) continue;
    if (d.isDemo !== true) continue;
    seen.add(id);
    out.push(d);
  }
  // Slug first because that is the order the platform screen lists them in and
  // the order a human would expect "the next free one" to follow; id as the
  // tiebreak so two demos with the same slug still sort deterministically.
  return out.sort((a, b) => {
    const s = String(a.slug ?? "").localeCompare(String(b.slug ?? ""));
    return s !== 0 ? s : String(a.id).localeCompare(String(b.id));
  });
}

/** Every companyId some SalesRep row already points at. */
export function takenDemoIds(assignments) {
  const taken = new Set();
  for (const row of Array.isArray(assignments) ? assignments : []) {
    const id =
      typeof row?.demoCompanyId === "string" ? row.demoCompanyId.trim() : "";
    if (id) taken.add(id);
  }
  return taken;
}

/**
 * What should happen when this rep asks for a demo.
 *
 * @param rep          the rep's own row, read fresh — `{ id, demoCompanyId }`.
 * @param demos        every isDemo company, as the caller read them.
 * @param assignments  every SalesRep row with a non-null demoCompanyId,
 *                     including the asking rep's own and including reps who
 *                     have left. See the header for why departed reps count.
 * @param excludeIds   companies this request has already tried and lost the
 *                     race for. Empty on the first attempt.
 *
 * @returns one of:
 *   { outcome: "no_rep" }                       — no identity; refuse, do not guess
 *   { outcome: "already_assigned", companyId, company }  — company may be null
 *   { outcome: "assign", companyId, company, free }
 *   { outcome: "no_pool", total: 0 }
 *   { outcome: "all_taken", total, taken }
 *   { outcome: "exhausted", total, taken, tried }
 *
 * `already_assigned` with a null `company` is the honest answer for a rep
 * whose demoCompanyId points at something that is not in the pool — a company
 * that stopped being a demo, or was removed. It is deliberately NOT treated as
 * "no demo, give them a fresh one": the @unique column is still occupied, the
 * write would fail, and silently handing out a second demo would be the
 * product inventing a state nobody asked for.
 */
export function planDemoClaim({
  rep = null,
  demos = [],
  assignments = [],
  excludeIds = [],
} = {}) {
  const repId = typeof rep?.id === "string" ? rep.id.trim() : "";
  if (!repId) return { outcome: "no_rep" };

  const pool = usableDemos(demos);
  const taken = takenDemoIds(assignments);

  const mine =
    typeof rep.demoCompanyId === "string" ? rep.demoCompanyId.trim() : "";
  if (mine) {
    return {
      outcome: "already_assigned",
      companyId: mine,
      company: pool.find((d) => d.id === mine) || null,
    };
  }

  if (pool.length === 0) return { outcome: "no_pool", total: 0 };

  const skip = new Set(
    (Array.isArray(excludeIds) ? excludeIds : []).filter(
      (id) => typeof id === "string" && id,
    ),
  );

  const free = pool.filter((d) => !taken.has(d.id));
  const candidate = free.find((d) => !skip.has(d.id));

  if (!candidate) {
    // Two different refusals, and they are not the same sentence. "Everything
    // is spoken for" is a state a superadmin fixes by seeding or releasing;
    // "everything free was taken while you were pressing the button" is a
    // retry, and telling a rep to go ask for more demos in that case would be
    // wrong advice.
    if (free.length === 0) {
      return { outcome: "all_taken", total: pool.length, taken: taken.size };
    }
    return {
      outcome: "exhausted",
      total: pool.length,
      taken: taken.size,
      tried: skip.size,
    };
  }

  return {
    outcome: "assign",
    companyId: candidate.id,
    company: candidate,
    free: free.length,
  };
}

/**
 * The refusal a non-assigning decision should be answered with.
 *
 * Here rather than in the route so the WORDS are executable too. A refusal
 * that says "all ten are in use" when eleven exist is a lie the route would
 * have no way to catch, and this repo's rule is that a refusal states the real
 * numbers rather than a generic failure.
 *
 * Returns null for the two outcomes that are not refusals.
 */
export function claimRefusal(decision) {
  switch (decision?.outcome) {
    case "assign":
      return null;
    case "already_assigned":
      // Only a refusal when the pointer is stale. A rep who simply already has
      // one gets theirs back — that is the idempotent success, not an error.
      if (decision.company) return null;
      return {
        status: 409,
        error:
          "Your account is already pointed at a demo company that is no longer " +
          "available — it may have been removed or stopped being a demo. A " +
          "FieldQuo superadmin can release it on /platform/demo, and then you " +
          "can claim another.",
      };
    case "no_pool":
      return {
        status: 409,
        error:
          "There are no demo companies at all yet. Ask a FieldQuo superadmin " +
          "to seed them on /platform/demo — nothing you can do from here " +
          "creates one.",
      };
    case "all_taken":
      return {
        status: 409,
        error:
          `All ${decision.total} demo ${decision.total === 1 ? "company is" : "companies are"} ` +
          `already assigned to a rep (${decision.taken} in use). Ask a FieldQuo ` +
          "superadmin to add another or release one on /platform/demo.",
      };
    case "exhausted":
      return {
        status: 409,
        error:
          "Another rep claimed the free demo while you were claiming it. " +
          "Try again — if it keeps happening, all " +
          `${decision.total} demos are being taken as fast as they free up.`,
      };
    case "no_rep":
    default:
      return {
        status: 401,
        error: "Sign in to the sales portal.",
      };
  }
}
