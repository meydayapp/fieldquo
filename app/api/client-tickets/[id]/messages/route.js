// app/api/client-tickets/[id]/messages/route.js
//
// POST { body } — the office replies. The client is emailed from the company,
// in their language, with their portal link (lib/clientTickets/service.js
// staffReply); the answer says whether that email went, so the screen can say
// so rather than let a reply nobody received look delivered.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ticketMember } from "@/lib/clientTickets/access";
import { staffReply } from "@/lib/clientTickets/service";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await ticketMember(request, "work");
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const result = await staffReply({ member, ticketId: id, body: body?.body, request });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ok: true, emailed: result.emailed }, { status: 201 });
}
