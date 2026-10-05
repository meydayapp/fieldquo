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
// Pure, no imports — the private-file location parser and signed-link maker
// the HR file's open route uses, reused for the reference library's private
// PDFs rather than written twice.
import { hrFileLocation, signedOpenLink } from "@/lib/hr/documentFile";
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

/** The bounded GET both fetchers share: no redirect off the URL we chose
 *  unless the caller allows one, and the size ceiling on header and body. */
async function fetchBounded(url, { fetchImpl, maxBytes, redirect = "error", finalHostOk = null }) {
  let res;
  try {
    res = await fetchImpl(url, { redirect });
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
  if (!res?.ok) return { ok: false, reason: "fetch_failed" };
  if (finalHostOk && res.url && !finalHostOk(res.url)) return { ok: false, reason: "not_ours" };
  const declared = Number(res.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too_large" };
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true, buffer };
}

export async function fetchOwnFile(url, { fetchImpl = fetch, maxBytes = MAX_INGEST_BYTES, cloudName = process.env.CLOUDINARY_CLOUD_NAME } = {}) {
  if (!isOurCloudinaryUrl(url, cloudName)) return { ok: false, reason: "not_ours" };
  return fetchBounded(url, { fetchImpl, maxBytes });
}

/**
 * A PRIVATE file of ours ("authenticated" delivery — the AI employee's
 * reference library, lib/media/directUpload.js purpose "reference"): its
 * plain URL answers 401, so it is read through a five-minute signed download
 * link, the same link lib/hr/documentFile.js signs for an HR file.
 *
 * Only a file inside `fieldquo/companies/<companyId>/<folder>/` is signed —
 * the tenant fence for a URL that came from a row. The signed link is
 * Cloudinary's own API host for our cloud and nothing else; Cloudinary may
 * answer it with a redirect to its delivery host, so a redirect is followed
 * and the FINAL host checked against the two Cloudinary hosts.
 *
 * @param sign  cloudinary.utils.private_download_url (injected — no SDK here)
 */
export async function fetchOwnPrivateFile(url, { companyId, folder, cloudName = process.env.CLOUDINARY_CLOUD_NAME, sign, fetchImpl = fetch, maxBytes = MAX_INGEST_BYTES, now = Date.now() } = {}) {
  if (typeof sign !== "function") return { ok: false, reason: "unsigned" };
  const at = hrFileLocation(url, { cloudName, companyId });
  if (!at.ok) return { ok: false, reason: "not_ours" };
  if (folder && !at.publicId.startsWith(`fieldquo/companies/${companyId}/${folder}/`)) return { ok: false, reason: "not_ours" };
  let link;
  try {
    link = signedOpenLink(at, { sign, now }).url;
  } catch {
    return { ok: false, reason: "unsigned" };
  }
  const apiBase = `https://api.cloudinary.com/v1_1/${cloudName}/`;
  if (typeof link !== "string" || !link.startsWith(apiBase)) return { ok: false, reason: "not_ours" };
  return fetchBounded(link, {
    fetchImpl,
    maxBytes,
    redirect: "follow",
    finalHostOk: (u) => u.startsWith(apiBase) || isOurCloudinaryUrl(u, cloudName),
  });
}

/**
 * A drawing read's own uploaded file — a drawing PDF, a scope spreadsheet —
 * read back by the server.
 *
 * ══ Why the signed download first ═══════════════════════════════════════════
 *
 * The first live read in production (2026-10-04) never got past its upload:
 * Cloudinary answered the PDF's plain delivery URL with 401 "deny or ACL
 * failure". The account's security setting blocks delivery of PDF (and ZIP)
 * files, while the page JPEGs the browser rendered load fine. The download
 * endpoint (utils.private_download_url — the HR file's and the reference
 * library's path, fetchOwnPrivateFile above) is authenticated by our API
 * signature, so it is not subject to that delivery rule, and it works on
 * every plan without changing the account. The file is still only ever one
 * inside THIS company's `plans` folder (the tenant fence fetchOwnPrivateFile
 * checks before it signs anything).
 *
 * The plain URL is the fallback, for a deployment with no API secret (local
 * development) and for an account that does deliver PDFs — never the first
 * try, because on this account it can only fail.
 *
 * @param sign  cloudinary.utils.private_download_url, or null when the API
 *              key and secret are not configured
 */
export async function fetchPlanFile(url, { companyId, sign = null, cloudName = process.env.CLOUDINARY_CLOUD_NAME, fetchImpl = fetch, maxBytes = MAX_INGEST_BYTES, now = Date.now() } = {}) {
  let signed = null;
  if (typeof sign === "function" && companyId) {
    signed = await fetchOwnPrivateFile(url, { companyId, folder: "plans", cloudName, sign, fetchImpl, maxBytes, now });
    // A file over the ceiling is over it by any road.
    if (signed.ok || signed.reason === "too_large") return { ...signed, via: "signed" };
  }
  const plain = await fetchOwnFile(url, { fetchImpl, maxBytes, cloudName });
  if (plain.ok || !signed) return { ...plain, via: "public" };
  // Both failed: the signed attempt's reason is the informative one (the
  // public URL on this account can only say "denied").
  return { ...signed, via: "signed" };
}

/**
 * Open a PDF's bytes with unpdf. The one place a PDF is opened, for the
 * drawing read (pdfSheets) and the AI employee's reference library
 * (pdfPageTexts) alike.
 *
 * @returns {{ ok: true, pdf } | { ok: false, reason: "not_pdf"|"password"|"unreadable" }}
 *   "password" is named apart from "unreadable" because the fix is the
 *   contractor's and different: save it without the password.
 */
export async function openPdf(bytes) {
  const { getDocumentProxy } = await import("unpdf");
  const data = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(Buffer.from(bytes || []));
  if (Buffer.from(data.subarray(0, 5)).toString("latin1") !== "%PDF-") return { ok: false, reason: "not_pdf" };
  try {
    return { ok: true, pdf: await getDocumentProxy(data) };
  } catch (err) {
    return { ok: false, reason: err?.name === "PasswordException" ? "password" : "unreadable" };
  }
}

/** A page's text items in the shape both readers use — unpdf's
 *  StructuredTextItem: position from the transform, font size from its scale. */
async function pageTextItems(page) {
  const content = await page.getTextContent();
  return (content.items || [])
    .filter((it) => typeof it.str === "string")
    .map((it) => {
      const [a, b, , , e, f] = it.transform || [1, 0, 0, 1, 0, 0];
      return { str: it.str, hasEOL: it.hasEOL === true, x: e, y: f, width: it.width, height: it.height, fontSize: Math.hypot(a, b) };
    });
}

/**
 * Every page of a PDF → sheet facts. `firstIndex` numbers the sheets across
 * the whole read (a second PDF's first page is p41 when the first had 40),
 * so every dimension id is unique within a read.
 */
export async function pdfSheets(bytes, { firstIndex = 1 } = {}) {
  const opened = await openPdf(bytes);
  // The drawing read's vocabulary predates "password" and its screen knows
  // only "unreadable" — kept exactly as it was.
  if (!opened.ok) return { ok: false, reason: opened.reason === "password" ? "unreadable" : opened.reason };
  const { pdf } = opened;
  const count = Math.min(pdf.numPages, MAX_SHEETS_PER_PDF);
  const sheets = [];
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const items = (await pageTextItems(page)).map(({ hasEOL, ...it }) => it);
    const facts = sheetFacts(items, { page: firstIndex + i - 1, pageWidth: vp.width, pageHeight: vp.height });
    sheets.push({ ...facts, docPage: i, pointsWidth: vp.width, pointsHeight: vp.height });
    page.cleanup?.();
  }
  await pdf.destroy?.();
  return { ok: true, sheets, pageCount: pdf.numPages, truncated: pdf.numPages > count };
}

/**
 * Every page of a PDF → its plain text, in page order, for reading rather
 * than measuring (the AI employee's reference library). A page whose text
 * layer is empty comes back as "" — a scan — and the CALLER decides what
 * that means; nothing here invents text for it.
 *
 * @returns {{ ok: true, pages: [{ page, text }], pageCount, truncated }
 *         | { ok: false, reason }}
 */
export async function pdfPageTexts(bytes, { maxPages = MAX_SHEETS_PER_PDF, maxCharsPerPage = 8000 } = {}) {
  const opened = await openPdf(bytes);
  if (!opened.ok) return opened;
  const { pdf } = opened;
  const count = Math.min(pdf.numPages, Math.max(1, maxPages));
  const pages = [];
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const items = await pageTextItems(page);
    const text = items
      .map((it) => it.str + (it.hasEOL ? "\n" : ""))
      .join("")
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxCharsPerPage);
    pages.push({ page: i, text });
    page.cleanup?.();
  }
  await pdf.destroy?.();
  return { ok: true, pages, pageCount: pdf.numPages, truncated: pdf.numPages > count };
}

/** A spreadsheet's bytes → plain text, one line per row, each sheet named —
 *  for READING (the reference library's code lists), not the scope parser. */
export async function spreadsheetText(bytes, { maxRows = 5000 } = {}) {
  try {
    const readXlsxFile = (await import("read-excel-file/node")).default;
    const sheets = await readXlsxFile(Buffer.from(bytes));
    const lines = [];
    for (const s of Array.isArray(sheets) ? sheets : []) {
      lines.push(`# ${s.sheet || "Sheet"}`);
      for (const row of (s.data || []).slice(0, maxRows)) {
        const cells = (row || []).map((c) => (c === null || c === undefined ? "" : String(c).trim()));
        if (cells.some(Boolean)) lines.push(cells.join(" | "));
      }
      lines.push("");
    }
    return { ok: true, text: lines.join("\n").trim() };
  } catch (err) {
    return { ok: false, reason: "unreadable", message: err?.message || null };
  }
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
