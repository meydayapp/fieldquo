// app/api/invoices/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { readTaxResolution, resolutionForDocument, resolutionMatchesAmount } from "@/lib/tax/taxResolution";
import { db } from "@/lib/db";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { invoiceSendAsk } from "@/lib/invoices/sendAsk";
import { familyPayments, familyMembers } from "@/lib/invoices/family";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
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
import {
  parseExpectedVersion,
  versionWhere,
  runGuardedWrite,
  settleGuardedWrite,
} from "@/lib/concurrency/staleWrite";
import { stripe } from "@/lib/stripe";
import { formatMoney } from "@/lib/currency";
import { recordActivity } from "@/lib/activity/log";
import { invoiceChaseKey, resolveTaskBySource } from "@/lib/tasks/autoCreate";

// Next 16: params is a Promise — same fix as the quotes route.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Refused before the row is read. The list route is gated the same way, and
  // a detail endpoint that answers what the list refuses is a side door.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "invoices",
    "view_only",
    "see invoices",
  );
  if (denied) return denied;

  const invoice = await db.invoice.findFirst({
    where: { id: id, companyId: member.companyId },
    include: {
      client: true,
      quote: true,
      payments: { orderBy: { date: "desc" } },
      versions: { orderBy: { version: "desc" } },
      parentInvoice: true,
      // Appointments booked by hand about this invoice (Appointment.invoiceId)
      // — a call to chase it, a visit to settle it. Listed on the page the
      // same way the quote page lists its measures.
      appointments: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          location: true,
          cancelReason: true,
          assignedToId: true,
          assignedTo: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The payment history the page shows is the FAMILY's, not this version's
  // own rows: a deposit taken against v1 is still money against v2, and a
  // detail page for v2 that listed no payments would say the client had paid
  // nothing. See lib/invoices/family.js.
  invoice.payments = await familyPayments(db, invoice.id, {
    orderBy: { date: "desc" },
  });
  // The amounts the page shows are re-derived from that same ledger — for
  // DISPLAY only; a GET does not write. A version amended before the family
  // rule existed carries a stale cache (amountPaid 0 on a partly-paid bill),
  // and this is the screen the office opens to check what is owed. The cache
  // itself is refreshed the next time money moves (refreshFamilyLedger). The
  // stored status is left as it is: it drives the page's controls, and a
  // number shown as derived is honest where a status flipped on read is not.
  {
    const shown = computeInvoiceState({
      total: invoice.total,
      payments: invoice.payments,
      priorStatus: invoice.status,
    });
    invoice.amountPaid = shown.amountPaid;
    invoice.amountDue = shown.amountDue;
    invoice.amountRefunded = shown.amountRefunded;
  }

  // What the Send button would ask for — the next uncovered stage of the
  // job's schedule, or the balance — so the page says it before the press.
  // The same function the send route decides by (lib/invoices/sendAsk.js).
  {
    const stages = await db.jobPaymentStage.findMany({
      where: { companyId: member.companyId, invoiceId: invoice.id },
      select: { id: true, seq: true, label: true, amountCents: true, status: true },
    });
    const ask = invoiceSendAsk({ totalCents: Math.round(Number(invoice.total) * 100), paidCents: Math.round(invoice.amountPaid * 100), stages });
    invoice.sendAsk = { kind: ask.kind, requested: ask.requestCents / 100, collected: ask.collectedCents / 100, stage: ask.stage ? { label: ask.stage.label, index: ask.stage.index, count: ask.stage.count } : null };
  }

  // ── The chase trail, family-wide, on the payload the page already loads ──
  //
  // Here rather than on /api/activity for two reasons. That endpoint is
  // owner/admin only, and this page is readable at invoices:view_only — an
  // estimator allowed to see the invoice would see an email trail that
  // silently stopped at the first send. And the automated reminders are not
  // in the activity log at all: the cron records them in FollowUpLog (its
  // dedupe table) and nowhere else, so the activity endpoint could not answer
  // even for an owner. One fetch, no new gate, both sources.
  //
  // Family-wide for the same reason the payments above are: a chase stamped
  // on v1 is still a chase of the document the client holds after v2 replaces
  // it, and the cron logs against whichever version was live when it fired.
  // Same rule buildReceivables applies on the dashboard, so the two screens
  // cannot disagree about whether a client was chased.
  {
    const members = await familyMembers(db, invoice.id);
    const ids = members.length ? members.map((m) => m.id) : [invoice.id];
    const [rows, logs] = await Promise.all([
      db.invoice.findMany({
        where: { id: { in: ids }, companyId: member.companyId },
        select: { lastChasedAt: true, chaseCount: true },
      }),
      db.followUpLog.findMany({
        where: {
          entityType: "invoice",
          entityId: { in: ids },
          rule: { companyId: member.companyId },
        },
        select: { sentAt: true, rule: { select: { name: true } } },
        orderBy: { sentAt: "desc" },
      }),
    ]);
    let lastChasedAt = null;
    let chaseCount = 0;
    for (const r of rows) {
      if (r.lastChasedAt && (!lastChasedAt || r.lastChasedAt > lastChasedAt)) {
        lastChasedAt = r.lastChasedAt;
      }
      chaseCount += Number(r.chaseCount) || 0;
    }
    invoice.chaseTrail = {
      lastChasedAt,
      chaseCount,
      automated: logs.map((l) => ({ sentAt: l.sentAt, ruleName: l.rule?.name || null })),
    };
  }

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

  // The version the browser is editing FROM. See lib/concurrency/staleWrite.js.
  // Absent means unguarded and behaves exactly as it did before; unreadable is
  // a 400, never a silent downgrade.
  let expected = null;
  try {
    expected = parseExpectedVersion(body?.expectedUpdatedAt);
  } catch (err) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 400 },
    );
  }

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
    // ── Guarded, because a draft invoice IS overwritten in place ──────────
    //
    // The versioned path below is not guarded, and that is deliberate rather
    // than unfinished: once an invoice has been sent, this route stops
    // updating the row and snapshots a NEW version instead, so a second
    // editor's save cannot erase the first one's — both versions exist. (That
    // path has its own concurrency bug — two simultaneous saves read the same
    // `latestVersion` and mint two rows with the same version number — but it
    // is a different bug with a different fix, a unique constraint on
    // (parentInvoiceId, version), and pretending `updatedAt` addresses it
    // would be a guard that appears to work and doesn't.)
    const outcome = await runGuardedWrite({
      expected,
      readVersion: () =>
        db.invoice.findFirst({
          where: { id, companyId: member.companyId },
          select: { updatedAt: true },
        }),
      write: () => db.invoice.update({
        where: { id: id, ...versionWhere(expected) },
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
      }),
    });

    const refusal = await settleGuardedWrite(outcome, {
      client: db,
      companyId: member.companyId,
      entityType: "invoice",
      entityId: id,
      label: "invoice",
      expected,
      member,
      versionAt: outcome.result?.updatedAt,
    });
    if (refusal)
      return NextResponse.json(refusal.body, { status: refusal.status });

    // Same shape GET returns. Permission to edit an invoice is not permission
    // to read the client's private fields — those are a separate dial — and a
    // save response that carried more than the refetch would put data on screen
    // that vanishes on reload.
    return NextResponse.json(redactInvoice(full, outcome.result));
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

  // ── The ledger comes with the new version ───────────────────────────────
  //
  // Money already paid belongs to the invoice, not to the snapshot it was paid
  // against. Without this the new row took the column DEFAULTS — amountPaid 0,
  // amountDue 0 — so an invoice paid $200 on v1 read on v2 as owing nothing
  // (amountDue 0 → settled) while the $200 sat on v1, and the client portal
  // offered BOTH. Re-derived from every payment in the family against THIS
  // version's total, through the one function that knows how to net refunds
  // and disputes, rather than copied from v1's cache — which could itself be
  // stale. See lib/invoices/family.js.
  const ledger = computeInvoiceState({
    total: total ?? existing.total,
    payments: await familyPayments(db, existing.id),
    priorStatus: status || existing.status,
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
      // The sentence behind the tax figure travels with it — unless the
      // amendment changed the figure to one the record no longer explains,
      // in which case the record becomes "typed by hand" at the new rate
      // (lib/tax/taxResolution.js) rather than a stale jurisdiction.
      taxResolution: (() => {
        const next = resolutionForDocument({
          resolution: null,
          tax: tax ?? existing.tax,
          taxableBase: Number(subtotal ?? existing.subtotal) - Number(discount ?? existing.discount),
          taxEnabled: taxEnabled ?? existing.taxEnabled,
        });
        const kept = readTaxResolution(existing.taxResolution);
        if ((taxEnabled ?? existing.taxEnabled) === false) return Prisma.DbNull;
        if (kept && resolutionMatchesAmount(kept, tax ?? existing.tax, Number(subtotal ?? existing.subtotal) - Number(discount ?? existing.discount)))
          return kept;
        return next ?? Prisma.DbNull;
      })(),
      total: total ?? existing.total,
      amountPaid: ledger.amountPaid,
      amountDue: ledger.amountDue,
      amountRefunded: ledger.amountRefunded,
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

  // ── Any status may go — except one that carries money ─────────────────────
  //
  // This refused everything but `draft`, which read to the owner as "the
  // other ones should also be able to be deleted" — a sent invoice the client
  // never paid, an overdue one raised by mistake, are paperwork, and paperwork
  // can be torn up after a confirmation the person cannot press by accident
  // (the page's DeleteConfirmModal, the same one Jobs uses).
  //
  // What cannot go is a RECORD OF MONEY. The rule mirrors Jobs, which keep a
  // job with logged hours because hours are payroll: an invoice with a Payment
  // row — paid, partly paid, refunded, disputed — is the company's own ledger
  // of what a client handed over, and lib/invoices/computeInvoiceState.js's
  // whole premise is that Payment rows are never deleted. Payment cascades
  // from Invoice, so deleting the invoice would erase them silently; the
  // refusal below is what stands between the trash icon and that.
  //
  // Counted across the FAMILY (root + every amended version), not this row:
  // lib/invoices/family.js — the money lives on whichever version the checkout
  // named, and deleting v2 of an invoice paid on v1 is still deleting the paid
  // invoice.
  //
  // A bank debit on its way (pendingPaymentIntentId — the client authorised
  // the debit at Checkout; the money clears days later) counts too: no Payment
  // row exists yet, but the client has already paid from where they stand.
  const members = await familyMembers(db, existing.id);
  const memberIds = members.map((m) => m.id);
  const rows = await db.invoice.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, stripeCheckoutUrl: true, pendingPaymentIntentId: true, total: true, amountDue: true },
  });
  const payments = await db.payment.findMany({
    where: { invoiceId: { in: memberIds } },
    select: { amount: true, kind: true },
  });
  const pending = rows.find((r) => r.pendingPaymentIntentId);
  if (payments.length || pending) {
    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { currency: true },
    });
    const money = (n) => formatMoney(n, company?.currency);
    const received = payments
      .filter((p) => p.kind !== "refund")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const what = payments.length
      ? `a payment of ${money(received)} recorded`
      : `a bank payment of ${money(Number(pending.amountDue || pending.total || 0))} on its way`;
    return NextResponse.json(
      {
        error:
          `This invoice has ${what}, so it can't be deleted — that's a record of money. ` +
          `It stays on the books; if the money is going back, refund it instead.`,
      },
      { status: 409 },
    );
  }

  // ── An open Stripe Checkout must not outlive the invoice ─────────────────
  //
  // The checkout-link and portal pay routes store only the session URL, and a
  // Checkout page stays payable for 24 hours after it was minted. A client who
  // still has that link open could pay an invoice that no longer exists — a
  // Payment row with nowhere to land. The session id is the `cs_…` segment of
  // Stripe's own URL; expiring one that already completed or expired throws,
  // and that is fine: nothing is left to pay either way.
  const sessions = rows
    .map((m) => m.stripeCheckoutUrl)
    .map((u) => (u && u.match(/(cs_(?:live|test)_[A-Za-z0-9]+)/) || [])[1])
    .filter(Boolean);
  for (const sessionId of new Set(sessions)) {
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch (err) {
      console.warn("[invoice.delete] could not expire checkout session", sessionId, err?.message);
    }
  }

  // ── What a deleted invoice leaves behind, decided here rather than by the
  // schema's defaults ──────────────────────────────────────────────────────
  //
  // Payment (none, checked above) and InvoiceCosting cascade. Everything
  // else pointing at the family is nulled in the same transaction as the
  // delete, so the outcome is stated in one place instead of read off six
  // relation attributes:
  //   • JobPaymentStage.invoiceId — the schedule's stages survive; a pending
  //     one with no invoice is skipped by the cron as `no_invoice`
  //     (lib/paymentSchedule/run.js), never a 500.
  //   • ChangeOrder.invoiceId — the scope change goes back to "not yet billed".
  //   • Task.invoiceId / Appointment.invoiceId — the to-do and the appointment
  //     stay; they just no longer open a document that is gone.
  //   • ServicePlanOccurrence.invoiceId — the occurrence stays as history.
  // The chase task the send created is closed, the way deleting a job closes
  // the quote's "schedule this job" task.
  await db.$transaction(async (tx) => {
    await tx.jobPaymentStage.updateMany({
      where: { invoiceId: { in: memberIds } },
      data: { invoiceId: null },
    });
    await tx.changeOrder.updateMany({
      where: { invoiceId: { in: memberIds } },
      data: { invoiceId: null },
    });
    await tx.task.updateMany({
      where: { invoiceId: { in: memberIds } },
      data: { invoiceId: null },
    });
    await tx.appointment.updateMany({
      where: { invoiceId: { in: memberIds } },
      data: { invoiceId: null },
    });
    await tx.servicePlanOccurrence.updateMany({
      where: { invoiceId: { in: memberIds } },
      data: { invoiceId: null },
    });
    // Versions first, then the root: parentInvoiceId is a self-relation.
    await tx.invoice.deleteMany({
      where: { id: { in: memberIds }, parentInvoiceId: { not: null }, companyId: member.companyId },
    });
    await tx.invoice.deleteMany({
      where: { id: { in: memberIds }, companyId: member.companyId },
    });
  });

  for (const memberId of memberIds) {
    await resolveTaskBySource(invoiceChaseKey(memberId));
  }

  await recordActivity(member, {
    action: "invoice.deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted invoice ${existing.invoiceNumber || id}`,
  });

  return NextResponse.json({ success: true });
}
