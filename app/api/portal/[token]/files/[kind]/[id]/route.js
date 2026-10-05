// app/api/portal/[token]/files/[kind]/[id]/route.js
//
// A file the client portal (and the client's emails) links to: the signed
// copy of a waiver this client signed, or a document the contractor attaches
// to preparation guides. No session — the portal token is the credential,
// as for every other /api/portal/[token] route — and the row must belong to
// that token's client and company (lib/media/fileOpen.js resolveClientFile).
//
// Streamed by us rather than linked to Cloudinary, whose plain PDF URLs this
// account refuses to deliver; see lib/media/signedFile.js. Nothing here
// names FieldQuo: the file goes out under the name the contractor gave it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientFile, openFileResponse, FILE_OPEN_ERRORS } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";

export async function GET(request, { params }) {
  const { token, kind, id } = await params;
  const file = await resolveClientFile(db, { scope: "portal", token, kind, id });
  if (!file) return NextResponse.json({ error: FILE_OPEN_ERRORS.missing }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return openFileResponse({
    file,
    companyId: file.companyId,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    sign: cloudinarySigner(),
  });
}
