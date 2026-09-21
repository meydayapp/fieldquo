// app/api/platform/sales/outcomes/audit/[attemptId]/route.js
//
// The supervisor's verdict on a rep's outcome (lib/sales/calls/dispositionAudit.js).
// GET reads the current verdict; POST { verdict, notes } writes it, and the
// history is PlatformAuditLog's. Superadmin only, both ways.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { saveDispositionAudit } from "@/lib/sales/calls/dispositionAudit";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { attemptId } = await params;
  const { refusal } = await requireSuperadmin(request, "read a disposition audit");
  if (refusal) return refusal;
  const row = await db.salesDispositionAudit.findUnique({ where: { attemptId: String(attemptId || "") } });
  return NextResponse.json({ audit: row ? { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } : null });
}

export async function POST(request, { params }) {
  const { attemptId } = await params;
  const { admin, refusal } = await requireSuperadmin(request, "audit a disposition");
  if (refusal) return refusal;
  const body = await request.json().catch(() => ({}));
  const r = await saveDispositionAudit({ attemptId, auditor: { id: admin.id, name: "FieldQuo" }, body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, audit: r.audit });
}
