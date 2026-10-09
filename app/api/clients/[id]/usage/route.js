// app/api/clients/[id]/usage/route.js
//
// GET — every OTHER record that carries this client, for the sentence a
// document's builder shows before "Edit this client's details everywhere":
// "This client is on 3 other records: Q-2026-0022, INV-2026-0022, Job: …".
//
// `?exceptQuote=` / `?exceptInvoice=` name the document the edit was opened
// from, which is not "another" record. The same loader the PATCH guard uses
// (lib/clients/editScope.js), so the number the person confirms is the number
// the server would have refused over.
//
// Behind the same rung as the edit itself (clientsProperties: full_edit): the
// list exists only to inform an edit, and a member who cannot make it has no
// reason to enumerate a household's documents through it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { loadClientUsage, usageItems, usageLabels, usageSentence } from "@/lib/clients/editScope";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_edit", "edit clients");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const usage = await loadClientUsage(db, {
    companyId: member.companyId,
    clientId: id,
    exceptQuoteId: url.searchParams.get("exceptQuote") || null,
    exceptInvoiceId: url.searchParams.get("exceptInvoice") || null,
  });

  return NextResponse.json({
    count: usage.count,
    records: usageLabels(usage),
    items: usageItems(usage),
    sentence: usageSentence(usage),
  });
}
