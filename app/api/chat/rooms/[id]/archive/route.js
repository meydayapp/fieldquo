// app/api/chat/rooms/[id]/archive/route.js
//
// Archive a channel, or bring it back. Archived is READ-ONLY and KEPT —
// listed under Archived with every word in it; nothing is deleted, ever
// (lib/company/chat/store.js archiveRoom). Channels only, and only for the
// people rules.js canArchive names: an owner or admin in it, or a supervisor
// who manages it.
//
// POST   → { ok }   archive
// DELETE → { ok }   unarchive
//   codes: no_room | read_only | fixed_room | not_allowed
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { archiveRoom } from "@/lib/company/chat/store";

async function run(request, params, archive) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const done = await archiveRoom(member, id, { archive });
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true, unchanged: Boolean(done.unchanged) });
}

export async function POST(request, { params }) {
  return run(request, params, true);
}

export async function DELETE(request, { params }) {
  return run(request, params, false);
}
