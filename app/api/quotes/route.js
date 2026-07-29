// app/api/quotes/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
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
    notes,
    validUntil,
    language,
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
      total,
      notes: notes || null,
      // COPIED onto the quote, not referenced from the company. A quote sent
      // in March must keep saying what it said in March even after the terms
      // change — reading the live company record would silently rewrite the
      // history of every document ever sent.
      processNotes: company?.defaultProcessNotes || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      language: language || "en",
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

// Server is the source of truth for sequential numbers — never generate this client-side.
function getNextQuoteNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `Q-${year}-0001`;
  const match = lastNumber.match(/(\d+)$/);
  const nextSeq = match
    ? String(Number(match[1]) + 1).padStart(4, "0")
    : "0001";
  return `Q-${year}-${nextSeq}`;
}
