// app/api/chat/rooms/[id]/me/route.js
//
// YOUR settings for one conversation, and nobody else's: what you are
// notified about, a snooze, hiding a DM or group from your list, starring it.
// Read back by the room list and the Chat tab's digit (lib/company/chat/
// rules.js effectiveNotify / badgeCounts / isHidden) and by the push
// fan-out (notifyVerdict).
//
// PATCH { notify?: "default"|"all"|"mentions"|"none",
//         mutedUntil?: <iso in the next year> | null,
//         hidden?: boolean, starred?: boolean } → { ok }
//   codes: no_room | read_only | bad_setting | fixed_room
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { updateMySubscription } from "@/lib/company/chat/store";

export async function PATCH(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const patch = {};
  for (const key of ["notify", "mutedUntil", "hidden", "starred"]) {
    if (body && Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
  }
  const done = await updateMySubscription(member, id, patch);
  if (!done.ok) return NextResponse.json({ error: done.error, code: done.code }, { status: done.status });
  return NextResponse.json({ ok: true });
}
