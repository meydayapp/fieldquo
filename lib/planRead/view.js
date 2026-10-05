// lib/planRead/view.js
//
// What GET /api/plan-reads/[id] answers: the files, the reading's progress,
// the project overview with every quantity computed NOW (never stored, so it
// cannot go stale against the model), the draft priced NOW from the
// company's current rates, the company's own similar jobs, the chat, and
// what the next read or message will cost.
//
// Money is left out entirely for a member whose access hides pricing — the
// same showPricing axis the quote page redacts on. The overview and the
// quantities stay: knowing there are 4,200 sq ft of walls is not a price.

import { revisionChains, formatBytes } from "@/lib/jobs/documents";
import { estimateChargeCents } from "@/lib/ai/walletMeter";
import { buildDimIndex, computeProject } from "./projectModel";
import { priceProject, paintedSqft } from "./pricing";
import { readInputs, readEstimate, hasWorkToRead, loadPaintBooks } from "./run";
import { feetPerPixelFromScale } from "./dimensions";
import { timingSummary } from "./timing";
import { sheetPassDone } from "./sheetState";

function docStatus(doc, read) {
  const mime = String(doc.mimeType || "");
  if (mime === "application/pdf") {
    const sheets = (read.sheets || []).filter((s) => s.docId === doc.id);
    return { type: "drawing", sheets: sheets.length, sheetsRead: sheets.filter(sheetPassDone).length, pagesRendered: Array.isArray(doc.pages) ? doc.pages.length : 0 };
  }
  if (mime.includes("spreadsheet") || mime === "text/csv") {
    const parsed = read.excelRows?.byDoc?.[doc.id];
    return { type: "spreadsheet", rows: parsed?.rowCount || 0, unreadable: Boolean(read.excelRows?.failed?.[doc.id]) };
  }
  if (mime.startsWith("image/")) return { type: "photo", read: Boolean(read.photoRead?.photos?.some((p) => p.docId === doc.id)) };
  return { type: "other" };
}

/**
 * What reusing an earlier read's sheet passes would save, in the same credits
 * the read's own estimate is stated in. Pure.
 */
export function reuseSavings(read, offer) {
  if (!offer?.sheets?.length || !hasWorkToRead(read)) return null;
  const keys = new Set(offer.sheets.map((s) => s.key));
  const now = readEstimate(read);
  // As if those sheets were already read — what the estimate would then say.
  const after = readEstimate({ ...read, sheets: (read.sheets || []).map((s) => (keys.has(s.key) ? { ...s, read: s.read || { reused: true } } : s)) });
  return { savesCents: Math.max(0, now.cents - after.cents), afterCents: after.cents };
}

/**
 * @param read      the PlanRead with documents and messages
 * @param opts      { canSeeMoney, balanceCents, sheetKey } — sheetKey asks for
 *                  one sheet's dimensions and scale (the measure tool);
 *                  authors (userId → name) for the history; reuseOffer, the
 *                  best of lib/planRead/sheetCache.js's offers, if any
 */
export async function planReadView(read, { companyId, canSeeMoney, balanceCents = null, sheetKey = null, prisma, authors = {}, reuseOffer = null } = {}) {
  const { books, own } = await loadPaintBooks(companyId, prisma ? { prisma } : {});
  const inputs = readInputs(read);
  const dims = buildDimIndex(inputs.sheets);
  const computed = read.model
    ? computeProject(read.model, { dims, book: books.interior_painting, excel: inputs.excel, photoRead: read.photoRead })
    : null;
  const priced = computed ? priceProject(computed, books) : null;
  const sqft = computed ? paintedSqft(computed) : 0;

  const chains = revisionChains(read.documents || []).map((c) => ({
    ...c,
    current: { ...c.current, size: formatBytes(c.current.sizeBytes), status: docStatus(c.current, read) },
  }));

  const sheets = inputs.sheets.map((s) => {
    const doc = inputs.docs.find((d) => d.id === s.docId);
    const image = (Array.isArray(doc?.pages) ? doc.pages : []).find((p) => p.page === s.docPage) || null;
    return {
      key: s.key,
      name: s.sheetNumber || `Page ${s.page}`,
      title: s.title,
      vector: s.vector,
      scale: s.scale,
      dims: (s.dims || []).length + (s.scanDims || []).length,
      read: s.read ? { relevant: s.read.relevant, summary: s.read.summary, failed: Boolean(s.read.failed) } : null,
      image,
      // Feet per pixel from the title-block scale, when the page and the image
      // say how big they are. The measure tool starts from it and lets the
      // estimator calibrate over it.
      feetPerPixel:
        image && s.scale?.ratio ? feetPerPixelFromScale({ ratio: s.scale.ratio, pointsWidth: s.pointsWidth, pixelWidth: image.width }) : null,
      ...(sheetKey === s.key ? { dimList: [...(s.dims || []), ...(s.scanDims || [])] } : {}),
    };
  });

  const estimate = hasWorkToRead(read) ? readEstimate(read) : null;
  const timing = timingSummary(read.usage?.timing);
  const savings = read.status === "reading" ? null : reuseSavings(read, reuseOffer);
  const money = (v) => (canSeeMoney ? v : undefined);
  return {
    id: read.id,
    title: read.title,
    clientRequest: read.clientRequest || "",
    trade: read.trade,
    status: read.status,
    stage: read.stage,
    progress: read.progress || null,
    error: read.error || null,
    leadId: read.leadId,
    clientId: read.clientId,
    quoteId: read.quoteId,
    readAt: read.readAt,
    stale: read.status === "reading" && (!read.leaseUntil || new Date(read.leaseUntil).getTime() < Date.now()),
    documents: chains,
    sheets,
    excel: inputs.excel ? { rows: inputs.excel.rowCount, sheets: inputs.excel.sheets.map((x) => x.name) } : null,
    photoRead: read.photoRead
      ? { photos: read.photoRead.photos, failed: Boolean(read.photoRead.failed), references: (read.photoRead.references || []).length }
      : null,
    project: computed,
    draft: priced
      ? {
          lines: priced.lines.map((l) => ({ ...l, hours: l.hours, labour: money(l.labour), material: money(l.material), amount: money(l.amount) })),
          access: priced.access.map((a) => ({ ...a, price: money(a.price) })),
          subtotal: money(priced.subtotal),
          paintTotal: money(priced.paintTotal),
          unpricedAccess: priced.unpricedAccess,
          unpricedCount: priced.unpricedCount,
          skipped: priced.skipped,
          sqft,
          perSqft: canSeeMoney && sqft > 0 ? Math.round((priced.paintTotal / sqft) * 100) / 100 : undefined,
          ownRates: own,
        }
      : null,
    similar: canSeeMoney ? read.similar || null : read.similar ? { ...read.similar, matches: [], range: null, hidden: true } : null,
    // One history: the chat's turns and the estimator's own edits (role
    // "edit"), each with who and when (lib/planRead/history.js).
    messages: (read.messages || []).map((m) => ({ id: m.id, role: m.role, text: m.text, changes: m.changes || [], createdAt: m.createdAt, chargedCents: m.chargedCents ?? null, author: (m.userId && authors[m.userId]) || null })),
    // How long the last read took, end to end — the estimator's "took 3m 40s".
    // The stage-by-stage split is on /platform (AI usage → Drawing reads).
    timing: timing ? { totalMs: timing.totalMs, outcome: timing.outcome } : null,
    reuse:
      reuseOffer && savings
        ? { fromId: reuseOffer.fromId, title: reuseOffer.title, readAt: reuseOffer.readAt, sheets: reuseOffer.sheets.length, sameRequest: reuseOffer.sameRequest, savesCents: savings.savesCents }
        : null,
    usage: read.usage ? { promptTokens: read.usage.promptTokens || 0, cachedTokens: read.usage.cachedTokens || 0, completionTokens: read.usage.completionTokens || 0, calls: read.usage.calls || 0 } : null,
    credits: {
      readCents: estimate?.cents ?? null,
      readExpectedCents: estimate?.expectedCents ?? null,
      chatCents: estimateChargeCents("plan_read_chat"),
      balanceCents,
      chargedCents: read.chargedCents || 0,
      heldCents: read.reservedCents || 0,
    },
    canRead: hasWorkToRead(read),
    canSeeMoney,
  };
}
