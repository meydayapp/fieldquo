// app/api/invoices/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { normaliseMediaList } from "@/lib/media/validate";

// Next 16: params is a Promise — same fix as the quotes route.
export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await db.invoice.findFirst({
    where: { id: id, companyId: member.companyId },
    include: {
      client: true,
      quote: true,
      payments: { orderBy: { date: "desc" } },
      versions: { orderBy: { version: "desc" } },
      parentInvoice: true,
    },
  });

  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

// Editing an invoice creates a new VERSION rather than mutating in place, once it's
// been sent — this preserves the changeLog pattern from TrueFinish. Draft invoices
// (never sent) can just be edited directly.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "edit invoices");
    requireToggle(full, "showPricing", "edit invoices");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    lineItems,
    subtotal,
    discount,
    tax,
    total,
    dueDate,
    notes,
    status,
    changeReason,
    clientPhotos,
  } = body;

  const isDraft = existing.status === "draft";

  if (isDraft) {
    const updated = await db.invoice.update({
      where: { id: id },
      data: {
        ...(lineItems !== undefined && { lineItems }),
        ...(subtotal !== undefined && { subtotal }),
        ...(discount !== undefined && { discount }),
        ...(tax !== undefined && { tax }),
        ...(total !== undefined && { total }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(clientPhotos !== undefined && {
          clientPhotos: normaliseMediaList(clientPhotos),
        }),
      },
      include: { client: true },
    });
    return NextResponse.json(updated);
  }

  // Already sent — snapshot a new version instead of silently rewriting history
  const rootId = existing.parentInvoiceId || existing.id;
  const latestVersion = await db.invoice.findFirst({
    where: { OR: [{ id: rootId }, { parentInvoiceId: rootId }] },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const newVersion = await db.invoice.create({
    data: {
      companyId: existing.companyId,
      invoiceNumber: existing.invoiceNumber,
      status: status || existing.status,
      clientId: existing.clientId,
      quoteId: existing.quoteId,
      createdById: member.userId,
      parentInvoiceId: rootId,
      version: (latestVersion?.version || 1) + 1,
      changeLog: {
        reason: changeReason || "Invoice updated",
        changedBy: member.userId,
        at: new Date(),
      },
      lineItems: lineItems ?? existing.lineItems,
      subtotal: subtotal ?? existing.subtotal,
      discount: discount ?? existing.discount,
      tax: tax ?? existing.tax,
      total: total ?? existing.total,
      dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
      notes: notes ?? existing.notes,
      // Carried forward, not dropped: a new version that silently lost the job
      // photos would be a worse document than the one it replaced.
      clientPhotos:
        clientPhotos !== undefined
          ? normaliseMediaList(clientPhotos)
          : existing.clientPhotos,
      language: existing.language,
    },
    include: { client: true },
  });

  return NextResponse.json(newVersion, { status: 201 });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(
      full,
      "invoices",
      "view_create_edit_delete",
      "delete invoices",
    );
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be deleted" },
      { status: 400 },
    );
  }

  await db.invoice.delete({ where: { id: id } });
  return NextResponse.json({ success: true });
}
