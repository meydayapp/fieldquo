// lib/sales/mailbox/sync.js
//
// One sync of one connected mailbox: what is new in INBOX and Sent, filed;
// what the rep read elsewhere, mirrored; what a lead now claims, attached.
//
// ══ UID polling, once a minute ════════════════════════════════════════════
//
// IMAP IDLE would tell us the instant a message arrives, and it needs a
// socket that stays open — which a Vercel function cannot keep. So the cron
// (app/api/cron/sales-mailbox-sync) calls this every minute per connected
// mailbox, and this asks the server for everything above the last UID it
// stored, per folder. A minute is the honest latency; the rep's phone still
// rings first, and that is fine — the portal is a second window.
//
// ══ Two-way, and the exact writes it makes to the server ══════════════════
//
//   · \Seen on messages the rep read in the portal (markSeen, called by the
//     thread's read route — lib/sales/mailbox/readMirror.js), and
//   · the portal's own send appended to Sent (lib/sales/mailbox/send.js).
//
// That is the whole list. This file never deletes, moves, flags \Deleted or
// expunges anything, and scripts/check-sales-mailbox.mjs asserts by scanning
// this directory that the words never appear.
//
// ══ Every dependency is a parameter ═══════════════════════════════════════
//
// The database, the IMAP session, the MIME parser, the upload, the push, the
// clock. The rules worth executing — a redelivered UID files nothing, our
// own appended send is recognised and not filed twice, a message read on the
// phone is read here, a lead created later claims its earlier mail, a
// UIDVALIDITY change restarts the folder without duplicating — are
// properties of a sequence of calls against fakes, not of the source.

import { simpleParser } from "mailparser";
import { withImap, fetchFlags, fetchNewInFolder, describeImapError } from "./imap";
import { normaliseParsedMail, normaliseSubject } from "./parse";
import { chooseThread, leadAddressIndex, matchLead } from "./threading";
import { openMailboxSecret } from "./secret";
import { storeAttachmentBuffers } from "../inboundAttachments";
import { detectOptOut, newReplyToken, sanitiseHeaderText } from "../outreach";
import { suppressWithin } from "../suppression";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { snippetOf } from "../emailInbox";

/** A sync lock older than this belonged to a function that died; take it over. */
export const SYNC_STALE_MS = 10 * 60 * 1000;

/** How many unseen-held messages have their flags re-read per sync. */
export const FLAG_MIRROR_LIMIT = 200;

/** A message this new is announced; older ones are backfill, not news. */
export const NOTIFY_WINDOW_MS = 30 * 60 * 1000;

// contactEmails is what lets a hand-written email to an address the rep added
// on the card file under the lead — see leadAddresses() in threading.js.
const LEAD_SELECT = {
  id: true,
  email: true,
  phone: true,
  prospect: { select: { email: true } },
  contactEmails: { select: { email: true } },
};

/**
 * @param db
 * @param mailbox  the full SalesMailbox row (with `secret`)
 * @param deps     { imap = withImap, parse = simpleParser, upload,
 *                   notify = pushToReps, now = () => new Date() }
 * @returns { ok, reason?, filed, mirrored, matched, error? }
 */
export async function syncMailbox(db, mailbox, deps = {}) {
  const {
    imap = withImap,
    parse = simpleParser,
    upload = undefined,
    notify = pushToReps,
    now = () => new Date(),
  } = deps;

  if (!mailbox || mailbox.status === "revoked" || !mailbox.secret) {
    return { ok: false, reason: "not_connected", filed: 0, mirrored: 0, matched: 0 };
  }

  // ── The lock ────────────────────────────────────────────────────────────
  const at = now();
  const claimed = await db.salesMailbox.updateMany({
    where: {
      id: mailbox.id,
      OR: [{ syncingSince: null }, { syncingSince: { lt: new Date(at.getTime() - SYNC_STALE_MS) } }],
    },
    data: { syncingSince: at },
  });
  if (!claimed.count) return { ok: false, reason: "busy", filed: 0, mirrored: 0, matched: 0 };

  let password;
  try {
    password = openMailboxSecret(mailbox.secret);
  } catch (err) {
    await db.salesMailbox.update({
      where: { id: mailbox.id },
      data: { syncingSince: null, status: "error", lastError: `The stored password could not be read (${err?.message || "wrong key"}); connect the mailbox again.`, lastErrorAt: at },
    });
    return { ok: false, reason: "secret_unreadable", filed: 0, mirrored: 0, matched: 0 };
  }

  const leads = await db.salesLead.findMany({ where: { salesRepId: mailbox.salesRepId }, select: LEAD_SELECT });
  const self = String(mailbox.address || "").toLowerCase();
  const totals = { filed: 0, mirrored: 0, matched: 0, skipped: 0 };
  const position = {};
  const announce = [];

  try {
    await imap(mailbox, password, async (client) => {
      // ── New mail, per folder ──────────────────────────────────────────
      const folders = [
        { name: "INBOX", lastUid: mailbox.inboxLastUid, uidValidity: mailbox.inboxUidValidity, keys: ["inboxLastUid", "inboxUidValidity"] },
        ...(mailbox.sentFolder
          ? [{ name: mailbox.sentFolder, lastUid: mailbox.sentLastUid, uidValidity: mailbox.sentUidValidity, keys: ["sentLastUid", "sentUidValidity"] }]
          : []),
      ];
      for (const folder of folders) {
        const pulled = await fetchNewInFolder(client, folder.name, { lastUid: folder.lastUid, uidValidity: folder.uidValidity });
        let highest = pulled.reset ? 0 : Number(folder.lastUid || 0);
        // The first sync of a folder is backfill: nothing in it is news.
        const firstSync = pulled.reset || !folder.lastUid;
        for (const m of pulled.messages) {
          const outcome = await fileOne(db, { mailbox, folder: folder.name, self, leads, message: m, parse, upload, now });
          if (outcome.filed) totals.filed += 1;
          else totals.skipped += 1;
          if (outcome.leadId) totals.matched += 1;
          if (outcome.filed && outcome.direction === "in" && !outcome.seen && !firstSync) announce.push(outcome);
          highest = Math.max(highest, m.uid);
        }
        position[folder.keys[0]] = highest;
        position[folder.keys[1]] = pulled.uidValidity;
      }

      // ── Read on the phone since last time ─────────────────────────────
      totals.mirrored += await mirrorSeenFromServer(db, client, mailbox, now);
    });
  } catch (err) {
    const sentence = describeImapError(err, mailbox);
    await db.salesMailbox.update({
      where: { id: mailbox.id },
      data: {
        syncingSince: null,
        lastError: sentence,
        lastErrorAt: now(),
        ...position,
        // A refused password is the owner's to fix and the card's Retry is
        // the way; a network blip is not, and the next minute will tell.
        ...(err?.authenticationFailed ? { status: "error" } : {}),
      },
    });
    return { ok: false, reason: "imap_failed", error: sentence, ...totals };
  }

  // ── A lead created since claims its earlier mail ────────────────────────
  totals.matched += await claimUnmatchedThreads(db, mailbox.salesRepId, leads);

  await db.salesMailbox.update({
    where: { id: mailbox.id },
    data: {
      ...position,
      syncingSince: null,
      status: "connected",
      lastSyncAt: now(),
      lastSyncCount: totals.filed,
      lastError: null,
      lastErrorAt: null,
    },
  });

  // ── Tell the rep, after the writes, never instead of them ───────────────
  for (const a of announce.slice(0, 5)) {
    await notify({
      salesRepIds: [mailbox.salesRepId],
      payload: async (language) => ({
        title: await appSentence(language, "app.notify.newEmail.title", { from: a.who }),
        body: snippetOf(a.body, 90),
        tag: `sales-email:${a.threadId}`,
        url: `/sales/threads?open=${encodeURIComponent(a.threadId)}`,
      }),
    }).catch(() => {});
  }

  return { ok: true, ...totals };
}

/**
 * One fetched message → one SalesMessage (or a skip), with its thread.
 *
 * @returns { filed, reason?, threadId?, direction?, seen?, leadId?, who?, body? }
 */
export async function fileOne(db, { mailbox, folder, self, leads, message, parse = simpleParser, upload, now = () => new Date() }) {
  let normal;
  if (message.tooLarge || !message.source) {
    normal = fromEnvelopeOnly(message, { folder, self });
  } else {
    let parsed;
    try {
      parsed = await parse(message.source);
    } catch (err) {
      normal = fromEnvelopeOnly(message, { folder, self, note: `This message could not be parsed (${err?.message || "unknown"}); open it in your mailbox.` });
    }
    if (parsed) normal = normaliseParsedMail(parsed, { folder, self });
  }

  const seen = message.flags instanceof Set ? message.flags.has("\\Seen") : Array.isArray(message.flags) ? message.flags.includes("\\Seen") : false;
  const sentAt = normal.sentAt || now();

  // ── Already ours? ───────────────────────────────────────────────────────
  //
  // By Message-ID across the rep's threads: our own send appended to Sent
  // comes back here on the next sync with the id lib/sales/mailbox/send.js
  // minted; a redelivered UID after a UIDVALIDITY reset does too. The row
  // learns where it sits in the mailbox and nothing else changes.
  if (normal.messageId) {
    const held = await db.salesMessage.findFirst({
      where: { messageId: normal.messageId, thread: { salesRepId: mailbox.salesRepId } },
      select: { id: true, imapUid: true, threadId: true },
    });
    if (held) {
      if (held.imapUid === null || held.imapUid === undefined) {
        await db.salesMessage.update({ where: { id: held.id }, data: { imapFolder: folder, imapUid: message.uid, seen } });
      }
      return { filed: false, reason: "already_held", threadId: held.threadId };
    }
  }

  // A message with NO Message-ID (rare, but a web form or a broken client
  // sends one) cannot be recognised by id, so after a UIDVALIDITY reset it
  // would be filed again. Its content is its identity instead: same sender,
  // subject and body on one of the rep's threads is the same message.
  if (!normal.messageId) {
    const same = await db.salesMessage.findFirst({
      where: {
        direction: normal.direction,
        fromAddress: normal.fromAddress || "unknown",
        subject: normal.subject || "",
        body: normal.body || "",
        thread: { salesRepId: mailbox.salesRepId },
      },
      select: { id: true, threadId: true },
    });
    if (same) return { filed: false, reason: "already_held", threadId: same.threadId };
  }

  // ── Which thread ────────────────────────────────────────────────────────
  const chain = [normal.inReplyTo, ...normal.references].filter(Boolean);
  const byMessageId = new Map();
  if (chain.length) {
    const hits = await db.salesMessage.findMany({
      where: { messageId: { in: chain }, thread: { salesRepId: mailbox.salesRepId } },
      select: { messageId: true, threadId: true },
    });
    for (const h of hits) byMessageId.set(h.messageId, h.threadId);
  }
  const subjectKey = normaliseSubject(normal.subject);
  const bySubject = normal.counterpart
    ? (
        await db.salesThread.findMany({
          where: { salesRepId: mailbox.salesRepId, counterpart: normal.counterpart },
          orderBy: { lastMessageAt: "desc" },
          take: 20,
          select: { id: true, subject: true, lastMessageAt: true },
        })
      )
        .filter((t) => normaliseSubject(t.subject) === subjectKey)
        .map((t) => ({ threadId: t.id, lastMessageAt: t.lastMessageAt }))
    : [];
  const choice = chooseThread(normal, { byMessageId, bySubject });
  const leadId = matchLead(normal.counterpart, leads);
  const lead = leadId ? leads.find((l) => l.id === leadId) : null;

  // ── Attachments, before the transaction (uploads are slow and external) ──
  let stored = null;
  if (normal.attachments?.length) {
    const result = await storeAttachmentBuffers({
      files: normal.attachments,
      folder: `sales-mailbox/${mailbox.id}`,
      ...(upload ? { uploadImpl: upload } : {}),
    });
    stored = result.stored;
  }

  const optOut = normal.direction === "in" && detectOptOut(normal.body);

  const written = await db.$transaction(async (tx) => {
    const threadId =
      choice.threadId ||
      (
        await tx.salesThread.create({
          data: {
            salesRepId: mailbox.salesRepId,
            leadId,
            mailboxId: mailbox.id,
            counterpart: normal.counterpart,
            subject: normal.subject || "(no subject)",
            replyToken: newReplyToken(),
            lastMessageAt: sentAt,
            lastInboundAt: normal.direction === "in" ? sentAt : null,
            // Read on the phone already → read here. Unseen → unread here.
            readAt: normal.direction === "in" && seen ? sentAt : null,
          },
          select: { id: true },
        })
      ).id;

    const created = await tx.salesMessage.create({
      data: {
        threadId,
        direction: normal.direction,
        fromAddress: normal.fromAddress || "unknown",
        toAddress: normal.toAddress || "",
        ccAddresses: normal.ccAddresses,
        subject: normal.subject || "",
        body: normal.body || "",
        messageId: normal.messageId,
        inReplyTo: normal.inReplyTo,
        references: normal.references.length ? normal.references.join(" ") : null,
        imapFolder: folder,
        imapUid: message.uid,
        seen,
        filedBy: "mailbox",
        attachments: stored,
        sentAt,
      },
      select: { id: true },
    });

    await tx.salesThread.updateMany({ where: { id: threadId, lastMessageAt: { lt: sentAt } }, data: { lastMessageAt: sentAt } });
    if (normal.direction === "in") {
      await tx.salesThread.updateMany({
        where: { id: threadId, OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: sentAt } }] },
        data: { lastInboundAt: sentAt, archivedAt: null },
      });
      if (seen) {
        await tx.salesThread.updateMany({ where: { id: threadId, OR: [{ readAt: null }, { readAt: { lt: sentAt } }] }, data: { readAt: sentAt } });
      }
    }
    // Fill a blank, never overwrite: a thread nobody's lead owned yet.
    if (choice.threadId && leadId) {
      await tx.salesThread.updateMany({ where: { id: threadId, leadId: null }, data: { leadId, counterpart: normal.counterpart } });
    }

    // The same opt-out rule the Resend door applies (lib/sales/outreachInbound.js):
    // keyed on the LEAD's address, in the same transaction as the message.
    if (optOut && lead?.email) {
      await suppressWithin(tx, {
        kind: "email",
        value: lead.email,
        source: "reply",
        reason: "Replied to a sales email asking not to be contacted again.",
        salesLeadId: lead.id,
        salesMessageId: created.id,
        requestedAt: sentAt,
      });
    }
    return { threadId, messageId: created.id };
  });

  return {
    filed: true,
    threadId: written.threadId,
    messageId: written.messageId,
    direction: normal.direction,
    seen,
    leadId,
    who: sanitiseHeaderText(normal.fromAddress, 120) || normal.counterpart || "a prospect",
    body: normal.body,
    optOut,
  };
}

/** Headers only — for a message too large to fetch, or one that would not parse. */
function fromEnvelopeOnly(message, { folder, self, note }) {
  const env = message.envelope || {};
  const addr = (list) => (Array.isArray(list) ? list : []).map((a) => (a?.name ? `${a.name} <${String(a.address || "").toLowerCase()}>` : String(a?.address || "").toLowerCase())).filter(Boolean);
  const bare = (list) => (Array.isArray(list) ? list : []).map((a) => String(a?.address || "").toLowerCase()).filter(Boolean);
  const direction = folder && folder !== "INBOX" ? "out" : "in";
  const me = String(self || "").toLowerCase();
  const others = direction === "in" ? bare(env.from) : [...bare(env.to), ...bare(env.cc)].filter((a) => a !== me);
  const mb = message.size ? `${(message.size / 1024 / 1024).toFixed(1)} MB` : "";
  return {
    direction,
    fromAddress: addr(env.from).join(", "),
    toAddress: addr(env.to).join(", "),
    ccAddresses: addr(env.cc).join(", ") || null,
    counterpart: others[0] || null,
    subject: sanitiseHeaderText(env.subject, 500),
    body: note || `This message is too large to store here${mb ? ` (${mb})` : ""}. Open it in your mailbox.`,
    messageId: env.messageId ? String(env.messageId).replace(/^<|>$/g, "") : null,
    inReplyTo: env.inReplyTo ? String(env.inReplyTo).replace(/^<|>$/g, "") : null,
    references: [],
    sentAt: env.date instanceof Date ? env.date : null,
    attachments: [],
  };
}

/**
 * Messages we hold as unseen whose server flag is now \Seen — the rep read
 * them on the phone. Their thread becomes read when none of its inbound
 * messages are unseen any more.
 */
export async function mirrorSeenFromServer(db, client, mailbox, now = () => new Date()) {
  const unseen = await db.salesMessage.findMany({
    where: { direction: "in", seen: false, imapFolder: "INBOX", imapUid: { not: null }, thread: { salesRepId: mailbox.salesRepId, mailboxId: mailbox.id } },
    take: FLAG_MIRROR_LIMIT,
    select: { id: true, imapUid: true, threadId: true },
  });
  if (!unseen.length) return 0;
  const flags = await fetchFlags(client, "INBOX", unseen.map((m) => m.imapUid));
  const nowSeen = unseen.filter((m) => flags.get(m.imapUid)?.has("\\Seen"));
  if (!nowSeen.length) return 0;
  await db.salesMessage.updateMany({ where: { id: { in: nowSeen.map((m) => m.id) } }, data: { seen: true } });
  const threads = [...new Set(nowSeen.map((m) => m.threadId))];
  for (const threadId of threads) {
    const stillUnseen = await db.salesMessage.count({ where: { threadId, direction: "in", seen: false } });
    if (!stillUnseen) await db.salesThread.update({ where: { id: threadId }, data: { readAt: now() } });
  }
  return nowSeen.length;
}

/**
 * Threads with no lead whose counterpart is now one of the rep's leads — by
 * ANY of the lead's addresses (leadAddressIndex), the same rule fileOne uses
 * for new mail, so a thread the sync could not place yesterday is placed the
 * moment the rep records the address on the card.
 *
 * Runs on every sync and is idempotent: only `leadId: null` rows are touched,
 * and each is written with that guard in the where, so two syncs racing
 * cannot both claim one. This is the backfill for the threads filed under
 * "Everything else" before contact emails counted — no script, no one-off
 * flag; the next sync of each mailbox re-attaches its rep's orphans.
 */
export async function claimUnmatchedThreads(db, salesRepId, leads) {
  const byEmail = leadAddressIndex(leads);
  const addresses = [...byEmail.entries()].filter(([, id]) => id).map(([a]) => a);
  if (!addresses.length) return 0;
  const orphans = await db.salesThread.findMany({
    where: { salesRepId, leadId: null, counterpart: { in: addresses } },
    select: { id: true, counterpart: true },
  });
  let n = 0;
  for (const t of orphans) {
    const leadId = byEmail.get(String(t.counterpart || "").toLowerCase());
    if (!leadId) continue;
    const r = await db.salesThread.updateMany({ where: { id: t.id, leadId: null }, data: { leadId } });
    n += r?.count ?? 1;
  }
  return n;
}
