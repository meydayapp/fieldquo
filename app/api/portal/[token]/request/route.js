// app/api/portal/[token]/request/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

import { recordConsent } from "@/lib/voice/outbound";
import { DISCLOSURE } from "@/lib/voice/disclosure";
// A logged-in-via-token client requesting new work — feeds the same LeadRequest
// pipeline as the public embeddable form, just pre-filled since we already know
// who they are.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
  });
  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  const { categoryId, message } = await request.json();

  const lead = await db.leadRequest.create({
    data: {
      companyId: client.companyId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      categoryId: categoryId || null,
      message: message || null,
      source: "client_portal",
    },
  });

  // An existing client asking for more work — the clearest consent there is,
  // and the number is the one already on their record rather than anything
  // they typed here.
  if (client.phone) {
    await recordConsent({
      companyId: client.companyId,
      phone: client.phone,
      source: "self_quote",
      disclosure: DISCLOSURE.lead,
      leadId: lead.id,
      clientId: client.id,
    }).catch((err) => console.error("[portal/request] consent not recorded:", err));
  }

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
