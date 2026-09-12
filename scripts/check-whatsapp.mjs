// scripts/check-whatsapp.mjs
//
//   npm run check:whatsapp
//
// The regression guard for WhatsApp Business as the third channel on the
// inbox: its signed webhook, its envelope, its send path, its templates, and —
// the thing most likely to be built wrong — the 24-hour customer service
// window.
//
// ══ Why the window gets the most assertions in this file ═══════════════════
//
// Because it is the one rule here whose wrong version PASSES every other kind
// of check. A send path that ignores the window compiles, lints, type-checks,
// looks right in review, works perfectly in every manual test somebody does
// within a few minutes of sending themselves a test message — and then fails
// silently in production the first time a contractor answers a conversation
// the next morning. Meta refuses it with error 131047 and FieldQuo, without
// this, would have written a sent-looking bubble.
//
// So the window is executed as a PURE function against fixtures at four
// points — open, closed, exactly on the boundary, and never opened at all —
// and then again through the real send path, and again through the AI
// employee's verdict. Three layers, one rule, and each layer asserted
// separately, because a guard that exists in one and not the others is the
// shape this codebase keeps finding.
//
// ══ What this EXECUTES rather than reads ═══════════════════════════════════
//
//   * "the webhook verifies Meta's signature" — signed with the real
//     primitive, then forged, then tampered, then with the secret unset.
//   * "a re-delivered message is not posted twice" — the SAME payload through
//     the real ingest against a scripted database, twice, counting rows.
//   * "the company comes from the channel" — a foreign companyId IN the
//     payload, and the WABA id in entry.id belonging to another tenant.
//   * "free text is refused outside the window" — the real send function, with
//     a real channel row, at four points on the clock.
//   * "the AI employee will not send outside the window" — the real verdict
//     function, with every other guard satisfied.
//   * "a template is what may be sent instead" — the real refusals for an
//     unapproved template and a wrong parameter count, and the real payload.
//
// Run:
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-whatsapp.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  verifyWebhookSignature,
  signWebhookBody,
  verifySubscribeChallenge,
} from "@/lib/messaging/webhookSignature";
import { parseWhatsAppEnvelope } from "@/lib/messaging/whatsappEnvelope";
import { ingestEvent, ingestEvents } from "@/lib/messaging/ingest";
import {
  serviceWindowState,
  serviceWindowRefusal,
  serviceWindowNotice,
  needsServiceWindow,
  SERVICE_WINDOW_MS,
  RE_ENGAGEMENT_ERROR_CODE,
} from "@/lib/messaging/serviceWindow";
import { sendWhatsAppMessage, classifyWhatsAppError } from "@/lib/messaging/whatsappSend";
import {
  classifyWhatsAppOutboundMedia,
  prepareOutboundMedia,
  jpegVariantUrl,
  whatsAppMediaPayload,
  WHATSAPP_MEDIA_LIMITS,
  WHATSAPP_MEDIA_ACCEPT,
  OUTBOUND_TYPES,
} from "@/lib/messaging/whatsappMedia";
import {
  normaliseAttachment,
  normaliseAttachments,
  normaliseLocation,
  normaliseContacts,
  publicAttachments,
  isDurableMediaUrl,
  isFetchable,
  hasFetchableMedia,
  withFetchResult,
  withFetchReset,
  attachmentLabelKey,
  attachmentTypeKey,
  documentTypeKey,
  formatBytes,
  ATTACHMENT_TYPES,
  MEDIA_FETCH_MAX_ATTEMPTS,
} from "@/lib/messaging/attachments";
import { whatsAppLocationPayload } from "@/lib/messaging/whatsappMedia";
import { UNBUILT_OUTBOUND_TYPES } from "@/lib/messaging/whatsappMediaLimits";
import { videoPosterUrl } from "@/lib/media/cloudinaryUrl";
import { staticMapUrl, mapsLinkUrl, addressFromLocation } from "@/lib/messaging/locationLink";
import { classifyMedia, uploadPublicId, MESSAGING_DOCUMENT_TYPES } from "@/lib/media/validate";
import { rehostAttachment, resolveWhatsAppMediaUrl, isMetaMediaUrl } from "@/lib/messaging/mediaFetch";
import { encryptToken } from "@/lib/meta/tokenCrypto";
import { sendOnChannel } from "@/lib/messaging/send";
import {
  templateRefusal,
  templatePayload,
  countTemplateVariables,
  normaliseTemplate,
  isSendableTemplate,
} from "@/lib/messaging/templates";
import {
  MESSAGING_PLATFORMS,
  SOURCE_FOR_PLATFORM,
  sourceForPlatform,
  isMessagingPlatform,
} from "@/lib/messaging/platforms";
import { CONVERSATION_SOURCES } from "@/lib/attribution/conversationOutcome";
import { shouldReply, SKIP } from "@/lib/aiEmployee/decide";
import { META_OAUTH_SCOPE, META_WHATSAPP_SCOPE, metaRequestedScope } from "@/lib/meta/client";
import { FEATURES } from "@/lib/features/registry";
import { MATRIX_EXCLUSIONS } from "@/lib/marketing/featureMatrix";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";

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
 * passes once the thing being checked for has been deleted — which is the one
 * way a source assertion can certify its own subject's removal.
 */
function orderedInSource(source, a, b) {
  const ia = source.indexOf(a);
  const ib = source.indexOf(b, ia === -1 ? 0 : ia);
  return ia >= 0 && ib > ia;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The webhook signature — valid, forged, tampered, unset secret");
// ═══════════════════════════════════════════════════════════════════════════

const SECRET = "a-real-looking-app-secret";

/** WhatsApp's envelope, as Meta documents it. Epoch SECONDS, not millis. */
const inboundBody = (overrides = {}) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550100199",
                phone_number_id: "PHONE_1",
              },
              contacts: [{ profile: { name: "Dana Reyes" }, wa_id: "15551234567" }],
              messages: [
                {
                  from: "15551234567",
                  id: "wamid.AAA",
                  timestamp: "1757000000",
                  type: "text",
                  text: { body: "Do you do kitchen cabinets?" },
                },
              ],
              ...overrides,
            },
          },
        ],
      },
    ],
  });

const BODY = inboundBody();

ok(
  "a signature made with the app secret verifies",
  verifyWebhookSignature(BODY, signWebhookBody(BODY, SECRET), SECRET).ok,
);

// One byte changed in the hex digest. Fails if timingSafeEqual is ever swapped
// for a truthy check on the header's presence.
const good = signWebhookBody(BODY, SECRET);
const forged = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
ok(
  "a forged signature is refused",
  verifyWebhookSignature(BODY, forged, SECRET).reason === "bad_signature",
);

// The same signature over a DIFFERENT body — the attack a verifier that hashes
// the parsed object instead of the raw bytes waves through.
const tampered = BODY.replace("Do you do kitchen cabinets?", "Send payment to this account");
ok(
  "a valid signature over a tampered body is refused",
  !verifyWebhookSignature(tampered, good, SECRET).ok,
);

ok(
  "an UNSET app secret refuses rather than skipping verification",
  verifyWebhookSignature(BODY, good, "").reason === "secret_unset",
);
ok("a missing signature header is refused", !verifyWebhookSignature(BODY, null, SECRET).ok);

const handshake = new URLSearchParams({
  "hub.mode": "subscribe",
  "hub.verify_token": "the-token",
  "hub.challenge": "9876543210",
});
ok(
  "the subscribe handshake echoes the challenge for the right token",
  verifySubscribeChallenge(handshake, "the-token").challenge === "9876543210",
);
ok(
  "the subscribe handshake refuses when the verify token is UNSET",
  verifySubscribeChallenge(handshake, "").reason === "verify_token_unset",
);

// The route. Positional assertions, named as such: JSX and route handlers
// cannot be imported here, so these are matched against the source with the
// assertion written so that deleting the guard fails.
const webhookSrc = read("app/api/meta/whatsapp/webhook/route.js");
ok(
  "the WhatsApp webhook verifies BEFORE parsing the body",
  webhookSrc.indexOf("verifyWebhookSignature") < webhookSrc.indexOf("JSON.parse(raw)"),
);
ok(
  "the WhatsApp webhook reads the raw body, not the parsed object",
  /await request\.text\(\)/.test(webhookSrc) && !/await request\.json\(\)/.test(webhookSrc),
);
ok(
  "a refused signature answers 403 with no body detail",
  /signature refused[\s\S]{0,200}status: 403/.test(webhookSrc),
);
ok(
  "the WhatsApp webhook is rate limited",
  /rateLimit\(request, "meta-whatsapp-webhook"/.test(webhookSrc),
);
ok(
  "the WhatsApp webhook uses the WhatsApp parser, not the Page one",
  /parseWhatsAppEnvelope/.test(webhookSrc) && !/parseMessagingEnvelope/.test(webhookSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The envelope — the number is the tenant, and seconds are seconds");
// ═══════════════════════════════════════════════════════════════════════════

const parsed = parseWhatsAppEnvelope(JSON.parse(BODY));
ok("an inbound WhatsApp message parses", parsed.events.length === 1);
ok("its platform is whatsapp", parsed.platform === "whatsapp");
ok("it is direction 'in'", parsed.events[0]?.direction === "in");
ok(
  "the CHANNEL key is the phone number id, not the WABA id",
  parsed.events[0]?.pageExternalId === "PHONE_1",
  `got ${parsed.events[0]?.pageExternalId}`,
);
ok(
  "the thread is keyed on the customer's wa_id",
  parsed.events[0]?.threadExternalId === "15551234567",
);
ok("the profile name is carried across", parsed.events[0]?.participantName === "Dana Reyes");
ok("the body is the text", parsed.events[0]?.body === "Do you do kitchen cabinets?");

// SECONDS, not milliseconds. Reading this wrong puts every message in 1970 —
// which would make lastInboundAt fifty years old and the 24-hour window read
// CLOSED on every live conversation.
ok(
  "the timestamp is read as epoch SECONDS",
  parsed.events[0]?.sentAt?.getTime() === 1757000000 * 1000,
  `got ${parsed.events[0]?.sentAt?.toISOString()}`,
);

// Media: the id is carried, the URL is NOT invented.
const media = parseWhatsAppEnvelope(
  JSON.parse(
    inboundBody({
      messages: [
        {
          from: "15551234567",
          id: "wamid.IMG",
          timestamp: "1757000100",
          type: "image",
          image: { id: "MEDIA_1", mime_type: "image/jpeg", caption: "the old units" },
        },
      ],
    }),
  ),
);
ok("an inbound image carries Meta's media id", media.events[0]?.attachments?.[0]?.mediaId === "MEDIA_1");
ok(
  "an inbound image does NOT invent a URL — WhatsApp sends none",
  media.events[0]?.attachments?.[0]?.url === null,
);
ok("a media caption is kept as the message body", media.events[0]?.body === "the old units");

// Statuses.
const statuses = (status, extra = {}) =>
  parseWhatsAppEnvelope(
    JSON.parse(
      inboundBody({
        messages: undefined,
        contacts: undefined,
        statuses: [
          {
            id: "wamid.OUT",
            status,
            timestamp: "1757000200",
            recipient_id: "15551234567",
            ...extra,
          },
        ],
      }),
    ),
  );
ok("a delivered status becomes a delivery event", statuses("delivered").events[0]?.kind === "delivery");
ok("a read status becomes a read event", statuses("read").events[0]?.kind === "read");
ok("a failed status becomes a failed event", statuses("failed").events[0]?.kind === "failed");
ok(
  "a status names the MESSAGE rather than a watermark",
  statuses("delivered").events[0]?.mids?.[0] === "wamid.OUT",
);
ok(
  "a 'sent' status is dropped — it is Meta's queue, not the phone",
  statuses("sent").events.length === 0 && statuses("sent").dropped === 1,
);
const failedErr = statuses("failed", {
  errors: [{ code: 131047, title: "Re-engagement message", error_data: { details: "24 hours" } }],
}).events[0];
ok("a failure carries Meta's own error code", failedErr?.error?.code === 131047);

// Not ours, and not a throw.
ok(
  "another webhook object yields no events and does not throw",
  parseWhatsAppEnvelope({ object: "page", entry: [{ id: "x" }] }).events.length === 0,
);
ok(
  "a non-`messages` change field is dropped, not guessed at",
  parseWhatsAppEnvelope({
    object: "whatsapp_business_account",
    entry: [{ id: "W", changes: [{ field: "message_template_status_update", value: {} }] }],
  }).events.length === 0,
);
ok(
  "a payload with no phone_number_id resolves to nothing",
  parseWhatsAppEnvelope({
    object: "whatsapp_business_account",
    entry: [{ id: "W", changes: [{ field: "messages", value: { messages: [{ from: "x", id: "y" }] } }] }],
  }).events.length === 0,
);
ok("a garbage payload does not throw", parseWhatsAppEnvelope(null).events.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Ingest — idempotency, the tenant, and lastInboundAt");
// ═══════════════════════════════════════════════════════════════════════════

function seedChannel() {
  resetDbStub();
  rows.messagingChannel.push({
    id: "chan_wa",
    companyId: "company_REAL",
    platform: "whatsapp",
    externalId: "PHONE_1",
    wabaId: null,
    status: "connected",
    disconnectedAt: null,
    accessTokenEnc: "not-a-real-blob",
  });
}

seedChannel();
const first = await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
ok("a first delivery creates the thread and the message", first.created === 1);
ok("one thread row exists", rows.messageThread.length === 1);
ok("one message row exists", rows.message.length === 1);
ok("the unread count is 1", rows.messageThread[0].unread === 1);
ok(
  "the WABA id is learned from the webhook when we held none",
  rows.messagingChannel[0].wabaId === "WABA_1",
);

// THE column the whole window depends on.
ok(
  "lastInboundAt is stamped from the customer's own message",
  rows.messageThread[0].lastInboundAt?.getTime() === 1757000000 * 1000,
  `got ${rows.messageThread[0].lastInboundAt}`,
);

// Meta re-delivers after a timeout, for hours. Byte-identical payload, twice.
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
ok("a re-delivered webhook creates NO second thread", rows.messageThread.length === 1);
ok("a re-delivered webhook creates NO second message", rows.message.length === 1);
ok("a re-delivered webhook does NOT bump the unread badge", rows.messageThread[0].unread === 1);

// An OUTBOUND message must not move the window. This is the assertion that
// fails if somebody ever "simplifies" lastInboundAt into lastMessageAt.
const before = rows.messageThread[0].lastInboundAt?.getTime();
await ingestEvent({
  kind: "message",
  platform: "whatsapp",
  pageExternalId: "PHONE_1",
  threadExternalId: "15551234567",
  participantExternalId: "15551234567",
  direction: "out",
  externalId: "wamid.OURS",
  body: "We do — when suits?",
  sentAt: new Date(1757009999 * 1000),
});
ok(
  "an OUTBOUND message does not move lastInboundAt",
  rows.messageThread[0].lastInboundAt?.getTime() === before,
);

// A late re-delivery of an OLDER message must not drag the window backwards —
// that would close a window that is legitimately open.
await ingestEvent({
  kind: "message",
  platform: "whatsapp",
  pageExternalId: "PHONE_1",
  threadExternalId: "15551234567",
  participantExternalId: "15551234567",
  direction: "in",
  externalId: "wamid.OLD",
  body: "an earlier question",
  sentAt: new Date(1756000000 * 1000),
});
ok(
  "a late-delivered OLDER inbound message does not drag lastInboundAt backwards",
  rows.messageThread[0].lastInboundAt?.getTime() === before,
);

// The attack: a signed body naming somebody else's company, and a WABA id
// belonging to another tenant.
seedChannel();
await ingestEvents(
  parseWhatsAppEnvelope({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_OF_SOMEBODY_ELSE",
        companyId: "company_VICTIM",
        changes: [
          {
            field: "messages",
            value: {
              companyId: "company_VICTIM",
              metadata: { phone_number_id: "PHONE_1" },
              messages: [
                { from: "15559999999", id: "wamid.ZZZ", timestamp: "1757000000", type: "text", text: { body: "hi" } },
              ],
            },
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

// An unknown number writes nothing at all.
seedChannel();
const unknown = await ingestEvent({
  kind: "message",
  platform: "whatsapp",
  pageExternalId: "PHONE_NOBODY_HOLDS",
  threadExternalId: "1555",
  participantExternalId: "1555",
  direction: "in",
  externalId: "wamid.X",
  body: "hello",
  sentAt: new Date(),
});
ok("an unknown phone number is not handled", !unknown.handled && unknown.reason === "unknown_page");
ok("…and writes no thread", rows.messageThread.length === 0);

// A failed status turns the bubble.
seedChannel();
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
await ingestEvent({
  kind: "message",
  platform: "whatsapp",
  pageExternalId: "PHONE_1",
  threadExternalId: "15551234567",
  participantExternalId: "15551234567",
  direction: "out",
  externalId: "wamid.OUT",
  body: "on our way",
  sentAt: new Date(1757000100 * 1000),
});
await ingestEvent({
  kind: "failed",
  platform: "whatsapp",
  pageExternalId: "PHONE_1",
  threadExternalId: "15551234567",
  participantExternalId: "15551234567",
  watermark: new Date(1757000200 * 1000),
  mids: ["wamid.OUT"],
  error: { code: 131047, title: "Re-engagement message", detail: "24 hours have passed" },
});
const failedRow = rows.message.find((m) => m.externalId === "wamid.OUT");
ok(
  "a failure webhook writes failedReason onto the message Meta named",
  String(failedRow?.failedReason || "").includes("131047"),
  `got ${failedRow?.failedReason}`,
);
ok(
  "…and does not touch the inbound message beside it",
  !rows.message.find((m) => m.externalId === "wamid.AAA")?.failedReason,
);

// A delivery receipt is per-message, not a watermark: the OTHER outbound
// message on the thread must not be stamped by it.
seedChannel();
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
for (const id of ["wamid.OUT_A", "wamid.OUT_B"]) {
  await ingestEvent({
    kind: "message",
    platform: "whatsapp",
    pageExternalId: "PHONE_1",
    threadExternalId: "15551234567",
    participantExternalId: "15551234567",
    direction: "out",
    externalId: id,
    body: id,
    sentAt: new Date(1757000100 * 1000),
  });
}
// Prisma defaults an unset DateTime column to NULL; the stub applies no
// defaults, so the rows it created carry `undefined`. Stated here rather than
// worked around silently — the `deliveredAt: null` in the ingest's WHERE is
// exactly what makes a re-delivered receipt idempotent, and a check that
// dropped it would be asserting against a query the product does not run.
for (const m of rows.message) {
  if (m.deliveredAt === undefined) m.deliveredAt = null;
  if (m.readAt === undefined) m.readAt = null;
}

await ingestEvent({
  kind: "delivery",
  platform: "whatsapp",
  pageExternalId: "PHONE_1",
  threadExternalId: "15551234567",
  participantExternalId: "15551234567",
  watermark: new Date(1757000300 * 1000),
  mids: ["wamid.OUT_B"],
});
ok(
  "a per-message delivery receipt stamps only the message it names",
  Boolean(rows.message.find((m) => m.externalId === "wamid.OUT_B")?.deliveredAt) &&
    !rows.message.find((m) => m.externalId === "wamid.OUT_A")?.deliveredAt,
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. THE 24-HOUR WINDOW — pure, at four points on the clock");
// ═══════════════════════════════════════════════════════════════════════════

const NOW = new Date("2026-09-08T12:00:00.000Z");
const ago = (ms) => new Date(NOW.getTime() - ms);

ok("the window is exactly 24 hours", SERVICE_WINDOW_MS === 24 * 60 * 60 * 1000);

// OPEN — the customer wrote an hour ago.
const open = serviceWindowState(ago(60 * 60 * 1000), NOW);
ok("an hour after the customer wrote, the window is OPEN", open.open === true);
ok("…and reports 23 hours remaining", Math.round(open.msRemaining / 3600000) === 23);
ok("…and knows when it shuts", open.closesAt.getTime() === ago(60 * 60 * 1000).getTime() + SERVICE_WINDOW_MS);

// CLOSED — 25 hours.
const closed = serviceWindowState(ago(25 * 60 * 60 * 1000), NOW);
ok("25 hours after the customer wrote, the window is CLOSED", closed.open === false);
ok("…for the reason 'expired'", closed.reason === "expired");
ok("…and reports 0 remaining rather than a negative number", closed.msRemaining === 0);

// THE BOUNDARY — exactly 24 hours, to the millisecond. Meta's rule is "MORE
// than 24 hours have passed", so at exactly 24:00:00.000 it is still open.
const boundary = serviceWindowState(ago(SERVICE_WINDOW_MS), NOW);
ok("at EXACTLY 24 hours the window is still open — Meta's rule is 'more than'", boundary.open === true);
ok("…with zero milliseconds left", boundary.msRemaining === 0);
const justPast = serviceWindowState(new Date(NOW.getTime() - SERVICE_WINDOW_MS - 1), NOW);
ok("one millisecond past 24 hours it is closed", justPast.open === false);

// NEVER OPENED — the customer has never written.
const never = serviceWindowState(null, NOW);
ok("with NO inbound message ever, the window is CLOSED", never.open === false);
ok("…for the reason 'never_opened', not 'expired'", never.reason === "never_opened");
ok("…and closesAt is null, not a made-up date", never.closesAt === null);
ok("an unparseable timestamp is treated as never opened", serviceWindowState("banana", NOW).open === false);

// The refusal, which is what the send path calls.
ok(
  "free text is REFUSED when the window is closed",
  serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: ago(25 * 3600000), now: NOW })?.reason ===
    "service_window_closed",
);
ok(
  "…with a sentence naming the template as the way through",
  /template/i.test(
    serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: ago(25 * 3600000), now: NOW }).message,
  ),
);
ok(
  "free text is refused when nobody ever wrote",
  serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: null, now: NOW })?.reason ===
    "service_window_closed",
);
ok(
  "…and says so differently from an expired window",
  serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: null, now: NOW }).message !==
    serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: ago(25 * 3600000), now: NOW }).message,
);
ok(
  "free text is ALLOWED inside the window",
  serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: ago(3600000), now: NOW }) === null,
);
ok(
  "a TEMPLATE is allowed outside the window — that is what templates are for",
  serviceWindowRefusal({ platform: "whatsapp", lastInboundAt: null, kind: "template", now: NOW }) === null,
);

// The other two platforms have no window of OURS, and must not be silenced.
for (const platform of ["facebook", "instagram"]) {
  ok(
    `${platform} is not refused by the WhatsApp window`,
    serviceWindowRefusal({ platform, lastInboundAt: null, now: NOW }) === null,
  );
  ok(`${platform} reports no service window`, needsServiceWindow(platform) === false);
}
ok("whatsapp reports a service window", needsServiceWindow("whatsapp") === true);

// The notice the screen renders.
const notice = serviceWindowNotice({ platform: "whatsapp", lastInboundAt: ago(25 * 3600000), now: NOW });
ok("a closed window produces a block key", notice.blockKey === "app.messages.window.closed");
ok(
  "a never-opened window produces its OWN key",
  serviceWindowNotice({ platform: "whatsapp", lastInboundAt: null, now: NOW }).blockKey ===
    "app.messages.window.neverOpened",
);
const closingSoon = serviceWindowNotice({
  platform: "whatsapp",
  lastInboundAt: ago(23.5 * 3600000),
  now: NOW,
});
ok("a window with 30 minutes left WARNS but does not block", !closingSoon.blockKey && Boolean(closingSoon.warnKey));
ok(
  "a window with 10 hours left says nothing at all",
  !serviceWindowNotice({ platform: "whatsapp", lastInboundAt: ago(14 * 3600000), now: NOW }).warnKey,
);
ok(
  "hours remaining is rounded DOWN, never up",
  serviceWindowNotice({ platform: "whatsapp", lastInboundAt: ago(22.9 * 3600000), now: NOW }).hours === 1,
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The send path — refusals, by name, before Meta is called");
// ═══════════════════════════════════════════════════════════════════════════

const liveChannel = {
  id: "chan_wa",
  companyId: "company_REAL",
  platform: "whatsapp",
  externalId: "PHONE_1",
  status: "connected",
  disconnectedAt: null,
  accessTokenEnc: "not-a-real-blob",
};

// If any of these reached `fetch` the check would hang or throw on a real
// network call — so a returned refusal is itself proof that nothing was sent.
const noChannel = await sendWhatsAppMessage({
  channel: null,
  recipientExternalId: "15551234567",
  text: "hello",
  lastInboundAt: ago(3600000),
  now: NOW,
});
ok("no channel refuses", !noChannel.ok && noChannel.reason === "channel_not_connected");
ok("…with a real sentence, not a code", noChannel.message.length > 20);

const disconnected = await sendWhatsAppMessage({
  channel: { ...liveChannel, disconnectedAt: new Date() },
  recipientExternalId: "15551234567",
  text: "hello",
  lastInboundAt: ago(3600000),
  now: NOW,
});
ok("a DISCONNECTED channel refuses", disconnected.reason === "channel_disconnected");

const reauth = await sendWhatsAppMessage({
  channel: { ...liveChannel, status: "needs_reauth" },
  recipientExternalId: "15551234567",
  text: "hello",
  lastInboundAt: ago(3600000),
  now: NOW,
});
ok("a channel needing reauth refuses", reauth.reason === "channel_needs_reauth");

// THE one. A live channel, a live recipient, and a closed window.
const outsideWindow = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  text: "Just following up on that quote",
  lastInboundAt: ago(25 * 3600000),
  now: NOW,
});
ok(
  "free text OUTSIDE the window is refused by the send path itself",
  !outsideWindow.ok && outsideWindow.reason === "service_window_closed",
  `got ${outsideWindow.reason}`,
);
ok("…and it never reached Meta", outsideWindow.externalId === undefined);

const neverWrote = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  text: "Hello, are you free Tuesday?",
  lastInboundAt: null,
  now: NOW,
});
ok(
  "free text to somebody who NEVER wrote is refused",
  neverWrote.reason === "service_window_closed",
);

// The private note, refused above everything else — the same contract
// metaSend.js keeps.
const note = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  text: "quoted high, they're shopping around",
  lastInboundAt: ago(3600000),
  private: true,
  direction: "note",
  now: NOW,
});
ok("a PRIVATE NOTE is refused outright", !note.ok && note.reason === "private_note");
const activity = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  text: "status changed",
  lastInboundAt: ago(3600000),
  direction: "activity",
  now: NOW,
});
ok("a SYSTEM LINE is refused outright", !activity.ok);

// The note refusal comes FIRST — before the window, before the channel. A note
// on a closed window must still be refused as a note.
const noteOutside = await sendWhatsAppMessage({
  channel: null,
  recipientExternalId: null,
  text: "internal",
  lastInboundAt: null,
  private: true,
  direction: "note",
  now: NOW,
});
ok(
  "the private-note refusal outranks every other refusal",
  noteOutside.reason === "private_note",
);

// Meta's own verdict, mapped onto the SAME reason the pre-flight uses — so a
// contractor reads one explanation whichever way the refusal arrived.
const metaRefusal = classifyWhatsAppError({
  status: 400,
  body: { error: { code: RE_ENGAGEMENT_ERROR_CODE, message: "Re-engagement message" } },
});
ok(
  "Meta's 131047 maps onto the SAME reason as our own pre-flight check",
  metaRefusal.reason === "service_window_closed",
);
ok(
  "132001 is reported as a template approval problem, not a token one",
  classifyWhatsAppError({ status: 400, body: { error: { code: 132001 } } }).reason ===
    "template_not_approved",
);
ok(
  "131026 is NOT reported as a broken connection",
  classifyWhatsAppError({ status: 400, body: { error: { code: 131026 } } }).reason ===
    "not_a_whatsapp_user",
);

// The dispatcher routes by platform, and refuses a template on a Page thread.
const pageTemplate = await sendOnChannel({
  channel: { ...liveChannel, platform: "facebook" },
  recipientExternalId: "PSID_1",
  kind: "template",
  template: { name: "x", language: "en", status: "APPROVED", body: "hi", variableCount: 0 },
  now: NOW,
});
ok(
  "a template asked for on a Facebook thread is refused by name",
  pageTemplate.reason === "template_unsupported",
);
const routedWhatsApp = await sendOnChannel({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  text: "hello",
  lastInboundAt: null,
  now: NOW,
});
ok(
  "the dispatcher routes a whatsapp channel to the WhatsApp send",
  routedWhatsApp.reason === "service_window_closed",
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Templates — what may be sent once the window has closed");
// ═══════════════════════════════════════════════════════════════════════════

const approved = {
  id: "tpl_1",
  name: "quote_follow_up",
  language: "en_US",
  status: "APPROVED",
  category: "UTILITY",
  body: "Hi {{1}}, your quote for {{2}} is ready. Any questions, {{1}}?",
  variableCount: 2,
};

ok("repeated placeholders count ONCE", countTemplateVariables(approved.body) === 2);
ok("a body with no placeholders needs none", countTemplateVariables("Thanks for getting in touch.") === 0);
ok("an APPROVED template is sendable", isSendableTemplate(approved));
ok("a PENDING template is NOT sendable", !isSendableTemplate({ ...approved, status: "PENDING" }));
ok("a REJECTED template is NOT sendable", !isSendableTemplate({ ...approved, status: "REJECTED" }));

ok(
  "an unknown template is refused",
  templateRefusal({ template: null, params: [] })?.reason === "template_unknown",
);
ok(
  "an unapproved template is refused, and the status is named",
  /pending/i.test(templateRefusal({ template: { ...approved, status: "PENDING" }, params: ["a", "b"] }).message),
);
ok(
  "too few parameters is refused BEFORE Meta answers 132000",
  templateRefusal({ template: approved, params: ["Dana"] })?.reason === "template_params",
);
ok(
  "too many parameters is refused too",
  templateRefusal({ template: approved, params: ["a", "b", "c"] })?.reason === "template_params",
);
ok("the right number is allowed", templateRefusal({ template: approved, params: ["Dana", "the kitchen"] }) === null);

const payload = templatePayload({ template: approved, params: ["Dana", "the kitchen"] });
ok("the payload names the template", payload.name === "quote_follow_up");
ok("the payload carries Meta's language shape", payload.language?.code === "en_US");
ok("the payload's parameters are typed text", payload.components?.[0]?.parameters?.[0]?.type === "text");
ok(
  "a zero-variable template sends NO components array",
  templatePayload({ template: { ...approved, body: "Thanks!", variableCount: 0 }, params: [] })
    .components === undefined,
);

// Meta's own response shape, normalised.
const fromMeta = normaliseTemplate({
  name: "appointment_reminder",
  language: "fr",
  status: "APPROVED",
  category: "UTILITY",
  components: [
    { type: "HEADER", format: "TEXT", text: "Rappel" },
    { type: "BODY", text: "Bonjour {{1}}, nous passons {{2}}." },
    { type: "FOOTER", text: "FieldQuo" },
  ],
});
ok("Meta's BODY component is what becomes the body", fromMeta.body.startsWith("Bonjour"));
ok("…and its variables are counted", fromMeta.variableCount === 2);
ok(
  "a template with no BODY component is dropped, not stored half-formed",
  normaliseTemplate({ name: "x", language: "en", components: [{ type: "HEADER", text: "hi" }] }) === null,
);
ok(
  "an unrecognised status is kept verbatim and is NOT sendable",
  isSendableTemplate(
    normaliseTemplate({ name: "x", language: "en", status: "SOMETHING_NEW", components: [{ type: "BODY", text: "hi" }] }),
  ) === false,
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. The AI employee will not send outside the window");
// ═══════════════════════════════════════════════════════════════════════════

// Every OTHER guard satisfied, so the only thing that can stop it is the one
// being asserted.
const employee = {
  id: "emp_1",
  enabled: true,
  autoReplyEnabled: true,
  maxRepliesPerThread: 5,
  businessHoursOnly: false,
};
const baseVerdict = {
  employee,
  businessHoursOpen: true,
  thread: { status: "open" },
  message: { direction: "in", body: "Are you free Tuesday?" },
  quota: { allowed: true },
  aiConfigured: true,
  humanReplied: false,
  handedOff: false,
  repliesSoFar: 0,
};

ok("with the window OPEN the employee replies", shouldReply({ ...baseVerdict, serviceWindowOpen: true }).reply === true);
const refused = shouldReply({ ...baseVerdict, serviceWindowOpen: false });
ok("with the window CLOSED the employee does NOT reply", refused.reply === false);
ok("…for the named reason", refused.reason === SKIP.OUTSIDE_SERVICE_WINDOW);
ok(
  "a thread with NO window computed (Facebook, Instagram) is not silenced",
  shouldReply({ ...baseVerdict }).reply === true &&
    shouldReply({ ...baseVerdict, serviceWindowOpen: null }).reply === true,
);
// The order matters: an out-of-credit company must hear about the BILL, not
// about a WhatsApp rule it cannot act on.
ok(
  "no credit outranks a closed window",
  shouldReply({ ...baseVerdict, serviceWindowOpen: false, quota: { allowed: false } }).reason ===
    SKIP.NO_CREDIT,
);

const respondSrc = read("lib/aiEmployee/respond.js");
ok(
  "respond.js computes the window from the thread it read",
  /serviceWindowOpen:/.test(respondSrc) && /serviceWindowState\(/.test(respondSrc),
);
ok(
  "respond.js reads lastInboundAt with the thread",
  /lastInboundAt: true/.test(respondSrc),
);
const inboundSrc = read("lib/aiEmployee/inbound.js");
ok(
  "the employee's send goes through the ONE dispatcher",
  /sendOnChannel/.test(inboundSrc) && !/sendMetaMessage|sendWhatsAppMessage/.test(inboundSrc),
);
ok(
  "…and passes lastInboundAt so the second guard can fire",
  /lastInboundAt: thread\.lastInboundAt/.test(inboundSrc),
);
ok(
  "the employee never sends a template on its own",
  /kind: "text"/.test(inboundSrc) && !/kind: "template"/.test(inboundSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Three platforms, no special-casing");
// ═══════════════════════════════════════════════════════════════════════════

ok("the platform set is the three", MESSAGING_PLATFORMS.join(",") === "facebook,instagram,whatsapp");
ok("the set is frozen", Object.isFrozen(MESSAGING_PLATFORMS));
ok("an unknown platform is refused", !isMessagingPlatform("telegram") && !isMessagingPlatform(null));

// The map that used to exist twice.
for (const platform of MESSAGING_PLATFORMS) {
  ok(
    `${platform} has a conversation source, and it is one CONVERSATION_SOURCES knows`,
    CONVERSATION_SOURCES.includes(SOURCE_FOR_PLATFORM[platform]),
    `${SOURCE_FOR_PLATFORM[platform]} is not in the list`,
  );
}
ok("whatsapp maps to meta_whatsapp", sourceForPlatform("whatsapp") === "meta_whatsapp");
ok("an unknown platform maps to the caller's fallback", sourceForPlatform("nope", "ai_employee") === "ai_employee");
ok("…and to null when the caller gives none", sourceForPlatform("nope") === null);

// The two former copies now import the one map.
const attributionSrc = read("lib/attribution/loadMonthlyConversations.js");
ok(
  "the attribution loader imports the shared map rather than declaring its own",
  /sourceForPlatform/.test(attributionSrc) && !/const SOURCE_FOR_PLATFORM = \{/.test(attributionSrc),
);
ok(
  "respond.js imports it too",
  /sourceForPlatform/.test(respondSrc) && !/case "instagram":/.test(respondSrc),
);

// The badge. lucide ships no brand marks, so this must be inline SVG in the
// one glyph module — a `Whatsapp` import is a build failure.
const iconSrc = read("app/components/links/linkIcons.js");
ok("there is a whatsapp glyph in the shared icon module", /^\s+whatsapp:/m.test(iconSrc));
ok(
  "…and it is not imported from lucide, which has no brand marks",
  !/\bWhatsapp\b|\bWhatsApp\b/.test(iconSrc.slice(0, iconSrc.indexOf("} from \"lucide-react\""))),
);
const bitsSrc = read("app/app/messages/ConversationBits.js");
ok(
  "the platform badge renders whichever platform it is given — no branch",
  /SocialGlyph platform=\{platform\}/.test(bitsSrc) && !/platform === "whatsapp"/.test(bitsSrc),
);
ok(
  "the badge's label key is derived from the platform, not switched on",
  /"app\.messages\.platform\." \+ platform/.test(bitsSrc),
);

// The list and the thread both carry the platform through unchanged.
const listSrc = read("app/api/messaging/threads/route.js");
ok(
  "the thread list does not filter to two platforms",
  !/platform: \{ in: \[/.test(listSrc) && !/platform: "facebook"/.test(listSrc),
);
ok(
  "the thread list computes the window server-side",
  /serviceWindowNotice/.test(listSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. No fake threads for a real company");
// ═══════════════════════════════════════════════════════════════════════════

const channelsSrc = read("lib/messaging/channels.js");
ok(
  "the mock is decided from Company.isDemo read from the database",
  /company\?\.isDemo/.test(channelsSrc) && /findUnique\(\{ where: \{ id: companyId \}/.test(channelsSrc),
);
ok(
  "a WhatsApp connect refuses an unknown platform rather than storing it",
  /isMessagingPlatform\(platform\)/.test(channelsSrc),
);
const statusSrc = read("app/api/settings/whatsapp/status/route.js");
ok(
  "the settings status never invents a channel",
  !/demo|sample|placeholder/i.test(statusSrc.replace(/\/\/[^\n]*/g, "")),
);
ok(
  "the settings status filters to WhatsApp channels only",
  /platform === "whatsapp"/.test(statusSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("10. Honest gating — the flag, the refusal, and the consent screen");
// ═══════════════════════════════════════════════════════════════════════════

// The ads consent screen must be BYTE FOR BYTE what it was.
const savedEnv = {
  approved: process.env.META_MESSAGING_APPROVED,
  leads: process.env.META_LEADS_ENABLED,
  whatsapp: process.env.META_WHATSAPP_ENABLED,
  mode: process.env.META_APP_MODE,
};
delete process.env.META_MESSAGING_APPROVED;
delete process.env.META_LEADS_ENABLED;
process.env.META_WHATSAPP_ENABLED = "1";
delete process.env.META_APP_MODE;
ok(
  "turning WhatsApp ON does NOT widen the Meta Ads consent screen",
  metaRequestedScope() === META_OAUTH_SCOPE,
  `got "${metaRequestedScope()}"`,
);
for (const [k, v] of Object.entries({
  META_MESSAGING_APPROVED: savedEnv.approved,
  META_LEADS_ENABLED: savedEnv.leads,
  META_WHATSAPP_ENABLED: savedEnv.whatsapp,
  META_APP_MODE: savedEnv.mode,
})) {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

ok(
  "the WhatsApp scope asks for messaging and management, and nothing else",
  META_WHATSAPP_SCOPE === "whatsapp_business_messaging,whatsapp_business_management",
);
ok(
  "business_management is NOT requested",
  !META_WHATSAPP_SCOPE.includes("business_management,") &&
    !/(^|,)business_management(,|$)/.test(META_WHATSAPP_SCOPE),
);

const connectSrc = read("app/api/settings/whatsapp/connect/route.js");
ok(
  "the connect route refuses SERVER-SIDE when the flag is off",
  /metaWhatsAppEnabled\(\)/.test(connectSrc) && /awaiting_review/.test(connectSrc),
);
const callbackSrc = read("app/api/settings/whatsapp/callback/route.js");
ok(
  "the callback re-checks the flag rather than trusting /connect",
  /metaWhatsAppEnabled\(\)/.test(callbackSrc),
);
ok(
  "the callback FAILS the connect when the webhook subscription fails",
  /subscribeAppToWaba[\s\S]{0,300}no_webhook/.test(callbackSrc),
);
ok(
  "the callback verifies the OAuth state against a cookie",
  /cookieState !== state/.test(callbackSrc),
);

const panelSrc = read("app/components/settings/WhatsAppPanel.js");
ok(
  "the panel says what is blocked when the flag is off",
  /!status\.connectEnabled/.test(panelSrc) && /awaitingTitle/.test(panelSrc),
);
ok(
  "…and `canConnect` is derived from the flag, not from the channel list",
  /canConnect = Boolean\(\s*status\?\.connectEnabled/.test(panelSrc),
);
ok(
  "…so the ONE connect link is inside the canConnect block and nowhere else",
  (panelSrc.match(/href="\/api\/settings\/whatsapp\/connect"/g) || []).length === 1 &&
    panelSrc.indexOf("canConnect && channels.length === 0") > 0 &&
    panelSrc.indexOf("canConnect && channels.length === 0") <
      panelSrc.indexOf('href="/api/settings/whatsapp/connect"'),
);
ok(
  "the panel explains the 24-hour rule where a contractor connects",
  /windowTitle/.test(panelSrc) && /windowBody/.test(panelSrc),
);

// The registry.
const feature = FEATURES.find((f) => f.key === "whatsapp_messaging");
ok("the feature is in the registry", Boolean(feature));
ok("…and is labelled preview, not on", feature?.defaultState === "preview");
ok(
  "…and claims both the webhook and the connect flow",
  feature?.apiPrefixes.includes("/api/meta/whatsapp") &&
    feature?.apiPrefixes.includes("/api/settings/whatsapp"),
);
const exempt = feature?.apiExempt?.find((x) => x.path === "/api/meta/whatsapp/webhook");
ok("…and declares the webhook exempt with a named guard", Boolean(exempt?.guard));
ok(
  "…whose guard names the signature AND the tenant rule",
  /X-Hub-Signature-256/.test(exempt?.guard || "") && /phone number id/i.test(exempt?.guard || ""),
);

// Marketing must not sell it.
const exclusion = MATRIX_EXCLUSIONS.find((x) => x.registryKey === "whatsapp_messaging");
ok("marketing excludes it with a written reason", Boolean(exclusion));
ok(
  "…and the reason names BOTH honest limits: the approval and the 24-hour rule",
  /whatsapp_business_messaging/.test(exclusion?.reason || "") &&
    /24 hours/.test(exclusion?.reason || ""),
);

// The env vars are documented.
const vercelDoc = read("docs/VERCEL.md");
for (const v of ["META_WHATSAPP_ENABLED", "META_WHATSAPP_CONFIG_ID"]) {
  ok(`${v} is documented in docs/VERCEL.md`, vercelDoc.includes(v));
}


// ═══════════════════════════════════════════════════════════════════════════
section("11. PICTURES — the id in, the bytes out of band, the bubble honest");
// ═══════════════════════════════════════════════════════════════════════════
//
// The gap this closes was a real one: a homeowner sent a photo of their
// kitchen and the contractor read the words "1 attachment". Everything below
// is executed rather than read, because every claim here has a version that
// passes a regex while being broken — a webhook that "does not fetch" but
// does, a `url` column that holds a Graph link that renders today and expires
// next week, a Retry button with nothing behind it.

// ── A. The webhook still fetches NOTHING ───────────────────────────────────
//
// Proved with a spy in place of global fetch, not by reading the route: a
// byte-fetching ingest is exactly what would make Meta's retry clock depend on
// Cloudinary and eventually disable the subscription.
const MEDIA_BODY = inboundBody({
  messages: [
    {
      from: "15551234567",
      id: "wamid.PHOTO",
      timestamp: "1757000000",
      type: "image",
      image: { id: "MEDIA_1", mime_type: "image/jpeg", caption: "the old units" },
    },
  ],
});

const realFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async (...args) => {
  networkCalls++;
  throw new Error(`the webhook path must not reach the network (${args[0]})`);
};
seedChannel();
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(MEDIA_BODY)).events);
globalThis.fetch = realFetch;

ok("ingesting a photo message makes NO network call at all", networkCalls === 0, `${networkCalls} call(s)`);
ok("…and the message row is still stored", rows.message.length === 1);

const storedRow = rows.message[0];
ok(
  "the stored attachment carries Meta's media id",
  storedRow.attachments?.[0]?.mediaId === "MEDIA_1",
);
ok(
  "…and NO url, because the webhook has no bytes and must not invent a link",
  storedRow.attachments?.[0]?.url === null,
);
ok(
  "Message.mediaPending is written TRUE, so the fetcher has something to find",
  storedRow.mediaPending === true,
);

// A text-only message must not be left flagged, or the cron spins forever on a
// row it can never change.
seedChannel();
await ingestEvents(parseWhatsAppEnvelope(JSON.parse(BODY)).events);
ok("a text-only message is NOT flagged as pending media", rows.message[0].mediaPending === false);

// ── B. What the browser is handed while it is still arriving ───────────────
const pendingPublic = publicAttachments(storedRow.attachments);
ok("a media id with no url renders as PENDING", pendingPublic[0]?.state === "pending");
ok("…with a null url, so nothing can render a broken image", pendingPublic[0]?.url === null);
ok("…and no Retry offered for work still in progress", pendingPublic[0]?.retryable === false);
ok(
  "…and Meta's own media id never reaches the browser",
  !("mediaId" in pendingPublic[0]) && !("sourceUrl" in pendingPublic[0]),
);

// The renderer draws an <img> ONLY for a ready image. Positional, so deleting
// the state test fails rather than passes.
const bits = read("app/app/messages/ConversationBits.js");
ok(
  "the bubble no longer renders a COUNT of attachments",
  !/app\.messages\.attachment"/.test(bits),
);
ok(
  "an <img> is drawn only inside the ready-image branch",
  orderedInSource(bits, 'attachment.state === "ready" && attachment.type === "image"', "<img"),
);
ok(
  "…and the pending branch exists above the failed one, both before unavailable",
  orderedInSource(bits, 'attachment.state === "pending"', 'attachment.state === "failed"'),
);
ok("a failed attachment offers a retry", /media\.retry"/.test(bits) && /onRetry\?\.\(/.test(bits));
ok(
  "the renderer never branches on the platform",
  !/facebook|instagram|whatsapp/i.test(
    bits.slice(bits.indexOf("export function Attachments"), bits.indexOf("\n/**\n * The attach control")),
  ),
);

// ── C. The re-host, executed end to end ────────────────────────────────────
//
// A real encryption key so the token path is exercised rather than skipped.
const ORIGINAL_KEY = process.env.META_TOKEN_ENCRYPTION_KEY;
process.env.META_TOKEN_ENCRYPTION_KEY = "0".repeat(64);
const mediaChannel = {
  id: "chan_wa",
  companyId: "company_REAL",
  platform: "whatsapp",
  externalId: "PHONE_1",
  status: "connected",
  disconnectedAt: null,
  accessTokenEnc: encryptToken("EAAG-a-real-looking-token"),
};

const SIGNED = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=MEDIA_1&ext=1&hash=x";
const CLOUD = "https://res.cloudinary.com/demo/image/upload/v1/messaging/company_REAL/abc.jpg";

/** A scripted Graph: the resolve, then the download. */
function scriptedFetch({ resolveBody = { url: SIGNED, mime_type: "image/jpeg", file_size: 1024 }, resolveOk = true, bytes = Buffer.from("JPEGDATA"), downloadOk = true, seen = [] } = {}) {
  return async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization || null });
    if (String(url).startsWith("https://graph.facebook.com/")) {
      return { ok: resolveOk, status: resolveOk ? 200 : 400, json: async () => resolveBody, headers: new Headers() };
    }
    return {
      ok: downloadOk,
      status: downloadOk ? 200 : 404,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bytes.length) }),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      json: async () => ({}),
    };
  };
}

const seen = [];
const happy = await rehostAttachment({
  attachment: normaliseAttachment(storedRow.attachments[0], 0),
  channel: mediaChannel,
  companyId: "company_REAL",
  fetchImpl: scriptedFetch({ seen }),
  uploadImpl: async () => ({ secure_url: CLOUD }),
});
ok("a successful fetch hands back a Cloudinary url", happy.url === CLOUD, JSON.stringify(happy));
ok("…after TWO calls: the resolve, then the download", seen.length === 2, `${seen.length}`);
ok("…the resolve carried the bearer token", /^Bearer /.test(seen[0]?.auth || ""));
ok("…and the download carried it too, to Meta's own host", /^Bearer /.test(seen[1]?.auth || ""));

const settled = withFetchResult(storedRow.attachments, 0, happy);
const settledPublic = publicAttachments(settled);
ok("the stored entry becomes READY", settledPublic[0]?.state === "ready");
ok("…holding Cloudinary's url", settledPublic[0]?.url === CLOUD);
ok("…and nothing is left pending on the row", hasFetchableMedia(settled) === false);
ok(
  "…and the expiring Meta link is dropped in the same write",
  normaliseAttachments(settled)[0].sourceUrl === null,
);

// ── D. THE INVARIANT: `url` is Cloudinary's, never a raw Graph URL ─────────
//
// This is the bug CrewInboundMessage.mediaUrls' comment warns about, aimed at
// this feature. An uploader that hands back Meta's own link must NOT be able
// to get that link into the column the bubble renders.
ok("a Cloudinary url is durable", isDurableMediaUrl(CLOUD));
for (const hostile of [
  SIGNED,
  "https://scontent.xx.fbcdn.net/v/t1/photo.jpg",
  "https://graph.facebook.com/v23.0/MEDIA_1",
  "http://res.cloudinary.com/demo/image/upload/a.jpg",
  "https://res.cloudinary.com.evil.com/a.jpg",
  "https://evil.com/res.cloudinary.com/a.jpg",
  "https://res.cloudinary.com@evil.com/a.jpg",
]) {
  ok(`a raw ${new URL(hostile).hostname} url is NOT durable`, isDurableMediaUrl(hostile) === false);
}
const poisoned = withFetchResult(storedRow.attachments, 0, { url: SIGNED });
ok(
  "an upload that returns META's url does not make the entry ready",
  normaliseAttachments(poisoned)[0].state !== "ready",
);
ok("…and nothing lands in `url`", normaliseAttachments(poisoned)[0].url === null);

// A row written by an older build, with Messenger's expiring CDN link sitting
// in `url`. It must be re-read as something to FETCH, never rendered.
const legacy = normaliseAttachment({ type: "image", url: "https://scontent.xx.fbcdn.net/v/t1/photo.jpg" }, 0);
ok("a legacy row holding a raw Meta url reads as PENDING", legacy.state === "pending");
ok("…with url null and the link moved to sourceUrl", legacy.url === null && Boolean(legacy.sourceUrl));

// ── E. The host allowlist is a credential check ────────────────────────────
ok("lookaside is a Meta media host", isMetaMediaUrl(SIGNED));
ok("fbcdn is", isMetaMediaUrl("https://scontent-lhr8-1.xx.fbcdn.net/v/x.jpg"));
ok("cdninstagram is", isMetaMediaUrl("https://scontent.cdninstagram.com/v/x.jpg"));
for (const bad of [
  "https://evil.com/x.jpg",
  "https://fbcdn.net.evil.com/x.jpg",
  "https://evilfbcdn.net/x.jpg",
  "http://lookaside.fbsbx.com/x.jpg",
  "https://lookaside.fbsbx.com@evil.com/x.jpg",
  "https://169.254.169.254/latest/meta-data/",
]) {
  ok(`the token is never sent to ${bad.slice(0, 40)}`, isMetaMediaUrl(bad) === false);
}

const offHost = await resolveWhatsAppMediaUrl({
  channel: mediaChannel,
  mediaId: "MEDIA_1",
  fetchImpl: scriptedFetch({ resolveBody: { url: "https://evil.com/x.jpg" } }),
});
ok("a resolve naming a NON-Meta host is refused", offHost.ok === false);

const oversized = await rehostAttachment({
  attachment: normaliseAttachment(storedRow.attachments[0], 0),
  channel: mediaChannel,
  companyId: "company_REAL",
  fetchImpl: scriptedFetch({ resolveBody: { url: SIGNED, mime_type: "image/jpeg", file_size: WHATSAPP_MEDIA_LIMITS.image.maxBytes + 1 } }),
  uploadImpl: async () => { throw new Error("must not upload an oversized file"); },
});
ok("a file one byte over WhatsApp's own image limit is refused before download", Boolean(oversized.error));

// ── F. A failed fetch is its own state, and it has a way back ──────────────
const failedOnce = withFetchResult(storedRow.attachments, 0, { error: "WhatsApp would not hand over this file: media not found" });
const failedPublic = publicAttachments(failedOnce);
ok("a failed fetch reads as FAILED, not as absent", failedPublic[0]?.state === "failed");
ok("…keeping Meta's own words", /media not found/.test(failedPublic[0]?.error || ""));
ok("…offering a retry", failedPublic[0]?.retryable === true);
ok("…and the cron will pick it up again", isFetchable(normaliseAttachments(failedOnce)[0]));

let spent = storedRow.attachments;
for (let i = 0; i < MEDIA_FETCH_MAX_ATTEMPTS; i++) spent = withFetchResult(spent, 0, { error: "nope" });
ok(
  `the cron stops on its own after ${MEDIA_FETCH_MAX_ATTEMPTS} attempts`,
  hasFetchableMedia(spent) === false,
);
ok("…but the bubble still says so, and still offers Retry", publicAttachments(spent)[0].retryable === true);
ok("…and a person pressing it makes the row fetchable again", hasFetchableMedia(withFetchReset(spent, 0)) === true);

process.env.META_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;

// ── G. Outbound: Meta's real limits, at the boundary and one byte over ─────
//
// developers.facebook.com/docs/whatsapp/cloud-api/reference/media, read
// 2026-09-08: image 5 MB, video 16 MB, audio 16 MB, document 100 MB,
// sticker 100 KB static / 500 KB animated.
ok("the image ceiling is Meta's 5 MB", WHATSAPP_MEDIA_LIMITS.image.maxBytes === 5 * 1024 * 1024);
ok("the video ceiling is Meta's 16 MB", WHATSAPP_MEDIA_LIMITS.video.maxBytes === 16 * 1024 * 1024);
ok("the audio ceiling is Meta's 16 MB", WHATSAPP_MEDIA_LIMITS.audio.maxBytes === 16 * 1024 * 1024);
ok("the document ceiling is Meta's 100 MB", WHATSAPP_MEDIA_LIMITS.document.maxBytes === 100 * 1024 * 1024);
ok("the sticker ceiling is Meta's animated 500 KB", WHATSAPP_MEDIA_LIMITS.sticker.maxBytes === 500 * 1024);

for (const [kind, mime] of [["image", "image/jpeg"], ["video", "video/mp4"], ["document", "application/pdf"]]) {
  const cap = WHATSAPP_MEDIA_LIMITS[kind].maxBytes;
  const atLimit = classifyWhatsAppOutboundMedia({ type: mime, size: cap });
  ok(`a ${kind} EXACTLY at ${WHATSAPP_MEDIA_LIMITS[kind].label} is accepted`, atLimit.ok === true, JSON.stringify(atLimit));
  const overBy1 = classifyWhatsAppOutboundMedia({ type: mime, size: cap + 1 });
  ok(`a ${kind} ONE BYTE over is refused`, overBy1.ok === false && overBy1.reason === "media_too_large");
  ok(
    `…and the refusal names the real limit (${WHATSAPP_MEDIA_LIMITS[kind].label})`,
    String(overBy1.message).includes(WHATSAPP_MEDIA_LIMITS[kind].label),
    overBy1.message,
  );
}

const mov = classifyWhatsAppOutboundMedia({ type: "video/quicktime", size: 1024 });
ok("a .mov is refused — WhatsApp takes MP4 and 3GP", mov.ok === false && mov.reason === "media_type_unsupported");
ok("…and the refusal names MP4, so there is a next step", /MP4/i.test(mov.message));
const heic = classifyWhatsAppOutboundMedia({ type: "image/heic", size: 9 * 1024 * 1024 });
ok("a 9 MB iPhone HEIC is accepted, to be converted", heic.ok === true && heic.convert === true);
ok(
  "…and a HEIC beyond what conversion can rescue is still refused, naming 5 MB",
  (() => {
    const r = classifyWhatsAppOutboundMedia({ type: "image/heic", size: 40 * 1024 * 1024 });
    return r.ok === false && String(r.message).includes("5 MB");
  })(),
);
ok("an empty file is refused", classifyWhatsAppOutboundMedia({ type: "image/jpeg", size: 0 }).ok === false);
ok("a typeless file is refused", classifyWhatsAppOutboundMedia({ size: 100 }).ok === false);
ok(
  "the file picker offers exactly what the send takes — no .mov, no SVG",
  !/quicktime|svg/i.test(WHATSAPP_MEDIA_ACCEPT) && WHATSAPP_MEDIA_ACCEPT.includes("image/heic"),
);
ok("stickers are inbound-only — nothing offers to send one", !OUTBOUND_TYPES.includes("sticker"));

// The payload Meta documents: the caption rides ON the media object.
const mediaPayload = whatsAppMediaPayload({ type: "image", mediaId: "MEDIA_OUT", caption: "here's the room" });
ok("a media send names the type and the uploaded id", mediaPayload.type === "image" && mediaPayload.image.id === "MEDIA_OUT");
ok("…with the caption on the media object, not as a second message", mediaPayload.image.caption === "here's the room");
const docPayload = whatsAppMediaPayload({ type: "document", mediaId: "D1", filename: "kitchen-plan.pdf" });
ok("a document carries its filename, so it isn't saved as a mystery file", docPayload.document.filename === "kitchen-plan.pdf");

// ── G2. The upload the browser NAMES is resolved, never trusted ───────────
//
// The client sends a URL and a public_id; the server fetches the bytes. Both
// are proved to be THIS company's own Cloudinary folder first — a URL on any
// other host is a server-side request forgery, and one in another tenant's
// folder would pull their customer's photo into this conversation.
const OURS = "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/companies/company_REAL/kitchen.jpg";
const bodyFor = (type, buf) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "content-type": type }),
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  json: async () => ({}),
});

const strangerHost = await prepareOutboundMedia({
  url: "https://evil.example.com/fieldquo/companies/company_REAL/x.jpg",
  publicId: "fieldquo/companies/company_REAL/x",
  companyId: "company_REAL",
  fetchImpl: async () => { throw new Error("must not fetch off Cloudinary"); },
});
ok("an upload url on another host is refused", strangerHost.ok === false && strangerHost.reason === "media_not_found");

const otherTenant = await prepareOutboundMedia({
  url: "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/companies/company_OTHER/x.jpg",
  publicId: "fieldquo/companies/company_OTHER/x",
  companyId: "company_REAL",
  fetchImpl: async () => { throw new Error("must not fetch another tenant's file"); },
});
ok("an upload in ANOTHER company's folder is refused", otherTenant.ok === false);

const mine = await prepareOutboundMedia({
  url: OURS,
  publicId: "fieldquo/companies/company_REAL/kitchen",
  companyId: "company_REAL",
  filename: "kitchen.jpg",
  fetchImpl: async () => bodyFor("image/jpeg", Buffer.from("JPEG")),
});
ok("this company's own JPEG is prepared for sending", mine.ok === true && mine.type === "image", JSON.stringify(mine));

// HEIC: the SECOND fetch is Cloudinary's JPEG variant, and the 5 MB rule is
// applied to those bytes — the only ones Meta will ever see.
const fetchedUrls = [];
const heicPrepared = await prepareOutboundMedia({
  url: OURS,
  publicId: "fieldquo/companies/company_REAL/kitchen",
  companyId: "company_REAL",
  fetchImpl: async (u) => {
    fetchedUrls.push(String(u));
    return String(u).includes("f_jpg")
      ? bodyFor("image/jpeg", Buffer.alloc(2 * 1024 * 1024))
      : bodyFor("image/heic", Buffer.alloc(9 * 1024 * 1024));
  },
});
ok("a 9 MB HEIC is converted rather than refused", heicPrepared.ok === true && heicPrepared.mimeType === "image/jpeg");
ok("…by asking Cloudinary for an explicit JPEG, not f_auto", fetchedUrls[1] === jpegVariantUrl(OURS) && /f_jpg/.test(fetchedUrls[1]));
ok("…and the 5 MB rule is applied to the CONVERTED bytes", heicPrepared.buffer.length <= WHATSAPP_MEDIA_LIMITS.image.maxBytes);

const stillTooBig = await prepareOutboundMedia({
  url: OURS,
  publicId: "fieldquo/companies/company_REAL/kitchen",
  companyId: "company_REAL",
  fetchImpl: async (u) =>
    String(u).includes("f_jpg")
      ? bodyFor("image/jpeg", Buffer.alloc(WHATSAPP_MEDIA_LIMITS.image.maxBytes + 1))
      : bodyFor("image/heic", Buffer.alloc(20 * 1024 * 1024)),
});
ok(
  "a converted picture still one byte over is refused, naming Meta's 5 MB",
  stillTooBig.ok === false && String(stillTooBig.message).includes("5 MB"),
);

// ── H. A photo obeys the window, by the SAME name as a typed reply ─────────
const mediaOutside = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  kind: "media",
  media: { type: "image", mimeType: "image/jpeg", buffer: Buffer.from("x"), filename: "a.jpg" },
  lastInboundAt: ago(25 * 3600000),
  now: NOW,
});
ok(
  "media outside the 24-hour window is refused",
  mediaOutside.ok === false && mediaOutside.reason === "service_window_closed",
  `got ${mediaOutside.reason}`,
);
ok(
  "…with the SAME named reason a typed reply gets, not a second one",
  mediaOutside.reason === outsideWindow.reason,
);
ok("…and it never reached Meta, so no upload was wasted", mediaOutside.externalId === undefined);

const mediaNeverWrote = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  kind: "media",
  media: { type: "image", mimeType: "image/jpeg", buffer: Buffer.from("x") },
  lastInboundAt: null,
  now: NOW,
});
ok("a photo to somebody who never wrote is refused too", mediaNeverWrote.reason === "service_window_closed");

const mediaNote = await sendWhatsAppMessage({
  channel: liveChannel,
  recipientExternalId: "15551234567",
  kind: "media",
  media: { type: "image", mimeType: "image/jpeg", buffer: Buffer.from("x") },
  lastInboundAt: ago(3600000),
  private: true,
  direction: "note",
  now: NOW,
});
ok("a photo on a PRIVATE NOTE is refused outright", mediaNote.reason === "private_note");

const mediaOnPage = await sendOnChannel({
  channel: { ...liveChannel, platform: "facebook" },
  recipientExternalId: "PSID",
  kind: "media",
  media: { type: "image", mimeType: "image/jpeg", buffer: Buffer.from("x") },
  now: NOW,
});
ok(
  "media on a Facebook thread is refused BY NAME, never downgraded to text",
  mediaOnPage.ok === false && mediaOnPage.reason === "media_unsupported",
);

// ── I. The AI employee never sends a picture ───────────────────────────────
const aiInbound = read("lib/aiEmployee/inbound.js");
ok(
  "lib/aiEmployee/inbound.js never mentions media at all",
  !/media/i.test(aiInbound),
);
ok(
  "…and its send asks for TEXT by name, so a media send cannot be reached by default",
  /kind:\s*"text"/.test(aiInbound.slice(aiInbound.indexOf("sendOnChannel({"))),
);

// ── J. The deferral is a CRON, listed and authenticated ────────────────────
const mediaCron = read("app/api/cron/messaging-media/route.js");
ok("the fetcher is a cron route", /requireCronSecret/.test(mediaCron));
ok("…refusing before it reads anything", orderedInSource(mediaCron, "requireCronSecret(request)", "db.message.findMany"));
ok("…selecting on the indexed flag", /mediaPending:\s*true/.test(mediaCron));
ok("…and writing the flag back from the RESULT, in the same update as the urls", /attachments: result\.attachments, mediaPending: result\.pending/.test(mediaCron));
ok(
  "it is scheduled in vercel.json",
  JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/messaging-media"),
);
ok(
  "…and claimed by the messaging feature",
  FEATURES.find((f) => f.key === "page_messaging")?.cronPaths.includes("/api/cron/messaging-media"),
);
const waWebhook = read("app/api/meta/whatsapp/webhook/route.js");
ok(
  "the webhook itself imports no fetcher",
  !/mediaFetch|rehostAttachment|fetchMessageMedia|cloudinary/i.test(waWebhook),
);

// ═══════════════════════════════════════════════════════════════════════════
section("12. EVERY kind a customer can send — not just the pictures");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner's words were "and videos… and other files so make sure you are
// not limiting it, it's all type of media that is typically exchanged in
// WhatsApp or text." Before this section existed, six of the eight kinds
// WhatsApp carries arrived as a bordered row reading "Attachment", and two of
// them (a dropped pin, a shared contact card) arrived as an EMPTY BUBBLE —
// a message row with no body and no attachment at all.
//
// Every claim below is executed. "The parser handles a location" has a version
// that passes a grep and stores nothing; "a pin renders" has a version that
// throws on a payload with no coordinates and takes the whole conversation
// down with it.

// ── A. The parser, one fixture per kind ────────────────────────────────────
const oneMessage = (message) =>
  parseWhatsAppEnvelope(JSON.parse(inboundBody({ messages: [{ from: "15551234567", id: "wamid.X", timestamp: "1757000000", ...message }] })))
    .events[0];

const videoIn = oneMessage({ type: "video", video: { id: "V1", mime_type: "video/mp4", caption: "the leak" } });
ok("a video carries its media id", videoIn?.attachments?.[0]?.mediaId === "V1");
ok("…and its caption is the message body", videoIn?.body === "the leak");
ok("…and no url, exactly like a photo", videoIn?.attachments?.[0]?.url === null);

// The ONE difference between a voice note and an attached audio file, and it
// is a label difference: both play in the same player.
const voiceIn = oneMessage({ type: "audio", audio: { id: "A1", mime_type: "audio/ogg", voice: true } });
const fileIn = oneMessage({ type: "audio", audio: { id: "A2", mime_type: "audio/mpeg", voice: false } });
ok("a voice note is flagged as one", voiceIn?.attachments?.[0]?.voice === true);
ok("…and an attached audio file is flagged as not one", fileIn?.attachments?.[0]?.voice === false);
ok(
  "a voice note is called a voice message",
  attachmentLabelKey(normaliseAttachment(voiceIn.attachments[0])).key === "app.messages.media.audio",
);
ok(
  "…and an audio FILE is called an audio file, which is the only thing that differs",
  attachmentLabelKey(normaliseAttachment(fileIn.attachments[0])).key === "app.messages.media.audioFile",
);
ok(
  "an older audio row with no flag keeps the generic word rather than asserting either",
  attachmentLabelKey(normaliseAttachment({ type: "audio", mediaId: "A3" })).key === "app.messages.media.audio",
);

const docIn = oneMessage({
  type: "document",
  document: { id: "D1", mime_type: "application/pdf", filename: "kitchen-plan.pdf", caption: "the plan" },
});
ok("a document keeps the REAL filename WhatsApp supplied", docIn?.attachments?.[0]?.filename === "kitchen-plan.pdf");
ok(
  "a document with NO filename is named by what it is, never 'document'",
  documentTypeKey("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") === "app.messages.media.doc.excel",
);
for (const [mime, key] of [
  ["application/pdf", "app.messages.media.doc.pdf"],
  ["text/plain", "app.messages.media.doc.text"],
  ["application/msword", "app.messages.media.doc.word"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "app.messages.media.doc.word"],
  ["application/vnd.ms-powerpoint", "app.messages.media.doc.slides"],
]) {
  ok(`${mime} is named as its own kind of document`, documentTypeKey(mime) === key);
}
ok("an unknown document type falls back to the generic word rather than printing a MIME", documentTypeKey("application/x-nonsense") === null);

const stickerIn = oneMessage({ type: "sticker", sticker: { id: "S1", mime_type: "image/webp", animated: true } });
ok("an animated sticker is carried as one", stickerIn?.attachments?.[0]?.animated === true);
ok("…as a sticker, which the renderer draws as a small image", normaliseAttachment(stickerIn.attachments[0]).type === "sticker");

// ── B. The two kinds that were never a file ────────────────────────────────
const pinIn = oneMessage({
  type: "location",
  location: { latitude: 45.5019, longitude: -73.5674, name: "Back gate", address: "12 King St, Montreal" },
});
const pin = normaliseAttachment(pinIn.attachments[0]);
ok("a dropped pin parses to a location attachment", pin.type === "location");
ok("…that is READY, because nothing was ever going to be fetched", pin.state === "ready", pin.state);
ok("…keeping the coordinates", pin.location.latitude === 45.5019 && pin.location.longitude === -73.5674);
ok("…and the name and address WhatsApp sent", pin.location.name === "Back gate" && pin.location.address === "12 King St, Montreal");
ok("…and offering no Retry, because there is nothing to retry", publicAttachments(pinIn.attachments)[0].retryable === false);
ok("…and the cron never picks it up", isFetchable(pin) === false);
ok("a pin's coordinates DO reach the browser — they are the message", publicAttachments(pinIn.attachments)[0].location.latitude === 45.5019);

const cardIn = oneMessage({
  type: "contacts",
  contacts: [
    {
      name: { formatted_name: "Ana Ruiz", first_name: "Ana", last_name: "Ruiz" },
      org: { company: "Ruiz Plumbing" },
      phones: [{ phone: "+1 514 555 0123", wa_id: "15145550123", type: "MOBILE" }],
      emails: [{ email: "ana@example.com" }],
    },
  ],
});
const card = normaliseAttachment(cardIn.attachments[0]);
ok("a shared contact card parses to a contact attachment", card.type === "contact");
ok("…that is READY", card.state === "ready", card.state);
ok("…with the name out of the vCard", card.contacts[0].name === "Ana Ruiz");
ok("…and the phone number, which is the whole point of receiving one", card.contacts[0].phones[0].phone === "+1 514 555 0123");
ok("…and the organisation", card.contacts[0].org === "Ruiz Plumbing");

// A card assembled only from first/last, which is what a phone's own export
// produces when there is no formatted_name.
const split = normaliseContacts([{ name: { first_name: "Ana", last_name: "Ruiz" }, phones: [{ phone: "5145550123" }] }]);
ok("a card with no formatted_name is still named", split[0].name === "Ana Ruiz");

// ── C. Hostile and missing fields RENDER rather than throw ─────────────────
//
// A conversation must never fail to load over one bad attachment, and both of
// these payloads come from outside.
const hostilePins = [
  { latitude: "not a number", longitude: -73 },
  { latitude: null, longitude: null },
  {},
  { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: 181 },
  "nonsense",
  [],
];
let pinThrew = null;
for (const raw of hostilePins) {
  try {
    const a = normaliseAttachment({ type: "location", location: raw });
    if (a.state !== "unavailable") pinThrew = `state was ${a.state} for ${JSON.stringify(raw)}`;
    if (a.location !== null) pinThrew = `location survived for ${JSON.stringify(raw)}`;
  } catch (err) {
    pinThrew = err.message;
  }
}
ok("a pin with hostile or missing coordinates is a NAMED row, never a throw and never (0, 0)", pinThrew === null, pinThrew || "");
ok("…and null/undefined give nothing at all", normaliseLocation(null) === null && normaliseLocation(undefined) === null);
ok(
  "…and a numeric string pin still parses, because Meta sends strings",
  normaliseLocation({ latitude: "45.5", longitude: "-73.5" })?.latitude === 45.5,
);

const hostileCards = ["nonsense", [], [null], [{}], [{ name: {} }], [{ phones: "no" }], [{ name: { formatted_name: "x".repeat(500) }, phones: [{ phone: "1" }] }]];
let cardThrew = null;
let clamped = null;
for (const raw of hostileCards) {
  try {
    const a = normaliseAttachment({ type: "contact", contacts: raw });
    if (!["ready", "unavailable"].includes(a.state)) cardThrew = `state ${a.state}`;
    if (a.contacts) clamped = a.contacts[0].name.length;
  } catch (err) {
    cardThrew = err.message;
  }
}
ok("a contact card with hostile or missing fields renders rather than throwing", cardThrew === null, cardThrew || "");
ok("…with a name clamped, because it goes straight into a bubble", clamped === 120, String(clamped));
ok(
  "a card with neither a name nor a number is dropped rather than drawn as an empty box",
  normaliseAttachment({ type: "contact", contacts: [{}] }).state === "unavailable",
);

// ── D. Nothing falls through to an empty bubble ────────────────────────────
//
// This is the rule the owner actually asked for, and it is the one most easily
// lost: a message row with no body and no attachment reads as a message we
// lost. Every non-text WhatsApp type must leave EITHER a body or a row.
for (const [type, message] of [
  ["order", { type: "order", order: { catalog_id: "C1", product_items: [] } }],
  ["system", { type: "system", system: { body: "number changed" } }],
  ["unsupported", { type: "unsupported", errors: [{ code: 131051, title: "Unsupported message type" }] }],
  ["request_welcome", { type: "request_welcome" }],
]) {
  const event = oneMessage(message);
  const a = normaliseAttachments(event?.attachments);
  ok(`an inbound "${type}" leaves a NAMED row rather than an empty bubble`, a.length === 1 && a[0].type === "other");
  ok(`…naming what arrived`, a[0].otherKind === type, JSON.stringify(a[0]));
  ok(
    `…and the label says so rather than a bare "Attachment"`,
    attachmentLabelKey(a[0]).key !== "app.messages.media.other",
  );
}
ok(
  "…and an unsupported type gets its own sentence, because there is nothing to retry and nothing anybody did wrong",
  attachmentLabelKey(normaliseAttachments(oneMessage({ type: "unsupported" }).attachments)[0]).key ===
    "app.messages.media.unsupported",
);

const reaction = oneMessage({ type: "reaction", reaction: { message_id: "wamid.AAA", emoji: "👍" } });
ok("a reaction IS its emoji, shown rather than described", reaction?.body === "👍");
ok("…so it needs no attachment row", reaction?.attachments === null);
const unreacted = oneMessage({ type: "reaction", reaction: { message_id: "wamid.AAA", emoji: "" } });
ok("a REMOVED reaction has no emoji, so it gets a named row instead of an empty bubble", normaliseAttachments(unreacted?.attachments)[0]?.otherKind === "reaction");

const idless = oneMessage({ type: "image", image: { mime_type: "image/jpeg" } });
ok(
  "a media message with no id still leaves a row — named, unfetchable, no dead Retry",
  normaliseAttachments(idless?.attachments)[0]?.state === "unavailable",
);

// Every type the renderer can meet has a name, and the renderer has a branch
// for it. The second half is a source assertion because a branch is a source
// fact — but it is POSITIONAL, so deleting one fails rather than passes.
const bitsAll = read("app/app/messages/ConversationBits.js");
for (const type of ATTACHMENT_TYPES) {
  ok(`a ${type} has a label key that exists in English`, Boolean(APP_MESSAGES.en[attachmentTypeKey(type)]));
}
for (const [type, needle] of [
  ["video", '<video'],
  ["audio", '<audio'],
  ["sticker", 'attachment.type === "sticker"'],
  ["location", "<LocationCard"],
  ["contact", "<ContactCard"],
]) {
  ok(`the renderer draws a ${type} rather than counting it`, bitsAll.includes(needle), needle);
}
ok(
  "a document row shows the real filename and a human size",
  orderedInSource(bitsAll, "formatBytes(attachment.bytes)", "{size &&"),
);
ok(
  "a pin offers a way out to a real map",
  bitsAll.includes("app.messages.media.openInMaps") && bitsAll.includes("mapsLinkUrl"),
);
ok(
  "a contact card's numbers are dialable",
  /href=\{`tel:/.test(bitsAll),
);

// ── E. A pending or failed VIDEO behaves exactly like a pending photo ──────
//
// The states are type-blind and must stay that way: a video that fetched
// slowly must say "still arriving", not render an empty player.
for (const type of ["video", "audio", "document", "sticker"]) {
  const pendingEntry = normaliseAttachment({ type, mediaId: "M1" });
  ok(`a ${type} with an id and no url is PENDING, exactly like a photo`, pendingEntry.state === "pending");
  ok(`…with a null url, so nothing renders a broken player`, pendingEntry.url === null);
  ok(`…and no Retry while the work is still in progress`, publicAttachments([{ type, mediaId: "M1" }])[0].retryable === false);

  const failedList = withFetchResult([{ type, mediaId: "M1" }], 0, { error: "WhatsApp would not hand over this file" });
  const failedEntry = publicAttachments(failedList)[0];
  ok(`a failed ${type} reads as FAILED and keeps the reason`, failedEntry.state === "failed" && /would not hand over/.test(failedEntry.error));
  ok(`…and offers a Retry, exactly like a photo`, failedEntry.retryable === true);
  ok(`…and never leaks Meta's handle to the browser`, !("mediaId" in failedEntry) && !("sourceUrl" in failedEntry));
}

// ── F. The `url` invariant holds for EVERY type ────────────────────────────
//
// Feed the re-host an uploader that hands back a GRAPH url — the exact bug
// this whole module is arranged around — and assert that no type ends up
// `ready` and nothing lands in `url`.
process.env.META_TOKEN_ENCRYPTION_KEY = "0".repeat(64);
const poisonUploader = async () => ({ secure_url: "https://graph.facebook.com/v23.0/MEDIA_1" });
for (const type of ["image", "video", "audio", "document", "sticker", "other"]) {
  const entry = { type, sourceUrl: SIGNED };
  const result = await rehostAttachment({
    attachment: normaliseAttachment(entry, 0),
    channel: null,
    companyId: "company_REAL",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream", "content-length": "4" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      json: async () => ({}),
    }),
    uploadImpl: poisonUploader,
  });
  const after = normaliseAttachments(withFetchResult([entry], 0, result))[0];
  ok(`a ${type} re-hosted to a Graph url is NOT ready`, after.state !== "ready", after.state);
  ok(`…and nothing lands in url`, after.url === null);
}

// The success path, for every type, so the invariant is not proved only by its
// failures — and the SIZE comes back measured off the real buffer.
const sizedBytes = Buffer.alloc(2048);
const sized = await rehostAttachment({
  attachment: normaliseAttachment({ type: "document", sourceUrl: SIGNED, filename: "plan.pdf" }, 0),
  channel: null,
  companyId: "company_REAL",
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/pdf", "content-length": String(sizedBytes.length) }),
    arrayBuffer: async () => sizedBytes.buffer.slice(sizedBytes.byteOffset, sizedBytes.byteOffset + sizedBytes.byteLength),
    json: async () => ({}),
  }),
  uploadImpl: async () => ({ secure_url: "https://res.cloudinary.com/demo/raw/upload/v1/messaging/company_REAL/plan.pdf" }),
});
ok("a document that lands carries its measured size", sized.bytes === 2048);
const sizedStored = normaliseAttachments(withFetchResult([{ type: "document", sourceUrl: SIGNED, filename: "plan.pdf" }], 0, sized))[0];
ok("…stored on the row", sizedStored.bytes === 2048);
ok("…and the filename SURVIVED the fetch write", sizedStored.filename === "plan.pdf");
ok("…and reads as a human size", formatBytes(sizedStored.bytes) === "2 KB", String(formatBytes(sizedStored.bytes)));
ok("an unmeasured size prints NOTHING rather than '0 KB'", formatBytes(0) === null && formatBytes(null) === null && formatBytes(-5) === null);

// The field-by-field rebuild in withFetchResult is where a payload silently
// disappears. A pin sitting beside a photo on the same message must survive
// the photo's fetch.
const mixed = [
  { type: "image", mediaId: "M1" },
  { type: "location", location: { latitude: 45.5, longitude: -73.5, name: "Gate" } },
];
const afterMixed = normaliseAttachments(withFetchResult(mixed, 0, { error: "nope" }));
ok("a pin beside a photo survives the photo's fetch attempt", afterMixed[1].location?.latitude === 45.5);
ok("…and survives a Retry reset too", normaliseAttachments(withFetchReset(mixed, 0))[1].location?.name === "Gate");
const voiceKept = normaliseAttachments(withFetchResult([{ type: "audio", mediaId: "A1", voice: false }], 0, { error: "nope" }))[0];
ok("…and the voice flag is not erased by a failed fetch", voiceKept.voice === false);

// ── G. Per-type limits, at the boundary and one byte over, for EVERY type ──
//
// The INBOUND ceiling, executed through the real re-host against Meta's
// reported file_size, for each of the five kinds Meta publishes a number for.
const limitChannel = {
  id: "chan_wa", companyId: "company_REAL", platform: "whatsapp", externalId: "PHONE_1",
  status: "connected", disconnectedAt: null, accessTokenEnc: encryptToken("EAAG-token"),
};
for (const type of ["image", "video", "audio", "document", "sticker"]) {
  const cap = WHATSAPP_MEDIA_LIMITS[type].maxBytes;
  const drive = async (fileSize) =>
    rehostAttachment({
      attachment: normaliseAttachment({ type, mediaId: "M1" }, 0),
      channel: limitChannel,
      companyId: "company_REAL",
      fetchImpl: async (url) =>
        String(url).includes("lookaside")
          ? {
              ok: true, status: 200,
              headers: new Headers({ "content-type": "application/octet-stream", "content-length": "4" }),
              arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
              json: async () => ({}),
            }
          : { ok: true, status: 200, headers: new Headers(), json: async () => ({ url: SIGNED, mime_type: "application/octet-stream", file_size: fileSize }) },
      uploadImpl: async () => ({ secure_url: `https://res.cloudinary.com/demo/image/upload/v1/messaging/company_REAL/${type}.bin` }),
    });
  const atCap = await drive(cap);
  ok(`an inbound ${type} EXACTLY at Meta's ${WHATSAPP_MEDIA_LIMITS[type].label} is fetched`, Boolean(atCap.url), JSON.stringify(atCap));
  const overCap = await drive(cap + 1);
  ok(`an inbound ${type} ONE BYTE over is refused before a byte is downloaded`, /larger than/.test(overCap.error || ""), JSON.stringify(overCap));
}
// And again on the REAL buffer, because Content-Length is a claim rather than
// a measurement — the guard readBody exists for.
const lyingHeader = await rehostAttachment({
  attachment: normaliseAttachment({ type: "sticker", sourceUrl: SIGNED }, 0),
  channel: null,
  companyId: "company_REAL",
  fetchImpl: async () => {
    const big = Buffer.alloc(WHATSAPP_MEDIA_LIMITS.sticker.maxBytes + 1);
    return {
      ok: true, status: 200,
      headers: new Headers({ "content-type": "image/webp", "content-length": "10" }),
      arrayBuffer: async () => big.buffer.slice(big.byteOffset, big.byteOffset + big.byteLength),
      json: async () => ({}),
    };
  },
  uploadImpl: async () => { throw new Error("must not upload an oversized file"); },
});
ok("a lying Content-Length is caught on the real buffer", /larger than/.test(lyingHeader.error || ""), JSON.stringify(lyingHeader));

// ── H. Outbound: the window refuses EVERY kind by the SAME name ────────────
const CLOSED = new Date("2026-09-08T12:00:00Z");
const LONG_AGO = new Date("2026-09-05T12:00:00Z");
const textRefusal = await sendWhatsAppMessage({
  channel: limitChannel, recipientExternalId: "15551234567", text: "hello",
  lastInboundAt: LONG_AGO, now: CLOSED,
});
ok("free text outside the window is refused", textRefusal.reason === "service_window_closed");
for (const [label, extra] of [
  ["a photo", { kind: "media", media: { type: "image", mimeType: "image/jpeg", buffer: Buffer.from("x"), filename: "a.jpg" } }],
  ["a video", { kind: "media", media: { type: "video", mimeType: "video/mp4", buffer: Buffer.from("x"), filename: "a.mp4" } }],
  ["a document", { kind: "media", media: { type: "document", mimeType: "application/pdf", buffer: Buffer.from("x"), filename: "a.pdf" } }],
  ["a location", { kind: "location", location: { latitude: 45.5, longitude: -73.5 } }],
]) {
  const refusal = await sendWhatsAppMessage({
    channel: limitChannel, recipientExternalId: "15551234567", text: "",
    lastInboundAt: LONG_AGO, now: CLOSED, ...extra,
  });
  ok(`${label} outside the window is refused with the IDENTICAL reason as text`, refusal.reason === textRefusal.reason, String(refusal.reason));
  ok(`…and the identical sentence, so one situation reads one way`, refusal.message === textRefusal.message);
  ok(`…and nothing reached Meta, so no upload was wasted`, refusal.externalId === undefined);
}

// ── I. Outbound location: the payload, and the refusals ────────────────────
const locPayload = whatsAppLocationPayload({ latitude: 45.5019, longitude: -73.5674, name: "Northline Cabinets", address: "12 King St" });
ok("a location send names the type", locPayload.type === "location");
ok("…with latitude and longitude, which Meta requires", locPayload.location.latitude === "45.5019" && locPayload.location.longitude === "-73.5674");
ok("…and the optional name and address when there are any", locPayload.location.name === "Northline Cabinets" && locPayload.location.address === "12 King St");
const bareLoc = whatsAppLocationPayload({ latitude: 1, longitude: 2 });
ok("…and no blank keys when there are none, which would render as an empty line", !("name" in bareLoc.location) && !("address" in bareLoc.location));

const locNoCoords = await sendWhatsAppMessage({
  channel: limitChannel, recipientExternalId: "15551234567", kind: "location", location: null,
  lastInboundAt: new Date("2026-09-08T11:00:00Z"), now: CLOSED,
});
ok("a location send with no coordinates is refused by NAME, not posted", locNoCoords.reason === "location_missing");

const locOnPage = await sendOnChannel({
  channel: { platform: "facebook", status: "connected", externalId: "PAGE_1", accessTokenEnc: "x" },
  recipientExternalId: "PSID", kind: "location", location: { latitude: 1, longitude: 2 },
});
ok("a location on a Facebook thread is refused BY NAME, never downgraded to text", locOnPage.reason === "location_unsupported");

const replyRoute = read("app/api/messaging/threads/[id]/reply/route.js");
ok(
  "the route reads the coordinates from the COMPANY row, never from the request body",
  orderedInSource(replyRoute, 'kind === "location"', "db.company.findUnique"),
);
ok(
  "…and refuses a company with no coordinates rather than letting Meta 400 it",
  /location_missing/.test(replyRoute),
);
ok(
  "…and no latitude ever comes off the request body",
  !/body\.latitude|body\.longitude|body\.location/.test(replyRoute),
);
const threadRouteAll = read("app/api/messaging/threads/[id]/route.js");
ok(
  "the thread route says WHETHER there is an address to send, and only the label",
  /companyLocation/.test(threadRouteAll) && !/companyLocation[\s\S]{0,200}latitude:/.test(threadRouteAll.slice(threadRouteAll.indexOf("const companyLocation"))),
);

// ── J. What may be sent, what may not, and the sentence that says so ───────
ok("audio, stickers and contact cards are named as NOT sendable today", UNBUILT_OUTBOUND_TYPES.length === 3);
for (const t of UNBUILT_OUTBOUND_TYPES) {
  ok(`…including ${t}`, !OUTBOUND_TYPES.includes(t));
}
const attachNote = APP_MESSAGES.en["app.messages.media.attachNote"];
for (const word of ["Voice", "sticker", "contact"]) {
  ok(`the composer SAYS ${word} cannot be sent yet rather than leaving a silent gap`, new RegExp(word, "i").test(attachNote), attachNote);
}
const pageAll = read("app/app/messages/page.js");
ok(
  "there is no audio-recording control, because there is no recorder",
  !/MediaRecorder|getUserMedia/.test(pageAll + bitsAll),
);
ok(
  "the 'send our address' button exists only when the server said there is one",
  /const companyLocation = mediaSupported \? thread\?\.companyLocation \|\| null : null/.test(pageAll),
);
ok(
  "…and the browser sends the INTENT only, never coordinates",
  /\{ kind: "location" \}/.test(pageAll),
);
ok(
  "a pin disables the caption box, because WhatsApp carries no words with a location",
  /inputDisabled=\{composerBlocked \|\| sendingLocation\}/.test(pageAll),
);

// ── K. The file picker now offers what the send has always accepted ────────
for (const mime of MESSAGING_DOCUMENT_TYPES) {
  ok(`the picker offers ${mime}`, WHATSAPP_MEDIA_ACCEPT.includes(mime));
  const verdict = classifyWhatsAppOutboundMedia({ type: mime, size: 1024 });
  ok(`…and the send accepts it`, verdict.ok === true && verdict.type === "document", JSON.stringify(verdict));
}
ok(
  "the upload boundary takes an Office document ONLY when the caller opts in",
  classifyMedia({ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 1024 }).ok === false &&
    classifyMedia(
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 1024 },
      { allowMessagingDocuments: true },
    ).ok === true,
);
ok(
  "…and the PUBLIC self-quote upload does not opt in, so a stranger still cannot post one",
  !/allowMessagingDocuments/.test(read("app/api/self-quote/[companySlug]/upload/route.js")),
);
ok(
  "…while the authenticated upload does, and only for a messaging attachment",
  orderedInSource(read("app/api/upload/route.js"), 'purpose === "messaging"', "allowMessagingDocuments: forMessaging"),
);
ok(
  "a spreadsheet gets a .xlsx public_id, not a .pdf one that downloads as a corrupt PDF",
  uploadPublicId("document", {
    randomId: () => "fixed",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }) === "fixed.xlsx",
);
ok(
  "…and a caller that names no type still gets .pdf, exactly as before",
  uploadPublicId("document", { randomId: () => "fixed" }) === "fixed.pdf",
);
ok(
  "the messaging upload ceiling is Meta's own 100 MB, so the picker and the send agree",
  classifyMedia({ type: "application/pdf", size: WHATSAPP_MEDIA_LIMITS.document.maxBytes }, { allowMessagingDocuments: true }).ok === true &&
    classifyMedia({ type: "application/pdf", size: WHATSAPP_MEDIA_LIMITS.document.maxBytes + 1 }, { allowMessagingDocuments: true }).ok === false,
);

// ── L. The video poster and the map, executed ──────────────────────────────
const CLIP = "https://res.cloudinary.com/demo/video/upload/v1699/messaging/company_REAL/clip.mp4";
const poster = videoPosterUrl(CLIP);
ok("a video gets a poster frame from the same asset", /so_0/.test(poster));
ok("…delivered as an image, not as the clip", poster.endsWith(".jpg") && !poster.includes(".mp4"));
ok("…and an image url gets NO poster rather than a broken one", videoPosterUrl("https://res.cloudinary.com/demo/image/upload/v1/a.jpg") === null);
ok("…and a non-Cloudinary url gets none either", videoPosterUrl("https://example.com/a.mp4") === null && videoPosterUrl(null) === null);

const HERE = { latitude: 45.5019, longitude: -73.5674, name: "Gate", address: "12 King St" };
ok("a pin with a browser Maps key gets a thumbnail", /staticmap/.test(staticMapUrl(HERE, { key: "BROWSER_KEY" }) || ""));
ok("…and with NO key gets none, so nothing renders a broken image", staticMapUrl(HERE, { key: undefined }) === null);
ok("…and the card still has a way out to a real map", /45.5019,-73.5674/.test(mapsLinkUrl(HERE)));
ok("…which is refused for a pin that never parsed", mapsLinkUrl(null) === null);
// The server key is UNRESTRICTED and also unlocks Geocoding, Distance Matrix
// and Solar — app/api/measure/satellite/route.js proxies bytes through the
// server specifically so it never reaches a browser. An <img src> carrying it
// would publish it into the DOM, the network tab and every screenshot. Naming
// it in a comment is fine; READING it here is not, so this tests the read.
ok(
  "the thumbnail never reads the UNRESTRICTED server key",
  !/process\.env\.GOOGLE_MAPS_SERVER_KEY/.test(read("lib/messaging/locationLink.js") + bitsAll),
);
ok(
  "…it uses the referrer-restricted browser key, the one MiniMap already puts in an <img>",
  /process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/.test(bitsAll),
);
ok(
  "…and the key is passed IN rather than read inside the pure helper",
  !/process\.env/.test(read("lib/messaging/locationLink.js")),
);
ok(
  "the address offered to a client record is the customer's own words",
  addressFromLocation(HERE) === "Gate, 12 King St",
);
ok(
  "…and a bare pin offers NOTHING, because coordinates are not a postal address",
  addressFromLocation({ latitude: 1, longitude: 2 }) === null,
);
ok("…and null does not throw", addressFromLocation(null) === null);

// ── M. The two card controls are wired, or they are not drawn ─────────────
ok(
  "'add as a client' posts to the real client-creation route",
  /"\/api\/clients"/.test(pageAll) && orderedInSource(pageAll, "addContactAsClient", '"/api/clients"'),
);
ok(
  "'save as the client's address' patches the real client route",
  /"\/api\/clients\/" \+ clientId/.test(pageAll),
);
ok(
  "…and both are drawn only for a member the SERVER said may edit clients",
  /canEditClients: Boolean\(thread\?\.canEditClients\)/.test(pageAll) &&
    /const canEditClients = hasLevel\(full, "clientsProperties", "full_edit"\)/.test(threadRouteAll),
);
ok(
  "…so a member who cannot edit clients sees the card and not a button that would 403",
  /media\?\.canEditClients && media\?\.onAddClient/.test(bitsAll),
);
ok(
  "the address button is absent when the pin carried no address string",
  /Boolean\(address && client && media\?\.canEditClients/.test(bitsAll),
);

// ═══════════════════════════════════════════════════════════════════════════
section("13. Every new key, in all nine languages");
// ═══════════════════════════════════════════════════════════════════════════

const LANGS = Object.keys(APP_MESSAGES);
ok("nine languages are gated", LANGS.length === 9, LANGS.join(","));

const NEW_KEYS = [
  "app.messages.platform.whatsapp",
  "app.messages.window.closed",
  "app.messages.window.neverOpened",
  "app.messages.window.closingSoon",
  "app.messages.template.label",
  "app.messages.template.choose",
  "app.messages.template.none",
  "app.messages.template.value",
  "app.messages.template.send",
  "app.setWhatsApp.title",
  "app.setWhatsApp.subtitle",
  "app.setWhatsApp.awaitingTitle",
  "app.setWhatsApp.awaitingBody",
  "app.setWhatsApp.notConfiguredTitle",
  "app.setWhatsApp.notConfiguredBody",
  "app.setWhatsApp.noSignupConfigTitle",
  "app.setWhatsApp.noSignupConfigBody",
  "app.setWhatsApp.notConnectedTitle",
  "app.setWhatsApp.notConnectedBody",
  "app.setWhatsApp.connect",
  "app.setWhatsApp.connectedBanner",
  "app.setWhatsApp.numberFallback",
  "app.setWhatsApp.needsReauth",
  "app.setWhatsApp.windowTitle",
  "app.setWhatsApp.windowBody",
  "app.setWhatsApp.refreshTemplates",
  "app.setWhatsApp.templatesSynced",
  "app.setWhatsApp.disconnect",
  "app.setWhatsApp.noTemplates",
  // The pictures.
  "app.messages.media.image",
  "app.messages.media.video",
  "app.messages.media.audio",
  "app.messages.media.document",
  "app.messages.media.sticker",
  "app.messages.media.other",
  "app.messages.media.open",
  "app.messages.media.pending",
  "app.messages.media.failed",
  "app.messages.media.retry",
  "app.messages.media.retrying",
  "app.messages.media.retryError",
  "app.messages.media.unavailable",
  "app.messages.media.attach",
  "app.messages.media.attaching",
  "app.messages.media.remove",
  "app.messages.media.uploadError",
  "app.messages.media.captionPlaceholder",
  // Everything else a customer can send. Each one of these is a row that used
  // to read "Attachment" or, worse, nothing at all.
  "app.messages.media.location",
  "app.messages.media.contact",
  "app.messages.media.audioFile",
  "app.messages.media.doc.pdf",
  "app.messages.media.doc.text",
  "app.messages.media.doc.word",
  "app.messages.media.doc.excel",
  "app.messages.media.doc.slides",
  "app.messages.media.unsupported",
  "app.messages.media.otherNamed",
  "app.messages.media.mapAlt",
  "app.messages.media.openInMaps",
  "app.messages.media.useAsClientAddress",
  "app.messages.media.addressSaved",
  "app.messages.media.addressError",
  "app.messages.media.addAsClient",
  "app.messages.media.clientAdded",
  "app.messages.media.clientAddError",
  "app.messages.media.attachNote",
  "app.messages.media.sendLocation",
  "app.messages.media.locationNoCaption",
];

for (const key of NEW_KEYS) {
  const missing = LANGS.filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} exists in all nine languages`, missing.length === 0, `missing in ${missing.join(",")}`);
}

// A literal "$" in an app string is banned across this codebase — currency is
// formatted, never typed.
const withDollar = [];
for (const l of LANGS) {
  for (const key of NEW_KEYS) {
    if (String(APP_MESSAGES[l][key] || "").includes("$")) withDollar.push(`${l}:${key}`);
  }
}
ok("no new string contains a literal currency symbol", withDollar.length === 0, withDollar.join(" "));

// The 24-hour rule has to be SAID, not merely enforced — in every language.
const missingRule = LANGS.filter((l) => !/24/.test(APP_MESSAGES[l]["app.setWhatsApp.windowBody"] || ""));
ok("every language states the 24-hour rule in the settings panel", missingRule.length === 0, missingRule.join(","));

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length ? "FAILED" : "PASSED"} — ${pass} checks passed, ${failures.length} failed\n`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
