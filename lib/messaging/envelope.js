// lib/messaging/envelope.js
//
// Meta's messaging webhook body -> a flat list of things that happened.
//
// Pure, total, and never throws: a webhook parser that throws on an
// unrecognised field turns Meta's next payload addition into a 500 loop and a
// disabled subscription. Anything this file does not understand is DROPPED
// (and counted), never guessed at.
//
// ── The envelope, as Meta sends it ─────────────────────────────────────────
//
//   { object: "page" | "instagram",
//     entry: [ { id: "<page id>", time, messaging: [ event, … ] } ] }
//
// and each event is one of:
//
//   { sender: {id}, recipient: {id}, timestamp,
//     message: { mid, text?, attachments?, is_echo? } }   a message
//   { sender, recipient, delivery: { mids: [...], watermark } }
//   { sender, recipient, read: { watermark } }
//
// Instagram uses the identical shape with object:"instagram", which is why
// there is one parser and one pair of tables rather than two of each.
//
// ── Which id is the tenant, and which is the stranger ──────────────────────
//
// `entry.id` is the PAGE (or Instagram business account). That is the ONLY
// field lib/messaging/ingest.js resolves a company from, and it is resolved by
// database lookup — never by anything else in the payload, and never by a
// companyId a caller could put in the body.
//
// For an inbound message sender is the homeowner and recipient is the Page.
// For an ECHO — a message the contractor sent, from Meta's own inbox or from
// FieldQuo — those are the other way round. Getting this backwards files the
// contractor's own replies as if a homeowner wrote them, which would corrupt
// the one number the month-end review exists to produce (did we answer, and
// how fast). So the participant is derived from the direction, both directions
// are covered, and the check script executes an echo.
//
// ── Why the thread key is the participant, not a conversation id ───────────
//
// The messaging webhook carries no conversation id at all — Meta's own docs
// key a conversation by the page-scoped id of the person. So externalThreadId
// is that PSID: stable for the life of the Page/person pair, which is exactly
// the identity a thread has.

/** The two `object` values this webhook can carry, mapped to our platform. */
const OBJECT_TO_PLATFORM = {
  page: "facebook",
  instagram: "instagram",
};

const asDate = (ms) => {
  const n = Number(ms);
  // Meta sends epoch milliseconds. A missing or nonsense timestamp becomes
  // null rather than `new Date()` — "when it happened" is the input to every
  // response-time figure in the monthly review, and substituting "now" for an
  // unknown time invents a fast reply out of a missing field.
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Meta's attachment array, kept as { type, url } pairs.
 *
 * Returns null rather than [] when there is nothing: an empty array in the
 * column would say "we looked and there were no attachments" for a text-only
 * message, which is true but noisier than null and makes every row bigger.
 */
function parseAttachments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const a of raw) {
    const type = typeof a?.type === "string" ? a.type : null;
    const url = typeof a?.payload?.url === "string" ? a.payload.url : null;
    // An attachment we can neither name nor fetch is not information; a
    // typed one with no URL still is (a sticker, a location share).
    if (!type) continue;
    out.push({ type, url });
  }
  return out.length ? out : null;
}

/**
 * @param {unknown} payload  the parsed JSON body
 * @returns {{ platform: string|null, events: Array, dropped: number }}
 *
 * Each event is:
 *   { kind: "message", platform, pageExternalId, threadExternalId,
 *     participantExternalId, direction: "in"|"out", externalId, body,
 *     attachments, sentAt }
 *   { kind: "delivery"|"read", platform, pageExternalId, threadExternalId,
 *     participantExternalId, watermark: Date|null, mids: string[] }
 */
export function parseMessagingEnvelope(payload) {
  const platform = OBJECT_TO_PLATFORM[payload?.object] || null;
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const events = [];
  let dropped = 0;

  if (!platform) {
    // Meta sends other webhook objects (page feed, mentions) to the same
    // callback URL when subscribed. Not an error and not ours — an empty
    // result, so the route still answers 200 and Meta keeps the subscription.
    return { platform: null, events: [], dropped: entries.length };
  }

  for (const entry of entries) {
    const pageExternalId = typeof entry?.id === "string" ? entry.id : null;
    const items = Array.isArray(entry?.messaging) ? entry.messaging : [];
    if (!pageExternalId) {
      dropped += items.length || 1;
      continue;
    }

    for (const item of items) {
      const senderId = typeof item?.sender?.id === "string" ? item.sender.id : null;
      const recipientId = typeof item?.recipient?.id === "string" ? item.recipient.id : null;
      if (!senderId || !recipientId) {
        dropped++;
        continue;
      }

      // The direction test is "did the PAGE send it", asked of the entry id we
      // already trust — not of `is_echo` alone, which is absent on some
      // Instagram echoes.
      const fromPage = senderId === pageExternalId || item?.message?.is_echo === true;
      const participantExternalId = fromPage ? recipientId : senderId;

      const common = {
        platform,
        pageExternalId,
        threadExternalId: participantExternalId,
        participantExternalId,
      };

      if (item?.message) {
        const mid = typeof item.message.mid === "string" ? item.message.mid : null;
        if (!mid) {
          // No id means no idempotency key, and a message that cannot be
          // de-duplicated would be re-inserted on every Meta retry.
          dropped++;
          continue;
        }
        events.push({
          ...common,
          kind: "message",
          direction: fromPage ? "out" : "in",
          externalId: mid,
          body: typeof item.message.text === "string" ? item.message.text : "",
          attachments: parseAttachments(item.message.attachments),
          sentAt: asDate(item.timestamp),
        });
        continue;
      }

      if (item?.delivery) {
        events.push({
          ...common,
          kind: "delivery",
          watermark: asDate(item.delivery.watermark),
          mids: Array.isArray(item.delivery.mids)
            ? item.delivery.mids.filter((m) => typeof m === "string")
            : [],
        });
        continue;
      }

      if (item?.read) {
        events.push({
          ...common,
          kind: "read",
          watermark: asDate(item.read.watermark),
          mids: [],
        });
        continue;
      }

      // A postback, an opt-in, a reaction, a referral. Real Meta events this
      // build does nothing with — counted so the route can log a number rather
      // than pretending the payload was empty.
      dropped++;
    }
  }

  return { platform, events, dropped };
}
