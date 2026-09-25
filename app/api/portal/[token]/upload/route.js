// app/api/portal/[token]/upload/route.js
//
// A photo from the client portal — for a ticket ("Report an issue"), a reply,
// or a "Request work" description. The same signed, server-side Cloudinary
// upload and the same media allow-list as the public self-quote upload
// (app/api/self-quote/[companySlug]/upload), scoped by the portal token
// instead of a company slug.
//
// Files land in fieldquo/companies/<companyId>/portal — the ONE folder
// lib/clientTickets/rules.js ownUploads() accepts on a ticket or a request,
// so a URL is only ever attached if this route produced it for this company.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { uploadBuffer } from "@/lib/cloudinary";
import { classifyMedia, uploadPublicId, safeFilename } from "@/lib/media/validate";

export async function POST(request, { params }) {
  // A token is a credential, but a leaked one must not become free CDN space.
  const limited = rateLimit(request, "portal-upload", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  // Next 16: `params` is a Promise.
  const { token } = await params;
  const client = await db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { companyId: true },
  });
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return NextResponse.json({ error: "upload_unavailable" }, { status: 503 });
  }
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const verdict = classifyMedia(file, { allowLogo: false });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${client.companyId}/portal`,
      resourceType: verdict.resourceType,
      publicId: uploadPublicId(verdict.kind),
    });
    return NextResponse.json({ url: uploaded.secure_url, kind: verdict.kind, filename: safeFilename(file.name) });
  } catch (err) {
    console.error("[portal/upload] Cloudinary error:", err?.message);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
