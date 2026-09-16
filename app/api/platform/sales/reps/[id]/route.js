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
//
// Since 2026-09-16 the gate, the hand-off and the transaction live in
// lib/sales/repActivation.js, because a call-centre agency deactivates its
// own employees from /sales/agency under the same rules. This file keeps the
// superadmin check and the edits only a superadmin makes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { INFLUENCER_KIND } from "@/lib/influencers";
import { ENGAGEMENTS, isEngagement } from "@/lib/sales/payoutDetails";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { normaliseWorkEmail, workEmailProblem } from "@/lib/sales/repAdmin";
import { resolvePlanAssignment } from "@/lib/sales/commissionPlanServer";
import { activationAuditRows, changeRepActive } from "@/lib/sales/repActivation";
import { AGENCY_ENGAGEMENT, AGENCY_KIND, clearSetupIfComplete } from "@/lib/sales/agency";
import { parseSellsIn, sellsInOf } from "@/lib/sales/leadLanguage";

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
      kind: true,
      managerId: true,
      manager: { select: { id: true, kind: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { active } = body;

  // An influencer's ledger row is not deactivated here. Its `active` is the
  // COMPANY's influencer standing, and the two are cleared or restored
  // together on /platform/companies/[id] (lib/influencers unenrolInfluencer /
  // enrolInfluencer) — flipping the row alone would leave a company flagged
  // influencer with a dead ledger, earning neither commission nor the free
  // month. Point at the one place that keeps both in step.
  if (existing.kind === INFLUENCER_KIND && typeof active === "boolean" && active !== existing.active) {
    const company = await db.company.findFirst({ where: { influencerRepId: existing.id }, select: { id: true } });
    return NextResponse.json(
      {
        error: active
          ? "This is an influencer ledger. Re-enrol the company on its platform page to reactivate it."
          : "This is an influencer ledger. Stop the influencer status on the company's platform page — that deactivates the ledger and returns the company to the ordinary referral rules together.",
        companyId: company?.id || null,
      },
      { status: 409 },
    );
  }
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
  // "Agency employee" is a fact about the reporting line, not a label: it
  // means "paid through the manager", and a rep whose manager is not an
  // agency has nobody to be paid through. lib/sales/agency.js sets it with
  // the manager in the same write; here it may only be set on a row that
  // already reports to an agency, and an agency's own row never carries one.
  if (touchesEngagement && engagement === AGENCY_ENGAGEMENT && existing.manager?.kind !== AGENCY_KIND) {
    return NextResponse.json(
      { error: "Only a rep who reports to an agency can be an agency employee. The agency adds its own people from its portal." },
      { status: 400 },
    );
  }
  if (touchesEngagement && existing.kind === AGENCY_KIND && engagement !== null) {
    return NextResponse.json(
      { error: "An agency has no engagement of its own — freelancer or employee is a fact about a person." },
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

  // The other columns this request carries ride the SAME update as the
  // flag, so a deactivation with a mailbox edit is one write, not two.
  const extraData = {
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
  };
  const SELECT = {
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
    setupRequestedAt: true,
    commissionPlan: { select: { id: true, name: true } },
  };

  // ── The flag, through the shared writer ─────────────────────────────────
  //
  // lib/sales/repActivation.js holds the gate, the hand-off and the
  // transaction, because a call-centre agency closes its own employees'
  // doors from /sales/agency with the same rules — see that file's header.
  // This route keeps what is the superadmin's alone: who may call it, and
  // the mailbox / plan / engagement / languages edits beside the flag.
  let handled = null;
  let toRep = null;
  let gateCounts = null;
  let updated;
  const now = new Date();
  if (typeof active === "boolean") {
    const flip = await changeRepActive({
      db,
      existing,
      active,
      handoff: body.handoff,
      extraData,
      select: SELECT,
      now,
    });
    if (!flip.ok) {
      return NextResponse.json(
        { error: flip.error, ...(flip.code ? { code: flip.code, cannot: flip.cannot } : {}), ...(flip.counts ? { counts: flip.counts } : {}) },
        { status: flip.status },
      );
    }
    ({ updated, handled, toRep, gateCounts } = flip);
  } else {
    updated = await db.salesRep.update({ where: { id: _params.id }, data: extraData, select: SELECT });
  }

  // An agency's employee was flagged as needing a number and a work mailbox
  // (SalesRep.setupRequestedAt). The mailbox may have just arrived; if the
  // number is there too, the flag comes off — read fresh, never assumed.
  if (touchesMailbox) {
    const cleared = await clearSetupIfComplete(updated.id);
    if (cleared) updated = { ...updated, setupRequestedAt: null };
  }

  // One row per thing that changed, rather than one row saying "edited". The
  // deactivation actions already had their own vocabulary and other screens
  // read it; a mailbox assignment decides who a prospect ends up talking to and
  // deserves to be findable on its own.
  const actions = typeof active === "boolean" ? activationAuditRows({ updated, handled, toRep, gateCounts, active }) : [];
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
