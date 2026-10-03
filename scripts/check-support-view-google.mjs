// scripts/check-support-view-google.mjs
//
//   npm run check:support-view-google
//
// The privacy policy's Section 9 promises Google that nobody at FieldQuo
// reads Google user data without the company's permission, for security, or
// for the law. A superadmin's read-only "view as company" needs no consent
// and opens the inbox — so the promise is kept in the API: a support session
// gets the FACT of a Gmail message (who, when, which way) and a sentence
// saying its content is withheld, and gets a Google review's name and stars
// without its words (lib/mailbox/supportView.js).
//
// This EXECUTES the GET handlers the screens read — the inbox list (with and
// without a search), one thread, the client page's filed email, the Google
// reviews card, the conversation score and the coach — against one seeded
// company, twice: as its owner, and as a superadmin viewing as that company
// (the member shape lib/currentMember.js returns for that session).
//
//   1. support session: no Gmail body, subject or attachment, no review text
//      or reply, and no verbatim quote from a Gmail thread, in ANY response;
//      the placeholder is there instead; Microsoft mail, SMS and the
//      review's stars and name still are.
//   2. the company's own owner: every one of those words IS there (proof the
//      fixture would have caught a leak), and nothing support-only — no
//      placeholder, no `hiddenInSupportView`, no `email` provenance key —
//      appears in their answer.
//
// --dump-normal=<file> writes each owner response as route:md5. Run it on
// this tree and on the tree before the gate (same fixture) and diff the two
// files: that is the byte-identical proof for a company's own staff.

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

for (const k of ["OPENAI_API_KEY", "DATABASE_URL", "GOOGLE_OAUTH_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[k];

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const route = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

const { db } = await import("@/lib/db");
const { session } = await import("@/lib/apiMember");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => (cond ? (pass += 1) : fails.push(detail ? `${label}\n      ${detail}` : label));

// ── The fixture ─────────────────────────────────────────────────────────────
const CO = "co_sv";
const SECRETS = {
  gmailBody: "SECRET-GMAIL-BODY we are getting other quotes so when can you start",
  gmailSubject: "SECRET-GMAIL-SUBJECT kitchen repaint",
  gmailAttachment: "SECRET-ATTACHMENT-plans.pdf",
  replySubject: "Re: SECRET-GMAIL-SUBJECT kitchen repaint",
  replyBody: "SECRET-REPLY-THROUGH-GMAIL thanks, Tuesday works",
  orphanBody: "SECRET-ORPHAN-BODY mailbox row gone",
  reviewText: "SECRET-REVIEW-TEXT great painters",
  reviewReply: "SECRET-REVIEW-REPLY thank you",
};
const VISIBLE = {
  msBody: "VISIBLE-MICROSOFT-BODY see attached",
  msSubject: "VISIBLE-MICROSOFT-SUBJECT deck stain",
  smsBody: "VISIBLE-SMS-BODY can you come Friday",
  reviewer: "Riley Reviewer",
};
const PLACEHOLDER = "Email content hidden in support view";
const REVIEW_PLACEHOLDER = "Review text hidden in support view";

async function seed() {
  db.__reset();
  const t0 = new Date("2026-09-01T12:00:00Z");
  const at = (min) => new Date(t0.getTime() + min * 60000);
  await db.company.create({ data: { id: CO, name: "Sample Painting", isDemo: false, defaultLanguage: "en", slug: "sample-sv" } });
  await db.user.create({ data: { id: "u_owner", email: "owner@sample.test", name: "Olive Owner", language: "en" } });
  await db.member.create({ data: { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner", active: true, permissions: null } });
  await db.client.create({ data: { id: "cl_1", companyId: CO, name: "Jane Client", email: "jane@client.test" } });
  await db.mailboxConnection.create({ data: { id: "mb_g", companyId: CO, memberId: "m_owner", provider: "google", address: "office@sample.test", status: "connected" } });
  await db.mailboxConnection.create({ data: { id: "mb_ms", companyId: CO, memberId: "m_owner", provider: "microsoft", address: "sales@sample.test", status: "connected" } });
  await db.messagingChannel.create({ data: { id: "ch_g", companyId: CO, platform: "email", name: "office@sample.test", status: "connected" } });
  await db.messagingChannel.create({ data: { id: "ch_ms", companyId: CO, platform: "email", name: "sales@sample.test", status: "connected" } });
  await db.messagingChannel.create({ data: { id: "ch_sms", companyId: CO, platform: "sms", name: "+15550001111", status: "connected" } });

  const thread = (id, channelId, last) =>
    db.messageThread.create({
      data: { id, companyId: CO, channelId, clientId: "cl_1", participantName: "Jane Client", participantExternalId: "jane@client.test", lastMessageAt: at(last), status: "open", unread: false, createdAt: at(0), threadNumber: 1 },
    });
  const message = (id, threadId, direction, body, min, extra = {}) =>
    db.message.create({ data: { id, threadId, direction, private: false, body, sentAt: at(min), externalId: `x-${id}`, attachments: null, ...extra } });
  const email = (messageId, mailboxId, subject, extra = {}) =>
    db.emailMessage.create({
      data: { id: `e_${messageId}`, companyId: CO, messageId, mailboxId, rfcMessageId: `${messageId}@sample.test`, subject, fromAddress: "Jane <jane@client.test>", toAddresses: "office@sample.test", filedBy: "sync", ...extra },
    });

  await thread("th_g", "ch_g", 30);
  await message("msg_g1", "th_g", "in", SECRETS.gmailBody, 10, {
    attachments: [{ type: "file", url: "https://res.cloudinary.com/demo/raw/upload/v1/secret.pdf", filename: SECRETS.gmailAttachment, mimeType: "application/pdf", bytes: 1200, state: "stored" }],
  });
  await email("msg_g1", "mb_g", SECRETS.gmailSubject);
  await message("msg_g2", "th_g", "out", SECRETS.replyBody, 20);
  await email("msg_g2", "mb_g", SECRETS.replySubject, { filedBy: "inbox_reply", sentVia: "mailbox" });
  await message("msg_g3", "th_g", "in", SECRETS.orphanBody, 30);
  await email("msg_g3", null, "SECRET-ORPHAN-SUBJECT");

  await thread("th_ms", "ch_ms", 25);
  await message("msg_ms1", "th_ms", "in", VISIBLE.msBody, 25);
  await email("msg_ms1", "mb_ms", VISIBLE.msSubject);

  await thread("th_sms", "ch_sms", 15);
  await message("msg_sms1", "th_sms", "in", VISIBLE.smsBody, 15);

  await db.googleReview.create({
    data: { id: "gr_1", companyId: CO, reviewName: "accounts/1/locations/2/reviews/3", reviewerName: VISIBLE.reviewer, starRating: 5, comment: SECRETS.reviewText, replyComment: SECRETS.reviewReply, reviewCreateTime: at(5), fetchedAt: at(40), showOnSite: false },
  });
}

const OWNER = { id: "m_owner", userId: "u_owner", companyId: CO, role: "owner" };
const SUPPORT = { ...OWNER, impersonation: true, impersonationMode: "read_only", platformAdminId: "pa_1" };

const REQUESTS = [
  { name: "inbox list", file: "app/api/messaging/threads/route.js", url: "/api/messaging/threads" },
  { name: "inbox search for a Gmail word", file: "app/api/messaging/threads/route.js", url: "/api/messaging/threads?q=SECRET-GMAIL-BODY" },
  { name: "Gmail thread", file: "app/api/messaging/threads/[id]/route.js", url: "/api/messaging/threads/th_g", params: { id: "th_g" } },
  { name: "Microsoft thread", file: "app/api/messaging/threads/[id]/route.js", url: "/api/messaging/threads/th_ms", params: { id: "th_ms" } },
  { name: "SMS thread", file: "app/api/messaging/threads/[id]/route.js", url: "/api/messaging/threads/th_sms", params: { id: "th_sms" } },
  { name: "client page filed email", file: "app/api/mailbox/filed/route.js", url: "/api/mailbox/filed?clientId=cl_1" },
  { name: "Google reviews card", file: "app/api/settings/google-reviews/route.js", url: "/api/settings/google-reviews" },
  { name: "Gmail thread score", file: "app/api/messaging/threads/[id]/temperature/route.js", url: "/api/messaging/threads/th_g/temperature", params: { id: "th_g" } },
  { name: "Gmail thread coach", file: "app/api/messaging/threads/[id]/coach/route.js", url: "/api/messaging/threads/th_g/coach", params: { id: "th_g" } },
];

async function run(member) {
  await seed();
  // The coach's stored reading quotes the homeowner; seeded so a leak would show.
  await db.conversationCoach.create({
    data: { id: "cc_1", companyId: CO, threadId: "th_g", generatedAt: new Date("2026-09-02T00:00:00Z"), basedOnMessages: 3, readerLanguage: "en", replyLanguage: "en", promptTokens: 10, completionTokens: 10, result: { redFlags: [{ kind: "shopping_around", quote: "SECRET-COACH-QUOTE getting other quotes" }] } },
  });
  session.member = member;
  const out = {};
  for (const r of REQUESTS) {
    const mod = await route(r.file);
    const req = new Request(`https://www.fieldquo.com${r.url}`, { method: "GET" });
    const res = await mod.GET(req, r.params ? { params: Promise.resolve(r.params) } : undefined);
    out[r.name] = { status: res.status, text: await res.text() };
  }
  return out;
}

const owner = await run(OWNER);
const support = await run(SUPPORT);

// ── 0. Every route answered ─────────────────────────────────────────────────
console.log("0. Every route answers both sessions\n");
for (const r of REQUESTS) {
  ok(`${r.name}: owner 200`, owner[r.name].status === 200, `${owner[r.name].status} ${owner[r.name].text.slice(0, 300)}`);
  ok(`${r.name}: support 200`, support[r.name].status === 200, `${support[r.name].status} ${support[r.name].text.slice(0, 300)}`);
}

// ── 1. The support session reads no Google content ─────────────────────────
console.log("1. A support session gets no Gmail content and no review text\n");
const allSupport = Object.values(support).map((r) => r.text).join("\n");
ok("no SECRET token in any support response", !/SECRET/.test(allSupport), (allSupport.match(/.{0,60}SECRET.{0,60}/g) || []).slice(0, 5).join("\n      "));
ok("the Gmail thread still lists three messages", (JSON.parse(support["Gmail thread"].text).thread?.messages || []).length === 3);
const gThread = JSON.parse(support["Gmail thread"].text).thread;
ok("each Gmail message carries the placeholder and no attachment", gThread.messages.every((m) => m.body.startsWith(PLACEHOLDER) && m.attachments.length === 0 && m.hiddenInSupportView === true));
ok("no provenance key reaches the browser", gThread.messages.every((m) => !("email" in m)));
ok("the Gmail thread keeps its sender and dates", gThread.participantName === "Jane Client" && gThread.messages.every((m) => m.sentAt));
const filed = JSON.parse(support["client page filed email"].text).threads;
const filedG = filed.find((t) => t.id === "th_g");
ok("filed email: Gmail subject is 'Email from client'", filedG?.subject === "Email from client", filedG?.subject);
ok("filed email: an outbound Gmail reply reads 'Email to client'", filedG?.messages.find((m) => m.id === "msg_g2")?.subject === "Email to client");
ok("filed email: Microsoft subject and body still shown", /VISIBLE-MICROSOFT-SUBJECT/.test(support["client page filed email"].text) && /VISIBLE-MICROSOFT-BODY/.test(support["client page filed email"].text));
ok("inbox list: Microsoft and SMS previews still shown", /VISIBLE-MICROSOFT-BODY/.test(support["inbox list"].text) && /VISIBLE-SMS-BODY/.test(support["inbox list"].text));
ok("inbox list: the Gmail row's preview is the placeholder", JSON.parse(support["inbox list"].text).threads.find((t) => t.id === "th_g")?.preview.startsWith(PLACEHOLDER));
ok("inbox search: a Gmail-only word finds nothing for support", JSON.parse(support["inbox search for a Gmail word"].text).threads.length === 0);
const review = JSON.parse(support["Google reviews card"].text).reviews[0];
ok("review: text and reply replaced, name and stars kept", review.comment.startsWith(REVIEW_PLACEHOLDER) && review.replyComment.startsWith(REVIEW_PLACEHOLDER) && review.reviewerName === VISIBLE.reviewer && review.starRating === 5);
const quotesIn = (v, acc = []) => {
  if (Array.isArray(v)) v.forEach((x) => quotesIn(x, acc));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (k === "quote" || k === "note") && typeof x === "string" ? acc.push(x) : quotesIn(x, acc);
  return acc;
};
ok("score: every quote on the Gmail thread is blank", quotesIn(JSON.parse(support["Gmail thread score"].text).score).every((q) => q === ""));
ok("coach: no stored coaching for the Gmail thread", JSON.parse(support["Gmail thread coach"].text).coach === null);
ok("coach: likelihood quotes blank", quotesIn(JSON.parse(support["Gmail thread coach"].text).likelihood).every((q) => q === ""));

// ── 2. The company's own owner reads everything, unchanged ─────────────────
console.log("2. The company's own owner gets every word, and nothing support-only\n");
const allOwner = Object.values(owner).map((r) => r.text).join("\n");
for (const [k, v] of Object.entries(SECRETS)) {
  if (k === "replySubject") continue; // the filed route shows the FIRST subject on the thread; the reply's is per message
  ok(`owner sees ${k}`, allOwner.includes(v));
}
ok("owner sees the reply's own subject on its message", owner["client page filed email"].text.includes(SECRETS.replySubject));
ok("owner sees the attachment", allOwner.includes(SECRETS.gmailAttachment));
ok("owner sees the stored coaching", owner["Gmail thread coach"].text.includes("SECRET-COACH-QUOTE"));
ok("owner's score quotes the homeowner (the path the gate blanks is live)", quotesIn(JSON.parse(owner["Gmail thread score"].text).score).some((q) => q.length > 0));
ok("owner search finds the Gmail thread", JSON.parse(owner["inbox search for a Gmail word"].text).threads.some((t) => t.id === "th_g"));
ok("no placeholder in any owner response", !allOwner.includes(PLACEHOLDER) && !allOwner.includes(REVIEW_PLACEHOLDER));
ok("no hiddenInSupportView in any owner response", !allOwner.includes("hiddenInSupportView"));
ok("no provenance key in the owner's thread", JSON.parse(owner["Gmail thread"].text).thread.messages.every((m) => !("email" in m)));

const dumpArg = process.argv.find((a) => a.startsWith("--dump-normal="));
if (dumpArg) {
  const lines = REQUESTS.map((r) => `${r.name}: ${owner[r.name].status}:${createHash("md5").update(owner[r.name].text).digest("hex")}`);
  writeFileSync(dumpArg.split("=")[1], lines.join("\n") + "\n");
  console.log(`owner responses written to ${dumpArg.split("=")[1]}`);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
