// app/api/clients/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await db.client.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: {
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!client)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.client.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, type, contactName, email, phone, address, city, province, notes } =
    body;

  const updated = await db.client.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && {
        type: type === "company" ? "company" : "individual",
        // Switching to individual clears any stale contact person.
        contactName: type === "company" ? contactName ?? existing.contactName : null,
      }),
      // Allow updating contactName on its own for an already-company client.
      ...(type === undefined &&
        contactName !== undefined && { contactName: contactName || null }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.client.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard: don't silently orphan financial records
  const [quoteCount, invoiceCount] = await Promise.all([
    db.quote.count({ where: { clientId: params.id } }),
    db.invoice.count({ where: { clientId: params.id } }),
  ]);

  if (quoteCount > 0 || invoiceCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a client with existing quotes or invoices" },
      { status: 400 },
    );
  }

  await db.client.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
