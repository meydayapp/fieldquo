// app/api/client-tickets/[id]/route.js
//
// GET   — one ticket with its thread, the client, the linked job and the
//         people it can be assigned to. Read-only for a support session.
// PATCH — { status?, priority?, assignedToId? } (lib/clientTickets/service.js
//         updateTicket: an assignee must be an active member of THIS company).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ticketMember } from "@/lib/clientTickets/access";
import { staffTicket, updateTicket } from "@/lib/clientTickets/service";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await ticketMember(request, "read");
  if (response) return response;
  const ticket = await staffTicket({ companyId: member.companyId, ticketId: id });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [job, convertedJob, members] = await Promise.all([
    ticket.jobId ? db.job.findFirst({ where: { id: ticket.jobId, companyId: member.companyId }, select: { id: true, title: true } }) : null,
    ticket.convertedJobId ? db.job.findFirst({ where: { id: ticket.convertedJobId, companyId: member.companyId }, select: { id: true, title: true } }) : null,
    db.member.findMany({
      where: { companyId: member.companyId, active: true },
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);
  return NextResponse.json({
    ticket,
    job,
    convertedJob,
    assignees: members.filter((m) => m.userId).map((m) => ({ userId: m.userId, name: m.user?.name || "" })),
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await ticketMember(request, "work");
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const patch = {};
  for (const k of ["status", "priority", "assignedToId"]) if (k in (body || {})) patch[k] = body[k];
  const result = await updateTicket({ member, ticketId: id, patch });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ticket: result.ticket });
}
