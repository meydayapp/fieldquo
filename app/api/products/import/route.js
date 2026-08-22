// app/api/products/import/route.js
//
// Bulk-create price book rows from a CSV.
//
// ── Why this route has a guard now ─────────────────────────────────────────
//
// ../route.js was hardened and this was missed. POST /api/products refuses
// anyone below admin, and this endpoint — which creates the same rows, with
// the same sell prices and costs, hundreds at a time — accepted any signed-in
// member. The bulk door was wider than the single-item one it duplicates.
//
// Owner/admin, matching the writes in ../route.js: a rate card is a business
// decision, not a job.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

/**
 * Owner/admin only. Mirrors requireCatalogueWrite in ../route.js.
 *
 * Restated here rather than imported from that file: importing across route
 * modules would drag a whole set of request handlers (and their Better Auth
 * and translation imports) into this one's bundle to reuse four lines. If a
 * third catalogue writer ever appears, this belongs in lib/ — with two, the
 * shared home would cost more than it saves.
 */
function requireCatalogueWrite(member) {
  if (!["owner", "admin"].includes(member.role)) {
    const err = new Error("Only an owner or admin can change the price book.");
    err.status = 403;
    throw err;
  }
}

// Minimal CSV parser — good enough for the simple, no-embedded-commas export
// this pairs with (see /api/products/export). If you need to support
// arbitrary Excel/Sheets exports with quoted fields containing commas, swap
// this for a real CSV library (papaparse works well and is already used in
// the xlsx tooling elsewhere in this project's tooling, if you want
// consistency).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Checked before the file is read, so a refused caller never gets as far as
  // having their upload parsed.
  try {
    requireCatalogueWrite(member);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  const toCreate = rows
    .filter((r) => r.name)
    .map((r) => ({
      companyId: member.companyId,
      name: r.name,
      description: r.description || null,
      type: r.type?.toLowerCase() === "product" ? "product" : "service",
      unitPrice: r.unitprice ? Number(r.unitprice) : null,
      costPrice: r.costprice ? Number(r.costprice) : null,
      unit: r.unit || null,
    }));

  if (toCreate.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found — make sure there's a 'name' column" },
      { status: 400 },
    );
  }

  const result = await db.product.createMany({ data: toCreate });

  return NextResponse.json({ imported: result.count });
}
