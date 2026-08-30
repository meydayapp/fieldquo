// app/api/marketing/designer/images/route.js
//
// POST — generate one marketing image. IMAGE_GENERATION_CENTS off the
// company's AI credit wallet, reserved before the vendor is called and
// refunded if it refuses. See lib/voice/spendGate.js for why reserve-then-buy
// is the shape and lib/ai/imageEconomics.js for the price.
//
// This is the backend half of the marketing designer. The canvas editor that
// calls it — lay out a generated image, then export it at every ratio via
// lib/marketing/ratios.js reflow() — is separate, unshipped work, which is
// why the `marketing_designer` feature this route belongs to
// (lib/features/registry.js) defaults to hidden: a fully working, billable
// endpoint with no product surface pointing at it is not the same thing as a
// shipped feature.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { featureAllowsSpend } from "@/lib/features/gate";
import { reserveSpend, refundReservation } from "@/lib/voice/spendGate";
import { generateMarketingImage } from "@/lib/ai/images";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same axis the rest of the marketing area gates its writes on — see
  // app/api/marketing/campaigns/route.js. A generated image spends the
  // company's credit the same way a campaign spends its ad budget, and both
  // are kept to owners, admins and supervisors.
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can generate marketing images" },
      { status: err.status || 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }
  // The browser sends a URL, never a raw file — the reference photo already
  // lives in Cloudinary (uploaded through /api/upload like any other job
  // photo), and this route resizes and re-fetches it server-side. See
  // lib/ai/images.js.
  const referencePhotoUrl =
    typeof body?.referencePhotoUrl === "string" && body.referencePhotoUrl.trim()
      ? body.referencePhotoUrl.trim()
      : null;

  // Named explicitly, rather than left to reserveSpend's own kind→feature
  // lookup (lib/voice/spendGate.js's FEATURE_FOR_KIND) — this literal call is
  // what makes marketing_designer a REAL consumer of its registry entry, the
  // thing scripts/check-feature-flags.mjs greps for.
  const offered = await featureAllowsSpend(member.companyId, "marketing_designer");

  const ref = `image_generation:${member.companyId}:${randomUUID()}`;
  const reserved = await reserveSpend({
    companyId: member.companyId,
    kind: "image_generation",
    ref,
    note: "Marketing image generation",
    available: offered,
  });

  if (!reserved.allowed) {
    if (reserved.reason === "feature_unavailable") {
      return NextResponse.json(
        { error: "AI image generation isn't available on your account yet." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error:
          `Generating an image costs $${(reserved.needCents / 100).toFixed(2)} of AI credit. ` +
          `Your balance is $${(reserved.balanceCents / 100).toFixed(2)} — add at least ` +
          `$${(reserved.shortfallCents / 100).toFixed(2)} first.`,
        needCents: reserved.needCents,
        balanceCents: reserved.balanceCents,
        shortfallCents: reserved.shortfallCents,
      },
      { status: 402 },
    );
  }

  const refund = (note) =>
    refundReservation({
      companyId: member.companyId,
      ref,
      cents: reserved.needCents,
      // Debited under kind "image_generation", which is what routes it to
      // the "ai" wallet (lib/voice/credits.js poolForKind) — the refund has
      // to be told the same thing, or it credits the voice balance instead.
      forKind: "image_generation",
      note,
    }).catch(() => {});

  try {
    const generated = await generateMarketingImage({ prompt, referencePhotoUrl });

    if (!generated?.url) {
      await refund("Refund — image generation failed");
      return NextResponse.json(
        { error: "Couldn't generate that image just now. Nothing was charged." },
        { status: 502 },
      );
    }

    await recordActivity(member, {
      action: "marketing.image_generated",
      entityType: "settings",
      summary: "Generated a marketing image",
      metadata: { model: generated.model, hadReference: Boolean(referencePhotoUrl) },
    }).catch(() => {});

    return NextResponse.json({
      url: generated.url,
      model: generated.model,
      chargedCents: reserved.needCents,
    });
  } catch (err) {
    await refund("Refund — image generation failed");
    console.error("[marketing/designer/images]", err);
    return NextResponse.json(
      { error: "Couldn't generate that image just now. Nothing was charged." },
      { status: 502 },
    );
  }
}
