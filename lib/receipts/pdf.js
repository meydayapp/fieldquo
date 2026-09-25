// lib/receipts/pdf.js
//
// A PDF receipt, fetched from our own Cloudinary and handed to the model as
// bytes.
//
// ══ Why the server fetches it ══════════════════════════════════════════════
//
// A photo is read by URL — the vendor fetches it. A PDF on chat completions
// cannot be: the vendor takes it inline as base64 (see lib/ai/provider.js's
// userContent). So THIS server downloads it, and a server that downloads a URL
// a browser chose is an SSRF door unless the URL is pinned. It is pinned to
// the one host and cloud our uploads write to — res.cloudinary.com/<our
// cloud>/ — and anything else is refused before a byte is requested. That
// holds unchanged for direct uploads: the URL stored is the one the verify
// step took from Cloudinary's Admin API (lib/media/directUpload.js), which is
// itself checked with isOurCloudinaryUrl below before it is ever saved.
//
// ══ The two limits, and why each is where it is ═══════════════════════════
//
// SIZE: this used to be Vercel's 4.5 MB request body — the most /api/upload
// could ever have accepted. Uploads now go browser → Cloudinary directly
// (lib/media/uploadClient.js), so a receipt PDF can be larger than that, and
// the cap here is our own decision rather than an echo of the transport: the
// PDF is held in this function's memory and sent to the model as base64 (a
// third bigger again), so it stays bounded. 10 MB is the Cloudinary Free
// plan's own ceiling for a raw file and clears a phone-scanned receipt of the
// six pages allowed below. Anything larger is refused with the "upload the
// receipt pages only" sentence, not streamed.
//
// PAGES: each page is rendered and billed as an image, so a 60-page supplier
// statement uploaded as "a receipt" would cost 60 receipts. The count is read
// from the file's own page objects. It is a best effort — a PDF that keeps its
// page tree in a compressed object stream shows none — and an UNKNOWN count is
// allowed through rather than refused, because refusing every modern PDF to
// catch the odd statement would make the feature not work. Size still bounds it.

/** Pages one receipt may have. A till receipt is one; a supplier invoice is
 *  two or three; anything past this is a statement, not a receipt. */
export const MAX_PDF_PAGES = 6;

/** The largest receipt PDF read into memory for the model. See SIZE above. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Is this URL one of OUR uploads? Pure, so the check script can attack it. */
export function isOurCloudinaryUrl(url, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  if (!cloudName || typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "res.cloudinary.com") return false;
  // A userinfo or port on a "Cloudinary" URL is somebody testing the parser.
  if (parsed.username || parsed.password || parsed.port) return false;
  return parsed.pathname.startsWith(`/${cloudName}/`);
}

/**
 * Page objects in a PDF's bytes. `/Type /Page` but not `/Type /Pages` (the
 * tree node). 0 means "could not tell", never "no pages".
 */
export function countPdfPages(buffer) {
  if (!buffer || !buffer.length) return 0;
  const text = Buffer.from(buffer).toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 0;
}

/**
 * Fetch one PDF receipt for the model.
 *
 * @returns {{ ok: true, base64, filename, pages }} or {{ ok: false, reason }}
 *          reason ∈ "not_ours" | "fetch_failed" | "too_large" | "not_pdf" | "too_many_pages"
 */
export async function fetchReceiptPdf({ url, filename }, { fetchImpl = fetch } = {}) {
  if (!isOurCloudinaryUrl(url)) return { ok: false, reason: "not_ours" };

  let res;
  try {
    res = await fetchImpl(url, { redirect: "error" });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
  if (!res?.ok) return { ok: false, reason: "fetch_failed" };

  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) return { ok: false, reason: "too_large" };

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_PDF_BYTES) return { ok: false, reason: "too_large" };
  // The magic number, not the extension: a renamed .jpg would otherwise be
  // sent to the vendor as a PDF and come back as a vendor error about us.
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, reason: "not_pdf" };

  const pages = countPdfPages(buffer);
  if (pages > MAX_PDF_PAGES) return { ok: false, reason: "too_many_pages", pages };

  return {
    ok: true,
    base64: buffer.toString("base64"),
    filename: String(filename || "receipt.pdf"),
    pages: pages || null,
  };
}
