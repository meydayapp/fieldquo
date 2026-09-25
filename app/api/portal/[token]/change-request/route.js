// app/api/portal/[token]/change-request/route.js
//
// "Request to reschedule" (any upcoming visit or appointment) and "Skip this
// visit" (one date of a service plan), from the client portal.
//
// Files a client ticket (type "reschedule") for the office and nothing else —
// see lib/portal/changeRequest.js for why a ticket, and why nothing moves
// until the company moves it. The browser names WHICH visit and WHAT it wants; it never sends a
// date to move to, and every id is re-found under this client and this
// client's company before anything is written.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { parseChangeRequest } from "@/lib/portal/view";
import { fileChangeRequest } from "@/lib/portal/changeRequest";
import { emailOffice } from "@/lib/clientTickets/service";

export async function POST(request, { params }) {
  // A token-only endpoint that writes to the office's list: throttled like
  // every other public POST, so a leaked link cannot flood the ticket queue.
  const limited = rateLimit(request, "portal-change-request", { limit: 10, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;
  const client = await db.client.findUnique({
    where: { portalToken: String(token || "") },
    select: { id: true, companyId: true, name: true, language: true },
  });
  if (!client) return NextResponse.json({ error: "Portal link not found" }, { status: 404 });

  const parsed = parseChangeRequest(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await fileChangeRequest({ client, request: parsed.value });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  // The office's email, after the answer — a slow mail server must not keep
  // the client's button spinning.
  if (result.ticket) {
    after(() => emailOffice({ ticket: result.ticket, client, kind: result.notice.kind, text: result.notice.text, request }));
  }
  return NextResponse.json({ ok: true, alreadyRequested: Boolean(result.alreadyRequested) }, { status: 201 });
}
