// app/api/designer/copy/route.js
//
// AI captions + hashtags for whatever job photos are on the Marketing
// Designer canvas — grounded in the real job behind them via
// lib/marketing/jobPhotoContext.js and lib/ai/marketingCopy.js. See that
// second file's header for the anti-embellishment argument; this route is
// just the metered, gated door onto it.
//
// ── Metered like every other text feature, not like image generation ──────
//
// This is a `complete()` call (text + up to 4 photos read for what's in
// them, same "low" detail cost ceiling every free vision read in this
// product uses) — not a gpt-image-1 generation. It's checked and recorded
// through lib/ai/usage.js's checkAiQuota()/recordAiUsage(), the company's
// normal monthly AI allowance, the same way app/api/quotes/[id]/review does.
// It does NOT go through lib/designer/aiImageAdapter.js's per-image spend
// wallet — that wallet exists specifically for gpt-image-1 generation/edit
// calls, a different cost class, and inventing a THIRD number nobody could
// later explain the reasoning for is exactly what that file's own header
// warns against doing.
//
// ── Gated under marketing_designer like its sibling AI routes ─────────────
//
// Listed in lib/features/registry.js's marketing_designer apiPrefixes
// (exact path, not a "/api/designer" wildcard — see that entry's own
// comment on why /api/designer/templates and /unsplash are deliberately
// NOT gated) so a hidden/locked state refuses this route before the handler
// ever runs, same as /api/designer/generate and /api/designer/remove-bg.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { generateMarketingCopy } from "@/lib/ai/marketingCopy";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // https only, length-capped, deduped — the same filter every route that
  // hands a URL list to complete() applies, because a data:/blob: URL would
  // either bloat the request body or fail at the vendor with a confusing
  // error about the prompt rather than about the URL.
  const photoUrls = Array.isArray(body?.photoUrls)
    ? [...new Set(
        body.photoUrls
          .filter((u) => typeof u === "string")
          .map((u) => u.trim().slice(0, 500))
          .filter((u) => /^https:\/\//.test(u)),
      )].slice(0, 12)
    : [];

  if (!photoUrls.length) {
    return NextResponse.json(
      { error: "Add at least one photo to the canvas first." },
      { status: 400 },
    );
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  try {
    const result = await generateMarketingCopy({
      companyId: member.companyId,
      photoUrls,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "marketing_designer_copy",
          userId: member.userId,
          ...u,
        }),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[designer/copy]", err);
    return NextResponse.json(
      { error: "Couldn't generate copy for these photos. The details are in the server log." },
      { status: 502 },
    );
  }
}
