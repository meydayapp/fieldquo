// lib/notifications/leadOwner.js
//
// "New enquiries go to …" — the owner, 2026-11-03: "We can then in the
// settings assign it to a different employee (future appointment setter) from
// the list of employees so they get notified."
//
// ONE module for the whole rule, because it is read in three places that must
// not be allowed to disagree:
//
//   1. lib/leads/createLead.js   — the new lead's assignedToId
//   2. lib/notifications/notify.js — a recipient of lead.created
//   3. app/api/settings/lead-owner — the picker, and what it may offer
//
// ══ Degrades to nobody, by reading rather than by cleaning up ═════════════
//
// Company.leadOwnerId is a Member id with no foreign key (see its comment in
// prisma/schema.prisma). Every use goes through leadOwnerMember(), which
// re-reads the row as `active: true` in THIS company — so an appointment
// setter who leaves, or is deactivated on a Friday, stops collecting Monday's
// enquiries without anybody remembering to clear a setting. There is no
// cleanup job on purpose: a job is a second place the rule lives, and the
// stale weekend in between is exactly the window that matters.
//
// ══ Who may be offered ════════════════════════════════════════════════════
//
// Only a member the lead.created alert could actually reach — the catalog's
// own resolver, asked directly (lib/notifications/recipients.js). Offering
// somebody the alert would refuse is the dead control AGENTS.md's first rule
// forbids: the setting would save, the lead would be assigned, and the person
// would never be told it had arrived.
//
// ══ The one-man company (owner, 2026-11-14) ═══════════════════════════════
//
// "if it's a one man company then have it automatically assigned to them."
// A company with exactly ONE member the alert can reach has nobody else the
// lead could go to, so a null setting left their enquiries unassigned
// forever — nobody's name on the board, nobody's queue.
//
// Which null, though. Company.leadOwnerId being null meant two different
// things: never configured, and "Nobody — leave them unassigned", which the
// picker offers and which saves as the same null. Auto-filling the second
// would overwrite a stated choice with a default — the destructive operation
// wearing a cosmetic label (AGENTS.md failure class 7), and visible, because
// an assignee is the lead board's owner column and the chase task's
// assignee. So the picker now stamps Company.leadOwnerChosenAt on every
// save, including a save of Nobody, and the default fills ONLY the
// never-touched case. A default fills what was never said; it does not
// overwrite what was.
//
// Decided HERE rather than in createLead.js for the reason this module
// exists: the picker reads the same function, so the screen shows the solo
// person as the one enquiries go to instead of saying "Nobody" while every
// lead lands on them. One rule, one answer, three readers.
//
// It is a DEFAULT, not a lock: the solo person can still pick Nobody, and
// that choice is stamped and kept. And it only ever applies when the column
// is empty — a named setter who has since left still degrades to nobody
// (the stale-weekend behaviour above), because that company DID configure
// this and their choice simply died with the account.

import { selectRecipients } from "@/lib/notifications/recipients";

/** The columns the decision and the fan-out both need. */
const MEMBER_SELECT = Object.freeze({
  id: true,
  userId: true,
  role: true,
  permissions: true,
  companyId: true,
  active: true,
});

/** The event this setting is the default recipient for. */
export const LEAD_OWNER_EVENT = "lead.created";

/** Could a new enquiry's alert reach this member? PURE. */
export function mayOwnLeads(member) {
  if (!member || member.active === false || !member.userId) return false;
  return selectRecipients({ members: [{ ...member, active: true }], type: LEAD_OWNER_EVENT }).length === 1;
}

/**
 * The company's enquiry owner as a member row, or null.
 *
 * Null for: a deliberate "Nobody", a member who left or was deactivated, and
 * a member whose access has since been narrowed past what the alert can
 * reach — all three are "nobody", and all three are decided here rather than
 * trusted from the column.
 *
 * NOT null for a one-man company that never touched the setting: the sole
 * eligible member is the answer. See the header.
 *
 * Never throws: both callers are on a path where a lead has either just been
 * captured or already committed, and neither may be lost to this.
 */
export async function leadOwnerMember(prisma, companyId) {
  if (!prisma || !companyId) return null;
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { leadOwnerId: true, leadOwnerChosenAt: true },
    });
    const id = company?.leadOwnerId;
    // Nothing named. Either somebody chose Nobody — which is an answer, and
    // is kept — or the setting was never touched, and a company with exactly
    // one eligible member has only one answer it could have given.
    //
    // Awaited rather than returned: a promise handed back out of a try block
    // rejects OUTSIDE it, and this function's whole contract is that a lead
    // is never lost to a failed read of a setting.
    if (!id) return company?.leadOwnerChosenAt ? null : await soleLeadOwner(prisma, companyId);
    const member = await prisma.member.findFirst({ where: { id, companyId, active: true }, select: MEMBER_SELECT });
    if (!member || !mayOwnLeads(member)) return null;
    return member;
  } catch (err) {
    console.error("[lead owner] read failed:", err?.message);
    return null;
  }
}

/**
 * The one member this company's enquiries could go to, or null if it is not a
 * one-man company.
 *
 * Asks leadOwnerCandidates rather than counting members itself, so "exactly
 * one" means exactly one the alert can REACH — a solo owner with a crew
 * member who cannot see Requests is still a one-man company for this
 * purpose, and a two-estimator company is not one however the roles read.
 */
async function soleLeadOwner(prisma, companyId) {
  const candidates = await leadOwnerCandidates(prisma, companyId);
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * The members this company may choose from, in the order a picker lists them.
 * Each one is a member the lead.created alert can reach.
 */
export async function leadOwnerCandidates(prisma, companyId) {
  const members = await prisma.member.findMany({
    where: { companyId, active: true },
    select: { ...MEMBER_SELECT, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members.filter(mayOwnLeads);
}

/**
 * The recipients of one event, plus the named enquiry owner — never fewer.
 *
 * Only for lead.created: every other type is returned untouched, so this is
 * one guarded line in notifyEvent rather than a notion the generic resolver
 * has to carry.
 *
 * ── Two rules it keeps ──────────────────────────────────────────────────
 *
 *   · It only ever ADDS. Everybody the catalog admits today still gets the
 *     bell; naming a setter is not a way to make the board quieter for
 *     everybody else, and the check proves the list only grows.
 *
 *     Worth saying plainly: with today's catalog this adds nobody, because
 *     the picker can only offer members the audience already admits (the
 *     Requests ladder has no "own only" rung — lib/permissions.js). It is
 *     here because the two promises must not be able to drift: lead.created
 *     is `peopleScoped: false` precisely because a brand-new lead had no
 *     people, and now that it HAS an assignee somebody will reasonably
 *     propose scoping it. On that day the named setter keeps their alert
 *     instead of being the first casualty of the change.
 *   · It never adds the ACTOR. A staff member who typed the lead in by hand
 *     is the one person the feed must not tell about it (recipients.js) — and
 *     if the setter is the person doing the typing, that is exactly who it
 *     would otherwise text about their own keystrokes.
 */
export async function withLeadOwner({ prisma, companyId, type, actorUserId = null, recipients = [] }) {
  const list = Array.isArray(recipients) ? recipients : [];
  if (type !== LEAD_OWNER_EVENT) return list;
  const owner = await leadOwnerMember(prisma, companyId);
  if (!owner) return list;
  if (actorUserId && owner.userId === actorUserId) return list;
  if (list.some((m) => m.id === owner.id)) return list;
  return [...list, owner];
}
