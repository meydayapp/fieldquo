// app/api/settings/document-templates/seed-defaults/route.js
//
// Backfill for companies created before default templates existed (i.e.
// every company as of this feature shipping — nothing ever auto-seeded
// DocumentTemplate before). Mirrors /api/settings/products/seed-standard.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { seedDefaultTemplates } from "@/lib/email/seedDefaultTemplates";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const created = await seedDefaultTemplates(member.companyId);

  return NextResponse.json({ created });
}
