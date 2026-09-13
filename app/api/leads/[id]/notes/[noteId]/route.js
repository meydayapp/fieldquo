// app/api/leads/[id]/notes/[noteId]/route.js
//
// Remove one entry from a lead's call-back log.
//
// This did not exist. The Notes dial's top rung, "View, edit, and delete
// all", promised a power nobody in the product had, which made the rung a
// dead control in the sense AGENTS.md means: an owner could grant it, see it
// saved, and it withheld nothing from the people without it. The rung is
// real from here — this is the one place a note is a row of its own and
// removing it is a distinct act. A client's private notes are a single text
// field, and clearing that is an edit, gated on the rung below.
//
// A hard delete, deliberately, and narrow: a LeadNote is a rep's own line
// ("left a voicemail, trying Tue"), not a document the homeowner saw or a
// record money moved on. The lead it hangs off, and everything else on it, is
// untouched — the lead's own delete is elsewhere and gated on the requests
// ladder's delete rung.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";

export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Two dials, both required: the request has to be one they may change at
  // all, and notes have to be theirs to remove. The requests gate runs first
  // so a member with no requests access learns nothing about whether the
  // lead exists.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "change a request",
  );
  if (denied) return denied;
  try {
    requireLevel(full, "notes", "view_edit_delete_all", "delete notes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Next 16: params is a Promise.
  const { id, noteId } = await params;

  // Scoped through the lead to the caller's company, so a note id from
  // another tenant reads as "doesn't exist" rather than as forbidden — and
  // certainly not as deleted.
  const note = await db.leadNote.findFirst({
    where: { id: noteId, leadId: id, lead: { companyId: member.companyId } },
    select: { id: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.leadNote.delete({ where: { id: note.id } });
  // Removing a note is a touch on the lead, the same as adding one.
  await db.leadRequest.update({ where: { id }, data: { updatedAt: new Date() } });

  return NextResponse.json({ ok: true, id: note.id });
}
