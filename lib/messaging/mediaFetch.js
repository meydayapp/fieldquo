// lib/messaging/mediaFetch.js
//
// Getting the actual bytes — a photo, a clip, a voice note, a plan — out of
// band, for all three platforms.
//
// ══ Why this is not in the webhook ═════════════════════════════════════════
//
// A WhatsApp photo needs TWO authenticated Graph round trips before a single
// byte arrives — GET /<media-id> for a signed URL that expires in five
// minutes, then a GET on that URL carrying the app token — and then a third
// hop to put the bytes on Cloudinary. Doing that inside the webhook would make
// Meta's retry clock depend on Cloudinary's latency: a slow upload becomes a
// timeout, a timeout becomes a redelivery, and enough redeliveries disable the
// subscription for every number on the app. The webhook's job is to store the
// message fast and answer 200, and it still does exactly that.
//
// ══ Why Messenger and Instagram go through the same path ═══════════════════
//
// Their webhooks DO carry a URL, so it is tempting to render it and stop. That
// URL is a signed CDN link that expires, which means the thread renders
// correctly in review and renders a broken image a week later — the precise
// failure lib/crew/inboundParse.js's Twilio comment warns about, arriving from
// a different vendor. They need no token, so their path here is one bare fetch
// instead of two authenticated ones; everything after that byte is identical,
// and the renderer never learns which platform it was.
//
// ══ The host allowlist is a credential check ═══════════════════════════════
//
// The download half of the WhatsApp path sends the company's own access token
// to whatever URL Meta named. That is fine while Meta names its own CDN and a
// catastrophe if a compromised or misbehaving response names anything else, so
// the host is checked before the header is attached — the same guard, for the
// same reason, as lib/crew/inboundParse.js's isTwilioMediaUrl. A redirect is
// followed MANUALLY and bare, and the hop's target is checked too: Twilio's
// version follows a redirect without re-checking it, which is safe against a
// credential leak (the token is not resent) and is still a server-side request
// this process makes to an address a third party chose.

import { GRAPH_API_VERSION } from "@/lib/meta/client";
import { uploadBuffer } from "@/lib/cloudinary";
import { decryptedChannelToken } from "./channels";
import { WHATSAPP_MEDIA_LIMITS } from "./whatsappMediaLimits";
import { normaliseAttachments, isFetchable, withFetchResult } from "./attachments";

const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Meta's own media hosts.
 *
 * `lookaside.fbsbx.com` is where the Cloud API's signed media URLs live;
 * `*.fbcdn.net` and `*.cdninstagram.com` are where Messenger and Instagram
 * attachments live; `*.whatsapp.net` appears on some regional deliveries.
 * Anchored at both ends so `fbcdn.net.evil.com` and `evilfbcdn.net` both fail,
 * and sub-domains are allowed only through an explicit label prefix.
 */
const META_MEDIA_HOST =
  /^(?:[a-z0-9-]+\.)*(?:fbcdn\.net|fbsbx\.com|cdninstagram\.com|whatsapp\.net)$/i;

/**
 * Is this a media URL we are willing to fetch — and, for WhatsApp, to attach a
 * bearer token to?
 *
 * Rejected: anything not HTTPS, anything carrying userinfo (the
 * `https://lookaside.fbsbx.com@evil.com/` trick, which parses to host
 * evil.com), and any host outside Meta's.
 */
export function isMetaMediaUrl(url) {
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return META_MEDIA_HOST.test(parsed.hostname);
}

/**
 * The ceiling for one download, by attachment type.
 *
 * Meta's own send limits, reused as a receive limit: Meta will not deliver a
 * message carrying more than these, so anything larger is not a real
 * attachment and there is no reason to buffer it in memory on a serverless
 * function. `other` gets the document ceiling, which is the largest.
 */
function maxBytesFor(type) {
  return WHATSAPP_MEDIA_LIMITS[type]?.maxBytes || WHATSAPP_MEDIA_LIMITS.document.maxBytes;
}

/**
 * Cloudinary's resource_type for one attachment kind.
 *
 * Audio goes up as "video", which looks wrong and is Cloudinary's own model:
 * it has no audio resource type and stores a voice note under video. A
 * document goes up as "raw" — bytes untouched — for the reason
 * lib/media/validate.js gives at length: "image" would run a rasteriser over a
 * stranger's file on every upload, and we do not render a page-1 thumbnail.
 */
function resourceTypeFor(type) {
  if (type === "image" || type === "sticker") return "image";
  if (type === "video" || type === "audio") return "video";
  return "raw";
}

/** A file extension for a `raw` upload, so Cloudinary serves a usable
 *  Content-Type instead of application/octet-stream (see uploadPublicId in
 *  lib/media/validate.js — the same trap, the same fix). */
function extensionFor(mimeType, filename) {
  const fromName = typeof filename === "string" ? filename.split(".").pop() : "";
  if (fromName && /^[a-z0-9]{1,8}$/i.test(fromName)) return fromName.toLowerCase();
  const map = {
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/rtf": "rtf",
    "application/msword": "doc",
    "application/vnd.ms-excel": "xls",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  };
  return map[String(mimeType || "").toLowerCase().split(";")[0].trim()] || "bin";
}

/**
 * GET /{media-id} -> the signed, five-minute URL.
 *
 * Separate from the download so the check can execute it against a scripted
 * response, and so a resolve failure ("this id expired") reads differently in
 * the thread from a download failure ("Cloudinary refused it").
 */
export async function resolveWhatsAppMediaUrl({ channel, mediaId, fetchImpl = fetch }) {
  let accessToken;
  try {
    accessToken = decryptedChannelToken(channel);
  } catch (err) {
    return { ok: false, error: `The stored WhatsApp credential could not be read (${err?.message || "unknown"}).` };
  }

  let res;
  try {
    res = await fetchImpl(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return { ok: false, error: `Could not reach WhatsApp (${err?.message || "network error"}).` };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const detail = typeof body?.error?.message === "string" ? body.error.message : `HTTP ${res.status}`;
    return { ok: false, error: `WhatsApp would not hand over this file: ${detail}` };
  }

  const url = typeof body?.url === "string" ? body.url : null;
  if (!url) return { ok: false, error: "WhatsApp returned no download link for this file." };
  if (!isMetaMediaUrl(url)) {
    // Named rather than swallowed. If this ever fires it is either a Meta
    // change worth knowing about or a response that is not Meta's, and both
    // are things a log should say out loud.
    return { ok: false, error: "WhatsApp returned a download link on an unexpected host." };
  }

  return {
    ok: true,
    url,
    mimeType: typeof body.mime_type === "string" ? body.mime_type.split(";")[0].trim() : null,
    // Meta reports the size before we download. Checked here so an oversized
    // file costs one HEAD-shaped round trip rather than a full buffer.
    fileSize: Number.isFinite(Number(body.file_size)) ? Number(body.file_size) : null,
  };
}

/**
 * Download the bytes.
 *
 * @param authorization  the bearer header value, or null for a pre-signed CDN
 *                       URL that needs none. Passed rather than derived, so
 *                       the one place a token is attached is a caller's
 *                       explicit decision and is visible in a diff.
 */
async function download({ url, authorization, maxBytes, fetchImpl = fetch }) {
  if (!isMetaMediaUrl(url)) {
    return { ok: false, error: "That download link is not on one of Meta's media hosts." };
  }

  let res;
  try {
    res = await fetchImpl(url, {
      ...(authorization ? { headers: { Authorization: authorization } } : {}),
      // A redirect off Meta's host would carry the Authorization header to
      // wherever it pointed. Followed by hand, bare, and only to another Meta
      // host — see this file's header.
      redirect: "manual",
    });
  } catch (err) {
    return { ok: false, error: `The file could not be downloaded (${err?.message || "network error"}).` };
  }

  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    if (!next) return { ok: false, error: "The download link redirected to nowhere." };
    if (!isMetaMediaUrl(next)) {
      return { ok: false, error: "The download link redirected off Meta's media hosts." };
    }
    let followed;
    try {
      // Bare: the CDN URL is pre-signed and needs no credentials. That is the
      // point — the token never leaves the host it was issued for.
      followed = await fetchImpl(next);
    } catch (err) {
      return { ok: false, error: `The file could not be downloaded (${err?.message || "network error"}).` };
    }
    if (!followed.ok) return { ok: false, error: `The file could not be downloaded (HTTP ${followed.status}).` };
    return readBody(followed, maxBytes);
  }

  if (!res.ok) return { ok: false, error: `The file could not be downloaded (HTTP ${res.status}).` };
  return readBody(res, maxBytes);
}

async function readBody(res, maxBytes) {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, error: "That file is larger than WhatsApp's own limit for its type." };
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  // Checked AGAIN on the real length. Content-Length is a claim, and a claim
  // is not a measurement — the same reason lib/crew/inboundParse.js bounds its
  // loop by MAX_MEDIA rather than by the count in the payload.
  if (buffer.length > maxBytes) {
    return { ok: false, error: "That file is larger than WhatsApp's own limit for its type." };
  }
  if (!buffer.length) return { ok: false, error: "That file arrived empty." };
  return {
    ok: true,
    buffer,
    mimeType: (res.headers.get("content-type") || "").split(";")[0].trim() || null,
  };
}

/**
 * One attachment: resolve it, fetch it, put it on Cloudinary.
 *
 * @param fetchImpl   injected so scripts/check-whatsapp.mjs can drive Meta's
 *                    two round trips against fixtures. The real clock, the
 *                    real network and the real vendor are what a check cannot
 *                    have, and every guard in this file is about what happens
 *                    when one of them misbehaves.
 * @param uploadImpl  the same, for Cloudinary. It exists specifically so the
 *                    SUCCESS path is executable: "url ends up holding
 *                    Cloudinary's link and never Meta's" is the invariant this
 *                    whole module is arranged around, and asserting it by
 *                    reading the source would pass against the version that
 *                    stored the Graph URL.
 *
 * @returns {Promise<{ url: string, bytes: number, mimeType: string|null }
 *                  | { error: string }>} — the shape
 *          lib/messaging/attachments.js's withFetchResult takes, so the
 *          decision about what an outcome MEANS stays in the pure module and
 *          this one only does the network.
 */
export async function rehostAttachment({
  attachment,
  channel,
  companyId,
  fetchImpl = fetch,
  uploadImpl = uploadBuffer,
}) {
  const maxBytes = maxBytesFor(attachment.type);

  let url = attachment.sourceUrl;
  let authorization = null;
  let mimeType = attachment.mimeType;

  if (attachment.mediaId) {
    // WhatsApp: the id is the only thing the webhook gave us, and the signed
    // URL it resolves to is good for five minutes — which is why it is
    // resolved HERE, at the moment of fetching, and never stored.
    const resolved = await resolveWhatsAppMediaUrl({ channel, mediaId: attachment.mediaId, fetchImpl });
    if (!resolved.ok) return { error: resolved.error };
    if (resolved.fileSize && resolved.fileSize > maxBytes) {
      return { error: "That file is larger than WhatsApp's own limit for its type." };
    }
    url = resolved.url;
    mimeType = resolved.mimeType || mimeType;
    try {
      authorization = `Bearer ${decryptedChannelToken(channel)}`;
    } catch (err) {
      return { error: `The stored WhatsApp credential could not be read (${err?.message || "unknown"}).` };
    }
  }

  if (!url) return { error: "There was no link and no media id to fetch this from." };

  const fetched = await download({ url, authorization, maxBytes, fetchImpl });
  if (!fetched.ok) return { error: fetched.error };

  const resourceType = resourceTypeFor(attachment.type);
  try {
    const uploaded = await uploadImpl(fetched.buffer, {
      // Foldered per company, exactly as /api/upload does, so one tenant's
      // media is auditable and deletable without trawling a flat namespace.
      folder: `messaging/${companyId}`,
      resourceType,
      publicId:
        resourceType === "raw"
          ? `${globalThis.crypto.randomUUID()}.${extensionFor(fetched.mimeType || mimeType, attachment.filename)}`
          : undefined,
    });
    const secure = uploaded?.secure_url || null;
    if (!secure) return { error: "The file was fetched but could not be stored." };
    // The MEASURED size and the type the download actually declared, both
    // carried back so lib/messaging/attachments.js can store them. This is
    // what lets the bubble print "kitchen-plan.pdf · 2.4 MB" — a size taken
    // from the bytes rather than from a header, because a Content-Length is a
    // claim and readBody above has already refused to trust one.
    return { url: secure, bytes: fetched.buffer.length, mimeType: fetched.mimeType || mimeType };
  } catch (err) {
    return { error: `The file was fetched but could not be stored (${err?.message || "unknown"}).` };
  }
}

/**
 * Every outstanding attachment on ONE message.
 *
 * Returns the new column and whether anything is still outstanding, so the
 * caller writes both in one update. The caller does the writing: this function
 * is used by a cron and by a Retry button, and a function that wrote the row
 * itself would have to know which of those it was.
 *
 * @returns {Promise<{ attachments: Array, pending: boolean, fetched: number,
 *                     failed: number }>}
 */
export async function fetchMessageMedia({
  attachments,
  channel,
  companyId,
  fetchImpl = fetch,
  uploadImpl = uploadBuffer,
}) {
  let list = Array.isArray(attachments) ? attachments : [];
  let fetched = 0;
  let failed = 0;

  const targets = normaliseAttachments(list).filter(isFetchable);
  for (const target of targets) {
    // Sequential, deliberately: a message rarely carries more than one
    // attachment, and running them in parallel would mean several multi-
    // megabyte buffers resident at once on a function with a fixed memory
    // ceiling.
    const result = await rehostAttachment({
      attachment: target,
      channel,
      companyId,
      fetchImpl,
      uploadImpl,
    });
    list = withFetchResult(list, target.index, result);
    if (result.url) fetched++;
    else failed++;
  }

  return {
    attachments: list,
    // Recomputed from the RESULT, never assumed from the loop: an entry that
    // failed on attempt 2 of 5 is still pending work, and an entry that
    // failed on attempt 5 is not. One predicate owns that, in the pure module.
    pending: normaliseAttachments(list).some(isFetchable),
    fetched,
    failed,
  };
}
