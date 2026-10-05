// app/api/files/open/route.js
//
// Open one stored file for a member of the company it belongs to — a drawing
// on a quote, a job's documents, a homeowner's PDF in the inbox, a receipt,
// a vehicle's or a subcontractor's papers, the company's own documents.
//
// The link was minted by the route that listed the file, after that route's
// own permission check, and is bound to the reader and to the row
// (lib/media/fileOpen.js says why this route does not restate eight
// permission rules). Here: the session, the link's signature and expiry, the
// row inside the reader's company, the file inside the company's folders,
// then the bytes, streamed with their real type and name.
//
// A GET that writes nothing, so a read-only support session opens files as
// the screens it is looking at do; memberOrRefusal decides who that is.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { verifyStaffFileLink, resolveStaffFile, openFileResponse, FILE_OPEN_ERRORS } from "@/lib/media/fileOpen";
import { cloudinarySigner } from "@/lib/media/cloudinarySign";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const q = new URL(request.url).searchParams;
  const link = verifyStaffFileLink(member, {
    kind: q.get("k"),
    id: q.get("id"),
    index: q.get("i"),
    exp: q.get("exp"),
    sig: q.get("sig"),
  });
  if (!link.ok) {
    if (link.code === "expired") return NextResponse.json({ error: FILE_OPEN_ERRORS.expired }, { status: 410, headers: NO_STORE });
    if (link.code === "unavailable") return NextResponse.json({ error: FILE_OPEN_ERRORS.unconfigured }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ error: FILE_OPEN_ERRORS.missing }, { status: 404, headers: NO_STORE });
  }

  const file = await resolveStaffFile(db, { companyId: member.companyId, kind: link.kind, id: link.id, index: link.index });
  if (!file) return NextResponse.json({ error: FILE_OPEN_ERRORS.missing }, { status: 404, headers: NO_STORE });

  return openFileResponse({
    file,
    companyId: member.companyId,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    sign: cloudinarySigner(),
  });
}
