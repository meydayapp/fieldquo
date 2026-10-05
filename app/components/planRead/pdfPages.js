"use client";

// app/components/planRead/pdfPages.js
//
// Render each sheet of a drawing PDF to a JPEG in the BROWSER, and upload
// each through the shared uploader (lib/media/uploadClient.js uploadFile —
// signed, straight to Cloudinary, verified). The page images are what the
// deep read looks at and what the measure tool draws on.
//
// Why here and not on the server: the stored PDF is a raw Cloudinary file
// (lib/media/validate.js explains why PDFs are never uploaded as images), and
// rasterising on the server needs a native canvas in the function bundle. The
// browser already has a canvas, and pdf.js (unpdf's build, loaded only on
// this screen) draws vector sheets crisply at any size.
//
// 3,000 px wide: a 36 × 24 in sheet at ~83 px per inch — legible once the
// read cuts it into quarters (lib/planRead/images.js) — and ~1 MB as a JPEG.

import { uploadFile } from "@/lib/media/uploadClient";

export const PAGE_WIDTH_PX = 3000;
export const MAX_PAGES = 150;

/**
 * @param {File} file          the drawing PDF the person picked
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<{ pages: object[], pageCount: number }>}
 */
/**
 * One page of an open PDF → a JPEG blob at `width` px, and its sizes. The
 * one renderer: the drawing read's sheets and the AI employee's scanned
 * manual pages (renderPagesAsJpeg below) both come through here.
 */
export async function renderPageToJpeg(pdf, pageNumber, { width = PAGE_WIDTH_PX, quality = 0.85 } = {}) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(width / base.width, 6);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  // White paper: a transparent PDF background would arrive black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  const out = { blob, width: canvas.width, height: canvas.height, pointsWidth: base.width, pointsHeight: base.height };
  // Release the bitmap before the next page: forty 3,000 px canvases held
  // at once is how a phone tab dies.
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup?.();
  if (!blob) throw new Error("render_failed");
  return out;
}

export async function renderAndUploadPages(file, { onProgress, width = PAGE_WIDTH_PX } = {}) {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const total = Math.min(pdf.numPages, MAX_PAGES);
  const pages = [];
  for (let i = 1; i <= total; i++) {
    const r = await renderPageToJpeg(pdf, i, { width });
    // shrink: false — this sheet is sized for the deep read on purpose (see
    // the header), and lib/media/shrinkImage.js would otherwise cap it.
    const uploaded = await uploadFile(new File([r.blob], `sheet-${i}.jpg`, { type: "image/jpeg" }), { purpose: "plans", shrink: false });
    pages.push({
      page: i,
      url: uploaded.url,
      publicId: uploaded.publicId,
      width: r.width,
      height: r.height,
      pointsWidth: r.pointsWidth,
      pointsHeight: r.pointsHeight,
    });
    onProgress?.(i, total);
  }
  await pdf.destroy?.();
  return { pages, pageCount: pdf.numPages };
}

/**
 * Chosen pages of a PDF → base64 JPEGs, for the AI employee's "Read scanned
 * pages with AI" (app/components/aiEmployee/ReferenceLibrary.js). NOT
 * uploaded anywhere: a manufacturer's manual page is posted once, inline, to
 * our own route, and never given a URL. `onPage(page, base64)` is called per
 * page so the caller can send in batches without holding every page.
 */
export async function renderPagesAsJpeg(file, pageNumbers, { width = 1600, quality = 0.8, onPage } = {}) {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  try {
    for (const n of pageNumbers) {
      if (!Number.isInteger(n) || n < 1 || n > pdf.numPages) continue;
      const r = await renderPageToJpeg(pdf, n, { width, quality });
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      await onPage?.(n, btoa(binary));
    }
  } finally {
    await pdf.destroy?.();
  }
}

/** SHA-256 of a File, hex — the browser's half of "is this the same PDF?". */
export async function fileSha256(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
