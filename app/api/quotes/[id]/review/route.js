// app/api/quotes/[id]/review/route.js
//
// POST — run a review of this quote. GET — return the last one, free.
//
// Split that way on purpose. Reopening a quote shouldn't silently spend
// tokens, so the stored review is served until someone explicitly presses the
// button again. The expensive path is the one with a click behind it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requirePermission } from "@/lib/permissions";
import { reviewQuote } from "@/lib/ai/quoteReview";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { AI_MODEL } from "@/lib/ai/provider";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The stored review talks about this quote's pricing and its gaps.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { aiReview: true, aiReviewedAt: true },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    review: quote.aiReview || null,
    reviewedAt: quote.aiReviewedAt,
  });
}

export async function POST(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "quote:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // The coarse role alone let anybody with a session spend the company's AI
  // quota reviewing a quote they may not be allowed to open. Asked of the grid
  // BEFORE the quota check, so a refusal costs nothing.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "edit quotes",
  );
  if (denied) return denied;

  // Checked before spending, same as the copilot. Note this route is only
  // PARTLY metered work — the completeness and pricing checks cost nothing —
  // so a company over its cap could in principle still get those. It doesn't
  // get them: being over the cap is a signal to stop, and handing back a
  // half-review would read as the feature quietly breaking rather than as a
  // limit. The message says which it is.
  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  try {
    const review = await reviewQuote({
      companyId: member.companyId,
      quoteId: _params.id,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "quote_review",
          userId: member.userId,
          ...u,
        }),
    });

    if (!review)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Stored so the panel survives a page reload without a second call.
    const saved = await db.quote.update({
      where: { id: _params.id },
      data: { aiReview: review, aiReviewedAt: new Date() },
      select: { aiReviewedAt: true },
    });

    return NextResponse.json({
      review,
      reviewedAt: saved.aiReviewedAt,
      usage: quota.cap
        ? { used: quota.usage.tokens, cap: quota.cap, nearLimit: quota.nearLimit }
        : null,
    });
  } catch (err) {
    console.error("[quotes/review]", err);

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
              : "Couldn't review this quote. The details are in the server log.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
