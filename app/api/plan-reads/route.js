// app/api/plan-reads/route.js
//
// "Start from drawings": POST creates an empty drawing read (free — nothing
// is read or charged until its own Run), optionally tied to a lead or a
// client; GET lists the company's recent ones.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";

const clip = (s, n) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see drawing reads");
  if (denied) return denied;
  const reads = await db.planRead.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, status: true, quoteId: true, leadId: true, createdAt: true, readAt: true },
  });
  return NextResponse.json({ reads });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "start a quote from drawings");
  if (denied) return denied;

  const raw = await request.json().catch(() => ({}));

  // A lead or client named by the browser must be THIS company's. Looked up,
  // never trusted.
  let leadId = null;
  let clientId = null;
  let title = clip(raw?.title, 120);
  if (raw?.leadId) {
    const lead = await db.leadRequest.findFirst({
      where: { id: String(raw.leadId), companyId: member.companyId },
      select: { id: true, name: true, message: true },
    });
    if (!lead) return NextResponse.json({ error: "That lead isn't in your company." }, { status: 404 });
    leadId = lead.id;
    if (!title) title = clip(lead.name, 120);
    // What the lead asked for is the obvious first draft of what the client
    // wants — the estimator edits it on the read's page.
    if (!clip(raw?.clientRequest, 10) && lead.message) raw.clientRequest = lead.message;
  }
  if (!clientId && raw?.clientId) {
    const client = await db.client.findFirst({ where: { id: String(raw.clientId), companyId: member.companyId }, select: { id: true, name: true } });
    if (!client) return NextResponse.json({ error: "That client isn't in your company." }, { status: 404 });
    clientId = client.id;
    if (!title) title = clip(client.name, 120);
  }

  const read = await db.planRead.create({
    data: {
      companyId: member.companyId,
      createdById: member.userId || null,
      leadId,
      clientId,
      title: title || "New project",
      clientRequest: clip(raw?.clientRequest, 2000) || null,
      trade: raw?.trade === "staining" ? "staining" : "painting",
    },
    select: { id: true },
  });
  return NextResponse.json({ id: read.id }, { status: 201 });
}
