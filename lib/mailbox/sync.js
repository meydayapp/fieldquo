// lib/mailbox/sync.js
//
// One tick of one connected mailbox: page through what is new (INBOX and
// Sent, or the provider's equivalent), match each message's addresses to the
// company's clients and leads, file the matches, count the rest.
//
// ══ Time-boxed, and the cursor only moves behind finished work ════════════
//
// The cron gives each mailbox a deadline well inside the function limit. A
// page is listed, every message in it is handled, and only THEN is the
// cursor written — so a function killed mid-page repeats that page next
// tick (the Message-ID index makes the repeat a no-op), and never skips one.
// The first sync of a fresh connection is a 90-day backfill that may take
// several ticks; each resumes where the last one stopped.
//
// ══ Every dependency is a parameter ═══════════════════════════════════════
//
// The database, the provider adapter, the MIME parser, the upload, the
// clock — scripts/check-mailbox.mjs drives the real function against a fake
// database and fake providers (and a real IMAP conversation with an
// in-process server), rather than asserting about the source.

import { simpleParser } from "mailparser";
import { openMailSecret, sealMailSecret } from "./crypto";
import { canonicalAddress, ownAddressSet, buildMatchIndex, sidesOf, matchCounterpart } from "./addresses";
import { headerView, parseRaw } from "./parse";
import { chooseFilingTarget } from "./filingTarget";
import { fileEmail, channelForMailbox } from "./file";
import { storeEmailAttachments } from "./attachments";
import { imapAdapter, describeImapError } from "./providers/imap";
import { googleAdapter } from "./providers/google";
import { microsoftAdapter } from "./providers/microsoft";

/** A lock older than this belonged to a function that died. */
export const SYNC_STALE_MS = 15 * 60 * 1000;
/** Default per-mailbox budget when the caller gives none. */
export const DEFAULT_BUDGET_MS = 90 * 1000;

/** The provider adapter for a row, with its credential opened for this tick only. */
export function adapterFor(conn, secret, deps = {}, db = null) {
  if (conn.provider === "imap") return imapAdapter(conn, secret, deps.imapDeps);
  if (conn.provider === "google") return googleAdapter(secret, { ...(deps.googleDeps || {}), lastSyncAt: conn.lastSyncAt });
  if (conn.provider === "microsoft") {
    return microsoftAdapter(secret, {
      ...(deps.microsoftDeps || {}),
      // Graph rotates refresh tokens; the new one is sealed onto the row at
      // once, bound to the row as the old one was.
      onRotate: async (rotated) => {
        if (db) await db.mailboxConnection.update({ where: { id: conn.id }, data: { secretEnc: sealMailSecret(rotated, conn.id) } });
      },
    });
  }
  throw new Error(`unknown provider ${conn.provider}`);
}

/** A thrown provider error → the one line the card prints. Never the secret. */
export function describeSyncError(err, conn) {
  if (conn.provider === "imap") return describeImapError(err, conn);
  const status = Number(err?.status || 0);
  if (err?.authenticationFailed || status === 401 || status === 400) {
    return { code: "auth_failed", error: "The connection was refused — access may have been removed. Reconnect the mailbox." };
  }
  if (status === 403) return { code: "forbidden", error: `The provider refused access (${String(err?.message || "").slice(0, 160)}).` };
  if (status === 429) return { code: "rate_limited", error: "The provider asked us to slow down; the next sync will continue." };
  return { code: "other", error: String(err?.message || err || "unknown error").slice(0, 200) };
}

/** The company's clients and leads, as a match index (see addresses.js). */
export async function loadMatchIndex(db, companyId, { extraOwn = [] } = {}) {
  const [clients, leads, mailboxes, company] = await Promise.all([
    db.client.findMany({ where: { companyId, email: { not: null } }, select: { id: true, name: true, email: true } }),
    db.leadRequest.findMany({ where: { companyId, email: { not: null } }, select: { id: true, name: true, email: true, createdAt: true } }),
    db.mailboxConnection.findMany({ where: { companyId }, select: { address: true } }),
    db.company.findUnique({ where: { id: companyId }, select: { email: true } }),
  ]);
  const own = ownAddressSet(mailboxes, [company?.email, ...extraOwn].filter(Boolean));
  return { index: buildMatchIndex({ clients, leads, own }), own };
}

async function targetFor(db, companyId, match, normal) {
  if (match.kind === "lead") {
    const lead = await db.leadRequest.findFirst({ where: { id: match.id, companyId }, select: { quoteId: true } });
    return { jobId: null, quoteId: lead?.quoteId || null, reason: lead?.quoteId ? "lead_quote" : "none" };
  }
  const [quotes, invoices, jobs] = await Promise.all([
    db.quote.findMany({ where: { companyId, clientId: match.id }, select: { id: true, quoteNumber: true, status: true, archivedAt: true, createdAt: true } }),
    db.invoice.findMany({ where: { companyId, clientId: match.id }, select: { id: true, invoiceNumber: true, quoteId: true, jobId: true } }),
    db.job.findMany({ where: { companyId, clientId: match.id }, select: { id: true, quoteId: true, status: true, createdAt: true, updatedAt: true } }),
  ]);
  return chooseFilingTarget({ subject: normal.subject, body: normal.body, quotes, invoices, jobs });
}

/**
 * @param conn   the full MailboxConnection row (with secretEnc)
 * @param deps   { parse, upload, now, budgetMs, imapDeps, googleDeps, microsoftDeps, adapter }
 * @returns { ok, reason?, filed, skipped, held, error? }
 */
export async function syncMailbox(db, conn, deps = {}) {
  const now = deps.now || (() => new Date());
  const parse = deps.parse || simpleParser;
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = now().getTime();
  const totals = { filed: 0, skipped: 0, held: 0 };

  if (!conn || conn.status === "disconnected" || !conn.secretEnc) return { ok: false, reason: "not_connected", ...totals };

  const at = now();
  const claimed = await db.mailboxConnection.updateMany({
    where: { id: conn.id, OR: [{ syncingSince: null }, { syncingSince: { lt: new Date(at.getTime() - SYNC_STALE_MS) } }] },
    data: { syncingSince: at },
  });
  if (!claimed.count) return { ok: false, reason: "busy", ...totals };

  let secret;
  try {
    secret = openMailSecret(conn.secretEnc, conn.id);
  } catch {
    await db.mailboxConnection.update({
      where: { id: conn.id },
      data: { syncingSince: null, status: "error", lastError: "The stored credential could not be opened (the key changed?). Reconnect the mailbox.", lastErrorAt: at },
    });
    return { ok: false, reason: "secret_unreadable", ...totals };
  }

  let cursor = conn.cursor && typeof conn.cursor === "object" ? { ...conn.cursor } : {};
  const self = canonicalAddress(conn.address);
  const since = conn.backfillFrom ? new Date(conn.backfillFrom) : new Date(at.getTime() - 90 * 86400000);

  try {
    const channel = await channelForMailbox(db, conn);
    const { index, own } = await loadMatchIndex(db, conn.companyId);
    const adapter = deps.adapter || adapterFor(conn, secret, deps, db);

    await adapter.session(async (reader) => {
      for (;;) {
        if (now().getTime() - started > budgetMs) break;
        const page = await reader.nextPage(cursor, { since });
        // Oldest first within the page, so a reply is filed after the
        // message it answers and the response clock reads the right way.
        const items = [...page.items].sort((a, b) => new Date(a.headers?.date || 0) - new Date(b.headers?.date || 0));
        for (const item of items) {
          const head = headerView(item.headers);
          const { direction, counterparts } = sidesOf({ ...head, self, own, sentFolder: item.sentFolder });
          const match = matchCounterpart(counterparts, index);
          if (!match) {
            totals.skipped += 1; // counted, never stored
            continue;
          }
          if (head.rfcMessageId) {
            const held = await db.emailMessage.findFirst({ where: { companyId: conn.companyId, rfcMessageId: head.rfcMessageId }, select: { id: true } });
            if (held) {
              totals.held += 1;
              continue;
            }
          }
          const raw = await reader.fetchRaw(item);
          const normal = await parseRaw(raw, { ...head, bodyNote: raw ? "" : "This email is too large to copy here; it is in the mailbox." }, { parse });
          normal.direction = direction;
          normal.folder = item.folder;
          normal.providerRef = item.ref != null ? String(item.ref) : null;
          const target = await targetFor(db, conn.companyId, match, normal);
          const attachments = normal.attachments.length
            ? await storeEmailAttachments({ files: normal.attachments, companyId: conn.companyId, upload: deps.upload })
            : [];
          const backfill = normal.date ? normal.date < conn.connectedAt : false;
          const r = await fileEmail(db, { mailbox: conn, channel, normal, match, target, attachments, backfill, now: now(), rescore: deps.rescore });
          if (r.filed) totals.filed += 1;
          else totals.held += 1;
        }
        cursor = page.cursor;
        await db.mailboxConnection.update({ where: { id: conn.id }, data: { cursor } });
        if (!page.more) break;
      }
    });
  } catch (err) {
    const { code, error } = describeSyncError(err, conn);
    await db.mailboxConnection.update({
      where: { id: conn.id },
      data: {
        syncingSince: null,
        lastError: error,
        lastErrorAt: now(),
        filedCount: { increment: totals.filed },
        skippedCount: { increment: totals.skipped },
        // A refused credential is the person's to fix (Reconnect); a blip is
        // not, and the next tick retries a row in "error" anyway.
        ...(code === "auth_failed" ? { status: "error" } : {}),
      },
    });
    return { ok: false, reason: code, error, ...totals };
  }

  await db.mailboxConnection.update({
    where: { id: conn.id },
    data: {
      syncingSince: null,
      status: "connected",
      lastSyncAt: now(),
      lastError: null,
      lastErrorAt: null,
      lastSyncFiled: totals.filed,
      lastSyncSkipped: totals.skipped,
      filedCount: { increment: totals.filed },
      skippedCount: { increment: totals.skipped },
    },
  });
  return { ok: true, ...totals };
}
