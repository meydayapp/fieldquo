// app/api/products/import/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

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
