// lib/sales/demoAssign.js
//
// The three writes to `SalesRep.demoCompanyId`, and the only ones.
//
// A rep CLAIMS a free demo. A superadmin ASSIGNS one to a named rep, or
// RELEASES the one a rep holds. Everything else about a demo — its trade, its
// data, its login — is somebody else's file.
//
// ══ Why writing this column is not the escalation gate.js forbids ═════════
//
// lib/sales/gate.js lists `salesRep` in REP_FORBIDDEN_WRITES, and it is right
// to: a rep who can write their own row can rotate their code, reactivate
// themselves, or move their commission plan. This column is the same table and
// none of that, for three reasons that are checked rather than asserted:
//
//   1. It cannot point at a customer. The candidate comes out of a query for
//      isDemo companies and planDemoClaim() re-asserts isDemo on the row
//      before returning it — so the worst a rep can aim this at is a fixture
//      FieldQuo owns outright.
//   2. It cannot move money. lib/sales/scope.js keeps repDemoWhere() as a
//      SEPARATE predicate from assignedCompanyWhere() precisely so a demo
//      never satisfies "attributed to me"; commission reads the attribution,
//      never this.
//   3. It is write-once from the rep's side. The claim's WHERE requires
//      demoCompanyId to be null, so a rep cannot swap demos, cannot take a
//      second, and cannot take one off a colleague. Releasing is a
//      superadmin's act.
//
// That is the same shape gate.js's own GATE_WRITES_ON_SALES_REP carve-out
// takes for `lastSeenAt`: one named column, one place that writes it, and the
// reason written down beside it.
//
// ══ Why the race is resolved by the constraint, not by a read ═════════════
//
// Read-the-free-list-then-write is wrong here and the window is not
// theoretical: the free list is read at the top of a request and written at the
// bottom, and two reps pressing Claim in the same second read the same list.
// The @unique on demoCompanyId is the only thing that can actually decide, so
// the loser is told by Postgres (P2002), adds that company to `excludeIds`,
// and asks planDemoClaim() for the next one. Bounded by MAX_CLAIM_ATTEMPTS so
// a pathological pool cannot spin.
import { db } from "@/lib/db";
import { MAX_CLAIM_ATTEMPTS, planDemoClaim } from "./demoPool";

/** Columns of a demo company anything in here is allowed to hand back. */
const DEMO_SELECT = {
  id: true,
  name: true,
  slug: true,
  demoIndustry: true,
  isDemo: true,
};

/**
 * Every isDemo company, and every SalesRep row already holding one.
 *
 * `client` is injectable for the same reason ringPlan() takes `now`: the
 * interesting behaviour here is what happens when the unique index REFUSES a
 * write, and there is no way to make Postgres do that on demand from a check.
 * scripts/check-demo-assignment.mjs passes a client whose updateMany throws
 * P2002 the way the real one would, and executes the shipped loop against it —
 * rather than re-implementing the loop in the check, which is how a check ends
 * up testing itself.
 */
async function readPool(client) {
  const [demos, assignments] = await Promise.all([
    client.company.findMany({
      where: { isDemo: true },
      select: DEMO_SELECT,
      orderBy: { slug: "asc" },
    }),
    // Departed reps included on purpose — see demoPool.js's header. The
    // constraint does not care that somebody left.
    client.salesRep.findMany({
      where: { demoCompanyId: { not: null } },
      select: { id: true, demoCompanyId: true },
    }),
  ]);
  return { demos, assignments };
}

/**
 * How many demos exist and how many nobody holds.
 *
 * Read by GET /api/sales/demo so the rep screen can offer Claim only when
 * there is something to claim — the alternative, a button that always renders
 * and 409s when pressed, is the control-that-appears-to-work failure this
 * codebase keeps finding.
 */
export async function demoPoolCounts(client = db) {
  const { demos, assignments } = await readPool(client);
  const taken = new Set(
    assignments.map((a) => a.demoCompanyId).filter(Boolean),
  );
  const usable = demos.filter((d) => d.isDemo === true);
  return {
    total: usable.length,
    free: usable.filter((d) => !taken.has(d.id)).length,
  };
}

/**
 * Give this rep a demo — theirs if they have one, otherwise a free one.
 *
 * @param repId  the rep's id. Re-read here rather than trusted from the
 *               caller's copy: gate.js's whole argument is that the row is
 *               read fresh in the request that acts on it, and a
 *               demoCompanyId remembered from the GET that rendered the button
 *               is exactly the stale value that produces a second demo.
 *
 * @returns the planDemoClaim decision, with `company` filled in on success.
 *          Never throws for a race; only for a real database failure.
 */
export async function claimDemoForRep(repId, client = db) {
  const excludeIds = [];

  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    const rep = await client.salesRep.findUnique({
      where: { id: repId },
      select: { id: true, demoCompanyId: true },
    });

    const { demos, assignments } = await readPool(client);
    const decision = planDemoClaim({ rep, demos, assignments, excludeIds });

    if (decision.outcome !== "assign") return decision;

    try {
      // updateMany, not update, and the null is in the WHERE. Two tabs
      // belonging to the SAME rep race each other too, and `update` would
      // happily overwrite a demo the other tab had just claimed — leaving one
      // demo assigned and one orphaned, with the rep looking at whichever the
      // slower tab drew.
      const { count } = await client.salesRep.updateMany({
        where: { id: repId, demoCompanyId: null },
        data: { demoCompanyId: decision.companyId },
      });

      if (count === 0) {
        // The rep acquired one between our read and our write. Loop: the next
        // pass reads it and returns already_assigned, which is the right
        // answer and the same one their other tab got.
        continue;
      }

      return { ...decision, outcome: "assign", claimed: true };
    } catch (err) {
      // P2002 = another REP won this company. Anything else is a real failure
      // and must not be swallowed as "try a different demo".
      if (err?.code !== "P2002") throw err;
      excludeIds.push(decision.companyId);
    }
  }

  const { demos, assignments } = await readPool(client);
  return {
    outcome: "exhausted",
    total: demos.length,
    taken: new Set(assignments.map((a) => a.demoCompanyId).filter(Boolean)).size,
    tried: excludeIds.length,
  };
}

/**
 * Point a named rep at a named demo. Superadmin's act, from /platform/demo.
 *
 * Refuses rather than reassigns when either side is already spoken for: a
 * console that silently moved a demo off one rep and onto another would do it
 * mid-walkthrough, and the person it happened to would have no idea why their
 * quote screen stopped loading.
 */
export async function assignDemoToRep({ repId, companyId }) {
  const [rep, company] = await Promise.all([
    db.salesRep.findUnique({
      where: { id: repId },
      select: { id: true, name: true, email: true, demoCompanyId: true },
    }),
    // Re-read, never trusted from the request. Same rule
    // /api/platform/demo/login applies: an id from HTTP is an id, and only the
    // row can say whether it is a demo.
    db.company.findUnique({ where: { id: companyId }, select: DEMO_SELECT }),
  ]);

  if (!rep) return { ok: false, status: 404, error: "No such sales rep." };
  if (!company) return { ok: false, status: 404, error: "No such company." };
  if (company.isDemo !== true) {
    return {
      ok: false,
      status: 403,
      error:
        `Refusing to hand "${company.name}" to a rep — it is not a demo ` +
        "account. Only companies with isDemo = true can be assigned.",
    };
  }

  if (rep.demoCompanyId === company.id) {
    return { ok: true, company, rep, alreadyAssigned: true };
  }
  if (rep.demoCompanyId) {
    return {
      ok: false,
      status: 409,
      error: `${rep.name} already has a demo. Release it first.`,
    };
  }

  const holder = await db.salesRep.findFirst({
    where: { demoCompanyId: company.id },
    select: { id: true, name: true },
  });
  if (holder) {
    return {
      ok: false,
      status: 409,
      error: `${company.name} is already assigned to ${holder.name}. Release it first.`,
    };
  }

  try {
    const { count } = await db.salesRep.updateMany({
      where: { id: repId, demoCompanyId: null },
      data: { demoCompanyId: company.id },
    });
    if (count === 0) {
      return {
        ok: false,
        status: 409,
        error: `${rep.name} was given a demo a moment ago. Reload the page.`,
      };
    }
  } catch (err) {
    // The same constraint the rep's own claim races against, reached from the
    // other door. A superadmin gets the honest version rather than a 500.
    if (err?.code !== "P2002") throw err;
    return {
      ok: false,
      status: 409,
      error: `${company.name} was claimed a moment ago. Reload the page.`,
    };
  }

  return { ok: true, company, rep, alreadyAssigned: false };
}

/**
 * Take a rep's demo back, so somebody else can have it.
 *
 * Clears one pointer and nothing else. The company, its data, its login and
 * its member row all stay exactly as they are — releasing is how a departed
 * rep's demo returns to the pool, and wiping it on the way out would destroy a
 * walkthrough somebody may still be mid-way through.
 */
export async function releaseDemoFromRep({ repId }) {
  const rep = await db.salesRep.findUnique({
    where: { id: repId },
    select: { id: true, name: true, demoCompanyId: true },
  });
  if (!rep) return { ok: false, status: 404, error: "No such sales rep." };
  if (!rep.demoCompanyId) {
    return { ok: true, rep, released: null, alreadyFree: true };
  }

  const released = rep.demoCompanyId;
  await db.salesRep.updateMany({
    where: { id: repId, demoCompanyId: released },
    data: { demoCompanyId: null },
  });
  return { ok: true, rep, released, alreadyFree: false };
}
