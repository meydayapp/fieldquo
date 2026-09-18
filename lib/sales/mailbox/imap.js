// lib/sales/mailbox/imap.js
//
// The one file that opens an IMAP connection.
//
// ══ imapflow, and the four things this asks of it ═════════════════════════
//
// imapflow is the maintained IMAP client from nodemailer's author; it speaks
// the protocol so nothing here does. This file uses exactly four of its
// operations, and each one is here for a named reason:
//
//   list()             which folder the server marks \Sent — Namecheap's is
//                      "Sent", others say "Sent Items" or "Sent Messages",
//                      and guessing is how a copy lands in the wrong folder.
//   fetch() by UID     new messages since the last UID we stored, with
//                      their flags and raw source, inside a mailbox lock.
//   messageFlagsAdd()  \Seen on a message the rep read in the portal — the
//                      one write the sync makes to the server's state.
//   append()           the portal's own send, into Sent, so the rep's phone
//                      shows what they sent from here.
//
// What is NOT here, by design, and is asserted absent by
// scripts/check-sales-mailbox.mjs: messageDelete, messageMove, expunge,
// mailboxDelete, and the \Deleted flag. The reps use privateemail.com
// directly; the portal must never be the thing that made a message vanish.
//
// ══ Every session is short ════════════════════════════════════════════════
//
// Vercel functions do not keep sockets, so IDLE is not an option and every
// call here connects, does its work and logs out. withImap() is the shape:
// a function that gets an open client and whose result or throw always
// runs logout, so a thrown parse error never leaves a socket open until the
// function is frozen.

import { ImapFlow } from "imapflow";

/** How long a connect + login may take before it is a failure in words. */
export const CONNECT_TIMEOUT_MS = 20 * 1000;

/** The most raw source fetched in one sync per folder. */
export const FETCH_BATCH = 40;

/** A message larger than this is stored by headers only; its body says so. */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

function clientFor(mailbox, password) {
  return new ImapFlow({
    host: mailbox.imapHost,
    port: mailbox.imapPort,
    secure: true,
    auth: { user: mailbox.address, pass: password },
    // No logger: imapflow's default logs the LOGIN line at debug level, and
    // a password in a Vercel log is a password in a Vercel log.
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 60 * 1000,
  });
}

/**
 * Run `fn(client)` on a connected client and always log out.
 *
 * @param mailbox   { address, imapHost, imapPort }
 * @param password  plaintext, for this session only
 */
export async function withImap(mailbox, password, fn) {
  const client = clientFor(mailbox, password);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/**
 * Connect, log in, and learn the special folders. The result is the
 * sentence the rep's card shows.
 *
 * @returns { ok, sentence, sentFolder, draftsFolder }
 */
export async function testImap(mailbox, password) {
  try {
    return await withImap(mailbox, password, async (client) => {
      const folders = await client.list();
      const sentFolder = folders.find((f) => f.specialUse === "\\Sent")?.path || null;
      const draftsFolder = folders.find((f) => f.specialUse === "\\Drafts")?.path || null;
      const inbox = await client.status("INBOX", { messages: true, unseen: true });
      const parts = [
        `Signed in to ${mailbox.imapHost}:${mailbox.imapPort} as ${mailbox.address}.`,
        `INBOX holds ${inbox?.messages ?? "?"} messages (${inbox?.unseen ?? "?"} unread).`,
        sentFolder ? `Sent folder: "${sentFolder}".` : "The server did not name a Sent folder; portal sends will not be copied there.",
      ];
      return { ok: true, sentence: parts.join(" "), sentFolder, draftsFolder };
    });
  } catch (err) {
    return { ok: false, sentence: describeImapError(err, mailbox), sentFolder: null, draftsFolder: null };
  }
}

/** The failure in words a person can act on, with the password never in it. */
export function describeImapError(err, mailbox = {}) {
  const msg = String(err?.responseText || err?.message || err || "unknown error");
  const where = `${mailbox.imapHost || "the IMAP host"}:${mailbox.imapPort || ""}`;
  if (err?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|authentication failed/i.test(msg)) {
    return `The server at ${where} refused the password for ${mailbox.address || "this mailbox"}. Check it in Namecheap (an app password works too) and save again.`;
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return `The host ${where} could not be found. Namecheap Private Email is mail.privateemail.com.`;
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|Timeout/i.test(msg)) {
    return `No answer from ${where} in ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s. IMAP over SSL is port 993 on Namecheap.`;
  }
  if (/CERT|certificate|self signed/i.test(msg)) return `The server at ${where} presented a certificate Node did not trust: ${msg}`;
  return `IMAP at ${where}: ${msg.slice(0, 300)}`;
}

/**
 * New messages in a folder since `lastUid`, oldest first, at most
 * FETCH_BATCH of them.
 *
 * `uid > lastUid` is filtered here as well as asked for: an IMAP range
 * "N:*" answers with the HIGHEST message when nothing is above N, so a
 * folder with no news would otherwise return its last message every minute.
 * A changed UIDVALIDITY means the server renumbered; the caller resets its
 * position to 0 and the folder is read afresh (duplicates are caught by
 * Message-ID downstream).
 *
 * @returns { uidValidity, messages: [{ uid, flags: Set, size, source: Buffer|null, tooLarge }],
 *            more: boolean, uidNext }
 */
export async function fetchNewInFolder(client, folder, { lastUid = 0, uidValidity = null, max = FETCH_BATCH } = {}) {
  const lock = await client.getMailboxLock(folder);
  try {
    const box = client.mailbox;
    const validity = box?.uidValidity !== undefined && box?.uidValidity !== null ? Number(box.uidValidity) : null;
    const reset = uidValidity !== null && validity !== null && validity !== uidValidity;
    const from = reset ? 1 : Number(lastUid || 0) + 1;
    const uidNext = Number(box?.uidNext || 0);
    if (!reset && uidNext && from >= uidNext) {
      return { uidValidity: validity, messages: [], more: false, uidNext, reset };
    }
    const rows = [];
    // Headers and flags for everything above the mark, cheap; the raw source
    // only for the first `max`, so one folder with 3,000 unread messages
    // does not become one function invocation that never ends.
    for await (const m of client.fetch(`${from}:*`, { uid: true, flags: true, size: true, envelope: true }, { uid: true })) {
      if (Number(m.uid) < from) continue;
      rows.push({ uid: Number(m.uid), flags: m.flags || new Set(), size: Number(m.size || 0), envelope: m.envelope || null });
    }
    rows.sort((a, b) => a.uid - b.uid);
    const take = rows.slice(0, max);
    const messages = [];
    for (const r of take) {
      if (r.size > MAX_SOURCE_BYTES) {
        messages.push({ ...r, source: null, tooLarge: true });
        continue;
      }
      const full = await client.fetchOne(String(r.uid), { uid: true, source: true }, { uid: true });
      messages.push({ ...r, source: full?.source || null, tooLarge: false });
    }
    return { uidValidity: validity, messages, more: rows.length > take.length, uidNext, reset };
  } finally {
    lock.release();
  }
}

/**
 * The current flags of messages we hold — for the other half of the
 * read-state mirror: a message the rep read on their phone since the last
 * sync. Returns Map<uid, Set<flag>>; a UID the server no longer has is
 * simply absent (it was deleted THERE, which we mirror by leaving our copy
 * alone — never by deleting).
 */
export async function fetchFlags(client, folder, uids) {
  const list = (Array.isArray(uids) ? uids : []).map((u) => Number(u)).filter((u) => Number.isInteger(u) && u > 0);
  const out = new Map();
  if (!list.length) return out;
  const lock = await client.getMailboxLock(folder);
  try {
    for await (const m of client.fetch(list.join(","), { uid: true, flags: true }, { uid: true })) {
      out.set(Number(m.uid), m.flags || new Set());
    }
    return out;
  } finally {
    lock.release();
  }
}

/** Mark messages \Seen — the read-state mirror. UIDs only, never a range with `*`. */
export async function markSeen(client, folder, uids) {
  const list = (Array.isArray(uids) ? uids : []).map((u) => Number(u)).filter((u) => Number.isInteger(u) && u > 0);
  if (!list.length) return 0;
  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageFlagsAdd(list.join(","), ["\\Seen"], { uid: true });
    return list.length;
  } finally {
    lock.release();
  }
}

/**
 * Put the portal's own send into the Sent folder, flagged \Seen (the rep
 * wrote it). Returns the new UID, or null when the server gave none.
 */
export async function appendToSent(client, folder, raw) {
  const result = await client.append(folder, raw, ["\\Seen"], new Date());
  if (!result) return { uid: null, uidValidity: null };
  return {
    uid: result.uid !== undefined ? Number(result.uid) : null,
    uidValidity: result.uidValidity !== undefined ? Number(result.uidValidity) : null,
  };
}
