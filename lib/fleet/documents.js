// lib/fleet/documents.js
//
// The rules for a van's paperwork — the registration, the insurance policy,
// the bill of sale, the photo of the dent. No database, no Cloudinary.
//
// ══ Mirrors lib/jobs/documents.js, and imports rather than copies it ═══════
//
// The URL check, the name and the size rules are the job store's, imported.
// A second `isUploadedUrl` here would be the copy nobody looks at when the
// Cloudinary host changes (AGENTS.md failure class #4). What is different
// enough to live here is the kind list and the one thing a job document
// never has: an expiry date that the fleet screen ALREADY tracks in a column
// of its own.
//
// ══ The paper and the column must agree ════════════════════════════════════
//
// `VehicleDetail.insuranceExpiresAt` is what the due-and-expiring panel reads.
// An insurance policy filed here with an expiry date is a better source for
// that column than a date somebody typed from memory, so filing one moves the
// column — and it is the NEWEST filed policy that wins, by upload date, not
// the latest expiry. A renewal is uploaded after the policy it replaces; a
// policy cancelled early and replaced by a shorter one is still the current
// policy. "Newest by expiry" would keep pointing at the cancelled one.
//
// Only a document that carries a date says anything. A registration uploaded
// without one leaves the column exactly as it was — absence of a statement is
// not a statement.
//
// ══ The bill of sale is the price ══════════════════════════════════════════
//
// What the van cost is the company's cost basis, and lib/fleet/access.js
// gates it behind a second read. A "purchase" document is that number on
// letterhead, so it sits behind the same gate, in both directions — the same
// shape as MONEY_KINDS in the job store, and for the same reason: a kind that
// can be filed but not seen back is a document that gets uploaded twice.
import {
  isUploadedUrl,
  normaliseName,
  normaliseSizeBytes,
} from "@/lib/jobs/documents";
import { toDate } from "@/lib/expiry/window";

/** In the order a contractor reaches for one. */
export const VEHICLE_DOCUMENT_KINDS = Object.freeze([
  "registration",
  "insurance",
  "purchase",
  "photo",
  "other",
]);

const KIND_SET = new Set(VEHICLE_DOCUMENT_KINDS);

/** The kinds only somebody who may see what the van cost may see or file. */
export const VEHICLE_MONEY_KINDS = new Set(["purchase"]);

/** Which document kind feeds which expiry column on VehicleDetail. */
export const EXPIRY_COLUMN_BY_KIND = Object.freeze({
  insurance: "insuranceExpiresAt",
  registration: "registrationExpiresAt",
});

export function canSeeVehicleDocumentKind(kind, { canSeeCost }) {
  return !!canSeeCost || !VEHICLE_MONEY_KINDS.has(kind);
}

/**
 * What this member may see, and how many rows were withheld.
 *
 * A count, never a list — "nothing here" and "something here you may not
 * see" are different statements (lib/jobs/documents.js `visibleDocuments`).
 */
export function visibleVehicleDocuments(documents, { canSeeCost }) {
  const list = Array.isArray(documents) ? documents : [];
  const visible = list.filter((d) => canSeeVehicleDocumentKind(d?.kind, { canSeeCost }));
  return { documents: visible, hiddenCount: list.length - visible.length };
}

/**
 * Read a document body off a request.
 *
 * @returns {{ data }} or {{ error, status }}
 *
 * A wrong kind is refused, not filed as "other" — the job store's reasoning,
 * unchanged: a typo'd kind silently filed under "other" is a policy nobody
 * finds again.
 */
export function parseVehicleDocumentBody(body, { cloudName } = {}) {
  const rawKind = body?.kind;
  const kind =
    rawKind === undefined || rawKind === null || rawKind === "" ? "other" : rawKind;
  if (typeof kind !== "string" || !KIND_SET.has(kind)) {
    return {
      error: `"${String(rawKind).slice(0, 40)}" isn't a document type. Pick one of: ${VEHICLE_DOCUMENT_KINDS.join(", ")}.`,
      status: 400,
    };
  }

  if (!isUploadedUrl(body?.url, { cloudName })) {
    return {
      error:
        "That file hasn't been uploaded yet. Pick the file again — documents are stored through FieldQuo's own uploader, not linked from elsewhere.",
      status: 400,
    };
  }

  let expiresAt = null;
  if (body?.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
    expiresAt = toDate(body.expiresAt);
    if (!expiresAt) return { error: "That date isn't a date.", status: 400 };
  }

  return {
    data: {
      name: normaliseName(body?.name, "Untitled document"),
      kind,
      url: body.url,
      sizeBytes: normaliseSizeBytes(body?.sizeBytes),
      mimeType: typeof body?.mimeType === "string" ? body.mimeType.slice(0, 120) : null,
      expiresAt,
    },
  };
}

/**
 * The expiry columns the filed paperwork implies.
 *
 * @param documents  AssetDocument rows for one asset, any order
 * @returns {{ insuranceExpiresAt?: Date, registrationExpiresAt?: Date }}
 *
 * A key is PRESENT only when a document of that kind with a date exists; an
 * absent key means "the paper says nothing", and the caller leaves the column
 * alone. Newest by `uploadedAt` wins — see the header. Two uploaded in the
 * same instant fall back to id order so the answer is at least stable.
 */
export function expiryFromDocuments(documents) {
  const out = {};
  const newest = {};
  for (const doc of Array.isArray(documents) ? documents : []) {
    const column = EXPIRY_COLUMN_BY_KIND[doc?.kind];
    if (!column) continue;
    const expiresAt = toDate(doc.expiresAt);
    if (!expiresAt) continue;
    const uploadedAt = toDate(doc.uploadedAt) || new Date(0);
    const prev = newest[column];
    if (
      !prev ||
      uploadedAt > prev.uploadedAt ||
      (uploadedAt.getTime() === prev.uploadedAt.getTime() &&
        String(doc.id || "") > String(prev.id || ""))
    ) {
      newest[column] = { uploadedAt, id: doc.id, expiresAt };
    }
  }
  for (const [column, hit] of Object.entries(newest)) out[column] = hit.expiresAt;
  return out;
}

/**
 * The columns that would actually CHANGE, given what is on the row now.
 *
 * Returned as Prisma `data`, or null when nothing moves — so a route can skip
 * the write, report `expiryUpdated: false` honestly, and never stamp
 * `updatedAt` on a row it did not change.
 */
export function expiryColumnsToWrite(vehicle, documents) {
  const implied = expiryFromDocuments(documents);
  const data = {};
  for (const [column, date] of Object.entries(implied)) {
    const current = toDate(vehicle?.[column]);
    if (!current || current.getTime() !== date.getTime()) data[column] = date;
  }
  return Object.keys(data).length ? data : null;
}
