// app/api/hr/documents/[id]/open/route.js
//
// The only way a person's HR file is opened: the same two doors as the rest
// of the HR file (a manager, or the person it is about), then a redirect to a
// Cloudinary link that expires in five minutes. The stored URL is never sent
// to a browser — see lib/hr/documentFile.js for why, and for why a download
// link rather than a signed delivery URL.
//
// A GET that writes nothing, so it behaves under read-only impersonation
// exactly as the HR screens that link to it do (memberOrRefusal decides that,
// not this route). No activity row is written for the same reason: a write
// here would be a write during impersonation.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { cloudinary } from "@/lib/cloudinary";
import { openHrDocument } from "@/lib/hr/documentOpen";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const configured = Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const out = await openHrDocument(db, {
    member,
    id,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    sign: configured ? (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options) : null,
  });
  if (out.status !== 302) {
    return NextResponse.json({ error: out.error }, { status: out.status, headers: { "Cache-Control": "private, no-store" } });
  }
  const res = NextResponse.redirect(out.url, 302);
  // The signed link must not be cached by anything between here and the
  // browser, nor be sent on as a Referer from whatever the file links to.
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
