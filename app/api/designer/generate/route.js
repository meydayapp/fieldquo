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
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requestAiImage } from "@/lib/designer/aiImageAdapter";

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

  const result = await requestAiImage({
    companyId: member.companyId,
    action: "generate",
    payload: { prompt },
    note: `AI-generated image — "${prompt.slice(0, 80)}"`,
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
