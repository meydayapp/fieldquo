// app/api/ai-employee/sources/[id]/ocr/route.js
//
// "Read scanned pages with AI" — one batch (at most four page images) of a
// reference-library manual, rendered in the browser from the company's own
// copy and read on the standard model, charged to the company's AI credit.
// Opt-in per document; the screen shows the price (ocrEstimateCents) before
// the button is pressed. All the work is lib/aiEmployee/referenceRuns.js
// readScannedPages, which the check runs with a scripted model.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { readScannedPages } from "@/lib/aiEmployee/referenceRuns";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can manage the AI employee's material." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const out = await readScannedPages({ prisma: db, companyId: member.companyId, userId: member.userId || null, sourceId: id, body });
  if (!out.ok) return NextResponse.json({ error: out.error, needCents: out.needCents ?? null }, { status: out.status });
  return NextResponse.json(out);
}
