// app/api/clients/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  const clients = await db.client.findMany({
    where: {
      companyId: member.companyId,
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // "Clients and Properties: view client name and address only" is the
  // narrowest level and must not permit creating client records.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_edit", "add clients");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const body = await request.json();
  const { name, type, contactName, email, phone, address, city, province, notes } =
    body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const client = await db.client.create({
      data: {
        companyId: member.companyId,
        name,
        type: type === "company" ? "company" : "individual",
        // Only meaningful for company clients; ignored/blank for individuals.
        contactName: type === "company" ? contactName || null : null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        province: province || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    // Most likely cause in dev: the `type`/`contactName` columns don't exist
    // yet because `npx prisma db push` hasn't been run since the schema
    // changed. Return JSON so the client sees a real message instead of
    // "Unexpected end of JSON input".
    console.error("[clients POST]", err);
    return NextResponse.json(
      {
        error:
          "Could not create client. If you just changed the schema, run `npx prisma db push` and restart the dev server.",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
