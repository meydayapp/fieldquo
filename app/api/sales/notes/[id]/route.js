// app/api/sales/notes/[id]/route.js
//
// One note: read it, and save it.
//
// ══ Every guard is in the WHERE ════════════════════════════════════════════
//
// Ownership and version both. There is no `findUnique` followed by an `if` —
// see lib/sales/notes/write.js's header for why, and lib/concurrency/
// staleWrite.js's for the general form. A rep asking for a colleague's note
// gets a 404 from a query that never returned it, not a 403 from a check that
// did.
//
// ══ `params` is a Promise ══════════════════════════════════════════════════
//
// Next 16. AGENTS.md failure class #3.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { NOTES_UNAVAILABLE, notesAvailable } from "@/lib/sales/notes/model";
import { VIEWER_REP, noteReaderWhere } from "@/lib/sales/notes/visibility";
import { NOTE_DETAIL_SELECT } from "@/lib/sales/notes/select";
import { normaliseParent, ParentError } from "@/lib/sales/notes/parents";
import { sanitiseBody, sanitiseTitle } from "@/lib/sales/notes/body";
import { parseExpectedVersion, saveNote } from "@/lib/sales/notes/write";
import { VERSION_FIELD } from "@/lib/concurrency/staleWrite";

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const { id } = await params;

  // findFirst, not findUnique: the scope fragment has to be part of the query,
  // and findUnique will not take a non-unique field in its where.
  const note = await db.salesRepNote.findFirst({
    where: { id, ...noteReaderWhere({ kind: VIEWER_REP, salesRepId: rep.id }) },
    select: NOTE_DETAIL_SELECT,
  });

  if (!note) {
    // The same answer for "no such note" and "somebody else's note", on
    // purpose. A 403 here would confirm the note exists, which is the fact the
    // scoping is there to withhold.
    return NextResponse.json({ error: "That note no longer exists." }, { status: 404 });
  }

  return NextResponse.json({ note });
}

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  if (!notesAvailable(db)) {
    return NextResponse.json(NOTES_UNAVAILABLE.body, { status: NOTES_UNAVAILABLE.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  let expected;
  try {
    expected = parseExpectedVersion(body[VERSION_FIELD]);
  } catch (err) {
    // 400, never 409. A version this server cannot read is not evidence that
    // anything was edited — see the checkFuture note in staleWrite.js.
    if (err?.status === 400) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    throw err;
  }

  const data = {};
  // Each field is written only when the caller SENT it. Autosave posts title
  // and body together; the archive button posts neither. Spreading a `title:
  // undefined` would be harmless to Prisma and misleading to read, so the
  // shape says what it means.
  if (typeof body.title === "string") data.title = sanitiseTitle(body.title);
  if (typeof body.body === "string") data.body = sanitiseBody(body.body);

  if ("parentKind" in body || "parentId" in body) {
    try {
      Object.assign(data, normaliseParent(body));
    } catch (err) {
      if (err instanceof ParentError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }
  }

  // Archive and restore, both real, both reversible. Nothing here deletes:
  // a rep's account of a call is the sort of thing somebody wants back three
  // months later, and there is no undo for a DELETE.
  if (body.archived === true) data.archivedAt = new Date();
  if (body.archived === false) data.archivedAt = null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const outcome = await saveNote(db, {
    noteId: id,
    // From the gate, not the body. This is the ownership guard.
    salesRepId: rep.id,
    expected,
    data,
  });

  if (!outcome.ok) {
    return NextResponse.json(outcome.body, { status: outcome.status });
  }

  return NextResponse.json({ note: outcome.note });
}
