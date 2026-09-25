// app/api/self-quote/[companySlug]/upload/sign/route.js
//
// Public. Step one of a homeowner's upload on a self-quote, instant-quote or
// funnel form, signed for a direct browser → Cloudinary upload — a phone photo
// is routinely over the 4.5 MB Vercel lets through this server.
//
// Rate-limited, which the multipart route beside it is not: that route was
// bounded in practice by the 4.5 MB body, and this one hands out a signature
// for a file up to the video cap. Same allowance as the portal's upload.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { uploadScope } from "@/lib/media/directUpload";
import { signResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request, { params }) {
  const limited = rateLimit(request, "self-quote-upload", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: `params` is a Promise.
  const { companySlug } = await params;
  // Only a real tenant's slug opens the door — no open signing endpoint.
  const company = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return signResponse(uploadScope("leads", { companyId: company.id }), await readJsonBody(request));
}
