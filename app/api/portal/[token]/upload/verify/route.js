// app/api/portal/[token]/upload/verify/route.js
//
// Step two of a client-portal upload: confirm the file Cloudinary stored is
// one this portal's sign step minted, in this company's portal folder, within
// the caps. See lib/media/directUpload.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadScope } from "@/lib/media/directUpload";
import { verifyResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise.
  const { token } = await params;
  const client = await db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { companyId: true },
  });
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });
  return verifyResponse(uploadScope("portal", { companyId: client.companyId }), await readJsonBody(request));
}
