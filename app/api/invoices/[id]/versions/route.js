// app/api/invoices/[id]/versions/route.js
//
// ── This file spent its whole life one directory too high ──────────────────
//
// It was at app/api/invoices/versions/route.js — no [id] segment — while every
// line inside it assumed one. `await params` then `_params.id` gave undefined,
// and Prisma drops an `undefined` from a where clause rather than matching
// nothing, so `findFirst({ where: { id: undefined, companyId } })` quietly
// returned whichever invoice happened to come back first for that company and
// then reported ITS version chain. Tenant-scoped, so nothing leaked across
// companies; simply the wrong invoice, every time, for anyone who found the URL.
//
// Nothing called it, which is why nobody saw it. Moved rather than deleted
// because the handler is correct — it was only ever in the wrong place, and its
// own header comment said so from the first commit.
//
// ── It has a caller now ────────────────────────────────────────────────────
//
// The invoice detail page (app/app/invoices/[id]/page.js). It needs the whole
// family twice over: to decide whether the id in the URL is still the version
// that stands — the root is the v1 snapshot after an amendment, and every link
// in the office points at the root — and to draw the Earlier-versions list
// that is the way back to a version it redirected away from. The decision
// itself is lib/invoices/currentVersion.js; this endpoint is where the rows
// come from, rather than a second query written on the page.
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
