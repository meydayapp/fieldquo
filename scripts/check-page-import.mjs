// scripts/check-page-import.mjs
//
//   npm run check:page-import
//
// The pull of a Page's EXISTING conversations into the inbox
// (lib/messaging/pageImport.js). The webhook delivers only what happens after
// the subscription; this is what fills the thirty days before it, and the
// owner's first question on the live screen was why it was empty.
//
// What has to be executed rather than read:
//
//   - the Graph → event mapping, for both platforms, with an attachment: the
//     event handed to the ingest must be the SAME shape the webhook parser
//     produces, or the import becomes a second writer of the same table.
//   - direction, from the business ids and never from a name.
//   - idempotence: two runs of the whole loop, against an in-memory Graph
//     client, write nothing the second time. The dedupe key is Meta's message
//     id, and that is asserted against the schema, not assumed.
//   - the demo refusal, the grant gate, the rate limit, the connect-time
//     guard, and an auth error that flips the channel rather than stamping it
//     as imported.
//
// Run through db-stub-loader so lib/db is the scriptable stand-in.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  graphMessageToEvent,
  graphConversationToEvents,
  graphAttachmentsToStored,
  conversationParticipant,
  conversationUpdatedSince,
  pageImportState,
  importPageConversations,
  refreshPageConversations,
  importAfterConnect,
  IMPORT_MIN_INTERVAL_MS,
  IMPORT_DEFAULT_SINCE_DAYS,
  PAGE_SHAPES,
} from "../lib/messaging/pageImport.js";
import { parseMessagingEnvelope } from "../lib/messaging/envelope.js";
import { savePageMessagingChannels } from "../lib/messaging/pageChannels.js";
import { savePageConnection } from "../lib/meta/pageConnection.js";
import {
  CONVERSATION_FIELDS,
  CONVERSATION_PLATFORM_PARAM,
  conversationFields,
  isTooMuchDataError,
  nextConversationCursor,
} from "../lib/meta/client.js";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 240));
  }
}
const section = (t) => console.log(`\n${t}\n`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) =>
  read(p)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
function orderedInSource(source, a, b) {
  const ia = source.indexOf(a);
  const ib = source.indexOf(b, ia === -1 ? 0 : ia);
  return ia >= 0 && ib > ia;
}

process.env.META_TOKEN_ENCRYPTION_KEY = process.env.META_TOKEN_ENCRYPTION_KEY || "0".repeat(64);

const PAGE_ID = "918147324721528";
const IG_ID = "17841480173629186";
const COMPANY = "company_REAL";
const GRANTED_BOTH =
  "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages";
const GRANTED_FB_ONLY = "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic";
const NOW = new Date("2026-09-12T18:00:00Z");
const daysAgo = (n, h = 0) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000 - h * 3600 * 1000);
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "+0000");

// ── Graph fixtures, in Meta's own shapes ───────────────────────────────────
// Newest-first, as the API returns them.
const MESSENGER_CONVERSATION = {
  id: "t_100001",
  updated_time: iso(daysAgo(2)),
  participants: {
    data: [
      { name: "Sandra Lemieux", email: "100012345@facebook.com", id: "PSID_SANDRA" },
      { name: "Truefinish Cabinets", email: `${PAGE_ID}@facebook.com`, id: PAGE_ID },
    ],
  },
  messages: {
    data: [
      {
        id: "m_photo_3",
        created_time: iso(daysAgo(2)),
        from: { name: "Sandra Lemieux", id: "PSID_SANDRA" },
        to: { data: [{ name: "Truefinish Cabinets", id: PAGE_ID }] },
        message: "",
        attachments: {
          data: [
            {
              id: "att_1",
              mime_type: "image/jpeg",
              name: "kitchen.jpg",
              size: 245000,
              image_data: {
                width: 1200,
                height: 900,
                url: "https://scontent.xx.fbcdn.net/v/t1.15752-9/kitchen.jpg?oh=abc&oe=def",
                preview_url: "https://scontent.xx.fbcdn.net/v/t1.15752-9/kitchen_s.jpg?oh=abc&oe=def",
              },
            },
          ],
        },
      },
      {
        id: "m_reply_2",
        created_time: iso(daysAgo(2, 3)),
        from: { name: "Truefinish Cabinets", id: PAGE_ID },
        to: { data: [{ name: "Sandra Lemieux", id: "PSID_SANDRA" }] },
        message: "Yes — could you send a photo of the kitchen?",
      },
      {
        id: "m_ask_1",
        created_time: iso(daysAgo(3)),
        from: { name: "Sandra Lemieux", id: "PSID_SANDRA" },
        to: { data: [{ name: "Truefinish Cabinets", id: PAGE_ID }] },
        message: "Hi, do you refinish oak cabinets?",
      },
    ],
    paging: { cursors: { before: "b", after: "a" } },
  },
};

const MESSENGER_ANSWERED = {
  id: "t_100002",
  updated_time: iso(daysAgo(5)),
  participants: {
    data: [
      { name: "Marco Ruiz", id: "PSID_MARCO" },
      { name: "Truefinish Cabinets", id: PAGE_ID },
    ],
  },
  messages: {
    data: [
      {
        id: "m_marco_2",
        created_time: iso(daysAgo(5)),
        from: { name: "Truefinish Cabinets", id: PAGE_ID },
        message: "Tuesday works. See you at 9.",
      },
      {
        id: "m_marco_1",
        created_time: iso(daysAgo(6)),
        from: { name: "Marco Ruiz", id: "PSID_MARCO" },
        message: "Can you come Tuesday?",
      },
    ],
  },
};

// Older than the window — must end the platform's paging, not be imported.
const MESSENGER_STALE = {
  id: "t_100003",
  updated_time: iso(daysAgo(IMPORT_DEFAULT_SINCE_DAYS + 10)),
  participants: { data: [{ name: "Old Enquiry", id: "PSID_OLD" }, { name: "Truefinish Cabinets", id: PAGE_ID }] },
  messages: { data: [{ id: "m_old_1", created_time: iso(daysAgo(45)), from: { id: "PSID_OLD" }, message: "old" }] },
};

const INSTAGRAM_CONVERSATION = {
  id: "aWdfZAG06MTpJR01lc3NhZ2VUaHJlYWQ6MTc4NDE0ODAxNzM2MjkxODY6MzQwMjgyMzY2ODQxNzEwMzAxMjQ0MjU5NjUxMjM0NTY3ODkw",
  updated_time: iso(daysAgo(1)),
  participants: {
    data: [
      { username: "priya.builds", id: "IGSID_PRIYA" },
      { username: "truefinishcabinets", id: IG_ID },
    ],
  },
  messages: {
    data: [
      {
        id: "aWdfZAG1faXRlbTox_2",
        created_time: iso(daysAgo(1)),
        from: { username: "priya.builds", id: "IGSID_PRIYA" },
        to: { data: [{ username: "truefinishcabinets", id: IG_ID }] },
        message: "Do you do vanities too?",
      },
      {
        id: "aWdfZAG1faXRlbTox_1",
        created_time: iso(daysAgo(1, 2)),
        from: { username: "truefinishcabinets", id: IG_ID },
        to: { data: [{ username: "priya.builds", id: "IGSID_PRIYA" }] },
        message: "Thanks for the follow!",
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. The Graph call — fields, platform spelling, cursor");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the nested message fields carry everything the event needs", /messages\.limit\(50\)\{id,from,to,message,created_time,attachments\}/.test(CONVERSATION_FIELDS));
  ok("participants and updated_time are asked for", CONVERSATION_FIELDS.startsWith("id,participants,updated_time,"));
  ok("facebook is Meta's `messenger` on this edge", CONVERSATION_PLATFORM_PARAM.facebook === "messenger");
  ok("instagram is `instagram`", CONVERSATION_PLATFORM_PARAM.instagram === "instagram");
  ok("a cursor is read only when Meta says there is a next page", nextConversationCursor({ paging: { cursors: { after: "X" }, next: "https://…" } }) === "X");
  ok("the last page has no cursor even when Meta echoes one", nextConversationCursor({ paging: { cursors: { after: "X" } } }) === null);
  ok("no paging, no cursor", nextConversationCursor({}) === null && nextConversationCursor(null) === null);
  const client = code("lib/meta/client.js");
  ok("listPageConversations goes through graphFetch", /export async function listPageConversations[\s\S]*?graphFetch\(`\/\$\{pageId\}\/conversations`/.test(client));
  ok("…with the platform param and the field list", /params = \{ platform: platformParam, fields: conversationFields\(messagesLimit\)/.test(client));
  ok("no second fetch() to graph.facebook.com in pageImport", !/fetch\(/.test(code("lib/messaging/pageImport.js")));
  ok("the nested message count is a parameter", /messages\.limit\(10\)\{/.test(conversationFields(10)) && conversationFields(0) === CONVERSATION_FIELDS);
  ok("…passed through to the call", /fields: conversationFields\(messagesLimit\)/.test(client));
  ok("Meta's too-much-data refusal is recognised by its sentence", isTooMuchDataError({ ok: false, kind: "unknown_error", message: "Please reduce the amount of data you're asking for, then retry your request" }));
  ok("…and nothing else is", !isTooMuchDataError({ ok: false, kind: "auth_error", message: "Session has expired" }) && !isTooMuchDataError({ ok: true }) && !isTooMuchDataError(null));
  ok("the shapes step down and end at one conversation", PAGE_SHAPES[0].limit === 25 && PAGE_SHAPES[0].messagesLimit === 50 && PAGE_SHAPES.at(-1).limit === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Envelope mapping — the webhook's own shape, both platforms, an attachment");
// ═══════════════════════════════════════════════════════════════════════════
{
  const businessIds = new Set([PAGE_ID, IG_ID]);
  const { events, skipped } = graphConversationToEvents({
    platform: "facebook",
    pageExternalId: PAGE_ID,
    businessIds,
    conversation: MESSENGER_CONVERSATION,
  });
  ok("three messages, three events, nothing skipped", events.length === 3 && skipped === 0, { n: events.length, skipped });
  ok("events are oldest first (Meta sends newest first)", events.map((e) => e.externalId).join(",") === "m_ask_1,m_reply_2,m_photo_3", events.map((e) => e.externalId));
  ok("the homeowner's message is direction in", events[0].direction === "in");
  ok("the Page's reply is direction out (from.id === page id)", events[1].direction === "out");
  ok("the thread key is the PSID, as the webhook's is", events.every((e) => e.threadExternalId === "PSID_SANDRA" && e.participantExternalId === "PSID_SANDRA"));
  ok("the tenant key is the Page id", events.every((e) => e.pageExternalId === PAGE_ID && e.platform === "facebook"));
  ok("the participant's name rides along (the webhook never has one)", events[0].participantName === "Sandra Lemieux");
  ok("externalId is Meta's message id — the dedupe key", events[0].externalId === "m_ask_1");
  ok("body is the text", events[0].body === "Hi, do you refinish oak cabinets?" && events[2].body === "");
  ok("sentAt is a Date from created_time", events[0].sentAt instanceof Date && events[0].sentAt.getTime() === daysAgo(3).getTime());
  ok("every event is stamped imported", events.every((e) => e.imported === true));
  ok("kind is message", events.every((e) => e.kind === "message"));

  const photo = events[2].attachments;
  ok("the photo lands as one image attachment", Array.isArray(photo) && photo.length === 1 && photo[0].type === "image", photo);
  ok("`url` is null — Meta's link never goes in the column the bubble renders", photo?.[0]?.url === null);
  ok("`sourceUrl` is Meta's CDN link, for the re-host", photo?.[0]?.sourceUrl === MESSENGER_CONVERSATION.messages.data[0].attachments.data[0].image_data.url);
  ok("filename and mime type in the names normaliseAttachment reads", photo?.[0]?.filename === "kitchen.jpg" && photo?.[0]?.mimeType === "image/jpeg");
  ok("a text-only message has null attachments, not []", events[0].attachments === null);

  // The webhook's event, from the parser, for the SAME message — the two
  // shapes must agree key for key (plus the two the import adds).
  const hook = parseMessagingEnvelope({
    object: "page",
    entry: [{ id: PAGE_ID, time: 1, messaging: [{ sender: { id: "PSID_SANDRA" }, recipient: { id: PAGE_ID }, timestamp: daysAgo(3).getTime(), message: { mid: "m_ask_1", text: "Hi, do you refinish oak cabinets?" } }] }],
  }).events[0];
  const hookKeys = Object.keys(hook).sort();
  const importKeys = Object.keys(events[0]).sort();
  const extra = importKeys.filter((k) => !hookKeys.includes(k));
  const missing = hookKeys.filter((k) => !importKeys.includes(k));
  ok("the import event carries every key the webhook event has", missing.length === 0, missing);
  ok("…and adds exactly participantName and imported", extra.join(",") === "imported,participantName", extra);
  for (const k of hookKeys) {
    const a = hook[k] instanceof Date ? hook[k].getTime() : hook[k];
    const b = events[0][k] instanceof Date ? events[0][k].getTime() : events[0][k];
    ok(`same value as the webhook for ${k}`, a === b, { webhook: a, imported: b });
  }

  // Instagram: the business is the IG account id, the tenant key is the IG id.
  const ig = graphConversationToEvents({ platform: "instagram", pageExternalId: IG_ID, businessIds, conversation: INSTAGRAM_CONVERSATION });
  ok("instagram: two events", ig.events.length === 2 && ig.skipped === 0);
  ok("instagram: the business reply is out (from.id === ig account id)", ig.events[0].direction === "out" && ig.events[0].externalId === "aWdfZAG1faXRlbTox_1");
  ok("instagram: the follower's DM is in", ig.events[1].direction === "in");
  ok("instagram: the thread key is the IGSID", ig.events.every((e) => e.threadExternalId === "IGSID_PRIYA"));
  ok("instagram: the tenant key is the IG account id (what entry.id carries)", ig.events.every((e) => e.pageExternalId === IG_ID && e.platform === "instagram"));
  ok("instagram: the participant name is the username", ig.events[0].participantName === "priya.builds");

  // Hostile input.
  ok("a message with no id is skipped, not invented", graphMessageToEvent({ platform: "facebook", pageExternalId: PAGE_ID, businessIds, participantExternalId: "P", participantName: null, message: { from: { id: "P" }, message: "x" } }) === null);
  ok("a conversation with no participant and no messages is skipped", graphConversationToEvents({ platform: "facebook", pageExternalId: PAGE_ID, businessIds, conversation: { id: "t", participants: { data: [{ id: PAGE_ID }] } } }).events.length === 0);
  ok("the participant is found from messages when participants is missing", conversationParticipant({ messages: { data: [{ from: { id: PAGE_ID } }, { from: { id: "P2", name: "Two" } }] } }, businessIds)?.id === "P2");
  ok("a stale conversation is outside the window", !conversationUpdatedSince(MESSENGER_STALE, daysAgo(IMPORT_DEFAULT_SINCE_DAYS)));
  ok("a conversation with no updated_time is kept (absence is not age)", conversationUpdatedSince({}, daysAgo(30)));
  ok("garbage attachments produce null", graphAttachmentsToStored({ data: [null, 1, {}] }) === null && graphAttachmentsToStored("x") === null);
  ok("a video maps to video with its url", graphAttachmentsToStored({ data: [{ mime_type: "video/mp4", video_data: { url: "https://video.xx.fbcdn.net/v.mp4" } }] })?.[0]?.type === "video");
  ok("a pdf maps to document (the stored name for Messenger's file)", graphAttachmentsToStored({ data: [{ mime_type: "application/pdf", file_url: "https://cdn.fbsbx.com/q.pdf", name: "quote.pdf" }] })?.[0]?.type === "document");
  ok("a bad created_time is null, never now", graphMessageToEvent({ platform: "facebook", pageExternalId: PAGE_ID, businessIds, participantExternalId: "P", message: { id: "m", created_time: "yesterday-ish" } }).sentAt === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The dedupe key is Meta's message id — in the schema and in the ingest");
// ═══════════════════════════════════════════════════════════════════════════
{
  const schema = read("prisma/schema.prisma");
  const messageModel = schema.slice(schema.indexOf("model Message {"), schema.indexOf("model Message {") + 8000);
  ok("Message is unique on (threadId, externalId)", /@@unique\(\[threadId, externalId\]\)/.test(messageModel));
  const ingest = code("lib/messaging/ingest.js");
  ok("the ingest upserts on threadId_externalId with the event's externalId", /upsert\(\{\s*where: \{ threadId_externalId: \{ threadId: thread\.id, externalId: event\.externalId \} \}/.test(ingest));
  ok("MessagingChannel.importedAt exists (additive)", /model MessagingChannel \{[\s\S]*?importedAt DateTime\?/.test(schema));
  ok("the ingest keeps the AI employee off imported messages", /created && event\.direction === "in" && !event\.imported/.test(ingest));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The whole loop, twice, against an in-memory Graph client");
// ═══════════════════════════════════════════════════════════════════════════

/** A scriptable Graph. Pages: messenger has two pages (cursor), instagram one. */
function fakeGraph({ messenger = [[MESSENGER_CONVERSATION], [MESSENGER_ANSWERED, MESSENGER_STALE]], instagram = [[INSTAGRAM_CONVERSATION]], fail = null, tooMuchAbove = null } = {}) {
  const calls = [];
  const fetchConversations = async ({ pageAccessToken, pageId, platform, after, limit, messagesLimit }) => {
    calls.push({ pageAccessToken, pageId, platform, after, limit, messagesLimit });
    if (fail && fail.platform === platform) return { ok: false, ...fail.result };
    // Meta's size refusal: any ask above `tooMuchAbove` messages per
    // conversation is "too much data" for this platform.
    if (tooMuchAbove && tooMuchAbove.platform === platform && messagesLimit > tooMuchAbove.messagesLimit) {
      return { ok: false, kind: "unknown_error", message: "Please reduce the amount of data you're asking for, then retry your request" };
    }
    const pages = platform === "facebook" ? messenger : instagram;
    const idx = after ? Number(after.replace("cursor_", "")) : 0;
    const data = pages[idx] || [];
    const more = idx + 1 < pages.length;
    return {
      ok: true,
      data: {
        data,
        paging: more ? { cursors: { before: "x", after: `cursor_${idx + 1}` }, next: "https://graph.facebook.com/next" } : { cursors: { before: "x", after: "end" } },
      },
    };
  };
  return { calls, fetchConversations };
}

async function seedConnected({ scopes = GRANTED_BOTH, instagram = true, isDemo = false } = {}) {
  resetDbStub();
  rows.company.push({ id: COMPANY, name: "Truefinish Cabinets", isDemo });
  await savePageConnection({
    companyId: COMPANY,
    pageId: PAGE_ID,
    pageName: "Truefinish Cabinets",
    pageAccessToken: "PAGE-TOKEN",
    instagramUserId: instagram ? IG_ID : null,
    instagramUsername: instagram ? "truefinishcabinets" : null,
    scopes,
    connectedByUserId: "user_1",
    webhookSubscribedAt: NOW,
    webhookSubscribeError: null,
  });
  await savePageMessagingChannels({
    companyId: COMPANY,
    pageId: PAGE_ID,
    pageName: "Truefinish Cabinets",
    pageToken: "PAGE-TOKEN",
    instagramUserId: instagram ? IG_ID : null,
    instagramUsername: instagram ? "truefinishcabinets" : null,
    grantedScopes: scopes,
    webhookSubscribedAt: NOW,
    connectedByUserId: "user_1",
  });
}

{
  await seedConnected();
  const graph = fakeGraph();

  // Dry run first: counts, no writes.
  const before = writes.length;
  const dry = await importPageConversations({ companyId: COMPANY, dryRun: true, fetchConversations: graph.fetchConversations, now: NOW });
  ok("dry run: kind ok", dry.kind === "ok", dry);
  ok("dry run: counts per platform", dry.platforms.facebook?.conversations === 2 && dry.platforms.facebook?.messages === 5 && dry.platforms.instagram?.conversations === 1 && dry.platforms.instagram?.messages === 2, dry.platforms);
  ok("dry run: totals", dry.conversations === 3 && dry.messages === 7 && dry.created === 0 && dry.dryRun === true, dry);
  ok("dry run: writes nothing", writes.length === before && rows.messageThread.length === 0 && rows.message.length === 0);
  ok("dry run: does not stamp importedAt", rows.messagingChannel.every((c) => !c.importedAt));
  ok("the stale conversation ended the messenger paging (not imported)", dry.platforms.facebook.conversations === 2);

  // Real run.
  graph.calls.length = 0;
  const first = await importPageConversations({ companyId: COMPANY, fetchConversations: graph.fetchConversations, now: NOW });
  ok("first run: kind ok", first.kind === "ok", first);
  ok("first run: 3 conversations, 7 messages, 7 created", first.conversations === 3 && first.messages === 7 && first.created === 7 && first.errors === 0, first);
  ok("three thread rows", rows.messageThread.length === 3, rows.messageThread.length);
  ok("seven message rows", rows.message.length === 7, rows.message.length);
  ok("the Graph was called with the PAGE token and the Page id, for both platforms", graph.calls.every((c) => c.pageAccessToken === "PAGE-TOKEN" && c.pageId === PAGE_ID) && graph.calls.some((c) => c.platform === "facebook") && graph.calls.some((c) => c.platform === "instagram"), graph.calls);
  ok("messenger paged through Meta's cursor", graph.calls.filter((c) => c.platform === "facebook").map((c) => c.after).join(",") === ",cursor_1", graph.calls);

  const sandra = rows.messageThread.find((t) => t.externalThreadId === "PSID_SANDRA");
  const marco = rows.messageThread.find((t) => t.externalThreadId === "PSID_MARCO");
  const priya = rows.messageThread.find((t) => t.externalThreadId === "IGSID_PRIYA");
  ok("Sandra's thread is on the facebook channel, company from the CHANNEL row", sandra?.companyId === COMPANY && rows.messagingChannel.find((c) => c.id === sandra?.channelId)?.platform === "facebook");
  ok("Priya's thread is on the instagram channel", rows.messagingChannel.find((c) => c.id === priya?.channelId)?.platform === "instagram");
  ok("Sandra (last message hers) is open and unread — never marked read", sandra?.status === "open" && sandra?.unread === 1, sandra);
  ok("Sandra's thread is waiting on us (waitingSince set)", sandra?.waitingSince instanceof Date, sandra);
  ok("Sandra's firstReplyAt is the Page's reply, firstInboundAt her first ask (chronological ingest)", sandra?.firstInboundAt?.getTime() === daysAgo(3).getTime() && sandra?.firstReplyAt?.getTime() === daysAgo(2, 3).getTime(), sandra);
  ok("Marco (last message ours) has no unread and is not waiting", marco?.unread === 0 && !marco?.waitingSince, marco);
  ok("Priya (last message hers) is unread", priya?.unread === 1);
  ok("lastMessageAt is the newest message's time", sandra?.lastMessageAt?.getTime() === daysAgo(2).getTime());
  ok("participant names came through", sandra?.participantName === "Sandra Lemieux" && priya?.participantName === "priya.builds");
  const photoRow = rows.message.find((m) => m.externalId === "m_photo_3");
  ok("the photo message is flagged mediaPending for the re-host cron", photoRow?.mediaPending === true && photoRow?.attachments?.[0]?.sourceUrl?.startsWith("https://scontent"), photoRow);
  ok("every stored message is private:false with direction in|out", rows.message.every((m) => m.private === false && ["in", "out"].includes(m.direction)));
  ok("direction on the rows matches who sent them", rows.message.find((m) => m.externalId === "m_reply_2")?.direction === "out" && rows.message.find((m) => m.externalId === "m_ask_1")?.direction === "in");
  ok("both channels stamped importedAt = now", rows.messagingChannel.filter((c) => !c.disconnectedAt).every((c) => c.importedAt?.getTime() === NOW.getTime()), rows.messagingChannel.map((c) => c.importedAt));

  // Second run: nothing new.
  const threadsBefore = rows.messageThread.length;
  const messagesBefore = rows.message.length;
  const unreadBefore = rows.messageThread.map((t) => t.unread).join(",");
  const later = new Date(NOW.getTime() + 60 * 1000);
  const second = await importPageConversations({ companyId: COMPANY, fetchConversations: graph.fetchConversations, now: later });
  ok("second run: kind ok, same counts seen", second.kind === "ok" && second.conversations === 3 && second.messages === 7, second);
  ok("second run: 0 created", second.created === 0, second.created);
  ok("second run: no new thread rows", rows.messageThread.length === threadsBefore);
  ok("second run: no new message rows (dedupe on Meta's message id)", rows.message.length === messagesBefore);
  ok("second run: unread badges untouched", rows.messageThread.map((t) => t.unread).join(",") === unreadBefore);
  ok("second run: importedAt moved forward", rows.messagingChannel.filter((c) => !c.disconnectedAt).every((c) => c.importedAt?.getTime() === later.getTime()));

  // A webhook delivery of a message the import already stored: one row.
  const hook = parseMessagingEnvelope({
    object: "page",
    entry: [{ id: PAGE_ID, time: 1, messaging: [{ sender: { id: "PSID_SANDRA" }, recipient: { id: PAGE_ID }, timestamp: daysAgo(2).getTime(), message: { mid: "m_photo_3", text: "" } }] }],
  });
  const { ingestEvent } = await import("../lib/messaging/ingest.js");
  const echoed = await ingestEvent(hook.events[0]);
  ok("a webhook re-delivery of an imported message updates the same row", echoed.handled && echoed.created === false && rows.message.length === messagesBefore, echoed);

  // The limit bounds conversations per platform.
  await seedConnected();
  const limited = await importPageConversations({ companyId: COMPANY, limit: 1, fetchConversations: fakeGraph().fetchConversations, now: NOW });
  ok("limit=1 imports one conversation per platform", limited.platforms.facebook.conversations === 1 && limited.platforms.instagram.conversations === 1, limited.platforms);

  // A wider window reaches the stale one.
  await seedConnected();
  const wide = await importPageConversations({ companyId: COMPANY, since: daysAgo(180), fetchConversations: fakeGraph().fetchConversations, now: NOW });
  ok("since=180 days imports the 45-day-old conversation too", wide.platforms.facebook.conversations === 3, wide.platforms);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Refusals — demo, not granted, auth error, rate limit, the connect guard");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Demo: nothing fetched, nothing written.
  await seedConnected({ isDemo: true });
  const graph = fakeGraph();
  const before = writes.length;
  const demo = await importPageConversations({ companyId: COMPANY, fetchConversations: graph.fetchConversations, now: NOW });
  ok("a demo company answers kind demo", demo.kind === "demo", demo);
  ok("…and the Graph is never called", graph.calls.length === 0);
  ok("…and nothing is written", writes.length === before && rows.messageThread.length === 0);
  ok("pageImportState says demo, not available", (await pageImportState(COMPANY)).reason === "demo");

  // Not granted: the connect flow never wrote channels for an ungranted
  // scope, but a scope narrowed later must still refuse.
  await seedConnected();
  rows.metaPageConnection[0].scopes = "pages_show_list,pages_read_engagement";
  const g2 = fakeGraph();
  const ungranted = await importPageConversations({ companyId: COMPANY, fetchConversations: g2.fetchConversations, now: NOW });
  ok("a grant without pages_messaging answers not_granted", ungranted.kind === "not_granted", ungranted);
  ok("…and the Graph is never called", g2.calls.length === 0);
  ok("pageImportState: not available, reason not_granted", (await pageImportState(COMPANY)).reason === "not_granted");

  // Facebook only: instagram_manage_messages missing → no instagram pull.
  await seedConnected({ scopes: GRANTED_FB_ONLY });
  const g3 = fakeGraph();
  const fbOnly = await importPageConversations({ companyId: COMPANY, fetchConversations: g3.fetchConversations, now: NOW });
  ok("without instagram_manage_messages only facebook is pulled", fbOnly.kind === "ok" && fbOnly.platforms.facebook && !fbOnly.platforms.instagram && g3.calls.every((c) => c.platform === "facebook"), { platforms: fbOnly.platforms, calls: g3.calls });
  ok("pageImportState lists facebook only", (await pageImportState(COMPANY)).platforms.join(",") === "facebook");

  // No connection at all.
  resetDbStub();
  rows.company.push({ id: COMPANY, isDemo: false });
  ok("no Page connection answers not_connected", (await importPageConversations({ companyId: COMPANY, fetchConversations: fakeGraph().fetchConversations })).kind === "not_connected");

  // Auth error: the channel flips to needs_reauth, importedAt NOT stamped.
  await seedConnected({ instagram: false });
  const g4 = fakeGraph({ fail: { platform: "facebook", result: { kind: "auth_error", message: "Error validating access token: Session has expired" } } });
  const dead = await importPageConversations({ companyId: COMPANY, fetchConversations: g4.fetchConversations, now: NOW });
  ok("a dead token answers kind error with lastError auth_error", dead.kind === "error" && dead.lastError?.kind === "auth_error" && dead.lastError?.platform === "facebook", dead);
  const fb = rows.messagingChannel.find((c) => c.platform === "facebook");
  ok("…the channel is flipped to needs_reauth with the reason", fb?.status === "needs_reauth" && /import:/.test(fb?.lastError || ""), fb);
  ok("…and importedAt is NOT stamped (retried by the next connect or press)", !fb?.importedAt);
  ok("…and nothing was imported", rows.messageThread.length === 0);

  // Meta's size refusal: the same page is asked for again in a smaller
  // shape, and the run succeeds without counting an error — what the owner's
  // Instagram inbox needed on the first real run.
  await seedConnected();
  const g8 = fakeGraph({ tooMuchAbove: { platform: "instagram", messagesLimit: 25 } });
  const shrunk = await importPageConversations({ companyId: COMPANY, fetchConversations: g8.fetchConversations, now: NOW });
  const igCalls = g8.calls.filter((c) => c.platform === "instagram");
  ok("too much data: the Instagram page is retried in a smaller shape and lands", shrunk.kind === "ok" && shrunk.platforms.instagram?.conversations === 1 && shrunk.errors === 0, { shrunk, igCalls });
  ok("…first ask 25×50, second 10×25", igCalls.length === 2 && igCalls[0].messagesLimit === 50 && igCalls[1].limit === 10 && igCalls[1].messagesLimit === 25, igCalls);
  ok("…the same page both times (no cursor advanced)", igCalls.every((c) => c.after === null));
  ok("…Facebook was not shrunk (its first ask was fine)", g8.calls.filter((c) => c.platform === "facebook").every((c) => c.messagesLimit === 50));
  ok("…both channels stamped", rows.messagingChannel.every((c) => c.importedAt));
  const g9 = fakeGraph({ tooMuchAbove: { platform: "instagram", messagesLimit: 0 } });
  await seedConnected();
  const hopeless = await importPageConversations({ companyId: COMPANY, fetchConversations: g9.fetchConversations, now: NOW });
  ok("too much data at every shape: reported as an error after the last shape, not looped", hopeless.platforms.instagram?.errors === 1 && g9.calls.filter((c) => c.platform === "instagram").length === PAGE_SHAPES.length && /reduce the amount/.test(hopeless.lastError?.message || ""), { calls: g9.calls.length, lastError: hopeless.lastError });
  ok("…and Instagram is not stamped", !rows.messagingChannel.find((c) => c.platform === "instagram").importedAt);

  // A rate-limited Graph answer is reported, not retried into a loop.
  await seedConnected({ instagram: false });
  const g5 = fakeGraph({ fail: { platform: "facebook", result: { kind: "rate_limited", message: "(#4) Application request limit reached", retryAfterSeconds: 300 } } });
  const throttled = await importPageConversations({ companyId: COMPANY, fetchConversations: g5.fetchConversations, now: NOW });
  ok("Meta's rate limit comes back as lastError rate_limited and one call", throttled.lastError?.kind === "rate_limited" && g5.calls.length === 1, throttled);
  ok("…the channel is NOT flipped for a rate limit (the token is fine)", rows.messagingChannel[0].status === "connected");

  // The manual refresh's own rate limit, per company, on the stamp.
  await seedConnected();
  const g6 = fakeGraph();
  const r1 = await refreshPageConversations({ companyId: COMPANY, fetchConversations: g6.fetchConversations, now: NOW });
  ok("refresh: first press runs", r1.kind === "ok" && r1.created === 7, r1);
  const r2 = await refreshPageConversations({ companyId: COMPANY, fetchConversations: g6.fetchConversations, now: new Date(NOW.getTime() + 2 * 60 * 1000) });
  ok("refresh: a second press two minutes later is rate_limited", r2.kind === "rate_limited" && r2.retryAfterSeconds > 0 && r2.retryAfterSeconds <= IMPORT_MIN_INTERVAL_MS / 1000, r2);
  const callsBefore = g6.calls.length;
  ok("…and the Graph was not called for it", g6.calls.length === callsBefore);
  const r3 = await refreshPageConversations({ companyId: COMPANY, fetchConversations: g6.fetchConversations, now: new Date(NOW.getTime() + IMPORT_MIN_INTERVAL_MS + 1000) });
  ok("refresh: after ten minutes it runs again", r3.kind === "ok" && r3.created === 0, r3);

}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The connect guard, executed");
// ═══════════════════════════════════════════════════════════════════════════
{
  // importAfterConnect takes no client injection (it is the production
  // trigger), so the guard is proven from the other side: with importedAt
  // set it must return null WITHOUT touching the Graph — which, with no
  // network here, is the difference between null and an error result.
  await seedConnected();
  for (const c of rows.messagingChannel) c.importedAt = daysAgo(1);
  const skipped = await importAfterConnect({ companyId: COMPANY });
  ok("importAfterConnect returns null for a company whose channels are all imported", skipped === null, skipped);

  const src = code("lib/messaging/pageImport.js");
  ok("importAfterConnect guards on the unstamped platforms before importing", /if \(!state\.available \|\| !state\.pending\.length\) return null;[\s\S]*?importPageConversations\(\{ companyId, platforms: state\.pending \}\)/.test(src));

  // Per platform, executed: Facebook stamped, Instagram not (Meta refused it
  // last time) — the state owes Instagram alone, and a platforms-restricted
  // run touches only that channel.
  await seedConnected();
  rows.messagingChannel.find((c) => c.platform === "facebook").importedAt = daysAgo(1);
  const owed = await pageImportState(COMPANY);
  ok("pending lists only the never-imported platform", owed.pending.join(",") === "instagram" && owed.platforms.length === 2, owed);
  const g7 = fakeGraph();
  const igOnly = await importPageConversations({ companyId: COMPANY, platforms: owed.pending, fetchConversations: g7.fetchConversations, now: NOW });
  ok("a platforms-restricted run pulls only Instagram", igOnly.kind === "ok" && !igOnly.platforms.facebook && igOnly.platforms.instagram?.conversations === 1 && g7.calls.every((c) => c.platform === "instagram"), { platforms: igOnly.platforms, calls: g7.calls });
  ok("…and the company then owes nothing", (await pageImportState(COMPANY)).pending.length === 0);
  ok("importAfterConnect returns null once nothing is owed", (await importAfterConnect({ companyId: COMPANY })) === null);
  ok("…and records a failure to the platform error log rather than throwing", /recordError\(\{[\s\S]*?code: `page_import_\$\{result\.lastError\.kind\}`/.test(src) && /code: "page_import_threw"/.test(src));
  ok("the stamp is written only after a run that reached Meta", /if \(!dryRun && !failed\) \{\s*await stampChannelImported/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The triggers, the route, the button, the card, the cron");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const file of [
    "app/api/settings/social/callback/route.js",
    "app/api/settings/social/finalize/route.js",
    "app/api/settings/social/subscribe/route.js",
  ]) {
    const src = code(file);
    ok(`${file} imports importAfterConnect`, /import \{ importAfterConnect \} from "@\/lib\/messaging\/pageImport"/.test(src));
    ok(`${file} schedules it behind the response with after()`, /after\(\(\) => importAfterConnect\(\{ companyId \}\)\)/.test(src) && /import \{ NextResponse, after \} from "next\/server"/.test(src));
    ok(`${file} schedules it AFTER the channels are saved`, orderedInSource(src, "savePageMessagingChannels({", "after(() => importAfterConnect("));
  }

  const route = code("app/api/messaging/import/route.js");
  ok("POST /api/messaging/import exists and is POST only", /export async function POST\(/.test(route) && !/export async function GET\(/.test(route));
  ok("…gated at requests: view_create_edit", /requireLevel\([\s\S]*?"requests",\s*"view_create_edit"/.test(route));
  ok("…calls refreshPageConversations (the rate-limited entry)", /refreshPageConversations\(\{ companyId: member\.companyId \}\)/.test(route));
  ok("…rate_limited is a 429 with retry-after", /rate_limited: 429/.test(route) && /"retry-after"/.test(route));
  ok("…not_granted is refused, demo is refused", /not_granted: 409/.test(route) && /demo: 409/.test(route));
  ok("…never returns Meta's prose", /lastError: result\.lastError \? \{ kind: result\.lastError\.kind, platform: result\.lastError\.platform \} : null/.test(route));
  ok("…the company comes from the member, never the body", !/request\.json\(/.test(route));

  const list = code("app/api/messaging/threads/route.js");
  ok("the inbox list returns pageImport from pageImportState", /pageImport = await pageImportState\(member\.companyId\)/.test(list) && /NextResponse\.json\(\{ connection, note, threads, pageImport \}\)/.test(list));
  ok("…and for the demo branch too (drawn as unavailable)", /threads, pageImport: await pageImportState\(member\.companyId\) \}\)/.test(list));

  const page = code("app/app/messages/page.js");
  ok("the button is drawn only when the grant allows it, for a writer, off the demo", /pageImport\?\.available && canEdit && !isDemo \? \(/.test(page) && orderedInSource(page, "pageImport?.available && canEdit && !isDemo", "data-import-button"));
  ok("the button POSTs /api/messaging/import", /fetchJson\("\/api\/messaging\/import", \{ method: "POST" \}\)/.test(page));
  ok("the toast quotes conversations and new", /key: "app\.messages\.import\.done", params: \{ conversations, created \}/.test(page));
  ok("the toast has a sentence for the rate limit and for a dead token", /app\.messages\.import\.rateLimited/.test(page) && /app\.messages\.import\.reauth/.test(page));
  ok("the list reloads after an import", orderedInSource(page, 'fetchJson("/api/messaging/import"', "await load(query.trim(), platformFilter)"));
  ok("the toast is role=status", /role="status"[\s\S]{0,600}data-import-toast/.test(page));
  ok("pageImport is read off the list response", /setPageImport\(result\.data\?\.pageImport \|\| null\)/.test(page));

  const panel = code("app/components/settings/SocialPublishingPanel.js");
  ok("the settings card draws the link only when available", /connection\.pageImport\?\.available && \(/.test(panel) && orderedInSource(panel, "connection.pageImport?.available && (", "data-import-link"));
  ok("…shows the last import time, or that it never ran", /app\.setSocial\.importLast/.test(panel) && /app\.setSocial\.importNever/.test(panel));
  ok("…and posts the same route", /fetchJson\("\/api\/messaging\/import", \{ method: "POST" \}\)/.test(panel));
  const status = code("app/api/settings/social/status/route.js");
  ok("the status route carries pageImport", /pageImport: await pageImportState\(member\.companyId\)/.test(status));

  const cron = code("app/api/cron/messaging-import/route.js");
  ok("the cron sweeps never-imported live page channels only", /importedAt: null/.test(cron) && /disconnectedAt: null/.test(cron) && /PAGE_CHANNEL_PLATFORMS/.test(cron));
  ok("…behind the cron secret", /requireCronSecret\(request\)/.test(cron));
  ok("…through importAfterConnect (the same guard)", /await importAfterConnect\(\{ companyId \}\)/.test(cron));
  ok("vercel.json schedules it", JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/messaging-import"));
  const registry = read("lib/features/registry.js");
  ok("the feature registry owns it under page_messaging", /"\/api\/cron\/messaging-import"/.test(registry));

  const channels = code("lib/messaging/channels.js");
  ok("importedAt is stamped through the one door (channels.js)", /export async function stampChannelImported/.test(channels) && !/db\.messagingChannel/.test(code("lib/messaging/pageImport.js")));
  ok("the public channel shape carries importedAt", /importedAt: channel\.importedAt \|\| null/.test(channels));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Nine languages");
// ═══════════════════════════════════════════════════════════════════════════
{
  const KEYS = [
    "app.messages.import.button",
    "app.messages.import.hint",
    "app.messages.import.running",
    "app.messages.import.done",
    "app.messages.import.none",
    "app.messages.import.rateLimited",
    "app.messages.import.reauth",
    "app.messages.import.failed",
    "app.setSocial.importLink",
    "app.setSocial.importLast",
    "app.setSocial.importNever",
  ];
  const langs = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", langs.length === 9, langs);
  for (const lang of langs) {
    const missing = KEYS.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k]);
    ok(`${lang}: every import key present`, missing.length === 0, missing);
    ok(`${lang}: the toast carries both counts`, /\{conversations\}/.test(APP_MESSAGES[lang]["app.messages.import.done"] || "") && /\{created\}/.test(APP_MESSAGES[lang]["app.messages.import.done"] || ""));
    ok(`${lang}: the last-import sentence carries the date`, /\{date\}/.test(APP_MESSAGES[lang]["app.setSocial.importLast"] || ""));
  }
  ok("the English toast reads as briefed", APP_MESSAGES.en["app.messages.import.done"] === "Imported {conversations} conversations · {created} new");
  ok("the English button reads as briefed", APP_MESSAGES.en["app.messages.import.button"] === "Refresh from Facebook");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
