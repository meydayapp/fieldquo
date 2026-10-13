// app/api/clients/[id]/contacts/[contactId]/route.js
//
// One contact of an organisation client.
//
//   PATCH  — edit it: { name, role, email, phone, notes }; or make it the
//            primary: { action: "make_primary" }. `contactId` "primary" edits
//            the primary that so far exists only as the client's own columns.
//   DELETE — remove the contact (only the contact; never the primary)
//
// Writing the primary writes the client's contactName / email / phone — the
// address every quote and invoice goes to — so it is logged as a client edit
// with the fields named, the same trail PATCH /api/clients/[id] keeps. It is
// the client page's own action, so it reaches every record that carries the
// client, exactly as that page's Edit does (scope "everywhere").
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { updateContact, makePrimary, removeContact } from "@/lib/clients/contacts";

async function logClientColumns(member, clientId, changed) {
  if (!changed?.length) return;
  await recordActivity(member, {
    action: "client.updated",
    entityType: "client",
    entityId: clientId,
    summary: `Changed the primary contact — ${changed.join(", ")}`,
    metadata: { fields: changed, scope: "everywhere", via: "contacts" },
  });
}

// Next 16: params is a Promise.
export async function PATCH(request, { params }) {
  const { id, contactId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_edit", "edit a client's contacts");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const companyId = member.companyId;
  const result =
    body?.action === "make_primary"
      ? await makePrimary(db, { companyId, clientId: id, id: contactId })
      : await updateContact(db, { companyId, clientId: id, id: contactId, body });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await logClientColumns(member, id, result.changedClient);
  return NextResponse.json({ contact: result.contact });
}

export async function DELETE(request, { params }) {
  const { id, contactId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_edit", "edit a client's contacts");
  if (denied) return denied;

  const result = await removeContact(db, { companyId: member.companyId, clientId: id, id: contactId });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });

  await recordActivity(member, {
    action: "client.contact_removed",
    entityType: "client",
    entityId: id,
    summary: "Removed a contact from a client",
    metadata: { contactId: result.removed },
  });
  return NextResponse.json({ ok: true });
}
