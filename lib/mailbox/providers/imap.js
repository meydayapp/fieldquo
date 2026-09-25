// lib/mailbox/providers/imap.js
//
// Any other host — Namecheap Private Email, Zoho, Fastmail, iCloud, a cPanel
// box — over IMAP, with imapflow (MIT, nodemailer's author; already a
// dependency through the sales mailbox).
//
// ══ Read-only, and asserted so ════════════════════════════════════════════
//
// Mailboxes are opened with EXAMINE (imapflow's `readOnly: true` lock), so
// even fetching a body does not set \Seen on the contractor's server — the
// client's email still shows as unread on their phone. No flag, move, copy,
// append, expunge or delete call exists in this file; scripts/check-mailbox.mjs
// greps for them. (Sending, when switched on, appends to Sent — that lives in
// lib/mailbox/send.js, not here.)
//
// ══ The cursor ════════════════════════════════════════════════════════════
//
// Per folder: { uidValidity, lastUid }. A page is the next PAGE_SIZE UIDs
// above lastUid, in UID order, and the cursor returned with it is valid only
// once the page has been processed — the sync persists it after, never
// before. UIDVALIDITY changing means the server renumbered: lastUid restarts
// at 0 and the backfill window is searched again; the Message-ID unique index
// makes that a re-read, never a duplicate.
//
// The first read of a folder searches SINCE the backfill date (90 days before
// connect); after that, UID ranges only.

import { ImapFlow } from "imapflow";
import { loginFor } from "../presets";

export const CONNECT_TIMEOUT_MS = 20 * 1000;
export const PAGE_SIZE = 40;
/** Bodies larger than this are not downloaded; the header record says so. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const SENT_NAMES = ["Sent", "Sent Items", "Sent Messages", "Sent Mail", "INBOX.Sent", "INBOX/Sent", "[Gmail]/Sent Mail"];

/**
 * @param conn      { address, imapHost, imapPort, imapSecurity, loginName }
 * @param password  plaintext, this session only
 */
export function imapClientOptions(conn, password) {
  const security = conn.imapSecurity || "tls";
  return {
    host: conn.imapHost,
    port: Number(conn.imapPort) || 993,
    secure: security === "tls",
    // STARTTLS on 143 is required, never optional: a server that does not
    // offer it is refused rather than logged into in the clear. "plain" is
    // accepted only for a loopback host — the in-process test server.
    ...(security === "starttls" ? { doSTARTTLS: true } : {}),
    ...(security === "plain" ? { doSTARTTLS: false } : {}),
    auth: { user: loginFor(conn, "imap"), pass: password },
    // No logger: imapflow's debug log includes the LOGIN line.
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 60 * 1000,
    disableAutoIdle: true,
  };
}

/** Is "plain" (no TLS) allowed for this host? Loopback only. */
export function plainAllowed(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export async function withImap(conn, password, fn, { Client = ImapFlow } = {}) {
  if ((conn.imapSecurity || "tls") === "plain" && !plainAllowed(conn.imapHost)) {
    throw Object.assign(new Error("Unencrypted IMAP is not allowed."), { code: "PLAIN_REFUSED" });
  }
  const client = new Client(imapClientOptions(conn, password));
  // imapflow emits 'error' on socket trouble; unhandled, that crashes the
  // function. The awaited call below still rejects with it.
  client.on?.("error", () => {});
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close?.());
  }
}

/** The Sent folder: \Sent special-use first, else a conventional name. */
export async function findSentFolder(client) {
  const folders = await client.list();
  const special = folders.find((f) => f.specialUse === "\\Sent");
  if (special) return special.path;
  const byName = folders.find((f) => SENT_NAMES.some((n) => n.toLowerCase() === String(f.path).toLowerCase()));
  return byName ? byName.path : null;
}

/**
 * The login test run on save: LOGIN, then EXAMINE INBOX (read-only SELECT).
 * @returns { ok, sentFolder?, error?, code? }
 */
export async function testImapLogin(conn, password, deps = {}) {
  try {
    return await withImap(
      conn,
      password,
      async (client) => {
        const lock = await client.getMailboxLock("INBOX", { readOnly: true });
        lock.release();
        const sentFolder = await findSentFolder(client).catch(() => null);
        return { ok: true, sentFolder };
      },
      deps,
    );
  } catch (err) {
    return { ok: false, ...describeImapError(err, conn) };
  }
}

/**
 * A failure → a stable code the UI has a sentence for, and a detail line.
 * The password is never in either: imapflow's errors carry the server's
 * response text, which for a LOGIN failure is the server's own words.
 */
export function describeImapError(err, conn = {}) {
  const msg = String(err?.responseText || err?.message || err || "unknown error");
  const where = `${conn.imapHost || "?"}:${conn.imapPort || "?"}`;
  if (err?.code === "PLAIN_REFUSED") return { code: "plain_refused", error: `Refused to sign in to ${where} without encryption.` };
  if (err?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|authentication failed|\bAUTH\b.*fail/i.test(msg)) {
    return { code: "auth_failed", error: `${where} refused the address or password.` };
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return { code: "host_not_found", error: `The host ${conn.imapHost || "?"} could not be found.` };
  if (/ECONNREFUSED/.test(msg)) return { code: "refused", error: `${where} refused the connection — check the port.` };
  if (/ETIMEDOUT|timeout|Timeout|ECONNRESET/i.test(msg)) return { code: "timeout", error: `No answer from ${where} within ${CONNECT_TIMEOUT_MS / 1000}s.` };
  if (/CERT|certificate|self.signed|wrong version number|SSL/i.test(msg)) return { code: "tls", error: `${where} did not complete a secure connection (${msg.slice(0, 120)}).` };
  if (/STARTTLS/i.test(msg)) return { code: "tls", error: `${where} does not offer STARTTLS.` };
  return { code: "other", error: `${where}: ${msg.slice(0, 200)}` };
}

function envelopeHeaders(env = {}) {
  return {
    from: env.from || [],
    to: env.to || [],
    cc: env.cc || [],
    messageId: env.messageId || null,
    inReplyTo: env.inReplyTo || null,
    references: null,
    subject: env.subject || "",
    date: env.date || null,
  };
}

/**
 * One page of new messages in one folder, headers only.
 * @returns { items: [{ ref: uid, folder, sentFolder, headers, size }], cursor, more }
 */
export async function listFolderPage(client, folder, cursor = {}, { since, sentFolder = false, pageSize = PAGE_SIZE } = {}) {
  const lock = await client.getMailboxLock(folder, { readOnly: true });
  try {
    const box = client.mailbox || {};
    const validity = box.uidValidity != null ? Number(box.uidValidity) : null;
    let lastUid = Number(cursor.lastUid || 0);
    if (cursor.uidValidity != null && validity != null && Number(cursor.uidValidity) !== validity) lastUid = 0;
    const uidNext = Number(box.uidNext || 0);
    if (lastUid && uidNext && lastUid + 1 >= uidNext) {
      return { items: [], cursor: { uidValidity: validity, lastUid }, more: false };
    }
    const query = lastUid ? { uid: `${lastUid + 1}:*` } : since ? { since } : { all: true };
    const found = (await client.search(query, { uid: true })) || [];
    const uids = found.map(Number).filter((u) => u > lastUid).sort((a, b) => a - b);
    const page = uids.slice(0, pageSize);
    if (!page.length) return { items: [], cursor: { uidValidity: validity, lastUid }, more: false };
    const items = [];
    for await (const m of client.fetch(page.join(","), { uid: true, envelope: true, size: true }, { uid: true })) {
      items.push({ ref: Number(m.uid), folder, sentFolder, headers: envelopeHeaders(m.envelope), size: Number(m.size || 0) });
    }
    items.sort((a, b) => a.ref - b.ref);
    return { items, cursor: { uidValidity: validity, lastUid: page[page.length - 1] }, more: uids.length > page.length };
  } finally {
    lock.release();
  }
}

/** The raw source of one message (read-only), or null when it is too large. */
export async function fetchRaw(client, folder, uid, size) {
  if (size && size > MAX_SOURCE_BYTES) return null;
  const lock = await client.getMailboxLock(folder, { readOnly: true });
  try {
    const m = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
    return m?.source || null;
  } finally {
    lock.release();
  }
}

/**
 * The adapter the generic sync drives. `session(fn)` opens ONE connection for
 * the whole tick; inside it, pages come folder by folder, INBOX first.
 */
export function imapAdapter(conn, password, deps = {}) {
  return {
    provider: "imap",
    async session(fn) {
      return withImap(conn, password, (client) => fn(makeReader(client, conn)), deps);
    },
  };
}

function makeReader(client, conn) {
  return {
    /**
     * @param cursor  the whole stored imap cursor
     * @returns { items, cursor (whole, updated), more }
     */
    async nextPage(cursor = {}, { since }) {
      const next = { ...cursor };
      if (next.sent === undefined || next.sent?.folder === undefined) {
        next.sent = { folder: await findSentFolder(client).catch(() => null), uidValidity: null, lastUid: 0 };
      }
      const inbox = await listFolderPage(client, "INBOX", next.inbox || {}, { since });
      if (inbox.items.length) return { items: inbox.items, cursor: { ...next, inbox: inbox.cursor }, more: true };
      next.inbox = inbox.cursor;
      if (next.sent?.folder) {
        const sent = await listFolderPage(client, next.sent.folder, next.sent, { since, sentFolder: true });
        next.sent = { folder: next.sent.folder, ...sent.cursor };
        return { items: sent.items, cursor: next, more: sent.more };
      }
      return { items: [], cursor: next, more: false };
    },
    async fetchRaw(item) {
      return fetchRaw(client, item.folder, item.ref, item.size);
    },
  };
}
