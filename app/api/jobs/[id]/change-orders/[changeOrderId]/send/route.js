// app/api/jobs/[id]/change-orders/[changeOrderId]/send/route.js
//
// Send (or resend) a change order to the homeowner for signature. The work is
// lib/jobs/changeOrderSend.js's; this route is the gate and the answer.
//
// Gated like logging one: the jobs level and showPricing, because the link
// carries a price. POST { channels: { email, sms } } — both default on.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { sendChangeOrderToClient } from "@/lib/jobs/changeOrderSend";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id, changeOrderId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "send a change order");
    requireToggle(full, "showPricing", "send a change order");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Scoped to THIS job, not just the id, for the same reason the decision
  // route is.
  const co = await db.changeOrder.findFirst({ where: { id: changeOrderId, jobId: job.id }, select: { id: true } });
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const result = await sendChangeOrderToClient({
    changeOrderId: co.id,
    member,
    request,
    channels: { email: body?.channels?.email !== false, sms: body?.channels?.sms !== false },
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(" "), errors: result.errors }, { status: result.status || 502 });
  }
  return NextResponse.json(result);
}
