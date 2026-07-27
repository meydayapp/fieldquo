// app/api/clients/import/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Expects rows already parsed client-side (Papa Parse) into
// [{ name, email, phone, address, city, province }, ...]
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const valid = rows.filter((r) => r.name?.trim());
  const skipped = rows.length - valid.length;

  const created = await db.client.createMany({
    data: valid.map((r) => ({
      companyId: member.companyId,
      name: r.name.trim(),
      email: r.email || null,
      phone: r.phone || null,
      address: r.address || null,
      city: r.city || null,
      province: r.province || null,
    })),
  });

  return NextResponse.json({ imported: created.count, skipped });
}
