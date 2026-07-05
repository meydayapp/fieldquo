// app/api/portal/[token]/request/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// A logged-in-via-token client requesting new work — feeds the same LeadRequest
// pipeline as the public embeddable form, just pre-filled since we already know
// who they are.
export async function POST(request, { params }) {
  const client = await db.client.findUnique({
    where: { portalToken: params.token },
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

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
