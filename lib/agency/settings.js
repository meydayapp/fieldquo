// lib/agency/settings.js
//
// Settings › Marketing agency access, server side: create a key (shown once),
// revoke it, flip the two sharing switches, and read it all back. The routes
// under app/api/settings/agency-access are thin wrappers; this takes a db so
// scripts/check-agency-api.mjs runs it against its own store.
//
// Who: the owner and admins (canManageAgencyAccess). A support session may
// READ the screen — the platform console views everything — and is refused
// every write here, on top of getCurrentMember's own read-only gate:
// deliberately twice (non-negotiable #2).

import {
  canManageAgencyAccess,
  cleanKeyName,
  cleanScopes,
  generateAgencySecret,
  hashAgencySecret,
  keyHintOf,
  publicKey,
  MAX_LIVE_KEYS,
} from "@/lib/agency/keys";

const refuse = (status, error, code) => ({ status, body: { error, ...(code ? { code } : {}) } });

export const NOT_ALLOWED = refuse(403, "Only the owner or an admin can manage marketing agency access.", "owner_or_admin");
export const SUPPORT_READ_ONLY = refuse(
  403,
  "You're viewing this account read-only. Support access can't create or revoke an agency key — ask the owner.",
  "read_only",
);

function writeRefusal(member) {
  if (member?.impersonation) return SUPPORT_READ_ONLY;
  if (!canManageAgencyAccess(member)) return NOT_ALLOWED;
  return null;
}

async function actorName(db, member) {
  if (!member?.userId) return null;
  const u = await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } }).catch(() => null);
  return u?.name || u?.email || null;
}

async function log(db, member, { action, summary, entityId = null, metadata = {} }) {
  try {
    await db.activityLog.create({
      data: {
        companyId: member.companyId,
        actorUserId: member.userId || null,
        actorMemberId: member.id || null,
        actorName: await actorName(db, member),
        actorRole: member.role || null,
        viaImpersonation: Boolean(member.impersonation),
        action,
        entityType: "settings",
        entityId,
        summary,
        metadata,
      },
    });
  } catch (err) {
    console.error("[agency-settings] activity log failed:", err?.message);
  }
}

/** The screen's data. */
export async function readAgencyAccess(db, member, { now = new Date() } = {}) {
  if (!member?.impersonation && !canManageAgencyAccess(member)) return NOT_ALLOWED;
  const companyId = member.companyId;
  const [company, keys] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { agencyShareContacts: true, agencyShareMoney: true } }),
    db.agencyAccessKey.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
  ]);
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ids = keys.map((k) => k.id);
  const [calls, subs] = await Promise.all([
    ids.length ? db.agencyApiCall.findMany({ where: { companyId, keyId: { in: ids } }, orderBy: { at: "desc" }, take: 100, select: { keyId: true, method: true, path: true, status: true, at: true } }) : [],
    ids.length ? db.agencyHookSubscription.findMany({ where: { companyId, keyId: { in: ids }, endedAt: null }, select: { keyId: true, event: true } }) : [],
  ]);
  const weekCounts = new Map();
  if (ids.length) {
    const recent = await db.agencyApiCall.findMany({ where: { companyId, keyId: { in: ids }, at: { gte: since } }, select: { keyId: true } });
    for (const c of recent) weekCounts.set(c.keyId, (weekCounts.get(c.keyId) || 0) + 1);
  }
  return {
    status: 200,
    body: {
      canManage: canManageAgencyAccess(member),
      sharing: { contactDetails: company?.agencyShareContacts === true, jobValues: company?.agencyShareMoney !== false },
      keys: keys.map((k) => ({
        ...publicKey(k),
        callsLast7Days: weekCounts.get(k.id) || 0,
        liveSubscriptions: subs.filter((s) => s.keyId === k.id).map((s) => s.event),
      })),
      recentCalls: calls.map((c) => ({ ...c, keyName: keys.find((k) => k.id === c.keyId)?.name || null })),
    },
  };
}

/** Create a key. The secret is in this answer and nowhere else, ever. */
export async function createAgencyKey(db, member, body, { now = new Date() } = {}) {
  const denied = writeRefusal(member);
  if (denied) return denied;
  const name = cleanKeyName(body?.name);
  if (!name) return refuse(400, "Give the key the agency's name, so you know whose it is later.", "name_required");
  const live = await db.agencyAccessKey.count({ where: { companyId: member.companyId, revokedAt: null } });
  if (live >= MAX_LIVE_KEYS) return refuse(409, `At most ${MAX_LIVE_KEYS} agency keys can be live at once. Revoke one you no longer use.`, "too_many_keys");
  const secret = generateAgencySecret();
  const scopes = cleanScopes({ writeLeads: body?.writeLeads === true });
  const row = await db.agencyAccessKey.create({
    data: {
      companyId: member.companyId,
      name,
      keyHash: hashAgencySecret(secret),
      keyHint: keyHintOf(secret),
      scopes,
      createdById: member.userId || null,
      createdByName: await actorName(db, member),
      createdAt: now,
    },
  });
  await log(db, member, {
    action: "agency_key.created",
    entityId: row.id,
    summary: `Created a marketing agency key for ${name}${scopes.length > 1 ? " (may add and update leads)" : " (read-only)"}`,
    metadata: { keyId: row.id, scopes },
  });
  return { status: 201, body: { key: publicKey(row), secret } };
}

/** Revoke a key: it stops working at once, and its hook subscriptions end. */
export async function revokeAgencyKey(db, member, keyId, { now = new Date() } = {}) {
  const denied = writeRefusal(member);
  if (denied) return denied;
  const key = await db.agencyAccessKey.findFirst({ where: { id: String(keyId || ""), companyId: member.companyId }, select: { id: true, name: true, revokedAt: true } });
  if (!key) return refuse(404, "Not found");
  if (!key.revokedAt) {
    const by = await actorName(db, member);
    await db.agencyAccessKey.update({ where: { id: key.id }, data: { revokedAt: now, revokedById: member.userId || null, revokedByName: by } });
    const subs = await db.agencyHookSubscription.findMany({ where: { keyId: key.id, endedAt: null }, select: { id: true } });
    if (subs.length) {
      await db.agencyHookSubscription.updateMany({ where: { keyId: key.id, endedAt: null }, data: { endedAt: now, endedReason: "key_revoked" } });
      await db.agencyHookDelivery.updateMany({ where: { subscriptionId: { in: subs.map((s) => s.id) }, status: "pending" }, data: { status: "cancelled", lastError: "key revoked" } });
    }
    await log(db, member, { action: "agency_key.revoked", entityId: key.id, summary: `Revoked the marketing agency key for ${key.name}`, metadata: { keyId: key.id } });
  }
  const row = await db.agencyAccessKey.findFirst({ where: { id: key.id, companyId: member.companyId } });
  return { status: 200, body: { key: publicKey(row) } };
}

/** Flip "Share contact details" and/or "Share job values". Logged. */
export async function setAgencySharing(db, member, body) {
  const denied = writeRefusal(member);
  if (denied) return denied;
  const data = {};
  if (typeof body?.contactDetails === "boolean") data.agencyShareContacts = body.contactDetails;
  if (typeof body?.jobValues === "boolean") data.agencyShareMoney = body.jobValues;
  if (!Object.keys(data).length) return refuse(400, "Nothing to change.", "nothing_to_change");
  const before = await db.company.findUnique({ where: { id: member.companyId }, select: { agencyShareContacts: true, agencyShareMoney: true } });
  await db.company.update({ where: { id: member.companyId }, data });
  const changes = [];
  if ("agencyShareContacts" in data && data.agencyShareContacts !== before?.agencyShareContacts) {
    changes.push(data.agencyShareContacts ? "turned ON sharing contact details (name, phone, email, postal code) with marketing agencies" : "turned OFF sharing contact details with marketing agencies");
  }
  if ("agencyShareMoney" in data && data.agencyShareMoney !== before?.agencyShareMoney) {
    changes.push(data.agencyShareMoney ? "turned ON sharing job values with marketing agencies" : "turned OFF sharing job values with marketing agencies");
  }
  if (changes.length) {
    await log(db, member, {
      action: "agency_sharing.changed",
      summary: changes.join("; ").replace(/^./, (c) => c.toUpperCase()),
      metadata: { before: { contactDetails: before?.agencyShareContacts === true, jobValues: before?.agencyShareMoney !== false }, after: data },
    });
  }
  const after = await db.company.findUnique({ where: { id: member.companyId }, select: { agencyShareContacts: true, agencyShareMoney: true } });
  return { status: 200, body: { sharing: { contactDetails: after?.agencyShareContacts === true, jobValues: after?.agencyShareMoney !== false } } };
}
