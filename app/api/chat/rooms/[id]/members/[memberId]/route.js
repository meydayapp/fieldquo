// app/api/chat/rooms/[id]/members/[memberId]/route.js
//
// Take somebody out of a channel or group. The row is CLOSED — never deleted
// — so their messages stay attributed to them. A channel's managers may
// remove people; in a group, its maker or an owner/admin in it. Removing
// yourself is leaving, with leaving's rules (lib/company/chat/store.js
// removeMember).
//
// DELETE → { ok }   codes: no_room | read_only | fixed_room | not_allowed |
//                          not_member | auto_join
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { removeMember } from "@/lib/company/chat/store";

export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id, memberId } = await params;
  const done = await removeMember(member, id, memberId);
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true });
}
