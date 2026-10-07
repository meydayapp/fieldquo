// app/api/public/price-request/[token]/upload/sign/route.js
//
// Step one of a sub attaching a file (a PDF of their quote) to a price-request
// reply — a signed direct browser → Cloudinary upload (lib/media/
// uploadClient.js), into the GC's price-reply folder. The token is the
// credential; the rate limit stops a leaked one becoming free CDN space.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { uploadScope } from "@/lib/media/directUpload";
import { signResponse, readJsonBody } from "@/lib/media/directUploadServer";
import { loadRecipientByToken } from "@/lib/subRequests/server";
import { canReply } from "@/lib/subRequests/model";

export async function POST(request, { params }) {
  const limited = rateLimit(request, "price-request-upload", { limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { token } = await params;
  const r = await loadRecipientByToken(db, String(token || ""));
  if (!r) return NextResponse.json({ error: "This request link isn't valid." }, { status: 404 });
  // Nothing to attach a file to once the reply can no longer change.
  if (!canReply(r).ok) return NextResponse.json({ error: "This request no longer takes a reply." }, { status: 409 });
  return signResponse(uploadScope("price_reply", { companyId: r.request.companyId }), await readJsonBody(request));
}
