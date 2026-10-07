// app/api/public/price-request/[token]/upload/verify/route.js
//
// Step two: confirm the file Cloudinary stored is one this token's sign step
// minted, in the GC's price-reply folder, within the caps. See
// lib/media/directUpload.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadScope } from "@/lib/media/directUpload";
import { verifyResponse, readJsonBody } from "@/lib/media/directUploadServer";
import { loadRecipientByToken } from "@/lib/subRequests/server";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const r = await loadRecipientByToken(db, String(token || ""));
  if (!r) return NextResponse.json({ error: "This request link isn't valid." }, { status: 404 });
  return verifyResponse(uploadScope("price_reply", { companyId: r.request.companyId }), await readJsonBody(request));
}
