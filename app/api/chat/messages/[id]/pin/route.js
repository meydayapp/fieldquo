// app/api/chat/messages/[id]/pin/route.js
//
// Pin a message to its room's pinned bar, or take it off.
//
// POST   → { ok } pin       DELETE → { ok } unpin
//
// Who may (lib/company/chat/rules.js canPin, owner decisions 2026-10-04):
// the office in any room they are in, a channel's or group's manager in
// their room, and anybody in a DM or a group. A system line in the room
// says who did it. Codes: no_message | read_only | not_allowed | archived |
// too_many_pins
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { pinMessage } from "@/lib/company/chat/store";

const refused = (r) => NextResponse.json({ error: r.error, code: r.code }, { status: r.status });

async function handle(request, params, pin) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const done = await pinMessage(member, id, { pin });
  if (!done.ok) return refused(done);
  return NextResponse.json({ ok: true, unchanged: Boolean(done.unchanged) });
}

export async function POST(request, { params }) {
  return handle(request, params, true);
}

export async function DELETE(request, { params }) {
  return handle(request, params, false);
}
