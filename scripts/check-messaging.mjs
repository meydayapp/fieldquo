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
//        --import ./scripts/route-stub-loader.mjs scripts/check-messaging.mjs
//
// route-stub-loader points `@/lib/apiMember` at a scripted session so section
// 14 can EXECUTE the reply route and the request-control route.
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
import {
  savePageMessagingChannels,
  disconnectPageMessagingChannels,
} from "@/lib/messaging/pageChannels";
import { channelForExternalId } from "@/lib/messaging/channels";
import { sendMetaMessage } from "@/lib/messaging/metaSend";
import {
  buildMonthlyReview,
  firstResponse,
  median,
  monthRange,
} from "@/lib/messaging/monthlyReview";
import { composerBlock, connectionBlurb } from "@/lib/messaging/composerState";
import { bubbleColours } from "@/lib/messaging/bubbleTheme";
import {
  normaliseOutcome,
  normaliseStatus,
  THREAD_OUTCOMES,
  THREAD_STATUSES,
  statusLabelKey,
} from "@/lib/messaging/outcomes";
import {
  normaliseAttachment,
  normaliseAttachments,
  publicAttachments,
  attachmentTypeKey,
  hasFetchableMedia,
  isFetchable,
  isDurableMediaUrl,
  ATTACHMENT_TYPES,
} from "@/lib/messaging/attachments";
import { rehostAttachment } from "@/lib/messaging/mediaFetch";
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

/**
 * Both needles present AND in this order. `indexOf` returns -1 for an absent
 * needle and -1 is less than every real index, so the naive `a < b` form
 * passes once the thing being checked for has been deleted.
 */
function orderedInSource(source, a, b) {
  const ia = source.indexOf(a);
  const ib = source.indexOf(b, ia === -1 ? 0 : ia);
  return ia >= 0 && ib > ia;
}

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
section("3b. Where a facebook/instagram channel comes from at all");
// ═══════════════════════════════════════════════════════════════════════════
//
// Every assertion in section 3 above seeded `rows.messagingChannel` by hand,
// and that is exactly what hid the bug for as long as it lasted: saveChannel
// had ONE caller in the whole codebase — the WhatsApp callback — so no product
// path had ever created a channel with platform `facebook` or `instagram`. The
// ingest was correct, the webhook was correct, the signature check was
// correct, and every real inbound message was answered `unknown_page` and
// dropped, because the row the tenant lookup needs did not exist.
//
// So this section seeds NOTHING. It runs the connect-side writer and then
// feeds the real ingest a real Meta envelope.
process.env.META_TOKEN_ENCRYPTION_KEY = process.env.META_TOKEN_ENCRYPTION_KEY || "0".repeat(64);
const GRANTED_MESSAGING =
  "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages";

const connectPage = (overrides = {}) =>
  savePageMessagingChannels({
    companyId: "company_REAL",
    pageId: "PAGE_1",
    pageName: "Northline Painting",
    pageToken: "PAGE-TOKEN",
    instagramUserId: "IG_1",
    instagramUsername: "northline",
    grantedScopes: GRANTED_MESSAGING,
    webhookSubscribedAt: new Date(),
    connectedByUserId: "user_1",
    ...overrides,
  });

resetDbStub();
await connectPage();
ok(
  "connecting a Page creates the facebook channel the tenant lookup needs",
  Boolean(await channelForExternalId("facebook", "PAGE_1")),
);
ok(
  "…and the instagram one, keyed on the Instagram account id Meta puts in entry.id",
  Boolean(await channelForExternalId("instagram", "IG_1")),
);
// The whole round trip: the SAME body section 3 uses, against a channel no
// fixture created.
const roundTrip = await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events);
ok("a real inbound Page message is filed, not answered unknown_page", roundTrip.created === 1 && !roundTrip.reasons.unknown_page);
ok("…into the connecting company", rows.messageThread[0]?.companyId === "company_REAL");

resetDbStub();
await connectPage({ grantedScopes: "pages_show_list,pages_manage_posts,instagram_basic" });
ok(
  "a Page connected for PUBLISHING ONLY gets no channel at all",
  rows.messagingChannel.length === 0,
);
ok(
  "…so its messages are still refused honestly rather than filed into an inbox that cannot reply",
  (await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events)).reasons.unknown_page === 1,
);

resetDbStub();
await connectPage();
await disconnectPageMessagingChannels("company_REAL");
ok(
  "disconnecting marks BOTH channels disconnected rather than deleting them",
  rows.messagingChannel.length === 2 &&
    rows.messagingChannel.every((c) => c.disconnectedAt instanceof Date),
);
ok(
  "…and a later webhook is no longer filed",
  (await ingestEvents(parseMessagingEnvelope(JSON.parse(BODY)).events)).reasons.channel_disconnected === 1,
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
  // An email thread skips the Meta block (it answers as an email —
  // lib/mailbox/reply.js); every other thread still takes it from the
  // connection, in the same one expression.
  /const blockKey = [^;\n]*composerBlock\(connection\)/.test(pageSrc) &&
    /disabledReplyKey=\{blockKey\}/.test(pageSrc),
);
ok(
  "the page prints the block reason",
  /disabledReplyKey && \(/.test(bitsSrc) && /t\(disabledReplyKey\)/.test(bitsSrc),
);
// TWO decisions now drive it, not one: the CONNECTION (`blockKey`, from
// composerState.js) and, on WhatsApp, the 24-hour customer service window
// (`windowClosed`, from serviceWindow.js — see scripts/check-whatsapp.mjs,
// which executes that one at the boundary). The claim this assertion protects
// is unchanged and is written so deleting EITHER guard fails: whatever
// switches the box off is the same value that gets printed beside it.
// On the chat kit the box is the kit's Composer: `inputDisabled` switches
// the typing box off (Send stays alive for a template), `disabled` switches
// both off when nothing could carry the words. Both are driven by the same
// `composerBlocked`, and the window notice is still drawn beside it.
ok(
  "the composer is disabled by the same decisions that print themselves",
  /const composerBlocked = mode === "reply" && \(Boolean\(blockKey\) \|\| windowClosed\)/.test(pageSrc) &&
    /inputDisabled=\{composerBlocked/.test(pageSrc) &&
    /disabled=\{demoBlocked \|\| !canEdit \|\| \(composerBlocked && !allowEmpty\)\}/.test(pageSrc) &&
    /<ServiceWindowNotice notice=\{windowNotice\}/.test(pageSrc),
);
ok(
  "the composer is disabled, not hidden",
  !/blockKey \? null :/.test(pageSrc) && /<Composer\b/.test(pageSrc) && !/blockKey \? null : <Composer/.test(pageSrc),
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
// The thread is drawn by the shared chat kit now — left-aligned rows in the
// app's own tokens, no brand-coloured bubble on the back office at all (the
// brand colour is for what the CLIENT sees; see app/app/layout.js). So the
// claim moves: nothing on this screen paints a message in the brand colour,
// and a FAILED reply is still marked as failed rather than dressed like one
// that arrived — by the kit's failed state, fed from the stored reason.
ok(
  "the thread paints no message in the brand colour",
  !/bubbles\??\.outbound/.test(pageSrc + bitsSrc) && !/brandColor/.test(pageSrc + bitsSrc),
);
ok(
  "a FAILED reply is marked failed from the stored reason, never drawn as delivered",
  // Widened 2026-09-24: an SMS carrier failure (SmsDelivery receipt) also
  // turns the bubble — the stored reason still does, first.
  /status: m\.failedReason \|\| receipt\?\.verdict === "failed" \? "failed" : "sent"/.test(read("lib/messaging/rooms.js")) &&
    /error: m\.failedReason \|\| null/.test(read("lib/messaging/rooms.js")),
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
  "the messaging scopes are declared, and are the six Meta requires",
  META_MESSAGING_SCOPE.split(",").sort().join(",") ===
    [
      "instagram_basic",
      "instagram_manage_messages",
      "pages_manage_metadata",
      "pages_messaging",
      "pages_read_engagement",
      "pages_show_list",
    ].join(","),
);
// The sixth, called out on its own because it is the one whose absence had no
// symptom: without pages_manage_metadata nothing can POST
// /<page-id>/subscribed_apps, so a Page connects, a token stores, the send
// path works, and not one inbound message is ever delivered.
ok(
  "pages_manage_metadata is in it — the permission the webhook subscription needs",
  META_MESSAGING_SCOPE.split(",").includes("pages_manage_metadata"),
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
// Every STATUS label, in every language, resolved through the same function
// the screen builds the key with. The inbox row printed the raw key
// "app.messages.status.open" to the owner on the live site (2026-09-12): the
// key was assembled by concatenation, so check-translations saw no literal
// and nine catalogues carried none of the four. A key built from a closed
// list must be walked through the catalogue by the list, not by a grep.
for (const lang of LANGS) {
  const missing = THREAD_STATUSES.filter((s) => !APP_MESSAGES[lang]?.[statusLabelKey(s)]);
  ok(`${lang}: every status has a label`, missing.length === 0, missing.join(", "));
}
// The connect card carries the way there. A card naming a button on another
// screen without linking to it sends a contractor hunting — the owner found
// exactly that on the live inbox.
ok(
  "the connect card links to the Meta settings screen where the Page is connected",
  /SOCIAL_SETTINGS_PATH/.test(pageSrc) && /href=\{SOCIAL_SETTINGS_PATH\}/.test(pageSrc),
);
// No bare currency symbol anywhere in this feature's copy — check:app-currency
// enforces this globally, and it is asserted here too because a chat screen is
// where somebody will eventually type "$500".
for (const lang of LANGS) {
  const bad = KEYS.filter((k) => /[$£€]\s*\{|\{[^}]+\}\s*[$£€]/.test(APP_MESSAGES[lang]?.[k] || ""));
  ok(`${lang}: no currency symbol beside a placeholder`, bad.length === 0, bad.join(", "));
}


// ═══════════════════════════════════════════════════════════════════════════
section("12. Pictures — one renderer, three platforms, no expiring links");
// ═══════════════════════════════════════════════════════════════════════════
//
// Messenger and Instagram DO put a URL in the webhook, which is what makes
// this the easy thing to get wrong: rendering it works today, in review, in
// the demo, and shows a broken image to the contractor who reopens the thread
// next week. It is a signed CDN link, and it expires — the same trap
// CrewInboundMessage.mediaUrls records for Twilio.

const PHOTO_BODY = {
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: "PAGE_1" },
          timestamp: 1757000000000,
          message: {
            mid: "mid.photo",
            text: "here's the room",
            attachments: [
              { type: "image", payload: { url: "https://scontent.xx.fbcdn.net/v/t1/kitchen.jpg?oe=DEAD" } },
            ],
          },
        },
      ],
    },
  ],
};

const photoEvents = parseMessagingEnvelope(PHOTO_BODY).events;
ok(
  "Messenger's own CDN link never lands in `url`",
  photoEvents[0]?.attachments?.[0]?.url === null,
);
ok(
  "…it is kept as a sourceUrl for the fetcher instead",
  photoEvents[0]?.attachments?.[0]?.sourceUrl?.includes("fbcdn.net"),
);

seedChannel();
await ingestEvents(photoEvents);
ok("the photo message is stored", rows.message.length === 1);
ok(
  "…flagged so /api/cron/messaging-media has something to find",
  rows.message[0].mediaPending === true,
);
ok(
  "…and nothing durable is claimed for it yet",
  publicAttachments(rows.message[0].attachments)[0].state === "pending",
);
ok(
  "the expiring Meta link is NOT handed to the browser",
  !JSON.stringify(publicAttachments(rows.message[0].attachments)).includes("fbcdn.net"),
);

// An Instagram echo carrying a file: the SAME shape, so the renderer has one
// path rather than three.
const igEvents = parseMessagingEnvelope({
  object: "instagram",
  entry: [
    {
      id: "PAGE_1",
      messaging: [
        {
          sender: { id: "PAGE_1" },
          recipient: { id: "PSID_2" },
          timestamp: 1757000001000,
          message: {
            mid: "mid.ig",
            is_echo: true,
            attachments: [{ type: "file", payload: { url: "https://scontent.cdninstagram.com/v/plan.pdf" } }],
          },
        },
      ],
    },
  ],
}).events;
ok("an Instagram attachment parses to the same shape", igEvents[0]?.attachments?.[0]?.url === null);
ok(
  "…and Messenger's \"file\" is named DOCUMENT, not left as a platform word",
  normaliseAttachment(igEvents[0].attachments[0]).type === "document",
);

// Every type the renderer can meet has a name in the reader's own language.
for (const type of ATTACHMENT_TYPES) {
  const key = attachmentTypeKey(type);
  ok(`a ${type} attachment has a label key`, key.startsWith("app.messages.media."));
  ok(`…and it exists in English`, Boolean(APP_MESSAGES.en[key]));
}
ok(
  "an audio attachment is called a voice message, which is what it is",
  /voice/i.test(APP_MESSAGES.en[attachmentTypeKey("audio")]),
);

// Anything unparseable in the column renders as a named row rather than
// throwing — a conversation must never fail to load over one bad attachment.
ok("a null attachment column is []", normaliseAttachments(null).length === 0);
ok("garbage in the column becomes an unavailable row", normaliseAttachment("nonsense").state === "unavailable");
ok("…of a named type", normaliseAttachment("nonsense").type === "other");
ok("…with no Retry, because there is nothing to retry", publicAttachments(["nonsense"])[0].retryable === false);

// ── The fetch, for a platform that needs NO token ──────────────────────────
const calls = [];
const bytes = Buffer.from("PNGDATA");
const bareFetch = async (url, init) => {
  calls.push({ url: String(url), auth: init?.headers?.Authorization || null });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bytes.length) }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    json: async () => ({}),
  };
};
const rehosted = await rehostAttachment({
  attachment: normaliseAttachment(photoEvents[0].attachments[0], 0),
  channel: null,
  companyId: "company_REAL",
  fetchImpl: bareFetch,
  uploadImpl: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/messaging/company_REAL/k.jpg" }),
});
ok("a Messenger photo is re-hosted in ONE call — it needs no token", calls.length === 1);
ok("…and no Authorization header is attached to a pre-signed CDN link", calls[0]?.auth === null);
ok("…and what comes back is Cloudinary's, not Meta's", isDurableMediaUrl(rehosted.url) === true);

// SSRF: a sourceUrl naming anything but Meta is refused before a request is made.
const offMeta = [];
const refused = await rehostAttachment({
  attachment: normaliseAttachment({ type: "image", sourceUrl: "https://169.254.169.254/latest/meta-data/" }, 0),
  channel: null,
  companyId: "company_REAL",
  fetchImpl: async (u) => { offMeta.push(String(u)); throw new Error("must not be reached"); },
  uploadImpl: async () => { throw new Error("must not upload"); },
});
ok("a source url off Meta's hosts is refused", Boolean(refused.error));
ok("…without a single request leaving the process", offMeta.length === 0);

// ── The thread route hands the browser the shaped version ─────────────────
const threadRoute = read("app/api/messaging/threads/[id]/route.js");
ok(
  "the thread route shapes every message's attachments before answering",
  /attachments: publicAttachments\(m\.attachments\)/.test(threadRoute),
);
ok(
  "…and it selects the column in the first place",
  orderedInSource(threadRoute, "attachments: true", "publicAttachments"),
);

// ── The Retry endpoint ────────────────────────────────────────────────────
const retryRoute = read("app/api/messaging/threads/[id]/attachments/route.js");
ok("a failed fetch has an endpoint to retry through", retryRoute.includes("fetchMessageMedia"));
ok(
  "…scoped to this company AND this thread, so it cannot pull another tenant's file",
  /threadId: id, thread: \{ companyId: member\.companyId \}/.test(retryRoute),
);
ok(
  "…resetting the attempt counter before it tries, so the ceiling cannot make Retry a dead button",
  orderedInSource(retryRoute, "withFetchReset", "fetchMessageMedia"),
);
ok(
  "…and refusing an entry that was never fetchable rather than offering a pointless retry",
  /state === "unavailable"/.test(retryRoute),
);
ok(
  "…answering a demo company plainly rather than pretending",
  orderedInSource(retryRoute, "connection.mock", "sample conversation"),
);

// The composer's paperclip is WhatsApp-only, because that is the only platform
// lib/messaging/send.js can actually send a file on.
const messagesPage = read("app/app/messages/page.js");
ok(
  "the attach control is offered only on a WhatsApp thread",
  /mediaSupported =[\s\S]{0,200}thread\?\.platform === "whatsapp"/.test(messagesPage),
);
ok(
  "…and never while the composer is blocked, so nobody uploads into a closed window",
  /mediaSupported =[\s\S]{0,240}!composerBlocked/.test(messagesPage),
);
ok(
  "the file is checked against Meta's limits BEFORE it is uploaded",
  orderedInSource(messagesPage, "classifyWhatsAppOutboundMedia(file)", '"/api/upload"'),
);
// The composer is "use client". lib/messaging/whatsappMedia.js imports
// channels.js, which imports "@/lib/db" — reaching through it for one pure
// function would pull Prisma into the browser bundle, which is the exact
// mistake lib/media/cloudinaryUrl.js exists to record. So the limits live in
// their own dependency-free module, and this pins that.
ok(
  "the composer reads Meta's limits from the PURE module, not the send module",
  messagesPage.includes('from "@/lib/messaging/whatsappMediaLimits"') &&
    !messagesPage.includes('from "@/lib/messaging/whatsappMedia"'),
);
ok(
  "…and that module imports nothing at all, so nothing server-only can arrive through it",
  !/^\s*import\s/m.test(read("lib/messaging/whatsappMediaLimits.js")),
);
ok(
  "the attachment model is likewise dependency-free — the bubble imports it",
  !/^\s*import\s/m.test(read("lib/messaging/attachments.js")),
);

// ── Messenger's own non-file attachments, in the SHARED shape ─────────────
//
// The renderer must never learn that two networks spell a latitude
// differently: one sends `payload.coordinates.{lat,long}`, the other sends
// `location.{latitude,longitude}`. Both land here as one shape, or the bubble
// grows a platform branch.
const mLocation = parseMessagingEnvelope({
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: "PAGE_1" },
          timestamp: 1757000000000,
          message: {
            mid: "m_loc",
            attachments: [
              { type: "location", title: "Side entrance", payload: { coordinates: { lat: 45.5019, long: -73.5674 } } },
            ],
          },
        },
      ],
    },
  ],
}).events[0];
const mPin = normaliseAttachment(mLocation?.attachments?.[0]);
ok("a Messenger location parses to the SAME location shape", mPin.type === "location");
ok("…with lat/long mapped onto latitude/longitude, once, here", mPin.location?.latitude === 45.5019 && mPin.location?.longitude === -73.5674);
ok("…and it is READY, because there was never anything to fetch", mPin.state === "ready");
ok("…so the cron leaves it alone", isFetchable(mPin) === false);

const mFallback = parseMessagingEnvelope({
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: "PAGE_1" },
          timestamp: 1757000000000,
          message: { mid: "m_fb", attachments: [{ type: "fallback", title: "A shared post" }] },
        },
      ],
    },
  ],
}).events[0];
const fb = normaliseAttachment(mFallback?.attachments?.[0]);
ok("a Messenger \"fallback\" is NAMED rather than left as an unlabelled row", fb.otherKind === "fallback");
ok("…and offers no Retry, because there was never anything to fetch", publicAttachments(mFallback.attachments)[0].retryable === false);

// ── The bubble draws every kind, and counts none of them ─────────────────
//
// The failure this whole change removes: six of the eight kinds a customer can
// send used to render as the word "Attachment". This asserts the ABSENCE of a
// generic fallthrough for the kinds that now have their own renderer.
for (const [kind, needle] of [
  ["a video", 'attachment.type === "video"'],
  ["a voice note", 'attachment.type === "audio"'],
  ["a sticker", 'attachment.type === "sticker"'],
  ["a pin", 'attachment.type === "location"'],
  ["a contact card", 'attachment.type === "contact"'],
]) {
  ok(`${kind} has its own branch above the generic one`, orderedInSource(bitsSrc, needle, 'if (attachment.state === "pending")'));
}
ok(
  "the two kinds that were never a file are drawn BEFORE the state ladder",
  orderedInSource(bitsSrc, 'attachment.type === "location"', 'attachment.state === "ready" && attachment.type === "image"'),
);
ok(
  "the renderer still never branches on the platform",
  !/facebook|instagram|whatsapp/i.test(
    bitsSrc.slice(bitsSrc.indexOf("export function Attachments"), bitsSrc.indexOf("\n/**\n * The attach control")),
  ),
);
ok(
  "…and the thread route hands the browser the pin and the card, which ARE the message",
  publicAttachments([{ type: "location", location: { latitude: 1, longitude: 2 } }])[0].location?.latitude === 1 &&
    publicAttachments([{ type: "contact", contacts: [{ name: { formatted_name: "Ana" }, phones: [{ phone: "1" }] }] }])[0].contacts?.[0]
      ?.name === "Ana",
);


// ═══════════════════════════════════════════════════════════════════════════
section("13. Every relation a thread route selects exists on the model");
//
// The thread screen answered 500 for every real conversation for a day:
// app/api/messaging/threads/[id]/route.js selected `client: { select }` on
// MessageThread, and the schema had `clientId` as a bare scalar with no
// relation. The db stub cannot catch that — it answers any select — so this
// reads the schema's MessageThread block and checks each relation name the
// routes ask for is declared there. The list beside it never asks, which is
// why the list kept working while every click on it failed.
{
  const schema = read("prisma/schema.prisma");
  const block = schema.match(/^model MessageThread \{[\s\S]*?^\}/m)?.[0] || "";
  const relations = new Set([...block.matchAll(/^\s+(\w+)\s+\w+\??\s+@relation/gm)].map((m) => m[1]));
  const routes = [
    "app/api/messaging/threads/[id]/route.js",
    "app/api/messaging/threads/[id]/temperature/route.js",
    "app/api/messaging/threads/route.js",
  ];
  for (const file of routes) {
    const src = read(file);
    const asked = new Set([...src.matchAll(/^\s+(client|channel|company|messages|assignedTo|lead|job|quote):\s*\{\s*(?:select|include)/gm)].map((m) => m[1]));
    for (const name of asked) {
      const declared = relations.has(name) || /^\s+messages\s+Message\[\]/m.test(block) && name === "messages";
      ok(`${file} selects \`${name}\` and MessageThread declares it`, declared);
    }
  }
  ok("MessageThread.client is a relation to Client (the thread screen and the temperature reading both select it)", /^\s+client\s+Client\?\s+@relation\(fields: \[clientId\]/m.test(block));
  ok("…and Client carries the back-relation", /^\s+messageThreads\s+MessageThread\[\]/m.test(schema.match(/^model Client \{[\s\S]*?^\}/m)?.[0] || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. Another app controls the thread — named, translated, asked for, never taken");
//
// The incident (2026-09-28): the owner answered a Page conversation Meta's
// Business AI had already answered, and the failed bubble read
// "meta_unknown_error: (#10) Message failed to send because another app is
// controlling this thread now." This section replays that exact Graph error
// through the REAL reply route (db and session stubbed, fetch stubbed — no
// request leaves the machine and no stored token is read) and follows it to
// the row, the response, the bubble's predicate and the composer.
//
// Imported dynamically so that on the code before this fix — where
// lib/messaging/threadControl.js and the request-control route do not exist —
// the section prints FAIL lines instead of dying on a static import.
{
  const tc = await import("@/lib/messaging/threadControl").catch(() => ({}));
  const { encryptToken } = await import("@/lib/meta/tokenCrypto");
  const { GRAPH_API_VERSION } = await import("@/lib/meta/client");
  const { messageItem } = await import("@/lib/messaging/rooms");
  const { session } = await import("./fixtures/apiMemberStub.mjs");
  const replyRoute = await import("../app/api/messaging/threads/[id]/reply/route.js");
  const askRoute = await import("../app/api/messaging/threads/[id]/request-control/route.js").catch(() => null);

  const REASON = "meta_other_app_controls_thread";
  // Meta's body as the owner's screen quoted it: code 10, no subcode.
  const INCIDENT = {
    error: {
      message: "(#10) Message failed to send because another app is controlling this thread now.",
      type: "OAuthException",
      code: 10,
      fbtrace_id: "AtrAce",
    },
  };
  // The same refusal as Meta's error-code table lists it: subcode 2018300.
  const WITH_SUBCODE = { error: { message: "(#10) Something else.", code: 10, error_subcode: 2018300 } };
  // Code 10 that is NOT thread control — must stay out of this case.
  const WINDOW = { error: { message: "(#10) This message is sent outside of allowed window.", code: 10, error_subcode: 2018278 } };
  const NO_PERMISSION = { error: { message: "(#10) Application does not have permission for this action", code: 10, error_subcode: 1404170 } };

  ok("the reason code is the named one", tc.THREAD_CONTROL_REASON === REASON, String(tc.THREAD_CONTROL_REASON));
  ok("the incident's body (code 10, no subcode) is recognised", tc.isThreadControlError?.(INCIDENT) === true);
  ok("subcode 2018300 is recognised whatever the sentence", tc.isThreadControlError?.(WITH_SUBCODE) === true);
  ok("code 10 for the 24-hour window is NOT thread control", tc.isThreadControlError?.(WINDOW) === false);
  ok("code 10 for a missing permission is NOT thread control", tc.isThreadControlError?.(NO_PERMISSION) === false);
  ok("an empty / non-Meta body is not thread control", tc.isThreadControlError?.(null) === false && tc.isThreadControlError?.({}) === false);
  ok(
    "a stored failedReason is recognised in both shapes (route `reason: message`, AI employee bare reason)",
    tc.isThreadControlFailure?.(`${REASON}: Meta said so`) === true &&
      tc.isThreadControlFailure?.(REASON) === true &&
      tc.isThreadControlFailure?.("meta_unknown_error: (#10) Message failed…") === false &&
      tc.isThreadControlFailure?.(null) === false,
  );
  ok(
    "asking is offered on Facebook only — not Instagram, not WhatsApp",
    tc.threadControlAskable?.("facebook") === true &&
      tc.threadControlAskable?.("instagram") === false &&
      tc.threadControlAskable?.("whatsapp") === false,
  );

  // ── The fixture: one connected Page, one conversation, one owner ────────
  resetDbStub();
  const channel = {
    id: "ch_tc",
    companyId: "co_tc",
    platform: "facebook",
    externalId: "PAGE_TC",
    name: "Truefinish Page",
    status: "connected",
    disconnectedAt: null,
    connectedAt: new Date("2026-09-01T00:00:00Z"),
    lastError: null,
    // A token minted HERE with the check's own key — never a stored one.
    accessTokenEnc: encryptToken("stub-page-token"),
  };
  rows.company = [{ id: "co_tc", isDemo: false, name: "Truefinish" }];
  rows.messagingChannel = [channel];
  rows.messageThread = [
    {
      id: "th_tc",
      companyId: "co_tc",
      participantExternalId: "PSID_EMILIO",
      channelId: "ch_tc",
      channel,
      status: "open",
      firstInboundAt: new Date(Date.now() - 10 * 60 * 1000),
      firstReplyAt: null,
      waitingSince: new Date(Date.now() - 10 * 60 * 1000),
      // Inside the 24-hour window, so the window refusal cannot be what fires.
      lastInboundAt: new Date(Date.now() - 5 * 60 * 1000),
      assignedEmployeeId: null,
      humanTookOverAt: null,
      unread: 1,
    },
  ];
  session.member = { id: null, userId: "u_owner", companyId: "co_tc", role: "owner" };

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    let body = null;
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body ?? null;
    }
    calls.push({ url: href, method: init.method || "GET", body });
    if (href.endsWith("/messages")) {
      return new Response(JSON.stringify(INCIDENT), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (href.endsWith("/request_thread_control")) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: { message: `unexpected call ${href}`, code: 1 } }), { status: 500 });
  };

  const typed = "Hi Emilio — yes, Tuesday works for the kitchen measure.";
  let res;
  let json = null;
  try {
    res = await replyRoute.POST(
      new Request("http://localhost/api/messaging/threads/th_tc/reply", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.1" },
        body: JSON.stringify({ text: typed }),
      }),
      { params: Promise.resolve({ id: "th_tc" }) },
    );
    json = await res.json();
  } catch (err) {
    ok("the reply route ran against the replayed error", false, err?.message);
  }

  const sendCall = calls.find((c) => c.url.endsWith("/messages"));
  ok(
    "the route really called Meta's Send API for the Page (stubbed fetch)",
    sendCall?.url === `https://graph.facebook.com/${GRAPH_API_VERSION}/PAGE_TC/messages` &&
      sendCall?.body?.recipient?.id === "PSID_EMILIO" &&
      sendCall?.body?.message?.text === typed,
    sendCall?.url,
  );
  ok("the route answers 409, not 200", res?.status === 409, String(res?.status));
  ok("the returned reason is the named case", json?.reason === REASON, String(json?.reason));
  ok("…and never meta_unknown_error", json?.reason !== "meta_unknown_error");

  const created = writes.find((w) => w.model === "message" && w.action === "create");
  ok(
    "the Message row is still written, carrying the named reason",
    typeof created?.data?.failedReason === "string" && created.data.failedReason.startsWith(`${REASON}: `),
    created?.data?.failedReason,
  );
  ok("…with Meta's own sentence kept for the record", /another app is controlling this thread/.test(created?.data?.failedReason || ""));
  ok("…and the words that did not go, so scrolling back shows what was tried", created?.data?.body === typed);
  ok(
    "a refused reply does not move the conversation (no thread update, unread untouched)",
    !writes.some((w) => w.model === "messageThread" && w.action === "update") && rows.messageThread[0].unread === 1,
  );

  // ── The bubble: the page's own predicate over the row it will be handed ──
  const item = messageItem(json?.message);
  ok("the returned row renders as a failed bubble", item?.status === "failed");
  ok(
    "…whose failedReason the page recognises and translates (isThreadControlFailure)",
    tc.isThreadControlFailure?.(item?.error) === true,
    item?.error,
  );

  const pageSrc = read("app/app/messages/page.js");
  ok(
    "the thread rows swap a thread-control failure for the translated sentence",
    /isThreadControlFailure\(item\.error\)[\s\S]{0,120}t\("app\.messages\.threadControl\.failed"\)/.test(pageSrc),
  );
  ok(
    "the composer answers the named reason with the translated sentence, not Meta's English",
    /data\?\.reason === THREAD_CONTROL_REASON[\s\S]{0,80}setSendError\(t\("app\.messages\.threadControl\.failed"\)\)/.test(pageSrc),
  );
  ok(
    "the panel with the fix is drawn from the most recent reply attempt (survives a reload)",
    /isThreadControlFailure\(lastReply\.failedReason\)/.test(pageSrc) && /<ThreadControlNotice/.test(pageSrc),
  );
  // ── The typed words survive the refusal ─────────────────────────────────
  // Positional, because send() is JSX-adjacent and cannot be imported: every
  // `return` on the refusal path comes BEFORE the one `setText("")`, and the
  // refusal block itself never calls setText.
  {
    const sendFn = pageSrc.slice(pageSrc.indexOf("async function send()"));
    const refusal = sendFn.slice(sendFn.indexOf("if (!res.ok) {"), sendFn.indexOf('setText("");'));
    ok(
      "a refused reply leaves the text in the composer (no setText on the refusal path, cleared only after it)",
      sendFn.indexOf("if (!res.ok) {") > -1 &&
        sendFn.indexOf('setText("");') > sendFn.indexOf("if (!res.ok) {") &&
        !/setText\(/.test(refusal),
    );
    ok(
      "…including the thread-control branch, which returns before the clear",
      /THREAD_CONTROL_REASON[\s\S]*?return;/.test(refusal),
    );
  }

  // ── Nine languages, every key, none left in English ─────────────────────
  const KEYS = ["failed", "title", "stepAutomations", "stepRouting", "stepRoutingInstagram", "after", "ask", "asking", "asked", "askFailed"]
    .map((k) => `app.messages.threadControl.${k}`);
  const langs = Object.keys(APP_MESSAGES);
  ok("the app has nine languages to cover", langs.length === 9, langs.join(","));
  for (const lang of langs) {
    const dict = APP_MESSAGES[lang] || {};
    const missing = KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
    const english = lang === "en" ? [] : KEYS.filter((k) => !missing.includes(k) && dict[k] === APP_MESSAGES.en[k]);
    ok(`${lang}: every thread-control sentence is present and translated`, !missing.length && !english.length, [...missing, ...english].join(", "));
  }
  ok(
    "the English fix names both settings the owner changes",
    /Inbox” → “Automations/.test(APP_MESSAGES.en["app.messages.threadControl.stepAutomations"] || "") &&
      /Business AI/.test(APP_MESSAGES.en["app.messages.threadControl.stepAutomations"] || "") &&
      // The tab name Meta's Conversation Routing page uses.
      /“Conversation Routing” tab/.test(APP_MESSAGES.en["app.messages.threadControl.stepRouting"] || ""),
  );

  // ── Asking: request_thread_control, and its exact shape ─────────────────
  calls.length = 0;
  writes.length = 0;
  let askRes = null;
  let askJson = null;
  try {
    askRes = await askRoute?.POST(
      new Request("http://localhost/api/messaging/threads/th_tc/request-control", {
        method: "POST",
        headers: { "x-forwarded-for": "10.9.9.2" },
      }),
      { params: Promise.resolve({ id: "th_tc" }) },
    );
    askJson = askRes ? await askRes.json() : null;
  } catch (err) {
    ok("the request-control route ran", false, err?.message);
  }
  const askCall = calls.find((c) => c.url.endsWith("/request_thread_control"));
  ok(
    "Ask calls POST /{PAGE-ID}/request_thread_control with the PSID and the Page token",
    askCall?.method === "POST" &&
      askCall?.url === `https://graph.facebook.com/${GRAPH_API_VERSION}/PAGE_TC/request_thread_control` &&
      askCall?.body?.recipient?.id === "PSID_EMILIO" &&
      askCall?.body?.access_token === "stub-page-token" &&
      typeof askCall?.body?.metadata === "string" &&
      Object.keys(askCall?.body || {}).sort().join(",") === "access_token,metadata,recipient",
    JSON.stringify(askCall?.body ? { ...askCall.body, access_token: "…" } : null),
  );
  ok("…and answers requested: true, claiming nothing more", askRes?.status === 200 && askJson?.requested === true && Object.keys(askJson || {}).length === 1);
  ok("…writes nothing (a request is not a message)", writes.length === 0, writes.map((w) => `${w.model}.${w.action}`).join(","));
  ok("take_thread_control is never called", !calls.some((c) => /take_thread_control|pass_thread_control/.test(c.url)));

  // Instagram: explained, never asked — no Meta call at all.
  rows.messagingChannel[0] = { ...channel, platform: "instagram", externalId: "IG_TC" };
  rows.messageThread[0].channel = rows.messagingChannel[0];
  calls.length = 0;
  let igRes = null;
  let igJson = null;
  try {
    igRes = await askRoute?.POST(
      new Request("http://localhost/api/messaging/threads/th_tc/request-control", { method: "POST", headers: { "x-forwarded-for": "10.9.9.3" } }),
      { params: Promise.resolve({ id: "th_tc" }) },
    );
    igJson = igRes ? await igRes.json() : null;
  } catch (err) {
    ok("the request-control route ran for Instagram", false, err?.message);
  }
  ok(
    "an Instagram conversation is refused by name, with no call to Meta",
    igRes?.status === 409 && igJson?.reason === "thread_control_unsupported" && calls.length === 0,
    `${igRes?.status} ${igJson?.reason} calls=${calls.length}`,
  );

  // Another tenant's thread id is a 404, like the reply route.
  session.member = { id: null, userId: "u_other", companyId: "co_other", role: "owner" };
  rows.company.push({ id: "co_other", isDemo: false, name: "Other" });
  let foreign = null;
  try {
    foreign = await askRoute?.POST(
      new Request("http://localhost/api/messaging/threads/th_tc/request-control", { method: "POST", headers: { "x-forwarded-for": "10.9.9.4" } }),
      { params: Promise.resolve({ id: "th_tc" }) },
    );
  } catch (err) {
    ok("the request-control route ran for a foreign member", false, err?.message);
  }
  ok("another company's member cannot ask for this conversation (404)", foreign?.status === 404, String(foreign?.status));

  globalThis.fetch = realFetch;
  session.member = null;
  resetDbStub();
}

// ═══════════════════════════════════════════════════════════════════════════
section("15. Instagram replies — the Page-token endpoint, and code 3 named");
//
// The second incident the same day: every Instagram reply failed with
// "meta_unknown_error: (#3) Application does not have the capability to make
// this API call." while Facebook replies worked. The send was POSTing to
// graph.facebook.com/<instagram account id>/messages — the Instagram-Login
// API's path — with the PAGE token that belongs to the Messenger Platform's
// Instagram API, whose documented path is /PAGE-ID/messages or /me/messages
// (metaSend.js's sendPath carries the citations). Replayed through the real
// reply route with fetch stubbed; no stored token is read.
{
  const ig = await import("@/lib/messaging/instagramSendErrors").catch(() => ({}));
  const { encryptToken } = await import("@/lib/meta/tokenCrypto");
  const { GRAPH_API_VERSION } = await import("@/lib/meta/client");
  const { messageItem } = await import("@/lib/messaging/rooms");
  const { session } = await import("./fixtures/apiMemberStub.mjs");
  const replyRoute = await import("../app/api/messaging/threads/[id]/reply/route.js");

  const REASON = "meta_instagram_messaging_not_enabled";
  const CODE3 = {
    error: {
      message: "(#3) Application does not have the capability to make this API call.",
      type: "OAuthException",
      code: 3,
      fbtrace_id: "AigTrace",
    },
  };
  ok("the reason code is the named one", ig.INSTAGRAM_CAPABILITY_REASON === REASON, String(ig.INSTAGRAM_CAPABILITY_REASON));
  ok("code 3 on Instagram is recognised", ig.isInstagramCapabilityError?.("instagram", CODE3) === true);
  ok("code 3 on Facebook is NOT (it would send a Page owner into Instagram's settings)", ig.isInstagramCapabilityError?.("facebook", CODE3) === false);
  ok(
    "other Instagram errors are not (code 10 window, code 190 token)",
    ig.isInstagramCapabilityError?.("instagram", { error: { code: 10, error_subcode: 2534022 } }) === false &&
      ig.isInstagramCapabilityError?.("instagram", { error: { code: 190 } }) === false,
  );
  ok(
    "a stored failedReason is recognised in both shapes",
    ig.isInstagramCapabilityFailure?.(`${REASON}: Meta said so`) === true &&
      ig.isInstagramCapabilityFailure?.(REASON) === true &&
      ig.isInstagramCapabilityFailure?.("meta_unknown_error: (#3) Application does not have the capability") === false,
  );

  resetDbStub();
  const channel = {
    id: "ch_ig",
    companyId: "co_ig",
    platform: "instagram",
    // The Instagram professional account id — the webhook's entry.id, which
    // is what this row is keyed on. It must NOT appear in the send URL.
    externalId: "17841400000000001",
    name: "@truefinish",
    status: "connected",
    disconnectedAt: null,
    connectedAt: new Date("2026-09-01T00:00:00Z"),
    lastError: null,
    accessTokenEnc: encryptToken("stub-page-token-ig"),
  };
  rows.company = [{ id: "co_ig", isDemo: false, name: "Truefinish" }];
  rows.messagingChannel = [channel];
  rows.messageThread = [
    {
      id: "th_ig",
      companyId: "co_ig",
      participantExternalId: "IGSID_EMILIO",
      channelId: "ch_ig",
      channel,
      status: "open",
      firstInboundAt: new Date(Date.now() - 10 * 60 * 1000),
      firstReplyAt: null,
      waitingSince: new Date(Date.now() - 10 * 60 * 1000),
      lastInboundAt: new Date(Date.now() - 5 * 60 * 1000),
      assignedEmployeeId: null,
      humanTookOverAt: null,
      unread: 1,
    },
  ];
  session.member = { id: null, userId: "u_owner", companyId: "co_ig", role: "owner" };

  const calls = [];
  const realFetch = globalThis.fetch;
  let answer = "code3";
  globalThis.fetch = async (url, init = {}) => {
    let body = null;
    try {
      body = JSON.parse(init.body);
    } catch {
      body = null;
    }
    calls.push({ url: String(url), body });
    if (answer === "code3") {
      return new Response(JSON.stringify(CODE3), { status: 400, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ recipient_id: "IGSID_EMILIO", message_id: "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlE" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const typed = "Hi! Yes, we can come Thursday for the cabinet quote.";
  const post = () =>
    replyRoute.POST(
      new Request("http://localhost/api/messaging/threads/th_ig/reply", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.8.1" },
        body: JSON.stringify({ text: typed }),
      }),
      { params: Promise.resolve({ id: "th_ig" }) },
    );

  let res = null;
  let json = null;
  try {
    res = await post();
    json = await res.json();
  } catch (err) {
    ok("the reply route ran for Instagram", false, err?.message);
  }
  const call = calls[0];
  ok(
    "an Instagram reply is POSTed to graph.facebook.com/<ver>/me/messages (Page token), not /<ig id>/messages",
    call?.url === `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages` && !call?.url.includes(channel.externalId),
    call?.url,
  );
  ok(
    "…addressed to the IGSID with the Page token, text and RESPONSE type unchanged",
    call?.body?.recipient?.id === "IGSID_EMILIO" &&
      call?.body?.message?.text === typed &&
      call?.body?.messaging_type === "RESPONSE" &&
      call?.body?.access_token === "stub-page-token-ig",
  );
  ok("Meta's code 3 comes back as the named reason, not meta_unknown_error", json?.reason === REASON, String(json?.reason));
  const created = writes.find((w) => w.model === "message" && w.action === "create");
  ok(
    "the Message row carries the named reason and Meta's own sentence",
    typeof created?.data?.failedReason === "string" &&
      created.data.failedReason.startsWith(`${REASON}: `) &&
      /does not have the capability/.test(created.data.failedReason),
    created?.data?.failedReason,
  );
  const item = messageItem(json?.message);
  ok("…and the page's predicate recognises the bubble", item?.status === "failed" && ig.isInstagramCapabilityFailure?.(item?.error) === true);
  ok(
    "no stored grant: the verdict is UNKNOWN (null), never 'nothing missing'",
    "missingPermissions" in (json || {}) && json.missingPermissions === null &&
      ig.permissionVerdictFromFailure?.(item?.error) === null,
    JSON.stringify(json?.missingPermissions),
  );

  // ── Which permission — read from the grant Meta reported at connect ─────
  const replayWithScopes = async (scopes, ip) => {
    writes.length = 0;
    rows.message = [];
    rows.metaPageConnection = [
      { id: "mpc_1", companyId: "co_ig", pageId: "PAGE_LINKED", instagramUserId: channel.externalId, scopes, disconnectedAt: null },
      // A disconnected row for the same account with a DIFFERENT grant — must
      // not be the one read.
      { id: "mpc_old", companyId: "co_ig", pageId: "PAGE_OLD", instagramUserId: channel.externalId, scopes: "", disconnectedAt: new Date() },
    ];
    const r = await replyRoute.POST(
      new Request("http://localhost/api/messaging/threads/th_ig/reply", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ text: typed }),
      }),
      { params: Promise.resolve({ id: "th_ig" }) },
    );
    const j = await r.json();
    return { j, row: writes.find((w) => w.model === "message" && w.action === "create")?.data };
  };
  {
    // Production's Facebook Login for Business configuration — the Lead Ads
    // diagnostics showed Page permissions missing from it.
    const { j, row } = await replayWithScopes("pages_show_list,pages_messaging,instagram_manage_messages", "10.9.8.2");
    ok(
      "a grant lacking Meta's listed permissions names exactly the missing ones, in Meta's order",
      JSON.stringify(j.missingPermissions) === JSON.stringify(["instagram_basic", "pages_manage_metadata"]),
      JSON.stringify(j.missingPermissions),
    );
    ok(
      "…and the stored sentence carries the same verdict, so a reload reads it back",
      JSON.stringify(ig.permissionVerdictFromFailure?.(row?.failedReason)) === JSON.stringify(["instagram_basic", "pages_manage_metadata"]),
      row?.failedReason,
    );
  }
  {
    const { j, row } = await replayWithScopes("instagram_basic instagram_manage_messages pages_manage_metadata pages_messaging", "10.9.8.3");
    ok(
      "a grant with every listed permission answers [] (the dashboard step would be wrong advice)",
      Array.isArray(j.missingPermissions) && j.missingPermissions.length === 0 &&
        JSON.stringify(ig.permissionVerdictFromFailure?.(row?.failedReason)) === "[]",
      row?.failedReason,
    );
  }
  ok(
    "the verdict reader only returns Meta's permission names — a stored sentence cannot inject others",
    ig.permissionVerdictFromFailure?.(`${REASON}: x [missing permissions: <script>, instagram_basic]`)?.join(",") === "instagram_basic" &&
      ig.permissionVerdictFromFailure?.(`${REASON}: x [missing permissions: nonsense]`) === null &&
      ig.permissionVerdictFromFailure?.(`${REASON}: x [missing permissions: instagram_basic`) === null &&
      ig.permissionVerdictFromFailure?.(null) === null,
  );
  ok(
    "the permission list is the one Meta's get-started page names",
    JSON.stringify(ig.INSTAGRAM_MESSAGING_PERMISSIONS) === JSON.stringify(["instagram_basic", "instagram_manage_messages", "pages_manage_metadata"]),
  );
  ok(
    "missingInstagramPermissions: empty or absent grant is unknown, not complete",
    ig.missingInstagramPermissions?.(null) === null && ig.missingInstagramPermissions?.("  ") === null,
  );

  // The same route, Meta answering 200 — the send now succeeds end to end on
  // the documented path. ($transaction is not scripted in the db stub, so the
  // success branch's thread update is not executed here; the send result and
  // its response are what this proves.)
  answer = "ok";
  calls.length = 0;
  const { sendMetaMessage: send } = await import("@/lib/messaging/metaSend");
  const okSend = await send({
    channel,
    recipientExternalId: "IGSID_EMILIO",
    text: typed,
    lastInboundAt: new Date(Date.now() - 60 * 1000),
  });
  ok(
    "with Meta answering, the Instagram send succeeds on /me/messages and returns Meta's message id",
    okSend.ok === true && okSend.externalId === "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlE" && calls[0]?.url.endsWith("/me/messages"),
    JSON.stringify(okSend),
  );
  calls.length = 0;
  await send({
    channel: { ...channel, platform: "facebook", externalId: "PAGE_FB" },
    recipientExternalId: "PSID_1",
    text: "hi",
    lastInboundAt: new Date(Date.now() - 60 * 1000),
  });
  ok(
    "a Facebook reply is untouched: still /<page id>/messages",
    calls[0]?.url === `https://graph.facebook.com/${GRAPH_API_VERSION}/PAGE_FB/messages`,
    calls[0]?.url,
  );

  const pageSrc = read("app/app/messages/page.js");
  ok(
    "the thread rows swap the Instagram failure for the translated sentence",
    /isInstagramCapabilityFailure\(item\.error\)[\s\S]{0,120}t\("app\.messages\.igCapability\.failed"\)/.test(pageSrc),
  );
  ok(
    "the composer answers the named reason with the translated sentence",
    /data\?\.reason === INSTAGRAM_CAPABILITY_REASON[\s\S]{0,80}setSendError\(t\("app\.messages\.igCapability\.failed"\)\)/.test(pageSrc),
  );
  ok(
    "the fix is drawn above the composer from the most recent reply attempt",
    /isInstagramCapabilityFailure\(lastReply\.failedReason\)/.test(pageSrc) && /<InstagramMessagingNotice/.test(pageSrc),
  );

  ok(
    "the notice reads the verdict back from the stored sentence",
    /missing=\{permissionVerdictFromFailure\(lastReply\.failedReason\)\}/.test(pageSrc),
  );
  const bitsSrc = read("app/app/messages/ConversationBits.js");
  ok(
    "the notice leads with the named permissions, drops the dashboard step when all are granted",
    /titleMissing", \{ permissions: missing\.join\(", "\) \}/.test(bitsSrc) &&
      /allGranted \? null :/.test(bitsSrc) &&
      /titleUnknown/.test(bitsSrc),
  );

  const KEYS = ["failed", "titleMissing", "titleUnknown", "titleGranted", "stepDashboard", "stepAllowAccess", "after"].map(
    (k) => `app.messages.igCapability.${k}`,
  );
  for (const lang of Object.keys(APP_MESSAGES)) {
    const dict = APP_MESSAGES[lang] || {};
    const missing = KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
    const english = lang === "en" ? [] : KEYS.filter((k) => !missing.includes(k) && dict[k] === APP_MESSAGES.en[k]);
    ok(`${lang}: every Instagram-capability sentence is present and translated`, !missing.length && !english.length, [...missing, ...english].join(", "));
  }
  // Meta's get-started page, verbatim — in EVERY language, because Meta's
  // docs name the labels in English and a translated label nobody has read
  // in Instagram's own UI would be a guess.
  const IG_PATH = "Instagram Settings > Messages and story replies > Message controls > Connected Tools > Allow Access to Messages";
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(
      `${lang}: the Instagram setting is Meta's documented path, verbatim`,
      (APP_MESSAGES[lang]?.["app.messages.igCapability.stepAllowAccess"] || "").includes(IG_PATH),
    );
  }
  ok(
    "the English lead names instagram_manage_messages and the Meta App Dashboard configuration",
    /instagram_manage_messages/.test(APP_MESSAGES.en["app.messages.igCapability.titleUnknown"] || "") &&
      /\{permissions\}/.test(APP_MESSAGES.en["app.messages.igCapability.titleMissing"] || "") &&
      /Facebook Login configuration in the Meta App Dashboard/.test(APP_MESSAGES.en["app.messages.igCapability.stepDashboard"] || "") &&
      /Moderate/.test(APP_MESSAGES.en["app.messages.igCapability.stepDashboard"] || ""),
  );
  ok(
    "every language keeps the {permissions} and {settings} placeholders",
    Object.keys(APP_MESSAGES).every(
      (l) =>
        (APP_MESSAGES[l]?.["app.messages.igCapability.titleMissing"] || "").includes("{permissions}") &&
        (APP_MESSAGES[l]?.["app.messages.igCapability.stepDashboard"] || "").includes("{settings}"),
    ),
  );

  globalThis.fetch = realFetch;
  session.member = null;
  resetDbStub();
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
