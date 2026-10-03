// lib/planRead/ingest.js
//
// Turning an uploaded file into what a drawing read can use — in CODE, with
// no model and no charge:
//
//   a drawing PDF   → one sheetFacts() per page (lib/planRead/sheetFacts.js),
//                     from the vector text pdf.js reads out of the stored file
//   a scope sheet   → parsed rows (lib/planRead/excel.js)
//   a photo         → nothing to do; it is read as it is
//
// ══ Why unpdf ══════════════════════════════════════════════════════════════
//
// unpdf is Mozilla's pdf.js packaged for serverless runtimes: one bundled
// build, no worker file to ship, no native canvas, zero dependencies. The
// alternatives were pdfjs-dist itself (pulls an optional native canvas
// package and needs its worker wired by hand under Next) and pdf-parse
// (unmaintained, and returns text without positions — a dimension string's
// position on the sheet is what lets the model say which wall it measures).
//
// Rasterising pages to images happens in the BROWSER at upload
// (app/components/planRead/pdfPages.js): the stored PDF is a raw Cloudinary
// file, which Cloudinary will not render, and rendering on the server would
// need a native canvas in the function bundle.
//
// ══ Only our own files ═════════════════════════════════════════════════════
//
// Bytes are fetched only from this deployment's Cloudinary
// (isOurCloudinaryUrl — the receipt reader's SSRF guard), with redirects
// refused and a size ceiling enforced on the header AND the body.

import { isOurCloudinaryUrl } from "@/lib/receipts/pdf";
import { sheetFacts } from "./sheetFacts";
import { parseScopeSheets } from "./excel";

/** The most a drawing PDF or spreadsheet read into memory may be — the
 *  plan-upload ceiling (lib/media/validate.js PLAN_DOCUMENT_MAX_BYTES). */
export const MAX_INGEST_BYTES = 100 * 1024 * 1024;
export const MAX_SHEETS_PER_PDF = 150;

export const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

/** Which pipeline a stored file takes. */
export function ingestKindFor(mimeType) {
  const t = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (t === "application/pdf") return "pdf";
  if (SPREADSHEET_TYPES.has(t)) return t === "text/csv" ? "csv" : "xlsx";
  if (t.startsWith("image/")) return "photo";
  return null;
}

export async function fetchOwnFile(url, { fetchImpl = fetch, maxBytes = MAX_INGEST_BYTES } = {}) {
  if (!isOurCloudinaryUrl(url)) return { ok: false, reason: "not_ours" };
  let res;
  try {
    res = await fetchImpl(url, { redirect: "error" });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
  if (!res?.ok) return { ok: false, reason: "fetch_failed" };
  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too_large" };
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, buffer };
}

/**
 * Every page of a PDF → sheet facts. `firstIndex` numbers the sheets across
 * the whole read (a second PDF's first page is p41 when the first had 40),
 * so every dimension id is unique within a read.
 */
export async function pdfSheets(bytes, { firstIndex = 1 } = {}) {
  const { getDocumentProxy } = await import("unpdf");
  const data = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(Buffer.from(bytes));
  if (Buffer.from(data.subarray(0, 5)).toString("latin1") !== "%PDF-") return { ok: false, reason: "not_pdf" };
  let pdf;
  try {
    pdf = await getDocumentProxy(data);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const count = Math.min(pdf.numPages, MAX_SHEETS_PER_PDF);
  const sheets = [];
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    // The item shape sheetFacts reads — unpdf's StructuredTextItem: position
    // from the transform, font size from its scale.
    const items = (content.items || [])
      .filter((it) => typeof it.str === "string")
      .map((it) => {
        const [a, b, , , e, f] = it.transform || [1, 0, 0, 1, 0, 0];
        return { str: it.str, x: e, y: f, width: it.width, height: it.height, fontSize: Math.hypot(a, b) };
      });
    const facts = sheetFacts(items, { page: firstIndex + i - 1, pageWidth: vp.width, pageHeight: vp.height });
    sheets.push({ ...facts, docPage: i, pointsWidth: vp.width, pointsHeight: vp.height });
    page.cleanup?.();
  }
  await pdf.destroy?.();
  return { ok: true, sheets, pageCount: pdf.numPages, truncated: pdf.numPages > count };
}

/** A scope spreadsheet's bytes → parsed rows. */
export async function spreadsheetRows(bytes, kind) {
  try {
    if (kind === "csv") {
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(Buffer.from(bytes).toString("utf8"), { skipEmptyLines: true });
      return { ok: true, parsed: parseScopeSheets([{ sheet: "CSV", data: parsed.data || [] }]) };
    }
    const readXlsxFile = (await import("read-excel-file/node")).default;
    const sheets = await readXlsxFile(Buffer.from(bytes));
    return { ok: true, parsed: parseScopeSheets(sheets) };
  } catch (err) {
    return { ok: false, reason: "unreadable", message: err?.message || null };
  }
}

/** Merge several parsed workbooks into one, keeping each sheet's name. */
export function mergeParsed(list) {
  const sheets = [];
  let rowCount = 0;
  let truncated = false;
  for (const p of list) {
    if (!p) continue;
    sheets.push(...(p.sheets || []));
    rowCount += p.rowCount || 0;
    truncated = truncated || Boolean(p.truncated);
  }
  return { sheets, rowCount, truncated };
}
