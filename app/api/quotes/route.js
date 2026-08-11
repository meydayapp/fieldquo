// app/api/quotes/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { getNextQuoteNumber } from "@/lib/quotes/quoteNumber";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMediaList } from "@/lib/media/validate";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");

  const quotes = await db.quote.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(clientId && { clientId }),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      scopeGroups: { include: { category: { select: { label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(quotes);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Granular check. Previously this route trusted the coarse role alone, so a
  // member configured as "Quotes: view only" could still create quotes —
  // PERMISSIONS.employee includes "quote:create". The grid said no; the API
  // said yes.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "create quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  try {
    await requireWithinLimit(member.companyId, "quotes");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 402 },
    );
  }

  const body = await request.json();
  const {
    clientId,
    quoteType,
    scopeGroups,
    subtotal,
    discount,
    tax,
    total,
    // The flag, not just the amount. See the note in [id]/route.js: this column
    // was read by the edit page and by the public quote route, and written by
    // nothing, so the "Apply tax" checkbox never survived a save.
    taxEnabled,
    notes,
    validUntil,
    language,
    // Photos of the job. Previously only ever set by lead intake, so a quote
    // typed up by staff had no way to carry the pictures the estimator took.
    clientPhotos,
  } = body;

  if (!clientId || total === undefined) {
    return NextResponse.json(
      { error: "clientId and total are required" },
      { status: 400 },
    );
  }

  const [lastQuote, company] = await Promise.all([
    db.quote.findFirst({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      select: { quoteNumber: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultProcessNotes: true },
    }),
  ]);
  const quoteNumber = getNextQuoteNumber(lastQuote?.quoteNumber);

  const quote = await db.quote.create({
    data: {
      companyId: member.companyId,
      quoteNumber,
      clientId,
      createdById: member.userId,
      quoteType: quoteType || null,
      subtotal: subtotal || 0,
      discount: discount || 0,
      tax: tax || 0,
      // Default true only when the client didn't say — matching the column's own
      // default. `taxEnabled: false` must not be read as "unset".
      taxEnabled: taxEnabled === undefined ? true : Boolean(taxEnabled),
      total,
      notes: notes || null,
      // COPIED onto the quote, not referenced from the company. A quote sent
      // in March must keep saying what it said in March even after the terms
      // change — reading the live company record would silently rewrite the
      // history of every document ever sent.
      processNotes: company?.defaultProcessNotes || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      language: language || "en",
      // Same boundary the public self-quote intake uses — the browser sends
      // URLs, and these end up on a document a homeowner opens, so nothing
      // reaches the column that isn't an https media entry we recognise.
      ...(clientPhotos !== undefined && {
        clientPhotos: normaliseMediaList(clientPhotos),
      }),
      ...(scopeGroups?.length && {
        scopeGroups: {
          create: scopeGroups.map((g, i) => ({
            categoryId: g.categoryId,
            label: g.label || null,
            lineItems: g.lineItems || null,
            subtotal: g.subtotal || 0,
            sortOrder: i,
          })),
        },
      }),
    },
    include: { client: true, scopeGroups: true },
  });

  await recordActivity(member, {
    action: "quote.created",
    entityType: "quote",
    entityId: quote.id,
    summary: `Created quote ${quote.quoteNumber} for ${quote.client?.name || "a client"}`,
    metadata: { total: quote.total },
  });

  return NextResponse.json(quote, { status: 201 });
}
