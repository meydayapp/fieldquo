// app/api/clients/[id]/business-answer/route.js
//
// "Is <name> a business (a contractor you work for)?" — asked once on the
// quote send dialog (lib/clients/businessQuestion.js says why and when).
//
//   GET   { ask, name } — whether the dialog should ask about this client.
//         False for anyone who could not answer it: the answer edits the
//         client, so it is asked only of someone the client form would let
//         make the same change (clientsProperties: full_edit).
//   POST  { answer: "business" | "individual" } — "business" sets the
//         client's type to company (the email then carries the "Add this
//         price to your own quote" line); either answer stamps
//         businessAskedAt so the question never comes back.
//
// A support session cannot answer: memberOrRefusal applies the read-only
// impersonation gate to every write (non-negotiable #2), and middleware.js
// refuses it first.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { shouldAskIfBusiness, businessAnswerUpdate } from "@/lib/clients/businessQuestion";

const SELECT = { id: true, name: true, type: true, businessAskedAt: true };

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "clientsProperties", "full_edit")) return NextResponse.json({ ask: false });
  const client = await db.client.findFirst({ where: { id, companyId: member.companyId }, select: SELECT });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ask: shouldAskIfBusiness(client), name: client.name });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "clientsProperties", "full_edit")) {
    return NextResponse.json({ error: "You don't have permission to edit clients." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const data = businessAnswerUpdate(body?.answer);
  if (!data) return NextResponse.json({ error: "Choose business or homeowner." }, { status: 400 });

  const client = await db.client.findFirst({ where: { id, companyId: member.companyId }, select: SELECT });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.client.update({ where: { id: client.id }, data, select: SELECT });
  return NextResponse.json({ ok: true, type: updated.type, businessAskedAt: updated.businessAskedAt });
}
