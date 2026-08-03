// app/api/jobs/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { materializeImportedCosts } from "@/lib/quotes/importQuote";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const jobs = await db.job.findMany({
    where: { companyId: member.companyId, ...(status && { status }) },
    include: {
      client: { select: { id: true, name: true } },
      visits: { orderBy: { scheduledAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Coarse role gate, then the granular level on top. The role answers "may
  // you create jobs at all"; the grid answers "has this member been narrowed
  // to view-only".
  try {
    requirePermission(member.role, "job:create");
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "create jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json();
  const { clientId, quoteId, title, recurring, recurrenceRule } = body;

  if (!clientId || !title) {
    return NextResponse.json(
      { error: "clientId and title are required" },
      { status: 400 },
    );
  }

  // A quoteId from the request body must belong to THIS company. Without this,
  // a caller could attach another company's quote — and materializeImportedCosts
  // below would then inject expenses into that company's ledger and consume its
  // imports. Scope it to the caller's company or reject.
  if (quoteId) {
    const ownsQuote = await db.quote.findFirst({
      where: { id: quoteId, companyId: member.companyId },
      select: { id: true },
    });
    if (!ownsQuote)
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const job = await db.job.create({
    data: {
      companyId: member.companyId,
      clientId,
      quoteId: quoteId || null,
      title,
      recurring: !!recurring,
      recurrenceRule: recurrenceRule || null,
    },
    include: { client: true },
  });

  // If this job was created from a quote that imported subcontractor costs,
  // materialise them as job expenses so they reach job costing. Best-effort and
  // idempotent (skips imports already materialised) — see materializeImportedCosts.
  if (quoteId) {
    try {
      await materializeImportedCosts(db, {
        quoteId,
        jobId: job.id,
        companyId: member.companyId,
        createdById: member.userId,
      });
    } catch (err) {
      console.error("[jobs POST] materialise imported costs:", err?.message);
    }
  }

  return NextResponse.json(job, { status: 201 });
}
