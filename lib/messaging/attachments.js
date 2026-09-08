// lib/messaging/attachments.js
//
// What a picture in a conversation IS, before anybody has fetched it.
//
// ══ Why a shared shape and not a per-platform one ══════════════════════════
//
// Three platforms deliver an attachment three different ways:
//
//   WhatsApp    a media ID and nothing else. The bytes need TWO authenticated
//               Graph calls — GET /<media-id> for a signed URL that expires in
//               five minutes, then a GET on that URL carrying the app token.
//   Messenger   a signed CDN URL in the webhook, already fetchable, and
//               already expiring.
//   Instagram   the same as Messenger.
//
// Message.attachments is ONE column read by ONE renderer, so those three
// arrive here as one shape and the bubble never asks which platform wrote the
// row. That is the same argument lib/messaging/whatsappEnvelope.js's parseMedia
// already makes for its own output; this file is where the argument is
// enforced rather than restated.
//
// ══ THE INVARIANT, and the bug it exists to prevent ════════════════════════
//
//   `url` is null, or it is a Cloudinary URL. Never anything else.
//
// The crew inbox learnt this the expensive way, and its schema comment says so
// in as many words:
//
//   "Re-hosted to Cloudinary, not raw Twilio URLs — those need auth to fetch
//    and expire, and JobVisit.photos are shown to staff expecting durable
//    links."
//
// Meta's URLs have exactly the same two problems. A `scontent.xx.fbcdn.net`
// link stored in `url` renders today, in review, in the demo — and renders as
// a broken image to the contractor who opens the thread next week. A photo
// that silently vanished is the single failure this feature cares most about,
// so the expiring URL lives in `sourceUrl`, which is FETCHER-ONLY: it is never
// rendered, never sent to a browser (see publicAttachments below), and cleared
// the moment the durable copy exists.
//
// ══ Four states, because absence is not one thing ══════════════════════════
//
//   ready        a durable Cloudinary URL. Draw the picture.
//   pending      we hold a media id or a source URL and have not fetched it
//                yet. Say the picture is still arriving — NOT nothing, and
//                NOT a broken <img>.
//   failed       we tried and could not. Say so, and offer to try again.
//   unavailable  there is nothing to fetch and there never was: a location
//                share, a Messenger "fallback", a sticker Meta gave us no URL
//                for. Name the kind, offer no retry — a Retry button for
//                something that cannot be retrieved is a dead control.
//
// Pure, dependency-free and total. Every one of these decisions is executed
// against fixtures by scripts/check-messaging.mjs and scripts/check-whatsapp.mjs.

/**
 * The media kinds a bubble knows how to name. `other` is everything else —
 * a location, a contact card, a Messenger template — kept as a row rather
 * than dropped, because a message that shows nothing where the customer
 * attached something reads as a message we lost.
 */
export const ATTACHMENT_TYPES = Object.freeze([
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "other",
]);

/** Every state normaliseAttachment can return. */
export const ATTACHMENT_STATES = Object.freeze(["ready", "pending", "failed", "unavailable"]);

/**
 * Messenger says "file" where WhatsApp says "document", and both are the same
 * thing to a contractor. Mapped rather than branched on at render time: a
 * renderer that tests the platform is a renderer with three code paths and two
 * of them untested.
 */
const TYPE_ALIASES = Object.freeze({
  file: "document",
  photo: "image",
  img: "image",
});

/**
 * Cloudinary's delivery hosts, anchored at BOTH ends.
 *
 * This is the whole invariant above, as one regular expression, and it is a
 * security check rather than a tidiness one: it is what makes "the stored url
 * is durable" a fact the check script can execute instead of a claim a comment
 * makes. `evil-res.cloudinary.com`, `res.cloudinary.com.evil.com` and
 * `lookaside.fbsbx.com` all fail it.
 */
const CLOUDINARY_HOST = /^res(?:-\d+)?\.cloudinary\.com$/i;

/**
 * Is this a URL we are willing to put in `url` and render?
 *
 * https only, no userinfo (the `https://res.cloudinary.com@evil.com/` trick
 * parses to host evil.com), and a Cloudinary host.
 */
export function isDurableMediaUrl(url) {
  // A string, not something that stringifies into one — the same rule
  // lib/crew/inboundParse.js's isTwilioMediaUrl states, for the same reason.
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return CLOUDINARY_HOST.test(parsed.hostname);
}

/** A non-empty string, or null. Used everywhere below rather than `|| null`,
 *  which turns 0 and false into null and hides a type error. */
const str = (v) => (typeof v === "string" && v.trim() ? v : null);

/**
 * One stored entry -> the shape the renderer, the fetcher and the API all read.
 *
 * Total: any garbage in the column becomes an `unavailable` "other" row rather
 * than throwing. A conversation must never fail to load because one attachment
 * was written by a version of this code that no longer exists.
 */
export function normaliseAttachment(entry, index = 0) {
  const raw = entry && typeof entry === "object" ? entry : {};
  const declared = typeof raw.type === "string" ? raw.type.toLowerCase() : "";
  const aliased = TYPE_ALIASES[declared] || declared;
  const type = ATTACHMENT_TYPES.includes(aliased) ? aliased : "other";

  const stored = str(raw.url);
  // ── A raw Meta URL sitting in `url` is treated as a SOURCE, not a picture ──
  //
  // Rows written before this file existed carry Messenger's own CDN link in
  // `url`. Rendering it would be exactly the broken image this module exists
  // to prevent, so it is re-read as something to fetch. The invariant is
  // enforced on the way OUT, which is the only place it can be enforced for
  // data that is already in the database.
  const durable = stored && isDurableMediaUrl(stored) ? stored : null;
  const source = str(raw.sourceUrl) || (stored && !durable ? stored : null);
  const mediaId = str(raw.mediaId);
  const error = str(raw.fetchError);

  const attempts = Number.isFinite(Number(raw.fetchAttempts))
    ? Math.max(0, Math.trunc(Number(raw.fetchAttempts)))
    : 0;

  let state;
  if (durable) state = "ready";
  else if (error) state = "failed";
  else if (mediaId || source) state = "pending";
  else state = "unavailable";

  return {
    // Stable within a message, and it is what the retry endpoint names. The
    // ARRAY INDEX rather than an id of our own: these entries have no
    // identity beyond their position in one JSON column, and minting one
    // would be a second key that could disagree with the position the
    // renderer used.
    index,
    type,
    state,
    url: durable,
    sourceUrl: source,
    mediaId,
    mimeType: str(raw.mimeType),
    filename: str(raw.filename),
    fetchAttempts: attempts,
    fetchError: error,
  };
}

/** The whole column. Null/garbage becomes [], never a throw. */
export function normaliseAttachments(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry, i) => normaliseAttachment(entry, i));
}

/**
 * How many times the cron will try one attachment before it stops on its own.
 *
 * Finite, because the cron runs every minute forever and a media id Meta has
 * expired (seven days for a webhook-delivered id) will never resolve — a
 * retry loop on it is a permanent, invisible cost. A contractor can still ask
 * for one more attempt by hand; that path resets the counter, deliberately,
 * because a person pressing Retry is new information.
 */
export const MEDIA_FETCH_MAX_ATTEMPTS = 5;

/**
 * Is this entry something the CRON should pick up now?
 *
 * A failed entry is NOT retried automatically past the ceiling. A pending one
 * always is.
 */
export function isFetchable(entry) {
  const a = entry && entry.state ? entry : normaliseAttachment(entry);
  if (a.state === "ready" || a.state === "unavailable") return false;
  if (!a.mediaId && !a.sourceUrl) return false;
  return a.fetchAttempts < MEDIA_FETCH_MAX_ATTEMPTS;
}

/**
 * Does this message still have work for the fetcher?
 *
 * THE predicate behind Message.mediaPending — written by the ingest, read by
 * the cron. One function so the column and the query can never disagree about
 * what "pending" means, which is how a flag ends up permanently true.
 */
export function hasFetchableMedia(list) {
  return normaliseAttachments(list).some(isFetchable);
}

/**
 * Record the outcome of one fetch attempt, returning a NEW list to store.
 *
 * Pure: it takes the stored column and gives back the stored column. The cron
 * does the network and this decides what that means, so "a failure is its own
 * state and keeps its reason" is executable without a Graph call.
 *
 * @param list    the stored attachments column
 * @param index   which entry
 * @param result  { url } on success, { error } on failure
 */
export function withFetchResult(list, index, result = {}) {
  const current = Array.isArray(list) ? list : [];
  return current.map((entry, i) => {
    if (i !== index) return entry;
    const a = normaliseAttachment(entry, i);
    const url = str(result.url);
    if (url && isDurableMediaUrl(url)) {
      return {
        type: a.type,
        // The durable copy, and the expiring one dropped in the same write.
        // Keeping sourceUrl after a successful re-host would leave a dead
        // Meta link in the database for no reader — and one day a reader.
        url,
        sourceUrl: null,
        mediaId: a.mediaId,
        mimeType: a.mimeType,
        filename: a.filename,
        fetchAttempts: a.fetchAttempts + 1,
        fetchError: null,
      };
    }
    return {
      type: a.type,
      url: null,
      sourceUrl: a.sourceUrl,
      mediaId: a.mediaId,
      mimeType: a.mimeType,
      filename: a.filename,
      fetchAttempts: a.fetchAttempts + 1,
      // A sentence, kept verbatim, because "it failed" tells a contractor
      // nothing they can act on. Clamped: this is rendered in a bubble.
      fetchError: (str(result.error) || "The picture could not be fetched.").slice(0, 300),
    };
  });
}

/**
 * Clear the failure on one entry so the cron picks it up again.
 *
 * The attempt counter goes back to zero on purpose: a person pressing Retry
 * knows something the counter does not (Meta is back up, the number was
 * reconnected), and a Retry that quietly did nothing because a hidden counter
 * was spent is the dead control AGENTS.md's first rule forbids.
 */
export function withFetchReset(list, index) {
  const current = Array.isArray(list) ? list : [];
  return current.map((entry, i) => {
    if (i !== index) return entry;
    const a = normaliseAttachment(entry, i);
    return {
      type: a.type,
      url: a.url,
      sourceUrl: a.sourceUrl,
      mediaId: a.mediaId,
      mimeType: a.mimeType,
      filename: a.filename,
      fetchAttempts: 0,
      fetchError: null,
    };
  });
}

/**
 * What may be sent to a browser.
 *
 * `sourceUrl` is stripped. It is a signed, expiring Meta CDN link, and for
 * WhatsApp it is only fetchable with the company's own access token — handing
 * either to a browser would be publishing a credential-shaped URL onto a
 * screen, which is the same rule publicChannelShape keeps for tokens in
 * lib/messaging/channels.js. `mediaId` goes too: it is Meta's handle, not
 * information, and the retry endpoint names an INDEX rather than an id
 * precisely so the browser never needs it.
 */
export function publicAttachments(list) {
  return normaliseAttachments(list).map((a) => ({
    index: a.index,
    type: a.type,
    state: a.state,
    url: a.url,
    mimeType: a.mimeType,
    filename: a.filename,
    // Whether a Retry button should exist at all. Decided here, from the
    // state, rather than in the component — the component would then hold a
    // second copy of the rule and it is the copy that rots.
    retryable: a.state === "failed",
    error: a.fetchError,
  }));
}

/**
 * The i18n key naming this kind of attachment, for the row that is not a
 * picture. Keys, not sentences — the screen is read in nine languages, and
 * scripts/check-translations.mjs sees these as ordinary string literals.
 */
export function attachmentTypeKey(type) {
  switch (type) {
    case "image":
      return "app.messages.media.image";
    case "video":
      return "app.messages.media.video";
    case "audio":
      // "Voice message", not "Audio". On WhatsApp an inbound audio clip is
      // almost always somebody talking rather than a music file, and the
      // words a contractor uses for it are the ones that go on the row.
      return "app.messages.media.audio";
    case "document":
      return "app.messages.media.document";
    case "sticker":
      return "app.messages.media.sticker";
    default:
      return "app.messages.media.other";
  }
}
