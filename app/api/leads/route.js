// app/api/leads/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  loadEnforceableMember,
  requireLevel,
  redactLeads,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { isValidLeadStatus, canSetLeadStatus, isValidLostReason } from "@/lib/leads/pipeline";

// Authed — the pipeline view for staff
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Leads ARE the requests grid. The board used to be a screen every crew
  // member was shown, redacted rather than refused, because view_only was the
  // bottom of the ladder. It no longer is: somebody set to No access is
  // refused the board entirely.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;

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
  // pipeline board is this PATCH — the leads board now actually does that,
  // with @dnd-kit — and a Worker set to "Requests: view only" could move
  // anyone's lead to Lost.
  //
  // Hiding a button is not access control — and of the four grid categories in
  // the Worker presets, requests was the one whose route had no check at all.
  // The drag handler on the client checks the SAME rule below before it ever
  // sends a request (so a refused drop never leaves the network), but this is
  // the gate that actually matters: it runs independently of whatever the
  // client chose to check, or skipped.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "change a request");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id, status, lostReason } = await request.json();
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 },
    );
  }
  // Same allow-list as the per-lead route — an arbitrary string here would be
  // stored and then silently bucketed into "new" by the board.
  if (!isValidLeadStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (lostReason !== undefined && lostReason !== null && !isValidLostReason(lostReason)) {
    return NextResponse.json({ error: "Invalid lost reason" }, { status: 400 });
  }

  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // "Converted" is Won, and nothing may land there on nothing but the enum
  // being poked — see lib/leads/pipeline.js. This is what makes a drag drop
  // onto the Converted column an honest refusal rather than a lead marked Won
  // with no quote behind it, and it applies to the drawer's own status button
  // exactly the same way, for the exact same reason. The "lost" branch of the
  // same function is what makes a drag drop onto Lost require a real reason
  // rather than accepting a bare status flip.
  const statusCheck = canSetLeadStatus(existing, status, { lostReason });
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.reason }, { status: 409 });
  }

  const updated = await db.leadRequest.update({
    where: { id },
    data: {
      status,
      // See app/api/leads/[id]/route.js's PATCH for why this clears outside
      // "lost" rather than only ever being set.
      lostReason: status === "lost" ? (lostReason ?? existing.lostReason) : null,
    },
  });
  return NextResponse.json(updated);
}
