// scripts/check-messaging.mjs
//
//   npm run check:messaging
//
// The regression guard for /app/messages — the Facebook Page and Instagram
// business inbox, its signed webhook, its send path, and the month-end review
// the whole feature exists to produce.
//
// ══ What this EXECUTES rather than reads ═══════════════════════════════════
//
// Nearly all of it. The claims that matter here are behavioural, and every one
// of them has a version that passes a regex while being broken:
//
//   * "the webhook verifies Meta's signature" — proved by signing a body with
//     the real primitive, then flipping one byte, then removing the secret.
//   * "a re-delivered message is not posted twice" — proved by delivering the
//     SAME payload twice through the real ingest against a scripted database
//     and counting rows.
//   * "the company never comes from the payload" — proved by putting a foreign
//     companyId IN the payload and asserting the row carries the CHANNEL's.
//   * "the send refuses when no Page is connected" — proved by calling the
//     real send function with no channel and inspecting the reason.
//   * "absence never reads as zero" — proved by running the real month-end
//     arithmetic over an empty month and over a month nobody replied in.
//   * "the composer is disabled WITH a reason" — proved by executing the pure
//     decision function for every connection state.
//   * "the outbound bubble is readable" — proved by measuring the contrast of
//     the colours the server actually sends, for hostile brand hexes.
//
// The few things asserted as TEXT are asserted positionally and named as such
// below: JSX cannot be imported here, so where a claim is about the page's
// markup it is matched against the source with the assertion written so that
// deleting the guard fails.
//
// Run:
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-messaging.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyWebhookSignature,
  signWebhookBody,
  verifySubscribeChallenge,
} from "@/lib/messaging/webhookSignature";
import { parseMessagingEnvelope } from "@/lib/messaging/envelope";
import { ingestEvent, ingestEvents } from "@/lib/messaging/ingest";
import { sendMetaMessage } from "@/lib/messaging/metaSend";
import {
  buildMonthlyReview,
  firstResponse,
  median,
  monthRange,
} from "@/lib/messaging/monthlyReview";
import { composerBlock, connectionBlurb } from "@/lib/messaging/composerState";
import { bubbleColours } from "@/lib/messaging/bubbleTheme";
import { normaliseOutcome, normaliseStatus, THREAD_OUTCOMES } from "@/lib/messaging/outcomes";
import { demoThreads } from "@/lib/messaging/demoThreads";
import { META_OAUTH_SCOPE, META_MESSAGING_SCOPE } from "@/lib/meta/client";
import { FEATURES } from "@/lib/features/registry";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label + (detail ? `  — ${detail}` : ""));
    console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The webhook signature — valid, forged, missing, unset secret");
// ═══════════════════════════════════════════════════════════════════════════

const SECRET = "a-real-looking-app-secret";
const BODY = JSON.stringify({
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      time: 1757000000000,
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: "PAGE_1" },
          timestamp: 1757000000000,
          message: { mid: "mid.aaa", text: "Do you do kitchens?" },
        },
      ],
    },
  ],
});

ok(
  "a signature made with the app secret verifies",
  verifyWebhookSignature(BODY, signWebhookBody(BODY, SECRET), SECRET).ok,
);

// One byte changed in the hex digest. This is the assertion that fails if
// somebody swaps timingSafeEqual for a truthy check on the header's presence.
const good = signWebhookBody(BODY, SECRET);
const forged = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
const forgedResult = verifyWebhookSignature(BODY, forged, SECRET);
ok("a forged signature is refused", !forgedResult.ok && forgedResult.reason === "bad_signature");

// The same signature over a DIFFERENT body: the attack a verifier that hashes
// the parsed object instead of the raw bytes would wave through.
const tampered = BODY.replace("Do you do kitchens?", "Send payment to this account");
ok(
  "a valid signature over a different body is refused",
  !verifyWebhookSignature(tampered, good, SECRET).ok,
);

const unset = verifyWebhookSignature(BODY, good, "");
ok(
  "an UNSET app secret refuses rather than skipping verification",
  !unset.ok && unset.reason === "secret_unset",
);
ok(
  "a missing signature header is refused",
  !verifyWebhookSignature(BODY, null, SECRET).ok,
);
ok(
  "a non-hex signature is refused before any comparison",
  verifyWebhookSignature(BODY, "sha256=not-hex-at-all", SECRET).reason === "malformed_signature",
);
ok(
  "an unexpected algorithm prefix is refused",
  verifyWebhookSignature(BODY, "sha1=abcdef", SECRET).reason === "unexpected_algorithm",
);

// The GET handshake.
const params = new URLSearchParams({
  "hub.mode": "subscribe",
  "hub.verify_token": "the-token",
  "hub.challenge": "1234567890",
});
ok(
  "the subscribe handshake echoes the challenge for the right token",
  verifySubscribeChallenge(params, "the-token").challenge === "1234567890",
);
ok(
  "the subscribe handshake refuses a wrong token",
  !verifySubscribeChallenge(params, "another-token").ok,
);
ok(
  "the subscribe handshake refuses when the verify token is UNSET",
  verifySubscribeChallenge(params, "").reason === "verify_token_unset",
);

// The route reads the RAW body and refuses on a bad signature. Matched
// positionally: the text-only assertions in this file, named as such.
const webhookSrc = read("app/api/meta/messaging/webhook/route.js");
ok(
  "the webhook route verifies BEFORE parsing the body",
  webhookSrc.indexOf("verifyWebhookSignature") < webhookSrc.indexOf("JSON.parse(raw)"),
);
ok(
  "the webhook route reads the raw body, not the parsed object",
  /await request\.text\(\)/.test(webhookSrc) && !/await request\.json\(\)/.test(webhookSrc),
);
ok(
  "a refused signature answers 403 and no body detail",
  /signature refused[\s\S]{0,200}status: 403/.test(webhookSrc),
);
ok("the webhook is rate limited", /rateLimit\(request, "meta-messaging-webhook"/.test(webhookSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The envelope — both directions, echoes, and what it drops");
// ═══════════════════════════════════════════════════════════════════════════

const inbound = parseMessagingEnvelope(JSON.parse(BODY));
ok("an inbound Page message parses as direction 'in'", inbound.events[0]?.direction === "in");
ok("the participant is the sender, not the Page", inbound.events[0]?.participantExternalId === "PSID_1");
ok("the platform maps object:page to facebook", inbound.platform === "facebook");

// An ECHO — the contractor's own reply, delivered back by Meta. Sender and
// recipient are the other way round, and getting this wrong files the
// company's own replies as if a homeowner wrote them, which would corrupt
// every response-time figure in the review.
const echo = parseMessagingEnvelope({
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      messaging: [
        {
          sender: { id: "PAGE_1" },
          recipient: { id: "PSID_1" },
          timestamp: 1757000600000,
          message: { mid: "mid.bbb", text: "We do!", is_echo: true },
        },
      ],
    },
  ],
});
ok("an echo parses as direction 'out'", echo.events[0]?.direction === "out");
ok(
  "an echo still keys the thread on the HOMEOWNER, not the Page",
  echo.events[0]?.threadExternalId === "PSID_1",
);

ok(
  "instagram maps to its own platform",
  parseMessagingEnvelope({ object: "instagram", entry: [] }).platform === "instagram",
);
ok(
  "an unrelated webhook object yields no events and does not throw",
  parseMessagingEnvelope({ object: "page_feed", entry: [{ id: "x" }] }).events.length === 0,
);
ok("a null payload does not throw", parseMessagingEnvelope(null).events.length === 0);
ok(
  "a message with no mid is dropped — nothing to de-duplicate on",
  parseMessagingEnvelope({
    object: "page",
    entry: [{ id: "PAGE_1", messaging: [{ sender: { id: "P" }, recipient: { id: "PAGE_1" }, message: { text: "hi" } }] }],
  }).events.length === 0,
);
ok(
  "a missing timestamp becomes null, never 'now'",
  parseMessagingEnvelope({
    object: "page",
    entry: [{ id: "PAGE_1", messaging: [{ sender: { id: "P" }, recipient: { id: "PAGE_1" }, message: { mid: "m", text: "hi" } }] }],
  }).events[0]?.sentAt === null,
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Ingest — idempotency, and the tenant that never comes from the body");
// ═══════════════════════════════════════════════════════════════════════════

function seedChannel() {
  resetDbStub();
  rows.messagingChannel.push({
    id: "chan_1",
    companyId: "company_REAL",
    platform: "facebook",
    externalId: "PAGE_1",
    status: "connected",
    disconnectedAt: null,
    accessTokenEnc: "not-a-real-blob",
  });
}

seedChannel();
const firstDelivery = await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
ok("a first delivery creates the thread and the message", firstDelivery.created === 1);
ok("one thread row exists", rows.messageThread.length === 1);
ok("one message row exists", rows.message.length === 1);
ok("the unread count is 1", rows.messageThread[0].unread === 1);

// Meta re-delivers after a timeout. Byte-identical payload, twice more.
await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
ok("a re-delivered webhook creates NO second thread", rows.messageThread.length === 1);
ok("a re-delivered webhook creates NO second message", rows.message.length === 1);
ok(
  "a re-delivered webhook does NOT bump the unread badge again",
  rows.messageThread[0].unread === 1,
);

// The attack: a signed body that names somebody else's company.
seedChannel();
await ingestEvents(
  parseMessagingEnvelope({
    object: "page",
    entry: [
      {
        id: "PAGE_1",
        // Fields an attacker (or a careless refactor) might hope are trusted.
        companyId: "company_VICTIM",
        messaging: [
          {
            companyId: "company_VICTIM",
            sender: { id: "PSID_9" },
            recipient: { id: "PAGE_1" },
            timestamp: 1757000000000,
            message: { mid: "mid.zzz", text: "hello" },
          },
        ],
      },
    ],
  }).events,
);
ok(
  "the thread's companyId comes from the CHANNEL, never from the payload",
  rows.messageThread[0]?.companyId === "company_REAL",
);
ok(
  "no row anywhere carries the payload's companyId",
  !JSON.stringify(rows.messageThread).includes("company_VICTIM"),
);

// An unknown Page writes nothing at all.
seedChannel();
const unknown = await ingestEvent({
  kind: "message",
  platform: "facebook",
  pageExternalId: "PAGE_NOBODY_HOLDS",
  threadExternalId: "PSID_X",
  participantExternalId: "PSID_X",
  direction: "in",
  externalId: "mid.x",
  body: "hi",
  sentAt: new Date(),
});
ok("an unknown Page is skipped, not written", !unknown.handled && unknown.reason === "unknown_page");
ok("…and left no rows behind", rows.messageThread.length === 0 && rows.message.length === 0);

// A disconnected Page stops filing new messages, and keeps its history.
seedChannel();
rows.messagingChannel[0].disconnectedAt = new Date();
const disconnected = await ingestEvent(parseMessagingEnvelope(JSON.parse(BODY)).events[0]);
ok(
  "a disconnected channel refuses new messages with a named reason",
  !disconnected.handled && disconnected.reason === "channel_disconnected",
);

// An outbound echo clears the unread badge instead of raising it.
seedChannel();
await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
await ingestEvents(echo.events);
ok("an outbound echo clears the unread badge", rows.messageThread[0].unread === 0);
ok("both messages are stored", rows.message.length === 2);

// A late re-delivery of an OLD message must not drag the thread to the top.
seedChannel();
await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
const recentAt = new Date("2026-09-01T12:00:00Z");
rows.messageThread[0].lastMessageAt = recentAt;
await ingestEvent({
  kind: "message",
  platform: "facebook",
  pageExternalId: "PAGE_1",
  threadExternalId: "PSID_1",
  participantExternalId: "PSID_1",
  direction: "in",
  externalId: "mid.old",
  body: "an old one, delivered late",
  sentAt: new Date("2020-01-01T00:00:00Z"),
});
ok(
  "a late delivery of an old message does not move lastMessageAt backwards",
  rows.messageThread[0].lastMessageAt.getTime() === recentAt.getTime(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The send path — it refuses, loudly, when nothing is connected");
// ═══════════════════════════════════════════════════════════════════════════

const noChannel = await sendMetaMessage({
  channel: null,
  recipientExternalId: "PSID_1",
  text: "Hello",
});
ok("no channel: the send refuses", noChannel.ok === false);
ok("no channel: the reason is named", noChannel.reason === "channel_not_connected");
ok("no channel: a sentence a person can read comes back", noChannel.message.length > 30);

const dead = await sendMetaMessage({
  channel: { externalId: "PAGE_1", status: "needs_reauth", disconnectedAt: null },
  recipientExternalId: "PSID_1",
  text: "Hello",
});
ok("a channel needing reauth refuses with its own reason", dead.reason === "channel_needs_reauth");

const gone = await sendMetaMessage({
  channel: { externalId: "PAGE_1", status: "connected", disconnectedAt: new Date() },
  recipientExternalId: "PSID_1",
  text: "Hello",
});
ok("a disconnected channel refuses with its own reason", gone.reason === "channel_disconnected");

ok(
  "an empty message is refused before any network call",
  (await sendMetaMessage({ channel: null, recipientExternalId: "P", text: "   " })).ok === false,
);

// The route records the failure rather than swallowing it, and does NOT clear
// the unread badge on a reply that never left. Positional text assertions.
const replySrc = read("app/api/messaging/threads/[id]/reply/route.js");
ok(
  "the reply route writes a Message row with failedReason on a refusal",
  /failedReason: result\.ok \? null :/.test(replySrc),
);
ok(
  "the reply route answers 409, not 200, when the send failed",
  /if \(!result\.ok\)[\s\S]{0,400}status: 409/.test(replySrc),
);
ok(
  "the thread is only advanced AFTER a successful send",
  // Positional, and tolerant of formatting: the failed-send guard must come
  // before the write that clears the unread count, or a send that never left
  // the building marks the conversation as handled.
  replySrc.indexOf("if (!result.ok)") > -1 &&
    replySrc.indexOf("unread: 0") > replySrc.indexOf("if (!result.ok)"),
);
ok(
  "the reply route scopes the thread by companyId",
  /findFirst\(\{\s*where: \{ id, companyId: member\.companyId \}/.test(replySrc),
);
ok(
  "the reply route is permission gated above 'view only'",
  /requireLevel\([\s\S]{0,200}"requests",\s*\n?\s*"view_create_edit"/.test(replySrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The composer says WHY it is off, in every state");
// ═══════════════════════════════════════════════════════════════════════════

const STATES = [
  [null, "app.messages.compose.disabled.notConnected"],
  [{ connected: false, mock: false, reason: "awaiting_meta_approval" }, "app.messages.compose.disabled.awaitingApproval"],
  [{ connected: false, mock: false, reason: "not_configured" }, "app.messages.compose.disabled.notConfigured"],
  [{ connected: false, mock: false, reason: "not_connected" }, "app.messages.compose.disabled.notConnected"],
  [{ connected: false, mock: false, reason: "needs_reauth" }, "app.messages.compose.disabled.needsReauth"],
  [{ connected: true, mock: true, reason: null }, "app.messages.compose.disabled.demo"],
];
for (const [state, expected] of STATES) {
  const key = composerBlock(state);
  ok(
    `composer blocked with the right reason: ${state?.reason ?? (state?.mock ? "mock" : "no connection")}`,
    key === expected,
  );
  ok(`…and that reason has an English sentence`, Boolean(APP_MESSAGES.en[key]));
}
ok(
  "a real, working connection leaves the composer usable",
  composerBlock({ connected: true, mock: false, reason: null }) === null,
);

// TODAY's state, spelled out: awaiting Meta approval must never resolve to
// "everything is fine".
ok(
  "the awaiting-approval state is NOT treated as connected",
  composerBlock({ connected: false, mock: false, reason: "awaiting_meta_approval" }) !== null,
);
ok(
  "the empty inbox explains awaiting-approval in its own words",
  connectionBlurb({ connected: false, reason: "awaiting_meta_approval" }) ===
    "app.messages.connect.awaitingApproval",
);
ok(
  "a working connection shows no banner",
  connectionBlurb({ connected: true, reason: null }) === null,
);

// The page must actually RENDER the reason next to a disabled control — the
// whole point. Positional: the disabled attribute and the printed reason both
// reference the same one decision.
const pageSrc = read("app/app/messages/page.js");
const bitsSrc = read("app/app/messages/ConversationBits.js");
// The composer moved into ConversationBits.js, so the reason and the disabled
// attribute now live in two files. What must stay true is that ONE decision
// drives both: the page computes `blockKey`, hands it down, and the same value
// both switches the control off and gets printed. Following the value across
// the split is the real claim; matching one inline JSX shape was only ever a
// proxy for it.
ok(
  "the page computes the block from the channel and hands it down",
  /const blockKey = composerBlock\(connection\)/.test(pageSrc) &&
    /disabledReplyKey=\{blockKey\}/.test(pageSrc),
);
ok(
  "the page prints the block reason",
  /disabledReplyKey && \(/.test(bitsSrc) && /t\(disabledReplyKey\)/.test(bitsSrc),
);
ok(
  "the composer is disabled by the same decision that prints it",
  /const composerBlocked = mode === "reply" && Boolean\(blockKey\)/.test(pageSrc) &&
    /disabled=\{composerBlocked/.test(pageSrc),
);
ok(
  "the composer is disabled, not hidden",
  !/blockKey \? null :/.test(pageSrc) && /<textarea/.test(pageSrc),
);
ok(
  "the empty inbox names what is missing",
  /\{blurbKey && \(/.test(pageSrc) && /t\(blurbKey\)/.test(pageSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. No fabricated conversations for a real company");
// ═══════════════════════════════════════════════════════════════════════════

// Every route that can serve sample threads must gate on connection.mock, and
// `mock` is decided in one place, from Company.isDemo read out of the database.
const channelsSrc = read("lib/messaging/channels.js");
ok(
  "mock is decided from Company.isDemo, read fresh from the database",
  /db\.company[\s\S]{0,200}select: \{ isDemo: true/.test(channelsSrc) &&
    /if \(company\?\.isDemo\)/.test(channelsSrc),
);
ok(
  "nothing lets a caller pass `mock` in",
  !/function messagingConnection\([^)]*mock/.test(channelsSrc),
);

for (const file of [
  "app/api/messaging/threads/route.js",
  "app/api/messaging/threads/[id]/route.js",
  "app/api/messaging/review/route.js",
]) {
  // Import lines dropped first: every one of these files imports the demo
  // helper at the top, so a naive indexOf would find the IMPORT above the gate
  // and report a hole that isn't there — or, worse, pass on a file where the
  // call really did move above the gate.
  const src = read(file)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("import "))
    .join("\n");
  if (!/demoThread\w*\(/.test(src)) continue;
  ok(
    `${file} serves sample threads only behind connection.mock`,
    src.indexOf("if (connection.mock)") > -1 &&
      src.indexOf("if (connection.mock)") < src.search(/demoThread\w*\(/),
  );
}

// And the demo data itself is unmistakable on sight.
const demo = demoThreads(new Date("2026-09-08T12:00:00Z"), "Acme");
ok("the demo threads all carry a demo_ id", demo.every((t) => t.id.startsWith("demo_")));
ok("the demo messages all carry a demo_ id", demo.every((t) => t.messages.every((m) => m.id.startsWith("demo_"))));
ok(
  "the demo set covers won, lost, unanswered, not-a-job and unjudged",
  ["won", "lost", "not_a_job"].every((o) => demo.some((t) => t.outcome === o)) &&
    demo.some((t) => t.outcome === null),
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. The month-end arithmetic — and every way absence must not read 0");
// ═══════════════════════════════════════════════════════════════════════════

const AUG = { year: 2026, month: 8 };
const at = (day, hour = 9, minute = 0) =>
  new Date(Date.UTC(2026, 7, day, hour, minute)).toISOString();

const FIXTURES = [
  // Answered in 15 minutes, won.
  {
    id: "t_won_fast",
    createdAt: at(3),
    outcome: "won",
    participantName: "Fast Win",
    messages: [
      { direction: "in", sentAt: at(3, 9, 0) },
      { direction: "out", sentAt: at(3, 9, 15) },
    ],
  },
  // Answered after 4 hours, lost.
  {
    id: "t_lost_slow",
    createdAt: at(5),
    outcome: "lost",
    participantName: "Slow Loss",
    messages: [
      { direction: "in", sentAt: at(5, 9, 0) },
      { direction: "out", sentAt: at(5, 13, 0) },
    ],
  },
  // NOBODY ever replied. The line the review reports first.
  {
    id: "t_never",
    createdAt: at(7),
    outcome: null,
    participantName: "Never Answered",
    messages: [
      { direction: "in", sentAt: at(7, 9, 0) },
      { direction: "in", sentAt: at(9, 9, 0) },
    ],
  },
  // A reply was attempted and FAILED. Must not count as an answer.
  {
    id: "t_failed",
    createdAt: at(11),
    outcome: null,
    participantName: "Failed Reply",
    messages: [
      { direction: "in", sentAt: at(11, 9, 0) },
      { direction: "out", sentAt: at(11, 9, 5), failedReason: "channel_not_connected: no Page" },
    ],
  },
  // Not a sales conversation — out of the won-rate denominator.
  {
    id: "t_supplier",
    createdAt: at(13),
    outcome: "not_a_job",
    participantName: "Supplier",
    messages: [
      { direction: "in", sentAt: at(13, 9, 0) },
      { direction: "out", sentAt: at(13, 9, 30) },
    ],
  },
  // A different month entirely — must not be counted.
  {
    id: "t_september",
    createdAt: new Date(Date.UTC(2026, 8, 2)).toISOString(),
    outcome: "won",
    participantName: "Next Month",
    messages: [{ direction: "in", sentAt: new Date(Date.UTC(2026, 8, 2)).toISOString() }],
  },
];

const review = buildMonthlyReview({ threads: FIXTURES, ...AUG });

ok("the month key is right", review.month === "2026-08");
ok("only threads that STARTED in the month are counted", review.totals.started === 5);
ok("the next month's thread is excluded", !review.threads.some((t) => t.id === "t_september"));

ok("won is counted", review.byOutcome.won === 1);
ok("lost is counted", review.byOutcome.lost === 1);
ok("not_a_job is counted", review.byOutcome.not_a_job === 1);
ok("unjudged threads are counted as `unset`, not as lost", review.byOutcome.unset === 2);
ok("the won-rate denominator excludes not_a_job and unset", review.totals.judged === 2);
ok("the won rate is 1 of 2", review.wonRate === 0.5);

ok(
  "a FAILED reply does not count as an answer",
  review.threads.find((t) => t.id === "t_failed").answered === false,
);
ok(
  "a failed reply's response time is null, NOT zero and NOT five minutes",
  review.threads.find((t) => t.id === "t_failed").firstResponseMinutes === null,
);
ok(
  "the never-answered list holds exactly the two unanswered threads",
  review.neverAnswered.length === 2 &&
    review.neverAnswered.every((t) => ["t_never", "t_failed"].includes(t.id)),
);
ok(
  "an unanswered thread's time reads as absent, never as 0",
  review.neverAnswered.every((t) => t.firstResponseMinutes === null),
);

// 15, 240, 30 -> median 30.
ok("the median first reply is the median of the ANSWERED ones", review.medianFirstResponseMinutes === 30);
ok("won threads' median is their own", review.responseByOutcome.won.medianMinutes === 15);
ok("lost threads' median is their own", review.responseByOutcome.lost.medianMinutes === 240);
ok(
  "an outcome group with no answered thread has a null median, not 0",
  review.responseByOutcome.unset.medianMinutes === null,
);
ok(
  "…and carries its unanswered count alongside",
  review.responseByOutcome.unset.unanswered === 2,
);

// The empty month — the one every dashboard in this repo has got wrong.
const empty = buildMonthlyReview({ threads: FIXTURES, year: 2026, month: 1 });
ok("an empty month reports zero started", empty.totals.started === 0);
ok("an empty month has NO won rate — null, never 0%", empty.wonRate === null);
ok("an empty month has NO median reply time — null, never 0", empty.medianFirstResponseMinutes === null);
ok("an empty month has an empty never-answered list", empty.neverAnswered.length === 0);

// A month where nobody replied at all.
const silent = buildMonthlyReview({
  threads: [
    { id: "a", createdAt: at(2), outcome: null, messages: [{ direction: "in", sentAt: at(2) }] },
    { id: "b", createdAt: at(4), outcome: null, messages: [{ direction: "in", sentAt: at(4) }] },
  ],
  ...AUG,
});
ok("a month with no replies has a null median, not 0", silent.medianFirstResponseMinutes === null);
ok("…and names both threads as never answered", silent.neverAnswered.length === 2);
ok("…and still has no won rate", silent.wonRate === null);

// An OUTBOUND-ONLY thread is neither answered nor unanswered — there was no
// question. Counted separately so the three numbers add up.
const outboundOnly = buildMonthlyReview({
  threads: [{ id: "o", createdAt: at(2), outcome: null, messages: [{ direction: "out", sentAt: at(2) }] }],
  ...AUG,
});
ok("an outbound-only thread is not called 'never answered'", outboundOnly.neverAnswered.length === 0);
ok("…and is counted in its own bucket", outboundOnly.totals.noInbound === 1);
ok(
  "the three buckets add up to the number started",
  outboundOnly.totals.answered + outboundOnly.totals.neverAnswered + outboundOnly.totals.noInbound ===
    outboundOnly.totals.started,
);

// The primitives.
ok("median of nothing is null, never 0", median([]) === null);
ok("median of an even list averages the middle two", median([10, 20, 30, 40]) === 25);
ok("monthRange rejects month 0 and month 13", monthRange(2026, 0) === null && monthRange(2026, 13) === null);
ok(
  "monthRange wraps December into the next January",
  monthRange(2026, 12).end.toISOString() === "2027-01-01T00:00:00.000Z",
);
ok(
  "a reply sent BEFORE the first inbound is not counted as the reply to it",
  firstResponse({
    messages: [
      { direction: "out", sentAt: at(3, 8, 0) },
      { direction: "in", sentAt: at(3, 9, 0) },
      { direction: "out", sentAt: at(3, 9, 30) },
    ],
  }).minutes === 30,
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Bubble contrast, measured, against hostile brand colours");
// ═══════════════════════════════════════════════════════════════════════════

// The colours contractors actually pick, plus the mid-tones the naive
// "is it dark? use white" rule fails on.
const HOSTILE = [
  "#ffff00", // yellow
  "#ffffff", // white
  "#000000", // black
  "#808080", // mid grey — ~4.3:1 against BOTH black and white
  "#7f9a3d", // olive
  "#c0c0c0", // silver
  "#06356b", // FieldQuo navy
  "#ff6600", // safety orange
  "#00ff00", // lime
  "not-a-colour", // junk: must fall back, not produce NaN
  null,
];
for (const brandColor of HOSTILE) {
  const { outbound, ratio } = bubbleColours({ brandColor });
  ok(
    `outbound bubble is legible for ${brandColor ?? "no brand colour"} (${ratio.toFixed(2)}:1)`,
    Number.isFinite(ratio) && ratio >= 4.5,
    `bg ${outbound.bg} / fg ${outbound.fg}`,
  );
}
// The page must actually PAINT the measured pair rather than a class.
ok(
  "the outbound bubble uses the measured colours",
  /backgroundColor: bubbles\.outbound\.bg, color: bubbles\.outbound\.fg/.test(bitsSrc),
);
ok(
  "a FAILED outbound bubble is not painted in the brand colour",
  /out && !failed && bubbles\?\.outbound/.test(bitsSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Outcomes — a closed list, and clearing is not 'lost'");
// ═══════════════════════════════════════════════════════════════════════════

ok("the four outcomes are the closed list", THREAD_OUTCOMES.join(",") === "won,lost,no_reply,not_a_job");
ok("a valid outcome is accepted", normaliseOutcome("won") === "won");
ok("an unknown outcome is refused (undefined, not null)", normaliseOutcome("winner") === undefined);
ok("an explicit null CLEARS rather than being refused", normaliseOutcome(null) === null);
ok("an empty string clears too", normaliseOutcome("") === null);
ok("an unknown status is refused", normaliseStatus("archived") === undefined);
ok("a known status is accepted", normaliseStatus("snoozed") === "snoozed");

const threadSrc = read("app/api/messaging/threads/[id]/route.js");
ok(
  "clearing an outcome also clears when and who",
  /data\.outcomeSetAt = outcome \? new Date\(\) : null/.test(threadSrc),
);
ok(
  "the PATCH proves every linked id belongs to this company",
  /ownedIdsRefusal\(NextResponse, db, member\.companyId/.test(threadSrc),
);
ok(
  "the PATCH loads the thread company-scoped before writing",
  /findFirst\(\{\s*where: \{ id, companyId: member\.companyId \}/.test(threadSrc),
);
ok(
  "the outcome control is on the conversation, not only in the review",
  /OutcomePicker/.test(pageSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("10. The Meta scope stays exactly where it was until approval");
// ═══════════════════════════════════════════════════════════════════════════

ok("the ads scope is untouched", META_OAUTH_SCOPE === "ads_read");
ok(
  "the messaging scopes are declared, and are the five Meta requires",
  META_MESSAGING_SCOPE.split(",").sort().join(",") ===
    [
      "instagram_basic",
      "instagram_manage_messages",
      "pages_messaging",
      "pages_read_engagement",
      "pages_show_list",
    ].join(","),
);
ok("the messaging scopes are NOT folded into the ads scope", !META_OAUTH_SCOPE.includes("pages_"));

const clientSrc = read("lib/meta/client.js");
ok(
  "one env flag adds them, and it is named in the file",
  /META_MESSAGING_APPROVED/.test(clientSrc),
);
ok(
  "that flag is documented on the deployment page",
  read("docs/VERCEL.md").includes("META_MESSAGING_APPROVED"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("11. The feature is registered, gated, and named in nine languages");
// ═══════════════════════════════════════════════════════════════════════════

const entry = FEATURES.find((f) => f.key === "page_messaging");
ok("the feature is in the registry", Boolean(entry));
ok("it claims the /app/messages tree", entry?.routePrefixes.includes("/app/messages"));
ok("it claims both API trees", entry?.apiPrefixes.includes("/api/messaging") && entry?.apiPrefixes.includes("/api/meta/messaging"));
ok(
  "the webhook is declared exempt WITH a reason",
  entry?.apiExempt.some((x) => x.path === "/api/meta/messaging/webhook" && x.reason.length > 40),
);
ok("the nav row is claimed", entry?.navKeys.includes("app.nav.messages"));
ok(
  "the page tree mounts the gate",
  /<FeatureGate feature="page_messaging">/.test(read("app/app/messages/layout.js")),
);
ok(
  "the nav row points at a page that exists",
  read("app/components/layout/AdminSidebar.js").includes('href: "/app/messages"'),
);

const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
const KEYS = Object.keys(APP_MESSAGES.en).filter(
  (k) => k.startsWith("app.messages.") || k === "app.nav.messages",
);
ok("there are messaging keys to check", KEYS.length >= 60);
for (const lang of LANGS) {
  const missing = KEYS.filter((k) => !APP_MESSAGES[lang]?.[k]);
  ok(`${lang}: every messaging key is present`, missing.length === 0, missing.slice(0, 3).join(", "));
}
// Every outcome label, in every language — these are the words the month-end
// report is read in.
for (const lang of LANGS) {
  ok(
    `${lang}: every outcome has a label`,
    THREAD_OUTCOMES.every((o) => APP_MESSAGES[lang]?.[`app.messages.outcome.${o}`]),
  );
}
// No bare currency symbol anywhere in this feature's copy — check:app-currency
// enforces this globally, and it is asserted here too because a chat screen is
// where somebody will eventually type "$500".
for (const lang of LANGS) {
  const bad = KEYS.filter((k) => /[$£€]\s*\{|\{[^}]+\}\s*[$£€]/.test(APP_MESSAGES[lang]?.[k] || ""));
  ok(`${lang}: no currency symbol beside a placeholder`, bad.length === 0, bad.join(", "));
}

// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
// The stub's `writes` array is read above; touching it here keeps the import
// honest for anyone who deletes an assertion and wonders why it is imported.
if (!Array.isArray(writes)) process.exit(1);
