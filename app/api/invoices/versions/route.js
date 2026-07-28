// app/api/invoices/[id]/versions/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await db.invoice.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rootId = invoice.parentInvoiceId || invoice.id;

  const versions = await db.invoice.findMany({
    where: { OR: [{ id: rootId }, { parentInvoiceId: rootId }] },
    orderBy: { version: "asc" },
    select: {
      id: true,
      version: true,
      total: true,
      status: true,
      changeLog: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
}
