// app/api/designer/generate/route.js
//
// AI image generation — the one piece of the ported editor that IS premium
// (owner's 2026-08-30 correction). Listed in the "marketing_designer"
// feature's apiPrefixes (lib/features/registry.js), so a hidden/locked
// state is enforced centrally by getCurrentMember before this handler ever
// runs (see that entry's own comment); the affordability check below is the
// second, independent question — can THIS company pay THIS price right now.
//
// Metered on the `image_generation` spend kind via
// lib/designer/aiImageAdapter.js's requestAiImage() — same kind, same price,
// same wallet the Remove-background route uses. Refusals carry the price,
// the balance and the shortfall, per the coordinator's explicit instruction:
// never "something went wrong".
//
// ══ referencePhotoUrl — the capability that was built and never reachable ══
//
// The whole reference-image chain already existed: provider.js's
// generateImage() routes to images.edit when a reference buffer is present,
// lib/ai/images.js downloads and resizes the photo, and
// aiImageAdapter.js:requestAiImage already forwards
// `payload.referencePhotoUrl`. Background removal is that same edit path with
// a fixed prompt, which is how we know it works end to end today.
//
// This route built `payload: { prompt }` and dropped the rest on the floor, so
// no contractor could ever start from a photograph — while
// app/api/marketing/designer/images/route.js, which DID accept one, has zero
// fetch call sites anywhere in the app. The capability was wired to the route
// nobody calls and discarded by the route everybody calls. Carrying it here is
// the fix; see AiSidebar.js for the attach/pick control that supplies it.
//
// ── Why the URL is checked before it is forwarded ─────────────────────────
//
// lib/ai/images.js FETCHES this URL server-side. An arbitrary string here is a
// server-side request to wherever the browser said, and the bytes come back
// into the contractor's own advert. isUploadedUrl() confines it to files that
// went through /api/upload on this deployment's own Cloudinary cloud — which
// is also what makes `resizedUrl()` (and so the whole "resize before sending"
// cost argument in images.js) apply at all, since that transformation is a
// no-op on a URL Cloudinary doesn't serve.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requestAiImage } from "@/lib/designer/aiImageAdapter";
import { isUploadedUrl } from "@/lib/jobs/documents";

const REFUSAL_MESSAGE = {
  feature_unavailable: "AI image generation isn't switched on for this account.",
  vendor_unavailable: "AI image generation isn't connected on this deployment yet.",
  insufficient_balance: "Not enough AI balance for this image.",
};

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Describe the image you want." }, { status: 400 });
  }

  // Absent means an unconditioned generation, which is what this route did
  // before and still does. Present-but-not-ours is REFUSED rather than
  // silently ignored: quietly generating something unconditioned from a prompt
  // written about a photo the contractor attached is the control that appears
  // to work — they'd get a picture, it just wouldn't be of their kitchen.
  const rawReference = typeof body?.referencePhotoUrl === "string" ? body.referencePhotoUrl.trim() : "";
  if (rawReference && !isUploadedUrl(rawReference, { cloudName: process.env.CLOUDINARY_CLOUD_NAME })) {
    return NextResponse.json(
      {
        error: "That photo isn't one of this account's uploads. Upload it here first, then try again.",
        reason: "reference_not_uploaded",
      },
      { status: 400 },
    );
  }
  const referencePhotoUrl = rawReference || null;

  const result = await requestAiImage({
    companyId: member.companyId,
    action: "generate",
    // requestAiImage already forwards referencePhotoUrl into
    // generateMarketingImage — see lib/designer/aiImageAdapter.js:214. This
    // route was the only thing in the chain not passing it along.
    payload: { prompt, referencePhotoUrl },
    note: referencePhotoUrl
      ? `AI image from a photo — "${prompt.slice(0, 80)}"`
      : `AI-generated image — "${prompt.slice(0, 80)}"`,
    role: member.role,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: REFUSAL_MESSAGE[result.reason] || "Couldn't generate that image.",
        reason: result.reason,
        priceCents: result.priceCents,
        balanceCents: result.balanceCents,
        shortfallCents: result.shortfallCents,
        // The closed tier list and whether THIS member may buy — see
        // lib/ai/topupOffer.js. Null on every refusal that money cannot fix,
        // so the dialog opens on exactly the one it can.
        topup: result.topup ?? null,
      },
      // 402 for "would cost money you don't have", 403 for everything else
      // this seam can refuse for — never a bare 500 for a refusal the caller
      // is meant to show the reason for.
      { status: result.reason === "insufficient_balance" ? 402 : 403 },
    );
  }

  return NextResponse.json({ url: result.url });
}
