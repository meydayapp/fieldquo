// lib/receipts/media.js
//
// Which uploaded files a receipt scan can actually read — and the honest
// refusal for the ones it cannot.
//
// ══ Photos only on the JOB-MATERIALS scanner, and the screen says so ═══════
//
// (The receipts book reads PDFs too — see receiptFilesOrRefusal at the foot
// of this file for what changed and why this scanner was left as it is.)
//
// Two independent facts make a PDF unreadable on this path, and neither is a
// small fix:
//
//   1. lib/ai/provider.js speaks OpenAI chat completions and its userContent()
//      emits `{ type: "image_url" }` and nothing else. A chat completion cannot
//      read a PDF that way.
//   2. /api/upload stores a PDF as Cloudinary `resource_type: "raw"` (see
//      lib/media/validate.js), and a raw asset is not transformable — so there
//      is no page-render URL to hand a vision model even if there were a way
//      to ask for one.
//
// Making PDFs work means changing the upload path to store receipts as
// `resource_type: "image"` so Cloudinary's `pg_1,f_jpg` transformation applies.
// That is a real change to a shared upload route and it is not being smuggled
// in behind a receipt feature.
//
// So: a PDF is REFUSED, with the reason and with what to do instead. AGENTS.md
// is unambiguous about the alternative — "a dropzone that accepts a PDF and
// returns nothing is the dead-control failure". A contractor at a till
// photographs the receipt anyway; the refusal costs them nothing and a silent
// failure would cost them the trip back.
//
// Pure. No imports, so scripts/check-purchasing.mjs runs it directly.

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

const PDF_EXT = /\.pdf(?:[?#].*)?$/i;

/**
 * Is this attachment something the vision call can read?
 *
 * @param file  what /api/upload handed back: { url, kind, filename, mimeType? }
 *              `kind` is the SERVER's classification (photo|video|document) —
 *              trusted first, exactly as MediaUploader trusts it, because the
 *              server is the side that inspected the bytes.
 *
 * @returns {{ok: true, url: string}} or {{ok: false, code: string, error: string}}
 */
export function receiptImageOrRefusal(file) {
  const url = typeof file?.url === "string" ? file.url.trim() : "";
  const kind = typeof file?.kind === "string" ? file.kind.toLowerCase() : "";
  const mime = typeof file?.mimeType === "string" ? file.mimeType.toLowerCase() : "";
  const filename = typeof file?.filename === "string" ? file.filename : "";

  if (!url) {
    return { ok: false, code: REFUSAL.MISSING, error: "No file was attached." };
  }

  // A PDF is checked before the URL scheme, so the person holding a PDF gets
  // the useful sentence rather than a generic one about protocols.
  if (kind === "document" || mime === "application/pdf" || PDF_EXT.test(url) || PDF_EXT.test(filename)) {
    return {
      ok: false,
      code: REFUSAL.PDF,
      error:
        "PDFs can't be read yet — only photos. Take a picture of the receipt with your phone and upload that instead.",
    };
  }

  if (kind === "video" || mime.startsWith("video/")) {
    return {
      ok: false,
      code: REFUSAL.VIDEO,
      error: "That's a video. Upload a still photo of the receipt.",
    };
  }

  // The vendor FETCHES this URL itself, so anything it cannot reach from the
  // public internet fails at their end with an error about our prompt rather
  // than about the URL. Same filter provider.js's userContent() applies, made
  // explicit here so the refusal happens before any money is spent.
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      code: REFUSAL.NOT_HTTP,
      error: "That file isn't somewhere we can read it from. Upload it again.",
    };
  }

  if (kind && kind !== "photo") {
    return {
      ok: false,
      code: REFUSAL.UNKNOWN_KIND,
      error: "Only a photo of a receipt can be scanned.",
    };
  }

  return { ok: true, url };
}

/**
 * The line printed under the upload control, BEFORE anyone picks a file.
 *
 * A limit stated after the fact is a failure message. Stated up front it is
 * just how the feature works, which is the difference AGENTS.md is drawing.
 */
export const RECEIPT_UPLOAD_HINT_KEY = "app.receipt.photosOnly";

// ══ The bookkeeping path: photos AND a PDF ═════════════════════════════════
//
// Everything above is the job-materials scanner's rule, and it still holds for
// that scanner. The receipts book (app/api/receipts/*) reads PDFs, because
// the two facts that made a PDF unreadable no longer both stand for it:
//
//   1. lib/ai/provider.js now takes ONE PDF as a `file` part, bytes inline —
//      the vendor renders every page itself, so no page-render URL is needed.
//   2. The `raw` Cloudinary asset is fine for that: lib/receipts/pdf.js
//      fetches the bytes server-side (from OUR cloud only) and hands them over.
//
// The job-materials scanner was deliberately left photos-only rather than
// widened in passing: it prefills one material line from one photo, and a
// supplier's twelve-page statement is not that. A PDF there is still refused
// with the sentence above, and the receipts book is where it goes.

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
