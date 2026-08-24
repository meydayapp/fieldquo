// lib/org/leaveRouting.js
//
// Who is a pending leave request actually waiting on, and why.
//
// `lib/org/reportingLine.js` decides the routing; `lib/org/availability.js`
// decides who is away. This is the thin layer that fetches the two facts from
// the database, joins them, and turns the result into a sentence the screen can
// show. It exists so that the team list, the requester's own list and the
// response to submitting a request all say the same thing — three copies of
// this join is how they'd end up disagreeing.
//
// ── Which date decides awayness: TODAY, not the leave's start date ──────────
//
// This is the decision in this file that is easy to get wrong, so: the manager
// must be available NOW, on the day the routing is computed. Not on the first
// day of the leave being requested.
//
// The start date sounds right — "will the manager be there when this happens?"
// — and it is the wrong question. Approving is an act performed at a moment,
// and that moment is now. A manager sitting at their desk in August is
// perfectly able to judge a November request; the fact that they are also off
// in November is irrelevant to whether they can answer today. Routing on the
// start date would escalate that request past a fully available manager, take
// the decision away from the one person who knows the November schedule, and
// hand it to an owner who does not — for no gain, because the request would
// have been answered either way.
//
// The failure this feature exists to fix is the opposite one, and it is a
// TODAY-shaped failure: a request that sits unanswered because the only person
// it routes to is on a beach this week. Escalation is a response to
// unreachability, and unreachability is a property of the present.
//
// Today also has a property the start date does not: it is live. Routing is
// computed on every read, so a request escalated past a manager on Monday
// returns to that manager on the Friday they get back, without anything having
// to be re-run or re-saved. Start-date routing would freeze the answer at
// submit time and go stale the moment either person's holiday changed. Nothing
// is stored on the LeaveRequest row for exactly this reason — a stored approver
// would be a snapshot of who was away once.
//
// ── This never widens who may approve ───────────────────────────────────────
//
// `approverFor` says who a request WAITS on; `canApprove` says who may act, and
// it is deliberately wider. Both are reported here, separately, and `canAct` is
// the same call the PATCH route enforces — so the buttons match what the server
// will actually allow instead of being drawn from the role alone.

import { db } from "@/lib/db";
import { approverFor, canApprove } from "@/lib/org/reportingLine";
import { buildAwayLookup, dayBounds } from "@/lib/org/availability";

/** "Ann", "Ann and Bo", "Ann, Bo and Cy" */
function joinNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * Who is away in this company today.
 *
 * A failure here returns "nobody is away" rather than throwing. That is not
 * defensiveness for its own sake: `approverFor` already swallows a throwing
 * `isAway` so a broken lookup can't make a request unapprovable, and the caller
 * undoing that by letting the query reject would put the bug straight back.
 * Degraded routing shows the direct manager — the behaviour that existed before
 * escalation did — and says so.
 *
 * @returns {{isAway:(id:string)=>boolean, degraded:boolean}}
 */
export async function loadAwayLookup({ companyId, on = new Date() }) {
  const bounds = dayBounds(on);
  if (!companyId || !bounds) return { isAway: () => false, degraded: true };

  try {
    const rows = await db.leaveRequest.findMany({
      where: {
        companyId,
        status: "approved",
        startDate: { lte: bounds.end },
        endDate: { gte: bounds.start },
      },
      select: {
        workerId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });
    // buildAwayLookup re-checks status and range: the `where` clause is an
    // index hint, the pure function is the authority on what "away" means.
    const { isAway } = buildAwayLookup(rows, on);
    return { isAway, degraded: false };
  } catch (err) {
    console.error("[leave] availability lookup failed:", err?.message);
    return { isAway: () => false, degraded: true };
  }
}

/**
 * Describe the routing of one pending request. Pure — no I/O.
 *
 * @param byId Map of workerId → {id, name, managerId}
 */
export function describeRouting({
  workerId,
  byId,
  isAway = () => false,
  actorWorkerId = null,
  hasManagePermission = false,
  degraded = false,
}) {
  const route = approverFor({ workerId, byId, isAway });
  const nameOf = (id) => {
    const w = byId instanceof Map ? byId.get(id) : byId?.[id];
    return w?.name || "a colleague";
  };

  const requesterName = nameOf(workerId);
  const skipped = route.escalatedFrom.map((id) => ({
    id,
    name: nameOf(id),
    // Escalating past the requester is not absence — it's the rule that nobody
    // approves their own holiday, and saying "because they are away" would be a
    // plain lie on screen.
    why: id === workerId ? "self" : "away",
  }));
  const awayNames = skipped.filter((s) => s.why === "away").map((s) => s.name);
  const approverName = route.approverId ? nameOf(route.approverId) : null;

  let label;
  if (route.reason === "direct_manager") {
    label = `Waiting on ${approverName}.`;
  } else if (route.reason === "escalated") {
    label = awayNames.length
      ? `Waiting on ${approverName} — escalated because ${joinNames(awayNames)} ${
          awayNames.length === 1 ? "is" : "are"
        } away.`
      : `Waiting on ${approverName} — ${requesterName} can't approve their own time off.`;
  } else if (route.reason === "chain_unavailable") {
    label = `Waiting on an owner or admin — everyone above ${requesterName}${
      awayNames.length ? ` (${joinNames(awayNames)})` : ""
    } is away.`;
  } else {
    label = `Waiting on an owner or admin — no manager is set for ${requesterName}.`;
  }

  const notes = [];
  if (route.cycle) {
    notes.push(
      "The reporting line loops back on itself, so this only walked as far as it could — check Manage Team.",
    );
  }
  if (degraded) {
    notes.push(
      "Couldn't check who's away just now, so this shows the direct manager.",
    );
  }

  return {
    approverId: route.approverId,
    approverName,
    reason: route.reason,
    escalatedPast: skipped,
    label,
    note: notes.join(" ") || null,
    // Separate from the routing on purpose. Anyone above the requester may act
    // even when the request is waiting on somebody else.
    canAct: canApprove({
      actorWorkerId,
      workerId,
      byId,
      hasManagePermission,
    }),
  };
}

/**
 * Attach `routing` to every PENDING request in the list.
 *
 * Requests that are already decided are returned untouched: routing answers
 * "who is this waiting on", and an approved request is waiting on nobody.
 *
 * @param requests rows carrying at least {id, status, workerId}
 * @param on       the day availability is judged on — see the note at the top
 */
export async function annotateRouting({
  companyId,
  requests,
  actorWorkerId = null,
  hasManagePermission = false,
  on = new Date(),
}) {
  const list = Array.isArray(requests) ? requests : [];
  if (!list.some((r) => r?.status === "pending")) return list;

  let byId;
  let away;
  try {
    // The whole company's chain, because routing walks upward: the requester's
    // manager alone can't tell you who covers when that manager is away.
    const [workers, lookup] = await Promise.all([
      db.worker.findMany({
        where: { companyId },
        select: { id: true, name: true, managerId: true },
      }),
      loadAwayLookup({ companyId, on }),
    ]);
    byId = new Map(workers.map((w) => [w.id, w]));
    away = lookup;
  } catch (err) {
    // No org chart, no routing line — but the requests still render and the
    // approve buttons fall back to the role check the server already applies.
    console.error("[leave] routing lookup failed:", err?.message);
    return list;
  }

  return list.map((r) => {
    if (r?.status !== "pending") return r;
    try {
      return {
        ...r,
        routing: describeRouting({
          workerId: r.workerId,
          byId,
          isAway: away.isAway,
          actorWorkerId,
          hasManagePermission,
          degraded: away.degraded,
        }),
      };
    } catch (err) {
      // One unroutable row must not take the whole leave list down with it.
      // Without routing the row still renders and the approve buttons fall
      // back to the role check — which is where they were before this existed.
      console.error("[leave] routing failed for request", r?.id, err?.message);
      return r;
    }
  });
}
