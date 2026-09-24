// app/api/invoices/[id]/review/route.js
//
// POST — run a review of this invoice. GET — return the last one, free.
//
// app/api/quotes/[id]/review/route.js's twin, split the same way and for the
// same reason: reopening an invoice must never silently spend tokens, so the
// stored review is served until someone presses the button again. Same
// quota gate before the call (checkAiQuota) and the same meter after it
// (recordAiUsage) — the invoice review is an AI review run and is counted
// under the one feature key the quote's is (lib/analytics/product/events.js
// ai_review_run), because the question the count answers is "how often is
// the review used", not "on which document".
//
// No redaction here, on purpose: the invoice review carries no cost figure
// (lib/ai/invoiceReview.js) — the margin lives in the Cost & margin drawer
// beside it, behind its own gate — so there is nothing a reader without job
// costing must not see.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordFeatureUse } from "@/lib/analytics/product/server";
import { reviewInvoice } from "@/lib/ai/invoiceReview";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { AI_MODEL } from "@/lib/ai/provider";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(member, "invoices", "view_only", "see invoices");
  if (denied) return denied;

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    select: { aiReview: true, aiReviewedAt: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ review: invoice.aiReview || null, reviewedAt: invoice.aiReviewedAt });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Asked of the grid BEFORE the quota check, so a refusal costs nothing.
  const { response: denied } = await levelOrRefusal(member, "invoices", "view_create_edit", "edit invoices");
  if (denied) return denied;

  // Checked before spending. Over the cap, the whole review is refused —
  // handing back the free half would read as the feature quietly breaking
  // rather than as a limit. The message says which it is.
  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }

  try {
    const review = await reviewInvoice({
      companyId: member.companyId,
      invoiceId: id,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "invoice_review",
          userId: member.userId,
          ...u,
        }),
    });
    if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Stored so the panel survives a reload without a second call.
    const saved = await db.invoice.update({
      where: { id },
      data: { aiReview: review, aiReviewedAt: new Date() },
      select: { aiReviewedAt: true },
    });

    // After the review is stored, so a run the model refused is not counted.
    await recordFeatureUse("ai_review_run", { companyId: member.companyId, memberId: member.id });

    return NextResponse.json({
      review,
      reviewedAt: saved.aiReviewedAt,
      usage: quota.cap ? { used: quota.usage.tokens, cap: quota.cap, nearLimit: quota.nearLimit } : null,
    });
  } catch (err) {
    console.error("[invoices/review]", err);
    const status = err?.status || err?.response?.status;
    const code = err?.code || err?.error?.code;
    const message =
      status === 401
        ? "The OpenAI key was rejected. Check OPENAI_API_KEY in your Vercel settings."
        : code === "insufficient_quota"
          ? "The OpenAI account has no credit. Add funds at platform.openai.com to use AI features."
          : status === 429
            ? "FieldQuo AI is being rate-limited. Wait a few seconds and try again."
            : code === "model_not_found"
              ? `The model "${AI_MODEL}" isn't available on this OpenAI account.`
              : "Couldn't review this invoice. The details are in the server log.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
