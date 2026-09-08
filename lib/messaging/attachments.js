// lib/messaging/attachments.js
//
// What a thing a customer attached IS, before anybody has fetched it.
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
//   ready        there is something to draw: a durable Cloudinary URL, or a
//                self-contained payload (a pin's coordinates, a contact card's
//                names and numbers) that was never a file and never needed
//                fetching.
//   pending      we hold a media id or a source URL and have not fetched it
//                yet. Say the file is still arriving — NOT nothing, and
//                NOT a broken <img>.
//   failed       we tried and could not. Say so, and offer to try again.
//   unavailable  there is nothing to fetch and there never was, AND nothing to
//                draw either: a Messenger "fallback", a pin whose coordinates
//                did not parse, a sticker Meta gave us no URL for. Name the
//                kind, offer no retry — a Retry button for something that
//                cannot be retrieved is a dead control.
//
// A LOCATION or a CONTACT CARD is `ready` on arrival, and that is the whole
// reason "ready" is worded as "something to draw" rather than "we have the
// bytes". Both used to fall into `unavailable`, which was accurate about the
// fetch and wrong about the message: a dropped pin is very often the job
// address, and the row that said "nothing to open" was the dead row the owner
// asked us to stop shipping.
//
// Pure, dependency-free and total. Every one of these decisions is executed
// against fixtures by scripts/check-messaging.mjs and scripts/check-whatsapp.mjs.

/**
 * The kinds a bubble knows how to draw. `other` is everything else — a
 * reaction, a Messenger template, a type Meta adds next year — kept as a row
 * rather than dropped, because a message that shows nothing where the customer
 * attached something reads as a message we lost.
 *
 * `location` and `contact` are here because WhatsApp delivers both and neither
 * is a file. They carry their own payload instead of a media id, which is why
 * the state machine below asks "is there something to draw" rather than "is
 * there a url".
 */
export const ATTACHMENT_TYPES = Object.freeze([
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "location",
  "contact",
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
  // WhatsApp's own webhook key is the plural `contacts`, and one message can
  // carry several cards. The TYPE is singular because it names what a row is;
  // the `contacts` field below holds however many arrived.
  contacts: "contact",
  vcard: "contact",
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

/** A non-empty string, clamped. Everything below is rendered in a bubble, and
 *  a 4 KB "name" from a hostile vCard is a layout bug at best. */
const clamped = (v, max) => {
  const s = str(v);
  return s ? s.slice(0, max) : null;
};

/**
 * A dropped pin -> coordinates we are willing to draw, or null.
 *
 * ── Why a pin with no usable coordinates becomes NOTHING ───────────────────
 *
 * Because the alternative is a map of the Gulf of Guinea. `Number(undefined)`
 * is NaN and `Number(null)` is 0, so a half-parsed payload lands on (0, 0) —
 * a real place, rendered confidently, that the customer never pointed at.
 * AGENTS.md failure class 5: absence of a statement is not a statement. Both
 * numbers must be present, finite and in range, or there is no pin and the row
 * says so.
 *
 * Exported so lib/messaging/whatsappEnvelope.js stores the same shape this
 * reads back — one definition, applied on the way in AND on the way out, which
 * is what makes it total for a row written by a version that no longer exists.
 */
export function normaliseLocation(raw) {
  if (!raw || typeof raw !== "object") return null;
  // ── Number() is not a validator, and this is the trap ────────────────────
  //
  // Number(null) is 0. Number("") is 0. Number(false) is 0. Every one of those
  // is finite and in range, so a coordinate-shaped check that starts at
  // Number() waves a missing field straight through and draws a confident
  // marker in the Gulf of Guinea. So the TYPE is checked first: a coordinate
  // is a number, or a string Meta sent that parses as one, and nothing else.
  const coord = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string" || !v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const latitude = coord(raw.latitude);
  const longitude = coord(raw.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    latitude,
    longitude,
    // Both optional in Meta's payload, and both genuinely absent when somebody
    // drops a raw pin rather than sharing a saved place.
    name: clamped(raw.name, 120),
    address: clamped(raw.address, 300),
  };
}

/**
 * A shared contact card -> the two things a contractor does something with:
 * who it is, and what number to ring.
 *
 * WhatsApp's contact object also carries addresses, birthdays, emails, org and
 * urls. Emails and the organisation are kept because a homeowner forwarding
 * their property manager's card is the actual use; the rest is dropped rather
 * than stored and never read, which is AGENTS.md failure class 1.
 *
 * Total against BOTH shapes on purpose: Meta's snake_case (`formatted_name`,
 * `wa_id`) arriving at the webhook, and our own camelCase read back out of the
 * column afterwards. A single normaliser that only understood one of them
 * would corrupt every stored card the first time it was re-normalised.
 */
export function normaliseContacts(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  // Bounded: a message is one bubble, and a payload claiming five hundred
  // cards is not a contact share.
  for (const entry of raw.slice(0, 10)) {
    if (!entry || typeof entry !== "object") continue;
    const n = entry.name && typeof entry.name === "object" ? entry.name : {};
    const name =
      clamped(entry.name, 120) ||
      clamped(n.formatted_name, 120) ||
      clamped(n.formattedName, 120) ||
      clamped([str(n.first_name) || str(n.firstName), str(n.last_name) || str(n.lastName)]
        .filter(Boolean)
        .join(" "), 120);

    const phones = (Array.isArray(entry.phones) ? entry.phones : [])
      .slice(0, 5)
      .map((p) => {
        if (typeof p === "string") return { phone: clamped(p, 40), waId: null, label: null };
        if (!p || typeof p !== "object") return null;
        return {
          phone: clamped(p.phone, 40),
          // Meta's `wa_id` — the number as WhatsApp knows it. Kept because it
          // is what a future "message this person" would need, and dropped
          // from nothing today: it is not rendered.
          waId: clamped(p.wa_id ?? p.waId, 40),
          label: clamped(p.type, 24),
        };
      })
      .filter((p) => p && p.phone);

    const emails = (Array.isArray(entry.emails) ? entry.emails : [])
      .slice(0, 5)
      .map((e) => (typeof e === "string" ? clamped(e, 120) : clamped(e?.email, 120)))
      .filter(Boolean);

    const org =
      clamped(entry.org?.company, 120) || clamped(entry.company, 120) || clamped(entry.org, 120);

    // A card with neither a name nor a number is not a card. Dropped rather
    // than rendered as an empty box with a border round it.
    if (!name && !phones.length) continue;
    out.push({ name, org, phones, emails });
  }
  return out.length ? out : null;
}

/** Meta sends `voice: true` on a voice note and `voice: false` on an attached
 *  audio file. Absent — an older row, or another platform — is neither, and
 *  stays null so the label falls back to the generic word rather than
 *  asserting a distinction nothing told us. */
const tri = (v) => (v === true ? true : v === false ? false : null);

/** A byte count we are willing to believe. Meta reports `file_size` on the
 *  media lookup and the fetcher measures the real buffer; anything else is
 *  dropped rather than shown, because a wrong size on a download link is worse
 *  than no size. */
const bytesOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/** The residual name for a row we can only describe. Sanitised because it
 *  comes straight off Meta's `type` field and ends up on a screen. */
const kindToken = (v) => {
  const s = str(v);
  if (!s) return null;
  const token = s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
  return token || null;
};

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

  // Only where they mean something. A `location` on an image row would be a
  // field nothing reads that survives forever because it is never questioned.
  const location = type === "location" ? normaliseLocation(raw.location) : null;
  const contacts = type === "contact" ? normaliseContacts(raw.contacts) : null;

  let state;
  if (durable) state = "ready";
  // Self-contained: nothing was ever going to be fetched, and there IS
  // something to draw. See the header — this is the case that used to render
  // as "nothing to open" under a dropped pin that was the job address.
  else if (location || contacts) state = "ready";
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
    // How big the file actually is, measured — see bytesOf. Null until the
    // fetcher has seen the bytes, which is why the bubble shows a size on a
    // document that landed and no size on one still arriving.
    bytes: bytesOf(raw.bytes),
    // A voice note is somebody describing a leak; an attached audio file is
    // not. The DIFFERENCE IS THE LABEL and nothing else — both play in the
    // same player, because they are both audio.
    voice: tri(raw.voice),
    // WhatsApp's animated stickers are animated WebP, which every browser this
    // app supports draws as an <img> with no help. Carried for the label.
    animated: tri(raw.animated),
    location,
    contacts,
    // What arrived, when all we can do is name it. See attachmentLabelKey.
    otherKind: type === "other" ? kindToken(raw.otherKind) : null,
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
 * The stored shape of one normalised entry.
 *
 * ── Why this exists rather than an object literal per writer ───────────────
 *
 * Because withFetchResult and withFetchReset both rebuild an entry field by
 * field, and a field added to the model and forgotten in one of them is
 * DELETED by the next fetch attempt — silently, on a row that already worked.
 * That is how a location's coordinates or a document's filename would vanish
 * the first time the cron touched a message carrying two attachments. One
 * builder, two callers, nothing to forget.
 */
function storedShape(a, overrides = {}) {
  return {
    type: a.type,
    url: a.url,
    sourceUrl: a.sourceUrl,
    mediaId: a.mediaId,
    mimeType: a.mimeType,
    filename: a.filename,
    bytes: a.bytes,
    voice: a.voice,
    animated: a.animated,
    location: a.location,
    contacts: a.contacts,
    otherKind: a.otherKind,
    fetchAttempts: a.fetchAttempts,
    fetchError: a.fetchError,
    ...overrides,
  };
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
 * @param result  { url, bytes, mimeType } on success, { error } on failure
 */
export function withFetchResult(list, index, result = {}) {
  const current = Array.isArray(list) ? list : [];
  return current.map((entry, i) => {
    if (i !== index) return entry;
    const a = normaliseAttachment(entry, i);
    const url = str(result.url);
    if (url && isDurableMediaUrl(url)) {
      return storedShape(a, {
        // The durable copy, and the expiring one dropped in the same write.
        // Keeping sourceUrl after a successful re-host would leave a dead
        // Meta link in the database for no reader — and one day a reader.
        url,
        sourceUrl: null,
        // Measured on the real buffer, not claimed by a header — this is what
        // the bubble prints next to a document's name.
        bytes: bytesOf(result.bytes) ?? a.bytes,
        // Meta's own Content-Type, which is often better than the webhook's:
        // a document arrives with `application/octet-stream` more often than
        // anyone would like, and the download says what it really is.
        mimeType: str(result.mimeType) || a.mimeType,
        fetchAttempts: a.fetchAttempts + 1,
        fetchError: null,
      });
    }
    return storedShape(a, {
      url: null,
      fetchAttempts: a.fetchAttempts + 1,
      // A sentence, kept verbatim, because "it failed" tells a contractor
      // nothing they can act on. Clamped: this is rendered in a bubble.
      fetchError: (str(result.error) || "The file could not be fetched.").slice(0, 300),
    });
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
    return storedShape(normaliseAttachment(entry, i), { fetchAttempts: 0, fetchError: null });
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
 *
 * The location and the contact card DO go, in full. They are not credentials,
 * they are the message — a homeowner's pin and their plumber's number — and
 * this screen is staff-only behind the `requests` permission.
 */
export function publicAttachments(list) {
  return normaliseAttachments(list).map((a) => ({
    index: a.index,
    type: a.type,
    state: a.state,
    url: a.url,
    mimeType: a.mimeType,
    filename: a.filename,
    bytes: a.bytes,
    voice: a.voice,
    animated: a.animated,
    location: a.location,
    contacts: a.contacts,
    otherKind: a.otherKind,
    // Whether a Retry button should exist at all. Decided here, from the
    // state, rather than in the component — the component would then hold a
    // second copy of the rule and it is the copy that rots.
    retryable: a.state === "failed",
    error: a.fetchError,
  }));
}

/**
 * The i18n key naming this KIND of attachment.
 *
 * Keys, not sentences — the screen is read in nine languages, and
 * scripts/check-translations.mjs sees these as ordinary string literals.
 *
 * This one answers "what type is it" and takes only the type, because
 * scripts/check-messaging.mjs walks ATTACHMENT_TYPES through it to prove every
 * type the renderer can meet has a name. attachmentLabelKey below is the one
 * the bubble actually calls, and it knows about the entry.
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
    case "location":
      return "app.messages.media.location";
    case "contact":
      return "app.messages.media.contact";
    default:
      return "app.messages.media.other";
  }
}

/**
 * Documents, named by what they actually are.
 *
 * A row reading "Document" under a file called nothing is the smallest version
 * of the dead row: it is a link, it opens, and it tells the contractor
 * nothing about whether it is the kitchen plan or a receipt. WhatsApp supplies
 * a filename most of the time and this is the fallback for when it does not.
 *
 * Returns null when the type says nothing useful, so the caller falls back to
 * the generic word rather than printing "application/octet-stream".
 */
export function documentTypeKey(mimeType) {
  const m = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (m === "application/pdf") return "app.messages.media.doc.pdf";
  if (m === "text/plain" || m === "text/csv") return "app.messages.media.doc.text";
  if (m.includes("word") || m === "application/rtf") return "app.messages.media.doc.word";
  if (m.includes("excel") || m.includes("spreadsheet")) return "app.messages.media.doc.excel";
  if (m.includes("powerpoint") || m.includes("presentation")) return "app.messages.media.doc.slides";
  return null;
}

/**
 * THE key the bubble prints for one entry — the type, sharpened by what the
 * entry itself says.
 *
 *   a voice note      "Voice message"     (voice: true, or an older row)
 *   an audio file     "Audio file"        (voice: false — Meta told us)
 *   a named document  the filename, so this is not called
 *   a bare PDF        "PDF"
 *   a reaction        "Attachment (reaction)"
 *
 * Returns `{ key, params }` rather than a string, because two of these need a
 * value substituted and a function that returned a key sometimes and a
 * sentence other times is one the renderer would have to test.
 */
export function attachmentLabelKey(attachment) {
  const a = attachment && attachment.type ? attachment : normaliseAttachment(attachment);

  if (a.type === "audio" && a.voice === false) {
    return { key: "app.messages.media.audioFile", params: {} };
  }
  if (a.type === "document") {
    const key = documentTypeKey(a.mimeType);
    if (key) return { key, params: {} };
  }
  if (a.type === "other" && a.otherKind) {
    // WhatsApp's own word for a message type it could not pass on. Named
    // separately because the contractor's next step is different: there is
    // nothing to fetch and nothing they did wrong.
    if (a.otherKind === "unsupported") {
      return { key: "app.messages.media.unsupported", params: {} };
    }
    // Meta's raw type token, printed. It is English and it is a token, and it
    // is still strictly more than "Attachment" — a contractor who can read
    // "order" or "system" can ask about it, and a row that named nothing was
    // the thing the owner asked us to stop shipping.
    return { key: "app.messages.media.otherNamed", params: { kind: a.otherKind } };
  }
  return { key: attachmentTypeKey(a.type), params: {} };
}

/**
 * A file size a person reads, from a byte count.
 *
 * Deliberately not `Intl.NumberFormat` with a unit: "MB" and "KB" are the same
 * two letters in all nine languages this app ships, the decimal separator is
 * the only thing that differs, and a size beside a download link is not a
 * measurement anybody computes with. What matters is that 0 and NaN produce
 * NOTHING rather than "0 KB" — a document is never zero bytes, so a zero here
 * means we have not measured it yet, and printing a wrong size next to a link
 * is worse than printing none.
 */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const MB = 1024 * 1024;
  if (n >= MB) return `${Math.round((n / MB) * 10) / 10} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${Math.round(n)} B`;
}
