// app/api/client-tickets/route.js
//
// GET — the office's queue of client tickets (lib/clientTickets/service.js).
//   ?status=open (default: open + in progress + waiting on client) | all |
//           one of TICKET_STATUSES
//   ?clientId= / ?jobId=   narrow to one client or job
//   ?count=1               just { open } — the badge on a client or job page
//
// Company-scoped by the session; never another company's row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ticketMember } from "@/lib/clientTickets/access";
import { OPEN_STATUSES, TICKET_STATUSES } from "@/lib/clientTickets/rules";

export async function GET(request) {
  const { member, response } = await ticketMember(request, "read");
  if (response) return response;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "open";
  const clientId = url.searchParams.get("clientId") || undefined;
  const jobId = url.searchParams.get("jobId") || undefined;
  const scope = { companyId: member.companyId, ...(clientId ? { clientId } : {}), ...(jobId ? { jobId } : {}) };

  if (url.searchParams.get("count") === "1") {
    const open = await db.clientTicket.count({ where: { ...scope, status: { in: OPEN_STATUSES } } });
    return NextResponse.json({ open });
  }

  // "open" is the GROUP — open, in progress and waiting on client — as the
  // header says and as the queue's Open tab counts it (its badge sums those
  // three from `counts`). Read as the single status it also names, the tab
  // listed only untouched tickets under a badge counting all three, and a
  // ticket somebody had replied to vanished from the default view.
  const statusWhere =
    status === "all"
      ? {}
      : status !== "open" && TICKET_STATUSES.includes(status)
        ? { status }
        : { status: { in: OPEN_STATUSES } };
  const [rows, grouped] = await Promise.all([
    db.clientTicket.findMany({
      where: { ...scope, ...statusWhere },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        subject: true,
        status: true,
        priority: true,
        assignedToId: true,
        jobId: true,
        convertedJobId: true,
        createdAt: true,
        updatedAt: true,
        firstResponseAt: true,
        client: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.clientTicket.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);
  const userIds = [...new Set(rows.map((r) => r.assignedToId).filter(Boolean))];
  const users = userIds.length
    ? await db.member.findMany({
        where: { companyId: member.companyId, userId: { in: userIds } },
        select: { userId: true, user: { select: { name: true } } },
      })
    : [];
  const nameOf = new Map(users.map((u) => [u.userId, u.user?.name || ""]));
  return NextResponse.json({
    tickets: rows.map((r) => ({ ...r, assignee: r.assignedToId ? nameOf.get(r.assignedToId) || null : null })),
    counts: Object.fromEntries(grouped.map((g) => [g.status, g._count])),
  });
}
