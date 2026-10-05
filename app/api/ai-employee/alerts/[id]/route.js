// app/api/ai-employee/alerts/[id]/route.js
//
// One urgent alert (lib/aiEmployee/urgentAlerts.js) — what the on-call text
// links to.
//
//   GET  → what happened, who was texted, whether anybody has it
//   POST { action: "acknowledge" } → "I've got it": stops the ladder
//
// Who may open it: a person on its on-call ladder, or an owner/admin. A crew
// member who is on call holds no `user:manage`, and the text was sent TO
// them — refusing them the page their own text links to would be the alert
// working and the product not. Everyone else is a 404, the same answer a
// wrong id gets.
//
// The acknowledgement is a POST behind a button, never a GET: a phone's
// link preview fetches the URL in a text, and a preview must not take an
// emergency off the ladder on somebody's behalf.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { alertView, acknowledgeUrgentAlert } from "@/lib/aiEmployee/urgentAlerts";

async function load(request, params) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  const { id } = await params;
  const view = await alertView(db, { companyId: member.companyId, alertId: String(id || "") });
  const mayOpen = view && (can(member.role, "user:manage") || view.ladder.some((p) => p.memberId === member.id) || member.impersonation);
  if (!view || !mayOpen) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { member, view };
}

export async function GET(request, { params }) {
  const { view, response } = await load(request, params);
  if (response) return response;
  return NextResponse.json({ alert: view });
}

export async function POST(request, { params }) {
  const { member, view, response } = await load(request, params);
  if (response) return response;
  if (member.impersonation) return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "acknowledge") return NextResponse.json({ error: "Say what to do.", reason: "bad_action" }, { status: 400 });
  const res = await acknowledgeUrgentAlert({ prisma: db, companyId: member.companyId, alertId: view.id, memberId: member.id });
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status || 404 });
  return NextResponse.json({ ok: true, already: Boolean(res.already), alert: await alertView(db, { companyId: member.companyId, alertId: view.id }) });
}
