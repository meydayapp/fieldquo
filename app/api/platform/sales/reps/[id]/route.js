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
//
// ══ Employee, freelancer, or works for an agency (2026-09-17) ═════════════
//
// `engagement: "agency"` with `agencyId` puts an existing rep under an
// agency — the owner's "link an existing account to an agency in case the
// account was created before the agency" — with the same consequences the
// agency's own My team add gives: payee = the agency, no Pay screen, the
// team's floor, the agency's plan, and the number-and-mailbox flag. Choosing
// employee or freelancer for a rep under an agency detaches them. Both are
// payee changes, and both are refused while the rep has an open payout
// week; `kind: "agency"` converts a blank-slate rep row into an agency. The
// decisions are lib/sales/repEngagement.js's, over rows read fresh here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { INFLUENCER_KIND } from "@/lib/influencers";
import { ENGAGEMENTS, isEngagement } from "@/lib/sales/payoutDetails";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { normaliseWorkEmail, workEmailProblem } from "@/lib/sales/repAdmin";
import { resolvePlanAssignment } from "@/lib/sales/commissionPlanServer";
import { activationAuditRows, changeRepActive } from "@/lib/sales/repActivation";
import { deactivationGate, queueCountsFor } from "@/lib/sales/reassign";
import { AGENCY_ENGAGEMENT, AGENCY_KIND, clearSetupIfComplete } from "@/lib/sales/agency";
import { agencyConversion, conversionCounts, resolveEngagementChange } from "@/lib/sales/repEngagement";
import { recordError } from "@/lib/platform/errorLog";
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
      engagement: true,
      managerId: true,
      payoutMethod: true,
      setupRequestedAt: true,
      testAccount: true,
      canCallColleagues: true,
      canCallOffCampaign: true,
      // The ledger count decides the test-account refusal below: a row that
      // has earned cannot become a test account. Read fresh, here.
      _count: { select: { phoneNumbers: true, commissionEntries: true } },
      manager: { select: { id: true, kind: true, name: true } },
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
  // Freelancer, employee, or works for an agency. The rep's own Pay screen
  // has said "Nobody has said whether this rep is a freelancer or an
  // employee" since the column existed, and the owner looked for the control
  // here and found none: the column had readers (payout readiness, leave
  // accrual) and no writer. `in` again: null is a real value — "we have not
  // decided" — and must stay sendable, so the field can be cleared if it was
  // set wrongly.
  //
  // Since 2026-09-17 the third choice is here too. The owner: "in here I
  // should be able to select agency too besides freelancer or employee — and
  // how do I link an existing account to an agency in case the account was
  // created before the agency?" "Agency" is a payee change, not a label —
  // lib/sales/repEngagement.js decides it from the agency row and the rep's
  // unbatched entries, both read fresh: the agency must exist, be active and
  // be an agency; a rep cannot be their own; an agency cannot be put under
  // one; and a rep with an open payout week is refused until Monday closes
  // it, because the entries would otherwise be paid to the wrong party.
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
  let transition = null;
  if (touchesEngagement) {
    transition = await resolveEngagementChange({
      existing,
      engagement,
      agencyId: body.agencyId ? String(body.agencyId) : null,
      now: new Date(),
    });
    if (!transition.ok) {
      return NextResponse.json(
        { error: transition.error, ...(transition.code ? { code: transition.code } : {}), ...(transition.counts ? { counts: transition.counts } : {}) },
        { status: transition.status },
      );
    }
  }

  // ── Converting a rep row into an agency account ─────────────────────────
  //
  // "The account was created before the agency": a person hired as a plain
  // rep who turns out to BE the call centre. Allowed only while the row is a
  // blank slate for the ledger — no entry, no batch, nobody reporting to it,
  // reporting to nobody — because a rep's earnings read as a person's and an
  // agency's as a business's, and one row cannot be both. The pure decision
  // and every refusal sentence are lib/sales/repEngagement.js's; the counts
  // are read fresh here. `kind` accepts only "agency": there is no way back.
  const touchesKind = "kind" in body;
  let conversion = null;
  if (touchesKind) {
    if (body.kind !== AGENCY_KIND) {
      return NextResponse.json({ error: `kind may only be changed to "${AGENCY_KIND}". An agency does not become a rep again.` }, { status: 400 });
    }
    if (touchesEngagement) {
      return NextResponse.json({ error: "Send kind on its own: an agency has no engagement." }, { status: 400 });
    }
    const counts = await conversionCounts(existing.id);
    let planForAgency;
    if ("commissionPlanId" in body) {
      const chosen = await resolvePlanAssignment({ db, planId: body.commissionPlanId ?? null, currentPlanId: existing.commissionPlanId });
      if (chosen.error) return NextResponse.json({ error: chosen.error }, { status: 400 });
      planForAgency = chosen.commissionPlanId;
    }
    conversion = agencyConversion({ existing, counts, commissionPlanId: planForAgency });
    if (!conversion.ok) {
      return NextResponse.json(
        { error: conversion.error, ...(conversion.code ? { code: conversion.code } : {}), ...(conversion.counts ? { counts: conversion.counts } : {}) },
        { status: conversion.status },
      );
    }
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

  // ── Test account (owner, 2026-09-17) ────────────────────────────────────
  //
  // The calling window is not applied to this rep's dials, and every dial
  // is recorded as a test and counted nowhere — lib/sales/callingRules.js
  // judges a test account on the same path as a test line, and every count
  // excludes the row it writes. Two refusals, both on rows read fresh here:
  // an agency is a payee, not a person at a keypad; and a rep with a
  // commission entry has earned, while a test account earns nothing — the
  // two facts cannot sit on one row without one of them being untrue. The
  // flag is set on the row, never keyed on an email:
  // scripts/check-sales-test-line.mjs asserts no file names the owner's.
  const touchesTestAccount = "testAccount" in body;
  if (touchesTestAccount && typeof body.testAccount !== "boolean") {
    return NextResponse.json({ error: "testAccount must be true or false" }, { status: 400 });
  }
  if (touchesTestAccount && body.testAccount === true && existing.testAccount !== true) {
    if (existing.kind === AGENCY_KIND) {
      return NextResponse.json(
        { error: "An agency cannot be a test account. The flag belongs on the person who dials, not on the payee.", code: "test_account_agency" },
        { status: 409 },
      );
    }
    if (existing.kind === INFLUENCER_KIND) {
      return NextResponse.json(
        { error: "An influencer ledger has no dialler. There is nothing here for a test account to exempt.", code: "test_account_influencer" },
        { status: 409 },
      );
    }
    if ((existing._count?.commissionEntries || 0) > 0) {
      return NextResponse.json(
        {
          error:
            `${existing.name} has ${existing._count.commissionEntries} commission ${existing._count.commissionEntries === 1 ? "entry" : "entries"}. ` +
            "A test account earns nothing, and a row that has earned cannot become one — invite a separate account to test with.",
          code: "test_account_has_earned",
          counts: { commissionEntries: existing._count.commissionEntries },
        },
        { status: 409 },
      );
    }
  }

  // ── What this rep may dial outside the queue (2026-09-21) ──────────────
  //
  // Two booleans, the OMniLeads group privileges call_another_agent and
  // call_off_camp as per-rep flags (lib/sales/calls/supervision.js). Read
  // fresh by lib/sales/calls/gate.js on every dial, so a flag switched off
  // here binds the next press. Audited: the off-campaign one is a dial on
  // FieldQuo's account to a phone no record vouches for.
  const touchesPrivileges = "canCallColleagues" in body || "canCallOffCampaign" in body;
  for (const key of ["canCallColleagues", "canCallOffCampaign"]) {
    if (key in body && typeof body[key] !== "boolean") {
      return NextResponse.json({ error: `${key} must be true or false` }, { status: 400 });
    }
  }

  if (typeof active !== "boolean" && !touchesMailbox && !touchesPlan && !touchesEngagement && !touchesSellsIn && !touchesKind && !touchesTestAccount && !touchesPrivileges) {
    return NextResponse.json(
      { error: "Send active (true/false), workEmail, commissionPlanId, engagement (with agencyId for an agency), sellsIn, kind, testAccount, canCallColleagues or canCallOffCampaign." },
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
  if (touchesPlan && !conversion) {
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
    // The engagement, the reporting line and (into an agency) the plan and
    // the set-up flag, decided together by lib/sales/repEngagement.js. An
    // unchanged transition writes nothing.
    ...(transition && !transition.unchanged ? transition.data : {}),
    ...(conversion && !conversion.unchanged ? conversion.data : {}),
    ...(touchesSellsIn ? { sellsIn } : {}),
    ...(touchesTestAccount ? { testAccount: body.testAccount } : {}),
    ...("canCallColleagues" in body ? { canCallColleagues: body.canCallColleagues } : {}),
    ...("canCallOffCampaign" in body ? { canCallOffCampaign: body.canCallOffCampaign } : {}),
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
    kind: true,
    testAccount: true,
    canCallColleagues: true,
    canCallOffCampaign: true,
    managerId: true,
    manager: { select: { id: true, kind: true, name: true } },
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
  // ── Deactivating an AGENCY deactivates its employees (owner, 2026-09-16) ──
  //
  // The employees are the agency's; with the agency gone they have nobody to
  // be paid through and no one to answer to, so they go with it. Each one is
  // put through the SAME gate and hand-off as the agency (changeRepActive):
  // a held lead is released or moved exactly as the body says. Every
  // employee is judged BEFORE anything is written, so a refusal names the
  // employee and leaves the whole team, agency included, as it was.
  // Reactivating an agency does not reactivate its employees — that is a
  // decision per person, made on their row.
  let cascaded = [];
  if (active === false && existing.kind === AGENCY_KIND) {
    const employees = await db.salesRep.findMany({
      where: { managerId: existing.id, engagement: AGENCY_ENGAGEMENT, active: true },
      select: { id: true, name: true, email: true, sellsIn: true, active: true },
      orderBy: { name: "asc" },
    });
    const counts = employees.length ? await queueCountsFor({ db, repIds: employees.map((e) => e.id), now }) : new Map();
    for (const e of employees) {
      const c = counts.get(e.id) || { leased: 0, openLeads: 0, worked: 0 };
      const gate = deactivationGate({ leased: c.leased, openLeads: c.openLeads, worked: c.worked, handoff: body.handoff });
      if (!gate.ok) {
        return NextResponse.json(
          { error: `${e.name} (an employee of this agency): ${gate.error}`, counts: gate.counts, employeeId: e.id },
          { status: gate.status },
        );
      }
    }
    for (const e of employees) {
      const flip = await changeRepActive({ db, existing: e, active: false, handoff: body.handoff, select: SELECT, now });
      if (!flip.ok) {
        return NextResponse.json({ error: `${e.name} (an employee of this agency): ${flip.error}`, employeeId: e.id }, { status: flip.status });
      }
      cascaded.push(flip);
    }
  }
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
  for (const flip of cascaded) {
    for (const row of activationAuditRows({ updated: flip.updated, handled: flip.handled, toRep: flip.toRep, gateCounts: flip.gateCounts, active: false })) {
      actions.push({ ...row, details: { ...row.details, cascadedFromAgencyId: existing.id } });
    }
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
  // The engagement change's rows — sales_rep_engagement_set, and
  // sales_rep_agency_set / sales_rep_agency_detached with the payee before
  // and after — the same vocabulary a payout question is answered from.
  if (transition && !transition.unchanged) actions.push(...transition.audit);
  if (conversion && !conversion.unchanged) actions.push(...conversion.audit);
  if (touchesPrivileges && (existing.canCallColleagues !== updated.canCallColleagues || existing.canCallOffCampaign !== updated.canCallOffCampaign)) {
    actions.push({
      action: "sales_rep_call_privileges_updated",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        from: { canCallColleagues: existing.canCallColleagues, canCallOffCampaign: existing.canCallOffCampaign },
        to: { canCallColleagues: updated.canCallColleagues, canCallOffCampaign: updated.canCallOffCampaign },
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
  if (touchesTestAccount && updated.testAccount !== existing.testAccount) {
    // Its own row, because "why did this rep's dials stop counting" and
    // "who let this account ring at 03:00" are both answered from the audit
    // log, and neither should have to be inferred from an "edited" entry.
    actions.push({
      action: "sales_rep_test_account_set",
      details: { salesRepId: updated.id, email: updated.email, from: existing.testAccount === true, to: updated.testAccount === true },
    });
  }
  for (const entry of actions) {
    await db.platformAuditLog.create({
      data: { platformAdminId: admin.id, ...entry },
    });
  }

  // The owner's flag, exactly as an agency's own add fires it
  // (lib/sales/agency.js createAgencyRep): a rep now under an agency still
  // needs a number or a work mailbox, and the errors page says so. Not fired
  // when both are already there — there would be nothing to assign.
  if (transition && !transition.unchanged && transition.flagSetup && transition.agency) {
    await recordError({
      area: "sales",
      code: "agency_rep_needs_setup",
      message: `${updated.name} (${updated.email}) now works for ${transition.agency.name}. Assign a phone number and a work mailbox on /platform/sales/reps.`,
      detail: { agencyId: transition.agency.id, salesRepId: updated.id, linkedByPlatformAdminId: admin.id },
    }).catch(() => {});
  }

  // sellsIn through sellsInOf(), as the list route returns it — the response
  // the screen reloads from and the one it got from the save must agree.
  return NextResponse.json({ ...updated, sellsIn: sellsInOf(updated), ...(handled ? { handoff: handled } : {}) });
}
