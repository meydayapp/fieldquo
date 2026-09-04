// app/api/marketing/designer/job-post/route.js
//
// GET  — the jobs this company could make a post out of, with the photos that
//        would be used, so the picker shows the real thing rather than a job
//        name and a promise.
// POST — compose one. A MarketingDesign plus a saved layout per ratio, built
//        from the job's own photos and the company's own facts, with the
//        headline and caption written by the model.
//
// ══ The AI is the garnish, not the mechanism ══════════════════════════════
//
// Everything that makes this a post — which photo is the before, where the
// panels sit, the trade and the town on the footer, every colour — is decided
// by data before a model is consulted, in lib/marketing/jobPostSource.js and
// lib/marketing/jobPost.js. The model writes two strings.
//
// So this route deliberately does NOT refuse when AI is unavailable, over
// quota or broken. It composes the post with factualHeadline() instead and
// says so in the response (`ai.used: false` plus the reason), which is
// lib/site/generateSite.js's contract applied here: AI being down produces a
// plainer post, never a broken one, and never a blank screen with a reason on
// it. A quota refusal is NAMED and the post still lands — see the branch
// below for why it carries no top-up offer, which is a different answer from
// the image generator's and deliberately so.
//
// ══ Metering ══════════════════════════════════════════════════════════════
//
// checkAiQuota() before, recordAiUsage() after, on the company's monthly text
// allowance — the same meter app/api/designer/copy uses, because it is the
// same call (complete() with a handful of photos read at "low" detail). NOT
// the per-image `image_generation` wallet: nothing here generates an image.
// The photographs are the contractor's own.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { generateMarketingCopy } from "@/lib/ai/marketingCopy";
import { documentTheme } from "@/lib/documents/theme";
import { AD_RATIOS, ratio as ratioByKey, DEFAULT_RATIO } from "@/lib/marketing/ratios";
import { composeJobPost, tradeFooter, factualHeadline } from "@/lib/marketing/jobPost";
import { listPostableJobs, loadJobPostSource } from "@/lib/marketing/jobPostSource";
import { loadJobPhotoContext } from "@/lib/marketing/jobPhotoContext";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

function requireMarketingManager(role) {
  // The same axis every other write in this area uses — see
  // app/api/marketing/designer/designs/route.js.
  requirePermission(role, "user:manage");
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can see the marketing designer" },
      { status: err.status || 403 },
    );
  }

  const jobs = await listPostableJobs(member.companyId);
  return NextResponse.json({ jobs });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const jobId = typeof body?.jobId === "string" && body.jobId ? body.jobId : null;
  const photoUrls = Array.isArray(body?.photoUrls)
    ? body.photoUrls.filter((u) => typeof u === "string").slice(0, 2)
    : [];

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }
  if (!jobId && !photoUrls.length) {
    return NextResponse.json(
      { error: "Pick a job, or attach a photo." },
      { status: 400 },
    );
  }

  // Proves BOTH tainted ids belong to this company in one companyId-scoped
  // lookup, before either is written onto a row — lib/tenant/ownedIds.js's
  // convention, and the shape scripts/check-tenant-scope.mjs looks for.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    campaignId,
    ...(jobId ? { jobId } : {}),
  });
  if (notOurs) return notOurs;

  const source = await loadJobPostSource({ companyId: member.companyId, jobId, photoUrls });
  if (!source) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  if (!source.photos.length) {
    // Refused, not composed empty. A post with no photograph on it is the
    // thing this whole path exists to avoid producing.
    return NextResponse.json(
      {
        error: "no_photos",
        message: "That job has no photos we can publish yet. Tag a start or finish shot on it first.",
      },
      { status: 409 },
    );
  }

  // ── The facts, first ─────────────────────────────────────────────────────
  const footer = tradeFooter({
    trades: source.trades,
    city: source.company.city,
    province: source.company.province,
  });

  // The scope of work, loaded through the SAME bridge that decides what may
  // reach a model — so the privacy rule (no client name, address or phone; no
  // issue photo; no dollar amount) is enforced in one place for the fallback
  // headline as well as for the generated one. The fallback reads
  // context.scope; nothing here re-queries the quote itself.
  const context = await loadJobPhotoContext({
    companyId: member.companyId,
    photoUrls: source.photos.map((p) => p.url),
  });

  let headline = factualHeadline({ scope: context.scope, trades: source.trades });
  let caption = "";
  let hashtags = [];
  let ai = { used: false, reason: "not_attempted" };

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    // ── Named, and deliberately WITHOUT a top-up offer ────────────────────
    //
    // checkAiQuota() is the company's monthly TOKEN allowance
    // (lib/ai/usage.js), not the per-image credit wallet. Buying credit does
    // not raise it — its own refusal text says to get in touch — so an
    // AiCreditTopupDialog here would take a payment that changed nothing.
    // That is the same rule lib/designer/aiImageAdapter.js already states for
    // its non-money refusals, and the reason `check:paid-refusals` looks for
    // an offer only where money is actually the problem.
    //
    // The post is still composed either way. The refusal costs better words,
    // not the feature.
    ai = { used: false, reason: "quota_exceeded", message: quota.reason };
  } else {
    try {
      const copy = await generateMarketingCopy({
        companyId: member.companyId,
        photoUrls: source.photos.map((p) => p.url),
        onUsage: (u) =>
          recordAiUsage({
            companyId: member.companyId,
            feature: "marketing_designer_job_post",
            userId: member.userId,
            ...u,
          }),
      });
      // An empty headline is a model that returned nothing usable, not a
      // reason to publish an empty band — the factual one stands.
      if (copy.headline) headline = copy.headline;
      caption = copy.caption || "";
      hashtags = copy.hashtags || [];
      ai = { used: Boolean(copy.headline || copy.caption), reason: "ok", grounded: copy.grounded };
    } catch (err) {
      // Logged, not surfaced as a 502. The post is already composable from
      // data alone; failing the whole request over the garnish would be the
      // opposite of the fallback contract this route's header states.
      console.error("[marketing/designer/job-post] copy generation failed", err?.message);
      ai = { used: false, reason: "vendor_error" };
    }
  }

  const theme = documentTheme({ brandColor: source.company.brandColor });

  // The BEFORE/AFTER pills, in the company's own language, resolved per KEY
  // with an English fallback — the shape lib/email/signupRecoveryEmail.js's
  // textFor() already established server-side, and for its reason: the
  // review-pending catalogues are incomplete by design, so an
  // all-or-nothing language fallback would drop a translated word because
  // some unrelated key in the same catalogue is missing.
  //
  // Baked in at composition time rather than translated when the canvas
  // renders. A post keeps the language it was made in (AGENTS.md
  // non-negotiable #6) — and there is no `t()` on a fabric document anyway.
  const dict = APP_MESSAGES[String(source.company.defaultLanguage || "en").toLowerCase()] || {};
  const label = (key, fallback) => dict[key] ?? APP_MESSAGES.en[key] ?? fallback;

  const design = await db.marketingDesign.create({
    data: {
      companyId: member.companyId,
      campaignId,
      name: typeof body?.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : headline || source.company.name,
      sourceJobId: jobId,
      caption,
      hashtags,
    },
  });

  // Every ratio, composed independently rather than reflowed from the square.
  // reflow() is a STARTING point for a human to adjust (its own header says
  // so); composing each frame from the same facts puts the footer band at the
  // bottom of the Story as well as the bottom of the square, which a uniform
  // scale cannot do.
  await db.$transaction(
    AD_RATIOS.map((r) => {
      const doc = composeJobPost({
        frame: { width: r.width, height: r.height },
        photos: source.photos,
        headline,
        footer,
        theme,
        label,
      });
      return db.marketingDesignLayout.upsert({
        where: { designId_ratioKey: { designId: design.id, ratioKey: r.key } },
        create: { designId: design.id, ratioKey: r.key, json: doc, width: r.width, height: r.height },
        update: { json: doc, width: r.width, height: r.height },
      });
    }),
  );

  await recordActivity(member, {
    action: "marketing.job_post_composed",
    entityType: "settings",
    entityId: design.id,
    summary: `Composed "${design.name}" from job photos`,
    metadata: { jobId, beforeAfter: source.beforeAfter, aiUsed: ai.used, aiReason: ai.reason },
  }).catch(() => {});

  return NextResponse.json(
    {
      id: design.id,
      name: design.name,
      campaignId: design.campaignId,
      beforeAfter: source.beforeAfter,
      photosUsed: source.photos.length,
      headline,
      caption,
      hashtags,
      footer,
      defaultRatio: ratioByKey(DEFAULT_RATIO)?.key || AD_RATIOS[0].key,
      ai,
    },
    { status: 201 },
  );
}
