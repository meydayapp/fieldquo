// lib/sales/inboundAttachments.js
//
// What a prospect attached to a reply, made durable.
//
// ══ The same invariant as the messaging inbox, for the same reason ═════════
//
// lib/messaging/attachments.js: `url` is null, or it is a Cloudinary URL,
// never anything else. Resend's attachment `download_url` is signed and good
// for one hour — stored in a row it renders today and is a broken link by
// lunch. So the bytes are fetched here, while the URL is live, and put on
// Cloudinary; what is written to SalesMessage.attachments is the SAME shape
// the messaging inbox writes to Message.attachments, so
// lib/messaging/attachments.js's publicAttachments() serves both and the two
// screens cannot disagree about what "a stored file" looks like.
//
// Not routed through lib/messaging/mediaFetch.js itself: that module's host
// allowlist is Meta's CDNs and it attaches a WhatsApp bearer token to the
// fetch. This has a different allowlist (Resend's) and no credential — the
// download URL is pre-signed — so the only thing worth sharing is the
// invariant, and that is shared by writing the same shape.
//
// ══ Why the fetch is inline, in the webhook ════════════════════════════════
//
// mediaFetch.js argues at length for fetching OUT of band, because a WhatsApp
// photo takes three authenticated hops and Meta's retry clock must not depend
// on Cloudinary's latency. Here the hop count is one (Resend's URL is
// fetchable as-is), a sales reply almost never carries more than a PDF, and
// the alternative — a cron over pending attachments — is a second moving part
// whose failure looks like "the attachment never arrived". A failure here is
// recorded on the entry as `fetchError` and the message still files and still
// forwards, naming the file it could not carry.

import { uploadBuffer } from "@/lib/cloudinary";

/** The most a single attachment may be. Past this the entry records the size
 *  and a reason; Resend keeps the original for a while and the forwarded copy
 *  names it. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** The most the forwarded copy may carry in total — under Resend's own
 *  per-message limit of 40 MB with headroom for the body. Anything past this
 *  stays in FieldQuo and is named in the copy's header line. */
export const MAX_FORWARD_BYTES = 20 * 1024 * 1024;

/**
 * Only Resend's own hosts.
 *
 * Anchored, and the userinfo trick (`https://inbound-cdn.resend.com@evil/`)
 * is refused explicitly. The URL arrives inside an API response, not from a
 * stranger — but the response is JSON somebody else produced, and a
 * server-side fetch to an address a third party chose is the thing worth a
 * three-line check. Same guard, same shape as lib/messaging/mediaFetch.js's
 * isMetaMediaUrl.
 */
export function isResendDownloadUrl(url) {
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return /^(?:[a-z0-9-]+\.)*resend\.com$/i.test(parsed.hostname);
}

/** The messaging inbox's type vocabulary, from a MIME type. */
export function attachmentTypeFor(mimeType) {
  const m = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (
    m === "application/pdf" ||
    m.startsWith("text/") ||
    m.includes("word") ||
    m.includes("excel") ||
    m.includes("spreadsheet") ||
    m.includes("powerpoint") ||
    m.includes("presentation") ||
    m === "application/rtf"
  ) {
    return "document";
  }
  return "other";
}

function resourceTypeFor(type) {
  if (type === "image") return "image";
  if (type === "video" || type === "audio") return "video";
  return "raw";
}

function extensionFor(mimeType, filename) {
  const fromName = typeof filename === "string" ? filename.split(".").pop() : "";
  if (fromName && fromName !== filename && /^[a-z0-9]{1,8}$/i.test(fromName)) {
    return fromName.toLowerCase();
  }
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

async function download(url, { fetchImpl = fetch, maxBytes = MAX_ATTACHMENT_BYTES } = {}) {
  if (!isResendDownloadUrl(url)) {
    return { ok: false, error: "That download link is not on Resend's hosts." };
  }
  let res;
  try {
    res = await fetchImpl(url, { redirect: "manual" });
  } catch (err) {
    return { ok: false, error: `The file could not be downloaded (${err?.message || "network error"}).` };
  }
  if (res.status >= 300 && res.status < 400) {
    // Followed by hand and re-checked: a redirect off Resend's hosts is a
    // fetch to an address nobody at FieldQuo chose.
    const next = res.headers.get("location");
    if (!isResendDownloadUrl(next)) {
      return { ok: false, error: "The download link redirected off Resend's hosts." };
    }
    try {
      res = await fetchImpl(next);
    } catch (err) {
      return { ok: false, error: `The file could not be downloaded (${err?.message || "network error"}).` };
    }
  }
  if (!res.ok) return { ok: false, error: `The file could not be downloaded (HTTP ${res.status}).` };

  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, error: "That file is larger than FieldQuo stores for a reply." };
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  // Measured, not declared: a Content-Length is a claim.
  if (buffer.length > maxBytes) {
    return { ok: false, error: "That file is larger than FieldQuo stores for a reply." };
  }
  return { ok: true, buffer, mimeType: res.headers.get("content-type") || null };
}

/**
 * Fetch and re-host every attachment on one received email.
 *
 * @param listed   Resend's attachment list — [{ id, filename, content_type,
 *                 size, download_url }] from the attachments endpoint. An
 *                 entry with no download_url (the webhook's metadata-only
 *                 shape, when the list call failed) is recorded as failed
 *                 with its name, never silently dropped.
 * @param folder   Cloudinary folder, e.g. `sales-inbound/<threadId>`
 *
 * @returns {{ stored: Array, carried: Array, notCarried: string[] }}
 *   `stored`      the column value — durable entries and failed ones
 *   `carried`     [{ filename, content }] to attach to the forwarded copy,
 *                 within MAX_FORWARD_BYTES in total
 *   `notCarried`  the names of files that are NOT on the forwarded copy —
 *                 too big, or never fetched — so the copy can say so
 */
export async function rehostInboundAttachments({
  listed,
  folder,
  fetchImpl = fetch,
  uploadImpl = uploadBuffer,
}) {
  const stored = [];
  const carried = [];
  const notCarried = [];
  let carriedBytes = 0;

  const entries = Array.isArray(listed) ? listed : [];
  // Sequential: one buffer resident at a time on a function with fixed memory.
  for (const raw of entries) {
    const filename = typeof raw?.filename === "string" && raw.filename.trim() ? raw.filename.trim() : "attachment";
    const mimeType = typeof raw?.content_type === "string" ? raw.content_type : null;
    const type = attachmentTypeFor(mimeType);
    const declaredBytes = Number.isFinite(Number(raw?.size)) ? Number(raw.size) : null;

    const fetched = raw?.download_url
      ? await download(raw.download_url, { fetchImpl })
      : { ok: false, error: "Resend gave no download link for this file." };

    if (!fetched.ok) {
      stored.push({ type, url: null, mimeType, filename, bytes: declaredBytes, fetchAttempts: 1, fetchError: fetched.error });
      notCarried.push(filename);
      continue;
    }

    let url = null;
    let uploadError = null;
    try {
      const resourceType = resourceTypeFor(type);
      const uploaded = await uploadImpl(fetched.buffer, {
        folder,
        resourceType,
        publicId:
          resourceType === "raw"
            ? `${globalThis.crypto.randomUUID()}.${extensionFor(fetched.mimeType || mimeType, filename)}`
            : undefined,
      });
      url = uploaded?.secure_url || null;
      if (!url) uploadError = "The file was fetched but could not be stored.";
    } catch (err) {
      uploadError = `The file was fetched but could not be stored (${err?.message || "unknown"}).`;
    }

    stored.push({
      type,
      url,
      mimeType: fetched.mimeType || mimeType,
      filename,
      bytes: fetched.buffer.length,
      fetchAttempts: 1,
      ...(uploadError ? { fetchError: uploadError } : {}),
    });

    // The bytes are in hand regardless of whether Cloudinary took them, so the
    // rep's copy can still carry the file — up to the cap.
    if (carriedBytes + fetched.buffer.length <= MAX_FORWARD_BYTES) {
      carried.push({ filename, content: fetched.buffer.toString("base64") });
      carriedBytes += fetched.buffer.length;
    } else {
      notCarried.push(filename);
    }
  }

  return { stored, carried, notCarried };
}
