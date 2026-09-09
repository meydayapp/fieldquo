// app/api/clients/import/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { cleanEmail, emailProblem } from "@/lib/validation";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Expects rows already parsed client-side (Papa Parse) into
// [{ name, email, phone, address, city, province, country }, ...]
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  const named = rows.filter((r) => r.name?.trim());
  const skipped = rows.length - named.length;

  // ── A spreadsheet full of addresses nothing can be delivered to ─────────
  //
  // A CSV is where a typed address arrives in bulk and nobody re-reads it. A
  // row whose email cannot be delivered to is NOT imported with the address
  // quietly dropped — that produces a client who looks contactable on the
  // screen and is not, which is exactly how Manny Conto's quote came to be
  // sent to nowhere. It is left out and counted, and the count is reported
  // separately so the contractor can fix those rows and import them again.
  //
  // An EMPTY email column is fine: plenty of clients are a phone number.
  const valid = named.filter((r) => {
    const problem = emailProblem(r.email);
    return problem === null || problem === "empty";
  });
  const badEmails = named.length - valid.length;

  const created = await db.client.createMany({
    data: valid.map((r) => ({
      companyId: member.companyId,
      name: r.name.trim(),
      email: cleanEmail(r.email),
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

  return NextResponse.json({ imported: created.count, skipped, badEmails });
}
