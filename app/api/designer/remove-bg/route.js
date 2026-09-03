// app/api/designer/remove-bg/route.js
//
// AI background removal, restored per the owner's 2026-08-30 correction:
// dropped in the first pass as "paywalled AI with no backend", but it has to
// exist — it just can't be free and can't be silent, because removing a
// background is an AI image EDIT, the same cost class as generation, billed
// per call at any real vendor.
//
// So it is metered on the SAME `image_generation` spend kind as
// /api/designer/generate — no separate price invented — via
// lib/designer/aiImageAdapter.js's requestAiImage(). Same centrally-enforced
// feature gate as that route (see registry.js's "marketing_designer" entry).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requestAiImage } from "@/lib/designer/aiImageAdapter";

const REFUSAL_MESSAGE = {
  feature_unavailable: "Background removal isn't switched on for this account.",
  vendor_unavailable: "Background removal isn't connected on this deployment yet.",
  insufficient_balance: "Not enough AI balance to remove this background.",
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

  const image = typeof body?.image === "string" ? body.image.trim() : "";
  if (!image) {
    return NextResponse.json({ error: "No image selected." }, { status: 400 });
  }

  const result = await requestAiImage({
    companyId: member.companyId,
    action: "remove-bg",
    payload: { image },
    note: "AI background removal",
    role: member.role,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: REFUSAL_MESSAGE[result.reason] || "Couldn't remove that background.",
        reason: result.reason,
        priceCents: result.priceCents,
        balanceCents: result.balanceCents,
        shortfallCents: result.shortfallCents,
        // The closed tier list and whether THIS member may buy — see
        // lib/ai/topupOffer.js. Null on every refusal that money cannot fix,
        // so the dialog opens on exactly the one it can.
        topup: result.topup ?? null,
      },
      { status: result.reason === "insufficient_balance" ? 402 : 403 },
    );
  }

  return NextResponse.json({ url: result.url });
}
