// app/api/receipts/[id]/read/route.js
//
// Read a captured receipt — its photos, or its PDF — into lines, totals, tax,
// store, date and time. Writes the READING onto the Receipt; books nothing.
//
// ══ The guards, in order ═══════════════════════════════════════════════════
//
//   1. The files are checked (lib/receipts/media.js) before anything is spent.
//   2. A demo company never reaches the vendor (lib/receipts/demoReceipt.js),
//      the substitution the job-materials scanner already uses.
//   3. meterFor("receipt_scan") — the /platform per-feature switch decides
//      who pays (lib/ai/featurePayer.js): FieldQuo's own AI budget and ledger,
//      or the company's monthly allowance. Checked BEFORE the call; the usage
//      is recorded AFTER, on every outcome, because the vendor bills on every
//      outcome.
//   4. A PDF is fetched from OUR Cloudinary only (lib/receipts/pdf.js) — the
//      server downloading a browser-chosen URL is otherwise an SSRF door.
//
// Re-reading is allowed until the receipt is booked or voided — "Read again"
// after a blurry photo is re-shot — and spends again, which the button says.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";
// A multi-page PDF read at high detail can take the better part of a minute.
export const maxDuration = 90;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { mayTouchReceipt, receiptScope } from "@/lib/receipts/access";
import { receiptFilesOrRefusal } from "@/lib/receipts/media";
import { fetchReceiptPdf } from "@/lib/receipts/pdf";
import { extractReceipt } from "@/lib/receipts/extract";
import { simulatedReceiptScan } from "@/lib/receipts/demoReceipt";
import { receiptFieldsFromExtraction } from "@/lib/receipts/fields";
import { receiptDetail, companyTimezone, duplicatesFor } from "@/lib/receipts/view";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { meterFor } from "@/lib/ai/featurePayer";

/** The name this read is metered under — the same feature as the job
 *  materials scanner, so /platform sees one receipt-reading cost. */
const AI_FEATURE = "receipt_scan";

const READABLE_FROM = new Set(["reading", "unreadable", "needs_review"]);

/** What a person is told for each way a read can fail. No jargon. */
const FAILED_SENTENCE = {
  not_ours: "That file isn't one of your uploads. Upload it again.",
  fetch_failed: "Couldn't open that PDF just now. Try again in a moment.",
  too_large: "That PDF is too large to read. Upload the receipt pages only.",
  not_pdf: "That file isn't a readable PDF. Take a photo of the receipt instead.",
  too_many_pages: "That PDF has too many pages to be one receipt. Upload the receipt pages only.",
};

const EXPENSE_SELECT = {
  id: true,
  projectId: true,
  isOverhead: true,
  category: true,
  amount: true,
  taxAmount: true,
  taxBreakdown: true,
  receiptLines: true,
};

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const receipt = await db.receipt.findFirst({
    where: { id, companyId: member.companyId, ...receiptScope(full, member.userId) },
  });
  if (!receipt || !mayTouchReceipt(full, member.userId, receipt)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!READABLE_FROM.has(receipt.status)) {
    return NextResponse.json({ error: "This receipt is already settled." }, { status: 409 });
  }

  // ── 1. Files, before anything is spent ──────────────────────────────────
  const files = receiptFilesOrRefusal(receipt.files);
  if (!files.ok) {
    await db.receipt.update({ where: { id }, data: { status: "unreadable", readError: files.code } });
    return NextResponse.json({ error: files.error, code: files.code }, { status: 400 });
  }

  // ── 2. A demo never reaches the vendor ──────────────────────────────────
  const demo = await isDemoCompany(member.companyId);

  let extraction;
  if (demo) {
    extraction = await simulatedReceiptScan({ member, imageUrl: files.photos[0] || files.pdf?.url || null });
  } else {
    // ── 3. Who pays, and may they — BEFORE the call ──────────────────────
    const meter = await meterFor(AI_FEATURE, { companyId: member.companyId, userId: member.userId || null });
    const gate = await meter.check();
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: 429 });
    }

    // ── 4. A PDF's bytes, from our own storage only ──────────────────────
    let pdf = null;
    if (files.pdf) {
      const fetched = await fetchReceiptPdf(files.pdf);
      if (!fetched.ok) {
        await db.receipt.update({ where: { id }, data: { status: "unreadable", readError: fetched.reason } });
        return NextResponse.json(
          { error: FAILED_SENTENCE[fetched.reason] || FAILED_SENTENCE.fetch_failed, code: fetched.reason },
          { status: 400 },
        );
      }
      pdf = { filename: fetched.filename, base64: fetched.base64 };
    }

    let usage = null;
    extraction = await extractReceipt({
      imageUrls: files.photos,
      pdf,
      onUsage: (u) => {
        usage = u;
      },
    });

    // Recorded whatever the outcome — see the header.
    if (usage) {
      await meter.record(usage);
    }
  }

  if (!extraction.ok) {
    await db.receipt.update({ where: { id }, data: { status: "unreadable", readError: extraction.reason || "failed" } });
    return NextResponse.json(
      {
        error: "Couldn't read that receipt. Try a straighter, brighter photo with the whole receipt in frame.",
        reason: extraction.reason,
      },
      { status: 502 },
    );
  }

  const timezone = await companyTimezone(member.companyId);
  const fields = receiptFieldsFromExtraction(extraction.data, timezone);
  const duplicates = await duplicatesFor({ ...receipt, ...fields });

  const updated = await db.receipt.update({
    where: { id },
    data: {
      ...fields,
      status: "needs_review",
      readError: null,
      duplicateOfId: duplicates[0]?.id || null,
    },
    include: { expenses: { select: EXPENSE_SELECT } },
  });

  const detail = await receiptDetail({ receipt: updated, full, userId: member.userId });
  return NextResponse.json({ ...detail, simulated: Boolean(extraction.simulated) });
}
