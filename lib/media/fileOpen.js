// lib/media/fileOpen.js
//
// The one way a stored file is opened from a screen or an email: through our
// own route, which looks the row up, signs a five-minute Cloudinary download
// link (lib/media/signedFile.js says why one is needed at all), fetches the
// bytes and streams them on with the right type and the file's real name.
//
// ══ Two doors ══════════════════════════════════════════════════════════════
//
//   STAFF   GET /api/files/open?k=<kind>&id=<row>[&i=<n>]&exp=<s>&sig=<hex>
//           A signed-in member (or a read-only support session — opening a
//           file is a read). The link is minted by the route that LISTED the
//           file, after that route's own gate (a quote's files behind the
//           quotes permission, a vehicle's behind fleet, a receipt behind
//           receiptScope…), and carries an HMAC over (reader, kind, row,
//           index, expiry). So this door does not restate eight different
//           permission rules — a restated rule is the copy that rots — it
//           checks that THIS reader was handed THIS link by a route that had
//           already decided they may see the file, and that the row is in the
//           reader's company. A link copied out of one person's screen is
//           refused for anybody else's session (the chat files' rule,
//           lib/company/chat/fileLinks.js, whose readerKey this uses).
//
//   CLIENT  GET /api/portal/<portalToken>/files/<kind>/<row>
//           GET /api/public/quotes/<shareToken>/files/<kind>/<row>
//           No session. The token the page itself was opened with is the
//           credential, and the row must belong to THAT token's document:
//           a waiver signed by THIS client, a company document the quote's
//           proposal shows, a prep-guide document of the client's own
//           contractor. Never another tenant's file, whatever id is sent.
//
// ══ Why stream rather than redirect to the signed link ═════════════════════
//
// A redirect would work for a PDF stored with ".pdf". It cannot fix the
// other half: a raw file stored with no extension (every auto-filed quote,
// contract and invoice PDF) comes back from Cloudinary as octet-stream named
// "Q-1001-v1", and a phone does nothing with it. Streaming lets the type come
// from the bytes (%PDF-) and the name from the row ("Quote Q-1001.pdf").
// It also keeps the signed link — a five-minute key to the file — on the
// server.
//
// Server-only: node:crypto. The routes inject the database and the signer,
// so scripts/check-file-open.mjs runs all of it against hostile input.

import { createHmac } from "node:crypto";
import { sameSignature } from "@/lib/media/directUpload";
import { readerKey } from "@/lib/company/chat/fileLinks";
import { normaliseAttachment } from "@/lib/messaging/attachments";
import { clientVisibleDocuments } from "@/lib/company/documents";
import { sanitisePresentation } from "@/lib/proposal/sections";
import {
  tenantFileLocation,
  platformFileLocation,
  signedOpenLink,
  signedLinkBase,
  sniffContentType,
  servedContentType,
  isInlineType,
  locationExtension,
  downloadName,
  contentDisposition,
  OCTET_STREAM,
} from "@/lib/media/signedFile";
import {
  STAFF_FILE_PATH,
  FILE_ROW_ID as ROW_ID,
  FILE_TOKEN as TOKEN,
  CLIENT_FILE_KINDS,
  clientFileHref,
  PLATFORM_FILE_KINDS,
  platformFileHref,
} from "@/lib/media/fileHrefs";

export { STAFF_FILE_PATH, CLIENT_FILE_KINDS, clientFileHref, PLATFORM_FILE_KINDS, platformFileHref };

/** How long a link in a list payload works. A working day: a job's
 *  Documents tab left open from the morning still opens after lunch. The
 *  Cloudinary link behind it lives five minutes regardless. */
export const STAFF_FILE_LINK_TTL_SECONDS = 12 * 60 * 60;

// ── What a staff link may name ──────────────────────────────────────────────
//
// kind → how to read the row inside ONE company. `indexed` kinds hold a list
// of files in one JSON column and name one by position.
const pick = (row, url, name, mimeType) => (row ? { url: row[url] || null, name: row[name] || "", mimeType: row[mimeType] || null } : null);

const STAFF_SOURCES = Object.freeze({
  "quote-document": {
    load: (db, { id, companyId }) =>
      db.quoteDocument.findFirst({ where: { id, companyId }, select: { url: true, name: true, mimeType: true } }).then((r) => pick(r, "url", "name", "mimeType")),
  },
  "job-document": {
    load: (db, { id, companyId }) =>
      db.jobDocument.findFirst({ where: { id, companyId }, select: { url: true, name: true, mimeType: true } }).then((r) => pick(r, "url", "name", "mimeType")),
  },
  "service-document": {
    load: (db, { id, companyId }) =>
      db.serviceDocument.findFirst({ where: { id, companyId }, select: { url: true, title: true, mimeType: true } }).then((r) => pick(r, "url", "title", "mimeType")),
  },
  "company-document": {
    load: (db, { id, companyId }) =>
      db.companyDocument.findFirst({ where: { id, companyId }, select: { fileUrl: true, title: true, mimeType: true } }).then((r) => pick(r, "fileUrl", "title", "mimeType")),
  },
  "subcontractor-document": {
    load: (db, { id, companyId }) =>
      db.subcontractorDocument.findFirst({ where: { id, companyId }, select: { url: true, name: true, mimeType: true } }).then((r) => pick(r, "url", "name", "mimeType")),
  },
  "asset-document": {
    load: (db, { id, companyId }) =>
      db.assetDocument.findFirst({ where: { id, companyId }, select: { url: true, name: true, mimeType: true } }).then((r) => pick(r, "url", "name", "mimeType")),
  },
  // The quote a sub WITHOUT an account attached to their price reply
  // (lib/subRequests/model.js ownReplyUpload: only a file in this GC's
  // price-replies folder is ever stored). Read on the GC's own recipient
  // row — companyId is the GC's, denormalised onto it for exactly this.
  "price-reply-file": {
    load: async (db, { id, companyId }) => {
      const r = await db.subPriceRequestRecipient.findFirst({ where: { id, companyId }, select: { replyFile: true, repliedAt: true } });
      const f = r?.repliedAt && r.replyFile && typeof r.replyFile === "object" ? r.replyFile : null;
      if (!f || typeof f.url !== "string") return null;
      return { url: f.url, name: typeof f.filename === "string" ? f.filename : "", mimeType: null };
    },
  },
  "receipt-file": {
    indexed: true,
    load: async (db, { id, companyId, index }) => {
      const r = await db.receipt.findFirst({ where: { id, companyId }, select: { files: true } });
      const f = Array.isArray(r?.files) ? r.files[index] : null;
      if (!f || typeof f !== "object") return null;
      return { url: typeof f.url === "string" ? f.url : null, name: f.filename || (f.kind === "document" ? "receipt.pdf" : "receipt"), mimeType: null };
    },
  },
  "message-attachment": {
    indexed: true,
    load: async (db, { id, companyId, index }) => {
      // A message has no company of its own; its thread does.
      const m = await db.message.findFirst({ where: { id, thread: { companyId } }, select: { attachments: true } });
      const list = Array.isArray(m?.attachments) ? m.attachments : [];
      if (index >= list.length) return null;
      // normaliseAttachment, so a pending or foreign URL is never opened —
      // the same rule the screen draws by.
      const a = normaliseAttachment(list[index], index);
      if (a.state !== "ready" || !a.url) return null;
      return { url: a.url, name: a.filename || "", mimeType: a.mimeType || null };
    },
  },
});

export const STAFF_FILE_KINDS = Object.freeze(Object.keys(STAFF_SOURCES));

function secretOr(secret) {
  const s = secret ?? process.env.BETTER_AUTH_SECRET ?? "";
  return typeof s === "string" && s.length >= 16 ? s : null;
}

function staffSignature({ reader, kind, id, index, exp }, secret) {
  return createHmac("sha256", secret).update(`file-open|${reader}|${kind}|${id}|${index ?? ""}|${exp}`).digest("hex");
}

function cleanIndex(kind, index) {
  if (!STAFF_SOURCES[kind]?.indexed) return null;
  // Number(null) is 0: an absent index must not quietly become the first file.
  if (index === null || index === undefined || index === "") return undefined;
  const i = Number(index);
  return Number.isInteger(i) && i >= 0 && i < 1000 ? i : undefined;
}

/**
 * The link one reader's screen uses to open one stored file, or null when
 * nothing can be signed. A null link is drawn as no link, never as one that
 * fails.
 */
export function staffFileLink(member, { kind, id, index = null } = {}, { now = Date.now(), secret, ttl = STAFF_FILE_LINK_TTL_SECONDS } = {}) {
  const reader = readerKey(member);
  const key = secretOr(secret);
  if (!reader || !key || !STAFF_SOURCES[kind] || typeof id !== "string" || !ROW_ID.test(id)) return null;
  const i = cleanIndex(kind, index);
  if (i === undefined) return null;
  const exp = Math.floor(now / 1000) + ttl;
  const sig = staffSignature({ reader, kind, id, index: i, exp }, key);
  const q = new URLSearchParams({ k: kind, id });
  if (i !== null) q.set("i", String(i));
  q.set("exp", String(exp));
  q.set("sig", sig);
  return `${STAFF_FILE_PATH}?${q.toString()}`;
}

/** `rows` with an `openUrl` beside each — what a list route hands a screen. */
export function withOpenUrls(member, kind, rows, opts) {
  return (Array.isArray(rows) ? rows : []).map((row) => (row && row.id ? { ...row, openUrl: staffFileLink(member, { kind, id: row.id }, opts) } : row));
}

/** A JSON list of files on one row (a receipt's pages), each with the
 *  `openUrl` that names it by position. */
export function withIndexedOpenUrls(member, kind, id, list, opts) {
  return (Array.isArray(list) ? list : []).map((f, index) =>
    f && typeof f === "object" ? { ...f, openUrl: staffFileLink(member, { kind, id, index }, opts) } : f,
  );
}

/** The `openUrl` maker for one message's attachments — what
 *  lib/messaging/attachments.js publicAttachments takes. */
export function messageOpenUrl(member, messageId, opts) {
  return (index) => staffFileLink(member, { kind: "message-attachment", id: messageId, index }, opts);
}

/**
 * Check a staff link against the session that followed it.
 * @returns {{ ok: true, kind, id, index } | { ok: false, code: "bad_link"|"expired"|"unavailable" }}
 */
export function verifyStaffFileLink(member, { kind, id, index, exp, sig } = {}, { now = Date.now(), secret } = {}) {
  const key = secretOr(secret);
  if (!key) return { ok: false, code: "unavailable" };
  const reader = readerKey(member);
  if (!reader || !STAFF_SOURCES[kind] || typeof id !== "string" || !ROW_ID.test(id)) return { ok: false, code: "bad_link" };
  const i = STAFF_SOURCES[kind].indexed ? cleanIndex(kind, index) : index === null || index === undefined || index === "" ? null : undefined;
  if (i === undefined) return { ok: false, code: "bad_link" };
  const e = Number(exp);
  if (!Number.isInteger(e) || typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, code: "bad_link" };
  // Signature first: an expired link for somebody ELSE is "bad", not
  // "expired" — the second answer would confirm the link was once good.
  if (!sameSignature(staffSignature({ reader, kind, id, index: i, exp: e }, key), sig)) return { ok: false, code: "bad_link" };
  if (Math.floor(now / 1000) > e) return { ok: false, code: "expired" };
  return { ok: true, kind, id, index: i };
}

/** The stored file a verified staff link names, inside the reader's company. */
export async function resolveStaffFile(db, { companyId, kind, id, index = null }) {
  const source = STAFF_SOURCES[kind];
  if (!source || !companyId || typeof id !== "string" || !ROW_ID.test(id)) return null;
  const file = await source.load(db, { id, companyId, index });
  return file?.url ? file : null;
}

// ── The client door ─────────────────────────────────────────────────────────
//
// The paths themselves (clientFileHref) are lib/media/fileHrefs.js's.

/**
 * The stored file a client link names — only when it belongs to the
 * document the token opens.
 *
 * @returns {Promise<{ companyId, url, name, mimeType } | null>}
 */
export async function resolveClientFile(db, { scope, token, kind, id } = {}) {
  if (!CLIENT_FILE_KINDS[scope]?.includes(kind)) return null;
  if (typeof token !== "string" || !TOKEN.test(token) || typeof id !== "string" || !ROW_ID.test(id)) return null;

  if (scope === "portal") {
    const client = await db.client.findUnique({ where: { portalToken: token }, select: { id: true, companyId: true } });
    if (!client?.companyId) return null;
    const companyId = client.companyId;
    if (kind === "waiver") {
      // The signed copy of a waiver THIS client signed — what the portal's
      // Documents section lists (app/api/portal/[token]/route.js).
      const signed = await db.documentSignature.findFirst({
        where: { clientId: client.id, companyId, status: "signed", jobDocumentId: id, document: { archivedAt: null } },
        select: { jobDocumentId: true },
      });
      if (!signed) return null;
      const doc = await db.jobDocument.findFirst({ where: { id, companyId }, select: { url: true, name: true, mimeType: true } });
      return doc?.url ? { companyId, ...pick(doc, "url", "name", "mimeType") } : null;
    }
    // "guide": a document the client's contractor attaches to preparation
    // guides (lib/prepGuide/build.js) — the email's links land here.
    const doc = await db.serviceDocument.findFirst({ where: { id, companyId }, select: { url: true, title: true, mimeType: true } });
    return doc?.url ? { companyId, ...pick(doc, "url", "title", "mimeType") } : null;
  }

  // scope "quote": a company document the proposal beside this quote shows.
  // Not gated on the quote's status: these are the company's client-facing
  // library (an insurance certificate, a warranty), not the draft's numbers
  // the draft gate exists to hide — and the instant-estimate report, which
  // shows the same documents, is a draft.
  const quote = await db.quote.findUnique({ where: { shareToken: token }, select: { companyId: true, presentation: true } });
  if (!quote?.companyId) return null;
  const doc = await db.companyDocument.findFirst({
    where: { id, companyId: quote.companyId },
    select: { id: true, type: true, title: true, fileUrl: true, mimeType: true, expiresAt: true, showOnQuotes: true, archivedAt: true },
  });
  if (!doc) return null;
  const visible = clientVisibleDocuments([doc], { ids: sanitisePresentation(quote.presentation).documentIds });
  if (!visible.length) return null;
  return { companyId: quote.companyId, ...pick(doc, "fileUrl", "title", "mimeType") };
}

// ── The platform door ───────────────────────────────────────────────────────
//
// FieldQuo's own console: GET /api/platform/files/open?k=<kind>&id=<row>.
// The platform may VIEW everything (AGENTS.md non-negotiable #3), so there is
// no reader binding here — the route's own platform gate is the whole rule.
// Each kind still carries its fence: a company's migration upload opens only
// from inside that company's folders, a payout receipt only from its batch's.

/**
 * @returns {Promise<{ url, name, mimeType, companyId?, prefix? } | null>}
 */
export async function resolvePlatformFile(db, { kind, id } = {}) {
  if (!PLATFORM_FILE_KINDS.includes(kind) || typeof id !== "string" || !ROW_ID.test(id)) return null;
  if (kind === "migration-document") {
    const doc = await db.migrationDocument.findUnique({
      where: { id },
      select: { url: true, filename: true, migrationRequest: { select: { companyId: true } } },
    });
    const companyId = doc?.migrationRequest?.companyId;
    return doc?.url && companyId ? { url: doc.url, name: doc.filename || "", mimeType: null, companyId } : null;
  }
  const batch = await db.salesPayoutBatch.findUnique({ where: { id }, select: { id: true, proofUrl: true, proofFilename: true } });
  if (!batch?.proofUrl) return null;
  // lib/sales/payoutProofRules.js proofFolderFor, restated as a prefix: the
  // receipt of THIS batch, and nothing else in FieldQuo's folder.
  return { url: batch.proofUrl, name: batch.proofFilename || "receipt", mimeType: null, prefix: `fieldquo/platform/payouts/${batch.id}/` };
}

// ── Opening it ──────────────────────────────────────────────────────────────

const HEAD_BYTES = 64;

async function peek(body) {
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  let done = false;
  while (size < HEAD_BYTES) {
    const r = await reader.read();
    if (r.done) {
      done = true;
      break;
    }
    chunks.push(r.value);
    size += r.value.length;
  }
  const head = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    head.set(c, at);
    at += c.length;
  }
  const stream = new ReadableStream({
    start(controller) {
      if (head.length) controller.enqueue(head);
      if (done) controller.close();
    },
    async pull(controller) {
      const r = await reader.read();
      if (r.done) controller.close();
      else controller.enqueue(r.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { head, stream };
}

const NO_STORE = { "Cache-Control": "private, no-store" };

function refusal(status, error) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", ...NO_STORE } });
}

export const FILE_OPEN_ERRORS = Object.freeze({
  missing: "This file isn't available any more.",
  expired: "This link has expired. Go back, refresh the page and open the file again.",
  unconfigured: "File storage isn't configured.",
  upstream: "The file couldn't be fetched just now. Try again in a minute.",
});

/**
 * Stream one stored file to the browser.
 *
 * @param file       { url, name, mimeType } — from a row, never from a request
 * @param companyId  the company the row was read inside; the tenant fence
 * @param prefix     instead of companyId, for one of FieldQuo's own files:
 *                   the exact folder it must sit in (platformFileLocation)
 * @param sign       cloudinary.utils.private_download_url, or null when unset
 * @returns {Promise<Response>}
 */
export async function openFileResponse({ file, companyId, prefix = null, cloudName, sign, fetchImpl = fetch }) {
  const at = prefix ? platformFileLocation(file?.url, { cloudName, prefix }) : tenantFileLocation(file?.url, { cloudName, companyId });
  if (!at.ok) return refusal(404, FILE_OPEN_ERRORS.missing);
  if (typeof sign !== "function") return refusal(503, FILE_OPEN_ERRORS.unconfigured);

  let link;
  try {
    link = signedOpenLink(at, { sign }).url;
  } catch {
    return refusal(503, FILE_OPEN_ERRORS.unconfigured);
  }
  const base = signedLinkBase(cloudName);
  if (typeof link !== "string" || !link.startsWith(base)) return refusal(404, FILE_OPEN_ERRORS.missing);

  let res;
  try {
    res = await fetchImpl(link, { redirect: "follow" });
  } catch {
    return refusal(502, FILE_OPEN_ERRORS.upstream);
  }
  // Cloudinary may answer the API host with a redirect to its delivery host;
  // anywhere else and the bytes are not ours to pass on.
  const finalUrl = typeof res?.url === "string" && res.url ? res.url : link;
  const finalOk = finalUrl.startsWith(base) || finalUrl.startsWith(`https://res.cloudinary.com/${cloudName}/`);
  if (!res?.ok || !res.body || !finalOk) {
    try {
      await res?.body?.cancel?.();
    } catch {}
    return refusal(res?.status === 404 ? 404 : 502, res?.status === 404 ? FILE_OPEN_ERRORS.missing : FILE_OPEN_ERRORS.upstream);
  }

  const { head, stream } = await peek(res.body);
  const type = servedContentType({ sniffed: sniffContentType(head), extension: locationExtension(at), storedType: file.mimeType });
  const inline = isInlineType(type);
  const name = downloadName(file.name, type === OCTET_STREAM ? "" : type);

  const headers = new Headers({
    "Content-Type": type,
    "Content-Disposition": contentDisposition(name, { inline }),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...NO_STORE,
  });
  // A PDF is drawn by the browser's own viewer, which a CSP sandbox blocks
  // outright; everything else gets no script and no outside requests.
  if (type !== "application/pdf") {
    headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  }
  const length = res.headers?.get?.("content-length");
  if (length && /^\d+$/.test(length) && !res.headers.get("content-encoding")) headers.set("Content-Length", length);
  return new Response(stream, { status: 200, headers });
}

/**
 * The bytes of one stored file, for the server's own use (a document
 * attached to an email). Same fence, same signer, bounded.
 *
 * @returns {Promise<{ ok: true, buffer } | { ok: false, reason: "not_ours"|"unsigned"|"fetch_failed"|"too_large" }>}
 */
export async function fetchTenantFile(url, { companyId, cloudName = process.env.CLOUDINARY_CLOUD_NAME, sign, fetchImpl = fetch, maxBytes = 25 * 1024 * 1024 } = {}) {
  const at = tenantFileLocation(url, { cloudName, companyId });
  if (!at.ok) return { ok: false, reason: "not_ours" };
  if (typeof sign !== "function") return { ok: false, reason: "unsigned" };
  let link;
  try {
    link = signedOpenLink(at, { sign }).url;
  } catch {
    return { ok: false, reason: "unsigned" };
  }
  const base = signedLinkBase(cloudName);
  if (typeof link !== "string" || !link.startsWith(base)) return { ok: false, reason: "not_ours" };
  let res;
  try {
    res = await fetchImpl(link, { redirect: "follow" });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
  if (!res?.ok) return { ok: false, reason: "fetch_failed" };
  const finalUrl = typeof res.url === "string" && res.url ? res.url : link;
  if (!(finalUrl.startsWith(base) || finalUrl.startsWith(`https://res.cloudinary.com/${cloudName}/`))) return { ok: false, reason: "not_ours" };
  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too_large" };
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, buffer };
}
