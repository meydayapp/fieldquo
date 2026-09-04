// app/api/sales/notes/route.js
//
// A rep's own notes: the list, and starting a new one.
//
// ══ Scoped by salesRepId, from the session, every request ══════════════════
//
// Same argument app/api/sales/leads/route.js makes and for the same reason:
// there is no outer tenant boundary behind this, so the salesRepId in the
// where clause IS the boundary. It comes from the gate's fresh read of the
// SalesRep row, never from the query string or the body — a salesRepId a
// client could name is a client that can read a colleague's notes.
//
// The fragment is built by noteReaderWhere() rather than written here, so it
// cannot be written slightly differently in the next route, and it never
// collapses to `{}` for a caller it could not identify.
//
// ══ The table may not exist yet ════════════════════════════════════════════
//
// SalesRepNote is not in prisma/schema.prisma — see lib/sales/notes/model.js
// for why this was built against a named interface instead. Every handler
// checks notesAvailable() FIRST and answers 503 with the reason, because
// `db.salesRepNote.findMany` on an ungenerated model is a TypeError and a 500
// tells the rep nothing about what to do.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { NOTES_UNAVAILABLE, notesAvailable } from "@/lib/sales/notes/model";
import { VIEWER_REP, noteReaderWhere } from "@/lib/sales/notes/visibility";
import { NOTE_LIST_SELECT, previewRow } from "@/lib/sales/notes/select";
import { normaliseParent, ParentError } from "@/lib/sales/notes/parents";
import { BODY_FORMAT_TEXT, sanitiseBody, sanitiseTitle } from "@/lib/sales/notes/body";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const { searchParams } = new URL(request.url);
  // Archived notes are hidden by default and reachable on purpose. A note that
  // vanishes with no way back is a delete wearing a gentler label.
  const archived = searchParams.get("archived") === "1";

  // ── Narrowing to one prospect, and why that is not a widening ────────────
  //
  // The queue console keeps a rep's notes about the prospect they are looking
  // at in the pane beside them, rather than a screen away. Without this it
  // would have to pull all 500 rows and filter in the browser, which is a
  // silent lie the day a rep has 501 notes — the older ones about THIS
  // prospect would simply not be in the payload and the pane would say there
  // were none.
  //
  // It reads no scope of its own: noteReaderWhere() is still the boundary and
  // is still built from the gate's fresh session read, so this can only ever
  // narrow a rep's own notes. A prospectId naming somebody else's prospect
  // returns an empty list, which is the same answer as a prospect with no
  // notes — nothing here confirms a row exists, and nothing here lets a rep
  // read the pool.
  const prospectId = (searchParams.get("prospectId") || "").trim().slice(0, 40);

  const notes = await db.salesRepNote.findMany({
    where: {
      ...noteReaderWhere({ kind: VIEWER_REP, salesRepId: rep.id }),
      archivedAt: archived ? { not: null } : null,
      ...(prospectId ? { prospectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: NOTE_LIST_SELECT,
  });

  // The sentence a rep is shown about who can read this is NOT sent from
  // here. app/components/sales/RepNoteVisibilityNotice.js imports
  // VISIBILITY_NOTICE straight from lib/sales/notes/visibility.js, so it
  // renders even when this fetch fails — a notice that can go missing on a bad
  // connection is exactly the promise this feature must not break.
  return NextResponse.json({
    // Truncated here rather than in the select because Prisma cannot slice a
    // string server-side. The rows still travel whole from Postgres; what this
    // saves is the wire and the browser, not the query.
    notes: notes.map(previewRow),
    archivedCount: await db.salesRepNote.count({
      where: {
        ...noteReaderWhere({ kind: VIEWER_REP, salesRepId: rep.id }),
        archivedAt: { not: null },
      },
    }),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  let parent;
  try {
    parent = normaliseParent(body);
  } catch (err) {
    if (err instanceof ParentError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }

  // A note with no title and no body is legitimate: the rep pressed "New note"
  // and is about to type. Refusing it would mean the first keystroke has to
  // create the row, which is the race autosave exists to avoid.
  const note = await db.salesRepNote.create({
    data: {
      // From the gate's fresh session read, never from the body.
      salesRepId: rep.id,
      title: sanitiseTitle(body.title),
      body: sanitiseBody(body.body),
      bodyFormat: BODY_FORMAT_TEXT,
      ...parent,
    },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({ note }, { status: 201 });
}
