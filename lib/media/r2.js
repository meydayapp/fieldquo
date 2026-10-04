// lib/media/r2.js
//
// Cloudflare R2 — the cold store archived video posts are moved to
// (lib/marketing/videoArchive.js). R2 speaks the S3 API, so every call here
// is a SigV4-signed HTTPS request to
// https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_BUCKET>/<key>.
//
// ══ Why aws4fetch, not @aws-sdk/client-s3 ══════════════════════════════════
//
// Three calls are needed — PUT an object from a stream, HEAD it, and presign
// a GET so Cloudinary can fetch it back on a restore (plus one read-only
// list, the /platform/costs connection test). aws4fetch signs a plain
// fetch() Request and nothing else: one file, ~11 KB, no dependencies. The
// AWS SDK's S3 client is several megabytes across dozens of @aws-sdk/* and
// @smithy/* packages, loaded into a serverless function for three requests.
// The SDK's extras (multipart helpers, retries, credential chains) are not
// needed: the largest file is a 1080p clip of at most 2:30, far below S3's
// 5 GB single-PUT ceiling, and retrying is the cron's job, not a library's.
//
// ══ Not configured = not used ══════════════════════════════════════════════
//
// r2Config() names every missing variable. Nothing here guesses a bucket or
// an endpoint: without all four, the archive does nothing at all and
// /platform/costs says "not configured" with the names.

import { AwsV4Signer } from "aws4fetch";

export const R2_ENV_VARS = Object.freeze(["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]);

// An account id is 32 hex characters; a bucket name is 3–63 of [a-z0-9-].
// Anything else would be spliced into a hostname or a path, so r2Config()
// refuses it rather than signing it. Exported so the connection test
// (lib/media/r2ConnectionTest.js) can say "set, but not in this shape" with
// the same rule instead of a copy of it.
export const R2_VALUE_SHAPES = Object.freeze({
  R2_ACCOUNT_ID: /^[a-f0-9]{32}$/i,
  R2_BUCKET: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
});

/**
 * @returns {{ ok: true, accountId, accessKeyId, secretAccessKey, bucket, endpoint }
 *         | { ok: false, missing: string[] }}
 */
export function r2Config(env = process.env) {
  const read = (name) => (typeof env?.[name] === "string" ? env[name].trim() : "");
  const missing = R2_ENV_VARS.filter((name) => !read(name));
  if (missing.length) return { ok: false, missing };
  const accountId = read("R2_ACCOUNT_ID");
  const bucket = read("R2_BUCKET");
  if (!R2_VALUE_SHAPES.R2_ACCOUNT_ID.test(accountId)) return { ok: false, missing: ["R2_ACCOUNT_ID"] };
  if (!R2_VALUE_SHAPES.R2_BUCKET.test(bucket)) return { ok: false, missing: ["R2_BUCKET"] };
  return {
    ok: true,
    accountId,
    accessKeyId: read("R2_ACCESS_KEY_ID"),
    secretAccessKey: read("R2_SECRET_ACCESS_KEY"),
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

/** The object's URL — each key segment encoded, the slashes kept. */
export function objectUrl(config, key) {
  const path = String(key)
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${config.endpoint}/${config.bucket}/${path}`;
}

function signer(config, init) {
  return new AwsV4Signer({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    // R2's only region; the signature is over it all the same.
    region: "auto",
    ...init,
  });
}

/**
 * PUT a stream of exactly `bytes` bytes. The payload is sent UNSIGNED-PAYLOAD
 * (the hash of a stream is not known until it has been sent); integrity is
 * proven afterwards by headObject() against the size and MD5 we measured.
 * An explicit Content-Length makes the runtime refuse a body that ends short
 * (undici's UND_ERR_REQ_CONTENT_LENGTH_MISMATCH) instead of storing a
 * truncated file.
 *
 * @returns {Promise<{ ok: boolean, status: number, etag: string|null, error?: string }>}
 */
export async function putObjectStream(config, key, body, { bytes, contentType = "application/octet-stream", fetchImpl = fetch, timeoutMs = 240_000 } = {}) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return { ok: false, status: 0, etag: null, error: "no_length" };
  const signed = await signer(config, {
    url: objectUrl(config, key),
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(bytes) },
  }).sign();
  const res = await fetchImpl(signed.url.toString(), {
    method: "PUT",
    headers: signed.headers,
    body,
    duplex: "half",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const etag = res.headers?.get?.("etag") || null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, etag, error: `R2 PUT ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true, status: res.status, etag };
}

/**
 * HEAD an object. Absent is { exists: false }, not an error — the caller
 * decides what a missing copy means.
 *
 * @returns {Promise<{ exists: boolean, bytes: number|null, etag: string|null, status: number }>}
 */
export async function headObject(config, key, { fetchImpl = fetch } = {}) {
  const signed = await signer(config, { url: objectUrl(config, key), method: "HEAD" }).sign();
  const res = await fetchImpl(signed.url.toString(), { method: "HEAD", headers: signed.headers, signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return { exists: false, bytes: null, etag: null, status: 404 };
  if (!res.ok) throw new Error(`R2 HEAD ${res.status}`);
  const length = Number(res.headers.get("content-length"));
  return {
    exists: true,
    bytes: Number.isSafeInteger(length) && length >= 0 ? length : null,
    etag: res.headers.get("etag"),
    status: res.status,
  };
}

/**
 * The connection test's one request (lib/media/r2ConnectionTest.js): a
 * signed ListObjectsV2 for at most ONE key — GET /<bucket>?list-type=2&max-keys=1.
 *
 * ══ Why a list, not HeadBucket ═══════════════════════════════════════════
 *
 * The token the archive is meant to run on is an R2 API token with "Object
 * Read & Write" scoped to the one bucket (docs/VERCEL.md). Cloudflare's token
 * docs (developers.cloudflare.com/r2/api/tokens/) say that permission
 * "allows the ability to read, write, and list objects in specific buckets";
 * bucket-level calls — listing, creating, inspecting buckets — belong to the
 * Admin permissions. HeadBucket is a bucket-level call, so on a correctly
 * scoped token it could answer 403 and the test would blame keys that are
 * fine. Listing objects is the one read the documented token is promised.
 *
 * ══ GET, hard-coded ══════════════════════════════════════════════════════
 *
 * The method is not a parameter. A test that could be talked into a PUT or a
 * DELETE is not a read-only test; scripts/check-video-archive.mjs asserts
 * the method on the wire. Redirects are not followed: R2 does not redirect a
 * signed request, so a 3xx is reported as the unexpected answer it is rather
 * than re-sent somewhere else.
 *
 * Returns the raw answer for classifyR2Probe(); a network failure throws, as
 * fetch() does, and the caller classifies that too. The body is capped — an
 * S3 error document is a few hundred bytes, and a 4 MB HTML page from
 * something in between is not worth reading whole.
 *
 * @returns {Promise<{ status: number, body: string }>}
 */
export async function listObjectsProbe(config, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const url = new URL(`${config.endpoint}/${config.bucket}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("max-keys", "1");
  const signed = await signer(config, { url: url.toString(), method: "GET" }).sign();
  const res = await fetchImpl(signed.url.toString(), {
    method: "GET",
    headers: signed.headers,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, body: text.slice(0, 8_000) };
}

/**
 * A time-limited GET URL for one object — what Cloudinary is handed on a
 * restore, so the bytes go R2 → Cloudinary directly and never through a
 * FieldQuo function. Cloudinary may queue the fetch, hence hours not minutes.
 */
export async function presignGetUrl(config, key, { expiresSeconds = 6 * 60 * 60, now = new Date() } = {}) {
  const url = new URL(objectUrl(config, key));
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await signer(config, {
    url: url.toString(),
    method: "GET",
    signQuery: true,
    datetime: now.toISOString().replace(/[:-]|\.\d{3}/g, ""),
  }).sign();
  return signed.url.toString();
}
