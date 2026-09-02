// app/api/sales/leads/[id]/route.js
//
// One prospect, with every conversation FieldQuo holds about them.
//
// The whole thread history comes back with the lead rather than behind a second
// fetch: this is the screen where a rep decides what to write next, and a
// conversation split across two round trips is a conversation that renders half
// empty on a bad connection.
//
// `params` is a Promise — Next 16. Awaited, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import {
  isLeadStatus,
  isPlausibleEmail,
  leadOptedOut,
  leadWhere,
  sanitiseHeaderText,
} from "@/lib/sales/outreach";

/** The shape both handlers return, so the screen never sees two versions of a lead. */
const LEAD_SELECT = {
  id: true,
  businessName: true,
  contactName: true,
  email: true,
  phone: true,
  status: true,
  notes: true,
  convertedCompanyId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  threads: {
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      createdAt: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          body: true,
          sentAt: true,
        },
      },
    },
  },
};

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: LEAD_SELECT,
  });

  // 404 rather than 403 for another rep's lead. Telling a caller that a row
  // exists but is not theirs confirms the row exists — the same reason
  // lib/sales/gate.js gives 401 for three different failures.
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const inbound = lead.threads.flatMap((t) => t.messages).filter((m) => m.direction === "in");

  return NextResponse.json({
    lead,
    // Recomputed from the messages every time — see leadOptedOut's note on why
    // this is derived rather than stored.
    optedOut: leadOptedOut(inbound),
    outreach: await outreachStatus(rep),
  });
}

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const data = {};

  if (body.businessName !== undefined) {
    const businessName = sanitiseHeaderText(body.businessName, 200);
    if (!businessName) {
      return NextResponse.json({ error: "A business name is required." }, { status: 400 });
    }
    data.businessName = businessName;
  }
  if (body.contactName !== undefined) {
    data.contactName = sanitiseHeaderText(body.contactName, 200) || null;
  }
  if (body.phone !== undefined) data.phone = sanitiseHeaderText(body.phone, 40) || null;
  if (body.notes !== undefined) {
    data.notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : null;
  }
  if (body.email !== undefined) {
    const email = sanitiseHeaderText(body.email, 254).toLowerCase();
    if (email && !isPlausibleEmail(email)) {
      return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
    }
    data.email = email || null;
  }
  if (body.status !== undefined) {
    if (!isLeadStatus(body.status)) {
      return NextResponse.json({ error: "That isn't a pipeline status." }, { status: 400 });
    }
    data.status = body.status;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  // updateMany, not update: `update` takes a unique where, which would mean
  // looking the row up by id alone and checking the rep afterwards. Two steps,
  // and the window between them is where a scoping bug lives. This writes only
  // rows that satisfy BOTH halves, and a count of 0 is the refusal.
  const { count } = await db.salesLead.updateMany({
    where: leadWhere(rep.id, id),
    data,
  });
  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: LEAD_SELECT,
  });
  return NextResponse.json({ lead });
}
