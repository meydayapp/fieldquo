// app/api/marketing/subscribers/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

async function loadOwned(id, companyId) {
  const sub = await db.marketingSubscriber.findUnique({ where: { id } });
  if (!sub || sub.companyId !== companyId) return null;
  return sub;
}

// PATCH { subscribed } — the unsubscribe/resubscribe toggle.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage subscribers" },
      { status: err.status || 403 },
    );
  }

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { subscribed, name, phone, address } = await request.json();

  const updated = await db.marketingSubscriber.update({
    where: { id },
    data: {
      ...(subscribed !== undefined && { subscribed }),
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage subscribers" },
      { status: err.status || 403 },
    );
  }

  const existing = await loadOwned(id, member.companyId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.marketingSubscriber.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
