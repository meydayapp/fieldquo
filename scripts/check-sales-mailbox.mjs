// scripts/check-sales-mailbox.mjs
//
// The rep's connected mailbox and the inbox built on it, executed against
// fixtures and fakes — never against Namecheap.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-sales-mailbox.mjs
//
// Sections:
//   1. MIME → the filed shape: multipart, HTML-only, a quoted reply, one
//      with attachments, one with no headers a good client sends.
//   2. Threading by References, by subject inside the window, or a new
//      thread; lead matching by address and by prospect address.
//   3. The password at rest: seal → open round-trips, a wrong key fails
//      loud, no route returns the column, nothing in lib/sales/mailbox
//      deletes, moves or expunges.
//   4. SMTP send, mocked: one composed message, the Message-ID minted on
//      the rep's domain, the Sent append after the send and never before,
//      an append failure that does not un-send.
//   5. The sync against a fake IMAP and a fake database: a first sync files
//      and announces nothing; a second files the new UID and announces it;
//      our own appended send comes back and is NOT filed twice; a message
//      read on the phone becomes read here; a lead created later claims its
//      thread; a UIDVALIDITY change restarts without duplicates.
//   6. The inbox arithmetic: unread, labels, snippets, folders, search.
//   7. Recipients: the closed set, a forged address refused by name.
//   8. Formatting and quoting: the four marks, escaping, the fold.
//   9. Drafts: save / continue / empty-deletes / discard.
//  10. Readiness: the three blockers, and the rep-facing sentence.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { simpleParser } from "mailparser";

import { normaliseParsedMail, normaliseSubject, cleanMessageId, referencesList } from "../lib/sales/mailbox/parse.js";
import { chooseThread, matchLead, SUBJECT_MATCH_WINDOW_MS } from "../lib/sales/mailbox/threading.js";
import { sendFromMailbox } from "../lib/sales/mailbox/send.js";
import { composeMessage, mintMessageId } from "../lib/sales/mailbox/smtp.js";
import { syncMailbox } from "../lib/sales/mailbox/sync.js";
import { outreachReadiness } from "../lib/sales/outreachReadiness.js";
import { isUnread, threadLabels, snippetOf, folderWhere, searchWhere, folderOf } from "../lib/sales/emailInbox.js";
import { allowedRecipients, chooseRecipients, replyAllTargets, joinAddresses } from "../lib/sales/emailRecipients.js";
import { bodyHtml, inlineHtml, stripMarks } from "../lib/sales/emailFormat.js";
import { splitQuoted, replyBody, forwardBody, prefixedSubject } from "../lib/sales/emailQuote.js";
import { saveDraft, draftDataFrom, cleanAttachments } from "../lib/sales/emailDrafts.js";
import { visibleReplyText, detectOptOut } from "../lib/sales/outreach.js";

let passed = 0;
let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
section("1. MIME → the filed shape");

const MULTIPART = [
  "From: Dana Cole <dana@acmepainting.ca>",
  "To: Daniel <daniel@fieldquo.com>",
  "Cc: office@acmepainting.ca",
  "Subject: Re: Quick question about your quotes",
  "Date: Fri, 18 Sep 2026 09:15:00 -0400",
  "Message-ID: <abc123@acmepainting.ca>",
  "In-Reply-To: <first@fieldquo.com>",
  "References: <first@fieldquo.com>",
  'Content-Type: multipart/mixed; boundary="B1"',
  "",
  "--B1",
  'Content-Type: multipart/alternative; boundary="B2"',
  "",
  "--B2",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Sure, send it over.",
  "",
  "On Thu, 17 Sep 2026, Daniel wrote:",
  "> Would you like a quote?",
  "--B2",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Sure, <b>send</b> it over.</p><blockquote>Would you like a quote?</blockquote>",
  "--B2--",
  "--B1",
  "Content-Type: application/pdf; name=kitchen.pdf",
  "Content-Disposition: attachment; filename=kitchen.pdf",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("%PDF-1.4 fake").toString("base64"),
  "--B1--",
  "",
].join("\r\n");

{
  const parsed = await simpleParser(MULTIPART);
  const m = normaliseParsedMail(parsed, { folder: "INBOX", self: "daniel@fieldquo.com" });
  ok("direction follows the folder: INBOX is in", m.direction === "in");
  ok("the counterpart is the sender, bare and lowercase", m.counterpart === "dana@acmepainting.ca");
  ok("the From keeps the display name", m.fromAddress === "Dana Cole <dana@acmepainting.ca>");
  ok("the Cc is kept", m.ccAddresses === "office@acmepainting.ca");
  ok("text/plain wins over html", m.body.startsWith("Sure, send it over."));
  ok("the quoted tail is in the body (folded later, never lost)", m.body.includes("> Would you like a quote?"));
  ok("Message-ID has its brackets stripped", m.messageId === "abc123@acmepainting.ca");
  ok("In-Reply-To and References are clean ids", m.inReplyTo === "first@fieldquo.com" && m.references.join() === "first@fieldquo.com");
  ok("the date is the header's", m.sentAt instanceof Date && m.sentAt.toISOString().startsWith("2026-09-18T13:15"));
  ok("the attachment is carried with its bytes", m.attachments.length === 1 && m.attachments[0].filename === "kitchen.pdf" && Buffer.isBuffer(m.attachments[0].content));
}

const HTML_ONLY = [
  "From: <ROB@Plumbing.Example>",
  "To: daniel@fieldquo.com",
  "Subject: hello",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<html><body><p>Hi there</p><script>alert(1)</script><p>Call me &amp; we'll talk</p></body></html>",
  "",
].join("\r\n");
{
  const m = normaliseParsedMail(await simpleParser(HTML_ONLY), { folder: "INBOX", self: "daniel@fieldquo.com" });
  ok("html-only is flattened to text", m.body.replace(/\s+/g, " ").trim() === "Hi there Call me & we'll talk");
  ok("script content never reaches the body", !m.body.includes("alert"));
  ok("an upper-case sender is lower-cased as the counterpart", m.counterpart === "rob@plumbing.example");
  ok("no Message-ID → null, not a string 'undefined'", m.messageId === null);
  ok("no date → null (the sync stamps now)", m.sentAt === null);
  ok("no References → an empty list", Array.isArray(m.references) && m.references.length === 0);
}

const SENT_BY_REP = [
  "From: Daniel <daniel@fieldquo.com>",
  "To: Dana <dana@acmepainting.ca>, daniel@fieldquo.com",
  "Subject: Fwd: Re: Quick question about your quotes",
  "Date: Fri, 18 Sep 2026 09:20:00 -0400",
  "Message-ID: <out1@fieldquo.com>",
  "Content-Type: text/plain",
  "",
  "See below",
  "",
].join("\r\n");
{
  const m = normaliseParsedMail(await simpleParser(SENT_BY_REP), { folder: "Sent", self: "daniel@fieldquo.com" });
  ok("a message in Sent is out", m.direction === "out");
  ok("the counterpart of an outbound message is the first To that is not the rep", m.counterpart === "dana@acmepainting.ca");
  ok("normaliseSubject strips Re:/Fwd: chains", normaliseSubject(m.subject) === "quick question about your quotes");
}
ok("cleanMessageId tolerates a bare id", cleanMessageId("bare@id") === "bare@id" && cleanMessageId("") === null);
ok("referencesList dedupes and orders", referencesList("<a@x> <b@x> <a@x>").join() === "a@x,b@x");
ok("normaliseSubject handles French/German prefixes", normaliseSubject("TR: AW: Devis") === "devis");

// ═══════════════════════════════════════════════════════════════════════════
section("2. Threading and matching");
{
  const byMessageId = new Map([["first@fieldquo.com", "t1"]]);
  const msg = { inReplyTo: "nope@x", references: ["first@fieldquo.com"], sentAt: new Date() };
  ok("a References hit chooses the thread", chooseThread(msg, { byMessageId }).how === "references");
  const foreign = { inReplyTo: "zzz@other", references: ["yyy@other"], sentAt: new Date() };
  ok("a foreign chain with no subject match is a new thread", chooseThread(foreign, { byMessageId }).threadId === null);
  const now = Date.now();
  const bySubject = [{ threadId: "t2", lastMessageAt: new Date(now - SUBJECT_MATCH_WINDOW_MS / 2) }];
  ok("a subject match inside the window joins it", chooseThread({ sentAt: new Date(now) }, { byMessageId: new Map(), bySubject }).threadId === "t2");
  const old = [{ threadId: "t3", lastMessageAt: new Date(now - SUBJECT_MATCH_WINDOW_MS * 2) }];
  ok("a subject match OUTSIDE the window is a new thread", chooseThread({ sentAt: new Date(now) }, { byMessageId: new Map(), bySubject: old }).threadId === null);
  ok("nothing at all is a new thread", chooseThread({}, {}).threadId === null);
  const leads = [
    { id: "l1", email: "dana@acmepainting.ca", prospect: null },
    { id: "l2", email: null, prospect: { email: "rob@plumbing.example" } },
    { id: "l3", email: "dup@x.ca" },
    { id: "l4", email: "DUP@x.ca" },
  ];
  ok("matchLead by the lead's own address, case-insensitive", matchLead("DANA@acmepainting.ca", leads) === "l1");
  ok("matchLead by the prospect's address when the lead has none", matchLead("rob@plumbing.example", leads) === "l2");
  ok("two leads at one address match nobody", matchLead("dup@x.ca", leads) === null);
  ok("a stranger matches nobody", matchLead("stranger@nowhere.tld", leads) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The password at rest, and what the code can never do");
{
  process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const { sealMailboxSecret, openMailboxSecret, mailboxSecretsConfigured } = await import("../lib/sales/mailbox/secret.js");
  ok("the key is seen as configured", mailboxSecretsConfigured());
  const blob = sealMailboxSecret("hunter2-ünïcode");
  ok("sealed is not the plaintext", !blob.includes("hunter2"));
  ok("open round-trips", openMailboxSecret(blob) === "hunter2-ünïcode");
  ok("two seals of one password differ (random iv)", sealMailboxSecret("same") !== sealMailboxSecret("same"));
  process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  let threw = false;
  try {
    openMailboxSecret(blob);
  } catch {
    threw = true;
  }
  ok("a wrong key fails loud, not as an empty string", threw);
  process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  // No route returns the column.
  const routes = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "route.js") routes.push(p);
    }
  };
  walk(path.join(ROOT, "app/api"));
  const leaking = routes.filter((p) => /\bsecret\s*:\s*true\b/.test(readFileSync(p, "utf8")));
  ok(`no route under /api selects the mailbox secret (${routes.length} routes scanned)`, leaking.length === 0, leaking);

  // Nothing in the mailbox directory deletes, moves or expunges.
  const dir = path.join(ROOT, "lib/sales/mailbox");
  const offenders = [];
  for (const name of readdirSync(dir)) {
    const src = readFileSync(path.join(dir, name), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const word of ["messageDelete", "messageMove", "expunge", "mailboxDelete", "\\\\Deleted", "messageFlagsRemove"]) {
      if (src.includes(word)) offenders.push(`${name}: ${word}`);
    }
  }
  ok("lib/sales/mailbox never deletes, moves, expunges or clears a flag on the server", offenders.length === 0, offenders);
  const imapSrc = read("lib/sales/mailbox/imap.js");
  ok("imapflow is constructed with logger: false (no LOGIN line in a log)", /logger:\s*false/.test(imapSrc));
  const storeSrc = read("lib/sales/mailbox/store.js");
  ok("the public select has no secret", !/secret:\s*true/.test(storeSrc.slice(storeSrc.indexOf("MAILBOX_PUBLIC_SELECT"), storeSrc.indexOf("function cleanHost"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. SMTP send, mocked");
{
  const mailbox = { id: "mb1", address: "daniel@fieldquo.com", imapHost: "h", imapPort: 993, smtpHost: "h", smtpPort: 465, status: "connected", sentFolder: "Sent", secret: (await import("../lib/sales/mailbox/secret.js")).sealMailboxSecret("pw") };
  const calls = [];
  const send = async (mb, pw, { raw, envelope }) => {
    calls.push(["send", pw, raw.toString(), envelope]);
    return { ok: true };
  };
  const imap = async (mb, pw, fn) => {
    calls.push(["imap", pw]);
    return fn({ append: async () => ({ uid: 77, uidValidity: 5 }), getMailboxLock: async () => ({ release() {} }) });
  };
  const r = await sendFromMailbox(mailbox, { from: { name: "Daniel", address: "daniel@fieldquo.com" }, to: ["dana@acmepainting.ca"], cc: ["office@acmepainting.ca"], subject: "Hi", text: "hello", html: "<p>hello</p>", inReplyTo: "abc123@acmepainting.ca", references: ["first@fieldquo.com", "abc123@acmepainting.ca"] }, { send, imap });
  ok("the send succeeds", r.ok, r);
  ok("the Message-ID is minted on the rep's domain", /@fieldquo\.com$/.test(r.messageId));
  ok("the raw carries that Message-ID", calls[0][2].includes(`Message-ID: <${r.messageId}>`));
  ok("the raw carries In-Reply-To and References", /In-Reply-To: <abc123@acmepainting\.ca>/.test(calls[0][2]) && /References: <first@fieldquo\.com> <abc123@acmepainting\.ca>/.test(calls[0][2]));
  ok("the envelope goes to To and Cc", calls[0][3].to.join() === "dana@acmepainting.ca,office@acmepainting.ca");
  ok("the password opened for the session is the plaintext", calls[0][1] === "pw" && calls[1][1] === "pw");
  ok("the Sent append happens AFTER the send", calls[0][0] === "send" && calls[1][0] === "imap");
  ok("the appended UID is reported with its folder", r.imapUid === 77 && r.imapFolder === "Sent");

  const refused = await sendFromMailbox(mailbox, { from: { address: "d@f" }, to: ["x@y"], subject: "s", text: "t" }, { send: async () => ({ ok: false, error: "535 bad" }), imap });
  ok("a refused send is ok:false with the reason", refused.ok === false && /535/.test(refused.error));
  const appendFailed = await sendFromMailbox(mailbox, { from: { address: "d@f" }, to: ["x@y"], subject: "s", text: "t" }, { send, imap: async () => { throw new Error("IMAP down"); } });
  ok("an append failure does NOT un-send: ok:true, uid null, the error named", appendFailed.ok && appendFailed.imapUid === null && /IMAP down/.test(appendFailed.appendError));
  const notConnected = await sendFromMailbox({ ...mailbox, status: "error" }, {}, { send, imap });
  ok("a mailbox that is not connected sends nothing", notConnected.ok === false);
  ok("mintMessageId falls back to fieldquo.com", /@fieldquo\.com$/.test(mintMessageId("")));
  const composed = await composeMessage({ from: { address: "a@b.c" }, to: ["d@e.f"], subject: "x", text: "hi" });
  ok("composeMessage yields bytes and an id", Buffer.isBuffer(composed.raw) && composed.messageId);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The sync, against a fake IMAP and a fake database");

function fakeDb({ leads = [] } = {}) {
  const state = { threads: [], messages: [], mailboxes: [], leads: [...leads], suppressions: [], writes: [] };
  let n = 1;
  const id = (p) => `${p}${n++}`;
  const matchWhere = (row, where) => {
    for (const [k, v] of Object.entries(where || {})) {
      if (k === "OR") {
        if (!v.some((w) => matchWhere(row, w))) return false;
        continue;
      }
      if (k === "thread") {
        const t = state.threads.find((x) => x.id === row.threadId);
        if (!t || !matchWhere(t, v)) return false;
        continue;
      }
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v && !v.in.includes(row[k])) return false;
        if ("not" in v && (v.not === null ? row[k] === null || row[k] === undefined : row[k] === v.not)) return false;
        if ("lt" in v && !(row[k] !== null && row[k] !== undefined && new Date(row[k]) < new Date(v.lt))) return false;
        continue;
      }
      if (v === null ? row[k] !== null && row[k] !== undefined : row[k] !== v) return false;
    }
    return true;
  };
  const table = (rows, model) => ({
    findFirst: async ({ where }) => rows.find((r) => matchWhere(r, where)) || null,
    findUnique: async ({ where }) => rows.find((r) => matchWhere(r, where)) || null,
    findMany: async ({ where, take, orderBy } = {}) => {
      let out = rows.filter((r) => matchWhere(r, where));
      if (orderBy?.lastMessageAt === "desc") out = [...out].sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      return take ? out.slice(0, take) : out;
    },
    count: async ({ where }) => rows.filter((r) => matchWhere(r, where)).length,
    create: async ({ data }) => {
      const row = { id: id(model[0]), ...data };
      rows.push(row);
      state.writes.push([model, "create", row]);
      return row;
    },
    update: async ({ where, data }) => {
      const row = rows.find((r) => matchWhere(r, where));
      Object.assign(row, data);
      state.writes.push([model, "update", where, data]);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const hits = rows.filter((r) => matchWhere(r, where));
      for (const r of hits) Object.assign(r, data);
      state.writes.push([model, "updateMany", where, data, hits.length]);
      return { count: hits.length };
    },
  });
  const client = {
    salesThread: table(state.threads, "thread"),
    salesMessage: table(state.messages, "message"),
    salesMailbox: table(state.mailboxes, "mailbox"),
    salesLead: table(state.leads, "lead"),
    salesSuppression: { findUnique: async () => null, findMany: async () => [], upsert: async ({ create }) => { state.suppressions.push(create); return { id: "sup1", ...create }; } },
    salesSuppressionEvent: { create: async ({ data }) => ({ id: "ev1", ...data }) },
    $transaction: async (fn) => fn(client),
    __state: state,
  };
  return client;
}

function fakeImap(server) {
  // server: { INBOX: { uidValidity, messages: [{ uid, flags:Set, source }] }, Sent: {...} }
  return async (mailbox, password, fn) => {
    const client = { mailbox: null, folder: null };
    client.getMailboxLock = async (folder) => {
      const rows = server[folder].messages;
      client.mailbox = { uidValidity: BigInt(server[folder].uidValidity), uidNext: Math.max(0, ...rows.map((m) => m.uid)) + 1 };
      client.folder = folder;
      return { release() {} };
    };
    client.fetch = async function* (range) {
      const rows = server[client.folder].messages;
      let hits;
      if (String(range).includes(":")) {
        const [a, b] = String(range).split(":");
        const from = Number(a);
        hits = rows.filter((m) => m.uid >= from);
        // IMAP semantics: "N:*" with nothing above N answers the highest message.
        if (!hits.length && b === "*" && rows.length) hits = [rows.reduce((x, y) => (y.uid > x.uid ? y : x))];
      } else {
        const wanted = String(range).split(",").map(Number);
        hits = rows.filter((m) => wanted.includes(m.uid));
      }
      for (const m of hits) yield { uid: m.uid, flags: m.flags, size: m.source ? m.source.length : 0, envelope: null };
    };
    client.fetchOne = async (uid) => {
      const m = server[client.folder].messages.find((x) => x.uid === Number(uid));
      return m ? { uid: m.uid, source: Buffer.from(m.source) } : null;
    };
    client.messageFlagsAdd = async () => true;
    client.append = async () => ({ uid: 999, uidValidity: 1 });
    return fn(client);
  };
}

{
  process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const { sealMailboxSecret } = await import("../lib/sales/mailbox/secret.js");
  const db = fakeDb({ leads: [{ id: "l1", salesRepId: "r1", email: "dana@acmepainting.ca", phone: null, prospect: null }] });
  const mailbox = { id: "mb1", salesRepId: "r1", address: "daniel@fieldquo.com", imapHost: "h", imapPort: 993, status: "connected", secret: sealMailboxSecret("pw"), sentFolder: "Sent", inboxUidValidity: null, inboxLastUid: 0, sentUidValidity: null, sentLastUid: 0, syncingSince: null };
  db.__state.mailboxes.push({ ...mailbox });
  const server = {
    INBOX: { uidValidity: 1, messages: [{ uid: 1, flags: new Set(["\\Seen"]), source: MULTIPART }, { uid: 2, flags: new Set(), source: HTML_ONLY }] },
    Sent: { uidValidity: 1, messages: [{ uid: 1, flags: new Set(["\\Seen"]), source: SENT_BY_REP }] },
  };
  const pushes = [];
  const notify = async (p) => { pushes.push(p); };
  const upload = async (buf, { folder }) => ({ secure_url: `https://res.cloudinary.com/demo/raw/upload/${folder}/x.pdf` });
  const deps = { imap: fakeImap(server), notify, upload, parse: simpleParser };

  const first = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("the first sync files all three messages", first.ok && first.filed === 3, first);
  ok("the first sync (backfill) announces nothing", pushes.length === 0);
  const mb = db.__state.mailboxes[0];
  ok("the sync position is stored per folder", mb.inboxLastUid === 2 && mb.sentLastUid === 1 && mb.inboxUidValidity === 1);
  ok("the lock is released and the status is connected", mb.syncingSince === null && mb.status === "connected" && mb.lastError === null);
  const threads = db.__state.threads;
  const dana = threads.find((t) => t.counterpart === "dana@acmepainting.ca");
  ok("Dana's inbound and the rep's Sent to her share ONE thread (subject match)", dana && db.__state.messages.filter((m) => m.threadId === dana.id).length === 2, threads.map((t) => t.counterpart));
  ok("Dana's thread is matched to her lead", dana?.leadId === "l1");
  ok("Dana's message was \\Seen on the server, so the thread is read here", dana && !isUnread(dana));
  const rob = threads.find((t) => t.counterpart === "rob@plumbing.example");
  ok("Rob's thread has nobody's lead (Everything else)", rob && rob.leadId === null);
  ok("Rob's message was unseen, so his thread is unread here", rob && isUnread(rob));
  const danaMsg = db.__state.messages.find((m) => m.messageId === "abc123@acmepainting.ca");
  ok("the attachment was re-hosted onto the message", Array.isArray(danaMsg?.attachments) && danaMsg.attachments[0].url?.startsWith("https://res.cloudinary.com/"));
  ok("the message knows its place in the mailbox", danaMsg?.imapFolder === "INBOX" && danaMsg?.imapUid === 1 && danaMsg?.seen === true);

  // Second sync: a new unseen reply arrives; Rob's message got read on the phone.
  server.INBOX.messages.push({ uid: 3, flags: new Set(), source: MULTIPART.replace("<abc123@acmepainting.ca>", "<second@acmepainting.ca>").replace("Sure, send it over.", "unsubscribe").replace("09:15:00", "10:15:00") });
  server.INBOX.messages[1].flags = new Set(["\\Seen"]);
  const second = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("the second sync files only the new UID", second.ok && second.filed === 1, second);
  ok("the new reply is announced to the rep", pushes.length === 1 && pushes[0].salesRepIds[0] === "r1");
  ok("an opt-out in a synced reply suppresses the LEAD's address", db.__state.suppressions.length === 1 && db.__state.suppressions[0].value === "dana@acmepainting.ca");
  ok("the reply threaded by References onto Dana's thread", db.__state.messages.find((m) => m.messageId === "second@acmepainting.ca")?.threadId === dana.id);
  ok("Rob's message read on the phone is now read here (flag mirror)", second.mirrored === 1 && !isUnread(rob));
  ok("Dana's thread is unread again (unseen reply after readAt)", isUnread(dana));

  // Third sync: our own send, appended to Sent, comes back — and is not filed twice.
  const ours = db.__state.messages.filter((m) => m.direction === "out").length;
  db.__state.messages.push({ id: "ours", threadId: dana.id, direction: "out", messageId: "ours@fieldquo.com", imapUid: null, imapFolder: null });
  server.Sent.messages.push({ uid: 2, flags: new Set(["\\Seen"]), source: SENT_BY_REP.replace("<out1@fieldquo.com>", "<ours@fieldquo.com>") });
  const third = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("our own appended send is recognised and not filed twice", third.ok && third.filed === 0 && db.__state.messages.filter((m) => m.direction === "out").length === ours + 1);
  ok("…and learns its UID in Sent", db.__state.messages.find((m) => m.id === "ours").imapUid === 2);

  // A lead created later claims Rob's thread.
  db.__state.leads.push({ id: "l2", salesRepId: "r1", email: "rob@plumbing.example", prospect: null });
  const fourth = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("a lead created later claims its earlier thread", fourth.ok && rob.leadId === "l2");

  // UIDVALIDITY change: the folder restarts; Message-IDs stop duplicates.
  server.INBOX.uidValidity = 2;
  const before = db.__state.messages.length;
  const fifth = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("a UIDVALIDITY change re-reads the folder without duplicating", fifth.ok && db.__state.messages.length === before && db.__state.mailboxes[0].inboxUidValidity === 2, fifth);

  // Busy lock.
  db.__state.mailboxes[0].syncingSince = new Date();
  const busy = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("a running sync is not doubled", busy.ok === false && busy.reason === "busy");
  db.__state.mailboxes[0].syncingSince = new Date(Date.now() - 11 * 60 * 1000);
  const stale = await syncMailbox(db, db.__state.mailboxes[0], deps);
  ok("a stale lock is taken over", stale.ok === true);

  // A refused password marks the row for the owner's Retry.
  const authErr = Object.assign(new Error("AUTHENTICATIONFAILED"), { authenticationFailed: true });
  const bad = await syncMailbox(db, db.__state.mailboxes[0], { ...deps, imap: async () => { throw authErr; } });
  ok("a refused password: ok:false, status error, the sentence names the password", bad.ok === false && db.__state.mailboxes[0].status === "error" && /refused the password/.test(db.__state.mailboxes[0].lastError));
  ok("a revoked mailbox syncs nothing", (await syncMailbox(db, { ...mailbox, status: "revoked" }, deps)).reason === "not_connected");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The inbox arithmetic");
{
  const t = new Date("2026-09-18T10:00:00Z");
  const later = new Date("2026-09-18T11:00:00Z");
  ok("no inbound → not unread", !isUnread({ lastInboundAt: null, readAt: null }));
  ok("inbound, never read → unread", isUnread({ lastInboundAt: t, readAt: null }));
  ok("read after inbound → read", !isUnread({ lastInboundAt: t, readAt: later }));
  ok("inbound after read → unread", isUnread({ lastInboundAt: later, readAt: t }));
  ok("garbage dates → not unread", !isUnread({ lastInboundAt: "nope", readAt: null }));
  const labels = threadLabels({ lastInboundAt: later, readAt: t, archivedAt: null, lead: { status: "contacted" }, messages: [{ direction: "in" }] }, { checkIn: { id: "c" } });
  ok("labels: unread, needsReply, checkInDue, stage", labels.unread && labels.needsReply && !labels.waiting && labels.checkInDue && labels.stage === "contacted");
  ok("an unknown stage is null, not echoed", threadLabels({ lead: { status: "<script>" }, messages: [] }).stage === null);
  ok("an empty thread has no needsReply/waiting", !threadLabels({ messages: [] }).needsReply && !threadLabels({ messages: [] }).waiting);
  ok("snippet drops the quote and the marks", snippetOf("**Thanks** for the quote\n\nOn Mon, X wrote:\n> old") === "Thanks for the quote");
  ok("snippet cuts at a word with an ellipsis", snippetOf("word ".repeat(60)).endsWith("…") && snippetOf("word ".repeat(60)).length <= 141);
  ok("folderWhere never widens past the rep", folderWhere(null, "all").salesRepId === "__none__" && folderWhere({ salesRepId: "r1" }, "inbox").archivedAt === null && folderWhere({ salesRepId: "r1" }, "archived").archivedAt.not === null);
  ok("searchWhere blank → null", searchWhere("   ") === null);
  ok("searchWhere searches subject, bodies, names and address", searchWhere("acme").OR.length === 6);
  ok("folderOf defaults to inbox", folderOf("nope") === "inbox" && folderOf("archived") === "archived");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Recipients — a closed set");
{
  const lead = { email: "dana@acmepainting.ca", prospect: { email: "info@acmepainting.ca" } };
  const messages = [
    { direction: "in", fromAddress: "Assistant <pa@acmepainting.ca>", ccAddresses: "boss@acmepainting.ca, evil@attacker.tld" },
    { direction: "out", toAddress: "dana@acmepainting.ca" },
  ];
  const rep = { workEmail: "daniel@fieldquo.com" };
  const allowed = allowedRecipients({ lead, messages, rep });
  const set = allowed.map(([a]) => a);
  ok("the lead, the prospect, who wrote in, who was copied and the rep are allowed", ["dana@acmepainting.ca", "info@acmepainting.ca", "pa@acmepainting.ca", "boss@acmepainting.ca", "daniel@fieldquo.com"].every((a) => set.includes(a)));
  ok("a Cc a prospect put on their reply IS allowed (they joined the conversation)", set.includes("evil@attacker.tld"));
  const refused = chooseRecipients({ to: ["dana@acmepainting.ca", "stranger@nowhere.tld"], allowed });
  ok("an address outside the set is refused BY NAME", refused.ok === false && refused.refused.join() === "stranger@nowhere.tld");
  ok("an empty To is refused as empty", chooseRecipients({ to: [], allowed }).empty === true);
  const chosen = chooseRecipients({ to: "dana@acmepainting.ca", cc: ["dana@acmepainting.ca", "boss@acmepainting.ca"], allowed });
  ok("a Cc that is also To is folded", chosen.ok && chosen.cc.join() === "boss@acmepainting.ca");
  ok("an empty lead allows exactly the rep's own mailbox", allowedRecipients({ lead: {}, rep }).map(([a]) => a).join() === "daniel@fieldquo.com");
  const ra = replyAllTargets({ message: { direction: "in", fromAddress: "Dana <dana@acmepainting.ca>", ccAddresses: "daniel@fieldquo.com, boss@acmepainting.ca" }, rep });
  ok("reply-all drops the rep's own mailbox", ra.to.join() === "dana@acmepainting.ca" && ra.cc.join() === "boss@acmepainting.ca");
  ok("joinAddresses dedupes and drops junk", joinAddresses(["A@x.ca", "a@x.ca", "not an address"]) === "a@x.ca");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Formatting and quoting");
{
  ok("bold and italic", inlineHtml("**b** and _i_") === "<strong>b</strong> and <em>i</em>");
  ok("markup is escaped before marks", inlineHtml("<b>x</b> **y**") === "&lt;b&gt;x&lt;/b&gt; <strong>y</strong>");
  ok("a URL becomes a link, and marks inside it are left alone", /<a href="https:\/\/x\.y\/a_b_c\*\*d"/.test(inlineHtml("see https://x.y/a_b_c**d now")));
  ok("a quote in a URL cannot close the attribute", !/href="[^"]*"[^ >]/.test(inlineHtml('https://x.y/a"onmouseover="x')) && inlineHtml('https://x.y/a"onmouseover="x').includes("&quot;"));
  const html = bodyHtml("Hi Dana,\n\n- one\n- two\n\nBye");
  ok("a list block becomes a <ul>", (html.match(/<li/g) || []).length === 2 && (html.match(/<p /g) || []).length === 2);
  ok("stripMarks for the snippet", stripMarks("**a** _b_\n- c") === "a b\nc");
  const body = "Thanks!\n\nOn Mon, Dana wrote:\n> old\n> lines";
  ok("splitQuoted folds at the marker", splitQuoted(body).visible === "Thanks!" && splitQuoted(body).quoted.startsWith("On Mon"));
  ok("a message with no marker is all visible", splitQuoted("just words").quoted === "");
  ok("a run of > lines with no marker is the quote", splitQuoted("hi\n> a\n> b").visible === "hi");
  ok("a lone > line in prose is kept", splitQuoted("> 50 units\nplease").visible === "> 50 units\nplease");
  ok("French and Spanish markers fold", splitQuoted("ok\nLe lun. X a écrit :\n> y").visible === "ok" && splitQuoted("ok\nEl lun. X escribió:\n> y").visible === "ok");
  ok("visibleReplyText is the same fold", visibleReplyText(body) === "Thanks!");
  ok("an opt-out in the quoted tail is not an opt-out", !detectOptOut("Thanks!\n\nOn Mon, X wrote:\n> unsubscribe"));
  const reply = replyBody({ typed: "Sure.", quotedMessage: { body, sentAt: "2026-09-18T10:00:00Z", fromAddress: "Dana <dana@x.ca>" } });
  ok("a reply quotes only the VISIBLE part of the answered message", reply.includes("> Thanks!") && !reply.includes("> > old"));
  ok("a forward carries the whole message under the header", forwardBody({ typed: "FYI", forwardedMessage: { body, fromAddress: "d@x", subject: "s", toAddress: "t@y" } }).includes("---------- Forwarded message ----------"));
  ok("prefixedSubject adds Re: once", prefixedSubject("Re: x", "Re") === "Re: x" && prefixedSubject("x", "Fwd") === "Fwd: x" && prefixedSubject("TR: x", "Fwd") === "TR: x");
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Drafts");
{
  const rows = [];
  let n = 0;
  const db = {
    salesEmailDraft: {
      findFirst: async ({ where }) => rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) || null,
      create: async ({ data }) => { const r = { id: `d${++n}`, ...data, updatedAt: new Date() }; rows.push(r); return r; },
      update: async ({ where, data }) => { const r = rows.find((x) => x.id === where.id); Object.assign(r, data); return r; },
      delete: async ({ where }) => { const i = rows.findIndex((x) => x.id === where.id); rows.splice(i, 1); },
      deleteMany: async ({ where }) => { const before = rows.length; for (let i = rows.length - 1; i >= 0; i--) if (rows[i].id === where.id && rows[i].salesRepId === where.salesRepId) rows.splice(i, 1); return { count: before - rows.length }; },
    },
  };
  const a = await saveDraft(db, { salesRepId: "r1", leadId: "l1", threadId: "t1", input: { kind: "reply", body: "hel" } });
  const b = await saveDraft(db, { salesRepId: "r1", leadId: "l1", threadId: "t1", input: { kind: "reply", body: "hello" } });
  ok("a second save at the same place continues the draft", a.id === b.id && rows.length === 1 && b.body === "hello");
  const c = await saveDraft(db, { salesRepId: "r1", leadId: "l1", threadId: "t1", input: { kind: "forward", body: "fwd" } });
  ok("a forward on the same thread is a second place", c.id !== a.id && rows.length === 2);
  const gone = await saveDraft(db, { salesRepId: "r1", leadId: "l1", threadId: "t1", id: a.id, input: { body: "  ", subject: "" } });
  ok("an emptied draft is deleted, not saved", gone === null && rows.length === 1);
  ok("draftDataFrom cleans and drops unknown keys", draftDataFrom({ body: "x", salesRepId: "evil", kind: "nope" }).salesRepId === undefined && draftDataFrom({ kind: "nope" }).kind === "new");
  ok("only Cloudinary URLs survive as attachments", cleanAttachments([{ url: "https://res.cloudinary.com/x/y.pdf", filename: "y.pdf" }, { url: "https://evil.tld/x" }]).length === 1);
  const { discardDraft } = await import("../lib/sales/emailDrafts.js");
  ok("discarding another rep's draft deletes nothing", (await discardDraft(db, "r2", c.id)) === false && rows.length === 1);
  ok("discarding your own draft deletes it", (await discardDraft(db, "r1", c.id)) === true && rows.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Readiness — three blockers, in the owner's words");
{
  const ready = outreachReadiness({ repEmail: "daniel@fieldquo.com", mailbox: { address: "daniel@fieldquo.com", status: "connected" }, mailingAddress: "1 Rue X, Gatineau QC" });
  ok("connected + address → can send, inbound configured", ready.canSend && ready.inboundConfigured);
  const none = outreachReadiness({ repEmail: "daniel@fieldquo.com", mailbox: null, mailingAddress: "x" });
  ok("no mailbox row → blocked with the rep-facing sentence", !none.canSend && none.blockers[0].code === "mailbox_not_connected" && /ask the owner/.test(none.blockers[0].title));
  const err = outreachReadiness({ repEmail: "daniel@fieldquo.com", mailbox: { address: "daniel@fieldquo.com", status: "error", lastError: "refused the password" }, mailingAddress: "x" });
  ok("a failed connection → blocked, the last error in the fix", err.blockers[0].code === "mailbox_error" && /refused the password/.test(err.blockers[0].fix));
  ok("a revoked mailbox is 'not connected'", outreachReadiness({ repEmail: "d@f.com", mailbox: { status: "revoked" }, mailingAddress: "x" }).blockers[0].code === "mailbox_not_connected");
  ok("no work mailbox at all → its own blocker", outreachReadiness({ repEmail: null, mailingAddress: "x" }).blockers[0].code === "no_work_mailbox");
  ok("a mailbox on a different address than workEmail → blocked", outreachReadiness({ repEmail: "a@f.com", mailbox: { address: "b@f.com", status: "connected" }, mailingAddress: "x" }).blockers[0].code === "mailbox_address_differs");
  ok("no CASL address → blocked even when connected", outreachReadiness({ repEmail: "d@f.com", mailbox: { address: "d@f.com", status: "connected" }, mailingAddress: "" }).blockers.some((b) => b.code === "mailing_address_missing"));
  ok("never a Resend question", !/senderDomainVerified|replyDomainReceiving/.test(read("lib/sales/outreachReadiness.js")));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
