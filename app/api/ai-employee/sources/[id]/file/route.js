// app/api/ai-employee/sources/[id]/file/route.js
//
// Open the manual a company uploaded to its reference library — the one way
// it is opened. The file is stored "authenticated" (its plain URL answers
// 401), so this checks the member and the company, then redirects to a
// Cloudinary download link that expires in five minutes — the HR file's
// pattern (lib/hr/documentFile.js), and the same signer.
//
// This is what READS AiEmployeeSource.storageKey for a person; the server's
// own reads of the file are ingest-time (app/api/ai-employee/sources).
//
// A GET that writes nothing, so it behaves under read-only impersonation as
// the settings screen it is linked from does (memberOrRefusal decides).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { cloudinary } from "@/lib/cloudinary";
import { hrFileLocation, signedOpenLink } from "@/lib/hr/documentFile";
import { isOwnReferenceUrl } from "@/lib/aiEmployee/reference";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json({ error: "Only an owner or admin can open the AI employee's material." }, { status: 403 });
    }
  }
  const row = await db.aiEmployeeSource.findFirst({ where: { id, companyId: member.companyId }, select: { storageKey: true } });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  // The second lock: a row only ever names a file in its own company's
  // private reference folder, or it is not opened.
  if (!row?.storageKey || !isOwnReferenceUrl(row.storageKey, { cloudName, companyId: member.companyId })) {
    return NextResponse.json({ error: "There's no stored file for this one." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: "File storage isn't configured." }, { status: 503 });
  }
  const at = hrFileLocation(row.storageKey, { cloudName, companyId: member.companyId });
  const { url } = signedOpenLink(at, { sign: (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options) });
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
