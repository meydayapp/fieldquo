// lib/sales/payoutProofRules.js
//
// The pure half of lib/sales/payoutProof.js: the folder rule, the
// file-or-reference rule, the file classifier and the rep-facing view. No
// database, no Cloudinary, no imports beyond lib/media/validate.js (itself
// pure) — so the Mark paid form in the browser applies exactly the rule the
// route refuses with, and scripts/check-sales-payout-proof.mjs executes
// both against hostile input without a network.
//
// Why a second file rather than exporting these from payoutProof.js: that
// module imports `@/lib/db`, and a "use client" component importing it
// would pull `pg` into the browser bundle and fail the build — the same
// split lib/sales/money.js made from lib/sales/earnings.js.
import { classifyMedia } from "@/lib/media/validate";

/** Where a batch's receipt is filed. FieldQuo's own folder — see the header. */
export const PROOF_FOLDER_ROOT = "fieldquo/platform/payouts";

/** What the status column may say for a batch that has been paid. */
export const PAID_STATUS = "paid";
/** The only status a batch can be marked paid FROM. */
export const READY_STATUS = "ready";

/** Free-text caps. Long enough for a Wise reference; short enough to render. */
export const MAX_REFERENCE = 120;
export const MAX_PAID_VIA = 60;
export const MAX_NOTE = 600;

/**
 * The folder for one batch's receipt. Throws on an id that is not a plain
 * identifier: public_id is a PATH, and a batch id is the one client-supplied
 * segment in it. A cuid is [a-z0-9]; anything else is refused rather than
 * joined.
 */
export function proofFolderFor(batchId) {
  const id = String(batchId ?? "").trim();
  if (!/^[a-z0-9]{10,40}$/i.test(id)) {
    throw new Error("proofFolderFor: a batch id must be a plain identifier");
  }
  return `${PROOF_FOLDER_ROOT}/${id}`;
}

/**
 * Trim and clamp the three text fields. Empty strings become null so the
 * column says "not given" rather than "".
 */
export function normaliseProofFields(input = {}) {
  const clamp = (v, max) => {
    const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
    return s ? s.slice(0, max) : null;
  };
  return {
    paymentReference: clamp(input.paymentReference, MAX_REFERENCE),
    paidVia: clamp(input.paidVia, MAX_PAID_VIA),
    paymentNote: clamp(input.paymentNote, MAX_NOTE),
  };
}

/**
 * Whether a file is acceptable as a receipt: an image or a PDF. Videos are
 * refused — a transfer confirmation is a page, not a clip — and so is SVG
 * (classifyMedia's default; this is not a logo). Pure; takes a File-like
 * `{ type, size }`.
 */
export function classifyProofFile(file) {
  const verdict = classifyMedia(file);
  if (!verdict.ok) return verdict;
  if (verdict.kind === "video") {
    return { ok: false, error: "A receipt is an image or a PDF, not a video." };
  }
  return verdict;
}

/**
 * The one rule: a file or a reference. Null when the input is enough to mark
 * paid; otherwise the sentence the screen shows and the route refuses with.
 *
 * `existing` is the batch as it stands — so a batch that already carries a
 * receipt can have its reference edited without re-uploading the file.
 */
export function proofProblem({ hasFile = false, paymentReference = null, existing = null } = {}) {
  const alreadyHasFile = Boolean(existing?.proofUrl);
  const alreadyHasRef = Boolean(existing?.paymentReference);
  if (hasFile || paymentReference || alreadyHasFile || alreadyHasRef) return null;
  return "Attach the receipt or transfer screenshot, or enter the payment reference — the rep needs one of the two to see what was sent.";
}

/** Whether a batch carries any proof at all. */
export function hasProof(batch) {
  return Boolean(batch?.proofUrl || batch?.paymentReference);
}

/**
 * The proof fields as the REP sees them. Selected by name so a column added
 * to the batch later (an internal flag, say) does not leak to the rep by
 * default — the same reason /api/sales/companies selects milestones narrowly.
 */
export function proofViewFor(batch) {
  return {
    paidVia: batch?.paidVia || null,
    paymentReference: batch?.paymentReference || null,
    paymentNote: batch?.paymentNote || null,
    proofUrl: batch?.proofUrl || null,
    proofFilename: batch?.proofFilename || null,
  };
}

/** "Sep 1 – Sep 8" for the push body, in the rep's language. */
export function weekLabel(periodStart, periodEnd, language = "en") {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const fmt = (d) => {
    try {
      return d.toLocaleDateString(language, { month: "short", day: "numeric", timeZone: "UTC" });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

