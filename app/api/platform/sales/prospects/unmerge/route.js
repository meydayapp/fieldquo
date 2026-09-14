// app/api/platform/sales/prospects/unmerge/route.js
//
// POST { survivorId } — take every merge on this row apart.
//
// Reactivates the retired rows, clears exactly the fields the plans filled
// (where the filled value still stands — a value a human changed since is
// kept and named), moves the re-parented numbers, leads, claims and
// attempts back, reverses the funnel deltas. One transaction. Superadmin
// only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { unmerge } from "@/lib/sales/discovery/mergeProspects";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const result = await unmerge({ db, survivorId: body?.survivorId, adminId: admin.id, now: new Date() });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...result });
}
