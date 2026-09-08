// lib/messaging/whatsappMedia.js
//
// WhatsApp's own media rules, and the two Graph calls that send a picture.
//
// ══ Meta's documented limits ══════════════════════════════════════════════
//
// In lib/messaging/whatsappMediaLimits.js, with the citation — the composer
// needs them and cannot import this file. This one is the half that talks to
// Meta.
//
// ══ id or link — both work, and we use the id ══════════════════════════════
//
// developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages, read
// 2026-09-08: a media message may carry either "the ID (id) of an asset you
// have uploaded to the Meta servers" or "a link (link) to a media asset on
// your server". Both are documented and both work.
//
// We upload and send by ID, for two reasons that are specific rather than
// stylistic:
//
//   1. The link form makes META fetch OUR URL at send time, and Meta caches
//      what it fetches for ten minutes keyed on the URL. Cloudinary URLs are
//      content-addressed by public_id, so two different photos never share a
//      URL — but the failure mode of the cache is that a send SUCCEEDS with
//      the wrong picture, which is worse than a send that fails.
//   2. The link form means the send's success depends on Cloudinary being
//      reachable from Meta's network at that instant. Uploading first moves
//      that dependency to a step we can report on, and gives us Meta's own
//      verdict on the bytes before anything is written into a conversation.
//
// ══ What this file does NOT do ═════════════════════════════════════════════
//
// It does not transcode. Cloudinary is asked for a JPEG variant of a photo
// (see jpegVariantUrl) because that is one URL and no job queue; a .mov is
// REFUSED by name rather than silently re-encoded, because a video transcode
// is asynchronous at Cloudinary and a send that waits on it would either block
// for a minute or lie.

import { GRAPH_API_VERSION } from "@/lib/meta/client";
import { decryptedChannelToken } from "./channels";
import {
  WHATSAPP_MEDIA_LIMITS,
  classifyWhatsAppOutboundMedia,
  jpegVariantUrl,
} from "./whatsappMediaLimits";

// Re-exported so every existing server-side caller (and
// scripts/check-whatsapp.mjs) keeps importing one name from one place. The
// implementations live in whatsappMediaLimits.js because the composer — a
// "use client" file — needs them and must not pull Prisma into the browser;
// see that file's header, and lib/cloudinary.js's identical re-export of
// resizedUrl for the precedent.
export {
  WHATSAPP_MEDIA_LIMITS,
  OUTBOUND_TYPES,
  WHATSAPP_MEDIA_ACCEPT,
  classifyWhatsAppOutboundMedia,
  jpegVariantUrl,
} from "./whatsappMediaLimits";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * The message object a media send posts.
 *
 * Pure and exported so the check can compare it against Meta's documented
 * shape without a network call. The CAPTION rides on the media object — that
 * is where the Cloud API puts it, and a caption sent as a separate text
 * message would arrive as two bubbles and would be refused on its own outside
 * the 24-hour window.
 */
export function whatsAppMediaPayload({ type, mediaId, caption = "", filename = null }) {
  const object = { id: mediaId };
  // Meta accepts a caption on image, video and document; audio and sticker
  // carry none. Written as a list rather than "everything except", so a type
  // added later is silently caption-less instead of silently rejected.
  if (caption && ["image", "video", "document"].includes(type)) object.caption = caption;
  // A document with no filename downloads on the homeowner's phone as a
  // random id with no extension — the same trap lib/media/validate.js's
  // uploadPublicId documents for Cloudinary `raw` assets.
  if (type === "document" && filename) object.filename = filename;
  return { type, [type]: object };
}

/**
 * Cloudinary's delivery hosts, anchored — the same test
 * lib/messaging/attachments.js applies to a stored URL, restated here because
 * this file must not import a module it does not otherwise need and because
 * the two are checked for different reasons: there it is "may this be
 * rendered", here it is "may this process fetch it".
 */
const CLOUDINARY_HOST = /^res(?:-\d+)?\.cloudinary\.com$/i;

/**
 * The bytes the send will actually hand Meta, from an upload the contractor
 * has already made through /api/upload.
 *
 * ══ Why the browser sends a URL and the server fetches it ══════════════════
 *
 * The same shape as AGENTS.md's non-negotiable #5 for money: the client names
 * a thing, the server resolves it. What arrives is a Cloudinary URL and a
 * public_id, and BOTH are proved to belong to this company's own folder before
 * a single byte is fetched — a URL naming any other host would be a
 * server-side request forgery, and one naming another tenant's folder would
 * pull their customer's photo into this company's conversation.
 *
 * ══ Why the size is measured HERE and not on the file picker ═══════════════
 *
 * Because an iPhone's 9 MB HEIC becomes a 2 MB JPEG, and WhatsApp's picture
 * limit is 5 MB. Refusing the original would refuse a photo that sends
 * perfectly; sending it unconverted would be refused by Meta. So the
 * conversion happens first and the limit is applied to what comes back — the
 * only bytes the rule is actually about.
 *
 * @returns {Promise<{ ok: true, type, mimeType, buffer: Buffer, filename }
 *                 | { ok: false, reason, message }>}
 */
export async function prepareOutboundMedia({
  url,
  publicId,
  companyId,
  filename = null,
  declaredType = null,
  fetchImpl = fetch,
}) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return { ok: false, reason: "media_not_found", message: "That upload could not be found." };
  }
  const folder = `fieldquo/companies/${companyId}/`;
  const ownedByCompany =
    parsed.protocol === "https:" &&
    !parsed.username &&
    !parsed.password &&
    CLOUDINARY_HOST.test(parsed.hostname) &&
    parsed.pathname.includes(`/${folder}`) &&
    typeof publicId === "string" &&
    publicId.startsWith(folder);
  if (!ownedByCompany) {
    // One refusal for both halves of the test, deliberately: telling a caller
    // WHICH of "not our host" and "not your folder" they failed is telling
    // them how to pass next time.
    return {
      ok: false,
      reason: "media_not_found",
      message: "That upload could not be found in this company's files.",
    };
  }

  // A cheap early refusal on what the browser SAID it uploaded, so an
  // obviously-wrong file never costs a download. The decision is still made
  // below, on the real bytes.
  if (declaredType) {
    const early = classifyWhatsAppOutboundMedia({ type: declaredType, size: 1 });
    if (!early.ok) return early;
  }

  const first = await fetchImpl(url).catch(() => null);
  if (!first?.ok) {
    return {
      ok: false,
      reason: "media_not_found",
      message: "That upload could not be read back, so nothing was sent.",
    };
  }
  const firstType = (first.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const firstBuffer = Buffer.from(await first.arrayBuffer());

  const verdict = classifyWhatsAppOutboundMedia({ type: firstType, size: firstBuffer.length });
  if (!verdict.ok) return verdict;

  if (!verdict.convert) {
    return {
      ok: true,
      type: verdict.type,
      mimeType: verdict.mimeType,
      buffer: firstBuffer,
      filename,
    };
  }

  // HEIC, HEIF, WebP or GIF: fetch the JPEG Cloudinary can deliver from the
  // same asset, then apply WhatsApp's 5 MB rule to THOSE bytes.
  const jpeg = await fetchImpl(jpegVariantUrl(url)).catch(() => null);
  if (!jpeg?.ok) {
    return {
      ok: false,
      reason: "media_convert_failed",
      message:
        "That picture is in a format WhatsApp does not accept, and it could not be converted to JPEG.",
    };
  }
  const jpegBuffer = Buffer.from(await jpeg.arrayBuffer());
  const converted = classifyWhatsAppOutboundMedia({ type: "image/jpeg", size: jpegBuffer.length });
  if (!converted.ok) return converted;

  return {
    ok: true,
    type: "image",
    mimeType: "image/jpeg",
    buffer: jpegBuffer,
    filename,
  };
}

/**
 * POST /{phone-number-id}/media — the upload half of a media send.
 *
 * @returns {Promise<{ ok: true, mediaId: string }
 *                 | { ok: false, reason: string, message: string }>}
 *
 * Same refusal contract as lib/messaging/whatsappSend.js, so the reply route
 * writes a failed Message row from either half without a second shape to
 * handle.
 */
export async function uploadWhatsAppMedia({ channel, buffer, mimeType, filename }) {
  if (!channel?.externalId) {
    return {
      ok: false,
      reason: "channel_not_connected",
      message: "No WhatsApp number is connected, so the picture was not sent.",
    };
  }

  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    return {
      ok: false,
      reason: "token_unreadable",
      message: `The stored WhatsApp credential could not be read (${err?.message || "unknown"}).`,
    };
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  // A Blob rather than a stream: Meta's endpoint is a plain multipart POST and
  // the buffer is already in memory (it was just fetched from Cloudinary), so
  // streaming would add a failure mode without saving a byte.
  form.append("file", new Blob([buffer], { type: mimeType }), filename || "upload");

  let res;
  try {
    res = await fetch(`${GRAPH_BASE}/${channel.externalId}/media`, {
      method: "POST",
      // No Content-Type header: fetch sets the multipart boundary itself, and
      // setting it by hand produces a boundary that does not match the body —
      // which Meta reports as a generic 400.
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "network",
      message: `Could not reach WhatsApp to upload the file (${err?.message || "network error"}).`,
    };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || typeof body?.id !== "string") {
    const detail =
      typeof body?.error?.message === "string" ? body.error.message : `HTTP ${res.status}`;
    return {
      ok: false,
      reason: "media_upload_failed",
      message: `WhatsApp would not accept the file: ${detail}`,
    };
  }

  return { ok: true, mediaId: body.id };
}
