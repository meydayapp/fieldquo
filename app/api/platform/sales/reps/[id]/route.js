// app/api/platform/sales/reps/[id]/route.js
//
// Deactivating (and reactivating) a sales rep, and assigning their work mailbox.
//
// ══ Two edits, one handler, and why the code is not a third ═══════════════
//
// `active` and `workEmail` are both here because both are things a superadmin
// does to an existing rep from the same row on the same screen.
//
// `code` deliberately is NOT. It is the slug in /signup?sales=<code> — the link
// is on a business card, in a text message, in an email footer — and changing
// it silently stops crediting the rep for every copy already handed out.
// Attribution rows are keyed on salesRepId and are safe, but the LINK is not,
// and a control whose real effect is "quietly stop some of your signups
// counting" is exactly the destructive-operation-labelled-as-cosmetic failure
// AGENTS.md names. The code is chosen once, at creation, where it can still be
// overridden; after that the screen says why it is fixed rather than offering
// an edit that would look harmless.
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no DELETE handler in this file, and that is the decision rather than
// an omission. A rep's SalesAttribution rows say who brought each company in,
// and their SalesCommissionEntry rows say what FieldQuo owed and paid. Both are
// history, and history does not stop being true when somebody leaves. The
// schema says the same thing in its own words on SalesRep.endedAt.
//
// So `active: false` closes the door — lib/sales/gate.js re-reads this column on
// every single request, so a deactivation takes effect within one request
// rather than waiting out a twelve-hour token — and `endedAt` records when. A
// reactivation clears endedAt, because somebody who comes back has not left.
//
// ══ Deactivation does not strand the work ═════════════════════════════════
//
// The owner: "if I deactivate an account I should be able to handle their
// leads → maybe assign them to someone else or temporarily assign them to
// me." Before this, `active: false` closed the door and left a hundred
// leased prospects and a dozen open leads behind it, invisible to every
// other rep until the leases lapsed — and the leads never lapse at all.
//
// So `active: false` for a rep who holds a lease or an open lead is REFUSED
// with 409 and the counts, until the request also says what happens to them
// (`handoff: { prospects: "release" | "move", toRepId }`). The gate is
// lib/sales/reassign.js's deactivationGate(), pure, and the release is
// lib/sales/queueBatch.js's releaseUntouched() — the same function behind the
// rep's own button and the hourly cron. The hand-off and the deactivation
// ride one transaction: there is no instant at which the rep is gone and the
// work is still theirs. A rep with nothing held deactivates exactly as before.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ENGAGEMENTS, isEngagement } from "@/lib/sales/payoutDetails";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { normaliseWorkEmail, workEmailProblem } from "@/lib/sales/repAdmin";
import { resolvePlanAssignment } from "@/lib/sales/commissionPlanServer";
import { releaseUntouched } from "@/lib/sales/queueBatch";
import { deactivationGate, frenchHeldCount, openLeadWhere, queueCountsFor, reassignHeld } from "@/lib/sales/reassign";
import { parseSellsIn, repSellsFrench, sellsInOf } from "@/lib/sales/leadLanguage";

/**
 * The hand-off the gate approved, written on the transaction the rep update
 * is about to ride. Returns what happened, for the audit row.
 *
 * "release" gives every lease back (untouched AND dialled — the rep is
 * leaving, so a place in their list is not a thing to keep) and moves the
 * open leads, with the worked prospects those leads sit on, to the target.
 * "move" hands everything to the target. Neither touches SalesAttribution.
 */
async function performHandoff({ tx, rep, toRep, handoff, now }) {
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

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can manage the sales team" },
      { status: 403 },
    );
  }

  const existing = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: {
      id: true,
      name: true,
      active: true,
      email: true,
      workEmail: true,
      commissionPlanId: true,
      sellsIn: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { active } = body;
  // `undefined` means "this request isn't about the mailbox". `null` and `""`
  // both mean "clear it", which is a real thing to want — a mailbox is closed
  // when somebody leaves, and leaving a dead address on the row would keep
  // sending mail whose replies bounce. The two are deliberately different, so
  // `in` rather than a truthiness test.
  const touchesMailbox = "workEmail" in body;
  const workEmail = touchesMailbox ? normaliseWorkEmail(body.workEmail) : undefined;
  // Same `in` test, same reason: null is "this rep has no plan", which is a
  // real state (and the one that earns them nothing), not a missing field.
  const touchesPlan = "commissionPlanId" in body;
  // Freelancer or employee. The rep's own Pay screen has said "Nobody has
  // said whether this rep is a freelancer or an employee" since the column
  // existed, and the owner looked for the control here and found none: the
  // column had readers (payout readiness, leave accrual) and no writer. `in`
  // again: null is a real value — "we have not decided" — and must stay
  // sendable, so the field can be cleared if it was set wrongly.
  const touchesEngagement = "engagement" in body;
  const engagement = touchesEngagement
    ? body.engagement === null || body.engagement === ""
      ? null
      : String(body.engagement)
    : undefined;
  if (touchesEngagement && engagement !== null && !isEngagement(engagement)) {
    return NextResponse.json(
      { error: `engagement must be one of ${ENGAGEMENTS.map((e) => e.key).join(", ")}, or null.` },
      { status: 400 },
    );
  }

  // The languages the rep can SELL in — the owner's control for "who can get
  // the quebec leads". A superadmin sets it here so the Quebec closer hired
  // today receives Quebec rows before they have opened their own settings.
  // Validated by the same pure function the rep's own route uses, so the two
  // writers cannot disagree about what a language code is. An empty list is
  // a real value (English-only for allocation, "unset" on the rep's screen)
  // and stays sendable.
  const touchesSellsIn = "sellsIn" in body;
  let sellsIn;
  if (touchesSellsIn) {
    const parsed = parseSellsIn(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    sellsIn = parsed.sellsIn;
  }

  if (typeof active !== "boolean" && !touchesMailbox && !touchesPlan && !touchesEngagement && !touchesSellsIn) {
    return NextResponse.json(
      { error: "Send active (true/false), workEmail, commissionPlanId, engagement, or sellsIn." },
      { status: 400 },
    );
  }
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json(
      { error: "active must be true or false" },
      { status: 400 },
    );
  }

  if (touchesMailbox) {
    const problem = workEmailProblem(workEmail, existing.email);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    if (workEmail && workEmail !== existing.workEmail) {
      const taken = await db.salesRep.findUnique({
        where: { workEmail },
        select: { id: true },
      });
      if (taken && taken.id !== existing.id) {
        return NextResponse.json(
          { error: `${workEmail} is already another rep's work mailbox.` },
          { status: 409 },
        );
      }
    }
  }

  let assignment = null;
  if (touchesPlan) {
    assignment = await resolvePlanAssignment({
      db,
      planId: body.commissionPlanId ?? null,
      currentPlanId: existing.commissionPlanId,
    });
    if (assignment.error) {
      return NextResponse.json({ error: assignment.error }, { status: 400 });
    }
  }

  // ── The deactivation gate ────────────────────────────────────────────────
  //
  // Counted fresh from the database on this request, never from what the
  // screen said a moment ago: a rep can claim a batch between the console
  // loading and the button being pressed.
  let handoff = null;
  let toRep = null;
  let gateCounts = null;
  if (active === false) {
    const now = new Date();
    const counts = (await queueCountsFor({ db, repIds: [existing.id], now })).get(existing.id);
    const gate = deactivationGate({
      leased: counts.leased,
      openLeads: counts.openLeads,
      worked: counts.worked,
      handoff: body.handoff,
    });
    gateCounts = gate.counts;
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, counts: gate.counts }, { status: gate.status });
    }
    handoff = gate.handoff;
    if (handoff?.toRepId) {
      if (handoff.toRepId === existing.id) {
        return NextResponse.json(
          { error: "The work cannot be moved to the rep being deactivated.", counts: gate.counts },
          { status: 400 },
        );
      }
      toRep = await db.salesRep.findUnique({
        where: { id: handoff.toRepId },
        select: { id: true, name: true, email: true, active: true, sellsIn: true },
      });
      if (!toRep) {
        return NextResponse.json({ error: "That rep does not exist.", counts: gate.counts }, { status: 404 });
      }
      if (!toRep.active) {
        return NextResponse.json(
          { error: "That rep is deactivated. Work can only be moved to an active rep.", counts: gate.counts },
          { status: 409 },
        );
      }
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
          return NextResponse.json(
            {
              error: `${cannot} of the prospect${cannot === 1 ? " that would move is" : "s that would move are"} in Quebec and can only go to a rep who sells in French. ${toRep.name} has no French in their languages — set it on their card, or choose a rep who has.`,
              code: "language",
              cannot,
              counts: gate.counts,
            },
            { status: 409 },
          );
        }
      }
    }
  }

  const writeRep = (client) => client.salesRep.update({
    where: { id: _params.id },
    data: {
      ...(typeof active === "boolean"
        ? {
            active,
            // Only ever set alongside active: false, and cleared on the way
            // back. Leaving a stale endedAt on a reactivated rep would make
            // canAuthenticate refuse them forever — it treats endedAt as final,
            // on purpose.
            endedAt: active ? null : new Date(),
          }
        : {}),
      ...(touchesMailbox ? { workEmail } : {}),
      ...(assignment ? { commissionPlanId: assignment.commissionPlanId } : {}),
      // A freelancer never accrues paid leave through FieldQuo; an employee
      // may, but that is a separate decision (see the schema comment), so
      // moving to freelancer clears the flag and moving to employee leaves it
      // for the superadmin to set — never inferred.
      ...(touchesEngagement
        ? { engagement, ...(engagement !== "employee" ? { accruesPaidLeave: false } : {}) }
        : {}),
      ...(touchesSellsIn ? { sellsIn } : {}),
    },
    select: {
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
      // Selected AND returned: the engagement column was once selected here
      // and dropped from a response map, and the save read as a failure.
      sellsIn: true,
      commissionPlan: { select: { id: true, name: true } },
    },
  });

  // With a hand-off, the release/move and the deactivation are one
  // transaction: either the work has a new home AND the door is shut, or
  // neither. Without one, the update is the plain write it always was.
  let handled = null;
  const now = new Date();
  const updated = handoff
    ? await db.$transaction(
        async (tx) => {
          handled = await performHandoff({ tx, rep: existing, toRep, handoff, now });
          return writeRep(tx);
        },
        // A hundred-row hand-off is a dozen statements; Prisma's five-second
        // default is for one or two, and a Neon connection that has just
        // woken can spend most of it on the first.
        { timeout: 20000 },
      )
    : await writeRep(db);

  // One row per thing that changed, rather than one row saying "edited". The
  // deactivation actions already had their own vocabulary and other screens
  // read it; a mailbox assignment decides who a prospect ends up talking to and
  // deserves to be findable on its own.
  const actions = [];
  // The hand-off first, so the log reads in the order it happened: the work
  // moved, then the door closed. Same two actions the queue route writes for
  // a release or a move on a rep who stays, so one search finds both.
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
  if (typeof active === "boolean") {
    actions.push({
      action: active ? "sales_rep_reactivated" : "sales_rep_deactivated",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        ...(gateCounts ? { heldAtDeactivation: gateCounts } : {}),
      },
    });
  }
  if (touchesMailbox && workEmail !== existing.workEmail) {
    actions.push({
      action: "sales_rep_work_mailbox_set",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        from: existing.workEmail || null,
        to: updated.workEmail || null,
      },
    });
  }
  if (assignment && assignment.commissionPlanId !== existing.commissionPlanId) {
    // Its own action, because "what is this person paid" is the question asked
    // when a payout looks wrong, and it must be answerable from the audit log
    // without inferring it from an "edited" row. Clearing a plan is recorded
    // just as loudly: it is the change that stops the ledger recording anything
    // at all for their next milestone.
    actions.push({
      action: "sales_rep_commission_plan_set",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        from: existing.commissionPlanId || null,
        to: updated.commissionPlanId || null,
        toName: updated.commissionPlan?.name || null,
      },
    });
  }
  if (touchesSellsIn) {
    const before = sellsInOf(existing);
    const after = sellsInOf(updated);
    if (before.length !== after.length || before.some((c) => !after.includes(c))) {
      // Findable on its own: "why did Daniel stop getting Quebec rows" is
      // answered by this row, not by an "edited" entry.
      actions.push({
        action: "sales_rep_sells_in_set",
        details: { salesRepId: updated.id, email: updated.email, from: before, to: after },
      });
    }
  }
  for (const entry of actions) {
    await db.platformAuditLog.create({
      data: { platformAdminId: admin.id, ...entry },
    });
  }

  // sellsIn through sellsInOf(), as the list route returns it — the response
  // the screen reloads from and the one it got from the save must agree.
  return NextResponse.json({ ...updated, sellsIn: sellsInOf(updated), ...(handled ? { handoff: handled } : {}) });
}
