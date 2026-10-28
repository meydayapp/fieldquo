// lib/receipts/media.js
//
// Which uploaded files a receipt scan can actually read — and the honest
// refusal for the ones it cannot.
//
// ══ One rule, both receipt readers ════════════════════════════════════════
//
// There used to be two: the receipts book read photos AND a PDF, the
// job-materials scanner read photos only. The split was deliberate when the
// model could not take a PDF at all — but it outlived its reason twice over:
//
//   1. lib/ai/provider.js takes ONE PDF as a `file` part, bytes inline, and
//      the vendor renders every page itself.
//   2. lib/receipts/pdf.js fetches those bytes from OUR cloud only, bounded by
//      MAX_PDF_BYTES and MAX_PDF_PAGES — so a twelve-page supplier statement,
//      the thing the scanner was protected from, is refused by page count
//      rather than by refusing the whole format.
//
// What was left was a scanner that told a contractor holding a supplier's
// emailed order "PDFs can't be read yet" while the receipts book two screens
// away read exactly that file. He did not see even that much: the upload
// itself died first (see isOwnPublicId in lib/media/directUpload.js — the
// extension's case), so he got "That upload could not be confirmed" twice in
// a row on a file nothing was ever going to accept.
//
// So receiptFilesOrRefusal below is now the ONE answer to "can this be read",
// and both callers ask it. A video is still refused, a blob: URL is still
// refused, and a photo mixed with a PDF is still refused — that last one
// because "a photo and a PDF" is almost always two different receipts put in
// one group by mistake, and reading them as one merges two purchases.

/** Reason codes, so the screen can translate rather than print English. */
export const REFUSAL = {
  MISSING: "missing",
  PDF: "pdf",
  VIDEO: "video",
  NOT_HTTP: "notHttp",
  UNKNOWN_KIND: "unknownKind",
  TOO_MANY: "tooMany",
  MIXED: "mixed",
};

// Case-insensitive on purpose: an iPhone hands over "OrderO0316950.PDF".
const PDF_EXT = /\.pdf(?:[?#].*)?$/i;

/**
 * The line printed under the upload control, BEFORE anyone picks a file.
 *
 * A limit stated after the fact is a failure message. Stated up front it is
 * just how the feature works, which is the difference AGENTS.md is drawing.
 */
export const RECEIPT_UPLOAD_HINT_KEY = "app.receipt.filesAccepted";

/** How many photographs make one receipt — lib/receipts/extract.js's cap. */
export const MAX_RECEIPT_FILES = 4;

/**
 * Is this set of uploads ONE receipt the book can read?
 *
 * One to four photographs of the same receipt (a long one shot in pieces), OR
 * exactly one PDF on its own. Mixing the two is refused: "a photo and a PDF" is
 * almost always two different receipts put in one group by mistake, and
 * reading them as one would merge two purchases into one total.
 *
 * @returns {{ ok: true, photos: string[], pdf: {url, filename}|null }}
 *       or {{ ok: false, code, error }}
 */
export function receiptFilesOrRefusal(files) {
  const list = (Array.isArray(files) ? files : []).filter(Boolean);
  if (!list.length) {
    return { ok: false, code: REFUSAL.MISSING, error: "No file was attached." };
  }
  if (list.length > MAX_RECEIPT_FILES) {
    return {
      ok: false,
      code: REFUSAL.TOO_MANY,
      error: `One receipt can be up to ${MAX_RECEIPT_FILES} photos. Upload separate receipts separately.`,
    };
  }

  const photos = [];
  let pdf = null;
  for (const file of list) {
    const url = typeof file?.url === "string" ? file.url.trim() : "";
    const kind = typeof file?.kind === "string" ? file.kind.toLowerCase() : "";
    const mime = typeof file?.mimeType === "string" ? file.mimeType.toLowerCase() : "";
    const filename = typeof file?.filename === "string" ? file.filename : "";
    if (!url) return { ok: false, code: REFUSAL.MISSING, error: "No file was attached." };
    if (!/^https:\/\//i.test(url)) {
      return { ok: false, code: REFUSAL.NOT_HTTP, error: "That file isn't somewhere we can read it from. Upload it again." };
    }
    if (kind === "video" || mime.startsWith("video/")) {
      return { ok: false, code: REFUSAL.VIDEO, error: "That's a video. Upload a still photo of the receipt." };
    }
    const isPdf = kind === "document" || mime === "application/pdf" || PDF_EXT.test(url) || PDF_EXT.test(filename);
    if (isPdf) {
      if (pdf || list.length > 1) {
        return { ok: false, code: REFUSAL.MIXED, error: "A PDF is read on its own. Upload each PDF as its own receipt." };
      }
      pdf = { url, filename: filename || "receipt.pdf" };
      continue;
    }
    if (kind && kind !== "photo") {
      return { ok: false, code: REFUSAL.UNKNOWN_KIND, error: "Only photos or a PDF of a receipt can be read." };
    }
    photos.push(url);
  }
  return { ok: true, photos, pdf };
}
