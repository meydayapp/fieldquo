// lib/signup/dismissal.js
//
// "Remove from list" on /platform/signups — the owner's way to take a junk
// row (a test run, a duplicate, somebody plainly not a contractor) off the
// screen without deleting anything. The row itself is never touched; a
// SignupDismissal row records that FieldQuo hid it, who did, and — after a
// "Restore" — who put it back. See the model's comment in schema.prisma for
// why it is a table of its own and not a DELETE or a column on Company.
//
// ══ Written AND read ═══════════════════════════════════════════════════════
//
// A row that vanishes from the screen while the cron keeps mailing it, or
// while the review folder keeps offering it to a rep, is the control that
// appears to work and doesn't. So the fragments below are spread by every
// reader of these rows:
//
//   · the five-minute and 24-hour letters — app/api/cron/signup-recovery
//     (and planEarlyNudges / planSignupNudges refuse a dismissed person);
//   · promoteSignupLeads (a quiet signup → a hot lead) and the welcome-row
//     backfill in sweepSignupProspects — lib/signup/salesFloor.js;
//   · the review folder's signup section, its count and the assign write —
//     unplacedSignupWhere in lib/signup/leads.js;
//   · "Assign for callback" / "Set trade" — ensureSignupProspect refuses.
//
// No database import: the fragments are pure, and the two writes take the
// client as a parameter, the salesFloor.js convention.

/** An active dismissal: stamped and not restored. */
const ACTIVE = { restoredAt: null };

/**
 * For a SignupLead or a Company WHERE: "not currently removed from the list".
 * Both models name the relation `signupDismissal`. A NOT, so it composes with
 * a caller's own OR (spread it; it adds only the NOT key).
 */
export function notDismissedWhere() {
  return { NOT: { signupDismissal: { is: ACTIVE } } };
}

/**
 * For a Prospect WHERE: not the floor row of a removed lead or a removed
 * company. Returned as clauses for an AND, because unplacedSignupWhere
 * already carries an OR (the lease) and a second top-level key would clobber
 * a caller's NOT.
 */
export function prospectNotDismissedClauses() {
  return [
    { NOT: { signupLead: { is: { signupDismissal: { is: ACTIVE } } } } },
    { NOT: { company: { is: { signupDismissal: { is: ACTIVE } } } } },
  ];
}

/** The select that answers isDismissed() on a loaded SignupLead or Company. */
export const DISMISSAL_SELECT = { signupDismissal: { select: { dismissedAt: true, dismissedById: true, restoredAt: true } } };

/**
 * Is this loaded row (selected with DISMISSAL_SELECT) currently removed?
 * A row loaded without the relation answers false — the same lenient read
 * every other optional relation gets; the cron and the screen always select
 * it, and the check asserts they do.
 */
export function isDismissed(row) {
  const d = row?.signupDismissal;
  return Boolean(d && d.dismissedAt && !d.restoredAt);
}

/** One target, from a body: exactly one of leadId / companyId, both strings. */
export function readDismissTarget(t) {
  const leadId = typeof t?.leadId === "string" && t.leadId.trim() ? t.leadId.trim() : null;
  const companyId = typeof t?.companyId === "string" && t.companyId.trim() ? t.companyId.trim() : null;
  if (Boolean(leadId) === Boolean(companyId)) return null;
  return leadId ? { leadId } : { companyId };
}

/**
 * Hide a row. Idempotent: removing a removed row re-stamps nothing and
 * reports `already`. The row it is about must exist (a dismissal for an id
 * nobody has would be a note about nothing), and a demo company is refused —
 * demos are never on the page to begin with.
 *
 * Writes ONLY SignupDismissal and the audit line. Never the SignupLead,
 * never the Company.
 */
export async function dismissSignupRow({ client, admin, target, now = new Date() } = {}) {
  if (!client) throw new Error("dismissSignupRow needs a client");
  if (!admin?.id) throw new Error("dismissSignupRow needs the admin doing it");
  const t = readDismissTarget(target);
  if (!t) return { error: "Pick one signup to remove." };

  const key = t.leadId ? { signupLeadId: t.leadId } : { companyId: t.companyId };
  if (t.leadId) {
    const lead = await client.signupLead.findUnique({ where: { id: t.leadId }, select: { id: true } });
    if (!lead) return { error: "That signup no longer exists." };
  } else {
    const company = await client.company.findUnique({ where: { id: t.companyId }, select: { id: true, isDemo: true } });
    if (!company) return { error: "That company no longer exists." };
    if (company.isDemo) return { error: "A demo account is not a signup." };
  }

  const existing = await client.signupDismissal.findUnique({ where: key, select: { id: true, dismissedAt: true, restoredAt: true } });
  if (existing && !existing.restoredAt) return { ok: true, already: true, ...t };

  await client.signupDismissal.upsert({
    where: key,
    create: { ...key, dismissedAt: now, dismissedById: admin.id },
    update: { dismissedAt: now, dismissedById: admin.id, restoredAt: null, restoredById: null },
  });
  await client.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "signup_dismissed",
      targetCompanyId: t.companyId || null,
      details: { ...t },
    },
  });
  return { ok: true, ...t };
}

/**
 * Put a removed row back. Stamps restoredAt — the dismissal row stays, so
 * the history of who hid it is kept. Restoring a row that is not removed is
 * a no-op reported as `already`.
 */
export async function restoreSignupRow({ client, admin, target, now = new Date() } = {}) {
  if (!client) throw new Error("restoreSignupRow needs a client");
  if (!admin?.id) throw new Error("restoreSignupRow needs the admin doing it");
  const t = readDismissTarget(target);
  if (!t) return { error: "Pick one signup to restore." };
  const key = t.leadId ? { signupLeadId: t.leadId } : { companyId: t.companyId };
  const updated = await client.signupDismissal.updateMany({
    where: { ...key, restoredAt: null },
    data: { restoredAt: now, restoredById: admin.id },
  });
  if (updated.count === 0) return { ok: true, already: true, ...t };
  await client.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "signup_restored",
      targetCompanyId: t.companyId || null,
      details: { ...t },
    },
  });
  return { ok: true, ...t };
}
