// app/api/platform/sales/reps/count/route.js
//
// How many sales reps are still waiting for a phone number and a work
// mailbox — the sidebar badge beside "Sales reps".
//
// ══ Why this replaced an error-log row ════════════════════════════════════
//
// Until 2026-09-22 an agency adding a rep (lib/sales/agency.js) and a
// superadmin moving one under an agency (the rep PATCH) each wrote a
// PlatformErrorLog row: "Daniel now works for Muhammad Ali. Assign a phone
// number and a work mailbox on /platform/sales/reps." That is a to-do, not an
// error — it sat on /platform/errors next to refused webhooks and rejected
// credentials, it had to be resolved by hand, and it stayed red after the
// number and the mailbox arrived because nothing cleared it.
//
// The count is DERIVED instead, from exactly what the list route already
// calls `needsSetup`: SalesRep.setupRequestedAt set, and setupComplete() —
// a work mailbox and at least one number — not yet true. So it clears itself
// the moment both are assigned, by the same clearSetupIfComplete() the
// assignment routes already call, with no second mechanism to keep in step.
//
// The audit trail is untouched: the agency's own `sales_rep_invited` entry
// and the superadmin's `sales_rep_agency_linked` entry are PlatformAuditLog
// rows and stay exactly as they were. What stopped being written is the
// error.
//
// Shaped after /api/platform/sales/review/count: `{ count }`, and `null`
// rather than a 403 for an admin who may not see reps — the rail asks on
// every navigation and no badge is the honest answer.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { setupComplete } from "@/lib/sales/agency";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The reps list itself is superadmin-only (app/api/platform/sales/reps),
  // and a badge for a screen the reader cannot open would be a dead control.
  if (admin.role !== "superadmin") return NextResponse.json({ count: null });

  // The flagged rows only — a handful, ever — then setupComplete() per row,
  // because "has a number" is a relation count and not a column. Counting in
  // SQL would mean a second definition of "set up" that could drift from the
  // one the list and clearSetupIfComplete() share.
  const rows = await db.salesRep
    .findMany({
      where: { setupRequestedAt: { not: null }, active: true },
      select: { id: true, workEmail: true, _count: { select: { phoneNumbers: true } } },
    })
    .catch((err) => {
      console.error("[platform sales reps count]", err?.message || err);
      return null;
    });
  // Null, not 0: "we could not look" is not "nobody is waiting", and a zero
  // here would quietly retire a badge that should be showing.
  if (rows === null) return NextResponse.json({ count: null });

  return NextResponse.json({ count: rows.filter((r) => !setupComplete(r)).length });
}
