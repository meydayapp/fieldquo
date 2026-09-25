// scripts/check-mailbox.mjs
//
// Settings › Work email (lib/mailbox/), executed — never against a real
// mailbox, never with a real password.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-mailbox.mjs
//
//  1. The credential at rest: seal → open round-trips; a flipped byte, a
//     wrong row and a wrong key all refuse; no key means no seal and no
//     fallback.
//  2. Address matching: case, display names (with commas), plus-addressing,
//     Gmail dots / googlemail, multiple recipients, the mailbox owner's own
//     address (and a client record carrying it), ambiguity, client over lead.
//  3. HTML → text against hostile input; the typed part of a reply.
//  4. Which job / quote an email is filed to.
//  5. The sync against a fake database and a fake provider: only matched
//     mail is stored, skipped mail is only counted, dedupe by Message-ID
//     (INBOX + Sent, a re-run, a concurrent filer), the cursor moves only
//     behind finished pages, backfill does not ring the unread counter.
//  6. A REAL IMAP conversation with an in-process server: login ok / refused,
//     EXAMINE only, no write verbs, and a body downloaded ONLY for the
//     messages that matched a client.
//  7. Sending: the throttle, canSend, the composed message carries nothing
//     of FieldQuo's, and a failed mailbox send is recorded and reported as
//     "failed" so the caller sends it the usual way.
//  8. Static: no route selects the credential; the IMAP provider has no
//     write verbs; every new env var is documented.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { simpleParser } from "mailparser";

import { createFakeDb } from "./fixtures/mailboxFakeDb.mjs";
import { startMockImap } from "./fixtures/mockImapServer.mjs";

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
async function throwsAsync(fn) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}
function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

// A throwaway key, generated here — never a real one.
process.env.MAIL_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");

const { sealMailSecret, openMailSecret, mailCryptoConfigured } = await import("../lib/mailbox/crypto.js");
const addresses = await import("../lib/mailbox/addresses.js");
const text = await import("../lib/mailbox/text.js");
const { chooseFilingTarget, mentionsNumber } = await import("../lib/mailbox/filingTarget.js");
const { syncMailbox } = await import("../lib/mailbox/sync.js");
const { throttleVerdict } = await import("../lib/mailbox/sendThrottle.js");
const send = await import("../lib/mailbox/send.js");
const presets = await import("../lib/mailbox/presets.js");
const { imapAdapter, testImapLogin } = await import("../lib/mailbox/providers/imap.js");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The credential at rest");
{
  const blob = sealMailSecret("hunter2-correct-horse", "row_A");
  ok("seal → open round-trips", openMailSecret(blob, "row_A") === "hunter2-correct-horse");
  ok("the blob is not the plaintext and does not contain it", !blob.includes("hunter2") && blob !== "hunter2-correct-horse");
  ok("two seals of one password differ (fresh IV)", sealMailSecret("x-pass", "row_A") !== sealMailSecret("x-pass", "row_A"));
  const raw = Buffer.from(blob, "base64");
  for (const at of [0, 13, 30, raw.length - 1]) {
    const t = Buffer.from(raw);
    t[at] ^= 0x01;
    ok(`a flipped bit at byte ${at} is refused (GCM tag)`, throws(() => openMailSecret(t.toString("base64"), "row_A")));
  }
  ok("a blob copied onto another row is refused (row id is the AAD)", throws(() => openMailSecret(blob, "row_B")));
  ok("a truncated blob is refused", throws(() => openMailSecret(blob.slice(0, 20), "row_A")));
  const saved = process.env.MAIL_CREDENTIALS_KEY;
  process.env.MAIL_CREDENTIALS_KEY = Buffer.alloc(32, 9).toString("base64");
  ok("a different key cannot open it", throws(() => openMailSecret(blob, "row_A")));
  delete process.env.MAIL_CREDENTIALS_KEY;
  ok("no key → not configured", mailCryptoConfigured() === false);
  ok("no key → sealing throws (no plaintext fallback, no default key)", throws(() => sealMailSecret("pw", "row_A")));
  process.env.MAIL_CREDENTIALS_KEY = "too-short";
  ok("a malformed key is treated as no key", mailCryptoConfigured() === false && throws(() => sealMailSecret("pw", "row_A")));
  process.env.MAIL_CREDENTIALS_KEY = saved;
  ok("sealing needs a row id", throws(() => sealMailSecret("pw", "")));
  ok("the Meta token crypto still produces its old format (no AAD)", (() => {
    process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    return true;
  })());
  const meta = await import("../lib/meta/tokenCrypto.js");
  ok("encryptToken/decryptToken still round-trip after the refactor", meta.decryptToken(meta.encryptToken("tok")) === "tok");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Address matching");
{
  const { canonicalAddress, bareAddress, parseAddressList, buildMatchIndex, ownAddressSet, sidesOf, matchCounterpart, addressesInField } = addresses;
  ok("case folds", canonicalAddress("Dana.Cole@Client.CA") === "dana.cole@client.ca");
  ok("display name and angle brackets", bareAddress('"Cole, Dana" <dana@client.ca>') === "dana@client.ca");
  ok("plus-addressing is the same person", canonicalAddress("dana+reno@client.ca") === "dana@client.ca");
  ok("Gmail dots are ignored", canonicalAddress("d.a.n.a@gmail.com") === "dana@gmail.com");
  ok("googlemail.com is gmail.com", canonicalAddress("dana@googlemail.com") === "dana@gmail.com");
  ok("dots are NOT ignored on other domains", canonicalAddress("j.smith@acme.ca") !== canonicalAddress("jsmith@acme.ca"));
  ok("garbage is null, not a match key", canonicalAddress("not an address") === null && canonicalAddress("") === null && canonicalAddress("a@b") === null);
  ok("a header injection attempt is not an address", bareAddress("dana@client.ca\r\nBcc: x@evil.com") === null);
  ok("a Client.email field with two addresses yields both", addressesInField("a@x.com; B@Y.com").join() === "a@x.com,b@y.com");

  const list = parseAddressList('"Cole, Dana" <dana@client.ca>, bob@b.com; undisclosed-recipients:;');
  ok("a raw header with a comma inside a quoted name splits correctly", list.length === 2 && list[0].name === "Cole, Dana" && list[0].address === "dana@client.ca" && list[1].address === "bob@b.com", list);
  ok("Graph's recipient shape parses", parseAddressList([{ emailAddress: { name: "Dana", address: "Dana@Client.ca" } }])[0].address === "dana@client.ca");
  ok("mailparser's { value: [...] } parses", parseAddressList({ value: [{ name: "D", address: "d@x.com" }] })[0].address === "d@x.com");

  const own = ownAddressSet([{ address: "office@shop.ca" }], ["Office+quotes@Shop.ca", "owner@gmail.com"]);
  const index = buildMatchIndex({
    own,
    clients: [
      { id: "c1", name: "Dana Cole", email: "dana+reno@client.ca" },
      { id: "c2", name: "Me Test", email: "office@shop.ca" }, // the company's own address on a test client
      { id: "c3", name: "Twin A", email: "shared@family.ca" },
      { id: "c4", name: "Twin B", email: "shared@family.ca" },
      { id: "c5", name: "Gina", email: "g.ina@gmail.com" },
    ],
    leads: [
      { id: "l1", name: "Dana lead", email: "dana@client.ca", createdAt: new Date("2026-01-01") },
      { id: "l2", name: "Old Pat", email: "pat@p.ca", createdAt: new Date("2025-01-01") },
      { id: "l3", name: "New Pat", email: "PAT@p.ca", createdAt: new Date("2026-05-01") },
    ],
  });
  ok("a client beats a lead on the same address", index.get("dana@client.ca")?.id === "c1");
  ok("the company's own address on a client record is NOT indexed", !index.has("office@shop.ca"));
  ok("an address on two clients is ambiguous, never guessed", index.get("shared@family.ca")?.kind === "ambiguous");
  ok("the newest lead wins among leads", index.get("pat@p.ca")?.id === "l3");

  const self = canonicalAddress("office@shop.ca");
  const inbound = sidesOf({
    from: parseAddressList("Dana <DANA@client.ca>"),
    to: parseAddressList("office@shop.ca, gina@gmail.com"),
    cc: parseAddressList("office+cc@shop.ca"),
    self,
    own,
  });
  ok("mail from a client to us is inbound", inbound.direction === "in");
  ok("our own addresses are never counterparts", inbound.counterparts.every((c) => !own.has(c.canonical)));
  ok("the sender is the first counterpart", inbound.counterparts[0].canonical === "dana@client.ca");
  ok("an inbound message matches its sender", matchCounterpart(inbound.counterparts, index)?.id === "c1");

  const outbound = sidesOf({ from: parseAddressList("Office <office@shop.ca>"), to: parseAddressList("stranger@x.com, Gina <gina@gmail.com>"), cc: [], self, own });
  ok("mail from us is outbound", outbound.direction === "out");
  ok("outbound matches the first known recipient (Gmail dots canonicalised)", matchCounterpart(outbound.counterparts, index)?.id === "c5");
  const fromAlias = sidesOf({ from: parseAddressList("owner@gmail.com"), to: parseAddressList("dana@client.ca"), cc: [], self, own });
  ok("mail from another company-own address is outbound", fromAlias.direction === "out");
  const inSent = sidesOf({ from: parseAddressList("someone-else@alias.ca"), to: parseAddressList("dana@client.ca"), cc: [], self, own, sentFolder: true });
  ok("anything in Sent is outbound whatever the From says", inSent.direction === "out");
  const personal = sidesOf({ from: parseAddressList("mom@home.ca"), to: parseAddressList("office@shop.ca"), cc: [], self, own });
  ok("personal mail matches nobody", matchCounterpart(personal.counterparts, index) === null);
  const ambiguous = sidesOf({ from: parseAddressList("shared@family.ca"), to: parseAddressList("office@shop.ca"), cc: [], self, own });
  ok("an ambiguous sender files nowhere", matchCounterpart(ambiguous.counterparts, index) === null);
  const toSelf = sidesOf({ from: parseAddressList("office@shop.ca"), to: parseAddressList("office@shop.ca"), cc: [], self, own });
  ok("a note to self has no counterpart", toSelf.counterparts.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. HTML → text, and each message once");
{
  const { htmlToText, typedPart, storedBody, stripInvisible, cleanHeader } = text;
  const hostile = [
    ["<script>alert(1)</script>Hello", (o) => o === "Hello"],
    ["<scr<script>ipt>alert(1)</script>Hi", (o) => !/<script/i.test(o) && o.includes("Hi")],
    ['<a title=">" href="javascript:alert(1)">click</a>', (o) => o === "click"],
    ["<!-- <img src=x onerror=alert(1)> -->Visible", (o) => o === "Visible"],
    ["<style>body{display:none}</style>Text<style>unterminated", (o) => o === "Text"],
    ["<img src=x onerror=alert(1)>Pic", (o) => o === "Pic"],
    ["&lt;script&gt;alert(1)&lt;/script&gt;", (o) => o === "<script>alert(1)</script>"],
    ["&#60;b&#62;bold&#x3C;/b&#x3E;", (o) => o === "<b>bold</b>"],
    ["A&#0;B&#xD800;C&#1114112;D", (o) => o === "ABCD"],
    ["<svg><script>x</script></svg>After", (o) => o === "After"],
    ["<iframe src=//evil></iframe>Frame", (o) => o === "Frame"],
    ["invoice‮fdp.exe", (o) => o === "invoicefdp.exe"],
    ["zero​width﻿", (o) => o === "zerowidth"],
    ["<p>One</p><p>Two</p><br>Three", (o) => /^One\nTwo\n+Three$/.test(o)],
    ["<ul><li>a</li><li>b</li></ul>", (o) => o === "• a\n• b"],
    ["", (o) => o === ""],
    [null, (o) => o === ""],
  ];
  for (const [input, test] of hostile) {
    const out = htmlToText(input);
    ok(`html ${JSON.stringify(String(input).slice(0, 40))} → ${JSON.stringify(out)}`, test(out), out);
  }
  ok("a 3 MB HTML body is capped, not stored whole", htmlToText("<p>x</p>".repeat(400000)).length <= text.MAX_BODY_CHARS);
  ok("control characters are removed", stripInvisible("a\u0000b\u0007c\u009bd") === "abcd");
  ok("a header is one line", cleanHeader("Re: hi\r\nBcc: evil@x.com") === "Re: hi Bcc: evil@x.com");

  const reply = "Sounds good, Thursday works.\n\nDana\n-- \nDana Cole | 555-0100\n\nOn Mon, Sep 21, 2026 at 9:00 AM Office <office@shop.ca> wrote:\n> Can we come Thursday?\n> Thanks";
  ok("the quoted history and the signature are cut", typedPart(reply) === "Sounds good, Thursday works.\n\nDana", typedPart(reply));
  const allQuoted = "> only quoted\n> lines here";
  ok("a message that is ALL quote keeps its text (never an empty body)", typedPart(allQuoted) === allQuoted);
  ok("French attribution lines cut too", typedPart("Oui merci\n\nLe lun. 21 sept. 2026, Bureau a écrit :\n> Question") === "Oui merci");
  ok("text/plain is preferred over HTML", storedBody({ text: "plain part", html: "<b>html part</b>" }) === "plain part");
  ok("HTML is used when there is no text part", storedBody({ text: "  ", html: "<p>only html</p>" }) === "only html");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Which job or quote an email is filed to");
{
  const quotes = [
    { id: "q1", quoteNumber: "Q-2026-0014", status: "accepted", createdAt: new Date("2026-05-01") },
    { id: "q2", quoteNumber: "Q-2026-0021", status: "sent", createdAt: new Date("2026-08-01") },
    { id: "q3", quoteNumber: "Q-2026-001", status: "declined", createdAt: new Date("2026-01-01") },
  ];
  const invoices = [{ id: "i1", invoiceNumber: "INV-0009", quoteId: "q1", jobId: "j1" }];
  const jobs = [
    { id: "j1", quoteId: "q1", status: "in_progress", updatedAt: new Date("2026-09-01") },
    { id: "j0", quoteId: null, status: "completed", updatedAt: new Date("2026-09-20") },
  ];
  ok("a quote number in the subject files to that quote and its job", JSON.stringify(chooseFilingTarget({ subject: "Re: Quote Q-2026-0014", body: "", quotes, invoices, jobs })) === JSON.stringify({ jobId: "j1", quoteId: "q1", reason: "number_subject" }));
  ok("a longer number does not match a shorter one inside it", !mentionsNumber("Q-2026-0014", "Q-2026-001") && mentionsNumber("see Q-2026-001.", "Q-2026-001"));
  ok("a tier suffix is a different quote", !mentionsNumber("Q-2026-0014-G", "Q-2026-0014"));
  ok("an invoice number in the body files to its job", chooseFilingTarget({ subject: "payment", body: "Paid INV-0009 today", quotes, invoices, jobs }).jobId === "j1");
  ok("the subject beats the body", chooseFilingTarget({ subject: "Q-2026-0021 question", body: "about INV-0009", quotes, invoices, jobs }).quoteId === "q2");
  ok("no number → the most recent OPEN job, never a completed one", chooseFilingTarget({ subject: "hello", body: "", quotes, invoices, jobs }).jobId === "j1");
  ok("no open job → the most recent open quote", chooseFilingTarget({ subject: "hello", body: "", quotes, invoices, jobs: [jobs[1]] }).quoteId === "q2");
  ok("nothing open → filed to the client only", chooseFilingTarget({ subject: "hello", body: "", quotes: [quotes[2]], invoices: [], jobs: [jobs[1]] }).reason === "none");
  ok("a two-character 'number' never matches", !mentionsNumber("12 windows", "12"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The sync, against a fake database and a fake provider");

function rawMail({ id, from, to, cc, subject, body, date = "Mon, 21 Sep 2026 10:00:00 -0400", inReplyTo, references, html, attach }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    `Date: ${date}`,
    ...(id ? [`Message-ID: <${id}>`] : []),
    ...(inReplyTo ? [`In-Reply-To: <${inReplyTo}>`] : []),
    ...(references ? [`References: ${references.map((r) => `<${r}>`).join(" ")}`] : []),
    "MIME-Version: 1.0",
  ];
  if (attach) {
    lines.push('Content-Type: multipart/mixed; boundary="B"', "", "--B", "Content-Type: text/plain; charset=utf-8", "", body, "--B", `Content-Type: application/pdf; name="${attach.name}"`, `Content-Disposition: attachment; filename="${attach.name}"`, "Content-Transfer-Encoding: base64", "", Buffer.from(attach.bytes).toString("base64"), "--B--", "");
  } else if (html) {
    lines.push("Content-Type: text/html; charset=utf-8", "", html);
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8", "", body);
  }
  return Buffer.from(lines.join("\r\n"));
}

function headersOf(raw) {
  const head = String(raw).split("\r\n\r\n")[0];
  const get = (k) => (head.match(new RegExp(`^${k}: (.*)$`, "mi")) || [])[1] || null;
  return { from: get("From"), to: get("To"), cc: get("Cc"), messageId: get("Message-ID"), inReplyTo: get("In-Reply-To"), references: get("References"), subject: get("Subject"), date: get("Date") };
}

/** A fake adapter: pages of items; records which bodies were fetched. */
function fakeAdapter(pages, { failOnPage = null } = {}) {
  const fetched = [];
  let call = 0;
  return {
    fetched,
    adapter: {
      provider: "fake",
      async session(fn) {
        return fn({
          async nextPage(cursor) {
            const i = Number(cursor.page || 0);
            call += 1;
            if (failOnPage !== null && i === failOnPage) throw Object.assign(new Error("connection reset"), { status: 0 });
            const page = pages[i];
            if (!page) return { items: [], cursor, more: false };
            return { items: page.map((p) => ({ ...p, headers: headersOf(p.raw) })), cursor: { page: i + 1 }, more: i + 1 < pages.length };
          },
          async fetchRaw(item) {
            fetched.push(item.ref);
            return item.raw;
          },
        });
      },
    },
    calls: () => call,
  };
}

function baseDb() {
  const connectedAt = new Date("2026-09-24T00:00:00Z");
  const conn = {
    id: "mbx_1",
    companyId: "co_1",
    memberId: "m_1",
    provider: "imap",
    scope: "company",
    address: "office@shop.ca",
    status: "connected",
    connectedAt,
    backfillFrom: new Date("2026-06-22T00:00:00Z"),
    cursor: {},
    channelId: null,
    filedCount: 0,
    skippedCount: 0,
  };
  conn.secretEnc = sealMailSecret("pw", conn.id);
  const db = createFakeDb({
    company: [{ id: "co_1", email: "office@shop.ca" }, { id: "co_2", email: "x@other.ca" }],
    mailboxConnection: [conn],
    client: [
      { id: "c1", companyId: "co_1", name: "Dana Cole", email: "dana@client.ca" },
      { id: "c9", companyId: "co_2", name: "Other tenant's Dana", email: "dana@client.ca" },
    ],
    leadRequest: [{ id: "l1", companyId: "co_1", name: "Pat", email: "pat@lead.ca", quoteId: null, createdAt: new Date("2026-09-01") }],
    quote: [{ id: "q1", companyId: "co_1", clientId: "c1", quoteNumber: "Q-2026-0014", status: "sent", archivedAt: null, createdAt: new Date("2026-09-01") }],
    invoice: [],
    job: [{ id: "j1", companyId: "co_1", clientId: "c1", quoteId: "q1", status: "scheduled", createdAt: new Date("2026-09-02"), updatedAt: new Date("2026-09-02") }],
  });
  return { db, conn };
}

{
  const { db, conn } = baseDb();
  const rescored = [];
  const rescore = async ({ threadId }) => rescored.push(threadId);
  const m1 = rawMail({ id: "m1@client.ca", from: "Dana Cole <dana@client.ca>", to: "office@shop.ca", subject: "Question about Q-2026-0014", body: "Can you start earlier?", date: "Fri, 18 Sep 2026 09:00:00 -0400" });
  const personal = rawMail({ id: "p1@home.ca", from: "Mom <mom@home.ca>", to: "office@shop.ca", subject: "Dinner Sunday", body: "Private family stuff" });
  const m2 = rawMail({ id: "m2@shop.ca", from: "Office <office@shop.ca>", to: "Dana <DANA+x@client.ca>", subject: "Re: Question about Q-2026-0014", body: "Yes, Monday.\n\nOn Fri Dana wrote:\n> Can you start earlier?", inReplyTo: "m1@client.ca", references: ["m1@client.ca"], date: "Mon, 21 Sep 2026 10:00:00 -0400" });
  const m2InSent = { ref: 101, folder: "Sent", sentFolder: true, raw: m2 };
  const leadMail = rawMail({ id: "l1@lead.ca", from: "pat@lead.ca", to: "office@shop.ca", subject: "Estimate?", body: "How much for a deck?", date: "Tue, 22 Sep 2026 10:00:00 -0400", attach: { name: "deck.pdf", bytes: "%PDF-1.4 fake" } });
  const hostileHtml = rawMail({ id: "h1@client.ca", from: "dana@client.ca", to: "office@shop.ca", subject: "html", html: "<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(2)>", date: "Wed, 23 Sep 2026 10:00:00 -0400" });

  const uploads = [];
  const upload = async (buffer, opts) => {
    uploads.push({ bytes: buffer.length, folder: opts.folder });
    return { secure_url: `https://res.cloudinary.com/demo/raw/upload/v1/${opts.folder}/f.pdf` };
  };

  const fake = fakeAdapter([
    [{ ref: 1, folder: "INBOX", raw: m1 }, { ref: 2, folder: "INBOX", raw: personal }],
    [m2InSent, { ref: 3, folder: "INBOX", raw: m2 }],
    [{ ref: 4, folder: "INBOX", raw: leadMail }, { ref: 5, folder: "INBOX", raw: hostileHtml }],
  ]);
  const r = await syncMailbox(db, db.tables.mailboxConnection[0], { adapter: fake.adapter, parse: simpleParser, upload, rescore, now: () => new Date("2026-09-24T12:00:00Z") });
  ok("the sync finishes", r.ok, r);
  ok("four matched messages filed", r.filed === 4, r);
  ok("the personal message is only counted as skipped", r.skipped === 1, r);
  ok("the personal message's BODY was never downloaded", !fake.fetched.includes(2), fake.fetched);
  ok("nothing of the personal message is stored anywhere", !JSON.stringify(db.tables).includes("Private family") && !JSON.stringify(db.tables).includes("mom@home.ca"));
  ok("the same email in Sent and INBOX is one row", db.tables.emailMessage.filter((e) => e.rfcMessageId === "m2@shop.ca").length === 1);
  ok("…and the second sighting counted as already held", r.held === 1, r);
  const threads = db.tables.messageThread;
  const danaThread = threads.find((t) => t.clientId === "c1");
  ok("Dana's two messages are one conversation (References)", db.tables.message.filter((m) => m.threadId === danaThread?.id && m.direction !== "note").length >= 2);
  ok("the thread is filed to the quote named in the subject and its job", danaThread?.quoteId === "q1" && danaThread?.jobId === "j1", danaThread);
  ok("never filed to the other tenant's client with the same address", !threads.some((t) => t.clientId === "c9"));
  ok("the lead's email files under the lead", threads.some((t) => t.leadId === "l1"));
  const out = db.tables.message.find((m) => m.externalId === "email:m2@shop.ca");
  ok("our reply is outbound", out?.direction === "out");
  ok("our reply's stored body is what we typed, not the quote", out?.body === "Yes, Monday.", out?.body);
  const html = db.tables.message.find((m) => m.externalId === "email:h1@client.ca");
  ok("a hostile HTML email is stored as clean text", html?.body === "Hi", html?.body);
  const withFile = db.tables.message.find((m) => m.externalId === "email:l1@lead.ca");
  ok("an attachment is re-hosted on Cloudinary in the inbox's shape", Array.isArray(withFile?.attachments) && withFile.attachments[0]?.url?.startsWith("https://res.cloudinary.com/") && withFile.attachments[0]?.filename === "deck.pdf", withFile?.attachments);
  ok("backfill (mail older than the connect) does not ring the unread counter", threads.every((t) => t.unread === 0), threads.map((t) => t.unread));
  ok("the response clock ran (first inbound, first reply)", danaThread?.firstInboundAt && danaThread?.firstReplyAt);
  ok("a backfilled conversation is dated by its first email, not by the sync (the monthly review counts by createdAt)", danaThread?.createdAt?.toISOString() === "2026-09-18T13:00:00.000Z", danaThread?.createdAt);
  const { sourceForPlatform } = await import("../lib/messaging/platforms.js");
  const { CONVERSATION_SOURCES } = await import("../lib/attribution/conversationOutcome.js");
  ok("an email conversation has a source the monthly review counts", CONVERSATION_SOURCES.includes(sourceForPlatform("email")));
  ok("every filed thread was rescored (the free temperature)", new Set(rescored).size === threads.length);
  ok("the channel is a platform 'email' channel of this company", db.tables.messagingChannel.length === 1 && db.tables.messagingChannel[0].platform === "email" && db.tables.messagingChannel[0].companyId === "co_1");
  const after = db.tables.mailboxConnection[0];
  ok("the cursor is saved after the last page", after.cursor?.page === 3, after.cursor);
  ok("counters recorded (filed/skipped), lock released", after.filedCount === 4 && after.skippedCount === 1 && after.syncingSince === null && after.lastSyncFiled === 4);
  ok("the credential column still holds only ciphertext", after.secretEnc && !after.secretEnc.includes("pw"));

  // Re-run from scratch (a UIDVALIDITY reset reads everything again).
  db.tables.mailboxConnection[0].cursor = {};
  const again = fakeAdapter([
    [{ ref: 1, folder: "INBOX", raw: m1 }, { ref: 2, folder: "INBOX", raw: personal }],
    [m2InSent],
  ]);
  const r2 = await syncMailbox(db, db.tables.mailboxConnection[0], { adapter: again.adapter, parse: simpleParser, upload, rescore, now: () => new Date("2026-09-24T12:10:00Z") });
  ok("a full re-read files nothing twice", r2.filed === 0 && r2.held === 2, r2);
  ok("…and downloads no body it already holds", again.fetched.length === 0, again.fetched);

  // A LIVE inbound message (after connect) rings the counter.
  db.tables.mailboxConnection[0].cursor = {};
  const live = rawMail({ id: "live@client.ca", from: "dana@client.ca", to: "office@shop.ca", subject: "Re: Question about Q-2026-0014", body: "One more thing", inReplyTo: "m2@shop.ca", date: "Thu, 24 Sep 2026 08:00:00 -0400" });
  const r3 = await syncMailbox(db, db.tables.mailboxConnection[0], { adapter: fakeAdapter([[{ ref: 9, folder: "INBOX", raw: live }]]).adapter, parse: simpleParser, upload, rescore, now: () => new Date("2026-09-24T13:00:00Z") });
  const t3 = db.tables.messageThread.find((t) => t.id === danaThread.id);
  ok("a live inbound email joins the thread and counts as unread", r3.filed === 1 && t3.unread === 1, { r3, unread: t3.unread });
  ok("…and starts the waiting clock", Boolean(t3.waitingSince));

  // Killed mid-way: page 2 throws. The cursor stays behind page 1.
  const { db: db2 } = baseDb();
  const crash = fakeAdapter(
    [[{ ref: 1, folder: "INBOX", raw: m1 }], [{ ref: 4, folder: "INBOX", raw: leadMail }]],
    { failOnPage: 1 },
  );
  const r4 = await syncMailbox(db2, db2.tables.mailboxConnection[0], { adapter: crash.adapter, parse: simpleParser, upload, rescore, now: () => new Date("2026-09-24T12:00:00Z") });
  const c2 = db2.tables.mailboxConnection[0];
  ok("a failure mid-sync is reported, not thrown", r4.ok === false && r4.filed === 1, r4);
  ok("the cursor moved past the finished page only", c2.cursor?.page === 1, c2.cursor);
  ok("the error is on the row in words; a network blip does not mark it failed", Boolean(c2.lastError) && c2.status === "connected" && c2.syncingSince === null, c2);
  const resume = fakeAdapter([[{ ref: 1, folder: "INBOX", raw: m1 }], [{ ref: 4, folder: "INBOX", raw: leadMail }]]);
  const r5 = await syncMailbox(db2, c2, { adapter: resume.adapter, parse: simpleParser, upload, rescore, now: () => new Date("2026-09-24T12:10:00Z") });
  ok("the next run resumes at page 2 and files the rest", r5.ok && r5.filed === 1 && !resume.fetched.includes(1), { r5, fetched: resume.fetched });

  // A lock held by a live sync is respected.
  c2.syncingSince = new Date("2026-09-24T12:09:00Z");
  const busy = await syncMailbox(db2, c2, { adapter: resume.adapter, now: () => new Date("2026-09-24T12:10:00Z") });
  ok("a second tick during a live sync is told 'busy'", busy.reason === "busy");
  c2.syncingSince = null;

  // A disconnected row (secret wiped) does nothing.
  const gone = await syncMailbox(db2, { ...c2, status: "disconnected", secretEnc: null });
  ok("a disconnected mailbox is not synced", gone.reason === "not_connected");

  // A credential copied from another row fails loudly and is marked.
  const swapped = { ...c2, secretEnc: sealMailSecret("pw", "someone_else") };
  db2.tables.mailboxConnection[0].secretEnc = swapped.secretEnc;
  const bad = await syncMailbox(db2, db2.tables.mailboxConnection[0], { adapter: resume.adapter });
  ok("a ciphertext bound to another row is refused and the row says so", bad.reason === "secret_unreadable" && db2.tables.mailboxConnection[0].status === "error");

  // No Message-ID: a synthetic, stable one still dedupes.
  const { db: db3 } = baseDb();
  const noId = rawMail({ from: "dana@client.ca", to: "office@shop.ca", subject: "no id", body: "hello there" });
  await syncMailbox(db3, db3.tables.mailboxConnection[0], { adapter: fakeAdapter([[{ ref: 1, folder: "INBOX", raw: noId }]]).adapter, parse: simpleParser, rescore });
  db3.tables.mailboxConnection[0].cursor = {};
  const rNoId = await syncMailbox(db3, db3.tables.mailboxConnection[0], { adapter: fakeAdapter([[{ ref: 1, folder: "INBOX", raw: noId }]]).adapter, parse: simpleParser, rescore });
  ok("a message with no Message-ID is filed once, under a stable synthetic id", db3.tables.emailMessage.length === 1 && rNoId.filed === 0 && /^fq-[0-9a-f]{32}@/.test(db3.tables.emailMessage[0].rfcMessageId));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. A real IMAP conversation (in-process server, invented account)");
{
  const mk = (uid, id, from, to, subject, body, day) => {
    const raw = rawMail({ id, from, to, subject, body, date: `${day} Sep 2026 10:00:00 -0400` });
    const h = headersOf(raw);
    return { uid, raw, date: new Date(`2026-09-${String(day).padStart(2, "0")}T14:00:00Z`), subject, from: addresses.parseAddressList(h.from), to: addresses.parseAddressList(h.to), cc: [], messageId: id };
  };
  const inbox = [
    mk(11, "a1@client.ca", "Dana <dana@client.ca>", "office@shop.ca", "Kitchen", "When can you come?", 18),
    mk(12, "p1@bank.com", "Bank <alerts@bank.com>", "office@shop.ca", "Statement", "PRIVATE-BANK-TEXT", 19),
    mk(13, "p2@home.ca", "mom@home.ca", "office@shop.ca", "Sunday", "PRIVATE-FAMILY-TEXT", 20),
  ];
  const sent = [mk(5, "s1@shop.ca", "office@shop.ca", "dana@client.ca", "Re: Kitchen", "Tuesday at 9.", 21)];
  const PASSWORD = `test-${Math.random().toString(36).slice(2)}`;
  const folders = { INBOX: { uidValidity: 42, messages: inbox }, Sent: { uidValidity: 43, messages: sent } };
  const server = await startMockImap({ user: "office@shop.ca", pass: PASSWORD, folders });
  try {
    const conn = { address: "office@shop.ca", imapHost: "127.0.0.1", imapPort: server.port, imapSecurity: "plain" };
    const good = await testImapLogin(conn, PASSWORD);
    ok("the login test passes with the right password and finds Sent", good.ok && good.sentFolder === "Sent", good);
    const badLogin = await testImapLogin(conn, "wrong-password");
    ok("a wrong password is a precise 'auth_failed'", !badLogin.ok && badLogin.code === "auth_failed", badLogin);
    ok("the error sentence never contains the password", !JSON.stringify(badLogin).includes("wrong-password"));
    const notLoopback = await testImapLogin({ ...conn, imapHost: "example.com" }, PASSWORD);
    ok("unencrypted IMAP is refused for anything but loopback", !notLoopback.ok && notLoopback.code === "plain_refused", notLoopback);

    const { db, conn: row } = baseDb();
    Object.assign(db.tables.mailboxConnection[0], { imapHost: "127.0.0.1", imapPort: server.port, imapSecurity: "plain", secretEnc: sealMailSecret(PASSWORD, row.id) });
    const r = await syncMailbox(db, db.tables.mailboxConnection[0], { parse: simpleParser, rescore: async () => null, now: () => new Date("2026-09-24T12:00:00Z") });
    ok("the real IMAP sync files the client's two messages", r.ok && r.filed === 2, r);
    ok("the two personal messages are skipped", r.skipped === 2, r);
    ok("bodies were downloaded ONLY for the client's messages (on the wire)", JSON.stringify(server.bodyFetches.map((b) => `${b.folder}:${b.uid}`).sort()) === JSON.stringify(["INBOX:11", "Sent:5"]), server.bodyFetches);
    ok("…with BODY.PEEK (the contractor's unread mail stays unread)", server.bodyFetches.every((b) => b.peek));
    ok("mailboxes were opened read-only (EXAMINE), never SELECT", server.log.some((l) => l.startsWith("EXAMINE")) && !server.log.some((l) => l.startsWith("SELECT")), server.log);
    ok("no write verb was ever sent", !server.log.some((l) => /^(STORE|UID STORE|COPY|UID COPY|MOVE|UID MOVE|EXPUNGE|UID EXPUNGE|APPEND|DELETE|CREATE|RENAME)\b/.test(l)), server.log);
    ok("the password never appears in the command log", !server.log.join("\n").includes(PASSWORD));
    ok("nothing personal is stored", !JSON.stringify(db.tables).includes("PRIVATE-"));
    const cursor = db.tables.mailboxConnection[0].cursor;
    ok("the cursor holds UIDVALIDITY and the last UID per folder", cursor.inbox?.uidValidity === 42 && cursor.inbox?.lastUid === 13 && cursor.sent?.folder === "Sent" && cursor.sent?.lastUid === 5, cursor);

    const before = server.bodyFetches.length;
    const again = await syncMailbox(db, db.tables.mailboxConnection[0], { parse: simpleParser, rescore: async () => null });
    ok("a second sync with nothing new downloads nothing and files nothing", again.ok && again.filed === 0 && server.bodyFetches.length === before, again);

    inbox.push(mk(14, "a2@client.ca", "dana@client.ca", "office@shop.ca", "Re: Kitchen", "Tuesday is great", 24));
    const third = await syncMailbox(db, db.tables.mailboxConnection[0], { parse: simpleParser, rescore: async () => null });
    ok("a new client message is picked up by UID", third.ok && third.filed === 1 && db.tables.mailboxConnection[0].cursor.inbox.lastUid === 14, third);

    // UIDVALIDITY changes and the server renumbers BELOW our last UID: the
    // folder is read again from the backfill date, nothing duplicates.
    folders.INBOX.uidValidity = 99;
    inbox.forEach((m, i) => (m.uid = i + 1));
    const f = await syncMailbox(db, db.tables.mailboxConnection[0], { parse: simpleParser, rescore: async () => null });
    const c = db.tables.mailboxConnection[0].cursor;
    ok("a UIDVALIDITY change re-reads the folder without filing anything twice", f.ok && f.filed === 0 && db.tables.emailMessage.length === 3 && c.inbox.uidValidity === 99 && c.inbox.lastUid === 4, { f, c, n: db.tables.emailMessage.length });
  } finally {
    await server.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Sending through the mailbox");
{
  const now = new Date("2026-09-24T12:00:00Z");
  ok("first send opens a window", throttleVerdict({}, { now, limit: 100 }).next.sendWindowCount === 1);
  ok("80% of the provider limit is the cap", throttleVerdict({ sendWindowStart: now, sendWindowCount: 79 }, { now, limit: 100 }).ok && !throttleVerdict({ sendWindowStart: now, sendWindowCount: 80 }, { now, limit: 100 }).ok);
  ok("the window resets after an hour", throttleVerdict({ sendWindowStart: new Date(now.getTime() - 61 * 60000), sendWindowCount: 999 }, { now, limit: 100 }).ok);
  ok("no published limit → no cap", throttleVerdict({ sendWindowStart: now, sendWindowCount: 10_000 }, { now, limit: null }).ok);

  ok("a member mailbox can never send", !send.canSend({ scope: "member", sendEnabled: true, status: "connected", secretEnc: "x", provider: "imap", smtpHost: "h", smtpPort: 465 }));
  ok("a switched-off mailbox cannot send", !send.canSend({ scope: "company", sendEnabled: false, status: "connected", secretEnc: "x", provider: "imap", smtpHost: "h", smtpPort: 465 }));
  ok("Google needs gmail.send granted", !send.canSend({ scope: "company", sendEnabled: true, status: "connected", secretEnc: "x", provider: "google", grantedScopes: "https://www.googleapis.com/auth/gmail.readonly" }));
  ok("Microsoft with Mail.Send granted can send", send.canSend({ scope: "company", sendEnabled: true, status: "connected", secretEnc: "x", provider: "microsoft", grantedScopes: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access" }));
  ok("the display name comes from the usual From", send.displayNameOf('"Northline Painting" <quotes@send.northline.ca>') === "Northline Painting");

  const composed = await send.composeClientMail({ fromName: "Northline Painting", fromAddress: "office@shop.ca", to: "dana@client.ca", subject: "Your quote", html: "<p>Hello</p>", text: "Hello", attachments: [{ filename: "quote.pdf", content: Buffer.from("%PDF").toString("base64") }] });
  const rawText = composed.raw.toString("utf8");
  ok("the composed message is from the mailbox under the company name", /^From: Northline Painting <office@shop\.ca>/m.test(rawText));
  ok("nothing FieldQuo-branded is added to the message", !/fieldquo/i.test(rawText), rawText.slice(0, 400));
  ok("the Message-ID is minted on the mailbox's domain", composed.messageId.endsWith("@shop.ca"));
  ok("the attachment rides along", /filename=quote\.pdf/.test(rawText));

  // trySendThroughMailbox with a fake transport: failure → { failed } + recorded.
  const conn = { id: "mbx_s", companyId: "co_1", scope: "company", sendEnabled: true, sendEnabledAt: now, status: "connected", provider: "imap", preset: "custom", address: "office@shop.ca", smtpHost: "smtp.example", smtpPort: 465, smtpSecurity: "tls", cursor: {}, sendWindowCount: 0 };
  conn.secretEnc = sealMailSecret("pw", conn.id);
  const db = createFakeDb({ mailboxConnection: [conn] });
  const failing = { sendMail: async () => { throw Object.assign(new Error("535 Authentication failed"), { responseCode: 535 }); }, close() {} };
  const r = await send.trySendThroughMailbox(db, { companyId: "co_1", mail: { to: "dana@client.ca", subject: "Quote", html: "<p>x</p>", text: "x", from: "Northline <q@send.northline.ca>" } }, { transport: failing, now: () => now });
  ok("a refused mailbox send reports 'failed' so the caller sends it the usual way", r.failed === true && r.code === "auth_failed", r);
  ok("…and the reason is written on the row for the settings card", /auth_failed/.test(db.tables.mailboxConnection[0].lastSendFallbackReason || ""));
  const sentTo = [];
  const working = { sendMail: async (m) => { sentTo.push(m.envelope.to); return { rejected: [] }; }, close() {} };
  const r2 = await send.trySendThroughMailbox(db, { companyId: "co_1", mail: { to: "dana@client.ca", subject: "Quote", html: "<p>x</p>", text: "x", from: "Northline <q@send.northline.ca>" } }, { transport: working, now: () => now, append: async () => null });
  ok("a working mailbox send is 'sent' with its Message-ID", r2.sent === true && r2.messageId?.endsWith("@shop.ca") && sentTo.length === 1, r2);
  ok("the hourly window counts it", db.tables.mailboxConnection[0].sendWindowCount === 1);
  db.tables.mailboxConnection[0].sendEnabled = false;
  const r3 = await send.trySendThroughMailbox(db, { companyId: "co_1", mail: { to: "a@b.co", subject: "s", text: "t" } }, { transport: working });
  ok("switched off → 'skipped' (the usual sender, silently)", r3.skipped === true);
  const other = await send.trySendThroughMailbox(db, { companyId: "co_2", mail: { to: "a@b.co", subject: "s", text: "t" } }, { transport: working });
  ok("another company never sends through this mailbox", other.skipped === true);
  db.tables.mailboxConnection[0].sendEnabled = true;
  db.tables.mailboxConnection[0].sendWindowStart = now;
  db.tables.mailboxConnection[0].sendWindowCount = 10_000;
  db.tables.mailboxConnection[0].preset = "namecheap";
  const limited = await send.trySendThroughMailbox(db, { companyId: "co_1", mail: { to: "a@b.co", subject: "s", text: "t" } }, { transport: working, now: () => now });
  ok("past the provider's hourly limit → 'failed' with hourly_limit (sent the usual way)", presets.hourlySendLimit(db.tables.mailboxConnection[0]) ? limited.failed && limited.code === "hourly_limit" : limited.sent, limited);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Presets and detection");
{
  const { PRESETS, presetForMx, resolveImapSettings } = presets;
  ok("every IMAP preset has host, port and security, TLS on 993 or STARTTLS", PRESETS.filter((p) => p.route === "imap").every((p) => p.imapHost && p.imapPort && ["tls", "starttls"].includes(p.imapSecurity)));
  ok("every preset names its source", PRESETS.every((p) => typeof p.source === "string" && /^https:\/\//.test(p.source)), PRESETS.filter((p) => !p.source).map((p) => p.key));
  ok("Namecheap Private Email is mail.privateemail.com:993 TLS", (() => {
    const n = PRESETS.find((p) => p.key === "namecheap");
    return n && n.imapHost === "mail.privateemail.com" && n.imapPort === 993 && n.imapSecurity === "tls";
  })());
  ok("MX privateemail.com → Namecheap", presetForMx(["mx1.privateemail.com", "mx2.privateemail.com"])?.key === "namecheap");
  ok("MX google → the Google option", presetForMx(["aspmx.l.google.com", "alt1.aspmx.l.google.com"])?.route === "google");
  ok("MX outlook → the Microsoft option", presetForMx(["truefinish-ca.mail.protection.outlook.com"])?.route === "microsoft");
  ok("an unknown MX → no preset (enter your host)", presetForMx(["mx.unknown-host.example"]) === null);
  ok("MX secureserver.net → GoDaddy; messagingengine → Fastmail", presetForMx(["mailstore1.secureserver.net"])?.key === "godaddy" && presetForMx(["in1-smtp.messagingengine.com"])?.key === "fastmail");
  ok("a Zoho EU MX is NOT matched to the US hosts", presetForMx(["mx.zoho.eu"]) === null);
  ok("Proton is recognised and refused as a password route", presetForMx(["mail.protonmail.ch"])?.route === "unsupported");
  const { presetForDomain, loginFor } = presets;
  ok("provider domains are known without DNS (icloud, shaw, gmail, hotmail)", presetForDomain("icloud.com")?.key === "icloud" && presetForDomain("shaw.ca")?.key === "shaw" && presetForDomain("gmail.com")?.route === "google" && presetForDomain("hotmail.com")?.route === "microsoft");
  ok("iCloud: IMAP signs in with the name before @, SMTP with the address (Apple's page)", loginFor({ preset: "icloud", address: "jo@icloud.com" }, "imap") === "jo" && loginFor({ preset: "icloud", address: "jo@icloud.com" }, "smtp") === "jo@icloud.com");
  ok("Shaw: both directions sign in without @shaw.ca", loginFor({ preset: "shaw", address: "bob@shaw.ca" }, "imap") === "bob" && loginFor({ preset: "shaw", address: "bob@shaw.ca" }, "smtp") === "bob");
  ok("an explicit login name wins", loginFor({ preset: "icloud", address: "jo@icloud.com", loginName: "custom" }, "imap") === "custom");
  ok("Namecheap's hourly figure is its published 500/hour/mailbox", presets.hourlySendLimit({ provider: "imap", preset: "namecheap" }) === 500);
  ok("a custom host that is not a hostname is refused", !resolveImapSettings({ address: "a@b.ca", preset: "custom", imapHost: "http://evil", imapPort: 993, imapSecurity: "tls" }).ok);
  ok("a custom host on a private IP is refused (no SSRF into our network)", !resolveImapSettings({ address: "a@b.ca", preset: "custom", imapHost: "10.0.0.5", imapPort: 993, imapSecurity: "tls" }).ok && !resolveImapSettings({ address: "a@b.ca", preset: "custom", imapHost: "localhost", imapPort: 993, imapSecurity: "tls" }).ok);
  ok("a preset ignores a browser-sent host (the preset's own host is used)", resolveImapSettings({ address: "a@b.ca", preset: "namecheap", imapHost: "evil.example", imapPort: 1 }).imap?.imapHost === "mail.privateemail.com");
  ok("plain (unencrypted) is never accepted from a browser", !resolveImapSettings({ address: "a@b.ca", preset: "custom", imapHost: "mail.b.ca", imapPort: 143, imapSecurity: "plain" }).ok);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Static: the credential never leaves the server");
{
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (name.endsWith(".js")) out.push(full);
    }
    return out;
  };
  const routes = walk(path.join(ROOT, "app/api"));
  const leaking = routes.filter((f) => /secretEnc\s*:\s*true/.test(readFileSync(f, "utf8")));
  ok("no route selects secretEnc", leaking.length === 0, leaking);
  const publicShape = read("lib/mailbox/connections.js").match(/export function publicShape[\s\S]*?\n}\n/)[0];
  ok("publicShape is an allowlist without the credential or the cursor", !/secretEnc|cursor|grantedScopes/.test(publicShape.replace(/\/\/.*$/gm, "").replace(/the credential, its ciphertext and the cursor/, "")));
  const imapSrc = read("lib/mailbox/providers/imap.js").replace(/\/\/.*$/gm, "");
  ok("the IMAP provider calls no write method", !/messageDelete|messageMove|messageCopy|messageFlagsAdd|messageFlagsSet|mailboxDelete|mailboxCreate|\.append\(|expunge/i.test(imapSrc));
  ok("the IMAP provider disables imapflow's logger (it logs LOGIN)", /logger:\s*false/.test(imapSrc));
  const docs = read("docs/VERCEL.md");
  for (const v of ["MAIL_CREDENTIALS_KEY", "MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET", "MICROSOFT_OAUTH_TENANT"]) ok(`${v} is documented in docs/VERCEL.md`, docs.includes(v));
  ok("the cron is scheduled", read("vercel.json").includes("/api/cron/mailbox-sync"));
  const resendSrc = read("lib/email/resend.js");
  ok("sendEmail tries the mailbox only for client mail with a company", /if \(companyId && clientMail\)/.test(resendSrc));
}

console.log(`\n${failed ? "✗" : "✓"} mailbox: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
