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
 * The company's named enquiry owner as a member row, or null.
 *
 * Null for: no setting, a member who left or was deactivated, and a member
 * whose access has since been narrowed past what the alert can reach — all
 * three are "nobody", and all three are decided here rather than trusted from
 * the column.
 *
 * Never throws: both callers are on a path where a lead has either just been
 * captured or already committed, and neither may be lost to this.
 */
export async function leadOwnerMember(prisma, companyId) {
  if (!prisma || !companyId) return null;
  try {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { leadOwnerId: true } });
    const id = company?.leadOwnerId;
    if (!id) return null;
    const member = await prisma.member.findFirst({ where: { id, companyId, active: true }, select: MEMBER_SELECT });
    if (!member || !mayOwnLeads(member)) return null;
    return member;
  } catch (err) {
    console.error("[lead owner] read failed:", err?.message);
    return null;
  }
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
