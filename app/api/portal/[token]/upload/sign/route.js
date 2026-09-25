// app/api/portal/[token]/upload/sign/route.js
//
// Step one of a client-portal photo upload, signed for a direct browser →
// Cloudinary upload so a phone photo is not refused at Vercel's 4.5 MB edge
// limit. Same token lookup, same rate limit and same folder
// (fieldquo/companies/<companyId>/portal — the one lib/clientTickets/rules.js
// ownUploads() accepts) as the multipart route beside it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { uploadScope } from "@/lib/media/directUpload";
import { signResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request, { params }) {
  // A token is a credential, but a leaked one must not become free CDN space.
  // Same key as the multipart route, so switching transport does not double
  // the allowance.
  const limited = rateLimit(request, "portal-upload", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: `params` is a Promise.
  const { token } = await params;
  const client = await db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { companyId: true },
  });
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });
  return signResponse(uploadScope("portal", { companyId: client.companyId }), await readJsonBody(request));
}
