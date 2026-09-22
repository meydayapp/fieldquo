// app/api/waivers/[id]/route.js
//
// One attached waiver. POST { action: "send" } emails the client the
// signing link (one Resend send, the company's sender). DELETE detaches a
// PENDING one — a signed waiver is a record and cannot be detached; the
// signed copy is on the job's Documents.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { sendWaiverLink } from "@/lib/waivers/service";

async function loadOwned(member, id) {
  return db.documentSignature.findFirst({
    where: { id, companyId: member.companyId },
    include: { document: { select: { title: true } } },
  });
}

function areaOf(row) {
  return row.quoteId ? "quotes" : row.jobId ? "jobs" : "invoices";
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await loadOwned(member, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, areaOf(row), "view_create_edit", "send a waiver");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "send") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  try {
    const result = await sendWaiverLink({ signatureId: id, companyId: member.companyId });
    await recordActivity(member, {
      action: "waiver.sent",
      entityType: row.quoteId ? "quote" : row.jobId ? "job" : "invoice",
      entityId: row.quoteId || row.jobId || row.invoiceId,
      summary: `Sent waiver "${row.document?.title || ""}" to ${result.to}`,
      metadata: { signatureId: id },
    });
    return NextResponse.json({ ok: true, to: result.to, sentAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not send the waiver." }, { status: err.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await loadOwned(member, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, areaOf(row), "view_create_edit", "detach a waiver");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  if (row.status === "signed") {
    return NextResponse.json({ error: "A signed waiver is a record and can't be detached." }, { status: 409 });
  }
  await db.documentSignature.delete({ where: { id } });
  await recordActivity(member, {
    action: "waiver.detached",
    entityType: row.quoteId ? "quote" : row.jobId ? "job" : "invoice",
    entityId: row.quoteId || row.jobId || row.invoiceId,
    summary: `Detached unsigned waiver "${row.document?.title || ""}"`,
    metadata: { signatureId: id },
  });
  return NextResponse.json({ ok: true });
}
