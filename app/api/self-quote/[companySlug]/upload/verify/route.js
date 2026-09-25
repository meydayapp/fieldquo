// app/api/self-quote/[companySlug]/upload/verify/route.js
//
// Public. Step two of a homeowner's upload: confirm the file is one the sign
// step minted in this company's leads folder, within the caps, before the
// form is allowed to carry its URL. See lib/media/directUpload.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadScope } from "@/lib/media/directUpload";
import { verifyResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise.
  const { companySlug } = await params;
  const company = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return verifyResponse(uploadScope("leads", { companyId: company.id }), await readJsonBody(request));
}
