// app/api/leads/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  redactLeads,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Authed — the pipeline view for staff
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const temperature = searchParams.get("temperature");
  const source = searchParams.get("source");
  const assignedToId = searchParams.get("assignedToId");
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort"); // "score" | default recent

  // "score" sorts hottest-first (nulls — unscored legacy leads — sink to the
  // bottom), then most recent within a tier. Default stays newest-first.
  const orderBy =
    sort === "score"
      ? [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  const leads = await db.leadRequest.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(temperature && { temperature }),
      ...(source && { source }),
      ...(assignedToId && {
        assignedToId: assignedToId === "unassigned" ? null : assignedToId,
      }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { message: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true, status: true } },
    },
    orderBy,
  });

  // ── Who has asked not to be called ──────────────────────────────────────
  //
  // Shown on the list so a contractor knows BEFORE they pick up the phone.
  // Someone who asked us to stop and then gets rung anyway is the complaint
  // that ends in a regulator, and the person dialling had no way to know.
  //
  // One query for the whole page rather than one per lead: this list can be
  // hundreds long, and N+1 on a page people open all day is how it gets slow.
  const numbers = [...new Set(leads.map((l) => l.phone).filter(Boolean))];
  const optedOut = numbers.length
    ? await db.callConsent.findMany({
        where: { companyId: member.companyId, e164: { in: numbers }, optedOutAt: { not: null } },
        select: { e164: true },
      })
    : [];
  const blocked = new Set(optedOut.map((c) => c.e164));

  // ── The one pipeline stage the redaction sweep never reached ────────────
  //
  // Clients, quotes, invoices, appointments and jobs were all filtered for a
  // member on clientsProperties "name_address_only"; leads were not looked at,
  // because a LeadRequest is not a Client row. It carries the same personal
  // data one step earlier — QA read a real email, a real phone number and a
  // stated budget of 15k_plus straight out of this list — and the pipeline
  // board is a screen a crew member is legitimately shown, so it is the
  // payload that narrows rather than the endpoint that refuses.
  //
  // Note the ORDER: doNotCall is derived from the phone first, then
  // redactLead drops both together. Deriving it after the redaction would
  // silently mark every restricted lead as callable.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(
    redactLeads(
      full,
      leads.map((l) => ({
        ...l,
        doNotCall: Boolean(l.phone && blocked.has(l.phone)),
      })),
    ),
  );
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── Leads ARE the "Requests" category ───────────────────────────────────
  //
  // lib/permissions/nav.js has said so since it was written ("Leads are the
  // requests grid") and hides the quick-add control at view_only. The control
  // was hidden and the endpoint behind it was open: dragging a card across the
  // pipeline board is this PATCH, and a Worker set to "Requests: view only"
  // could move anyone's lead to Lost.
  //
  // Hiding a button is not access control — and of the four grid categories in
  // the Worker presets, requests was the one whose route had no check at all.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "change a request");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 },
    );
  }
  // Same allow-list as the per-lead route — an arbitrary string here would be
  // stored and then silently bucketed into "new" by the board.
  if (!["new", "contacted", "converted", "lost"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.leadRequest.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(updated);
}
