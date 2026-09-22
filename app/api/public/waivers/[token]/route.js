// app/api/public/waivers/[token]/route.js
//
// The client's side of a waiver. No session — the token IS the credential,
// the same pattern as the public quote route next door. GET answers what
// the page renders (title, sections, acknowledgement lines, signed or not,
// the company's letterhead); POST signs.
//
// The response is assembled field by field. A spread of the signature row
// would leak the company id, the document id and — once signed — the
// stored IP and user agent to anyone with the link.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadWaiverByToken, signWaiver } from "@/lib/waivers/service";
import { presentWaiver } from "@/lib/waivers/present";

function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || null;
}

const NOT_FOUND = { error: "This link isn't valid. Ask for a new one." };

export async function GET(request, { params }) {
  const { token } = await params;
  const row = await loadWaiverByToken(token);
  if (!row || row.document?.archivedAt) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json(await presentWaiver(row));
}

export async function POST(request, { params }) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await signWaiver({
    token,
    ticked: Array.isArray(body?.acknowledgements) ? body.acknowledgements : [],
    name: body?.signature?.name,
    signatureDataUrl: body?.signature?.dataUrl,
    consent: body?.signature?.consent === true,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.needsAll ? { needsAll: true } : {}), ...(result.signed ? { status: "signed" } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({ status: "signed", signedAt: result.row.signedAt });
}
