// app/api/chat/messages/[id]/route.js
//
// One message in the company's team chat.
//
// GET    → { roomId, messageId } — where it lives. The bell's "Ana mentioned
//          you in #estimating" row opens /app/chat?message=<id>, and the page
//          asks this route which room to open. Answers only for a member who
//          can read that room NOW (store.js locateMessage): a room they have
//          since left, a private channel they were never in, or another
//          company's message is 404.
// PATCH { body } → { ok, message: { id, editedAt } } — edit YOUR message,
//          within 15 minutes of sending it (rules.js EDIT_WINDOW_MS, the
//          server's clock). Codes: no_message | read_only | not_author |
//          too_late | archived | office_only | empty
// DELETE → { ok } — remove it. Your own any time; somebody else's only in a
//          channel you manage. SOFT: the row stays, the words are gone from
//          every screen for everybody, the owner included (owner decision
//          2026-10-04). Codes: no_message | read_only | not_allowed | archived
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { locateMessage, editMessage, removeMessage } from "@/lib/company/chat/store";

const refused = (r) => NextResponse.json({ error: r.error, code: r.code }, { status: r.status });

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const found = await locateMessage(member, id);
  if (!found) return NextResponse.json({ error: "No such message.", code: "no_room" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PATCH(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const done = await editMessage(member, id, body?.body);
  if (!done.ok) return refused(done);
  return NextResponse.json({ ok: true, unchanged: Boolean(done.unchanged), message: done.message || null });
}

export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { id } = await params;
  const done = await removeMessage(member, id);
  if (!done.ok) return refused(done);
  return NextResponse.json({ ok: true, unchanged: Boolean(done.unchanged) });
}
