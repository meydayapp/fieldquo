// lib/messaging/pageImport.js
//
// The conversations a Page already had when it was connected.
//
// ══ The gap this closes ════════════════════════════════════════════════════
//
// The inbox is fed by app/api/meta/messaging/webhook and nothing else, and a
// webhook delivers what happens AFTER the subscription. So a contractor who
// connects a Page with two years of customer conversations on it gets an
// inbox that says "no messages" until the next stranger writes — and reads
// it as "nobody has ever messaged us", which is false. The owner asked the
// question on the live screen minutes after connecting his own Page: "I
// don't see the messages. Shouldn't we fetch them?"
//
// Yes. GET /<page-id>/conversations (lib/meta/client.js's
// listPageConversations) is the pull, and this file turns what it returns
// into EXACTLY the event shape lib/messaging/envelope.js produces for a
// webhook delivery, then hands each event to the SAME ingest. That is the
// whole design: nothing here creates a thread, a message, a number, a read
// state or an activity row. lib/messaging/ingest.js does all of it, keyed on
// Meta's own message id (@@unique([threadId, externalId])), so an imported
// message and the webhook copy of the same message are one row, and running
// the import twice writes nothing the second time. A second code path that
// wrote rows would be the copy that rots (AGENTS.md failure class 4) — and
// would rot in the table the month-end review reads.
//
// ══ What is deliberately NOT done ══════════════════════════════════════════
//
//   - Imported inbound messages are never marked read or replied. The
//     thread's status and unread badge follow the ingest's ordinary rule
//     (last message theirs → open, waiting on us), which is the truth: a
//     question from last week that nobody answered still needs answering.
//   - The AI employee does not draft replies to history — every event is
//     stamped `imported: true` and the ingest skips it (see there).
//   - Nothing runs for a demo company. Company.isDemo is read fresh from the
//     database here, never taken from a caller: the sample inbox stays the
//     sample inbox, and a real Page's history can never be pulled into it.
//   - WhatsApp is not imported. Meta's Cloud API has no conversation history
//     endpoint; there is nothing to pull.
//
// ══ The grant ══════════════════════════════════════════════════════════════
//
// Reading conversations needs pages_messaging, and the Instagram half needs
// instagram_manage_messages as well — the same two lists
// lib/meta/pageConnect.js's inboxPlatformsGranted reads for the send path,
// and read off what Meta GRANTED, never what was asked for. A grant without
// them answers { kind: "not_granted" } and the button is not drawn.

import { db } from "@/lib/db";
import {
  listChannels,
  decryptedChannelToken,
  recordChannelError,
  stampChannelImported,
} from "./channels";
import { ingestEvent } from "./ingest";
import { PAGE_CHANNEL_PLATFORMS } from "./pageChannels";
import { getPageConnection } from "@/lib/meta/pageConnection";
import { inboxPlatformsGranted } from "@/lib/meta/pageConnect";
import { listPageConversations, nextConversationCursor, isTooMuchDataError } from "@/lib/meta/client";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

/** How far back the import looks by default. Thirty days: the month the review reads. */
export const IMPORT_DEFAULT_SINCE_DAYS = 30;
/** Conversations per platform per run. Bounded because every one is up to 50 ingests. */
export const IMPORT_DEFAULT_LIMIT = 100;
/** How often the manual refresh may run for one company. */
export const IMPORT_MIN_INTERVAL_MS = 10 * 60 * 1000;
/**
 * Page shapes to try, largest first. Meta answers "Please reduce the amount of
 * data you're asking for" (lib/meta/client.js's isTooMuchDataError) when one
 * page of conversations with their nested messages is too big — the owner's
 * Instagram inbox did exactly that on the first real run while Facebook's 84
 * conversations came through at the first shape. Each refusal steps down one
 * shape and retries the SAME page; the last shape is one conversation with
 * ten messages, and a refusal there is reported as the error it is.
 */
export const PAGE_SHAPES = Object.freeze([
  { limit: 25, messagesLimit: 50 },
  { limit: 10, messagesLimit: 25 },
  { limit: 5, messagesLimit: 10 },
  { limit: 1, messagesLimit: 10 },
]);

const str = (v) => (typeof v === "string" && v ? v : null);

/**
 * Meta's ISO timestamp ("2026-09-10T14:22:01+0000") to a Date, or null.
 *
 * Null rather than `new Date()` for the reason envelope.js's asDate gives:
 * "when it happened" is the input to every response-time figure in the
 * monthly review, and substituting "now" invents a fast reply.
 */
export function graphTime(value) {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The Conversations API's attachment list -> the stored shape.
 *
 * Meta's REST shape here differs from the webhook's (`image_data.url`,
 * `video_data.url`, `file_url`, and a `mime_type` instead of a `type`), which
 * is exactly why the mapping happens HERE and the stored row is the one shape
 * lib/messaging/attachments.js reads: `url` null on the way in, the expiring
 * CDN link in `sourceUrl` for lib/messaging/mediaFetch.js to re-host from.
 * The invariant envelope.js states — nothing but a Cloudinary URL is ever
 * written into `url` — holds for an imported photo too.
 *
 * Null rather than [] when there is nothing, matching the webhook parser.
 */
export function graphAttachmentsToStored(raw) {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const mime = str(a.mime_type) || "";
    const imageUrl = str(a.image_data?.url) || str(a.image_data?.preview_url);
    const videoUrl = str(a.video_data?.url) || str(a.video_data?.preview_url);
    const fileUrl = str(a.file_url);
    const type = imageUrl || mime.startsWith("image/")
      ? "image"
      : videoUrl || mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "document";
    const sourceUrl = imageUrl || videoUrl || fileUrl || null;
    // An attachment we can neither name nor fetch is not information.
    if (!sourceUrl && !mime) continue;
    out.push({
      type,
      url: null,
      sourceUrl,
      // The two optional fields normaliseAttachment reads by these names.
      ...(str(a.name) ? { filename: a.name } : {}),
      ...(mime ? { mimeType: mime } : {}),
    });
  }
  return out.length ? out : null;
}

/**
 * One Graph message -> one ingest event, or null when it cannot be one.
 *
 * Direction is "did the BUSINESS send it": `from.id` against the ids we hold
 * for the Page and its Instagram account — never against a name, and never
 * guessed from `to`. Getting this backwards files the contractor's own
 * replies as if a homeowner wrote them, which corrupts the one number the
 * monthly review exists to produce.
 *
 * Null for a message with no id: no id means no idempotency key, and the
 * ingest would re-insert it on every run. Counted as skipped by the caller.
 */
export function graphMessageToEvent({
  platform,
  pageExternalId,
  businessIds,
  participantExternalId,
  participantName,
  message,
}) {
  const mid = str(message?.id);
  if (!mid || !participantExternalId) return null;
  const fromId = str(message?.from?.id);
  const fromBusiness = Boolean(fromId && businessIds.has(fromId));
  return {
    kind: "message",
    platform,
    pageExternalId,
    threadExternalId: participantExternalId,
    participantExternalId,
    participantName: participantName || null,
    direction: fromBusiness ? "out" : "in",
    externalId: mid,
    body: typeof message?.message === "string" ? message.message : "",
    attachments: graphAttachmentsToStored(message?.attachments),
    sentAt: graphTime(message?.created_time),
    // The one field a webhook event never carries. Read by the ingest to keep
    // the AI employee off history; see there.
    imported: true,
  };
}

/**
 * The homeowner in a conversation: the participant that is not the business.
 *
 * From `participants.data` first; when Meta omits the list, from the first
 * message not sent by the business. Null when neither names anyone, and the
 * conversation is skipped rather than filed under a made-up id.
 */
export function conversationParticipant(conversation, businessIds) {
  const list = Array.isArray(conversation?.participants?.data) ? conversation.participants.data : [];
  for (const p of list) {
    const id = str(p?.id);
    if (id && !businessIds.has(id)) {
      return { id, name: str(p.name) || str(p.username) || null };
    }
  }
  const messages = Array.isArray(conversation?.messages?.data) ? conversation.messages.data : [];
  for (const m of messages) {
    const id = str(m?.from?.id);
    if (id && !businessIds.has(id)) {
      return { id, name: str(m.from?.name) || str(m.from?.username) || null };
    }
  }
  return null;
}

/**
 * One Graph conversation -> its ingest events, OLDEST FIRST.
 *
 * Meta returns messages newest first. The ingest stamps waitingSince,
 * firstInboundAt and firstReplyAt from the order it sees messages in, so they
 * are sorted ascending before ingest — feeding them newest-first would record
 * a reply as arriving before the question it answered.
 *
 * @returns {{ events: Array, skipped: number }}
 */
export function graphConversationToEvents({ platform, pageExternalId, businessIds, conversation }) {
  const participant = conversationParticipant(conversation, businessIds);
  const messages = Array.isArray(conversation?.messages?.data) ? conversation.messages.data : [];
  if (!participant) return { events: [], skipped: messages.length || 1 };
  const events = [];
  let skipped = 0;
  for (const message of messages) {
    const event = graphMessageToEvent({
      platform,
      pageExternalId,
      businessIds,
      participantExternalId: participant.id,
      participantName: participant.name,
      message,
    });
    if (event) events.push(event);
    else skipped += 1;
  }
  events.sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0));
  return { events, skipped };
}

/** Is this conversation recent enough to import? A conversation with no updated_time is kept: absence is not "old". */
export function conversationUpdatedSince(conversation, since) {
  if (!(since instanceof Date)) return true;
  const at = graphTime(conversation?.updated_time);
  return at === null || at >= since;
}

const emptyCounts = () => ({ conversations: 0, messages: 0, skipped: 0, errors: 0 });

/**
 * What the two screens need to know before drawing a control: can this
 * company import at all, which platforms, and when it last ran.
 *
 * @returns {Promise<{ available: boolean, reason: string|null,
 *                     granted: { facebook: boolean, instagram: boolean },
 *                     platforms: string[], pending: string[],
 *                     importedAt: Date|null }>}
 *
 * `pending` is the subset of `platforms` whose channel has NEVER been
 * imported — what the connect-time trigger still owes. Per platform rather
 * than per company on purpose: the owner's first real run imported 84
 * Facebook conversations and had Instagram refused by Meta, and a company-
 * wide "already imported" would have left Instagram never retried.
 *
 * `reason` when not available: "demo" | "not_connected" | "not_granted".
 * A read, and only a read — reachable under an impersonation cookie via the
 * inbox list, which is fine for a read (non-negotiable #3).
 */
export async function pageImportState(companyId) {
  const none = { available: false, granted: { facebook: false, instagram: false }, platforms: [], pending: [], importedAt: null };
  if (!companyId) return { ...none, reason: "not_connected" };

  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { isDemo: true } })
    .catch(() => null);
  if (company?.isDemo) return { ...none, reason: "demo" };

  const connection = await getPageConnection(companyId);
  if (!connection) return { ...none, reason: "not_connected" };

  const granted = inboxPlatformsGranted(connection.scopes);
  const channels = (await listChannels(companyId).catch(() => [])).filter((c) =>
    PAGE_CHANNEL_PLATFORMS.includes(c.platform),
  );
  const platforms = channels
    .map((c) => c.platform)
    .filter((p) => (p === "instagram" ? granted.instagram && Boolean(connection.instagramUserId) : granted.facebook));
  const importedAt = channels.reduce((latest, c) => {
    const at = c.importedAt instanceof Date ? c.importedAt : c.importedAt ? new Date(c.importedAt) : null;
    return at && (!latest || at > latest) ? at : latest;
  }, null);

  const pending = platforms.filter((p) => !channels.find((c) => c.platform === p)?.importedAt);

  if (!platforms.length) {
    return { ...none, granted, importedAt, reason: channels.length ? "not_granted" : "not_connected" };
  }
  return { available: true, reason: null, granted, platforms, pending, importedAt };
}

/**
 * Where the first pull starts when nobody said.
 *
 * The later of "thirty days ago" and the company's own signup. Owner, on the
 * day the first Page connected: "fetch from the time they signed up so it
 * doesn't go all the way back" — a contractor who joined FieldQuo on Tuesday
 * does not want last month's Messenger threads filed as open conversations
 * in an inbox that starts on Tuesday. The thirty-day ceiling stays for a
 * company older than that, because the monthly review reads a month. A
 * missing company row (the check stub, a race with deletion) falls back to
 * the thirty days rather than to "everything".
 */
export async function defaultImportSince({ companyId, now = new Date() } = {}) {
  const floor = new Date(now.getTime() - IMPORT_DEFAULT_SINCE_DAYS * 24 * 60 * 60 * 1000);
  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { createdAt: true } })
    .catch(() => null);
  const signedUp = company?.createdAt instanceof Date ? company.createdAt : company?.createdAt ? new Date(company.createdAt) : null;
  return signedUp && signedUp > floor ? signedUp : floor;
}

/**
 * Pull the company's existing Page and Instagram conversations into the inbox.
 *
 * @param since   only conversations Meta last updated at or after this moment
 *                (default: defaultImportSince — the company's signup, capped
 *                at IMPORT_DEFAULT_SINCE_DAYS ago). The CONVERSATION
 *                is the unit — a thread updated last week is imported with all
 *                of its most recent 50 messages, older ones included, because
 *                a reply without the question above it is not a conversation.
 * @param limit   conversations per platform (default IMPORT_DEFAULT_LIMIT)
 * @param platforms  restrict the pull to these platforms (default: every
 *                platform the grant allows) — the connect-time trigger passes
 *                the ones still unstamped
 * @param dryRun  map everything, ingest nothing, stamp nothing — the counts
 *                say what a real run would do
 * @param fetchConversations  the Graph call; injectable so the check script
 *                can run the whole loop against an in-memory client
 *
 * @returns {Promise<{ kind: string, conversations: number, messages: number,
 *                     skipped: number, errors: number, created: number,
 *                     platforms: object, lastError: object|null, dryRun: boolean }>}
 *
 *   kind  "ok" | "demo" | "not_connected" | "not_granted" | "error"
 *
 * `created` is how many message rows were genuinely NEW — the number the
 * toast quotes as "3 new", read off the ingest's own `created` rather than
 * counted here, so a second run says "0 new" because it wrote nothing.
 *
 * Never throws for a Meta refusal: `lastError` carries classifyMetaError's
 * kind and the platform, and an auth_error also flips the channel to
 * needs_reauth exactly as the send path's refusal would — a dead token
 * becomes a visible state on the inbox instead of an import that quietly
 * finds nothing.
 */
export async function importPageConversations({
  companyId,
  since,
  limit = IMPORT_DEFAULT_LIMIT,
  platforms = null,
  dryRun = false,
  fetchConversations = listPageConversations,
  now = new Date(),
} = {}) {
  const base = {
    conversations: 0,
    messages: 0,
    skipped: 0,
    errors: 0,
    created: 0,
    platforms: {},
    lastError: null,
    dryRun: Boolean(dryRun),
  };

  const state = await pageImportState(companyId);
  if (!state.available) return { ...base, kind: state.reason || "not_connected" };

  const connection = await getPageConnection(companyId);
  const wanted = Array.isArray(platforms)
    ? state.platforms.filter((p) => platforms.includes(p))
    : state.platforms;
  const channels = (await listChannels(companyId)).filter((c) => wanted.includes(c.platform));
  const sinceAt = since instanceof Date ? since : await defaultImportSince({ companyId, now });
  const businessIds = new Set([connection.pageId, connection.instagramUserId].filter(Boolean));
  const result = { ...base, kind: "ok" };

  for (const channel of channels) {
    const counts = emptyCounts();
    result.platforms[channel.platform] = counts;

    let pageToken = null;
    try {
      pageToken = decryptedChannelToken(channel);
    } catch {
      pageToken = null;
    }
    if (!pageToken) {
      counts.errors += 1;
      result.errors += 1;
      result.lastError = { kind: "auth_error", platform: channel.platform, message: "The stored Page token can't be read." };
      continue;
    }

    let after = null;
    let stop = false;
    let failed = false;
    let shape = 0;
    while (!stop && counts.conversations < limit) {
      const res = await fetchConversations({
        pageAccessToken: pageToken,
        pageId: connection.pageId,
        platform: channel.platform,
        after,
        limit: Math.min(PAGE_SHAPES[shape].limit, limit - counts.conversations),
        messagesLimit: PAGE_SHAPES[shape].messagesLimit,
      });
      if (isTooMuchDataError(res) && shape + 1 < PAGE_SHAPES.length) {
        // Same page, smaller ask. Not counted as an error: it is Meta
        // negotiating a size, and the retry usually lands.
        shape += 1;
        continue;
      }
      if (!res?.ok) {
        counts.errors += 1;
        result.errors += 1;
        result.lastError = { kind: res?.kind || "unknown_error", platform: channel.platform, message: res?.message || null };
        if (res?.kind === "auth_error" && !dryRun) {
          await recordChannelError({
            channelId: channel.id,
            status: "needs_reauth",
            error: `import: ${res.message || "auth_error"}`,
          }).catch(() => null);
        }
        failed = true;
        break;
      }

      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      for (const conversation of rows) {
        if (counts.conversations >= limit) break;
        // Newest-updated first, so the first stale one ends the platform.
        if (!conversationUpdatedSince(conversation, sinceAt)) {
          stop = true;
          break;
        }
        const { events, skipped } = graphConversationToEvents({
          platform: channel.platform,
          // The value the ingest resolves the tenant by — the Page id for
          // Facebook, the Instagram account id for Instagram — which is what
          // this channel row's externalId holds by construction.
          pageExternalId: channel.externalId,
          businessIds,
          conversation,
        });
        counts.skipped += skipped;
        result.skipped += skipped;
        if (!events.length) continue;
        counts.conversations += 1;
        result.conversations += 1;
        for (const event of events) {
          counts.messages += 1;
          result.messages += 1;
          if (dryRun) continue;
          const outcome = await ingestEvent(event).catch((err) => ({
            handled: false,
            reason: `error:${err?.message || "unknown"}`,
          }));
          if (!outcome.handled) {
            counts.skipped += 1;
            result.skipped += 1;
            if (String(outcome.reason || "").startsWith("error:")) {
              counts.errors += 1;
              result.errors += 1;
              result.lastError = { kind: "unknown_error", platform: channel.platform, message: outcome.reason };
            }
          } else if (outcome.created) {
            result.created += 1;
          }
        }
      }
      after = stop ? null : nextConversationCursor(res.data);
      if (!after) stop = true;
    }

    // Stamped only after a run that reached Meta and came back — a refused
    // pull is retried by the next connect or press, not recorded as done.
    if (!dryRun && !failed) {
      await stampChannelImported({ channelId: channel.id, at: now }).catch(() => null);
    }
  }

  if (result.errors && !result.conversations) result.kind = "error";
  return result;
}

/**
 * The manual "Refresh from Facebook".
 *
 * Rate-limited per COMPANY on the stamp the import itself writes, so the
 * limit holds across Vercel's instances (lib/rateLimit.js's in-memory window
 * is per-instance, and per-IP — two people in one office would share one and
 * two instances would each grant one). Returns { kind: "rate_limited",
 * retryAfterSeconds } instead of running; the route turns that into a 429.
 */
export async function refreshPageConversations({ companyId, now = new Date(), ...rest } = {}) {
  const state = await pageImportState(companyId);
  if (state.available && state.importedAt) {
    const elapsed = now.getTime() - state.importedAt.getTime();
    if (elapsed >= 0 && elapsed < IMPORT_MIN_INTERVAL_MS) {
      return {
        kind: "rate_limited",
        retryAfterSeconds: Math.ceil((IMPORT_MIN_INTERVAL_MS - elapsed) / 1000),
        conversations: 0,
        messages: 0,
        skipped: 0,
        errors: 0,
        created: 0,
        platforms: {},
        lastError: null,
        dryRun: false,
      };
    }
  }
  return importPageConversations({ companyId, now, ...rest });
}

/**
 * The connect-time trigger: once, right after a successful connect.
 *
 * Guarded on the stamp, PER PLATFORM — a channel that has ever been imported
 * is not imported again by a reconnect (the manual refresh is for that, and
 * it says so), and a channel Meta refused last time is the only thing the
 * next run pulls. Never throws: the callers are the OAuth callback, the Page-picker
 * finalize step and the subscribe retry, all of which have already stored a
 * working connection, and an import failure must not undo or delay that. A
 * failure is written to the platform error log, where a superadmin can see
 * it, rather than swallowed.
 *
 * @returns {Promise<object|null>} the import result, or null when skipped
 */
export async function importAfterConnect({ companyId } = {}) {
  try {
    const state = await pageImportState(companyId);
    if (!state.available || !state.pending.length) return null;
    const result = await importPageConversations({ companyId, platforms: state.pending });
    if (result.lastError) {
      await recordError({
        area: "webhook",
        code: `page_import_${result.lastError.kind}`,
        message: `Page conversation import for ${companyId}: ${result.lastError.message || result.lastError.kind}`,
        companyId,
        detail: { platform: result.lastError.platform, counts: result.platforms },
      });
    }
    return result;
  } catch (err) {
    await recordError({
      area: "webhook",
      code: "page_import_threw",
      message: `Page conversation import for ${companyId} threw: ${err?.message || "unknown"}`,
      companyId,
      detail: errorDetail(err),
    });
    return null;
  }
}
