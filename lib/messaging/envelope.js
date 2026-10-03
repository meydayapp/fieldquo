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

// Imported rather than copied so a Messenger pin is stored in exactly the
// shape lib/messaging/attachments.js reads back — see that file, which imports
// nothing at all and is therefore safe for a parser to lean on.
import { normaliseLocation } from "./attachments";

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
 * Meta's attachment array.
 *
 * ══ Why Meta's URL goes in `sourceUrl` and NOT in `url` ════════════════════
 *
 * Because it expires. A Messenger attachment arrives as a SIGNED CDN link
 * (scontent.xx.fbcdn.net, lookaside.fbsbx.com), and a signed link stored in
 * the column the bubble renders is a photo that shows correctly today, in
 * review, in the demo — and shows a broken image to the contractor who reopens
 * the thread next week. That is exactly the trap CrewInboundMessage.mediaUrls
 * records for Twilio ("those need auth to fetch and expire"), arriving from a
 * different vendor.
 *
 * So the invariant is the one lib/messaging/attachments.js states and the
 * check script executes: `url` is null, or it is a Cloudinary URL, and nothing
 * else is ever written into it. `sourceUrl` is what lib/messaging/mediaFetch.js
 * re-hosts FROM, it is stripped before anything reaches a browser, and it is
 * cleared the moment the durable copy exists.
 *
 * This is deliberately the SAME shape whatsappEnvelope.js emits, where the
 * fetchable thing is a media id rather than a URL. Message.attachments is one
 * column read by one renderer, and a second shape in it would mean the bubble
 * had to ask which platform wrote the row.
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

    // ── Messenger's location share, which has coordinates and no bytes ──────
    //
    // `payload.coordinates: { lat, long }`. Meta's field names differ from
    // WhatsApp's (`lat`/`long` vs `latitude`/`longitude`), which is exactly
    // why the mapping happens HERE and the stored shape is the shared one:
    // the renderer must never learn that two platforms spell a latitude
    // differently. A pin that does not parse falls through to a named row
    // with no map rather than a confident marker on (0, 0).
    if (type === "location") {
      const c = a?.payload?.coordinates;
      out.push({
        type: "location",
        url: null,
        location: normaliseLocation({
          latitude: c?.lat,
          longitude: c?.long,
          name: a?.title,
          address: null,
        }),
      });
      continue;
    }

    // A "fallback" is Meta saying "there was something here we cannot give
    // you" — a shared post, a story reply whose media has gone. Named with
    // Meta's own word so the row says what arrived instead of nothing.
    if (type === "fallback") {
      out.push({ type: "other", url: null, sourceUrl: url, otherKind: "fallback" });
      continue;
    }

    out.push({
      type,
      // Null, always, on the way in. Filled by the re-host, never by Meta.
      url: null,
      sourceUrl: url,
    });
  }
  return out.length ? out : null;
}

/**
 * Meta's click-to-message `referral` object -> the one shape the thread keeps.
 *
 * When a homeowner taps "Send message" on a Facebook or Instagram ad, Meta
 * says which ad it was: `{ ref, source: "ADS", type: "OPEN_THREAD", ad_id,
 * ads_context_data: { ad_title, post_id } }`. It arrives in one of three
 * places — inside the first `message` of a new conversation, as a standalone
 * `messaging_referrals` event on a conversation that already existed, or
 * inside a Get Started `postback` — and this build used to drop all three
 * (the comment at the bottom of the parser counted them as "a referral").
 * That ad id is the only thing that can credit a conversation, and the lead
 * built from it, to the campaign that paid for it (lib/leads/conversationLead.js
 * resolves it to a campaign the same way lib/meta/leadsFetch.js does for a
 * lead form).
 *
 * Kept narrow on purpose: ids are digits or nothing, text is clipped, and a
 * referral that names neither an ad nor a source is not information. Exported
 * because lib/messaging/whatsappEnvelope.js maps WhatsApp's differently-named
 * fields onto the same shape, so the thread column has ONE shape whichever
 * platform wrote it.
 */
export function cleanReferral({ adId = null, source = null, type = null, ref = null, adTitle = null, postId = null } = {}) {
  const digits = (v) => {
    const s = v === null || v === undefined ? "" : String(v).trim();
    return /^\d{3,32}$/.test(s) ? s : null;
  };
  const text = (v, max) => {
    if (typeof v !== "string") return null;
    const s = v.replace(/\s+/g, " ").trim();
    return s ? s.slice(0, max) : null;
  };
  const out = {
    adId: digits(adId),
    source: text(source, 40),
    type: text(type, 40),
    ref: text(ref, 200),
    adTitle: text(adTitle, 200),
    postId: text(postId, 80),
  };
  if (!out.adId && !out.source) return null;
  return out;
}

function parseReferral(raw) {
  if (!raw || typeof raw !== "object") return null;
  return cleanReferral({
    adId: raw.ad_id,
    source: raw.source,
    type: raw.type,
    ref: raw.ref,
    adTitle: raw.ads_context_data?.ad_title,
    postId: raw.ads_context_data?.post_id,
  });
}

/**
 * @param {unknown} payload  the parsed JSON body
 * @returns {{ platform: string|null, events: Array, dropped: number }}
 *
 * Each event is:
 *   { kind: "message", platform, pageExternalId, threadExternalId,
 *     participantExternalId, direction: "in"|"out", externalId, body,
 *     attachments, sentAt, referral: cleanReferral()|null }
 *   { kind: "referral", platform, pageExternalId, threadExternalId,
 *     participantExternalId, referral, sentAt }
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
          // The ad the conversation was opened from, when Meta says. Read off
          // an inbound message only: an echo is the PAGE talking, and an ad id
          // on it would be nothing the homeowner clicked.
          referral: fromPage ? null : parseReferral(item.message.referral || item.referral),
        });
        continue;
      }

      // ── An ad click on a conversation that already existed ─────────────
      //
      // `messaging_referrals`, or a Get Started postback that carries one.
      // There is no message to store, so it becomes its own small event that
      // ingest.js files onto the thread if the thread exists. Anything else a
      // postback carries is still not ours and falls through to `dropped`.
      const standalone = !fromPage ? parseReferral(item.referral || item.postback?.referral) : null;
      if (standalone) {
        events.push({ ...common, kind: "referral", referral: standalone, sentAt: asDate(item.timestamp) });
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

      // A postback with no ad behind it, an opt-in, a reaction. Real Meta
      // events this build does nothing with — counted so the route can log a number rather
      // than pretending the payload was empty.
      dropped++;
    }
  }

  return { platform, events, dropped };
}
