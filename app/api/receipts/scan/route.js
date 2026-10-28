// app/api/receipts/scan/route.js
//
// Read a photographed receipt into fields. Writes nothing.
//
// ══ What this route does and does not do ═══════════════════════════════════
//
// It reads a photo and answers with what the paper says. It does NOT write to
// JobMaterial, does not create an Expense, and does not touch the price book.
// The person confirms, and the existing PATCH /api/jobs/[id]/materials does the
// write — which is the same "here is what we read, confirm it" shape
// app/app/settings/expense-tracking/import/ already uses for a CSV, and for the
// same reason: a model's reading of a photograph is a suggestion, and a job's
// cost is a fact.
//
// ══ The three guards, in order ═════════════════════════════════════════════
//
//   1. A PDF is refused BEFORE anything is spent. lib/ai/provider.js emits
//      `image_url` and cannot read a PDF, and /api/upload stores one as a
//      Cloudinary `raw` asset that has no page-render URL. Accepting it and
//      failing silently is the dead-control failure AGENTS.md opens with, so
//      the refusal names the format and says to photograph it instead.
//      See lib/receipts/media.js.
//
//   2. A demo company never reaches the vendor. lib/demo/simulatedSpend.js's
//      isDemoCompany() re-reads the row, and the substitution — not a refusal
//      — is the shape lib/email/demoMail.js and lib/sms/demoSms.js established.
//
//   3. meterFor("receipt_scan").check() BEFORE the call, .record() after, from
//      provider.js's own token counts. WHICH ledger is the /platform switch's
//      decision (lib/ai/featurePayer.js): FieldQuo's AI budget, or the
//      company's allowance (checkAiQuota / recordAiUsage). A receipt is fine
//      text so it runs at imageDetail "high", which is the most expensive
//      single call in the product; a scan that skipped the meter would be
//      invisible on /platform and uncapped against FieldQuo's card.
//
// ══ Why job costing is required ════════════════════════════════════════════
//
// Every field this returns is money. app/api/jobs/[id]/materials/route.js
// already strips estUnitCost and actualCost from anyone without the jobCosting
// toggle and refuses a posted cost outright rather than dropping it; a receipt
// scanner that handed the same figures to the same member through a different
// door would be the side entrance to a gate somebody deliberately closed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { requireCost } from "@/app/api/invoices/costingWrite";
import { meterFor } from "@/lib/ai/featurePayer";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { receiptFilesOrRefusal } from "@/lib/receipts/media";
import { fetchReceiptPdf, MAX_PDF_BYTES, PDF_FAILURE_SENTENCE } from "@/lib/receipts/pdf";
import { fetchTenantFile } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";
import { extractReceipt } from "@/lib/receipts/extract";
import { simulatedReceiptScan } from "@/lib/receipts/demoReceipt";
import { reconcileReceipt, suggestedCostCents } from "@/lib/receipts/reconcile";
import { prefillMaterial, suggestedQuantity } from "@/lib/receipts/prefill";
import { centsToAmount } from "@/lib/receipts/money";

/** The name this call is metered under — and the switch it is paid by.
 *  `_photos` is appended by whichever ledger records it. */
const AI_FEATURE = "receipt_scan";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "scan a receipt against a job");
    requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));

  // ── 1. Is this a file we can actually read? ─────────────────────────────
  //
  // The same function the receipts book asks, given this screen's one file.
  // It answers photos OR one PDF — this scanner used to refuse every PDF, and
  // a supplier's emailed order is a PDF far more often than it is a photo.
  const files = receiptFilesOrRefusal(body.file ? [body.file] : []);
  if (!files.ok) {
    return NextResponse.json({ error: files.error, code: files.code }, { status: 400 });
  }

  // The material this is being read against, if any. Loaded first so the
  // prefill decision is made against the STORED row rather than against
  // whatever the browser claims is already there.
  let material = null;
  const materialId = typeof body.materialId === "string" ? body.materialId.trim() : "";
  if (materialId) {
    material = await db.jobMaterial.findFirst({
      where: {
        id: materialId,
        job: { companyId: member.companyId, ...assignedJobWhere(full) },
      },
      select: { id: true, jobId: true, actualCost: true, supplier: true, purchasedAt: true, actualQty: true },
    });
    if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── 2. A demo never reaches the vendor ──────────────────────────────────
  const demo = await isDemoCompany(member.companyId);

  let extraction;
  if (demo) {
    extraction = await simulatedReceiptScan({
      member,
      imageUrl: files.photos[0] || files.pdf?.url || null,
    });
  } else {
    // ── 3. Who pays, and may they — BEFORE the call ──────────────────────
    //
    // The /platform per-feature switch (lib/ai/featurePayer.js): FieldQuo's
    // own AI budget and ledger, or the company's monthly allowance
    // (checkAiQuota / recordAiUsage, which is what this route did before the
    // switch existed and still does when it says "company").
    const meter = await meterFor(AI_FEATURE, { companyId: member.companyId, userId: member.userId || null });
    const gate = await meter.check();
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: 429 });
    }

    // ── 3b. A PDF's bytes, from our own storage only ────────────────────
    //
    // A photo is read by URL — the vendor fetches it. A PDF cannot be: it
    // goes inline as base64, so THIS server downloads it, through a signed
    // link pinned to our own cloud and this company's folders. Same two
    // calls the receipts book makes, same bounds (MAX_PDF_BYTES, and the
    // page count that keeps a supplier's statement from arriving as "one
    // receipt"). Done AFTER the quota check, like the vendor call it feeds.
    let pdf = null;
    if (files.pdf) {
      const sign = cloudinarySigner();
      const fetched = await fetchReceiptPdf(
        files.pdf,
        sign
          ? { fetchFile: (u) => fetchTenantFile(u, { companyId: member.companyId, sign, maxBytes: MAX_PDF_BYTES }) }
          : {},
      );
      if (!fetched.ok) {
        return NextResponse.json(
          { error: PDF_FAILURE_SENTENCE[fetched.reason] || PDF_FAILURE_SENTENCE.fetch_failed, code: fetched.reason },
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

    // Recorded whatever the outcome, because the vendor billed us whatever the
    // outcome — provider.js meters before it decides anything about the
    // content, and this mirrors it. A company whose photos keep coming back
    // unreadable must not show zero AI usage.
    if (usage) {
      await meter.record(usage);
    }
  }

  if (!extraction.ok) {
    // provider.js has already logged WHICH failure this was. The person at a
    // till gets one sentence and no jargon; nothing was written either way.
    return NextResponse.json(
      {
        error:
          "Couldn't read that receipt. Try a straighter, brighter photo with the whole receipt in frame.",
        reason: extraction.reason,
      },
      { status: 502 },
    );
  }

  // ── The arithmetic, in code, once ───────────────────────────────────────
  const reconciled = reconcileReceipt(extraction.data);
  const costCents = suggestedCostCents(reconciled);

  // ── The prefill, which never replaces ───────────────────────────────────
  const suggested = {
    actualCost: centsToAmount(costCents),
    supplier: extraction.data.merchantName,
    purchasedAt: extraction.data.transactionDateIso,
    // Only from a one-line receipt — see suggestedQuantity. Null otherwise.
    actualQty: suggestedQuantity(extraction.data),
  };
  const prefill = material
    ? prefillMaterial(
        {
          actualCost: material.actualCost === null ? null : Number(material.actualCost),
          supplier: material.supplier,
          purchasedAt: material.purchasedAt,
          actualQty: material.actualQty === null ? null : Number(material.actualQty),
        },
        suggested,
      )
    : prefillMaterial({}, suggested);

  return NextResponse.json({
    receipt: extraction.data,
    reconciliation: reconciled,
    prefill,
    simulated: Boolean(extraction.simulated),
  });
}
