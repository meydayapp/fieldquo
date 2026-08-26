// app/api/invoices/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  redactInvoice,
} from "@/lib/permissions/enforce";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  buildCostingRow,
  mayCost,
  requireCost,
  isEmptyCosting,
} from "../costingWrite";

// Next 16: params is a Promise — same fix as the quotes route.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  // An invoice has no share token of its own, but it carries two things that do
  // need shaping: the full client row, and the originating quote — whose
  // shareToken opens the priced public page with no credential at all. Hiding
  // that token on the quote routes and handing it out through the invoice would
  // be the same leak behind a different URL.
  //
  // redactQuote rather than redactShareToken for the nested quote: it is the
  // single entry point, so if this include ever grows `quote: { client }` the
  // nested client is already covered instead of quietly slipping through.
  //
  // Money joined the same entry point. PATCH already required showPricing to
  // EDIT an invoice; GET required nothing, so the totals, the balance and every
  // payment row were readable by the one member the toggle exists to keep them
  // from. redactInvoice does client, quote and money in one call for exactly
  // the reason this comment gives about the share token: three routes each
  // remembering three rules is two routes that forget one.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(redactInvoice(full, invoice));
}

// Editing an invoice creates a new VERSION rather than mutating in place, once it's
// been sent — this preserves the changeLog pattern from TrueFinish. Draft invoices
// (never sent) can just be edited directly.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try: both response paths below redact the client with
  // it, and loading the member twice to learn the same thing is waste.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "edit invoices");
    requireToggle(full, "showPricing", "edit invoices");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    include: { costing: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    lineItems,
    subtotal,
    discount,
    tax,
    taxEnabled,
    total,
    dueDate,
    notes,
    status,
    changeReason,
    clientPhotos,
    costing,
  } = body;

  const isDraft = existing.status === "draft";

  // Costed against subtotal minus discount — the pre-tax money the work has to
  // come out of. Falls back to what the invoice already carries when this PATCH
  // is only flipping a status, so re-saving a cost panel doesn't reprice it
  // against 0.
  const costingPrice =
    (subtotal !== undefined ? Number(subtotal) || 0 : Number(existing.subtotal) || 0) -
    (discount !== undefined ? Number(discount) || 0 : Number(existing.discount) || 0);
  try {
    // A costing block from someone without the toggle used to be dropped right
    // below and the save answered 200 — the panel's contents gone, nothing
    // said. See requireCost: silence stays silence, an actual block is
    // refused.
    if (costing !== undefined) requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // `undefined` means the request said nothing about costing, which is not the
  // same as sending an empty one — a status-only PATCH must leave the crew and
  // hours exactly where they were.
  const costingRow =
    costing !== undefined && mayCost(full)
      ? await buildCostingRow({
          companyId: member.companyId,
          costing,
          price: costingPrice,
        })
      : null;

  if (isDraft) {
    const updated = await db.invoice.update({
      where: { id: id },
      data: {
        ...(lineItems !== undefined && { lineItems }),
        ...(subtotal !== undefined && { subtotal }),
        ...(discount !== undefined && { discount }),
        ...(tax !== undefined && { tax }),
        ...(taxEnabled !== undefined && { taxEnabled: Boolean(taxEnabled) }),
        ...(total !== undefined && { total }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(clientPhotos !== undefined && {
          clientPhotos: normaliseMediaList(clientPhotos),
        }),
        // Upsert: the panel may be filled in long after the invoice was
        // raised, so there is often no row to update yet.
        //
        // An empty block writes only when there is already a row to empty —
        // that is someone deleting the crew, and refusing it would be a Save
        // button that doesn't save. With no row it means the panel was never
        // touched, and there is nothing to record.
        ...(costingRow &&
          (existing.costing || !isEmptyCosting(costingRow)) && {
            costing: {
              upsert: { create: costingRow, update: costingRow },
            },
          }),
      },
      include: { client: true },
    });
    // Same shape GET returns. Permission to edit an invoice is not permission
    // to read the client's private fields — those are a separate dial — and a
    // save response that carried more than the refetch would put data on screen
    // that vanishes on reload.
    return NextResponse.json(redactInvoice(full, updated));
  }

  // ── What costing the NEW version row gets ────────────────────────────────
  //
  // Three cases, and the middle one is the easy thing to get wrong:
  //
  //   the request sent a panel   → use it, even if it is empty. An empty one
  //                                over an existing row is somebody deleting
  //                                the crew, and ignoring that would be a Save
  //                                button that doesn't.
  //   the request said nothing   → copy the previous version's row forward.
  //                                Every list and report reads the LATEST row,
  //                                so dropping it here would look like the
  //                                figures had been deleted rather than
  //                                superseded — same reasoning as the photos.
  //   neither                    → no row, and nothing pretends there is one.
  //
  // Copied field by field: the previous version keeps its own row, and that
  // row's id and timestamps must not be reused.
  const versionCosting =
    costingRow && (existing.costing || !isEmptyCosting(costingRow))
      ? costingRow
      : existing.costing
        ? {
            crew: existing.costing.crew ?? [],
            materialCost: existing.costing.materialCost,
            overheadPct: existing.costing.overheadPct,
            note: existing.costing.note,
            labourHours: existing.costing.labourHours,
            labourCost: existing.costing.labourCost,
            overhead: existing.costing.overhead,
            totalCost: existing.costing.totalCost,
          }
        : null;

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
      // Carried onto the new version. Dropping it would silently re-assert
      // "tax applies" on an invoice that was deliberately raised without any.
      taxEnabled: taxEnabled ?? existing.taxEnabled,
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
      ...(versionCosting ? { costing: { create: versionCosting } } : {}),
    },
    include: { client: true },
  });

  return NextResponse.json(
    redactInvoice(full, newVersion),
    { status: 201 },
  );
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
