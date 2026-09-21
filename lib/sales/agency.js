// lib/sales/agency.js
//
// The call-centre agency: a third kind of seller beside FieldQuo's own reps
// and freelancers.
//
// ══ The owner's words (2026-09-16) ═════════════════════════════════════════
//
// "I need to hire an agency. There is the admin employee (hiring the agency);
// they have the ability to add their team as sales reps so that they can call.
// The reps they add cannot see their payout because we are paying the agency
// itself. Any sales rep linked to them will have the signed-up company under
// the agency. Each rep under that agency should still have their unique links
// so that we are able to determine who are the best salespeople; all of those
// call-centre employees' earnings are pooled into that call-centre account.
// The call centre should be able to see their payout, combined, and in the
// breakdown by employee. They can add employees as needed, however I am
// flagged so that these reps can have a phone number and work email. I should
// see the results of each employee the same way the agency does, and they
// should see their version of the sales floor — only for their team. They
// cannot select what type of employee: any rep they create is an employee of
// their agency."
//
// ══ How it maps onto what exists ══════════════════════════════════════════
//
// The agency is a SalesRep of kind "agency" — it signs into /sales like any
// rep, so the gates, the presence ledger and the team chat already work for
// it. Its employees are ordinary "rep" rows whose `managerId` is the agency
// (the reporting line lib/sales/team.js scoped for on 2026-09-03 and nothing
// filled in until now) and whose engagement is "agency". Attribution and
// commission are UNCHANGED: a signup through an employee's link writes the
// employee's SalesAttribution and the employee's SalesCommissionEntry rows —
// that is what makes "who are the best salespeople" answerable. Only the
// PAYEE changes: closeWeekForRep gathers every employee's entries into one
// batch under the agency (payeeIdFor), so the agency's /sales/pay shows the
// pooled total and a per-employee breakdown, and an employee's /sales/pay is
// refused with a sentence saying who is paid.
//
// The platform keeps what the owner keeps: numbers and work mailboxes. An
// agency adding a rep stamps `setupRequestedAt`, /platform/sales/reps lists
// the row as needing both, and the error log carries a line so it is seen.

//
// ══ What an agency may write, and what it may not ═════════════════════════
//
// lib/sales/gate.js's REP_FORBIDDEN_WRITES puts SalesRep on the list a rep's
// identity may never write, and it is right: a rep who can write their own
// row can reactivate themselves or move onto a richer plan. An agency writes
// SalesRep rows — but never its OWN, and never the columns that list exists
// to protect on anybody's. Every write here is one of:
//
//   create   an employee: kind "rep", engagement "agency", managerId the
//            agency, commissionPlanId the agency's own. The agency chooses
//            the name, the email and the languages. It cannot choose a plan
//            (its employees earn under the terms the owner agreed with it),
//            a kind, or a manager — those are forced, and the check script
//            asserts the forced values against the recorded write.
//   update   `active` / `endedAt` on an employee, through the same
//            lib/sales/repActivation.js the platform uses, with the same
//            hand-off gate. Reactivating one's own employee is not the
//            escalation the list guards against — the employee's pay goes to
//            the agency either way.
//   update   the invite token on an employee who has not accepted yet.
//   update   `setupRequestedAt: null`, by the PLATFORM's routes, when the
//            number and the mailbox are both there.
//
// What no function here does: touch commissionPlanId, engagement, kind or
// managerId on an existing row; touch the agency's own row; touch any row
// whose managerId is not the agency (every WHERE names both the id and the
// manager, read fresh). scripts/check-sales-agency.mjs executes each of
// those refusals; scripts/check-sales-auth.mjs declares this file's writes.

import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { balanceCents } from "@/lib/sales/commission";
import { earningsView } from "@/lib/sales/earnings";
import { inviteExpiry, newInviteToken } from "@/lib/sales/invite";
import { sendSalesInviteEmail } from "@/lib/sales/inviteEmail";
import { codeCandidates } from "@/lib/sales/repAdmin";
import { activationAuditRows, changeRepActive } from "@/lib/sales/repActivation";
import { bucketSignups, signupLinkFor } from "@/lib/sales/repStats";
import { prospectDialsOnly } from "@/lib/sales/testLines";

export { AGENCY_KIND, AGENCY_ENGAGEMENT, agencyOf } from "./agencyLabel";
import { AGENCY_KIND, AGENCY_ENGAGEMENT } from "./agencyLabel";

/** True for the agency account itself. */
export function isAgency(rep) {
  return Boolean(rep) && rep.kind === AGENCY_KIND;
}

/**
 * True for a rep who works for an agency: engagement "agency" AND a manager.
 * Both, because either alone is a half-configured row — a manager who is not
 * an agency is a team lead (lib/sales/team.js), and an "agency" engagement
 * with no manager has nobody to pay.
 */
export function isAgencyEmployee(rep, manager = rep?.manager) {
  return Boolean(rep) && rep.engagement === AGENCY_ENGAGEMENT && Boolean(rep.managerId) && isAgency(manager);
}

/**
 * Who a rep's commission is PAID to: the agency for its employees, the rep
 * for everyone else. Pure; callers pass the manager row they read.
 */
export function payeeIdFor(rep, manager = rep?.manager) {
  if (!rep?.id) return null;
  return isAgencyEmployee(rep, manager) ? rep.managerId : rep.id;
}

/** Whether this rep may open /sales/pay and the payout routes. */
export function canSeeOwnPay(rep, manager = rep?.manager) {
  return !isAgencyEmployee(rep, manager);
}

/**
 * The agency's team — its employees' ids, read fresh. Empty for anyone who
 * is not an agency, which is what makes it safe to spread into a WHERE.
 */
export async function agencyTeamIds(agencyId, client = db) {
  if (!agencyId) return [];
  const rows = await client.salesRep.findMany({
    where: { managerId: agencyId, engagement: AGENCY_ENGAGEMENT },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Group every rep by payee, for the weekly close: an agency and its employees
 * become one entry keyed by the agency; everyone else is their own.
 * @returns Map<payeeId, string[] repIds>
 */
export function payeeGroups(reps) {
  const byId = new Map(reps.map((r) => [r.id, r]));
  const groups = new Map();
  for (const rep of reps) {
    const payee = payeeIdFor(rep, rep.managerId ? byId.get(rep.managerId) : null);
    if (!payee) continue;
    if (!groups.has(payee)) groups.set(payee, []);
    groups.get(payee).push(rep.id);
  }
  // The agency's own id is in its group too (it may earn on its own link).
  return groups;
}

/**
 * An agency adds one of its employees. Same row shape the platform's invite
 * makes, with three things the agency may NOT choose: the kind (rep), the
 * engagement (agency), and the manager (itself). The commission plan is the
 * agency's own, so every employee earns under the terms the owner agreed with
 * the agency. Number and work mailbox are left for the platform.
 */
export async function createAgencyRep({ agency, name, email, sellsIn = null, language = null, request = null, client = db }) {
  if (!isAgency(agency)) return { ok: false, status: 403, error: "Only an agency account can add agency reps." };
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").toLowerCase().trim();
  if (!cleanName || !cleanEmail) return { ok: false, status: 400, error: "A name and an email address are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { ok: false, status: 400, error: "That doesn't look like an email address." };
  const taken = await client.salesRep.findUnique({ where: { email: cleanEmail }, select: { id: true } });
  if (taken) return { ok: false, status: 409, error: "A sales rep with that email already exists." };

  const { token, hash } = newInviteToken();
  let rep = null;
  for (const code of codeCandidates(cleanName)) {
    try {
      rep = await client.salesRep.create({
        data: {
          kind: "rep",
          engagement: AGENCY_ENGAGEMENT,
          managerId: agency.id,
          commissionPlanId: agency.commissionPlanId || null,
          name: cleanName,
          email: cleanEmail,
          code,
          ...(Array.isArray(sellsIn) && sellsIn.length ? { sellsIn } : {}),
          ...(language ? { language } : {}),
          setupRequestedAt: new Date(),
          inviteTokenHash: hash,
          inviteExpiresAt: inviteExpiry(),
        },
        select: { id: true, name: true, email: true, code: true, active: true, managerId: true, engagement: true, setupRequestedAt: true },
      });
      break;
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }
  }
  if (!rep) return { ok: false, status: 409, error: "Could not find a free code for that name." };

  const outcome = await sendSalesInviteEmail({ request, to: rep.email, name: rep.name, token, inviterEmail: agency.email }).catch((err) => ({ sent: false, error: err?.message }));
  await agencyAudit({
    agency,
    action: "sales_rep_invited",
    details: { salesRepId: rep.id, email: rep.email, code: rep.code, commissionPlanId: agency.commissionPlanId || null, emailSent: outcome.sent, ...(outcome.error ? { emailError: outcome.error } : {}) },
    client,
  });
  // The owner's flag: a number and a work mailbox are the platform's to give.
  await recordError({
    area: "sales",
    code: "agency_rep_needs_setup",
    message: `${agency.name} added ${rep.name} (${rep.email}) to their agency. Assign a phone number and a work mailbox on /platform/sales/reps.`,
    detail: { agencyId: agency.id, salesRepId: rep.id, inviteSent: outcome.sent },
  }).catch(() => {});
  return { ok: true, rep, inviteSent: outcome.sent, inviteError: outcome.error || null };
}

/**
 * The refusal an agency's employee meets on the pay routes and the Pay
 * screen, or null for everyone else. Names the agency, because "you cannot
 * see this" with no reason is the sentence that generates a support ticket;
 * "your commission is paid to Northline Contact" answers the question.
 *
 * `errorKey` travels beside the English so the screen can say it in the
 * rep's own language (app/i18n/appMessages.js).
 */
export function agencyEmployeeRefusal(rep, manager = rep?.manager) {
  if (!isAgencyEmployee(rep, manager)) return null;
  const name = manager?.name || "your agency";
  return {
    status: 403,
    body: {
      error: `Your commission is paid to ${name}; ask them about pay.`,
      code: "agency_employee",
      errorKey: "app.salesPay.agencyEmployeeRefusal",
      agency: { id: manager?.id || rep.managerId, name },
    },
  };
}

/**
 * "Dana Kovalenko (Northline Contact)" for a rep with an agency manager;
 * the bare name otherwise. Pure — the caller passes the manager it read.
 */
export function repDisplayName(rep, manager = rep?.manager) {
  const name = rep?.name || rep?.email || "";
  return isAgencyEmployee(rep, manager) ? `${name} (${manager.name})` : name;
}

/**
 * Whether an employee's set-up is done: a work mailbox AND an active sales
 * number. Pure over the row shape the readers below select.
 */
export function setupComplete(rep) {
  return Boolean(rep?.workEmail) && Number(rep?.numberCount ?? rep?._count?.phoneNumbers ?? 0) > 0;
}

/**
 * Clear `setupRequestedAt` once both the number and the mailbox are there.
 *
 * Called by the two platform routes that give either — the mailbox PATCH and
 * the number assignment — AFTER their write, and it re-reads the row rather
 * than trusting the caller's picture: the other half may have arrived from a
 * different screen a minute ago. Returns true when the flag was cleared.
 */
export async function clearSetupIfComplete(salesRepId, client = db) {
  if (!salesRepId) return false;
  const rep = await client.salesRep.findUnique({
    where: { id: salesRepId },
    select: { id: true, workEmail: true, setupRequestedAt: true, _count: { select: { phoneNumbers: true } } },
  });
  if (!rep?.setupRequestedAt || !setupComplete(rep)) return false;
  await client.salesRep.updateMany({
    where: { id: salesRepId, setupRequestedAt: { not: null } },
    data: { setupRequestedAt: null },
  });
  return true;
}

/** The UTC day and Monday-week containing `now` — the floor board's clock. */
function dayStartUtc(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The agency's team as its screen lists it — and as the platform lists it
 * under the agency, from the same function, so the owner "sees the results
 * of each employee the same way the agency does".
 *
 * Per employee: the row, the invite state, whether a number and a mailbox
 * are there, calls today and this week, signups today/week/total, and what
 * their link has earned (lifetime, and not yet closed). Counted from the
 * rows, never from a counter — lib/sales/repStats.js's argument.
 *
 * `callsToday` is null, not 0, when the call tables are absent: absence of a
 * count is not a count.
 */
export async function agencyTeam({ agencyId, origin = null, now = new Date(), client = db } = {}) {
  if (!agencyId) return [];
  const reps = await client.salesRep.findMany({
    where: { managerId: agencyId, engagement: AGENCY_ENGAGEMENT },
    select: {
      id: true,
      name: true,
      email: true,
      workEmail: true,
      code: true,
      active: true,
      endedAt: true,
      invitedAt: true,
      acceptedAt: true,
      inviteExpiresAt: true,
      sellsIn: true,
      language: true,
      setupRequestedAt: true,
      lastSeenAt: true,
      _count: { select: { phoneNumbers: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  if (!reps.length) return [];
  const ids = reps.map((r) => r.id);
  const dayStart = dayStartUtc(now);
  const weekStart = bucketSignups([], now).weekStartsAt;

  const callsReady = Boolean(client?.salesCallAttempt);
  const [attributions, entries, calls] = await Promise.all([
    client.salesAttribution.findMany({ where: { salesRepId: { in: ids } }, select: { salesRepId: true, capturedAt: true } }),
    client.salesCommissionEntry.findMany({
      where: { salesRepId: { in: ids } },
      select: { salesRepId: true, amountCents: true, payoutBatchId: true },
    }),
    callsReady
      ? client.salesCallAttempt.findMany({
          // A dial to one of our own test lines is not a week's work.
          where: prospectDialsOnly({ salesRepId: { in: ids }, direction: "out", dialledAt: { gte: weekStart } }),
          select: { salesRepId: true, dialledAt: true },
        })
      : Promise.resolve(null),
  ]);

  const by = (rows) => {
    const m = new Map();
    for (const r of rows || []) {
      if (!m.has(r.salesRepId)) m.set(r.salesRepId, []);
      m.get(r.salesRepId).push(r);
    }
    return m;
  };
  const attrBy = by(attributions);
  const entryBy = by(entries);
  const callBy = by(calls);

  return reps.map((r) => {
    const signups = bucketSignups((attrBy.get(r.id) || []).map((a) => a.capturedAt), now);
    const own = entryBy.get(r.id) || [];
    const mine = callBy.get(r.id) || null;
    const inviteState = r.acceptedAt
      ? "accepted"
      : r.inviteExpiresAt && new Date(r.inviteExpiresAt) < now
        ? "expired"
        : "pending";
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      code: r.code,
      signupLink: signupLinkFor(origin, r.code),
      active: r.active,
      endedAt: r.endedAt,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      inviteState,
      sellsIn: Array.isArray(r.sellsIn) ? r.sellsIn : [],
      language: r.language || null,
      lastSeenAt: r.lastSeenAt || null,
      hasWorkEmail: Boolean(r.workEmail),
      hasNumber: (r._count?.phoneNumbers || 0) > 0,
      setupRequestedAt: r.setupRequestedAt || null,
      // Both must be there for the flag to come off; the screen names the
      // missing one rather than saying "not set up".
      needsSetup: Boolean(r.setupRequestedAt) && !setupComplete({ workEmail: r.workEmail, numberCount: r._count?.phoneNumbers }),
      calls: callsReady
        ? {
            today: mine ? mine.filter((c) => new Date(c.dialledAt) >= dayStart).length : 0,
            thisWeek: mine ? mine.length : 0,
          }
        : null,
      signups: { today: signups.today, thisWeek: signups.thisWeek, total: signups.total },
      earned: {
        lifetimeCents: balanceCents(own),
        openCents: balanceCents(own.filter((e) => !e.payoutBatchId)),
      },
    };
  });
}

/**
 * The agency's pay screen: every employee's entries and its own, pooled,
 * the batches under its own id, and the split by employee.
 *
 * The pooled view is lib/sales/earnings.js's earningsView over the union —
 * the same function a rep's screen uses, so a company's ladder and a week's
 * lines read identically. `byEmployee` is the owner's "breakdown by
 * employee": lifetime, paid, awaiting and open, each summed from the same
 * rows the totals came from, so the table's column always adds up to the
 * figure above it.
 */
export async function agencyEarnings({ agency, client = db } = {}) {
  if (!isAgency(agency)) return null;
  const teamIds = await agencyTeamIds(agency.id, client);
  const earnerIds = [agency.id, ...teamIds];
  const [entries, batches, reps] = await Promise.all([
    client.salesCommissionEntry.findMany({
      where: { salesRepId: { in: earnerIds } },
      select: {
        id: true,
        salesRepId: true,
        companyId: true,
        milestone: true,
        amountCents: true,
        status: true,
        occurredAt: true,
        payoutBatchId: true,
        company: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    client.salesPayoutBatch.findMany({
      where: { salesRepId: agency.id },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        paidAt: true,
        totalCentsAtClose: true,
        paidVia: true,
        paymentReference: true,
        paymentNote: true,
        proofUrl: true,
        proofFilename: true,
      },
      orderBy: { periodStart: "desc" },
    }),
    client.salesRep.findMany({ where: { id: { in: earnerIds } }, select: { id: true, name: true, active: true } }),
  ]);
  const flat = entries.map(({ company, ...e }) => ({ ...e, companyName: company?.name || null }));
  const view = earningsView({ entries: flat, batches });
  const statusOf = new Map(batches.map((b) => [b.id, b.status]));
  const names = new Map(reps.map((r) => [r.id, r]));
  const byEmployee = earnerIds
    .map((id) => {
      const own = flat.filter((e) => e.salesRepId === id);
      return {
        salesRepId: id,
        name: names.get(id)?.name || null,
        active: names.get(id)?.active ?? null,
        isAgency: id === agency.id,
        earnedCents: balanceCents(own),
        paidCents: balanceCents(own.filter((e) => e.payoutBatchId && statusOf.get(e.payoutBatchId) === "paid")),
        awaitingCents: balanceCents(own.filter((e) => e.payoutBatchId && statusOf.get(e.payoutBatchId) !== "paid")),
        openCents: balanceCents(own.filter((e) => !e.payoutBatchId)),
        signups: new Set(own.map((e) => e.companyId)).size,
      };
    })
    // The agency's own line only when it earned something on its own link —
    // an agency that only manages has no row to read as "you earned $0".
    .filter((row) => !row.isAgency || row.earnedCents !== 0 || row.openCents !== 0)
    .sort((a, b) => b.earnedCents - a.earnedCents);
  return { ...view, byEmployee, teamIds };
}

/** Write one audit row with the agency as the actor. Never throws. */
async function agencyAudit({ agency, action, details, client = db }) {
  try {
    await client.platformAuditLog.create({
      data: { actorSalesRepId: agency.id, action, details: { ...details, actorAgency: agency.name, actorAgencyId: agency.id } },
    });
  } catch (err) {
    console.error("[sales agency] could not write the audit row:", err?.message);
  }
}

/**
 * The employee this agency is about to act on — or the refusal. Read fresh,
 * scoped on BOTH the id and the manager: an id the agency guessed for
 * somebody else's rep answers "not on your team", never a row.
 */
export async function agencyEmployee({ agency, salesRepId, client = db } = {}) {
  if (!isAgency(agency)) return { rep: null, refusal: { status: 403, body: { error: "Only an agency account can manage agency reps." } } };
  if (!salesRepId) return { rep: null, refusal: { status: 400, body: { error: "Say which rep." } } };
  const rep = await client.salesRep.findFirst({
    where: { id: salesRepId, managerId: agency.id, engagement: AGENCY_ENGAGEMENT },
    select: { id: true, name: true, email: true, active: true, endedAt: true, acceptedAt: true, sellsIn: true, kind: true },
  });
  if (!rep) return { rep: null, refusal: { status: 404, body: { error: "That rep is not on your team." } } };
  return { rep, refusal: null };
}

/**
 * Deactivate or reactivate one of the agency's employees.
 *
 * Same gate, same hand-off shapes and same refusals as the platform's
 * button (lib/sales/repActivation.js) — with one narrowing: work may only
 * MOVE to another rep on the same team. Handing an employee's leads to a
 * FieldQuo rep is a routing act outside the agency's line.
 */
export async function setAgencyRepActive({ agency, salesRepId, active, handoff = null, now = new Date(), client = db } = {}) {
  const { rep, refusal } = await agencyEmployee({ agency, salesRepId, client });
  if (refusal) return { ok: false, ...refusal.body, status: refusal.status };
  if (typeof active !== "boolean") return { ok: false, status: 400, error: "active must be true or false" };
  if (active === rep.active) {
    return { ok: true, unchanged: true, rep };
  }
  const flip = await changeRepActive({
    db: client,
    existing: rep,
    active,
    handoff,
    now,
    canMoveTo: (target) =>
      target.managerId === agency.id && target.engagement === AGENCY_ENGAGEMENT
        ? null
        : "Work can only be moved to another rep on your own team.",
  });
  if (!flip.ok) return flip;
  const rows = activationAuditRows({ updated: flip.updated, handled: flip.handled, toRep: flip.toRep, gateCounts: flip.gateCounts, active });
  for (const row of rows) await agencyAudit({ agency, ...row, client });
  return { ok: true, rep: flip.updated, handoff: flip.handled };
}

/**
 * Re-send an employee's invitation. The same three refusals as the
 * platform's route, for the same reasons: an accepted rep already has a way
 * in; a deactivated one is reactivated first.
 */
export async function reinviteAgencyRep({ agency, salesRepId, request = null, client = db } = {}) {
  const { rep, refusal } = await agencyEmployee({ agency, salesRepId, client });
  if (refusal) return { ok: false, ...refusal.body, status: refusal.status };
  if (rep.acceptedAt) {
    return { ok: false, status: 409, error: "This rep has already set a password. Re-inviting would hand out a way in beside the one they already have." };
  }
  if (!rep.active || rep.endedAt) {
    return { ok: false, status: 409, error: "This rep is deactivated. Reactivate them first." };
  }
  const { token, hash } = newInviteToken();
  await client.salesRep.updateMany({
    where: { id: rep.id, managerId: agency.id, engagement: AGENCY_ENGAGEMENT },
    data: { inviteTokenHash: hash, inviteExpiresAt: inviteExpiry(), invitedAt: new Date() },
  });
  const outcome = await sendSalesInviteEmail({ request, to: rep.email, name: rep.name, token, inviterEmail: agency.email }).catch((err) => ({ sent: false, error: err?.message }));
  await agencyAudit({
    agency,
    action: "sales_rep_reinvited",
    details: { salesRepId: rep.id, email: rep.email, emailSent: outcome.sent, ...(outcome.error ? { emailError: outcome.error } : {}) },
    client,
  });
  if (!outcome.sent) {
    return { ok: false, status: 502, error: `The invitation was re-issued but the email didn't go out: ${outcome.error || "no reason given"}` };
  }
  return { ok: true, sent: true };
}
