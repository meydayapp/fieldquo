// lib/org/reportingLine.js
//
// Who approves what, and who covers when they are away.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// Leave approval is gated on `can(member.role, "user:manage")` — every owner
// and admin in the company. On a two-person business that is correct and
// invisible. On a company with four crews and three supervisors it means a
// supervisor can approve holiday for crews they have never met, while the
// person who actually knows whether Thursday works gets no say.
//
// A reporting line fixes that and immediately creates the problem it always
// creates: managers go on holiday too. A request that can only be approved by
// somebody who is themselves away is a request that sits there.
//
// ── The rules, in order ─────────────────────────────────────────────────────
//
// 1. A request goes to the requester's direct manager.
// 2. If that manager is away, or is the requester themselves, it goes to THEIR
//    manager, and so on up the chain.
// 3. Anyone further up the chain may always act. Escalation decides who the
//    request is WAITING on, never who is ALLOWED — an owner is not blocked
//    from approving because a supervisor happens to be available.
// 4. A worker with no manager falls back to the company's owners and admins,
//    which is exactly today's behaviour. A company that never draws an org
//    chart keeps working the way it always did.
//
// ── Cycles ──────────────────────────────────────────────────────────────────
//
// Two people can end up reporting to each other. That is a data-entry mistake,
// not a hypothetical: the control that sets a manager is a dropdown of
// colleagues. Every walk here is bounded by a seen-set, so a cycle terminates
// and reports what it managed to walk rather than hanging the request that hit
// it — and `eligibleManagers` stops most of them being created at all.

/** Depth guard for a chain that is not a cycle, merely absurd. */
const MAX_DEPTH = 64;

const idOf = (v) => (typeof v === "string" && v ? v : null);

function lookup(byId, id) {
  if (!id) return undefined;
  if (byId instanceof Map) return byId.get(id);
  return Object.prototype.hasOwnProperty.call(byId || {}, id)
    ? byId[id]
    : undefined;
}

/**
 * The management chain above a worker, nearest first, excluding the worker.
 *
 * @returns {{chain:string[], cycle:boolean}}
 */
export function managementChain(workerId, byId) {
  const chain = [];
  const seen = new Set();
  let current = idOf(workerId);
  if (current) seen.add(current);

  for (let i = 0; i < MAX_DEPTH; i++) {
    const node = lookup(byId, current);
    const next = idOf(node?.managerId);
    if (!next) return { chain, cycle: false };
    if (seen.has(next)) return { chain, cycle: true };
    seen.add(next);
    chain.push(next);
    current = next;
  }
  return { chain, cycle: true };
}

/**
 * Who a request is waiting on.
 *
 * @param {(id:string)=>boolean} [isAway] is this person unavailable today
 * @returns {{approverId:string|null, escalatedFrom:string[], reason:string,
 *            chain:string[], cycle:boolean}}
 */
export function approverFor({ workerId, byId, isAway = () => false }) {
  const { chain, cycle } = managementChain(workerId, byId);
  const escalatedFrom = [];

  for (const id of chain) {
    // Nobody approves their own holiday, even when a broken org chart makes
    // them their own manager's manager.
    if (id === workerId) {
      escalatedFrom.push(id);
      continue;
    }
    let away = false;
    try {
      away = Boolean(isAway(id));
    } catch {
      // A broken availability lookup must not make a request unapprovable.
      away = false;
    }
    if (away) {
      escalatedFrom.push(id);
      continue;
    }
    return {
      approverId: id,
      escalatedFrom,
      reason: escalatedFrom.length ? "escalated" : "direct_manager",
      chain,
      cycle,
    };
  }

  return {
    approverId: null,
    escalatedFrom,
    // "Nobody is above you" and "everybody above you is away" are different
    // situations and the screen should say which.
    reason: chain.length === 0 ? "no_manager" : "chain_unavailable",
    chain,
    cycle,
  };
}

/**
 * May this person act on the request?
 *
 * Deliberately wider than `approverFor`: anyone above the requester may act,
 * plus anyone with company-wide people permissions. A request WAITING on a
 * supervisor must never be un-approvable by the owner.
 */
export function canApprove({
  actorWorkerId,
  workerId,
  byId,
  hasManagePermission = false,
}) {
  if (idOf(actorWorkerId) && actorWorkerId === workerId) return false;
  const { chain } = managementChain(workerId, byId);
  if (idOf(actorWorkerId) && chain.includes(actorWorkerId)) return true;
  return Boolean(hasManagePermission);
}

/** Everyone reporting to this person, directly or through someone else. */
export function reportsUnder(managerId, workers) {
  const list = Array.isArray(workers) ? workers.filter(Boolean) : [];
  const target = idOf(managerId);
  if (!target) return [];
  const byId = new Map(list.map((w) => [w.id, w]));
  return list
    .filter((w) => managementChain(w.id, byId).chain.includes(target))
    .map((w) => w.id);
}

/**
 * Managers a worker may be assigned to without creating a cycle.
 *
 * The dropdown is where cycles get created, so the honest fix is to not offer
 * the choice: anyone already reporting to this worker cannot become their
 * manager.
 */
export function eligibleManagers(workerId, workers) {
  const list = Array.isArray(workers) ? workers.filter(Boolean) : [];
  const under = new Set(reportsUnder(workerId, list));
  return list.filter((w) => w.id !== workerId && !under.has(w.id));
}
