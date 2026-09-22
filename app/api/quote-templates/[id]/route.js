// app/api/quote-templates/[id]/route.js
//
// PATCH { name } → rename. DELETE → remove the template. Quotes made from it
// are unaffected: they own their own copy of every group.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

async function owned(id, companyId) {
  return db.quoteTemplate.findFirst({ where: { id, companyId }, select: { id: true } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit quote templates");
  if (denied) return denied;
  if (!(await owned(id, member.companyId))) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
  const row = await db.quoteTemplate.update({ where: { id }, data: { name }, select: { id: true, name: true } });
  return NextResponse.json(row);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "edit quote templates");
  if (denied) return denied;
  if (!(await owned(id, member.companyId))) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  await db.quoteTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
