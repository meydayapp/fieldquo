// lib/mailbox/connections.js
//
// Creating, reconnecting, disconnecting and describing a MailboxConnection —
// the one place each of those happens, so the three connect doors (Google,
// Microsoft, IMAP) cannot disagree about what a connection is.
//
// ══ Who may do what ═══════════════════════════════════════════════════════
//
//   · Any member may connect THEIR OWN work mailbox (scope "member"). It is
//     theirs to disconnect.
//   · Only an owner or admin may connect the COMPANY mailbox (scope
//     "company") — the only kind that may send client email — and an owner
//     or admin may disconnect any of the company's mailboxes.
//   · Nobody may take over an address another member connected: the second
//     person is told who holds it. (An owner/admin reconnecting it is the
//     exception, so a leaver's mailbox can be re-authorised by the office.)
//   · A read-only support session (impersonation) can do none of it.
//
// ══ Disconnect ════════════════════════════════════════════════════════════
//
// Wipes the stored credential (secretEnc → null — the one deletion this
// feature makes, at the person's own request), revokes a Google token, stops
// the sync and switches sending off. What was already filed stays: it is the
// company's record of what was said to its clients.

import { randomBytes } from "node:crypto";
import { sealMailSecret } from "./crypto";
import { channelForMailbox } from "./file";
import { bareAddress } from "./addresses";

export const WORK_EMAIL_SETTINGS_PATH = "/app/settings/work-email";
export const BACKFILL_DAYS = 90;
export const PROVIDERS = Object.freeze(["google", "microsoft", "imap"]);

export function isOwnerOrAdmin(member) {
  return Boolean(member && !member.impersonation && (member.role === "owner" || member.role === "admin"));
}

/** A cuid-shaped id minted here, because the seal binds to the id BEFORE the row exists. */
export function newConnectionId() {
  return `c${Date.now().toString(36)}${randomBytes(9).toString("hex")}`;
}

/**
 * @returns { ok: true, row } | { ok: false, status, code, error }
 */
export async function saveConnection(db, { member, provider, address, scope = "member", secret, grantedScopes = null, imap = null, cursorSeed = null, now = new Date() }) {
  if (!member || member.impersonation) return { ok: false, status: 403, code: "read_only", error: "A support session is read-only." };
  if (!PROVIDERS.includes(provider)) return { ok: false, status: 400, code: "bad_provider", error: "Unknown provider." };
  const addr = bareAddress(address);
  if (!addr) return { ok: false, status: 400, code: "bad_address", error: "That is not an email address." };
  if (scope !== "company" && scope !== "member") scope = "member";
  if (scope === "company" && !isOwnerOrAdmin(member)) {
    return { ok: false, status: 403, code: "company_scope_forbidden", error: "Only an owner or admin can connect the company mailbox." };
  }
  if (typeof secret !== "string" || !secret) return { ok: false, status: 400, code: "no_secret", error: "No credential to store." };

  const existing = await db.mailboxConnection.findFirst({ where: { companyId: member.companyId, address: addr } });
  if (existing && existing.status !== "disconnected" && existing.memberId !== member.id && !isOwnerOrAdmin(member)) {
    return { ok: false, status: 409, code: "held_by_other", error: "Someone else at your company already connected this mailbox." };
  }

  const backfillFrom = new Date(now.getTime() - BACKFILL_DAYS * 86400000);
  const imapFields = imap
    ? {
        preset: imap.preset || "custom",
        imapHost: imap.imapHost,
        imapPort: imap.imapPort,
        imapSecurity: imap.imapSecurity,
        loginName: imap.loginName || null,
        smtpHost: imap.smtpHost || null,
        smtpPort: imap.smtpPort || null,
        smtpSecurity: imap.smtpSecurity || null,
      }
    : { preset: null, imapHost: null, imapPort: null, imapSecurity: null, loginName: null, smtpHost: null, smtpPort: null, smtpSecurity: null };

  let row;
  if (existing) {
    // A reconnect of a live connection (a fresh password, a re-consent)
    // keeps its place; a connection coming back from "disconnected", or
    // switching provider, reads the backfill window again — the Message-ID
    // index makes the overlap free.
    // A different IMAP server numbers its UIDs differently, so a changed
    // host starts the cursor again too.
    const resume =
      existing.status !== "disconnected" &&
      existing.provider === provider &&
      (provider !== "imap" || existing.imapHost === imapFields.imapHost);
    const keepSending = existing.sendEnabled && scope === "company" && existing.scope === "company";
    row = await db.mailboxConnection.update({
      where: { id: existing.id },
      data: {
        memberId: member.id,
        userId: member.userId || null,
        scope,
        provider,
        ...imapFields,
        secretEnc: sealMailSecret(secret, existing.id),
        grantedScopes,
        status: "connected",
        lastError: null,
        lastErrorAt: null,
        syncingSince: null,
        disconnectedAt: null,
        ...(resume ? {} : { cursor: cursorSeed || {}, backfillFrom, connectedAt: now }),
        ...(keepSending ? {} : { sendEnabled: false }),
      },
    });
  } else {
    const id = newConnectionId();
    row = await db.mailboxConnection.create({
      data: {
        id,
        companyId: member.companyId,
        memberId: member.id,
        userId: member.userId || null,
        scope,
        provider,
        address: addr,
        ...imapFields,
        secretEnc: sealMailSecret(secret, id),
        grantedScopes,
        status: "connected",
        backfillFrom,
        cursor: cursorSeed || {},
        connectedAt: now,
      },
    });
  }
  await channelForMailbox(db, row);
  return { ok: true, row };
}

/** May this member act on this row (disconnect, sync now, see its detail)? */
export function canManage(member, row) {
  if (!member || member.impersonation || !row || row.companyId !== member.companyId) return false;
  return row.memberId === member.id || isOwnerOrAdmin(member);
}

export async function disconnectConnection(db, row, { revoke = null, now = new Date() } = {}) {
  if (revoke && row.secretEnc) await revoke(row).catch(() => null);
  await db.mailboxConnection.update({
    where: { id: row.id },
    data: {
      secretEnc: null,
      status: "disconnected",
      disconnectedAt: now,
      syncingSince: null,
      sendEnabled: false,
      grantedScopes: null,
    },
  });
  if (row.channelId) {
    await db.messagingChannel.updateMany({ where: { id: row.channelId, companyId: row.companyId }, data: { disconnectedAt: now, status: "disconnected" } });
  }
}

/**
 * What the browser may see of a row. An allowlist, never a spread: the
 * credential, its ciphertext and the cursor never leave the server.
 */
export function publicShape(row, { filedThisWeek = null, memberName = null, isMine = false, sendCapable = false } = {}) {
  return {
    id: row.id,
    provider: row.provider,
    address: row.address,
    scope: row.scope,
    status: row.status,
    preset: row.preset || null,
    imapHost: row.imapHost || null,
    imapPort: row.imapPort || null,
    smtpHost: row.smtpHost || null,
    lastSyncAt: row.lastSyncAt || null,
    lastError: row.lastError || null,
    lastErrorAt: row.lastErrorAt || null,
    filedThisWeek,
    filedCount: row.filedCount ?? 0,
    skippedCount: row.skippedCount ?? 0,
    backfillFrom: row.backfillFrom || null,
    connectedAt: row.connectedAt || null,
    disconnectedAt: row.disconnectedAt || null,
    sendEnabled: Boolean(row.sendEnabled),
    sendCapable,
    lastSentAt: row.lastSentAt || null,
    lastSendFallbackAt: row.lastSendFallbackAt || null,
    lastSendFallbackReason: row.lastSendFallbackReason || null,
    syncing: Boolean(row.syncingSince),
    memberName,
    isMine,
  };
}
