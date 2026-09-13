// lib/shiftRequests/state.js
//
// The trade / cover / claim state machine, as a pure function.
//
// Every route under /api/shift-requests calls `transition()` and writes what
// it returns; nothing else decides whether a request may move. Pure so
// scripts/check-employee-home.mjs can execute every transition against every
// actor from every state — a peer approving, a manager accepting for the
// peer, the requester approving their own swap, a decision on a request
// whose shift already started — and fail if any of them is allowed.
//
// ── The states ───────────────────────────────────────────────────────────────
//
//   pending_peer     waiting on the colleague (or, for an open cover, anyone
//                    eligible) to say yes
//   pending_manager  the peer said yes; waiting on the reporting line
//   approved         the shift moved                                  terminal
//   declined         somebody said no                                 terminal
//   cancelled        the requester withdrew it                        terminal
//   expired          the shift started before anyone decided          terminal
//
// ── The actors ───────────────────────────────────────────────────────────────
//
//   requester   fromWorker — or, for a claim of an open shift, toWorker
//   peer        toWorker on a trade or a named cover; anyone eligible on an
//               open cover (the route checks eligibility; here the actor is
//               simply "not the requester and not acting as manager")
//   manager     somebody the reporting line lets approve (canApprove in
//               lib/org/reportingLine.js, or schedule edit_all)
//
// A manager may also act as a peer's proxy? No. A manager who wants to hand
// Marc's shift to Ana without Ana's say-so has the scheduler for that; a
// request is the workers' agreement first and the manager's blessing second,
// and letting the second step swallow the first would make "Ana accepted" a
// thing nobody can trust.
//
// ── needsApproval ────────────────────────────────────────────────────────────
//
// Company.shiftSwapsNeedApproval. True: the peer's yes moves the request to
// pending_manager. False: the peer's yes approves it outright, and the route
// applies the swap in the same transaction. Either way a MANAGER can still
// decline a pending_peer request — a swap the manager has already refused
// need not wait for the peer to say yes to it.

export const REQUEST_STATES = Object.freeze([
  "pending_peer",
  "pending_manager",
  "approved",
  "declined",
  "cancelled",
  "expired",
]);

export const TERMINAL_STATES = Object.freeze(["approved", "declined", "cancelled", "expired"]);

export const REQUEST_ACTIONS = Object.freeze(["accept", "decline", "cancel", "approve", "expire"]);

export const ACTOR_ROLES = Object.freeze(["requester", "peer", "manager", "system"]);

/**
 * Who is this person, relative to this request?
 *
 * @param {object} request  { fromWorkerId, toWorkerId, kind }
 * @param {object} actor    { workerId, isManager }
 * @returns {"requester"|"peer"|"manager"|"none"}
 */
export function actorRole(request, actor) {
  if (!request || !actor) return "none";
  const wid = typeof actor.workerId === "string" && actor.workerId ? actor.workerId : null;
  // A claim has no fromWorker: the claimant IS the requester.
  const requesterId = request.fromWorkerId || (request.fromWorkerId == null ? request.toWorkerId : null);
  if (wid && requesterId && wid === requesterId) return "requester";
  if (actor.isManager === true) return "manager";
  if (wid) {
    // A named peer, or anybody on an open cover.
    if (request.toWorkerId ? wid === request.toWorkerId : Boolean(request.fromWorkerId)) return "peer";
  }
  return "none";
}

/**
 * The one decision function.
 *
 * @param {object} p
 * @param {object} p.request        { status, fromWorkerId, toWorkerId, kind, shiftStart }
 * @param {string} p.action         accept | decline | cancel | approve | expire
 * @param {object} p.actor          { workerId, isManager } — ignored for expire
 * @param {object} [p.options]      { needsApproval = true, now = Date.now() }
 * @returns {{ok:true, next:string, appliesSwap:boolean, role:string}
 *         | {ok:false, error:string, role:string}}
 *
 * `appliesSwap` is true exactly when the caller must move the shift in the
 * same transaction as writing `next`.
 */
export function transition({ request, action, actor, options = {} }) {
  const needsApproval = options.needsApproval !== false;
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now) || Date.now();
  const role = action === "expire" ? "system" : actorRole(request, actor);

  if (!request || !REQUEST_STATES.includes(request.status)) {
    return { ok: false, error: "That request is not in a state this knows.", role };
  }
  if (!REQUEST_ACTIONS.includes(action)) {
    return { ok: false, error: "That is not something you can do to a request.", role };
  }
  const { status } = request;

  if (TERMINAL_STATES.includes(status)) {
    return { ok: false, error: `That request is already ${status.replace("_", " ")}.`, role };
  }

  // A request whose shift has started is over, whatever anybody presses now.
  // Reported as such rather than as a permission problem: "expired" is the
  // true reason, and the route writes it back so the row says so too.
  const start = request.shiftStart instanceof Date ? request.shiftStart.getTime() : Date.parse(request.shiftStart);
  const started = Number.isFinite(start) && start <= now;
  if (action === "expire") {
    return started
      ? { ok: true, next: "expired", appliesSwap: false, role }
      : { ok: false, error: "The shift has not started yet.", role };
  }
  if (started) {
    return { ok: false, error: "The shift has already started, so this request has expired.", role, expired: true };
  }

  switch (action) {
    case "cancel":
      if (role !== "requester") return { ok: false, error: "Only the person who asked can withdraw it.", role };
      return { ok: true, next: "cancelled", appliesSwap: false, role };

    case "accept":
      if (status !== "pending_peer") return { ok: false, error: "Nobody is being asked to accept this now.", role };
      if (role !== "peer") {
        return {
          ok: false,
          error:
            role === "requester"
              ? "You can't accept your own request."
              : role === "manager"
                ? "Accepting is the colleague's answer, not the manager's. Approve or decline it once they have."
                : "This request wasn't offered to you.",
          role,
        };
      }
      return needsApproval
        ? { ok: true, next: "pending_manager", appliesSwap: false, role }
        : { ok: true, next: "approved", appliesSwap: true, role };

    case "decline":
      if (role === "peer" && status === "pending_peer") return { ok: true, next: "declined", appliesSwap: false, role };
      if (role === "manager") return { ok: true, next: "declined", appliesSwap: false, role };
      if (role === "requester") return { ok: false, error: "Withdraw your own request instead of declining it.", role };
      return { ok: false, error: "This request isn't yours to decline.", role };

    case "approve":
      if (role !== "manager") return { ok: false, error: "Only whoever runs the rota can approve a swap.", role };
      if (status !== "pending_manager") {
        return {
          ok: false,
          error:
            status === "pending_peer"
              ? "The colleague hasn't accepted yet — there's nothing to approve until they do."
              : "There's nothing to approve.",
          role,
        };
      }
      return { ok: true, next: "approved", appliesSwap: true, role };

    default:
      return { ok: false, error: "That is not something you can do to a request.", role };
  }
}

/**
 * What the row becomes once the swap is applied. Pure description of the
 * shift writes, so the route and the check agree on which shift goes where.
 *
 * @returns {Array<{shiftId:string, workerId:string}>}
 */
export function swapWrites(request) {
  if (!request?.shiftId || !request?.toWorkerId) return [];
  const writes = [{ shiftId: request.shiftId, workerId: request.toWorkerId }];
  // A trade gives the offered shift back the other way. A cover, a claim, or
  // a trade with nothing offered moves one shift only.
  if (request.kind === "trade" && request.offeredShiftId && request.fromWorkerId) {
    writes.push({ shiftId: request.offeredShiftId, workerId: request.fromWorkerId });
  }
  return writes;
}

/**
 * The initial state of a new request. A claim of an open shift skips the peer
 * step — the claimant is the peer — and goes straight to the manager (or to
 * approved when no approval is needed).
 */
export function initialState({ kind, fromWorkerId, needsApproval = true }) {
  const claim = kind === "cover" && !fromWorkerId;
  if (claim) return needsApproval ? "pending_manager" : "approved";
  return "pending_peer";
}
