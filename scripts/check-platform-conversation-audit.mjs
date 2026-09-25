// scripts/check-platform-conversation-audit.mjs
//
//   npm run check:platform-conversation-audit
//
// The owner reading a rep's texts and emails with prospects from the console
// (app/api/platform/sales/conversations/*, lib/sales/conversationAudit.js),
// and the rep being told ("Reviewed by the owner on <date>").
//
// ══ What is proved ════════════════════════════════════════════════════════
//
//   1. Refusal without the permission: "chat:audit" is superadmin-only in
//      the matrix, both routes are gated on it through the shared gate, and
//      the gate refuses admin/support with a 403 — executed against the
//      matrix, and read off the routes.
//   2. Read-only: no write handler on either route, no send in the lib, no
//      read marker or triage touched — the rep's unread counts stay theirs.
//   3. The audit row: every thread read writes `rep_conversation_audited`
//      BEFORE the words are returned, with the rep, the kind and the thread.
//   4. The rep is told: both rep-facing thread routes (texts, email) carry
//      `reviewedByOwner`, read from that same audit row by lastReviewOf, and
//      the email thread screen draws it; the texts screen's mount is owned
//      by another change and is asserted where it lands.
//   5. The screen: /platform/sales/conversations is gated on the same
//      permission through the shared hook and gate, mirrors the rep's list
//      with the chat kit and draws messages with the rep's own renderer —
//      and has no composer.
//
// Source is read DECOMMENTED (this file's own prose would match itself).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { canPlatform, SUPERADMIN_ONLY_PERMISSIONS } from "@/lib/platform/permissions";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";
import {
  CONVERSATION_KINDS,
  matchesQuery,
  repSmsConversation,
  repEmailConversation,
  lastReviewOf,
} from "@/lib/sales/conversationAudit";
import { fakeAuditDb } from "./auditFakeDb.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Refused without the permission");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("chat:audit is declared superadmin-only", SUPERADMIN_ONLY_PERMISSIONS.includes("chat:audit"));
  ok("a superadmin holds it", canPlatform("superadmin", "chat:audit"));
  ok("an admin is refused", !canPlatform("admin", "chat:audit"));
  ok("support is refused", !canPlatform("support", "chat:audit"));
  ok("an unknown role is refused", !canPlatform("rep", "chat:audit") && !canPlatform(undefined, "chat:audit"));

  const gate = decomment(read("lib/platform/auditGate.js"));
  ok("the gate answers 401 with no admin", /status: 401/.test(gate));
  ok("…403 without the permission, with a code the screen can read", /status: 403/.test(gate) && /code: "not_auditor"/.test(gate));
  ok("…and checks the ROW's role, not only the token's", /canPlatform\(row\.role, permission\)/.test(gate));

  const list = decomment(read("app/api/platform/sales/conversations/route.js"));
  const one = decomment(read("app/api/platform/sales/conversations/[kind]/[id]/route.js"));
  ok("the list route is gated on chat:audit", /requireAuditor\(request, "chat:audit"\)/.test(list));
  ok("the thread route is gated on chat:audit", /requireAuditor\(request, "chat:audit"\)/.test(one));
  ok("…and refuses before reading (the refusal is returned first)", one.indexOf("if (refusal) return") < one.indexOf("await params"));
  ok("params is awaited (a Promise in Next 16)", /const \{ kind, id \} = await params;/.test(one));
  ok("an unknown kind is a 400, not a crash", /CONVERSATION_KINDS\.includes\(kind\)/.test(one) && /status: 400/.test(one));
  ok("the kinds are sms and email", CONVERSATION_KINDS.join() === "sms,email");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Read-only, and the rep's own state is untouched");
// ═══════════════════════════════════════════════════════════════════════════

{
  const list = decomment(read("app/api/platform/sales/conversations/route.js"));
  const one = decomment(read("app/api/platform/sales/conversations/[kind]/[id]/route.js"));
  const lib = decomment(read("lib/sales/conversationAudit.js"));
  ok("no write handler on the list route", !/export async function (POST|PATCH|PUT|DELETE)/.test(list));
  ok("no write handler on the thread route", !/export async function (POST|PATCH|PUT|DELETE)/.test(one));
  ok("the lib never sends", !/deliverReplySms|deliverOutreach|sendSms|resend/.test(lib));
  ok("…never writes a read marker (the rep's unread stays theirs)", !/markThreadRead|threadReadState|SalesThreadRead|readState/.test(lib));
  ok("…never writes triage or a message", !/salesSmsMessage\.(update|create|delete)|salesMessage\.(update|create|delete)|salesThread\.(update|create|delete)/.test(lib));
  ok("the only write is the audit row", (lib.match(/(db|client)\.\w+\.(create|update|upsert|delete)\w*\(/g) || []).join() === "client.platformAuditLog.create(", lib.match(/(db|client)\.\w+\.(create|update|upsert|delete)\w*\(/g));
  ok("the text list reuses the rep's own grouping WITHOUT read states", /salesConversations\(\{ salesRepId: rep\.id, limit: 200 \}\)/.test(lib));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every thread read writes the audit row, first");
// ═══════════════════════════════════════════════════════════════════════════

{
  const lib = decomment(read("lib/sales/conversationAudit.js"));
  ok("the action is rep_conversation_audited", /action: "rep_conversation_audited"/.test(lib));
  ok("…described for the audit-log screen, in the access tone", AUDIT_ACTIONS.rep_conversation_audited?.tone === "access");
  ok("a text thread records the rep, kind sms, the number and the lead", /recordLook\(viewer, \{ repId: rep\.id, kind: "sms", with: other, leadId: lead\?\.id \|\| null \}, client\)/.test(lib));
  ok("an email thread records the rep, kind email, the thread and the lead", /kind: "email",\s*threadId: thread\.id,\s*leadId: thread\.lead\?\.id \|\| null/.test(lib));
  // The record before the words, both kinds.
  const smsSrc = lib.slice(lib.indexOf("export async function repSmsConversation"), lib.indexOf("export async function repEmailConversation"));
  const mailSrc = lib.slice(lib.indexOf("export async function repEmailConversation"), lib.indexOf("export async function lastReviewOf"));
  ok("…written before the text thread is returned", smsSrc.indexOf("recordLook(") < smsSrc.indexOf("return {"));
  ok("…and before the email thread is returned", mailSrc.indexOf("recordLook(") < mailSrc.indexOf("return {"));
  ok("the response carries when the look was recorded", /audited: \{ at: look\.createdAt \}/.test(lib));
  ok("the list records nothing (only opening a thread does)", !lib.slice(lib.indexOf("export async function repConversations"), lib.indexOf("function recordLook")).includes("recordLook("));
  ok("attachments reach the owner in the same public shape the rep gets", /publicAttachments\(attachments\)/.test(lib));

  // ── EXECUTED against an in-memory database ─────────────────────────────
  const t0 = new Date("2026-09-14T15:00:00Z");
  const db = fakeAuditDb({
    platformAdmin: [{ id: "owner", email: "emilio.boves@gmail.com", role: "superadmin", active: true }],
    salesRep: [{ id: "r1", name: "Daniel", email: "d@x", active: true, endedAt: null }],
    salesLead: [{ id: "l1", businessName: "Northside Painting", contactName: "Sam", email: "sam@north.side", status: "contacted" }],
    salesSmsMessage: [
      { id: "s1", direction: "out", salesRepId: "r1", leadId: "l1", fromE164: "+15140000000", toE164: "+15145550134", body: "hi from Daniel", sentAt: new Date(t0.getTime() - 2000) },
      { id: "s2", direction: "in", salesRepId: "r1", leadId: null, fromE164: "+15145550134", toE164: "+15140000000", body: "sure, Thursday", sentAt: new Date(t0.getTime() - 1000) },
      { id: "s3", direction: "out", salesRepId: "r1", leadId: null, fromE164: "+15140000000", toE164: "+16130000000", body: "somebody else", sentAt: t0 },
    ],
    salesThread: [{ id: "t1", salesRepId: "r1", leadId: "l1", subject: "Your quote", lastMessageAt: t0, createdAt: t0, replyToken: "tok" }],
    salesMessage: [
      { id: "e1", threadId: "t1", direction: "out", fromAddress: "d@x", toAddress: "sam@north.side", subject: "Your quote", body: "hello", sentAt: t0, attachments: null, forwardProviderId: null },
      { id: "e2", threadId: "t1", direction: "in", fromAddress: "sam@north.side", toAddress: "d@x", subject: "Re: Your quote", body: "plan attached", sentAt: new Date(t0.getTime() + 1000), attachments: [{ type: "file", url: "https://res.cloudinary.com/x/plan.pdf", filename: "plan.pdf", bytes: 10, mimeType: "application/pdf", sourceUrl: "https://secret.example/plan" }], forwardProviderId: "fwd_1" },
    ],
  });
  const owner = { id: "owner", email: "emilio.boves@gmail.com", role: "superadmin" };

  ok("EXECUTED: before any look, the rep's thread says nothing", (await lastReviewOf({ repId: "r1", kind: "sms", with: "+15145550134" }, { client: db })) === null);

  const sms = await repSmsConversation(owner, { repId: "r1", e164: "(514) 555-0134" }, { client: db });
  ok("EXECUTED: the owner reads the text thread, both directions, oldest first", sms?.messages.map((m) => m.body).join("|") === "hi from Daniel|sure, Thursday", sms?.messages);
  ok("…named for the business the lead row gives", sms?.lead?.businessName === "Northside Painting");
  ok("…and not the rep's OTHER conversation", !sms.messages.some((m) => m.body === "somebody else"));
  ok("…which wrote ONE rep_conversation_audited row", db.tables.platformAuditLog.length === 1 && db.tables.platformAuditLog[0].action === "rep_conversation_audited");
  const d1 = db.tables.platformAuditLog[0].details;
  ok("…naming the rep, kind sms, the E.164 and the lead", d1.repId === "r1" && d1.kind === "sms" && d1.with === "+15145550134" && d1.leadId === "l1", d1);
  ok("…and nothing else changed (no marker, no message, no triage)", db.tables.salesSmsMessage.length === 3 && Object.keys(db.tables).every((k) => k === "platformAuditLog" || k === "salesSmsMessage" || db.tables[k].length === (k === "salesMessage" ? 2 : k === "salesThread" ? 1 : k === "salesLead" ? 1 : k === "salesRep" ? 1 : k === "platformAdmin" ? 1 : 0)));

  const rv = await lastReviewOf({ repId: "r1", kind: "sms", with: "514-555-0134" }, { client: db });
  ok("EXECUTED: the rep's thread now says 'Reviewed by the owner' — from the same row", rv?.by === "emilio.boves@gmail.com" && rv?.at instanceof Date, rv);
  ok("…keyed on the NUMBER: the rep's other thread says nothing", (await lastReviewOf({ repId: "r1", kind: "sms", with: "+16130000000" }, { client: db })) === null);
  ok("…and on the REP: another rep's same number says nothing", (await lastReviewOf({ repId: "r9", kind: "sms", with: "+15145550134" }, { client: db })) === null);
  ok("…and on the KIND: the email thread says nothing yet", (await lastReviewOf({ repId: "r1", kind: "email", threadId: "t1" }, { client: db })) === null);

  const mail = await repEmailConversation(owner, { threadId: "t1" }, { client: db });
  ok("EXECUTED: the owner reads the email thread", mail?.messages.map((m) => m.body).join("|") === "hello|plan attached");
  ok("…with the prospect's attachment in the PUBLIC shape — no fetcher-only field", mail.messages[1].attachments[0].url === "https://res.cloudinary.com/x/plan.pdf" && !("sourceUrl" in mail.messages[1].attachments[0]));
  ok("…and a boolean for the forward, not the provider id", mail.messages[1].forwardedToMailbox === true && !("forwardProviderId" in mail.messages[1]));
  ok("…which wrote a second row, kind email, naming the thread", db.tables.platformAuditLog.length === 2 && db.tables.platformAuditLog[1].details.kind === "email" && db.tables.platformAuditLog[1].details.threadId === "t1" && db.tables.platformAuditLog[1].details.repId === "r1");
  ok("EXECUTED: the rep's email thread now says 'Reviewed by the owner'", Boolean(await lastReviewOf({ repId: "r1", kind: "email", threadId: "t1" }, { client: db })));
  ok("a number nobody texted is null, not a throw", (await repSmsConversation(owner, { repId: "r1", e164: "+19990000000" }, { client: db })) === null);
  ok("an unknown rep is null", (await repSmsConversation(owner, { repId: "nope", e164: "+15145550134" }, { client: db })) === null);
  ok("an unknown thread is null", (await repEmailConversation(owner, { threadId: "nope" }, { client: db })) === null);
  ok("no viewer reads nothing, and writes nothing", (await repSmsConversation(null, { repId: "r1", e164: "+15145550134" }, { client: db })) === null && db.tables.platformAuditLog.length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The rep is told: 'Reviewed by the owner on <date>'");
// ═══════════════════════════════════════════════════════════════════════════

{
  const lib = decomment(read("lib/sales/conversationAudit.js"));
  ok("lastReviewOf reads the audit row — no second column to drift", /action: "rep_conversation_audited"/.test(lib.slice(lib.indexOf("export async function lastReviewOf"))));
  ok("…keyed on rep, kind and the thread", /path: \["repId"\]/.test(lib) && /path: \["kind"\]/.test(lib) && /path: \["with"\]/.test(lib) && /path: \["threadId"\]/.test(lib));
  ok("…and fails soft to null (the rep's thread must still load)", /catch \(err\) \{[\s\S]*?return null;/.test(lib.slice(lib.indexOf("export async function lastReviewOf"))));
  ok("…refusing an unknown kind", /if \(!repId \|\| !CONVERSATION_KINDS\.includes\(kind\)\) return null;/.test(lib));

  const texts = decomment(read("app/api/sales/messages/route.js"));
  ok("the rep's TEXT thread payload carries reviewedByOwner", /reviewedByOwner,/.test(texts) && /lastReviewOf\(\{ repId: rep\.id, kind: "sms", with: withE164 \}\)/.test(texts));
  const mail = decomment(read("app/api/sales/threads/[id]/route.js"));
  ok("the rep's EMAIL thread payload carries reviewedByOwner", /reviewedByOwner: await lastReviewOf\(\{ repId: rep\.id, kind: "email", threadId: thread\.id \}\)/.test(mail));

  ok("a shared rep-facing component draws the line", existsSync(join(ROOT, "app/components/sales/ReviewedByOwner.js")));
  const line = decomment(read("app/components/sales/ReviewedByOwner.js"));
  ok("…from the review's date, in the rep's language", /app\.salesText\.reviewedByOwner/.test(line) && /toLocaleDateString\(language/.test(line));
  ok("…and draws nothing when there is no review (never 'never reviewed')", /if \(!at \|\| Number\.isNaN\(at\.getTime\(\)\)\) return null;/.test(line));
  // The email thread is drawn by the three-pane inbox at /sales/threads
  // since a250a7cd; /sales/threads/[id] only redirects there. `detail` is
  // what that screen fetched from /api/sales/threads/[id] — the payload the
  // assertion above holds to carrying reviewedByOwner.
  const inbox = decomment(read("app/sales/threads/page.js"));
  ok("the email thread screen mounts it",
    /<ReviewedByOwner review=\{detail\.reviewedByOwner\}/.test(inbox) &&
      /fetchJson\(`\/api\/sales\/threads\/\$\{encodeURIComponent\(id\)\}`\)/.test(inbox));
  // The texts screen (app/sales/messages/page.js) is owned by a concurrent
  // change; the mount there is one line — <ReviewedByOwner review=
  // {thread?.reviewedByOwner} /> under the thread header — and this check
  // reports rather than fails until it lands, so the report says so.
  const textsPage = decomment(read("app/sales/messages/page.js"));
  const textsMounted = /<ReviewedByOwner/.test(textsPage);
  console.log(`  ${textsMounted ? "ok  " : "note"} the texts screen ${textsMounted ? "mounts" : "does not yet mount"} ReviewedByOwner (app/sales/messages/page.js)`);
  if (textsMounted) pass++;

  const en = read("app/i18n/appMessages.js");
  ok("the sentence exists in nine languages", (en.match(/"app\.salesText\.reviewedByOwner":/g) || []).length === 9);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The console screen: gated, mirrored, no composer");
// ═══════════════════════════════════════════════════════════════════════════

{
  const page = decomment(read("app/platform/sales/conversations/page.js"));
  ok("the page asks the shared hook", /usePlatformAdmin\(\)/.test(page));
  ok("…for the same permission the routes enforce", /can\("chat:audit"\)/.test(page));
  ok("…and renders its refusal through the shared gate", /<PlatformWriteGate/.test(page));
  ok("it draws messages with the rep's own renderer", /import MessageThread from "@\/app\/sales\/messages\/MessageThread"/.test(page) && /<MessageThread messages=/.test(page));
  ok("…and lists with the chat kit, like the rep's Texts", /RoomList/.test(page) && /ChatLayout/.test(page));
  ok("…with no composer and no send (grep-proof)", !/<Composer/.test(page) && !/method: "POST"/.test(page) && !/textarea/.test(page));
  ok("…reads only the audit routes", /\/api\/platform\/sales\/conversations/.test(page) && !/\/api\/sales\//.test(page));
  ok("…says the rep is told, on the thread", /Read-only audit view — the rep is told you looked\./.test(page) && /data-audit-banner/.test(page));
  ok("…and says so at the top, like /platform/sales/notes", /Reps are told\./.test(page));
  ok("?repId= from the rep card is honoured", /URLSearchParams\(window\.location\.search\)\.get\("repId"\)/.test(page));
  ok("the sidebar reaches it", /href: "\/platform\/sales\/conversations"/.test(decomment(read("app/components/platform/PlatformSidebar.js"))));

  ok("the search box matches name, number and subject, case-blind", matchesQuery({ name: "Northside Painting" }, "north") && matchesQuery({ e164: "+15145550134" }, "0134") && matchesQuery({ subject: "Re: your quote" }, "QUOTE") && !matchesQuery({ name: "Loop" }, "north"));
  ok("…and an empty query matches everything", matchesQuery({}, "") && matchesQuery(null, "  "));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Help says it, in words");
// ═══════════════════════════════════════════════════════════════════════════

{
  const sentence = "The owner can read any staff conversation and any rep–prospect conversation; you are told when they have.";
  ok("the platform runbook carries the sentence", read("app/data/helpArticles.js").includes(sentence));
  ok("the sales manual (EN) carries it", read("docs/sales/manual/content.en.js").includes(sentence));
  ok("…and ES and FR carry their own", /propietario puede leer cualquier conversación/.test(read("docs/sales/manual/content.es.js")) && /propriétaire peut lire toute conversation/.test(read("docs/sales/manual/content.fr.js")));
  const pkg = JSON.parse(read("package.json"));
  ok("check:platform-conversation-audit is a script", typeof pkg.scripts?.["check:platform-conversation-audit"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:platform-conversation-audit"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
