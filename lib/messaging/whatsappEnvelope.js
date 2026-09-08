// lib/messaging/whatsappEnvelope.js
//
// WhatsApp Cloud API's webhook body -> the same flat event list
// lib/messaging/envelope.js produces for Facebook and Instagram.
//
// ══ Why a second parser and not a branch in the first ══════════════════════
//
// Because it is a genuinely different envelope, not a variant of one. Meta's
// messaging webhook is `{ object: "page", entry: [{ id, messaging: [...] }] }`
// with sender/recipient on every event. WhatsApp's is
//
//   { object: "whatsapp_business_account",
//     entry: [ { id: "<WABA id>",
//                changes: [ { field: "messages",
//                             value: { messaging_product: "whatsapp",
//                                      metadata: { display_phone_number,
//                                                  phone_number_id },
//                                      contacts: [ { profile: { name }, wa_id } ],
//                                      messages: [ … ],
//                                      statuses: [ … ] } } ] } ] }
//
// (developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples,
// read 2026-09-08.)
//
// Different nesting, different id semantics, different direction rule,
// different receipt model. Writing one parser with a mode flag would mean
// every field access asking which shape it was looking at — which is how a
// parser ends up reading Facebook's `entry.id` as WhatsApp's tenant key.
//
// What IS shared is the OUTPUT. Both files emit the same events, so
// lib/messaging/ingest.js gained no branch at all.
//
// ══ Which id is the tenant ═════════════════════════════════════════════════
//
// `entry.id` is the WhatsApp Business Account id. `value.metadata.
// phone_number_id` is the NUMBER. The number is the tenant key — that is what
// MessagingChannel.externalId holds and what the send path posts to — because
// one WABA may hold several numbers and a company may connect one of them.
// Resolving on the WABA would file a second number's messages into the first
// number's inbox.
//
// Either way the resolution is a DATABASE LOOKUP of an id Meta put in the
// payload against our own rows (ingest.js). Nothing in the body names a
// company, and a forged POST for a number FieldQuo does not hold writes
// nothing at all.
//
// ══ Direction ═════════════════════════════════════════════════════════════
//
// WhatsApp does not echo the business's own outbound messages back as
// `messages` entries the way Messenger does. Every entry in `messages` is
// INBOUND, from the customer, and `from` is their wa_id. Outbound is reported
// only through `statuses`. So there is no is_echo test here and no
// sender-vs-page comparison — asserting direction "in" is the correct reading
// of this envelope, not a simplification of it.
//
// Pure, total, never throws: an unrecognised field is DROPPED and counted, so
// Meta's next payload addition is a number in a log rather than a 500 loop
// that gets the subscription disabled.

// The two payload normalisers, imported rather than copied, so what this
// writes into Message.attachments is exactly what lib/messaging/attachments.js
// reads back out of it. That module imports nothing at all (pinned by
// scripts/check-messaging.mjs), so this stays a pure parser with no server-only
// dependency reachable through it.
import { normaliseLocation, normaliseContacts } from "./attachments";

/** The one `object` value this webhook carries. */
const WHATSAPP_OBJECT = "whatsapp_business_account";

/** Our platform string for it — lib/messaging/platforms.js owns the set. */
const PLATFORM = "whatsapp";

/**
 * WhatsApp sends epoch SECONDS, where Messenger sends milliseconds. This is
 * the single most consequential difference between the two files: reading
 * seconds as milliseconds puts every message in January 1970, which would
 * make every response-time figure in the monthly review nonsense and — worse
 * — would make lastInboundAt fifty years old, so the 24-hour window would
 * read CLOSED on every live conversation.
 */
const asDate = (seconds) => {
  const n = Number(seconds);
  // Missing or nonsense becomes null rather than `new Date()`. Substituting
  // "now" for an unknown time invents a fast reply out of a missing field —
  // the same rule envelope.js states.
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The media kinds WhatsApp can deliver as a FILE, and the property each hangs
 * its object off. A message of type "image" carries
 * `image: { id, mime_type, caption }`.
 *
 * Listed rather than "anything that is not text", because a location, a
 * contact card and a reaction are also not text and none of them is a media id
 * we could fetch. Those three are handled below on their own terms — as a
 * payload, not as bytes — which is the change that stopped a dropped pin
 * arriving as an empty bubble.
 */
const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"];

/**
 * Types this file understands well enough that they need no residual "other"
 * row: their content is already somewhere the renderer will find it — in the
 * body (text, a button tap, a reaction's emoji) or in a typed attachment.
 *
 * Everything NOT in here and not in MEDIA_TYPES becomes an `other` attachment
 * naming Meta's own word for it, which is the whole point: a message row with
 * an empty body and no attachment is a row that reads as a message we lost.
 * WhatsApp really does deliver `order`, `system`, `request_welcome` and
 * `unsupported` to this webhook, and every one of them used to land as
 * nothing.
 */
const SELF_DESCRIBING_TYPES = ["text", "button", "interactive"];

/**
 * Inbound media, as far as a webhook can tell us.
 *
 * WhatsApp does NOT put a URL in the webhook the way Messenger does — it puts
 * a media ID, and the bytes need two authenticated Graph calls to reach
 * (GET /<media-id> for a signed URL that expires in five minutes, then a GET
 * on that URL carrying the token). So `url` is null here and stays null: a
 * fabricated URL in the column would render as a broken image, and a synchronous
 * fetch inside a webhook parser would make Meta's retry clock depend on
 * Cloudinary. lib/messaging/mediaFetch.js does the fetching, out of band, from
 * this id — driven by /api/cron/messaging-media and by the Retry control on a
 * bubble whose fetch failed. It fills `url` with a CLOUDINARY link and never
 * with a Graph one, which is the invariant lib/messaging/attachments.js owns
 * and the check script executes.
 *
 * (This comment used to name lib/messaging/whatsappMedia.js as the fetcher.
 * That file exists and is the SEND half — Meta's documented size limits, and
 * the POST /{phone-number-id}/media upload. The fetcher serves all three
 * platforms, so it is not WhatsApp's.)
 *
 * The SHAPE is deliberately Messenger's — { type, url } plus extras — because
 * Message.attachments is one column read by one renderer, and a second shape
 * in it would mean the bubble had to ask which platform wrote the row.
 */
function parseMedia(message) {
  const type = typeof message?.type === "string" ? message.type : null;
  if (!type) return null;

  // ── A dropped pin ────────────────────────────────────────────────────────
  //
  // No id, no bytes, nothing to fetch — and very often the JOB ADDRESS, which
  // is why it is stored as a payload the bubble draws rather than counted as
  // an attachment we could not retrieve. normaliseLocation is imported rather
  // than re-implemented so the shape written here is exactly the shape read
  // back; a pin whose coordinates do not parse becomes a named row with no
  // map, never a confident marker on (0, 0).
  if (type === "location") {
    return [{ type: "location", url: null, location: normaliseLocation(message.location) }];
  }

  // ── A shared contact card ────────────────────────────────────────────────
  //
  // WhatsApp's key is the plural `contacts` and one message may carry several.
  // Same argument as the pin: the card IS the message.
  if (type === "contacts") {
    return [{ type: "contact", url: null, contacts: normaliseContacts(message.contacts) }];
  }

  if (MEDIA_TYPES.includes(type)) {
    const media = message[type];
    const id = typeof media?.id === "string" ? media.id : null;
    // A media type with no id is a payload we cannot fetch and cannot draw.
    // Still a row — naming what arrived beats an empty bubble — and it lands
    // as `unavailable` rather than pending, because there is genuinely
    // nothing to go and get.
    if (!id) return [{ type, url: null, otherKind: null }];
    return [
      {
        type,
        // Null, always, and honestly: see above. Present so the column's shape
        // matches Messenger's rather than being a second thing to handle.
        url: null,
        mediaId: id,
        mimeType: typeof media?.mime_type === "string" ? media.mime_type : null,
        filename: typeof media?.filename === "string" ? media.filename : null,
        // The one difference between a voice note and an attached audio file,
        // and it is a LABEL difference: both play in the same player. Meta
        // sends the boolean on every audio message, so `undefined` here means
        // another platform rather than "not a voice note".
        ...(type === "audio" ? { voice: media?.voice === true } : {}),
        // Animated stickers are animated WebP; a browser draws them with no
        // help from us. Carried so the row can say which it is.
        ...(type === "sticker" ? { animated: media?.animated === true } : {}),
      },
    ];
  }

  // Its content is already in the body — see parseBody. No attachment row,
  // because there would be nothing on it.
  if (SELF_DESCRIBING_TYPES.includes(type)) return null;

  // A reaction is its emoji, and the emoji is the body. A reaction being
  // REMOVED arrives with an empty emoji, which would leave an empty bubble —
  // so that one, and only that one, gets a named row instead.
  if (type === "reaction") {
    const emoji = message.reaction?.emoji;
    return typeof emoji === "string" && emoji.trim()
      ? null
      : [{ type: "other", url: null, otherKind: "reaction" }];
  }

  // ── Everything else, named rather than dropped ───────────────────────────
  //
  // `order`, `system`, `request_welcome`, `unsupported`, and whatever Meta
  // ships next. The row says what arrived in Meta's own word. That is not a
  // great sentence and it is strictly more than the empty bubble this used to
  // produce, which is what the owner asked us to stop shipping.
  return [{ type: "other", url: null, otherKind: type }];
}

/**
 * The TEXT of an inbound message, whatever kind it is.
 *
 * A media message's caption counts as its text — it is what the person typed,
 * and dropping it would leave the thread showing an attachment with no words
 * beside a reply that answers words nobody can see. An interactive reply
 * (a button or list tap) carries its title, which is likewise what the person
 * chose. Everything else is "" rather than an invented description.
 */
function parseBody(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  if (type === "text") return typeof message.text?.body === "string" ? message.text.body : "";
  if (MEDIA_TYPES.includes(type)) {
    const caption = message[type]?.caption;
    return typeof caption === "string" ? caption : "";
  }
  if (type === "button") {
    return typeof message.button?.text === "string" ? message.button.text : "";
  }
  if (type === "interactive") {
    const i = message.interactive;
    const title = i?.button_reply?.title ?? i?.list_reply?.title;
    return typeof title === "string" ? title : "";
  }
  // A reaction IS its emoji. Rendered as the body rather than as an attachment
  // because it is a thing the person "said", and because the alternative — a
  // row reading "Attachment (reaction)" — describes the message instead of
  // showing it. Meta sends an EMPTY emoji when a reaction is REMOVED, and
  // parseMedia turns that case into a named row instead, so neither version
  // arrives as an empty bubble.
  if (type === "reaction") {
    const emoji = message.reaction?.emoji;
    return typeof emoji === "string" ? emoji.slice(0, 16) : "";
  }
  // A location's name and address ride on the ATTACHMENT, where the card draws
  // them next to the map. Repeating the name as the body would print it twice.
  return "";
}

/**
 * @param {unknown} payload  the parsed JSON body
 * @returns {{ platform: string|null, events: Array, dropped: number }}
 *
 * Events are exactly lib/messaging/envelope.js's shapes, so ingest.js handles
 * both with no branch:
 *
 *   { kind: "message", platform, pageExternalId, threadExternalId,
 *     participantExternalId, participantName, direction: "in", externalId,
 *     body, attachments, sentAt }
 *   { kind: "delivery"|"read"|"failed", …, mids: [message id], watermark }
 */
export function parseWhatsAppEnvelope(payload) {
  if (payload?.object !== WHATSAPP_OBJECT) {
    // Not ours. An empty result rather than an error, so the route still
    // answers 200 and Meta keeps the subscription — the same reasoning
    // envelope.js gives for page feed and mention events.
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    return { platform: null, events: [], dropped: entries.length };
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const events = [];
  let dropped = 0;

  for (const entry of entries) {
    const wabaId = typeof entry?.id === "string" ? entry.id : null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      // Only `messages`. A WABA also delivers message_template_status_update,
      // account_update, phone_number_quality_update and more to the same URL
      // once subscribed; none of them is a conversation, and guessing at one
      // would write a row for an event nobody asked for.
      if (change?.field !== "messages") {
        dropped++;
        continue;
      }

      const value = change.value;
      const phoneNumberId =
        typeof value?.metadata?.phone_number_id === "string"
          ? value.metadata.phone_number_id
          : null;
      if (!phoneNumberId) {
        // No tenant key, so nothing can be resolved. Counted, not guessed at
        // from `entry.id` — the WABA is not the number.
        dropped +=
          (Array.isArray(value?.messages) ? value.messages.length : 0) +
          (Array.isArray(value?.statuses) ? value.statuses.length : 0) || 1;
        continue;
      }

      // The profile name, keyed by wa_id. WhatsApp sends it once per payload
      // in `contacts` rather than on each message, so it is looked up rather
      // than read off the message.
      const names = new Map();
      for (const c of Array.isArray(value?.contacts) ? value.contacts : []) {
        if (typeof c?.wa_id === "string" && typeof c?.profile?.name === "string") {
          names.set(c.wa_id, c.profile.name);
        }
      }

      for (const message of Array.isArray(value?.messages) ? value.messages : []) {
        const id = typeof message?.id === "string" ? message.id : null;
        const from = typeof message?.from === "string" ? message.from : null;
        if (!id || !from) {
          // No id means no idempotency key; no `from` means no participant.
          // Either way there is nothing that could be de-duplicated, and Meta
          // re-delivers for hours.
          dropped++;
          continue;
        }
        events.push({
          kind: "message",
          platform: PLATFORM,
          // Named `pageExternalId` because that is what ingest.js resolves the
          // channel from. It holds the PHONE NUMBER ID here — see the header
          // for why the number and not the WABA. Renaming the field across
          // both parsers to something platform-neutral was the alternative and
          // was rejected: the field is a channel key on both, and one rename
          // touching the tenant-boundary file is a worse trade than one
          // comment.
          pageExternalId: phoneNumberId,
          // The customer's wa_id — their phone number in international format
          // with no "+". Stable per number, which is exactly the identity a
          // thread has, and the handle the send API takes as `to`.
          threadExternalId: from,
          participantExternalId: from,
          participantName: names.get(from) || null,
          // Always inbound. See the header: WhatsApp never echoes the
          // business's own sends into `messages`.
          direction: "in",
          externalId: id,
          body: parseBody(message),
          attachments: parseMedia(message),
          sentAt: asDate(message.timestamp),
          // Carried so the ingest can stamp a WABA it did not previously hold
          // — a number connected before this field existed has a null wabaId,
          // and the first inbound message is a free chance to learn it.
          wabaId,
        });
      }

      for (const status of Array.isArray(value?.statuses) ? value.statuses : []) {
        const id = typeof status?.id === "string" ? status.id : null;
        const recipient = typeof status?.recipient_id === "string" ? status.recipient_id : null;
        const state = typeof status?.status === "string" ? status.status : null;
        if (!id || !recipient || !state) {
          dropped++;
          continue;
        }

        // ── Per MESSAGE, not per watermark ───────────────────────────────
        //
        // Messenger reports "everything up to this timestamp"; WhatsApp names
        // the message. Reporting a watermark here would stamp every earlier
        // outbound message as delivered on the strength of one that was —
        // and "delivered" on a message that was not is the quiet version of a
        // sent bubble for a message nobody received.
        const kind =
          state === "read" ? "read" : state === "failed" ? "failed" : state === "delivered" ? "delivery" : null;
        if (!kind) {
          // "sent" is Meta acknowledging its own queue, not the phone. It
          // tells a contractor nothing they cannot already see and stamping
          // deliveredAt from it would be wrong, so it is dropped on purpose.
          dropped++;
          continue;
        }

        events.push({
          kind,
          platform: PLATFORM,
          pageExternalId: phoneNumberId,
          threadExternalId: recipient,
          participantExternalId: recipient,
          watermark: asDate(status.timestamp),
          mids: [id],
          // Only present on a failure, and only when Meta gave one. The
          // message row records it verbatim so a contractor reading the
          // thread sees Meta's own words rather than "failed".
          error: kind === "failed" ? firstError(status.errors) : null,
        });
      }
    }
  }

  return { platform: PLATFORM, events, dropped };
}

function firstError(errors) {
  const first = Array.isArray(errors) ? errors[0] : null;
  if (!first) return null;
  const code = Number.isFinite(Number(first.code)) ? Number(first.code) : null;
  const title = typeof first.title === "string" ? first.title : null;
  const detail =
    typeof first.error_data?.details === "string" ? first.error_data.details : null;
  return { code, title, detail };
}
