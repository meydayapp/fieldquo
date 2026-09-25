// app/api/platform/sales/reps/route.js
//
// FieldQuo's own sales reps: the list, and adding one by invitation.
//
// ══ Superadmin only, and stated rather than assumed ═══════════════════════
//
// Hiring FieldQuo staff is not a support task. This follows POST
// /api/platform/admins' own bar (`admin.role !== "superadmin"` → 403) rather
// than canPlatform(), because there is no sales permission in
// PLATFORM_PERMISSIONS and adding one would imply the permission map has a
// scoping concept it does not have — see docs/sales/RESEARCH-auth-rbac.md §1 on
// why SALES_REP is deliberately NOT a fourth row in that table.
//
// ══ Why this route establishes a new pattern rather than copying one ══════
//
// POST /api/platform/admins creates FieldQuo staff by having a superadmin type
// the new person's password server-side and hand it over out of band. That
// means the credential briefly exists in two heads and travels through whatever
// channel was handy. This route does what the owner asked for instead — "add
// the salespeople the same way a company adds an employee" — an emailed link,
// a password only the invitee ever knows, and acceptedAt stamped when they use
// it. lib/sales/invite.js's header records why none of the tenant invite
// machinery could be reused to do it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ENGAGEMENTS, isEngagement } from "@/lib/sales/payoutDetails";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { inviteExpiry, newInviteToken } from "@/lib/sales/invite";
import { sendSalesInviteEmail } from "@/lib/sales/inviteEmail";
import {
  NUMBER_CAPABILITIES,
  codeCandidates,
  codeProblem,
  normaliseWorkEmail,
  salesNumberState,
  workEmailProblem,
} from "@/lib/sales/repAdmin";
import { signupLinkFor } from "@/lib/sales/repStats";
import { STEP_LABELS, stalledDecision } from "@/lib/signup/leads";
import { companyFactsOf } from "@/lib/signup/salesFloor";
import { CHECKOUT_GRACE_MS } from "@/lib/signup/setupGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import { MAILBOX_PUBLIC_SELECT } from "@/lib/sales/mailbox/store";
import { resolvePlanAssignment } from "@/lib/sales/commissionPlanServer";
import { queueCountsFor } from "@/lib/sales/reassign";
import { sellsInOf } from "@/lib/sales/leadLanguage";
import { repMoney } from "@/lib/sales/payoutAdmin";
import { SIGNUP_FLAG_LABELS, needsReview } from "@/lib/platform/signupFlags";
import { AGENCY_KIND, agencyTeam, isAgency, isAgencyEmployee, setupComplete } from "@/lib/sales/agency";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: { error: "Only superadmins can manage the sales team" },
      },
    };
  }
  return { admin, refusal: null };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const reps = await db.salesRep.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      // The mailbox they SEND from. Returned so the screen can show whether one
      // exists AND offer to set it — it had neither before, which made
      // SalesRep.workEmail a column with no way to fill it while
      // lib/sales/outreachSender.js refused every send for want of it.
      workEmail: true,
      code: true,
      active: true,
      invitedAt: true,
      acceptedAt: true,
      endedAt: true,
      inviteExpiresAt: true,
      engagement: true,
      // The rep types these on /sales/settings; the console never read them,
      // so the owner opened a rep's card to pay them and found no method.
      payoutMethod: true,
      payoutHandle: true,
      payoutConfirmedAt: true,
      accruesPaidLeave: true,
      // The languages they can SELL in — who may be handed a Quebec row.
      // Selected AND mapped below; the engagement column was selected here
      // and dropped from the map once, and the save looked like it had
      // failed.
      sellsIn: true,
      commissionPlanId: true,
      commissionPlan: { select: { id: true, name: true } },
      // "rep" | "influencer". An influencer row is a customer company's
      // commission ledger (lib/influencers) — listed here so its payouts run
      // through the same batch flow, shown in its own section because it
      // has no portal login and its link is the company's referral link.
      kind: true,
      influencerOf: { select: { id: true, name: true, referralCode: true }, take: 1 },
      // The agency tier (lib/sales/agency.js): an employee's manager is the
      // agency it works for, and setupRequestedAt is the owner's flag that
      // the platform still owes the row a number and a work mailbox. The
      // number count is what decides the flag, beside workEmail.
      managerId: true,
      manager: { select: { id: true, name: true, kind: true } },
      setupRequestedAt: true,
      // The owner's dialler-testing flag. Selected AND mapped below.
      testAccount: true,
      canCallColleagues: true,
      canCallOffCampaign: true,
      // The count is what makes "deactivate, never delete" legible on the
      // screen: a rep with attributions has history that stops being reachable
      // if the row goes.
      _count: { select: { attributions: true, phoneNumbers: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // The plans a rep can be put on. Returned WITH the reps rather than fetched
  // by a second call from the screen, so the picker cannot render before it
  // knows its options and offer an empty list that reads as "there are none".
  //
  // Inactive plans are included when somebody is still on one: hiding it would
  // make a rep's current plan vanish out of the select it is selected in, which
  // is how a save silently moves them onto something else.
  const assignedPlanIds = reps.map((r) => r.commissionPlanId).filter(Boolean);
  const plans = await db.salesCommissionPlan.findMany({
    where: { OR: [{ active: true }, { id: { in: assignedPlanIds } }] },
    select: {
      id: true,
      name: true,
      active: true,
      activationCents: true,
      firstPaymentCents: true,
      retentionCents: true,
      retentionDays: true,
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  const origin = getAppOrigin(request);

  // ── Whether each rep can actually send, from the SAME function the rep's
  //    own portal asks ─────────────────────────────────────────────────────
  //
  // outreachStatus() and not a local "does workEmail exist" test. Two opinions
  // about whether sending works is how a console reports a rep as ready while
  // their compose box refuses to render — the admin would then be looking at a
  // green tick and the rep at a blocker, and the rep would be right. Since
  // 2026-09-18 the verdict is read from the rep's SalesMailbox row, not from
  // Resend — one query per rep, no vendor call.
  const mailboxes = new Map(
    (
      await db.salesMailbox.findMany({
        where: { salesRepId: { in: reps.map((r) => r.id) } },
        select: { salesRepId: true, ...MAILBOX_PUBLIC_SELECT },
      })
    ).map((m) => [m.salesRepId, m]),
  );

  const sending = await Promise.all(
    reps.map((r) =>
      outreachStatus(r).catch((err) => ({
        canSend: false,
        blockers: [
          {
            code: "status_unavailable",
            title: "Couldn't work out whether this rep can send.",
            fix: `Reading the sending configuration failed: ${err?.message || "no reason given"}. Nothing has changed.`,
          },
        ],
        warnings: [],
      })),
    ),
  );

  // ── What each rep is holding ────────────────────────────────────────────
  //
  // The owner's "how many leads the sales have in their queue", on the card.
  // Counts only, here: the per-rep GET /reps/[id]/queue answers with
  // presence and the hand-off targets when a card is opened. Counted by the
  // same queueWhere() the rep's own screen lists, so the console and the rep
  // cannot disagree about what "held" means. One query for every rep.
  const now = new Date();
  const queueCounts = await queueCountsFor({ db, repIds: reps.map((r) => r.id), now });

  // ── What each rep is owed, at a glance ──────────────────────────────────
  //
  // The accordion header says this week / owed / paid beside the name, so the
  // owner can see who needs paying without opening a card. Summed from the
  // ledger rows — two queries for the whole team — and never from
  // totalCentsAtClose, for lib/sales/payouts.js's reason.
  const [ledgerEntries, ledgerBatches] = await Promise.all([
    db.salesCommissionEntry.findMany({
      select: { salesRepId: true, amountCents: true, payoutBatchId: true },
    }),
    db.salesPayoutBatch.findMany({ select: { id: true, salesRepId: true, status: true } }),
  ]);
  const entriesByRep = new Map();
  for (const e of ledgerEntries) {
    if (!entriesByRep.has(e.salesRepId)) entriesByRep.set(e.salesRepId, []);
    entriesByRep.get(e.salesRepId).push(e);
  }
  // An agency's figures are the POOL — its own entries and every employee's
  // — because that is what closes into its batch and what it is paid. Each
  // employee's card keeps its own figures beside it, so the owner sees both
  // the team's total and who earned it.
  const employeesOf = new Map();
  for (const r of reps) {
    if (isAgencyEmployee(r, r.manager)) {
      if (!employeesOf.has(r.managerId)) employeesOf.set(r.managerId, []);
      employeesOf.get(r.managerId).push(r.id);
    }
  }
  const moneyFor = (r) => {
    const own = entriesByRep.get(r.id) || [];
    if (!isAgency(r)) return repMoney(own, ledgerBatches);
    const pooled = [...own, ...(employeesOf.get(r.id) || []).flatMap((id) => entriesByRep.get(id) || [])];
    return repMoney(pooled, ledgerBatches);
  };
  // The per-employee results the agency sees on /sales/agency, from the
  // same function, so the two screens cannot disagree about an employee.
  const teamByAgency = new Map();
  for (const r of reps) {
    if (isAgency(r)) teamByAgency.set(r.id, await agencyTeam({ agencyId: r.id, origin: getAppOrigin(request), now: new Date() }));
  }

  // ── The companies each rep brought in, with where their signup came from ─
  //
  // The owner asked for the signup-origin flag to be visible on the rep too:
  // a rep whose link brings accounts from outside CA/US should be visible
  // HERE, where the commission is decided, not only on the origins page.
  // Attributions (one query for the team) joined to their SignupOrigin row;
  // a company that predates origin recording has none and is shown without a
  // chip rather than with an invented "no flag".
  const attributionRows = await db.salesAttribution.findMany({
    where: { salesRepId: { in: reps.map((r) => r.id) } },
    select: {
      salesRepId: true,
      capturedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          country: true,
          signupOrigin: { select: { ipCountry: true, flag: true, flagReason: true, reviewedAt: true } },
          // The signup's state — card, first quote, stalled — read the way
          // the owner's signups screen and the rep's own list read it
          // (lib/signup/leads.js stalledDecision). Informational: a referred
          // signup is this rep's, never assignable from the console.
          createdAt: true,
          isDemo: true,
          subscription: { select: { id: true } },
          trialEndsAt: true,
          quotes: { where: { sentAt: { not: null } }, orderBy: { sentAt: "asc" }, take: 1, select: { sentAt: true } },
        },
      },
    },
    orderBy: { capturedAt: "desc" },
  });
  const companiesByRep = new Map();
  for (const a of attributionRows) {
    if (!companiesByRep.has(a.salesRepId)) companiesByRep.set(a.salesRepId, []);
    const o = a.company?.signupOrigin || null;
    const facts = a.company ? companyFactsOf(a.company) : null;
    const stalled = facts ? stalledDecision({ company: facts, now: new Date(), checkoutGraceMs: CHECKOUT_GRACE_MS }) : { stalled: false, reason: null };
    companiesByRep.get(a.salesRepId).push({
      id: a.company?.id || null,
      name: a.company?.name || null,
      country: a.company?.country || null,
      attributedAt: a.capturedAt,
      signup: facts
        ? {
            kind: stalled.stalled ? "stalled" : "new",
            cardAdded: Boolean(facts.subscription),
            firstQuoteSentAt: facts.firstQuoteSentAt,
            stalledReason: stalled.reason,
            signedUpAt: facts.createdAt,
          }
        : null,
      origin: o
        ? {
            ipCountry: o.ipCountry,
            flag: o.flag,
            flagLabel: SIGNUP_FLAG_LABELS[o.flag] || o.flag,
            flagReason: o.flagReason,
            reviewedAt: o.reviewedAt,
            needsReview: needsReview(o),
          }
        : null,
    });
  }

  // ── Unfinished signups on each rep's link ───────────────────────────────
  //
  // A SignupLead whose `?sales=` code was this rep's and which became their
  // own SalesLead (lib/signup/salesFloor.js "rep_lead"), or is still waiting
  // to. Shown as "referred by {rep}" with the state; never assignable here.
  const referredRows = await db.signupLead.findMany({
    where: { completedCompanyId: null, OR: [{ referredRepId: { in: reps.map((r) => r.id) } }, { salesCode: { in: reps.map((r) => r.code).filter(Boolean) } }] },
    orderBy: { lastSeenAt: "desc" },
    take: 500,
    select: { id: true, companyName: true, firstName: true, lastName: true, phoneE164: true, stepReached: true, lastSeenAt: true, promotedLeadId: true, skipReason: true, referredRepId: true, salesCode: true },
  });
  const repByCode = new Map(reps.map((r) => [r.code, r.id]));
  const referredByRep = new Map();
  for (const l of referredRows) {
    const repId = l.referredRepId || repByCode.get(l.salesCode) || null;
    if (!repId) continue;
    if (!referredByRep.has(repId)) referredByRep.set(repId, []);
    referredByRep.get(repId).push({
      id: l.id,
      name: l.companyName || [l.firstName, l.lastName].filter(Boolean).join(" ") || "—",
      phone: l.phoneE164,
      stepLabel: STEP_LABELS[l.stepReached] || l.stepReached,
      lastSeenAt: l.lastSeenAt,
      state: l.promotedLeadId ? "rep_lead" : l.skipReason ? `skipped:${l.skipReason}` : l.phoneE164 ? "waiting" : "no_phone",
    });
  }

  // FieldQuo's own sales texting number — one, shared, not per rep. See
  // NUMBER_CAPABILITIES for why there is no per-rep picker beside it.
  let salesNumber;
  try {
    const row = await db.platformSmsNumber.findFirst({
      where: { purpose: "sales", active: true },
      orderBy: { createdAt: "asc" },
      select: { e164: true },
    });
    salesNumber = salesNumberState({ e164: row?.e164 || null });
  } catch {
    // "Could not look" is a third state, distinct from "holds none" — reporting
    // a failed query as an empty table would tell a superadmin to go and buy a
    // number they may already own.
    salesNumber = salesNumberState({ lookupFailed: true });
  }

  return NextResponse.json({
    reps: reps.map((r, i) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      workEmail: r.workEmail,
      code: r.code,
      // Built from this deployment's own origin, so a preview hands out a
      // preview link instead of quietly pointing testers at production.
      signupLink: signupLinkFor(origin, r.code),
      kind: r.kind || "rep",
      // For an influencer: the company whose ledger this is, and the link
      // they actually hand out (/refer/<code> — the referee gets their month
      // through it; /signup?sales= would not give them one).
      influencerOf: r.influencerOf?.[0]
        ? {
            companyId: r.influencerOf[0].id,
            companyName: r.influencerOf[0].name,
            referralLink: r.influencerOf[0].referralCode
              ? `${origin}/refer/${r.influencerOf[0].referralCode}`
              : null,
          }
        : null,
      active: r.active,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      endedAt: r.endedAt,
      inviteExpiresAt: r.inviteExpiresAt,
      commissionPlan: r.commissionPlan ? r.commissionPlan.name : null,
      // The id as well as the name. The name alone was all this route returned,
      // which is exactly as far as "display it" goes — a picker needs to know
      // which option is selected, and that was the missing half of why
      // SalesCommissionPlan had a reader and no writer anywhere.
      commissionPlanId: r.commissionPlanId,
      // Selected above and then dropped here on the first cut: the save
      // landed in the database while the screen reloaded to "Not decided
      // yet". A field the select reads and the map forgets is the failure
      // class AGENTS.md lists first, one line lower than usual.
      engagement: r.engagement || null,
      payoutMethod: r.payoutMethod || null,
      payoutHandle: r.payoutHandle || null,
      payoutConfirmedAt: r.payoutConfirmedAt,
      accruesPaidLeave: Boolean(r.accruesPaidLeave),
      // Through sellsInOf so a code dropped from app/i18n/languages.js reads
      // as not ticked here, exactly as allocation reads it.
      sellsIn: sellsInOf(r),
      companyCount: r._count.attributions,
      // Each attributed company with its signup-origin chip. See above.
      companies: companiesByRep.get(r.id) || [],
      // Started on this rep's link, not finished — theirs, with the state.
      referredSignups: referredByRep.get(r.id) || [],
      flaggedSignups: (companiesByRep.get(r.id) || []).filter((c) => c.origin?.needsReview).length,
      // held = leased + worked; untouched + dialled = leased. openLeads are
      // SalesLeads not converted and not lost. See lib/sales/reassign.js.
      queue: queueCounts.get(r.id) || null,
      money: moneyFor(r),
      // The rep's OWN ledger, counted: how many entries are not yet closed
      // into a batch (the open payout week that refuses a payee change —
      // lib/sales/repEngagement.js) and how many exist at all (the ledger
      // that refuses converting the row into an agency). Counts, not sums:
      // a week whose earning and reversal net to $0 still has two entries
      // that would move to the wrong payee.
      ledger: {
        openEntries: (entriesByRep.get(r.id) || []).filter((e) => !e.payoutBatchId).length,
        entries: (entriesByRep.get(r.id) || []).length,
      },
      // The agency tier. `agency` names the call centre an employee works
      // for; `needsSetup` is the owner's flag while a number or the work
      // mailbox is still missing; `team` is the agency's own view of its
      // employees, so the owner reads exactly what the agency reads.
      agency: isAgencyEmployee(r, r.manager) ? { id: r.manager.id, name: r.manager.name } : null,
      setupRequestedAt: r.setupRequestedAt || null,
      // The calling window is not applied to this rep's dials; every one is
      // a test and counted nowhere. The card's toggle reads and writes it.
      testAccount: r.testAccount === true,
      canCallColleagues: r.canCallColleagues !== false,
      canCallOffCampaign: r.canCallOffCampaign === true,
      hasNumber: (r._count?.phoneNumbers || 0) > 0,
      needsSetup: Boolean(r.setupRequestedAt) && !setupComplete({ workEmail: r.workEmail, numberCount: r._count?.phoneNumbers }),
      team: teamByAgency.get(r.id) || null,
      sending: {
        canSend: sending[i].canSend,
        blockers: sending[i].blockers,
        warnings: sending[i].warnings,
      },
      // The connected work mailbox, in its public shape — connected / last
      // sync / last error, in words. Never the secret
      // (lib/sales/mailbox/store.js's MAILBOX_PUBLIC_SELECT is the whole
      // select). Null when the owner has not connected one.
      mailbox: mailboxes.get(r.id) || null,
    })),
    salesNumber,
    numberCapabilities: NUMBER_CAPABILITIES,
    plans,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const wantedCode = String(body.code || "").toLowerCase().trim();
  // Optional at creation, and that is the sequence of events rather than
  // laxity: a mailbox is bought, so the owner adds a rep on Monday and the
  // inbox exists on Thursday. What must not happen is the gap being silent —
  // outreachStatus() blocks every send while it is absent and the screen says
  // so in those words.
  const workEmail = normaliseWorkEmail(body.workEmail);

  if (!name || !email) {
    return NextResponse.json(
      { error: "A name and an email address are required" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That doesn't look like an email address" },
      { status: 400 },
    );
  }
  // Both problems come from lib/sales/repAdmin.js so the sentence the field
  // goes red with on the screen is literally the sentence the server refuses
  // with. A field validated twice with two wordings is two rules pretending to
  // be one.
  const badCode = codeProblem(wantedCode);
  if (badCode) return NextResponse.json({ error: badCode }, { status: 400 });

  const badMailbox = workEmailProblem(workEmail, email);
  if (badMailbox) return NextResponse.json({ error: badMailbox }, { status: 400 });

  // ── The type ────────────────────────────────────────────────────────────
  //
  // "rep" (the default) or "agency" — a call-centre account that adds its own
  // reps and is paid for what they earn (lib/sales/agency.js). An agency has
  // no engagement of its own: it is a business FieldQuo pays by invoice, not
  // a freelancer or an employee, and the column is the employees'. Its plan
  // is REQUIRED, because every employee it adds inherits it and an agency
  // whose reps all earn $0 is the failure the plan sentence below describes,
  // multiplied by the team.
  const kind = body.kind === undefined || body.kind === null || body.kind === "" ? "rep" : String(body.kind);
  if (kind !== "rep" && kind !== AGENCY_KIND) {
    return NextResponse.json({ error: `kind must be "rep" or "${AGENCY_KIND}".` }, { status: 400 });
  }

  const engagement =
    body.engagement === undefined || body.engagement === null || body.engagement === ""
      ? null
      : String(body.engagement);
  if (engagement !== null && !isEngagement(engagement)) {
    return NextResponse.json(
      { error: `engagement must be one of ${ENGAGEMENTS.map((e) => e.key).join(", ")}, or left unset.` },
      { status: 400 },
    );
  }
  if (kind === AGENCY_KIND && engagement !== null) {
    return NextResponse.json(
      { error: "An agency has no engagement of its own — freelancer or employee is a fact about a person. Leave it unset." },
      { status: 400 },
    );
  }
  if (engagement === "agency") {
    return NextResponse.json(
      { error: "\"Agency employee\" is set by the agency adding the rep from its own portal, never here. Add the agency, and it adds its people." },
      { status: 400 },
    );
  }

  // The plan, at creation. Optional in the same sense the work mailbox is —
  // a rep can exist before the terms are settled — but the consequence is
  // sharper and the screen says it in those words: until one is assigned, every
  // milestone this rep reaches writes NO ledger row at all, so they earn
  // nothing and there is no trace afterwards that they should have.
  const assignment = await resolvePlanAssignment({
    db,
    planId: body.commissionPlanId ?? null,
  });
  if (assignment.error) {
    return NextResponse.json({ error: assignment.error }, { status: 400 });
  }
  if (kind === AGENCY_KIND && !assignment.commissionPlanId) {
    return NextResponse.json(
      { error: "An agency needs a commission plan: every rep it adds earns under it, and without one the whole team earns $0." },
      { status: 400 },
    );
  }

  const existing = await db.salesRep.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A sales rep with that email already exists" },
      { status: 409 },
    );
  }

  if (workEmail) {
    // @unique, and a collision here is not a race worth retrying past: two reps
    // sharing an outbound mailbox means either one's replies land in a thread
    // attributed to the other.
    const mailboxTaken = await db.salesRep.findUnique({ where: { workEmail } });
    if (mailboxTaken) {
      return NextResponse.json(
        { error: `${workEmail} is already another rep's work mailbox.` },
        { status: 409 },
      );
    }
  }

  // The code is @unique. Rather than a read-then-write that two concurrent
  // superadmins can both walk through, this lets the constraint decide and
  // retries with a suffix — the same reasoning lib/voice/credits.js gives for
  // preferring an index over a check.
  //
  // The candidate sequence comes from lib/sales/repAdmin.js because the SCREEN
  // uses the same function to prefill the field. Two implementations of "what
  // is the next free code" would show the admin `dana-2` and store `dana-3`,
  // and the difference would be invisible until somebody printed a card.
  const candidates = wantedCode ? [wantedCode] : codeCandidates(name);
  const { token, hash } = newInviteToken();

  let rep = null;
  let lastError = null;
  for (const code of candidates) {
    if (rep) break;
    try {
      rep = await db.salesRep.create({
        data: {
          kind,
          // Stated at set-up when the superadmin knows it; null otherwise, and
          // the Pay screen keeps saying so until somebody says.
          engagement,
          name,
          email,
          workEmail,
          code,
          commissionPlanId: assignment.commissionPlanId,
          inviteTokenHash: hash,
          inviteExpiresAt: inviteExpiry(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          workEmail: true,
          code: true,
          active: true,
          kind: true,
          commissionPlanId: true,
        },
      });
    } catch (err) {
      lastError = err;
      // P2002 is a unique-constraint collision. Any other failure is not
      // something a different code would fix, so it stops here rather than
      // retrying four more times into the same wall.
      if (err?.code !== "P2002") break;
      // A collision on `email` cannot be fixed by a suffix either — but the
      // findUnique above already answered that, so a P2002 at this point is a
      // code race. If it turns out to be the email after all, the loop exits
      // on the last attempt and the error is reported.
      if (wantedCode) break;
    }
  }

  if (!rep) {
    // `meta.target` names the constraint that fired. Reporting "that code is
    // taken" over a work-mailbox collision would send a superadmin to change
    // the wrong field, which is the sort of wrong-but-plausible error message
    // that costs ten minutes every time.
    const target = String(lastError?.meta?.target || "");
    const taken =
      lastError?.code !== "P2002"
        ? "Couldn't create the sales rep."
        : target.includes("workEmail")
          ? "That work mailbox is already assigned to another rep."
          : "That code is already taken — choose another.";
    return NextResponse.json({ error: taken }, { status: 409 });
  }

  // The send outcome is reported, never assumed. lib/email/teamInvite.js's
  // header is the story of an invite that looked sent from every angle except
  // the recipient's inbox; the rep row exists either way, and the screen offers
  // "Resend invite" rather than a green tick over nothing.
  // getCurrentPlatformAdmin returns { id, role } off the JWT and no address, so
  // the inviter's email is looked up rather than left out: "somebody at
  // FieldQuo added you" with no name attached is exactly the shape of email
  // people delete.
  const inviter = await db.platformAdmin.findUnique({
    where: { id: admin.id },
    select: { email: true },
  });

  const outcome = await sendSalesInviteEmail({
    request,
    to: rep.email,
    name: rep.name,
    token,
    inviterEmail: inviter?.email,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_rep_invited",
      details: {
        salesRepId: rep.id,
        email: rep.email,
        code: rep.code,
        kind: rep.kind,
        // Recorded because it decides who a prospect ends up talking to, and
        // because "who assigned this mailbox" is the question asked after a
        // reply lands in the wrong inbox.
        workEmail: rep.workEmail || null,
        // What this rep will be paid, recorded at the moment they were hired.
        // Null is the answer that matters: it means every milestone they reach
        // writes nothing until somebody assigns a plan.
        commissionPlanId: rep.commissionPlanId || null,
        codeSource: wantedCode ? "chosen_by_admin" : "generated",
        emailSent: outcome.sent,
        ...(outcome.error ? { emailError: outcome.error } : {}),
      },
    },
  });

  return NextResponse.json(
    {
      ...rep,
      // Returned with the row so the screen can show the link the moment the
      // rep exists, rather than after a refetch — the link IS the rep's job.
      signupLink: signupLinkFor(getAppOrigin(request), rep.code),
      invite: { sent: outcome.sent, error: outcome.error || null },
    },
    { status: 201 },
  );
}
