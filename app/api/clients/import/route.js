// app/api/clients/import/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Expects rows already parsed client-side (Papa Parse) into
// [{ name, email, phone, address, city, province, country }, ...]
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same gate as POST /api/clients — bulk import must not be a back door around
  // the client-create permission. A view-only member could otherwise create
  // unlimited clients here, the exact action the single-create path forbids.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_edit", "import clients");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

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
      // Whatever the CSV said, normalised, or null. An import is the one place
      // a country arrives as free text from a spreadsheet, so "Canada" and
      // "CAN" land as null rather than as a value the tax lookup would later
      // report as an unsupported country.
      country: normaliseCountry(r.country),
    })),
  });

  return NextResponse.json({ imported: created.count, skipped });
}
