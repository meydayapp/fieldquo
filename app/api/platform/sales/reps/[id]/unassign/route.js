// app/api/platform/sales/reps/[id]/unassign/route.js
//
// The console taking ticked leads back from a rep.
//
// POST `{ prospectIds }` → lib/sales/assignLeads.js unassignFromRep(), which
// is lib/sales/queueBatch.js's releaseUntouched() with `reason: "admin"`,
// `onlyIds` and `includeDialled` — the ONE function that puts a Prospect
// back in the pool, the same one behind the rep's own button, the hourly
// sweep and the queue route's "Release all held". Nothing here writes a
// release of its own. A worked row is not a lease and comes back in
// `refused` with that sentence; so does a row somebody else holds.
//
// Superadmin only — the literal role check, as the sibling routes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { unassignFromRep } from "@/lib/sales/assignLeads";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can take leads back from a rep" }, { status: 403 });
  }

  const rep = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: { id: true, name: true, email: true, active: true },
  });
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.prospectIds)) {
    return NextResponse.json({ error: "Expected { prospectIds: [...] }." }, { status: 400 });
  }
  const result = await unassignFromRep({ db, rep, admin, ids: body.prospectIds, now: new Date() });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...result });
}
