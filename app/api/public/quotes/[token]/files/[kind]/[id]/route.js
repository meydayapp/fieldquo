// app/api/public/quotes/[token]/files/[kind]/[id]/route.js
//
// A company document shown beside a quote — on /q/<token> and on the
// instant-estimate report at /estimate-report/<token>, which share the
// quote's share token. No session: the share token is the credential, and
// the document must be one that quote's proposal shows (lib/media/fileOpen.js
// resolveClientFile: the quote's company, not archived, shown on quotes, not
// expired, and in the quote's own document pick when it has one).
//
// Streamed by us rather than linked to Cloudinary, whose plain PDF URLs this
// account refuses to deliver; see lib/media/signedFile.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientFile, openFileResponse, FILE_OPEN_ERRORS } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";

export async function GET(request, { params }) {
  const { token, kind, id } = await params;
  const file = await resolveClientFile(db, { scope: "quote", token, kind, id });
  if (!file) return NextResponse.json({ error: FILE_OPEN_ERRORS.missing }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return openFileResponse({
    file,
    companyId: file.companyId,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    sign: cloudinarySigner(),
  });
}
