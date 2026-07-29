// app/api/portal/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          phone: true,
          email: true,
          currency: true,
        },
      },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
      jobs: { include: { visits: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  return NextResponse.json({
    clientName: client.name,
    company: client.company,
    quotes: client.quotes,
    invoices: client.invoices,
    jobs: client.jobs,
  });
}
