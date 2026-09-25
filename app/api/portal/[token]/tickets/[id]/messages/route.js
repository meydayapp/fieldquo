// app/api/portal/[token]/tickets/[id]/messages/route.js
//
// The client replies on one of their own tickets. The ticket is found under
// the token's client AND company (lib/clientTickets/service.js clientReply):
// another household's ticket id answers 404 exactly like an unknown one. A
// reply reopens a ticket the office marked resolved or waiting on the client;
// a CLOSED ticket takes no replies (409) — a new issue is a new ticket.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { clientReply, emailOffice } from "@/lib/clientTickets/service";

export async function POST(request, { params }) {
  const limited = rateLimit(request, "portal-ticket-reply", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: `params` is a Promise.
  const { token, id } = await params;
  const client = await db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { id: true, companyId: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const result = await clientReply({ client, ticketId: id, body: body?.body, photos: body?.photos });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  after(() => emailOffice({ ticket: result.ticket, client, kind: "replied", text: result.notice.text, request }));
  return NextResponse.json({ ok: true }, { status: 201 });
}
