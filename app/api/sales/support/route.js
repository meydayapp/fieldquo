// app/api/sales/support/route.js
//
// A sales rep escalates a technical problem to FieldQuo tech support, and sees
// what happened to the ones they already raised.
//
// ══ The gate, and why it is this one ═══════════════════════════════════════
//
// requireOutreachRep, not requireSalesRep. lib/sales/gate.js refuses every
// non-GET under /api/sales because commission is paid on events a rep is close
// to — a rep who can write their own attribution or ledger can pay themselves.
// A support ticket decides no money: it moves no milestone, mints no commission
// entry, and writes nothing into the company's own records. It belongs beside
// the rep's leads and notes, which is exactly what outreachGate.js is for, and
// `supportTicket` / `supportTicketNote` are named in REP_OUTREACH_WRITES so the
// writable list stays a list rather than a habit.
//
// ══ Scope is re-read from the database in the request that writes ══════════
//
// Twice, deliberately, and the two halves are different in kind:
//
//   1. the Company query is narrowed by assignedCompanyWhere(rep.id) — the
//      same fragment /api/sales/companies uses, so the screen cannot offer a
//      company the write would refuse;
//   2. decideEscalation() re-checks the attribution ON THE ROW ITSELF, and it
//      is the half that is executed against hostile input in
//      scripts/check-support-escalation.mjs.
//
// The `companyId` in the body is a request, never a grant. Nothing here trusts
// a rep id, an attribution or a status that arrived from a browser.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { assignedCompanyWhere } from "@/lib/sales/scope";
import {
  SUPPORT_STATUSES,
  assignedAdminFor,
  decideEscalation,
  repStatusLine,
  repVisibleNotes,
} from "@/lib/support/escalation";

/** The columns a rep may read back off their own ticket. */
const TICKET_SELECT = {
  id: true,
  subject: true,
  body: true,
  status: true,
  priority: true,
  assignedAdminId: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  company: { select: { id: true, name: true } },
  notes: {
    // `internal` is selected so repVisibleNotes can filter on it, and dropped
    // again in shapeTicket below — a flag that reached the browser would be an
    // invitation to render it.
    select: {
      id: true,
      kind: true,
      authorKind: true,
      body: true,
      internal: true,
      createdAt: true,
      authorAdmin: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
};

function shapeTicket(row) {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    status: row.status,
    priority: row.priority,
    // The id itself is of no use to a rep; whether anybody holds this is.
    assigned: Boolean(row.assignedAdminId),
    assignedAdminId: row.assignedAdminId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    company: row.company,
    statusLine: repStatusLine(row),
    notes: repVisibleNotes(row.notes || []).map((n) => ({
      id: n.id,
      kind: n.kind,
      authorKind: n.authorKind,
      // The admin's own address, not "FieldQuo support" — a rep chasing a
      // ticket needs to know who to chase.
      authorLabel: n.authorKind === "admin" ? n.authorAdmin?.email || "FieldQuo support" : "You",
      body: n.body,
      createdAt: n.createdAt,
    })),
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  // Refused rather than ignored: a filter that silently does nothing renders a
  // list that contradicts the control above it.
  if (status && !SUPPORT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const where = { salesRepId: rep.id, ...(status ? { status } : {}) };

  const [rows, counts] = await Promise.all([
    db.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: TICKET_SELECT,
    }),
    // Counted over the rep's OWN tickets, not the queue — the same where minus
    // the status filter, so the tab badges cannot disagree with the list.
    db.supportTicket.groupBy({
      by: ["status"],
      where: { salesRepId: rep.id },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    tickets: rows.map(shapeTicket),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";

  // First half of the boundary: the query itself can only ever return a company
  // in this rep's book. A foreign id comes back null and is refused below with
  // the same sentence a non-existent one gets.
  const company = companyId
    ? await db.company.findFirst({
        where: { id: companyId, ...assignedCompanyWhere(rep.id) },
        select: {
          id: true,
          name: true,
          // Read so the pure decision can re-check it rather than inherit the
          // query's word for it. See decideEscalation's header.
          salesAttribution: { select: { salesRepId: true } },
        },
      })
    : null;

  const decision = decideEscalation({
    rep,
    company,
    subject: body.subject,
    body: body.body,
    priority: body.priority,
  });
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, code: decision.code },
      { status: decision.status },
    );
  }

  // ── Who it lands on: looked up, never typed ──────────────────────────────
  //
  // The owner's brief names Emilio. This finds him by ROLE — the first active
  // superadmin — because a hard-coded PlatformAdmin id is wrong the day a
  // second admin exists or the database is reseeded, and wrong silently.
  const admins = await db.platformAdmin.findMany({
    where: { role: "superadmin", active: true },
    select: { id: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const { adminId } = assignedAdminFor(admins);

  const ticket = await db.supportTicket.create({
    data: { ...decision.ticket, assignedAdminId: adminId },
    select: TICKET_SELECT,
  });

  return NextResponse.json({ ticket: shapeTicket(ticket) }, { status: 201 });
}
