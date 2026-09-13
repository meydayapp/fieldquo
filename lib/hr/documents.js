// lib/hr/documents.js
//
// The rules for a person's paperwork — the WHMIS card, the driver's licence,
// the signed contract, the TD1. No database, no Cloudinary: pure functions
// the routes call and scripts/check-hr.mjs executes.
//
// ══ Mirrors lib/fleet/documents.js, and imports rather than copies ═════════
//
// The URL check, the name and size rules are the job store's. A second
// `isUploadedUrl` here would be the copy nobody looks at when the Cloudinary
// host changes (AGENTS.md failure class #4).
//
// ══ Who filed it is a fact about the document ══════════════════════════════
//
// A licence a worker uploaded from their phone and a licence a manager
// scanned at the office are the same file with different standing. The
// compliance screen shows "unverified" on the first until a manager has
// looked at it, so `uploadedByKind` is carried on the row and `verifiedAt`
// is a separate, manager-only stamp — the worker cannot verify their own.
import { isUploadedUrl, normaliseName, normaliseSizeBytes } from "@/lib/jobs/documents";
import { toDate } from "@/lib/expiry/window";

/** In the order a manager reaches for one. */
export const WORKER_DOCUMENT_KINDS = Object.freeze([
  "certification",
  "licence",
  "id",
  "contract",
  "tax_form",
  "policy_ack",
  "other",
]);

const KIND_SET = new Set(WORKER_DOCUMENT_KINDS);

/**
 * The kinds a WORKER may file about themselves. A contract and a tax form
 * are the company's paper (a tax form arrives through the onboarding form,
 * not as an upload); a policy acknowledgement is produced by signing, never
 * uploaded. Everything else — their licence, their tickets, their ID — is
 * theirs to hand over.
 */
export const WORKER_SELF_KINDS = Object.freeze(["certification", "licence", "id", "other"]);

/** The kinds whose expiry is worth a reminder. An ID card expiring is the
 *  person's business; a lapsed forklift ticket is the company's. */
export const EXPIRING_KINDS = new Set(["certification", "licence"]);

/** The two marks the reminder cron fires at, in days before expiry. */
export const REMINDER_DAYS = Object.freeze({ worker: [30, 7], manager: [7] });

const NUMBER_MAX = 80;
const NOTE_MAX = 1000;

/**
 * Read a document body off a request.
 *
 * @param body      the parsed JSON
 * @param opts      { cloudName, by: "manager"|"worker" } — a worker's body
 *                  is held to WORKER_SELF_KINDS and may not carry a note or
 *                  a verification.
 * @returns {{ data }} or {{ error, status }}
 */
export function parseWorkerDocumentBody(body, { cloudName, by = "manager" } = {}) {
  const rawKind = body?.kind;
  const kind = rawKind === undefined || rawKind === null || rawKind === "" ? "other" : rawKind;
  if (typeof kind !== "string" || !KIND_SET.has(kind)) {
    return {
      error: `"${String(rawKind).slice(0, 40)}" isn't a document type. Pick one of: ${WORKER_DOCUMENT_KINDS.join(", ")}.`,
      status: 400,
    };
  }
  if (by === "worker" && !WORKER_SELF_KINDS.includes(kind)) {
    return {
      error: "You can upload a certification, a licence, an ID or another document of your own. Contracts and tax forms come from the company.",
      status: 400,
    };
  }

  if (!isUploadedUrl(body?.fileUrl, { cloudName })) {
    return {
      error:
        "That file hasn't been uploaded yet. Pick the file again — documents are stored through FieldQuo's own uploader, not linked from elsewhere.",
      status: 400,
    };
  }

  let issuedAt = null;
  if (body?.issuedAt !== undefined && body.issuedAt !== null && body.issuedAt !== "") {
    issuedAt = toDate(body.issuedAt);
    if (!issuedAt) return { error: "The issue date isn't a date.", status: 400 };
  }
  let expiresAt = null;
  if (body?.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
    expiresAt = toDate(body.expiresAt);
    if (!expiresAt) return { error: "The expiry date isn't a date.", status: 400 };
  }
  if (issuedAt && expiresAt && expiresAt < issuedAt) {
    return { error: "A document can't expire before it was issued.", status: 400 };
  }

  const number = typeof body?.number === "string" ? body.number.trim().slice(0, NUMBER_MAX) : "";
  const note = by === "manager" && typeof body?.note === "string" ? body.note.trim().slice(0, NOTE_MAX) : "";

  return {
    data: {
      kind,
      title: normaliseName(body?.title, "Untitled document"),
      fileUrl: body.fileUrl,
      sizeBytes: normaliseSizeBytes(body?.sizeBytes),
      mimeType: typeof body?.mimeType === "string" ? body.mimeType.slice(0, 120) : null,
      issuedAt,
      expiresAt,
      number: number || null,
      note: note || null,
      uploadedByKind: by === "worker" ? "worker" : "manager",
    },
  };
}

/** What a document row looks like over the wire. No uploader id — a user id
 *  is not the worker's business, and the manager screen shows a name. */
export const WORKER_DOCUMENT_SELECT = Object.freeze({
  id: true,
  workerId: true,
  kind: true,
  title: true,
  fileUrl: true,
  sizeBytes: true,
  mimeType: true,
  issuedAt: true,
  expiresAt: true,
  number: true,
  uploadedByKind: true,
  verifiedAt: true,
  note: true,
  archivedAt: true,
  createdAt: true,
});

/**
 * The PATCH a manager may make: verify, un-verify, archive, edit the note or
 * the dates. Never the file, never the kind — a different file is a new row.
 *
 * @returns {{ data }} with only the keys present in the body, or {{ error }}
 */
export function parseWorkerDocumentPatch(body) {
  const data = {};
  if (body?.verified === true) data.verified = true;
  else if (body?.verified === false) data.verified = false;
  if (body?.archived === true) data.archived = true;
  if (body?.note !== undefined) {
    if (body.note !== null && typeof body.note !== "string") return { error: "The note must be text.", status: 400 };
    data.note = body.note ? body.note.trim().slice(0, NOTE_MAX) || null : null;
  }
  if (body?.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === "") data.expiresAt = null;
    else {
      const d = toDate(body.expiresAt);
      if (!d) return { error: "The expiry date isn't a date.", status: 400 };
      data.expiresAt = d;
    }
  }
  if (body?.number !== undefined) {
    if (body.number !== null && typeof body.number !== "string") return { error: "The number must be text.", status: 400 };
    data.number = body.number ? body.number.trim().slice(0, NUMBER_MAX) || null : null;
  }
  if (Object.keys(data).length === 0) return { error: "Nothing to change.", status: 400 };
  return { data };
}
