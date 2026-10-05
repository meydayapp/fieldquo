// lib/planRead/pdfSplit.js
//
// A drawing set too big for the company's file storage, split in the
// BROWSER into parts that fit — page order kept, every part a real PDF.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// Cloudinary's Free plan stores a raw file of at most 10 MB
// (usage().media_limits.raw_max_size_bytes = 10,485,760), and
// lib/media/directUpload.js effectiveCap() rightly refuses a bigger upload
// before the bytes are sent. A real 13-sheet church set is 13.4 MB, so the
// drawing read refused the very thing it exists for. Splitting is the fix that
// works on every plan without touching the account: each part is filed as its
// own document on the read, the server reads each part's text the same way
// (lib/planRead/documents.js numbers the sheets on across documents — p8 is
// the first sheet of part 2 when part 1 had 7), and one read covers them all.
//
// ══ How ════════════════════════════════════════════════════════════════════
//
// pdf-lib copies whole pages into new documents (fonts and images included),
// so a part opens on its own and pdf.js reads its vector text exactly as it
// would have read the original's. Parts are cut by page COUNT first, from the
// set's average bytes per page, then any part still over the limit is halved
// until it fits. A single page larger than the limit cannot be split further:
// that is refused with the page number, never uploaded and never truncated.
//
// Runs in the browser (QuoteFilesCard) and in Node (the check runs it over the
// real church set). pdf-lib is imported only when a split is needed.

export const SPLIT_HEADROOM = 0.92;

export class PdfSplitError extends Error {
  constructor(code, { page = null, bytes = null } = {}) {
    super(code);
    this.name = "PdfSplitError";
    this.code = code; // "encrypted" | "unreadable" | "page_too_large"
    this.page = page;
    this.bytes = bytes;
  }
}

/** "Church set.pdf" → "Church set — part 2 of 3 (sheets 8–13).pdf". Pure. */
export function partName(name, index, total, firstPage, lastPage) {
  const base = String(name || "drawings.pdf").replace(/\.pdf$/i, "");
  const sheets = firstPage === lastPage ? `sheet ${firstPage}` : `sheets ${firstPage}–${lastPage}`;
  return `${base} — part ${index} of ${total} (${sheets}).pdf`;
}

/** Pages per part from the set's average page weight. Pure. */
export function pagesPerPart({ fileBytes, pageCount, maxBytes, headroom = SPLIT_HEADROOM }) {
  const n = Math.max(1, Math.floor(Number(pageCount) || 1));
  const bytes = Math.max(1, Number(fileBytes) || 1);
  const target = Math.max(1, Math.floor(Number(maxBytes) * headroom));
  return Math.max(1, Math.min(n, Math.floor((n * target) / bytes)));
}

/**
 * Split a PDF so every part is at most maxBytes × headroom.
 *
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Promise<Array<{ bytes: Uint8Array, firstPage: number, lastPage: number }>>}
 *   1-based page numbers, in page order, covering every page exactly once.
 */
export async function splitPdfBytes(bytes, maxBytes, { headroom = SPLIT_HEADROOM } = {}) {
  const { PDFDocument } = await import("pdf-lib");
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let src;
  try {
    src = await PDFDocument.load(data);
  } catch (err) {
    throw new PdfSplitError(/encrypt/i.test(String(err?.message || "")) ? "encrypted" : "unreadable");
  }
  const total = src.getPageCount();
  const target = Math.floor(Number(maxBytes) * headroom);
  const build = async (from, to) => {
    const doc = await PDFDocument.create();
    const idx = [];
    for (let i = from; i <= to; i++) idx.push(i);
    for (const p of await doc.copyPages(src, idx)) doc.addPage(p);
    return doc.save({ useObjectStreams: true });
  };
  const parts = [];
  const emit = async (from, to) => {
    const out = await build(from, to);
    if (out.length <= target) {
      parts.push({ bytes: out, firstPage: from + 1, lastPage: to + 1 });
      return;
    }
    if (from === to) throw new PdfSplitError("page_too_large", { page: from + 1, bytes: out.length });
    const mid = Math.floor((from + to) / 2);
    await emit(from, mid);
    await emit(mid + 1, to);
  };
  const per = pagesPerPart({ fileBytes: data.length, pageCount: total, maxBytes, headroom });
  for (let s = 0; s < total; s += per) await emit(s, Math.min(total - 1, s + per - 1));
  return parts;
}

/**
 * A picked File → File parts that each fit under maxBytes, named in order.
 * @returns {Promise<File[]>}
 */
export async function splitPdfFile(file, maxBytes, opts = {}) {
  const parts = await splitPdfBytes(new Uint8Array(await file.arrayBuffer()), maxBytes, opts);
  return parts.map(
    (p, i) => new File([p.bytes], partName(file.name, i + 1, parts.length, p.firstPage, p.lastPage), { type: "application/pdf" }),
  );
}
