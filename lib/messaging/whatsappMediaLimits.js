// lib/messaging/whatsappMediaLimits.js
//
// Meta's own media table, and the one question the file picker asks.
//
// ══ Why this is a separate file from lib/messaging/whatsappMedia.js ════════
//
// Because the COMPOSER needs it, and the composer is "use client".
// whatsappMedia.js talks to Meta, which means it imports
// lib/messaging/channels.js for the token — and that imports "@/lib/db", a
// Prisma client that has no business in a browser bundle. Importing the send
// module from app/app/messages/page.js to reach one pure function would have
// dragged Prisma and node:crypto into the client build.
//
// That is exactly the split lib/media/cloudinaryUrl.js documents for
// resizedUrl(), for the same reason and with the same shape: the pure half
// moves to a module with no server-only dependency, and the server-side module
// re-exports it so every existing caller keeps working unchanged.
//
// Nothing here does I/O, so scripts/check-whatsapp.mjs executes all of it
// against fixtures — including a file one byte over each of Meta's limits.
//
// ══ Meta's documented limits, read 2026-09-08 ══════════════════════════════
//
// developers.facebook.com/docs/whatsapp/cloud-api/reference/media, "Supported
// Media Types":
//
//   audio      16 MB   AAC, AMR, MP3, MP4 audio, OGG (OPUS only)
//   document  100 MB   TXT, XLS, XLSX, DOC, DOCX, PPT, PPTX, PDF
//   image       5 MB   JPEG, PNG — 8-bit, RGB or RGBA
//   sticker    100 KB static / 500 KB animated, WebP only
//   video      16 MB   3GPP, MP4 — H.264 video, AAC audio, one audio stream
//
// These are NUMBERS FROM META, not guesses, and they are enforced BEFORE the
// upload rather than discovered from a 400 afterwards. AGENTS.md's first rule
// is the reason: a contractor who watches an upload bar fill on a driveway
// connection and then reads "failed" has used a control that appeared to work.
// The refusal names the real limit so the next attempt can succeed.
//

const MB = 1024 * 1024;

/**
 * Meta's table, as data. One object, so the refusal sentence, the pre-upload
 * guard and the check script all read the same numbers — three copies of a
 * limit is how one of them ends up one megabyte out and lets a send through
 * that Meta refuses.
 */
export const WHATSAPP_MEDIA_LIMITS = Object.freeze({
  image: Object.freeze({
    maxBytes: 5 * MB,
    label: "5 MB",
    // JPEG and PNG only. Everything else a phone produces (HEIC, WebP) is
    // CONVERTIBLE rather than acceptable — see convertibleImage below.
    mimeTypes: Object.freeze(["image/jpeg", "image/png"]),
  }),
  video: Object.freeze({
    maxBytes: 16 * MB,
    label: "16 MB",
    mimeTypes: Object.freeze(["video/mp4", "video/3gpp"]),
  }),
  audio: Object.freeze({
    maxBytes: 16 * MB,
    label: "16 MB",
    mimeTypes: Object.freeze([
      "audio/aac",
      "audio/amr",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
    ]),
  }),
  document: Object.freeze({
    maxBytes: 100 * MB,
    label: "100 MB",
    mimeTypes: Object.freeze([
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
  }),
  sticker: Object.freeze({
    // The ANIMATED ceiling, which is the larger of Meta's two. Inbound only —
    // see OUTBOUND_TYPES: nothing in FieldQuo creates a sticker, so this
    // number exists to bound an inbound download, not to gate a send.
    maxBytes: 500 * 1024,
    label: "500 KB",
    mimeTypes: Object.freeze(["image/webp"]),
  }),
});

/**
 * The FILE types the composer may attach.
 *
 * ══ What Meta will carry, and what FieldQuo actually creates ═══════════════
 *
 * developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages, read
 * 2026-09-08, lists every sendable service message: text, image, audio, video,
 * document, sticker, location, contacts, reaction, and the interactive family.
 * So Meta would carry all three of the types missing from this list. They are
 * missing for a FieldQuo reason, not a Meta one, and the composer says so out
 * loud (app.messages.media.attachNote) rather than leaving three silent gaps:
 *
 *   audio     there is no recorder in the composer. A voice note is a thing
 *             you RECORD, and "attach an .mp3 from your phone" is not the
 *             control anybody wanted — so no control is drawn, per AGENTS.md's
 *             first rule, and the sentence names it.
 *   sticker   nothing in the product makes a sticker, and Meta's format is
 *             WebP under 100 KB (500 KB animated) — a converter, a picker and
 *             a size budget for a thing no contractor asked for.
 *   contacts  a contact-card send would mean choosing a person out of the
 *             company's own client list and handing their number to a third
 *             party. That is a privacy decision with a product question inside
 *             it, and it is not one to make in passing.
 *
 * LOCATION is not here because it is not a file. It is sent as its own kind —
 * see locationPayload below — and the composer offers it only when the company
 * actually has coordinates on file.
 */
export const OUTBOUND_TYPES = Object.freeze(["image", "video", "document"]);

/**
 * The types Meta CAN carry that this build does not offer, with why. Exported
 * so scripts/check-whatsapp.mjs can pin the list against the composer's own
 * sentence — a gap that is documented in one place and silent in the other is
 * how a "coming soon" becomes a lie.
 */
export const UNBUILT_OUTBOUND_TYPES = Object.freeze(["audio", "sticker", "contacts"]);

/**
 * Formats a contractor's phone produces that WhatsApp will not take, but
 * Cloudinary can hand back as a JPEG through one URL transformation.
 *
 * HEIC is the whole reason this list exists: it is the iPhone default, it is
 * what a homeowner's photo of their kitchen arrives as, and refusing it would
 * mean the attach button worked for Android and not for iOS.
 */
const CONVERTIBLE_IMAGE_TYPES = Object.freeze([
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
]);

/**
 * The `accept` attribute for the composer's file input.
 *
 * Kept in step with the sets above: a picker that offers a type the send
 * refuses is a control that appears to work and doesn't — and, since
 * 2026-09-08, the reverse was also true. This used to end at
 * `application/pdf` while WHATSAPP_MEDIA_LIMITS.document already listed all
 * eight of Meta's document formats, so a contractor holding a .docx quote or
 * an .xlsx material list could not even see it in the file dialog. The
 * extensions ride alongside the MIME types because Windows and some Android
 * pickers match on extension and hand back an empty `type` for Office files.
 */
export const WHATSAPP_MEDIA_ACCEPT = [
  "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "image/gif",
  "video/mp4", "video/3gpp",
  ...WHATSAPP_MEDIA_LIMITS.document.mimeTypes,
  ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
].join(",");

const bytesLabel = (n) =>
  n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * MAY THIS FILE BE SENT ON WHATSAPP?
 *
 * Pure, and the ONE gate: the composer runs it before uploading anything, and
 * the reply route runs it again on the bytes it is actually about to hand
 * Meta. Two calls, one function — the browser's copy is a courtesy that saves
 * an upload, the server's is the decision.
 *
 * @param {{type?: string, size?: number, name?: string}} file
 * @returns {{ ok: true, type: "image"|"video"|"document", mimeType: string,
 *             convert: boolean }
 *        | { ok: false, reason: string, message: string }}
 *
 *   `convert` means "ask Cloudinary for a JPEG of this before uploading it to
 *   Meta". It is a fact about the FILE, decided here, so the send path does
 *   not have to know which formats an iPhone shoots.
 */
export function classifyWhatsAppOutboundMedia(file = {}) {
  const mimeType = typeof file.type === "string" ? file.type.toLowerCase().split(";")[0].trim() : "";
  const size = Number(file.size);

  if (!mimeType) {
    return {
      ok: false,
      reason: "media_type_unknown",
      message: "That file has no recognisable type, so WhatsApp would refuse it.",
    };
  }

  const isImage =
    WHATSAPP_MEDIA_LIMITS.image.mimeTypes.includes(mimeType) ||
    CONVERTIBLE_IMAGE_TYPES.includes(mimeType);
  const isVideo = WHATSAPP_MEDIA_LIMITS.video.mimeTypes.includes(mimeType);
  const isDocument = WHATSAPP_MEDIA_LIMITS.document.mimeTypes.includes(mimeType);

  if (!isImage && !isVideo && !isDocument) {
    return {
      ok: false,
      reason: "media_type_unsupported",
      // Names what WhatsApp DOES take. A refusal that only lists what was
      // wrong leaves a contractor with a .mov and no next step — and .mov is
      // the one they will actually be holding, so it is named.
      message:
        "WhatsApp accepts JPEG and PNG pictures (5 MB), MP4 or 3GP video (16 MB), and PDF, " +
        "Word, Excel, PowerPoint or plain-text documents (100 MB). " +
        "It does not accept QuickTime .mov — export or share the clip as MP4 first.",
    };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return {
      ok: false,
      reason: "media_empty",
      message: "That file appears to be empty, so there was nothing to send.",
    };
  }

  const type = isDocument ? "document" : isVideo ? "video" : "image";
  const limit = WHATSAPP_MEDIA_LIMITS[type];
  const convert = type === "image" && !WHATSAPP_MEDIA_LIMITS.image.mimeTypes.includes(mimeType);

  // ── Where the ceiling is measured, and why an image gets two ────────────
  //
  // A convertible image is checked against a WIDER bound here, because the
  // bytes Meta will see are the CONVERTED ones and a 9 MB HEIC becomes a
  // 2 MB JPEG. Checking the original against 5 MB would refuse a photo that
  // sends perfectly. The 5 MB rule still holds — it is applied to the
  // converted bytes, in the send path, by this same function.
  const cap = convert ? Math.max(limit.maxBytes, 25 * MB) : limit.maxBytes;
  if (size > cap) {
    return {
      ok: false,
      reason: "media_too_large",
      message: convert
        ? `That picture is ${bytesLabel(size)}. WhatsApp accepts pictures up to ${limit.label}, and ` +
          "FieldQuo will shrink one up to 25 MB to fit — this one is larger than that."
        : `That ${type} is ${bytesLabel(size)}. WhatsApp accepts a ${type} up to ${limit.label}.`,
    };
  }

  return { ok: true, type, mimeType, convert };
}

/**
 * A JPEG of a Cloudinary image, through a URL transformation.
 *
 * `f_jpg` rather than `f_auto`: f_auto negotiates from the requester's Accept
 * header, and a server-side fetch has none — which makes the delivered format
 * a thing we would be guessing at, and the guess would be handed to Meta. The
 * width limit is what actually brings a 48-megapixel phone photo under 5 MB;
 * `c_limit` never enlarges, so a small picture is untouched.
 *
 * Returns the URL unchanged when it is not a Cloudinary upload URL — the
 * caller has already proved it is one (see the reply route's ownership check),
 * and silently rewriting a URL we do not recognise would be worse.
 */
export function jpegVariantUrl(url, { width = 2048 } = {}) {
  if (typeof url !== "string") return url;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  const w = Math.max(1, Math.round(Number(width) || 2048));
  return `${head}w_${w},c_limit,q_auto,f_jpg/${tail}`;
}
