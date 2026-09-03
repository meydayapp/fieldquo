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
//   3. checkAiQuota() BEFORE the call, recordAiUsage() after, from provider.js's
//      own token counts. A receipt is fine text so it runs at imageDetail
//      "high", which is the most expensive single call in the product; a scan
//      that skipped the meter would be invisible in /platform/ai-usage and
//      uncapped against FieldQuo's card.
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
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { receiptImageOrRefusal } from "@/lib/receipts/media";
import { extractReceipt } from "@/lib/receipts/extract";
import { simulatedReceiptScan } from "@/lib/receipts/demoReceipt";
import { reconcileReceipt, suggestedCostCents } from "@/lib/receipts/reconcile";
import { prefillMaterial } from "@/lib/receipts/prefill";
import { centsToAmount } from "@/lib/receipts/money";

/** The name this call is metered under. `_photos` is appended by usage.js. */
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
  const file = receiptImageOrRefusal(body.file);
  if (!file.ok) {
    return NextResponse.json({ error: file.error, code: file.code }, { status: 400 });
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
      select: { id: true, jobId: true, actualCost: true, supplier: true, purchasedAt: true },
    });
    if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── 2. A demo never reaches the vendor ──────────────────────────────────
  const demo = await isDemoCompany(member.companyId);

  let extraction;
  if (demo) {
    extraction = await simulatedReceiptScan({ member, imageUrl: file.url });
  } else {
    // ── 3. Quota BEFORE the call ─────────────────────────────────────────
    const quota = await checkAiQuota(member.companyId);
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason }, { status: 429 });
    }

    let usage = null;
    extraction = await extractReceipt({
      imageUrl: file.url,
      onUsage: (u) => {
        usage = u;
      },
    });

    // Recorded whatever the outcome, because the vendor billed us whatever the
    // outcome — provider.js meters before it decides anything about the
    // content, and this mirrors it. A company whose photos keep coming back
    // unreadable must not show zero AI usage.
    if (usage) {
      await recordAiUsage({
        companyId: member.companyId,
        feature: AI_FEATURE,
        model: usage.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        userId: member.userId || null,
        imageCount: usage.imageCount,
      });
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
  };
  const prefill = material
    ? prefillMaterial(
        {
          actualCost: material.actualCost === null ? null : Number(material.actualCost),
          supplier: material.supplier,
          purchasedAt: material.purchasedAt,
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
