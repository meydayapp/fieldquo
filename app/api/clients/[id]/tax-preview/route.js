// app/api/clients/[id]/tax-preview/route.js
//
// What tax rate this client resolves to right now, and where it came from.
//
// ── Why this exists rather than the dialog working it out ──────────────────
//
// TaxUnresolvedModal fixes a client's country and province and then has to
// tell the person whether that actually solved anything. It could import
// resolveDocumentTax and run it in the browser — the function is pure and the
// company's tax config is already on screen elsewhere.
//
// It must not. The send route is what decides whether a document may go out,
// and a dialog that computes its own answer is a second opinion that can
// disagree with the one that matters. Someone would see "13% — send when
// you're ready", press Send, and get the same 409 back. So the dialog asks the
// server the same question the gate asks, against the same rows.
//
// Read-only, member-scoped, and returns a RATE for one named client — not a
// rate card. There is no listing here and no way to enumerate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { resolveDocumentTax } from "@/lib/tax/documentTax";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Scoped to the caller's company, so an id from another tenant is a 404
  // rather than a tax rate.
  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true, province: true, country: true },
  });
  if (!client)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [company, taxRates] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: {
        taxRate: true,
        autoApplyLocalTax: true,
        country: true,
        province: true,
        vatRegistered: true,
      },
    }),
    db.taxRate.findMany({ where: { companyId: member.companyId } }),
  ]);

  const result = resolveDocumentTax({
    company: company || {},
    taxRates,
    client,
  });

  return NextResponse.json({
    rate: Number(result.rate) || 0,
    // So the caller can distinguish "13%, because they're in Ontario" from
    // "13%, assumed from YOUR province" without re-deriving it.
    source: result.source,
    label: result.label || result.detail?.label || null,
    assumed: Boolean(result.assumed),
    assumedRegion: result.assumedRegion,
  });
}
