// lib/sales/repActivation.js
//
// Deactivating and reactivating a sales rep — the one function both consoles
// call.
//
// ══ Why it left app/api/platform/sales/reps/[id]/route.js ═════════════════
//
// The rule lived in that route's PATCH handler for two months and it was the
// right home while a superadmin was the only person who ever closed a rep's
// door. On 2026-09-16 a second person got the button: a call-centre agency
// (lib/sales/agency.js) deactivates its own employees from /sales/agency. Two
// handlers holding the same gate is AGENTS.md failure class 4 — the copy is the
// one that rots — and the thing that would rot here is the hand-off: an
// employee holding forty leased prospects and three open leads must NOT be
// able to vanish from an agency's screen and leave the rows invisible to
// everyone until the leases lapse. That is the exact failure the platform
// route was rewritten to stop, and the agency gets the same refusal, the same
// counts and the same hand-off shapes, from the same lines of code.
//
// ══ What this does and does not decide ════════════════════════════════════
//
// It decides whether the door may close (deactivationGate, on counts read
// fresh in THIS request), where the held work goes (release / move, on the
// same transaction as the flag flip — there is no instant at which the rep is
// gone and the work is still theirs), and the language rule for the target.
// It does NOT decide who may call it: the platform route checks the superadmin
// role, the agency route checks the rep is the agency's own employee, and
// neither check is here, because a permission test inside a shared writer is
// the kind of thing a second caller quietly widens.
//
// The audit rows are RETURNED, not written: the two callers name different
// actors (PlatformAuditLog.platformAdminId vs actorSalesRepId) and each writes
// its own. The action vocabulary is the same, so one search finds both.
import { releaseUntouched } from "./queueBatch";
import { deactivationGate, frenchHeldCount, openLeadWhere, queueCountsFor, reassignHeld } from "./reassign";
import { repSellsFrench } from "./leadLanguage";

/** The columns every caller gets back after the write. */
export const ACTIVATION_SELECT = {
  id: true,
  name: true,
  email: true,
  workEmail: true,
  code: true,
  active: true,
  endedAt: true,
  acceptedAt: true,
  commissionPlanId: true,
  engagement: true,
  accruesPaidLeave: true,
  sellsIn: true,
  managerId: true,
  setupRequestedAt: true,
  commissionPlan: { select: { id: true, name: true } },
};

/**
 * The hand-off the gate approved, written on the transaction the rep update
 * is about to ride. Returns what happened, for the audit row.
 *
 * "release" gives every lease back (untouched AND dialled — the rep is
 * leaving, so a place in their list is not a thing to keep) and moves the
 * open leads, with the worked prospects those leads sit on, to the target.
 * "move" hands everything to the target. Neither touches SalesAttribution.
 */
async function performHandoff({ db, tx, rep, toRep, handoff, now }) {
  if (handoff.prospects === "release") {
    // A prospect with an open lead on it follows the lead to the target
    // rather than going back to the pool: a lead is a conversation in
    // progress, and its prospect back in the pool would be dialled cold by
    // whoever claimed it next. Everything else on a lease is released.
    const leadProspects = toRep
      ? await tx.salesLead.findMany({
          where: { ...openLeadWhere(rep.id), prospectId: { not: null } },
          select: { prospectId: true },
        })
      : [];
    const withLead = new Set(leadProspects.map((l) => l.prospectId));
    const leased = await tx.prospect.findMany({
      where: { assignedRepId: rep.id, claimExpiresAt: { not: null } },
      select: { id: true },
    });
    const released = await releaseUntouched({
      db,
      tx,
      rep,
      reason: "admin",
      includeDialled: true,
      onlyIds: leased.map((p) => p.id).filter((id) => !withLead.has(id)),
      now,
    });
    let moved = null;
    if (toRep) {
      moved = await reassignHeld({ db, tx, fromRep: rep, toRep, now, onlyProspectIds: [...withLead] });
      if (moved.error) throw new Error(moved.error);
    }
    return { mode: "release", released: released.released, releasedIds: released.releasedIds, moved };
  }
  const moved = await reassignHeld({ db, tx, fromRep: rep, toRep, now });
  if (moved.error) throw new Error(moved.error);
  return { mode: "move", released: 0, releasedIds: [], moved };
}

/**
 * Flip `active` on a rep, with the hand-off the gate requires.
 *
 * @param db        the Prisma client (injected so a check can drive it).
 * @param existing  the rep row as read in this request: { id, name, email, sellsIn }.
 * @param active    true to reactivate, false to deactivate.
 * @param handoff   the body's `handoff`, judged by deactivationGate.
 * @param extraData other columns to write in the SAME update (the platform
 *                  route sends the mailbox, plan, engagement and sellsIn edits
 *                  it was asked for alongside). Merged after the flag so a
 *                  caller cannot override active/endedAt by accident.
 * @param canMoveTo  (toRep) => string|null — an extra refusal about the target
 *                  the caller imposes (the agency may only move work inside
 *                  its own team). Null allows.
 * @returns {ok:false, status, error, counts?} | {ok:true, updated, handled, toRep, gateCounts}
 */
export async function changeRepActive({
  db,
  existing,
  active,
  handoff: rawHandoff = null,
  extraData = {},
  select = ACTIVATION_SELECT,
  canMoveTo = null,
  now = new Date(),
} = {}) {
  if (!db || !existing?.id) return { ok: false, status: 400, error: "No rep to change." };
  if (typeof active !== "boolean") return { ok: false, status: 400, error: "active must be true or false" };

  // ── The deactivation gate ────────────────────────────────────────────────
  //
  // Counted fresh from the database on this request, never from what the
  // screen said a moment ago: a rep can claim a batch between the console
  // loading and the button being pressed.
  let handoff = null;
  let toRep = null;
  let gateCounts = null;
  if (active === false) {
    const counts = (await queueCountsFor({ db, repIds: [existing.id], now })).get(existing.id);
    const gate = deactivationGate({
      leased: counts.leased,
      openLeads: counts.openLeads,
      worked: counts.worked,
      handoff: rawHandoff,
    });
    gateCounts = gate.counts;
    if (!gate.ok) return { ok: false, status: gate.status, error: gate.error, counts: gate.counts };
    handoff = gate.handoff;
    if (handoff?.toRepId) {
      if (handoff.toRepId === existing.id) {
        return { ok: false, status: 400, error: "The work cannot be moved to the rep being deactivated.", counts: gate.counts };
      }
      toRep = await db.salesRep.findUnique({
        where: { id: handoff.toRepId },
        select: { id: true, name: true, email: true, active: true, sellsIn: true, managerId: true, engagement: true, kind: true },
      });
      if (!toRep) return { ok: false, status: 404, error: "That rep does not exist.", counts: gate.counts };
      if (!toRep.active) {
        return { ok: false, status: 409, error: "That rep is deactivated. Work can only be moved to an active rep.", counts: gate.counts };
      }
      const outside = typeof canMoveTo === "function" ? canMoveTo(toRep) : null;
      if (outside) return { ok: false, status: 403, error: outside, counts: gate.counts };
      // The language rule, judged BEFORE the transaction opens so it is a
      // 409 with a sentence rather than a thrown error inside performHandoff.
      // "move" carries every held row; "release" carries only the prospects
      // an open lead sits on — the same set performHandoff moves.
      if (!repSellsFrench(toRep)) {
        const cannot = await frenchHeldCount({
          db,
          salesRepId: existing.id,
          now,
          onlyWithOpenLead: handoff.prospects === "release",
        });
        if (cannot > 0) {
          return {
            ok: false,
            status: 409,
            code: "language",
            cannot,
            error: `${cannot} of the prospect${cannot === 1 ? " that would move is" : "s that would move are"} in Quebec and can only go to a rep who sells in French. ${toRep.name} has no French in their languages — set it on their card, or choose a rep who has.`,
            counts: gate.counts,
          };
        }
      }
    }
  }

  const writeRep = (client) =>
    client.salesRep.update({
      where: { id: existing.id },
      data: {
        ...extraData,
        active,
        // Only ever set alongside active: false, and cleared on the way
        // back. Leaving a stale endedAt on a reactivated rep would make
        // canAuthenticate refuse them forever — it treats endedAt as final,
        // on purpose.
        endedAt: active ? null : now,
      },
      select,
    });

  // With a hand-off, the release/move and the deactivation are one
  // transaction: either the work has a new home AND the door is shut, or
  // neither. Without one, the update is the plain write it always was.
  let handled = null;
  const updated = handoff
    ? await db.$transaction(
        async (tx) => {
          handled = await performHandoff({ db, tx, rep: existing, toRep, handoff, now });
          return writeRep(tx);
        },
        // A hundred-row hand-off is a dozen statements; Prisma's five-second
        // default is for one or two, and a Neon connection that has just
        // woken can spend most of it on the first.
        { timeout: 20000 },
      )
    : await writeRep(db);

  return { ok: true, updated, handled, toRep, gateCounts };
}

/**
 * The audit rows a flip produces, in the order it happened: the work moved,
 * then the door closed. Same two queue actions the queue route writes for a
 * release or a move on a rep who stays, so one search finds both. The caller
 * adds its own actor column and writes them.
 */
export function activationAuditRows({ updated, handled, toRep, gateCounts, active }) {
  const actions = [];
  if (handled?.mode === "release") {
    actions.push({
      action: "sales_rep_queue_released",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        scope: "all_held",
        onDeactivation: true,
        released: handled.released,
        prospectIds: handled.releasedIds,
        ...(handled.moved
          ? {
              leadsMovedTo: toRep.id,
              leadsMovedToEmail: toRep.email,
              leads: handled.moved.leads,
              workedProspectsMoved: handled.moved.worked,
            }
          : {}),
      },
    });
  }
  if (handled?.mode === "move") {
    actions.push({
      action: "sales_rep_queue_reassigned",
      details: {
        fromSalesRepId: updated.id,
        fromEmail: updated.email,
        toSalesRepId: toRep.id,
        toEmail: toRep.email,
        onDeactivation: true,
        prospects: handled.moved.prospects,
        leases: handled.moved.leases,
        worked: handled.moved.worked,
        leads: handled.moved.leads,
        batchId: handled.moved.batchId,
        attributionsMoved: 0,
      },
    });
  }
  actions.push({
    action: active ? "sales_rep_reactivated" : "sales_rep_deactivated",
    details: {
      salesRepId: updated.id,
      email: updated.email,
      ...(gateCounts ? { heldAtDeactivation: gateCounts } : {}),
    },
  });
  return actions;
}
