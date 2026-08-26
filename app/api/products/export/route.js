// app/api/products/export/route.js
//
// The price book as a CSV file — including costPrice, which is the company's
// margin on every line it sells.
//
// ── Why this route has a guard now ─────────────────────────────────────────
//
// ../route.js was hardened and this was missed, which left the softer door
// standing next to the locked one: an employee with showPricing:false got a
// 403 from GET /api/products and could still hit this and download the entire
// catalogue, costs and all, as a file. A boundary that only covers the JSON
// endpoint is not a boundary — it is a detour.
//
// Same gate as the read it exports, deliberately: requireToggle("showPricing").
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireToggle } from "@/lib/permissions/enforce";

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Refused outright rather than exported with the costPrice column blanked.
  // A redacted CSV would be actively dangerous here: this file pairs with
  // POST /api/products/import, so the obvious round trip — export, edit in
  // Sheets, import — would silently write null over every cost the company
  // has. Better no file than a file that destroys data when used as intended.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "export the price book");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const products = await db.product.findMany({
    where: { companyId: member.companyId },
    orderBy: { name: "asc" },
  });

  const header = "name,description,type,unitPrice,costPrice,unit";
  const rows = products.map((p) =>
    [p.name, p.description, p.type, p.unitPrice, p.costPrice, p.unit]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="products-and-services.csv"',
    },
  });
}
