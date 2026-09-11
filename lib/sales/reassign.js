// lib/sales/reassign.js
//
// What a rep is holding, and how a superadmin hands it to somebody else.
//
// ══ The owner's words ═════════════════════════════════════════════════════
//
// "In the /platform I should also see how many leads the sales have in their
// queue and manually release them if needed, in case they disconnect and do
// not reconnect, etc. And if I deactivate an account I should be able to
// handle their leads → maybe assign them to someone else or temporarily
// assign them to me."
//
// Three things, then: SEE the queue per rep, RELEASE it, MOVE it. Release is
// not in this file — lib/sales/queueBatch.js's releaseUntouched() is the one
// function that puts a Prospect back in the pool, the rep's own button and
// the hourly cron already call it, and the console calls the same one. This
// file is the other two: the read, and the move.
//
// ══ What moves, and what deliberately does not ════════════════════════════
//
// Work in progress moves. That is:
//
//   * every Prospect the rep HOLDS — lib/sales/prospectView.js's queueWhere():
//     an unlapsed lease, or a worked row (claimExpiresAt null, "a real
//     conversation is not a lease"). A lease is re-issued to the new rep with
//     a fresh expiry, because the 48 hours were the old rep's; a worked row
//     stays worked, just with a new name on it.
//   * every OPEN SalesLead — not converted, not lost. A lead is somebody in
//     the middle of a conversation with FieldQuo, and it is the thing the
//     owner means by "their leads".
//   * research already queued for those prospects: nothing. Pipeline tasks
//     are keyed on the prospect, not the rep, so they carry over untouched.
//
// What does NOT move, and it is the sentence in the confirm dialog:
// SalesAttribution and every SalesCommissionEntry under it. A company a rep
// brought in stays credited to them. That is money, and it is history —
// lib/sales/scope.js's header is about why "attributed to me" is the one
// relation commission is computed from and why nothing may quietly rewrite it.
// There is no `salesAttribution` write anywhere in this file, and
// scripts/check-platform-rep-queue.mjs asserts that there never is.
//
// ══ The claim log ═════════════════════════════════════════════════════════
//
// SalesQueueClaim is written once and closed once per rep per hold. A move
// closes the old rep's open claim rows with releaseReason "reassigned" (which
// does NOT de-prioritise the row for them — they did not give it back) and
// writes a new claim row for the new rep with `mode: "reassigned"`, a batchId
// that names the rep it came from, and a `position` continuing the new rep's
// own open order so the moved rows dial AFTER what they already had rather
// than shuffling into it. The moved rows count against the new rep's daily
// claim cap, because they are rows the new rep now holds; a hundred and fifty
// is still the ceiling on how many one person is sitting on.
//
// ══ The language rule binds a move too ════════════════════════════════════
//
// A Quebec row reaches a rep through the queue only if their sellsIn carries
// French (lib/sales/leadLanguage.js). A Move that ignored that would be the
// side door: the console handing an anglophone rep the hundred Quebec rows
// the queue refused them. So planReassign() refuses — the whole move, not
// row by row — when the target cannot take any held row, and says how many.
// Row by row would silently leave the francophone half behind on a rep who
// is being deactivated, which is the stranded work this file exists to end.
// handoffTargets() marks each target eligible or not, with the count, so the
// picker greys the ones the server would refuse and says why.
//
// ══ Pure first ════════════════════════════════════════════════════════════
//
// planReassign() takes rows and returns writes. It touches no database, so
// the check script hands it fixtures and reads the plan: same-rep refused,
// inactive target refused, lapsed leases skipped, positions continued, expiry
// refreshed on leases and left null on worked rows. reassignHeld() below is
// the thin executor that reads, plans, and writes the plan in one transaction
// scoped to the old rep in every WHERE.

import { claimExpiryFrom, queueWhere } from "./prospectView";
import { LEAD_STATUSES } from "./outreachPipeline";
import { repCanTake, repSellsFrench, requiredLanguageFor } from "./leadLanguage";

/** A lead that is still somebody's job: not converted, not marked lost. */
export const CLOSED_LEAD_STATUSES = Object.freeze(["lost"]);

/**
 * The `where` for a rep's open leads — the ones that move with them.
 *
 * Never `{}`: the `__none__` sentinel is the one queueWhere and
 * assignedCompanyWhere use, and a missing rep id must match nothing.
 */
export function openLeadWhere(salesRepId) {
  const id = typeof salesRepId === "string" && salesRepId.length > 0 ? salesRepId : "__none__";
  return { salesRepId: id, ...openLeadFilter() };
}

/** The rep-less half of openLeadWhere(), for a query that names several reps. */
export function openLeadFilter() {
  return { convertedCompanyId: null, status: { notIn: [...CLOSED_LEAD_STATUSES] } };
}

/** The same rule as openLeadWhere, for a row already in hand. */
export function isOpenLead(lead = {}) {
  if (!lead || lead.convertedCompanyId) return false;
  const status = typeof lead.status === "string" && LEAD_STATUSES.includes(lead.status) ? lead.status : "new";
  return !CLOSED_LEAD_STATUSES.includes(status);
}

const when = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (v == null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Whether a prospect row is held by this rep right now: an unlapsed lease or
 * a worked row. The in-memory twin of queueWhere(), for rows already read.
 */
export function heldBy(prospect = {}, salesRepId, now = new Date()) {
  if (!prospect || !salesRepId || prospect.assignedRepId !== salesRepId) return false;
  const expires = when(prospect.claimExpiresAt);
  if (!expires) return true;
  return expires.getTime() > (when(now) || new Date()).getTime();
}

/**
 * The writes that move one rep's work to another. Pure.
 *
 * @param prospects rows `{ id, assignedRepId, assignedAt, claimExpiresAt }`,
 *                  any rep's — only the ones `fromRepId` holds are planned.
 * @param leads     rows `{ id, salesRepId, status, convertedCompanyId }`.
 * @param toRep     `{ id, active, sellsIn }` for the target, when the caller
 *                  has it. A target known to be inactive is refused here, and
 *                  the executor refuses one it cannot find at all. A target
 *                  whose sellsIn cannot take a held row — a Quebec prospect,
 *                  no French — is refused with the count; `prospects` rows
 *                  carry `province` for that, and a row without one has no
 *                  requirement.
 * @param startPosition the target's next free `position` — one past the
 *                  highest on their open claim rows, or 0.
 * @returns `{ error }` for a refusal, else
 *          `{ leases, worked, leadIds, newClaims, batchId, closeReason, counts }`
 *          where `leases` and `worked` are `{ id, data }` updates.
 */
export function planReassign({
  prospects = [],
  leads = [],
  fromRepId = null,
  toRepId = null,
  toRep = null,
  now = new Date(),
  startPosition = 0,
} = {}) {
  const at = when(now) || new Date();
  if (typeof fromRepId !== "string" || !fromRepId) return { error: "No rep to move from." };
  if (typeof toRepId !== "string" || !toRepId) return { error: "Choose a rep to move the work to." };
  if (fromRepId === toRepId) return { error: "That is the same rep. Choose a different one." };
  if (toRep && toRep.id === toRepId && toRep.active === false) {
    return { error: "That rep is deactivated. Work can only be moved to an active rep." };
  }

  const held = (Array.isArray(prospects) ? prospects : []).filter((p) => heldBy(p, fromRepId, at));
  // Only judged when the caller handed us the target row: an executor that
  // could not load the target has already refused. Counted over what is
  // actually held, so a lapsed Quebec lease is not a reason to refuse.
  if (toRep && toRep.id === toRepId) {
    const cannot = held.filter((p) => !repCanTake(toRep, p)).length;
    if (cannot > 0) {
      return {
        error: `${cannot} of the held prospect${cannot === 1 ? " is" : "s are"} in Quebec and can only go to a rep who sells in French. ${
          toRep.name ? `${toRep.name} has` : "That rep has"
        } no French in their languages — set it on their card, or choose a rep who has.`,
        code: "language",
        cannot,
      };
    }
  }
  const expiry = claimExpiryFrom(at);
  const leases = [];
  const worked = [];
  for (const p of held) {
    if (when(p.claimExpiresAt)) {
      leases.push({ id: p.id, data: { assignedRepId: toRepId, assignedAt: at, claimExpiresAt: expiry } });
    } else {
      worked.push({ id: p.id, data: { assignedRepId: toRepId, assignedAt: at } });
    }
  }

  const leadIds = (Array.isArray(leads) ? leads : [])
    .filter((l) => l && l.salesRepId === fromRepId && isOpenLead(l))
    .map((l) => l.id);

  // One batch id for the whole move, naming where it came from, so the new
  // rep's claim rows can be read back as "the ones I was handed from Daniel"
  // the way a batch can be read back as a batch.
  const batchId = `reassigned_from:${fromRepId}:${at.getTime().toString(36)}`;
  const start = Number.isInteger(startPosition) && startPosition >= 0 ? startPosition : 0;
  const localDate = at.toISOString().slice(0, 10);
  const newClaims = [...leases, ...worked].map((row, i) => ({
    salesRepId: toRepId,
    prospectId: row.id,
    claimedAt: at,
    mode: "reassigned",
    batchId,
    position: start + i,
    // The console has no browser zone for the rep who will hold this; the
    // day-end sweep judges a null zone in UTC, which is the only day anybody
    // can name for it.
    repTimeZone: null,
    localDate,
    // A worked row arrives worked: the claim opens and closes in one write,
    // so the sweep never treats a conversation as a lease to give back.
    workedAt: row.data.claimExpiresAt === undefined ? at : null,
  }));

  return {
    leases,
    worked,
    leadIds,
    newClaims,
    batchId,
    closeReason: "reassigned",
    expiresAt: expiry,
    counts: { prospects: held.length, leases: leases.length, worked: worked.length, leads: leadIds.length },
  };
}

/**
 * The 409 that stops a deactivation from stranding work. Pure.
 *
 * A rep with nothing held deactivates as they always did. One holding a lease
 * or an open lead is refused until the request says what to do with them:
 * `handoff.prospects` is "release" or "move", `handoff.toRepId` names where
 * moved things go. Leads can only be moved — SalesLead.salesRepId is not
 * nullable and there is no pool for a lead to go back to — so "release" with
 * open leads still needs a target for the leads.
 *
 * @returns `{ ok: true, handoff: null }` when nothing is held;
 *          `{ ok: true, handoff }` when the request handles it;
 *          `{ ok: false, status, error, counts }` otherwise.
 */
export function deactivationGate({ leased = 0, openLeads = 0, worked = 0, handoff = null } = {}) {
  const counts = { leased, openLeads, worked };
  if (leased <= 0 && openLeads <= 0) return { ok: true, handoff: null, counts };

  const mode = handoff && typeof handoff === "object" ? handoff.prospects : null;
  const toRepId = handoff && typeof handoff.toRepId === "string" && handoff.toRepId ? handoff.toRepId : null;

  if (mode !== "release" && mode !== "move") {
    return {
      ok: false,
      status: 409,
      error: `This rep still holds ${leased} prospect${leased === 1 ? "" : "s"} and ${openLeads} open lead${openLeads === 1 ? "" : "s"}. Release them or move them to another rep, then deactivate.`,
      counts,
    };
  }
  if (mode === "move" && !toRepId) {
    return { ok: false, status: 400, error: "Say which rep the work moves to.", counts };
  }
  if (mode === "release" && openLeads > 0 && !toRepId) {
    return {
      ok: false,
      status: 409,
      error: `Open leads can only be moved, never released — a lead has to have a rep. Choose who takes the ${openLeads} lead${openLeads === 1 ? "" : "s"}.`,
      counts,
    };
  }
  return { ok: true, handoff: { prospects: mode, toRepId }, counts };
}

// ═══════════════════════════════════════════════════════════════════════════
// The reads
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What each rep holds, from the rows.
 *
 * `held` is queueWhere's count; `leased` and `worked` split it; `untouched`
 * and `dialled` split `leased` by lib/sales/queueBatch.js's own rule (an
 * attempt by this rep since the claim). `oldestClaimAt` is the oldest live
 * lease, so a supervisor can see a batch that has been sitting since Tuesday.
 */
export function summariseHeld(rows = [], { salesRepId, now = new Date() } = {}) {
  const at = when(now) || new Date();
  let leased = 0;
  let worked = 0;
  let untouched = 0;
  let dialled = 0;
  let french = 0;
  let oldest = null;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!heldBy(row, salesRepId, at)) continue;
    // Held rows that can only move to a rep with French. The picker greys
    // targets on this number; a rep holding none can move to anybody.
    if (requiredLanguageFor(row) === "fr") french++;
    if (!when(row.claimExpiresAt)) {
      worked++;
      continue;
    }
    leased++;
    const since = when(row.assignedAt);
    if (since && (!oldest || since < oldest)) oldest = since;
    const touched = (row.callAttempts || []).some((a) => {
      const d = when(a?.dialledAt);
      return d && since && d.getTime() >= since.getTime();
    });
    if (touched) dialled++;
    else untouched++;
  }
  return {
    held: leased + worked,
    leased,
    worked,
    untouched,
    dialled,
    french,
    oldestClaimAt: oldest,
    oldestClaimMs: oldest ? Math.max(0, at.getTime() - oldest.getTime()) : null,
  };
}

/**
 * How many rows a move from this rep would carry that need a rep with
 * French. Read fresh, the way the deactivation gate reads its counts, so a
 * batch claimed between the console loading and the button being pressed is
 * judged too. `onlyWithOpenLead` narrows to the prospects the "release"
 * hand-off moves (the ones an open lead sits on); "move" carries them all.
 */
export async function frenchHeldCount({ db, salesRepId, now = new Date(), onlyWithOpenLead = false } = {}) {
  const at = when(now) || new Date();
  let ids = null;
  if (onlyWithOpenLead) {
    const leads = await db.salesLead.findMany({
      where: { ...openLeadWhere(salesRepId), prospectId: { not: null } },
      select: { prospectId: true },
    });
    ids = leads.map((l) => l.prospectId);
    if (ids.length === 0) return 0;
  }
  const rows = await db.prospect.findMany({
    where: { ...queueWhere(salesRepId, { now: at }), ...(ids ? { id: { in: ids } } : {}) },
    select: { province: true },
  });
  return rows.filter((r) => requiredLanguageFor(r) === "fr").length;
}

/** The select summariseHeld() needs, for one rep's held rows. */
export function heldSelect(salesRepId) {
  return {
    id: true,
    assignedRepId: true,
    assignedAt: true,
    claimExpiresAt: true,
    province: true,
    callAttempts: { where: { salesRepId }, select: { dialledAt: true } },
  };
}

/**
 * The per-rep counts for the list. One prospect read and one lead groupBy for
 * all reps, not a pair per rep — the console renders twenty cards on one
 * request.
 */
export async function queueCountsFor({ db, repIds = [], now = new Date() } = {}) {
  const ids = (Array.isArray(repIds) ? repIds : []).filter((id) => typeof id === "string" && id);
  const out = new Map(ids.map((id) => [id, { ...summariseHeld([], { salesRepId: id, now }), openLeads: 0 }]));
  if (ids.length === 0) return out;

  const at = when(now) || new Date();
  const [held, leads] = await Promise.all([
    db.prospect.findMany({
      where: {
        assignedRepId: { in: ids },
        OR: [{ claimExpiresAt: null }, { claimExpiresAt: { gt: at } }],
      },
      select: {
        id: true,
        assignedRepId: true,
        assignedAt: true,
        claimExpiresAt: true,
        province: true,
        callAttempts: { where: { salesRepId: { in: ids } }, select: { salesRepId: true, dialledAt: true } },
      },
    }),
    db.salesLead.groupBy({
      by: ["salesRepId"],
      where: { salesRepId: { in: ids }, ...openLeadFilter() },
      _count: { _all: true },
    }),
  ]);

  const byRep = new Map();
  for (const row of held) {
    if (!byRep.has(row.assignedRepId)) byRep.set(row.assignedRepId, []);
    byRep.get(row.assignedRepId).push({
      ...row,
      // Only the holder's own attempts decide "dialled": another rep's call
      // from an earlier hold is not this rep starting on it.
      callAttempts: (row.callAttempts || []).filter((a) => a.salesRepId === row.assignedRepId),
    });
  }
  for (const id of ids) {
    const summary = summariseHeld(byRep.get(id) || [], { salesRepId: id, now: at });
    const lead = leads.find((l) => l.salesRepId === id);
    out.set(id, { ...summary, openLeads: lead?._count?._all || 0 });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// The move
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move everything `fromRep` holds to `toRep`, in one transaction.
 *
 * Every WHERE is scoped to the old rep, so a row that changed hands between
 * the read and the write — released by the cron, worked by the rep, claimed
 * by somebody else after a lapse — is not matched and is not overwritten. What
 * was actually moved is read back and counted, the way claimBatch counts its
 * winners; nothing is reported that the write did not do.
 *
 * `onlyProspectIds` narrows the prospect side (the deactivation flow uses it
 * to move worked rows that belong to moved leads while releasing the rest);
 * `tx` lets the deactivation ride the same transaction as the rep update.
 */
export async function reassignHeld({
  db,
  fromRep,
  toRep,
  now = new Date(),
  onlyProspectIds = null,
  tx = null,
} = {}) {
  if (!db || !fromRep?.id) throw new Error("reassignHeld needs a db and a rep to move from");
  if (!toRep?.id) return { error: "Choose a rep to move the work to." };
  if (toRep.active === false) {
    return { error: "That rep is deactivated. Work can only be moved to an active rep." };
  }
  const at = when(now) || new Date();
  const [prospects, leads, last] = await Promise.all([
    db.prospect.findMany({
      where: {
        ...queueWhere(fromRep.id, { now: at }),
        ...(Array.isArray(onlyProspectIds) ? { id: { in: onlyProspectIds } } : {}),
      },
      // `province` so planReassign can apply the language rule to the rows
      // that would actually move — the caller's `toRep` must carry sellsIn.
      select: { id: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true, province: true },
    }),
    db.salesLead.findMany({
      where: openLeadWhere(fromRep.id),
      select: { id: true, salesRepId: true, status: true, convertedCompanyId: true },
    }),
    db.salesQueueClaim.aggregate({
      where: { salesRepId: toRep.id, releasedAt: null, workedAt: null },
      _max: { position: true },
    }),
  ]);
  const startPosition = Number.isInteger(last?._max?.position) ? last._max.position + 1 : 0;
  const plan = planReassign({
    prospects,
    leads,
    fromRepId: fromRep.id,
    toRepId: toRep.id,
    toRep,
    now: at,
    startPosition,
  });
  if (plan.error) return { error: plan.error, code: plan.code || null, cannot: plan.cannot || 0 };

  const run = async (client) => {
    const leaseIds = plan.leases.map((r) => r.id);
    const workedIds = plan.worked.map((r) => r.id);
    if (leaseIds.length) {
      await client.prospect.updateMany({
        where: { id: { in: leaseIds }, assignedRepId: fromRep.id, claimExpiresAt: { not: null } },
        data: { assignedRepId: toRep.id, assignedAt: at, claimExpiresAt: plan.expiresAt },
      });
    }
    if (workedIds.length) {
      await client.prospect.updateMany({
        where: { id: { in: workedIds }, assignedRepId: fromRep.id, claimExpiresAt: null },
        data: { assignedRepId: toRep.id, assignedAt: at },
      });
    }
    const moved = [...leaseIds, ...workedIds].length
      ? await client.prospect.findMany({
          where: { id: { in: [...leaseIds, ...workedIds] }, assignedRepId: toRep.id, assignedAt: at },
          select: { id: true },
        })
      : [];
    const movedIds = new Set(moved.map((m) => m.id));
    const claims = plan.newClaims.filter((c) => movedIds.has(c.prospectId));
    if (movedIds.size) {
      await client.salesQueueClaim.updateMany({
        where: { prospectId: { in: [...movedIds] }, salesRepId: fromRep.id, releasedAt: null, workedAt: null },
        data: { releasedAt: at, releaseReason: plan.closeReason },
      });
      await client.salesQueueClaim.createMany({ data: claims });
    }
    let leadsMoved = 0;
    if (plan.leadIds.length) {
      const r = await client.salesLead.updateMany({
        where: { id: { in: plan.leadIds }, salesRepId: fromRep.id },
        data: { salesRepId: toRep.id },
      });
      leadsMoved = r.count;
    }
    return {
      prospects: movedIds.size,
      leases: leaseIds.filter((id) => movedIds.has(id)).length,
      worked: workedIds.filter((id) => movedIds.has(id)).length,
      leads: leadsMoved,
      batchId: plan.batchId,
      expiresAt: plan.expiresAt,
    };
  };

  // Same twenty seconds the deactivation route gives the transaction it opens
  // around this: a hundred-row move is a dozen statements, not one.
  return tx ? run(tx) : db.$transaction(run, { timeout: 20000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// Who the work can go to
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The reps a superadmin may move work to, and which of them is the superadmin.
 *
 * ── "Temporarily assign them to me" ──────────────────────────────────────
 *
 * PlatformAdmin and SalesRep are separate identity systems on purpose
 * (docs/sales/RESEARCH-auth-rbac.md §1; the SalesRep header in the schema),
 * and no column links one to the other. Leads are worked in the /sales portal,
 * which only a SalesRep can sign in to, so "assign to me" can only mean "to
 * the SalesRep row that is me" — and the one fact the two tables share is a
 * unique email. A superadmin whose sign-in address is also a rep's sign-in
 * address is offered that rep as "me"; one without a rep account is told so,
 * rather than shown a "me" that would put leads on a login nobody has. It is
 * a match, not a link, and the screen says which.
 */
export async function handoffTargets({ db, admin, excludeRepId = null, frenchHeld = 0 } = {}) {
  const [reps, me] = await Promise.all([
    db.salesRep.findMany({
      where: { active: true, ...(excludeRepId ? { id: { not: excludeRepId } } : {}) },
      select: { id: true, name: true, code: true, email: true, sellsIn: true },
      orderBy: { name: "asc" },
    }),
    admin?.id
      ? db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true } })
      : null,
  ]);
  const adminEmail = me?.email ? me.email.trim().toLowerCase() : null;
  const mine = adminEmail
    ? reps.find((r) => (r.email || "").trim().toLowerCase() === adminEmail) || null
    : null;
  // `frenchHeld` is how many of the rows being moved are Quebec rows. With
  // any, a target without French is offered greyed with the reason — the
  // same refusal planReassign() would give — rather than dropped from the
  // list, so the superadmin sees WHO is ineligible and can fix their card.
  const need = Number.isInteger(frenchHeld) && frenchHeld > 0 ? frenchHeld : 0;
  return {
    targets: reps.map((r) => {
      const sellsFrench = repSellsFrench(r);
      const eligible = need === 0 || sellsFrench;
      return {
        id: r.id,
        name: r.name,
        code: r.code,
        isMe: Boolean(mine && mine.id === r.id),
        sellsFrench,
        eligible,
        why: eligible
          ? null
          : `${need} of the held prospect${need === 1 ? " is" : "s are"} in Quebec and can only go to a rep who sells in French.`,
      };
    }),
    frenchHeld: need,
    me: mine ? { id: mine.id, name: mine.name } : null,
    meNote: mine
      ? `"Me" is your own rep account (${mine.name}), matched by sign-in email.`
      : "You have no sales rep account under your sign-in email, so there is no \"me\" to move work to — only active reps are offered. Invite yourself as a rep if you want to take a queue over yourself.",
  };
}
