// app/api/invoices/[id]/versions/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { redactInvoiceMoney } from "@/lib/permissions/enforce";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "invoices",
    "view_only",
    "see invoices",
  );
  if (denied) return denied;

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

  // Each row is a version and a total. The history of what an invoice was
  // amended TO is still the amount, so it follows the same toggle the invoice
  // itself now does.
  return NextResponse.json(versions.map((v) => redactInvoiceMoney(full, v)));
}
