// app/api/platform/sales/notes/[id]/route.js
//
// One rep's note, read whole by a superadmin.
//
// Separate from the listing because the listing truncates (see
// LIST_BODY_PREVIEW) and a manager reading a note needs all of it. The gate is
// the same one, imported rather than re-derived — two copies of an
// authorisation rule is two rules that can disagree, and the shape of the
// disagreement is somebody's notes on a screen.
//
// GET only. There is no write path to a rep's note from the platform console,
// by design — see the sibling route's header.
//
// `params` is a Promise. Next 16, AGENTS.md failure class #3.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNoteReader } from "@/lib/sales/notes/platformGate";
import { NOTES_UNAVAILABLE, notesAvailable } from "@/lib/sales/notes/model";
import { canReadNote, noteReaderWhere } from "@/lib/sales/notes/visibility";
import { PLATFORM_NOTE_SELECT } from "@/lib/sales/notes/select";

export async function GET(request, { params }) {
  const { viewer, refusal } = await requireNoteReader(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const { id } = await params;

  const note = await db.salesRepNote.findFirst({
    where: { id, ...noteReaderWhere(viewer) },
    select: PLATFORM_NOTE_SELECT,
  });

  if (!note) {
    return NextResponse.json({ error: "That note no longer exists." }, { status: 404 });
  }

  // Belt and braces, deliberately. noteReaderWhere already scoped the query,
  // and canReadNote asks the same question of the row that came back. The two
  // are the same rule reached by different routes — the reasoning
  // lib/currentMember.js's assertReadOnly gives for duplicating middleware's
  // impersonation gate: "the whole reason it exists is that it must not agree
  // with the first by copying it." If a future edit widens the fragment, this
  // is what still says no.
  if (!canReadNote(viewer, note)) {
    return NextResponse.json({ error: "That note no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ note });
}
