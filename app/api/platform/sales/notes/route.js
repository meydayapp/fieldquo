// app/api/platform/sales/notes/route.js
//
// Reading the sales team's notes. Superadmin only, read-only, and the whole
// surveillance surface is this file and its [id] sibling.
//
// The gate is lib/sales/notes/platformGate.js — who may read, and why it is
// superadmin rather than a platform permission, is written down there.
//
// ══ There is no manager tier, and that is stated, not hidden ═══════════════
//
// The owner asked to see notes "vertically" — a superadmin over all, a manager
// over their own reps. SalesRep carries no reporting line at all (Worker does,
// via managerId, but a Worker is a contractor's employee inside a tenant and a
// SalesRep is not one). Building the manager half would mean inventing an org
// chart, so it is not built, and PLATFORM_NOTICE says so on the screen rather
// than leaving its absence to be discovered.
//
// ══ Read-only means no write handler exists ════════════════════════════════
//
// Not a disabled button, not a 403 branch — no POST, no PATCH, no DELETE in
// this file or its sibling. Non-negotiable #3's shape applied to FieldQuo's
// own staff: a note a manager can silently rewrite is not a record of what the
// rep heard.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNoteReader } from "@/lib/sales/notes/platformGate";
import { NOTES_UNAVAILABLE, notesAvailable } from "@/lib/sales/notes/model";
import { noteReaderWhere } from "@/lib/sales/notes/visibility";
import { PLATFORM_NOTE_SELECT, previewRow } from "@/lib/sales/notes/select";

export async function GET(request) {
  const { viewer, refusal } = await requireNoteReader(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("repId");
  const archived = searchParams.get("archived") === "1";

  const notes = await db.salesRepNote.findMany({
    where: {
      ...noteReaderWhere(viewer),
      ...(repId ? { salesRepId: repId } : {}),
      archivedAt: archived ? { not: null } : null,
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: PLATFORM_NOTE_SELECT,
  });

  // The rep filter's options, read from SalesRep rather than derived from the
  // notes — so a rep who has written nothing appears with a zero rather than
  // vanishing. "This rep takes no notes" is a real answer to the question this
  // screen exists to ask, and a list built out of the notes cannot give it.
  const reps = await db.salesRep.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, active: true },
  });

  const counts = await db.salesRepNote.groupBy({
    by: ["salesRepId"],
    where: { archivedAt: null },
    _count: { _all: true },
  });

  return NextResponse.json({
    // Truncated on the way out. This screen pulls every rep's notes, so the
    // body of every one of them is a lot of somebody else's personal
    // information travelling for a list of titles.
    notes: notes.map(previewRow),
    reps,
    counts: Object.fromEntries(counts.map((c) => [c.salesRepId, c._count._all])),
  });
}
