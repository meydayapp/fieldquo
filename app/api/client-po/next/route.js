// app/api/client-po/next/route.js
//
// The "Generate" button beside a client-PO field: the company's next
// PO-<year>-NNNN reference (lib/documents/clientPo.js).
//
// GET, and it writes nothing. The value goes into a text box the person then
// saves with the document — or types over. Reserving a number on a press that
// may never be saved would burn the sequence for nothing; reading the
// company's stored references instead means two people pressing Generate at
// the same moment can be offered the same one, which is harmless for a
// reference that is not unique by nature (the same PO rides on a quote, its
// job and every invoice) and is settled the moment either is saved — the
// next press counts it.
//
// Gated on the document the button sits beside: a member who cannot edit
// that kind of document has no field to fill.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { allocateGeneratedClientPo } from "@/lib/documents/clientPo";

const CATEGORY = { quote: "quotes", job: "jobs", invoice: "invoices" };

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const kind = new URL(request.url).searchParams.get("for");
  const category = CATEGORY[kind];
  if (!category) {
    return NextResponse.json({ error: "Say which document the reference is for: quote, job or invoice." }, { status: 400 });
  }
  const { response: denied } = await levelOrRefusal(member, category, "view_create_edit", "add a PO number");
  if (denied) return denied;

  const value = await allocateGeneratedClientPo(db, { companyId: member.companyId });
  return NextResponse.json({ value });
}
