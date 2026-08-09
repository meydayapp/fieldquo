// app/api/portal/[token]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/resolveLanguage";

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
          // The fallback in resolveClientLanguage, below the client's own
          // preference. The portal isn't tied to a single document, so there's
          // no frozen document language here — it's client.language → company
          // default → en, the same rule as any other correspondence.
          defaultLanguage: true,
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
    // Resolved once, server-side, so both portal components read the same
    // language the client was written to elsewhere. client.language is a
    // scalar on the row (no select narrowing above), so it's already loaded.
    language: resolveClientLanguage(client, client.company),
    company: client.company,
    quotes: client.quotes,
    invoices: client.invoices,
    jobs: client.jobs,
  });
}
