// app/api/products/export/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
