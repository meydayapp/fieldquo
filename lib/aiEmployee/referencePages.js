// lib/aiEmployee/referencePages.js
//
// The page arithmetic of the AI employee's reference library — which pages
// of a manual were read, which were not, and how to say so. Pure and
// import-free, so the settings screen (a "use client" page) and the server
// print the SAME numbers: "Read 41 of 42 pages", "Couldn't read pages
// 12–14 (scanned)".
//
// ══ An unread page is never a read page ═══════════════════════════════════
//
// The file this grew out of (lib/aiEmployee/sources.js) was founded on one
// rule: never "ready" beside a document nobody read. A PDF breaks that rule
// in a new way — it can be HALF read: a manual whose wiring diagrams are
// scans, or a whole scanned brochure. So a page counts as read only when it
// has real text (PAGE_TEXT_MIN_CHARS of letters or digits, from the PDF's own
// text layer or read by AI), and the status says which of three things is
// true: every page read ("ready"), some ("partial"), none ("failed", reason
// "scanned").

/** Fewer letters/digits than this on a page and it is a scan, not a page of
 *  text — a page number or a stray header is not something to answer from. */
export const PAGE_TEXT_MIN_CHARS = 20;

/** The most pages of one PDF that are read. A 300-page service manual fits;
 *  past this, the screen says the rest wasn't read and to split the file. */
export const MAX_REFERENCE_PAGES = 400;

/** How many page images one "Read scanned pages with AI" request carries —
 *  ~4 × 400 KB of JPEG stays well inside a function's 4.5 MB request body. */
export const OCR_PAGES_PER_BATCH = 4;

/** The width the browser renders a scanned page at before it is read. */
export const OCR_RENDER_WIDTH_PX = 1600;

/** Does this page's text count as read? */
export function pageHasText(text) {
  const meaningful = String(text || "").match(/[\p{L}\p{N}]/gu);
  return Boolean(meaningful && meaningful.length >= PAGE_TEXT_MIN_CHARS);
}

/**
 * The state of a PDF from its pages.
 *
 * @param pages      [{ page, text }] — every page that was looked at
 * @param pageCount  the PDF's own page count (may exceed pages.length when
 *                   the file was longer than MAX_REFERENCE_PAGES)
 * @returns {{ pageCount, pagesRead, unreadPages: number[], skippedPages,
 *             status: "ready"|"partial"|"failed", failureReason: string|null }}
 */
export function summarisePages(pages, pageCount = null) {
  const list = Array.isArray(pages) ? pages : [];
  const total = Number.isFinite(Number(pageCount)) && Number(pageCount) > 0 ? Math.floor(Number(pageCount)) : list.length;
  const unreadPages = [];
  let pagesRead = 0;
  for (const p of list) {
    if (pageHasText(p?.text)) pagesRead += 1;
    else unreadPages.push(Number(p.page));
  }
  unreadPages.sort((a, b) => a - b);
  const skippedPages = Math.max(0, total - list.length);
  let status = "ready";
  let failureReason = null;
  if (total === 0) {
    status = "failed";
    failureReason = "app.aiEmployee.source.failed.empty";
  } else if (pagesRead === 0) {
    status = "failed";
    failureReason = "app.aiEmployee.source.failed.pdfScanned";
  } else if (unreadPages.length || skippedPages) {
    status = "partial";
  }
  return { pageCount: total, pagesRead, unreadPages, skippedPages, status, failureReason };
}

/** [12, 13, 14, 20] → "12–14, 20". Empty → "". */
export function pageRanges(pages) {
  const sorted = [...new Set((Array.isArray(pages) ? pages : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return parts.join(", ");
}

/** The unread page numbers stored on a source row (Json), cleaned. */
export function unreadOf(source) {
  const raw = Array.isArray(source?.unreadPages) ? source.unreadPages : [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= MAX_REFERENCE_PAGES))].sort((a, b) => a - b);
}

/** Split page numbers into OCR batches. */
export function ocrBatches(pages, size = OCR_PAGES_PER_BATCH) {
  const list = [...pages];
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
