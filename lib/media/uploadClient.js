// lib/media/uploadClient.js
//
// THE way a browser uploads a file in FieldQuo. One helper, every caller.
//
//   const entry = await uploadFile(file, { purpose: "jobs" });
//   // → { url, publicId, kind, filename, bytes, mimeType }
//
// Three requests, and the big one never touches our server:
//
//   1. POST <endpoint>/sign    { purpose, type, size, name }  — our server
//      classifies the declared file, mints where it goes, signs it.
//   2. POST https://api.cloudinary.com/…/upload  — the bytes, straight from
//      the browser, with the signed fields. Progress is reported from here.
//   3. POST <endpoint>/verify  { publicId, version, signature, … } — our
//      server checks Cloudinary's answer against Cloudinary itself and hands
//      back the entry to store.
//
// Why: Vercel refuses a request body over ~4.5 MB before our route runs, so a
// normal phone photo sent through /api/upload failed (owner report
// 2026-09-22). See lib/media/directUpload.js for the security rules.
//
// `endpoint` is the scope: "/api/upload" for staff (the default),
// "/api/portal/<token>/upload" for the client portal,
// "/api/self-quote/<slug>/upload" for the public forms. The same three
// suffixes on each, so MediaUploader's existing `uploadUrl` prop is the
// endpoint unchanged.
//
// Failures throw UploadError with a sentence fit to show and a `code` a caller
// can translate: network | signed_out | too_large | rejected | unavailable |
// rate_limited | unconfirmed. `serverMessage` is our server's own sentence when
// it gave one — it inspected the file, so it is preferred over a generic label.
//
// No React and no SDK — safe in a "use client" bundle and in the offline
// queue's service-worker-adjacent code.

import { beginUpload, updateUpload, endUpload } from "@/lib/media/uploadProgress";
import { megabytes } from "@/lib/media/validate";

export class UploadError extends Error {
  constructor(message, { code = "rejected", status = 0, serverMessage = null, size = null, maxBytes = null } = {}) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.status = status;
    this.serverMessage = serverMessage;
    this.size = size;
    this.maxBytes = maxBytes;
  }
}

const MESSAGES = {
  network: "Upload failed — check your connection and try again.",
  signed_out: "Your session has expired. Sign in again, then re-attach the file.",
  rejected: "That file couldn't be uploaded.",
  unavailable: "Uploads aren't available right now.",
  rate_limited: "Too many uploads from this connection. Wait a few minutes and try again.",
  unconfirmed: "That upload could not be confirmed. Upload the file again.",
};

/**
 * The MIME to declare. Chrome and Firefox on Windows report "" for a .heic —
 * the format an iPhone photo is in when it arrives by AirDrop or a cable — and
 * classifyMedia refuses a file with no type. Only these two extensions are
 * inferred: Cloudinary's signed allowed_formats checks the actual content, so
 * a mislabelled file is still refused, just by the side that can see it.
 */
export function declaredType(file) {
  const type = typeof file?.type === "string" ? file.type : "";
  if (type) return type;
  const name = typeof file?.name === "string" ? file.name.toLowerCase() : "";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "";
}

function codeForStatus(status) {
  if (status === 401 || status === 403) return "signed_out";
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limited";
  if (status === 503) return "unavailable";
  return "rejected";
}

/**
 * Cloudinary's own refusal, in words a contractor can act on. The size one is
 * the plan's per-file ceiling (Free: 10 MB for photos and PDFs) when our sign
 * step could not learn it in advance.
 */
export function explainCloudinaryRefusal(message, size) {
  const text = String(message || "");
  const m = /file size too large\. got (\d+)\. maximum is (\d+)/i.exec(text);
  if (m) {
    return {
      code: "too_large",
      maxBytes: Number(m[2]),
      message: `That file is ${megabytes(Number(m[1]) || size)} — the most that can be uploaded here is ${megabytes(Number(m[2]))}. Take the photo at a smaller size, or resize it and try again.`,
    };
  }
  if (/format .* not allowed|invalid image file|unsupported/i.test(text)) {
    return {
      code: "rejected",
      message: "That file isn't a photo, video or PDF we can accept. Upload a JPEG, PNG, HEIC, MP4, MOV or PDF.",
    };
  }
  if (/stale request|timestamp/i.test(text)) {
    return { code: "rejected", message: "That upload took too long to start. Try again." };
  }
  return { code: "rejected", message: MESSAGES.rejected };
}

/**
 * The sign and verify URLs for a scope's endpoint. The staff pair is spelled
 * out in full so a grep for either route — and scripts/check-route-callers
 * .mjs — finds its caller here; the portal and self-quote pairs are built
 * from the endpoint their component already holds.
 */
function legs(endpoint) {
  const base = String(endpoint || "/api/upload").replace(/\/+$/, "");
  if (base === "/api/upload") return { sign: "/api/upload/sign", verify: "/api/upload/verify" };
  return { sign: `${base}/sign`, verify: `${base}/verify` };
}

/** A Response's ok, or the status's answer when a stand-in has no `ok`. */
function responseOk(res) {
  return typeof res?.ok === "boolean" ? res.ok : res?.status >= 200 && res?.status < 300;
}

async function postJson(fetchImpl, url, body) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError(MESSAGES.network, { code: "network" });
  }
  const data = await res.json().catch(() => null);
  return { ok: responseOk(res), status: res.status, data };
}

/** The bytes to Cloudinary. XHR where there is one, for upload progress. */
function postToCloudinary(url, form, { onProgress, fetchImpl }) {
  // Read off globalThis: absent in Node (the check scripts), present in every browser.
  const XHR = globalThis.XMLHttpRequest;
  if (typeof XHR !== "function") {
    return fetchImpl(url, { method: "POST", body: form }).then(
      async (res) => ({ ok: responseOk(res), status: res.status, data: await res.json().catch(() => null) }),
      () => {
        throw new UploadError(MESSAGES.network, { code: "network" });
      },
    );
  }
  return new Promise((resolve, reject) => {
    const xhr = new XHR();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => reject(new UploadError(MESSAGES.network, { code: "network" }));
    xhr.onabort = () => reject(new UploadError(MESSAGES.network, { code: "network" }));
    xhr.send(form);
  });
}

/**
 * Upload one file. Resolves to the entry to store; throws UploadError.
 *
 * @param {File|Blob} file
 * @param {{ endpoint?: string, purpose?: string, filename?: string,
 *           onProgress?: (loaded:number, total:number) => void,
 *           fetchImpl?: typeof fetch }} [opts]
 *   `filename` names a Blob that has none (the offline queue's stored photo).
 */
export async function uploadFile(file, { endpoint = "/api/upload", purpose, filename, onProgress, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  if (!file || typeof file.size !== "number") throw new UploadError("No file provided.", { code: "rejected" });
  const name = filename || (typeof file.name === "string" ? file.name : "");
  const type = declaredType({ type: file.type, name });
  const route = legs(endpoint);

  // 1 — sign
  const signed = await postJson(doFetch, route.sign, { purpose, type, size: file.size, name });
  if (!signed.ok || !signed.data?.uploadUrl || !signed.data?.fields) {
    const code = signed.data?.code === "too_large" ? "too_large" : codeForStatus(signed.status);
    throw new UploadError(signed.data?.error || MESSAGES[code] || MESSAGES.rejected, {
      code,
      status: signed.status,
      serverMessage: signed.data?.error || null,
      size: file.size,
      maxBytes: signed.data?.maxBytes || null,
    });
  }

  // 2 — the bytes, browser → Cloudinary
  const form = new FormData();
  for (const [k, v] of Object.entries(signed.data.fields)) form.append(k, v);
  form.append("file", file, name || undefined);
  const progressId = beginUpload(name, file.size);
  let stored;
  try {
    stored = await postToCloudinary(signed.data.uploadUrl, form, {
      fetchImpl: doFetch,
      onProgress: (loaded, total) => {
        updateUpload(progressId, loaded, total);
        onProgress?.(loaded, total);
      },
    });
  } finally {
    endUpload(progressId);
  }
  if (!stored.ok || !stored.data?.public_id) {
    const explained = explainCloudinaryRefusal(stored.data?.error?.message, file.size);
    // A 5xx from Cloudinary is theirs and worth retrying; say so plainly.
    if (stored.status >= 500) throw new UploadError(MESSAGES.network, { code: "network", status: stored.status });
    throw new UploadError(explained.message, {
      code: explained.code,
      status: stored.status || 400,
      size: file.size,
      maxBytes: explained.maxBytes || null,
    });
  }

  // 3 — verify
  const verified = await postJson(doFetch, route.verify, {
    purpose,
    publicId: stored.data.public_id,
    version: stored.data.version,
    signature: stored.data.signature,
    resourceType: stored.data.resource_type,
    filename: name,
  });
  if (!verified.ok || !verified.data?.url) {
    const code =
      verified.status === 413 ? "too_large" : verified.status === 403 && verified.data?.code ? "unconfirmed" : codeForStatus(verified.status);
    throw new UploadError(verified.data?.error || MESSAGES[code] || MESSAGES.rejected, {
      code,
      status: verified.status,
      serverMessage: verified.data?.error || null,
      size: file.size,
    });
  }
  const d = verified.data;
  return {
    url: d.url,
    publicId: d.publicId || null,
    kind: ["photo", "video", "document"].includes(d.kind) ? d.kind : "photo",
    filename: typeof d.filename === "string" ? d.filename : "",
    bytes: Number.isFinite(Number(d.bytes)) ? Number(d.bytes) : null,
    mimeType: type || null,
  };
}
