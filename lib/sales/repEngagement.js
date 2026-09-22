// lib/sales/repEngagement.js
//
// Moving an existing rep between FieldQuo employee, freelancer and "works for
// an agency" — and turning a rep row into an agency account — from the
// platform console.
//
// ══ The owner's words (2026-09-17) ═════════════════════════════════════════
//
// "In here [the rep card] I should be able to select agency too besides
// freelancer or employee — and how do I link an existing account to an agency
// in case the account was created before the agency? I think some of those
// things are missing. How do I handle that from /platform."
//
// ══ Why this is a payee change and not a label ═════════════════════════════
//
// lib/sales/agency.js: an agency employee is `engagement: "agency"` AND
// `managerId` = the agency, and the one thing that changes for them is WHO IS
// PAID. closeWeekForRep gathers every employee's unbatched entries into the
// agency's batch (lib/sales/payouts.js), so the payee of an entry is decided
// at the moment the week CLOSES, from the rows as they stand then — never
// from who the payee was when the entry was earned. Three consequences the
// decisions below are built on:
//
//   1. Entries already in a batch are untouched by anything here. The batch
//      is under whoever was the payee when it closed, and stays there.
//   2. Entries keep their salesRepId whatever happens. "Who earned it" is
//      never rewritten — that is what keeps "who are the best salespeople"
//      answerable after a rep moves.
//   3. An entry with no batch yet would be paid to whoever is the payee at
//      the next close. So changing the payee while the rep has unbatched
//      entries moves money earned under one arrangement to the other party
//      — an open week split between two payees. That change is REFUSED,
//      with the count and the sum, until the week is closed (Monday's cron,
//      app/api/cron/sales-payouts). The owner asked for exactly this refusal.
//
// A change that does not move the payee (freelancer → employee) never meets
// the refusal: no money changes hands.
//
// ══ Converting a rep row into an agency ═══════════════════════════════════
//
// Allowed only for a row that is still a blank slate in every sense the
// ledger cares about: kind "rep", no commission entry ever, no payout batch,
// nobody reporting to it, not reporting to anyone, and a payout method an
// agency may use. The rep's attributions stay (an agency earns on its own
// link too). Anything else is refused in words; the owner can create a fresh
// agency instead. The reverse (agency → rep) is not offered: an agency with
// a team has employees to re-home first, and that is a decision per person.
//
// Pure functions here take rows the caller has read fresh. The one that
// talks to the database, resolveEngagementChange, reads the agency and the
// rep's unbatched entries at the moment of the request and hands the
// decision to the pure function — the same fresh-read rule lib/migrations/
// state.js follows. scripts/check-sales-agency.mjs executes every refusal.

import { db } from "@/lib/db";
import { AGENCY_ENGAGEMENT, AGENCY_KIND } from "./agencyLabel";
import { isAgency, isAgencyEmployee, payeeIdFor, setupComplete } from "./agency";
import { balanceCents } from "./commission";
import { ENGAGEMENTS, isEngagement, isPayoutMethodFor } from "./payoutDetails";
import { INFLUENCER_KIND } from "@/lib/influencers";

const dollars = (cents) => `$${(Math.abs(Number(cents) || 0) / 100).toFixed(2)}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The refusal an open payout week produces, or null when the change is
 * clean. `openEntries` are the rep's entries with no batch, read fresh.
 * Pure, so the sentence can be checked against a reversal-only week (a
 * negative sum is still money that would move) and an empty one.
 */
export function openWeekRefusal({ rep, openEntries, payeeFromName, payeeToName }) {
  const rows = Array.isArray(openEntries) ? openEntries : [];
  if (!rows.length) return null;
  const sum = balanceCents(rows);
  return {
    status: 409,
    code: "open_payout_week",
    error:
      `${rep?.name || "This rep"} has ${plural(rows.length, "commission entry", "commission entries")} (${sum < 0 ? "−" : ""}${dollars(sum)}) ` +
      `earned but not yet closed into a payout batch. Changing who is paid now would send them to ${payeeToName} ` +
      `at the next weekly close, although they were earned while ${payeeFromName} was the payee. ` +
      `Wait for Monday's close and change it then.`,
    counts: { openEntries: rows.length, openCents: sum },
  };
}

/**
 * Decide the write for an engagement change on an existing rep.
 *
 * @param existing  the rep row: { id, name, kind, engagement, managerId,
 *                  commissionPlanId, payoutMethod, workEmail, _count.phoneNumbers,
 *                  manager: { id, kind, name } | null }
 * @param engagement null | "freelancer" | "employee" | "agency"
 * @param agency    for "agency": the agency row read FRESH by id — { id,
 *                  kind, name, active, commissionPlanId } — or null when
 *                  none was found
 * @param agencyId  what the request named, so a missing row is "no agency
 *                  with that id" rather than "say which agency"
 * @param openEntries the rep's unbatched entries, read fresh
 * @param now
 * @returns { ok: true, unchanged: true } when nothing would change;
 *          { ok: true, data, audit, flagSetup, payee: { from, to } } for a write;
 *          { ok: false, status, error, code?, counts? } for a refusal.
 */
export function engagementTransition({ existing, engagement, agency = null, agencyId = null, openEntries = [], now = new Date() }) {
  if (!existing?.id) return { ok: false, status: 404, error: "Not found" };
  const target = engagement === "" || engagement === undefined ? null : engagement;
  if (target !== null && !isEngagement(target)) {
    return { ok: false, status: 400, error: `engagement must be one of ${ENGAGEMENTS.map((e) => e.key).join(", ")}, or null.` };
  }
  // An agency has no engagement of its own, and "an agency cannot be put
  // under an agency" is the same sentence: the only way to be under one is
  // to carry the engagement.
  if (existing.kind === AGENCY_KIND && target !== null) {
    return {
      ok: false,
      status: 400,
      error:
        target === AGENCY_ENGAGEMENT
          ? "An agency cannot work for another agency. Its own reps are the ones under it."
          : "An agency has no engagement of its own — freelancer or employee is a fact about a person.",
    };
  }
  if (existing.kind === INFLUENCER_KIND) {
    return { ok: false, status: 400, error: "This is an influencer ledger, not a person: it has no engagement and cannot work for an agency." };
  }

  const wasEmployee = isAgencyEmployee(existing, existing.manager);
  const payeeFrom = payeeIdFor(existing, existing.manager);
  const payeeFromName = wasEmployee ? existing.manager?.name || "the agency" : existing.name;

  // ── Into an agency ──────────────────────────────────────────────────────
  if (target === AGENCY_ENGAGEMENT) {
    if (!agencyId) return { ok: false, status: 400, error: "Say which agency this rep works for." };
    if (agencyId === existing.id) return { ok: false, status: 400, error: `${existing.name} cannot be their own agency.` };
    if (!agency) return { ok: false, status: 404, error: "No agency with that id." };
    if (!isAgency(agency)) {
      return { ok: false, status: 400, error: `${agency.name || "That account"} is not an agency. A rep is paid through an agency account, never through another rep.` };
    }
    if (agency.active === false) {
      return { ok: false, status: 409, error: `${agency.name} is deactivated. Reactivate it first, or pick another agency.` };
    }
    if (wasEmployee && existing.managerId === agency.id) return { ok: true, unchanged: true };
    const refused = openWeekRefusal({ rep: existing, openEntries, payeeFromName, payeeToName: agency.name });
    if (refused) return { ok: false, ...refused };
    const planChanges = (agency.commissionPlanId || null) !== (existing.commissionPlanId || null);
    const needsSetup = !setupComplete(existing);
    return {
      ok: true,
      payee: { from: payeeFrom, to: agency.id },
      data: {
        engagement: AGENCY_ENGAGEMENT,
        managerId: agency.id,
        accruesPaidLeave: false,
        // The agency's own plan, as createAgencyRep forces it: every rep
        // under an agency earns under the terms the owner agreed with that
        // agency, and one rep on a different plan would make the agency's
        // pooled batch disagree with its own contract. Audited as a plan
        // change below, and said in the confirmation sentence on the card.
        ...(planChanges ? { commissionPlanId: agency.commissionPlanId || null } : {}),
        // The owner's flag, as an agency's own add stamps it — only when
        // there is still something to assign. A line telling the owner to
        // give a number the rep already has would be a false alarm.
        ...(needsSetup && !existing.setupRequestedAt ? { setupRequestedAt: now } : {}),
      },
      flagSetup: needsSetup,
      audit: [
        {
          action: "sales_rep_agency_set",
          details: {
            salesRepId: existing.id,
            email: existing.email,
            fromAgencyId: wasEmployee ? existing.managerId : null,
            fromAgencyName: wasEmployee ? existing.manager?.name || null : null,
            toAgencyId: agency.id,
            toAgencyName: agency.name,
            engagementFrom: existing.engagement || null,
            engagementTo: AGENCY_ENGAGEMENT,
            payeeFrom,
            payeeTo: agency.id,
            openEntriesAtChange: 0,
            // Whether a phone number and a work mailbox were still owed at
            // the moment of the link. This used to be said in a
            // PlatformErrorLog row that nobody cleared; the console now
            // counts the flagged rows and the badge clears itself
            // (app/api/platform/sales/reps/count), so the AUDIT is where the
            // fact that it was owed on this day is kept.
            needsSetupAtChange: needsSetup,
          },
        },
        ...(planChanges
          ? [
              {
                action: "sales_rep_commission_plan_set",
                details: {
                  salesRepId: existing.id,
                  email: existing.email,
                  from: existing.commissionPlanId || null,
                  to: agency.commissionPlanId || null,
                  toName: agency.commissionPlan?.name || null,
                  reason: "aligned_to_agency",
                  agencyId: agency.id,
                },
              },
            ]
          : []),
      ],
    };
  }

  // ── Out of an agency, or a plain change ─────────────────────────────────
  if (wasEmployee) {
    const refused = openWeekRefusal({ rep: existing, openEntries, payeeFromName, payeeToName: existing.name });
    if (refused) return { ok: false, ...refused };
  }
  if (!wasEmployee && (existing.engagement || null) === target) return { ok: true, unchanged: true };
  const data = {
    engagement: target,
    // A freelancer never accrues paid leave through FieldQuo; an employee
    // may, but that is a separate decision (see the schema comment), so
    // moving to freelancer clears the flag and moving to employee leaves it
    // for the superadmin to set — never inferred.
    ...(target !== "employee" ? { accruesPaidLeave: false } : {}),
    // Detaching: the reporting line to the agency goes with the engagement.
    // A team-lead manager (a rep, not an agency) is not touched — that line
    // is not a payee and this control does not own it.
    ...(wasEmployee ? { managerId: null } : {}),
  };
  return {
    ok: true,
    payee: { from: payeeFrom, to: existing.id },
    data,
    flagSetup: false,
    audit: [
      ...(wasEmployee
        ? [
            {
              action: "sales_rep_agency_detached",
              details: {
                salesRepId: existing.id,
                email: existing.email,
                fromAgencyId: existing.managerId,
                fromAgencyName: existing.manager?.name || null,
                engagementFrom: AGENCY_ENGAGEMENT,
                engagementTo: target,
                payeeFrom,
                payeeTo: existing.id,
                // Kept, deliberately: the plan is what the rep earns, and
                // silently changing it on the way out is a pay decision the
                // superadmin makes on the card, not a side effect.
                commissionPlanIdKept: existing.commissionPlanId || null,
              },
            },
          ]
        : []),
      {
        action: "sales_rep_engagement_set",
        details: { salesRepId: existing.id, email: existing.email, from: existing.engagement || null, to: target },
      },
    ],
  };
}

/**
 * Decide whether a rep row may become an agency account, and the write.
 *
 * @param existing  { id, name, email, kind, engagement, managerId, manager,
 *                  commissionPlanId, payoutMethod }
 * @param counts    read fresh: { entries, batches, reports } — commission
 *                  entries ever, payout batches ever, rows whose managerId is
 *                  this rep (any engagement)
 * @param commissionPlanId the plan to give the agency (the row's own if the
 *                  request names none); required, as at agency creation
 */
export function agencyConversion({ existing, counts = {}, commissionPlanId }) {
  if (!existing?.id) return { ok: false, status: 404, error: "Not found" };
  if (existing.kind === AGENCY_KIND) return { ok: true, unchanged: true };
  if (existing.kind !== "rep") {
    return { ok: false, status: 400, error: `Only a sales rep can become an agency; this row is ${existing.kind === INFLUENCER_KIND ? "an influencer ledger" : `"${existing.kind}"`}.` };
  }
  const entries = Number(counts.entries) || 0;
  const batches = Number(counts.batches) || 0;
  const reports = Number(counts.reports) || 0;
  if (entries > 0 || batches > 0) {
    return {
      ok: false,
      status: 409,
      code: "has_commission",
      error:
        `${existing.name} has earned commission (${plural(entries, "ledger entry", "ledger entries")}${batches ? `, ${plural(batches, "payout batch", "payout batches")}` : ""}). ` +
        `A rep who has earned as a person cannot become the account an agency is paid through — that history would read as an agency's. ` +
        `Create the agency as a new account instead.`,
      counts: { entries, batches, reports },
    };
  }
  if (reports > 0) {
    return {
      ok: false,
      status: 409,
      code: "has_reports",
      error: `${plural(reports, "rep")} already report to ${existing.name}. Move them first; an agency's team is added by the agency itself.`,
      counts: { entries, batches, reports },
    };
  }
  if (existing.managerId) {
    return {
      ok: false,
      status: 409,
      code: "has_manager",
      error: isAgencyEmployee(existing, existing.manager)
        ? `${existing.name} works for ${existing.manager?.name || "an agency"}. An agency cannot be under an agency — set them to freelancer or employee first.`
        : `${existing.name} reports to ${existing.manager?.name || "another rep"}. An agency reports to nobody — clear that first.`,
      counts: { entries, batches, reports },
    };
  }
  const plan = commissionPlanId === undefined ? existing.commissionPlanId || null : commissionPlanId || null;
  if (!plan) {
    return { ok: false, status: 400, error: "An agency needs a commission plan: every rep it adds earns under it, and without one the whole team earns $0." };
  }
  if (existing.payoutMethod && !isPayoutMethodFor(AGENCY_KIND, existing.payoutMethod)) {
    return {
      ok: false,
      status: 409,
      code: "payout_method",
      error: `${existing.name} is paid through ${existing.payoutMethod}, which an agency cannot be. Ask them to choose another payout method on their Pay screen first.`,
    };
  }
  return {
    ok: true,
    data: { kind: AGENCY_KIND, engagement: null, accruesPaidLeave: false, commissionPlanId: plan, managerId: null },
    audit: [
      {
        action: "sales_rep_converted_to_agency",
        details: {
          salesRepId: existing.id,
          email: existing.email,
          engagementFrom: existing.engagement || null,
          commissionPlanId: plan,
          ...(plan !== (existing.commissionPlanId || null) ? { commissionPlanFrom: existing.commissionPlanId || null } : {}),
          entriesAtConversion: 0,
        },
      },
    ],
  };
}

/** The select the route reads a rep with, so the pure functions see every column they judge. */
export const ENGAGEMENT_EXISTING_SELECT = {
  id: true,
  name: true,
  email: true,
  kind: true,
  engagement: true,
  managerId: true,
  commissionPlanId: true,
  payoutMethod: true,
  workEmail: true,
  setupRequestedAt: true,
  _count: { select: { phoneNumbers: true } },
  manager: { select: { id: true, kind: true, name: true } },
};

/**
 * Read what engagementTransition needs, fresh, and decide.
 *
 * The agency row and the unbatched entries are read HERE, at the moment of
 * the request — never carried in from the screen's picture of them, which
 * may be a page load old. Returns engagementTransition's answer plus the
 * agency row (for the response and the error-log line).
 */
export async function resolveEngagementChange({ existing, engagement, agencyId = null, now = new Date(), client = db }) {
  const target = engagement === "" || engagement === undefined ? null : engagement;
  const wantsAgency = target === AGENCY_ENGAGEMENT;
  const [agency, openEntries] = await Promise.all([
    wantsAgency && agencyId && agencyId !== existing?.id
      ? client.salesRep.findUnique({
          where: { id: String(agencyId) },
          select: { id: true, kind: true, name: true, active: true, commissionPlanId: true, commissionPlan: { select: { id: true, name: true } } },
        })
      : Promise.resolve(null),
    existing?.id
      ? client.salesCommissionEntry.findMany({ where: { salesRepId: existing.id, payoutBatchId: null }, select: { id: true, amountCents: true } })
      : Promise.resolve([]),
  ]);
  const decision = engagementTransition({ existing, engagement: target, agency, agencyId: agencyId ? String(agencyId) : null, openEntries, now });
  return { ...decision, agency };
}

/** Read the three counts agencyConversion judges, fresh. */
export async function conversionCounts(repId, client = db) {
  if (!repId) return { entries: 0, batches: 0, reports: 0 };
  const [entries, batches, reports] = await Promise.all([
    client.salesCommissionEntry.count({ where: { salesRepId: repId } }),
    client.salesPayoutBatch.count({ where: { salesRepId: repId } }),
    client.salesRep.count({ where: { managerId: repId } }),
  ]);
  return { entries, batches, reports };
}
