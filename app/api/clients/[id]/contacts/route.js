// app/api/clients/[id]/contacts/route.js
//
// The people at an organisation client — the Organization card on the client
// page, and the recipient picker on the quote and invoice send screens.
//
//   GET  — the list, primary first (lib/clients/contacts.js contactEntries)
//   POST — add one
//   PUT  — reorder the non-primary ones: { ids: [...] }
//
// Reading is clientsProperties "full_view" — names, emails and phones are the
// contact details "name_address_only" exists to withhold (the same level
// GET /api/clients/[id] keeps `contacts` behind, via redactClient). Writing is
// "full_edit", the level the client's own edit form asks.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { listContacts, createContact, reorderContacts } from "@/lib/clients/contacts";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_view", "see a client's contacts");
  if (denied) return denied;

  const listed = await listContacts(db, { companyId: member.companyId, clientId: id });
  if (!listed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ type: listed.client.type, contacts: listed.entries });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_edit", "edit a client's contacts");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const result = await createContact(db, { companyId: member.companyId, clientId: id, body });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  // Which contact, not its details: the trail is readable by everyone who can
  // read it, and a client's people do not need republishing there.
  await recordActivity(member, {
    action: "client.contact_added",
    entityType: "client",
    entityId: id,
    summary: `Added a contact (${result.contact.role || "no role"}) to a client`,
    metadata: { contactId: result.contact.id },
  });
  return NextResponse.json({ contact: result.contact }, { status: 201 });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_edit", "edit a client's contacts");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const result = await reorderContacts(db, { companyId: member.companyId, clientId: id, ids: body?.ids });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
