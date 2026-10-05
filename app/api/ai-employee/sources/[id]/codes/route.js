// app/api/ai-employee/sources/[id]/codes/route.js
//
// "Extract error codes" — one standard-model pass over the pages of a
// reference-library manual that look like a fault table, charged to the
// company's AI credit at the price the screen showed
// (codeExtractEstimateCents). The codes land UNREVIEWED, each with its page,
// for the owner to tick (app/api/ai-employee/codes/[id]). The work is
// lib/aiEmployee/referenceRuns.js extractCodes.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { extractCodes } from "@/lib/aiEmployee/referenceRuns";

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
  const out = await extractCodes({ prisma: db, companyId: member.companyId, userId: member.userId || null, sourceId: id });
  if (!out.ok) return NextResponse.json({ error: out.error, needCents: out.needCents ?? null }, { status: out.status });
  return NextResponse.json(out);
}
