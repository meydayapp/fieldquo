// lib/quotes/subQuoteUploadServer.js
//
// What the routes under app/api/quotes/[id]/sub-uploads share: who may do
// what, which files are acceptable, how a read is metered, and the sentence
// a person is told for each way it can fail.
//
// ══ The order of a read, and why nothing is charged for a bad file ═════════
//
//   1. The files are checked — shape (lib/receipts/media.js), OUR Cloudinary
//      only (lib/receipts/pdf.js isOurCloudinaryUrl), and for a PDF the bytes
//      themselves: magic number, size, page count (fetchReceiptPdf). A
//      malformed or hostile file stops HERE, before the meter is asked and
//      before a model sees a byte, with a plain sentence.
//   2. meterFor(feature).check() — the company's AI credit must cover the
//      estimate. A refusal records nothing and charges nothing.
//   3. The model call (lib/quotes/subQuoteRead.js).
//   4. meter.record(usage) — on every outcome that reached the vendor,
//      because the vendor bills on every outcome — the receipt reader's rule.
//
// The read never writes a cost. It writes `reading` / `readLines` — printed
// strings for the confirm form — and the status.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEnforceableMember, hasLevel, hasToggle } from "@/lib/permissions/enforce";
import { receiptFilesOrRefusal } from "@/lib/receipts/media";
import { fetchReceiptPdf, isOurCloudinaryUrl, MAX_PDF_BYTES } from "@/lib/receipts/pdf";
import { fetchTenantFile } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";
import { meterFor } from "@/lib/ai/featurePayer";
import { estimateChargeCents } from "@/lib/ai/walletMeter";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { MAX_SUB_QUOTE_PHOTOS } from "@/lib/quotes/subQuoteRead";
import { matchSubcontractor, uploadView } from "@/lib/quotes/subQuoteUpload";

/** The roster row an upload carries — the credentials the compare shows. */
export const SUB_SELECT = { id: true, name: true, active: true, insuranceExpiresAt: true, clearanceExpiresAt: true };

/** The GC's subcontractors, for "which of yours is this?". */
export function loadRoster(companyId) {
  return db.subcontractor.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, active: true },
  });
}

/** One upload as the panel receives it, with the roster match for an unconfirmed one. */
export function presentUpload(upload, { roster = [], mayCost = true } = {}) {
  const view = uploadView(upload, { sub: upload.subcontractor || null, mayCost });
  if (view.confirmed) return view;
  const match = matchSubcontractor(upload.reading?.subName, roster);
  return { ...view, suggestedSubcontractor: match ? { id: match.id, name: match.name } : null };
}

/** The two metered features (lib/ai/featurePayer.js). */
export const READ_FEATURE = "sub_quote_read";
export const LINES_FEATURE = "sub_quote_lines";

/** Plain sentences, by reason. Never a vendor's or an engine's own words. */
export const UPLOAD_FAILED_SENTENCE = Object.freeze({
  missing: "No file was attached.",
  notHttp: "That file isn't somewhere we can read it from. Upload it again.",
  video: "That's a video. Upload a PDF or a photo of the quote.",
  unknownKind: "Only a PDF or photos of a quote can be read.",
  mixed: "A PDF is read on its own. Upload each PDF separately.",
  tooMany: `Up to ${MAX_SUB_QUOTE_PHOTOS} photos of one quote. Upload a PDF for anything longer.`,
  not_ours: "That file isn't one of your uploads. Upload it again.",
  fetch_failed: "Couldn't open that PDF just now. Try again in a moment.",
  too_large: "That PDF is too large to read. Upload the quote pages only.",
  not_pdf: "That file isn't a readable PDF. Upload a photo of the quote instead.",
  too_many_pages: "That PDF has too many pages to be one quote. Upload the quote pages only.",
  no_credit: "Not read — your AI credit doesn't cover it. Nothing was charged. Enter the figures yourself, or top up AI credit and upload it again.",
  quota: "Not read — your AI allowance for this month is used up. Nothing was charged. Enter the figures yourself.",
  demo: "Reading is off in the demo. Enter the figures yourself.",
  unconfigured: "Reading isn't available right now. Enter the figures yourself.",
  failed: "Couldn't read that quote. Enter the figures yourself, or upload a straighter, brighter photo.",
});

/**
 * The signed-in member and their grid, or the response to send.
 *
 *   read   see the compare (quotes: view_only + showPricing) — what
 *          GET /api/quotes/[id]/imports asks for its importer half.
 *   write  upload, read, confirm, place, remove — quotes: view_create_edit +
 *          showPricing + jobCosting: the confirmed figure IS the cost and the
 *          markup IS the margin, the same pair the import markup route asks.
 */
//
// The route resolves the member itself (memberOrRefusal, in the route file —
// where check:public-payload and a reader look for it) and hands it here.
export async function uploadGate(member, { write = false } = {}) {
  if (!member) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (write && !member.userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const full = await loadEnforceableMember(db, member.id);
  const canSee = hasLevel(full, "quotes", "view_only") && hasToggle(full, "showPricing");
  const canEdit =
    hasLevel(full, "quotes", "view_create_edit") && hasToggle(full, "showPricing") && hasToggle(full, "jobCosting");
  if (write ? !canEdit : !canSee) {
    return {
      response: NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 }),
    };
  }
  return { full, canEdit, mayCost: hasToggle(full, "jobCosting") };
}

/** The GC's own quote, or null. */
export function ownQuote(member, quoteId) {
  return db.quote.findFirst({
    where: { id: quoteId, companyId: member.companyId },
    select: { id: true, status: true },
  });
}

/**
 * The uploaded files, checked for shape and origin. Pure apart from the env
 * read inside isOurCloudinaryUrl.
 *
 * @returns {{ ok: true, files, photos, pdf }} or {{ ok: false, code }}
 */
export function uploadFilesOrRefusal(files) {
  const shape = receiptFilesOrRefusal(files);
  if (!shape.ok) return { ok: false, code: shape.code };
  if (shape.photos.length > MAX_SUB_QUOTE_PHOTOS) return { ok: false, code: "tooMany" };
  const urls = [...shape.photos, ...(shape.pdf ? [shape.pdf.url] : [])];
  if (!urls.every((u) => isOurCloudinaryUrl(u))) return { ok: false, code: "not_ours" };
  const kept = (Array.isArray(files) ? files : []).filter(Boolean).map((f) => ({
    url: String(f.url || "").trim(),
    kind: typeof f.kind === "string" ? f.kind.slice(0, 20) : null,
    filename: typeof f.filename === "string" ? f.filename.slice(0, 200) : null,
    mimeType: typeof f.mimeType === "string" ? f.mimeType.slice(0, 100) : null,
  }));
  return { ok: true, files: kept, photos: shape.photos, pdf: shape.pdf };
}

/**
 * The meter for each read, named by its feature at the call — the form
 * check:receipt-books looks for when it proves a "wired" feature really is
 * routed through meterFor (lib/ai/featurePayer.js).
 */
function meterForRead(feature, opts) {
  if (feature === LINES_FEATURE) return meterFor("sub_quote_lines", opts);
  if (feature === READ_FEATURE) return meterFor("sub_quote_read", opts);
  throw new Error(`No meter for ${feature}`);
}

/**
 * Run one metered read over an upload's files.
 *
 * @param read     (inputs: { imageUrls, pdf, onUsage }) => result — the model call
 * @returns {{ ok: true, data, charged }} or {{ ok: false, code, charged }}
 *          `charged` says whether usage was recorded (the vendor was reached).
 */
export async function meteredRead({ feature, member, upload, read, ref, deps = {} }) {
  // Seams for scripts/check-gc-onramp.mjs, which must prove the ORDER: a bad
  // file never reaches the meter. Production passes nothing.
  const { meter: meterFn = meterForRead, isDemo = isDemoCompany, fetchImpl = undefined } = deps;
  const checked = uploadFilesOrRefusal(upload.files);
  if (!checked.ok) return { ok: false, code: checked.code, charged: false };

  if (await isDemo(member.companyId)) return { ok: false, code: "demo", charged: false };

  // ── The PDF's bytes, before anything is spent ──────────────────────────
  let pdf = null;
  if (checked.pdf) {
    const sign = cloudinarySigner();
    const fetched = await fetchReceiptPdf(
      checked.pdf,
      sign
        ? { fetchFile: (u) => fetchTenantFile(u, { companyId: member.companyId, sign, maxBytes: MAX_PDF_BYTES }) }
        : fetchImpl
          ? { fetchImpl }
          : {},
    );
    if (!fetched.ok) return { ok: false, code: fetched.reason, charged: false };
    pdf = { filename: fetched.filename, base64: fetched.base64 };
  }

  const meter = await meterFn(feature, { companyId: member.companyId, userId: member.userId || null });
  const gate = await meter.check();
  if (!gate.allowed) return { ok: false, code: gate.code === "quota" ? "quota" : "no_credit", charged: false };

  let usage = null;
  const result = await read({
    imageUrls: checked.photos,
    pdf,
    onUsage: (u) => {
      usage = u;
    },
  });
  if (usage) await meter.record(usage, { ref, note: "Reading a sub's quote" });
  if (!result?.ok) {
    return { ok: false, code: result?.reason === "unconfigured" ? "unconfigured" : "failed", charged: Boolean(usage) };
  }
  return { ok: true, data: result.data, charged: Boolean(usage) };
}

/** What each read is estimated at, in AI credits (1 credit = 1¢ — lib/ai/imageEconomics.js). */
export function readEstimates() {
  return { readCredits: estimateChargeCents(READ_FEATURE), linesCredits: estimateChargeCents(LINES_FEATURE) };
}
