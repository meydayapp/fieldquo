// app/api/jobs/[id]/change-orders/route.js
//
// Logging a scope change agreed after the client accepted the quote — see
// prisma/schema.prisma's ChangeOrder model and docs/CALLBACKS-AND-CHANGE-ORDERS.md
// for why this is a record a person writes, deliberately never auto-created
// from a quote or invoice edit.
//
// Two doors out of the form, both through this POST:
//   "Save without sending" — today's path. Staff assert the client agreed
//     (status approved) or file it as pending. Nothing goes to the client.
//   "Send for approval"   — `send: true`. The row is created and then handed
//     to lib/jobs/changeOrderSend.js, which emails/texts the addendum link
//     and moves it to waiting_client. If neither channel accepts, the row
//     stays `pending` and the reasons come back — a change order is never
//     shown as "waiting on the client" for a link nobody received.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { CHANGE_ORDER_CREATE_STATUSES } from "@/lib/jobs/changeOrderValue";
import { normaliseChangeOrderInput, snapshotQuoteLine } from "@/lib/jobs/changeOrderAddendum";
import { CHANGE_ORDER_INCLUDE, presentChangeOrder } from "@/lib/jobs/changeOrderPresent";
import { applyChangeOrderDecision } from "@/lib/jobs/changeOrderDecision";
import { sendChangeOrderToClient } from "@/lib/jobs/changeOrderSend";

export async function GET(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changeOrders = await db.changeOrder.findMany({
    where: { jobId: _params.id },
    orderBy: { createdAt: "desc" },
    include: CHANGE_ORDER_INCLUDE,
  });

  return NextResponse.json(changeOrders.map((co) => presentChangeOrder(co, changeOrders)));
}

export async function POST(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same two gates PATCH /api/invoices/[id] uses for its own edit: the jobs
  // level to touch the job at all, and showPricing because a priceDelta is
  // money — a member who can see this job but not its prices must not be
  // able to type one in through this door instead.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "log a change order");
    requireToggle(full, "showPricing", "log a change order");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await db.job.findFirst({
    where: { id: _params.id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: {
      id: true,
      quote: { select: { id: true, scopeGroups: { select: { id: true, lineItems: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = normaliseChangeOrderInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;
  const send = body?.send === true;

  // Only the two states a person can log something INTO. `rejected` is the
  // outcome of a later decision, never a thing you file on day one, and
  // accepting it here would let the form create a record of a refusal that
  // nobody is recorded as having made. A change order being SENT starts as
  // pending — the client's signature is what approves it.
  //
  // Absent means approved, matching this model's original meaning — a change
  // order was always "already agreed by the time it is logged". The form sends
  // the field explicitly either way; this default is for API callers and for
  // the rows written before the column existed.
  const requested = send ? "pending" : body?.status === undefined || body?.status === null ? "approved" : body.status;
  if (!CHANGE_ORDER_CREATE_STATUSES.includes(requested)) {
    return NextResponse.json(
      { error: "A change order is logged as agreed or as pending." },
      { status: 400 },
    );
  }

  // The line or step it changes must be THIS job's. A snapshot of the line
  // is taken now, so the addendum's "Original line" is what the line said
  // the day the change was raised.
  let originalLine = null;
  if (input.quoteLineKey) {
    originalLine = snapshotQuoteLine(job.quote, input.quoteLineKey);
    if (!originalLine) return NextResponse.json({ error: "That quote line isn't on this job." }, { status: 400 });
  }
  if (input.taskId) {
    const step = await db.task.findFirst({ where: { id: input.taskId, jobId: job.id, planStep: true }, select: { id: true } });
    if (!step) return NextResponse.json({ error: "That step isn't on this job's plan." }, { status: 400 });
  }

  // CO-n is allocated under the job's row lock so two people logging at once
  // cannot both become CO-3.
  const changeOrder = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Job" WHERE id = ${job.id} FOR UPDATE`;
    const count = await tx.changeOrder.count({ where: { jobId: job.id } });
    return tx.changeOrder.create({
      data: {
        jobId: job.id,
        seq: count + 1,
        description: input.description,
        bodyHtml: input.bodyHtml,
        priceDelta: input.priceDelta,
        scheduleDeltaDays: input.scheduleDeltaDays,
        photos: input.photos,
        quoteLineKey: input.quoteLineKey,
        originalLine,
        taskId: input.taskId,
        status: requested,
        // Logging one as already agreed IS the decision — recorded here rather
        // than left null, so "who said yes to this money" has an answer on every
        // approved row and not only on the ones that passed through pending.
        ...(requested === "approved"
          ? { decidedAt: new Date(), decidedById: member.userId }
          : {}),
        createdById: member.userId,
      },
      include: CHANGE_ORDER_INCLUDE,
    });
  });

  // A change logged as already agreed adds or edits its plan step now, the
  // same way a client's signature would (lib/jobs/changeOrderDecision.js).
  if (requested === "approved") {
    await applyChangeOrderDecision(changeOrder.id, "approved", { byUserId: member.userId, previousStatus: null });
  }

  let sent = null;
  if (send) {
    sent = await sendChangeOrderToClient({
      changeOrderId: changeOrder.id,
      member,
      request,
      channels: { email: body?.channels?.email !== false, sms: body?.channels?.sms !== false },
    });
  }

  const all = await db.changeOrder.findMany({ where: { jobId: job.id }, select: { id: true, seq: true, createdAt: true } });
  const fresh = await db.changeOrder.findUnique({ where: { id: changeOrder.id }, include: CHANGE_ORDER_INCLUDE });
  return NextResponse.json({ ...presentChangeOrder(fresh, all), sent }, { status: 201 });
}
