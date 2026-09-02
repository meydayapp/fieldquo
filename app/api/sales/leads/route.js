// app/api/sales/leads/route.js
//
// A rep's own pipeline: the prospects they are working, and nobody else's.
//
// ══ Scoped by salesRepId, re-derived every request ═════════════════════════
//
// Not "filtered" — scoped. There is no outer tenant boundary behind this the
// way there is behind every /api/* route in the product, so the salesRepId in
// the where clause IS the boundary, exactly as lib/sales/scope.js argues for a
// rep's company list. The fragment is built by leadListWhere() rather than
// written here, so it cannot be written slightly differently in the next route,
// and it never collapses to `{}` for a caller it could not identify.
//
// ══ Why a rep may write here at all ════════════════════════════════════════
//
// lib/sales/gate.js refuses every non-GET under /api/sales, for the good reason
// its header gives. Leads, threads and messages are the narrow exception: they
// are the rep's own notes about people who are not customers, they decide no
// money, and the feature is meaningless without them. See
// lib/sales/outreachGate.js, which is where that exception is written down.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import {
  isLeadStatus,
  isPlausibleEmail,
  leadListWhere,
  sanitiseHeaderText,
} from "@/lib/sales/outreach";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const leads = await db.salesLead.findMany({
    where: leadListWhere(rep.id, status),
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      status: true,
      convertedCompanyId: true,
      convertedAt: true,
      createdAt: true,
      updatedAt: true,
      threads: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: { id: true, subject: true, lastMessageAt: true },
      },
      _count: { select: { threads: true } },
    },
  });

  // The counts the pipeline header shows. Computed from the rep's whole book
  // rather than from the filtered page, so switching filters doesn't make the
  // totals change — a tab that renumbers itself when you click it is the kind
  // of small lie that makes people stop trusting a screen.
  const counts = await db.salesLead.groupBy({
    by: ["status"],
    where: leadListWhere(rep.id),
    _count: { _all: true },
  });

  return NextResponse.json({
    leads,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    // Sent with the list so the screen never has to guess whether composing is
    // possible. See lib/sales/outreachReadiness.js.
    outreach: await outreachStatus(rep),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const businessName = sanitiseHeaderText(body.businessName, 200);
  if (!businessName) {
    return NextResponse.json({ error: "A business name is required." }, { status: 400 });
  }

  const email = sanitiseHeaderText(body.email, 254).toLowerCase();
  if (email && !isPlausibleEmail(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const status = isLeadStatus(body.status) ? body.status : "new";

  const lead = await db.salesLead.create({
    data: {
      // From the gate's fresh read of the session, never from the body. A
      // salesRepId a client could name is a client that can file a prospect
      // into a colleague's pipeline.
      salesRepId: rep.id,
      businessName,
      contactName: sanitiseHeaderText(body.contactName, 200) || null,
      email: email || null,
      phone: sanitiseHeaderText(body.phone, 40) || null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : null,
      status,
    },
    select: { id: true, businessName: true, status: true },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
