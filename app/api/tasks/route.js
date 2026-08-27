// app/api/tasks/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can, requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");
  // One job's to-dos, for the panel on the job page. A filter, NOT a gate — it
  // narrows within whatever the scope below already allows, so a crew member
  // naming somebody else's job id gets an empty list rather than that job's
  // work. The job page itself is separately narrowed by assignedJobWhere.
  const jobId = searchParams.get("jobId");

  // ── The write side was scoped and the read was not ─────────────────────────
  //
  // PATCH and DELETE on /api/tasks/[id] both narrow to "yours, or claimable".
  // This list narrowed to nothing but the company, and `assignedToId` above is
  // a filter the CALLER chooses, not a gate — so a Crew member (quotes: none,
  // jobs scoped to their own visits) could read every to-do in the company:
  // description, due date, assignee name, the linked client's name and the
  // linked job's title, including tasks hanging off documents they are refused
  // everywhere else.
  //
  // Gated on task:assign — supervisor and up — which is the capability POST
  // below already uses to decide who may hand a to-do to somebody else. It is
  // the closest thing in the table to "may act on other people's tasks", which
  // is the question this list asks.
  //
  // task:create draws the SAME line today (checked: `employee` holds neither,
  // despite the comment on the PATCH route implying it holds task:create), so
  // it would work identically right now. It is the wrong one anyway: it means
  // "may raise a to-do", and the day an owner decides field staff may add
  // their own, gating the read on it would silently unscope the whole list
  // as a side effect of a permission nobody thought was about reading.
  //
  // Unassigned tasks stay VISIBLE. The PATCH deliberately lets anyone claim an
  // orphan; hiding orphans from the only list that shows them would leave that
  // claim path with no way to reach it — a control that exists and cannot be
  // used, which is the same failure as a dead button, just from the other side.
  //
  // Spread as its own AND term rather than as a bare top-level `OR`, so a
  // scoped caller passing ?assignedToId=<a colleague> still gets only their
  // own: the two clauses intersect instead of one overwriting the other, and a
  // later edit adding an `OR` of its own cannot silently replace this one.
  //
  // The sentinel is assignedJobWhere's, for its reason: a scoped caller we
  // cannot identify (a half-loaded member, a synthesised row) must match
  // nothing. `member.userId` left as undefined would make Prisma DROP those two
  // terms, and an OR with a dropped arm matches everything — fail-open, in the
  // one place that must fail closed.
  const me = member.userId || "__none__";
  const scope = can(member.role, "task:assign")
    ? {}
    : {
        AND: [
          {
            OR: [
              { assignedToId: me },
              { createdById: me },
              { assignedToId: null },
            ],
          },
        ],
      };

  const tasks = await db.task.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(assignedToId && { assignedToId }),
      ...(jobId && { jobId }),
      ...scope,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      workArea: { select: { id: true, name: true } },
      // Auto-created tasks ("ask them for a review") are only actionable if you
      // can get to the job they came from — a title alone makes you search for
      // it. Title and status only: the row shows a link, not a job summary.
      job: { select: { id: true, title: true, status: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "task:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const {
    title,
    description,
    dueDate,
    priority,
    assignedToId,
    clientId,
    quoteId,
    invoiceId,
    jobId,
    workAreaId,
  } = body;

  if (!title)
    return NextResponse.json({ error: "title is required" }, { status: 400 });

  if (
    assignedToId &&
    assignedToId !== member.userId &&
    !can(member.role, "task:assign")
  ) {
    return NextResponse.json(
      {
        error:
          "You can create tasks but only a supervisor or admin can assign them to someone else",
      },
      { status: 403 },
    );
  }

  // Every linked id must belong to THIS company — otherwise a member could link
  // a task to another tenant's client/quote/invoice and GET /api/tasks would
  // read that tenant's client name back. Mirrors the guard on the jobs route.
  const ownsOrNull = async (model, id) => {
    if (!id) return true;
    const row = await db[model].findFirst({
      where: { id, companyId: member.companyId },
      select: { id: true },
    });
    return Boolean(row);
  };
  const [okClient, okQuote, okInvoice, okJob, okArea] = await Promise.all([
    ownsOrNull("client", clientId),
    ownsOrNull("quote", quoteId),
    ownsOrNull("invoice", invoiceId),
    ownsOrNull("job", jobId),
    ownsOrNull("workArea", workAreaId),
  ]);
  if (!okClient || !okQuote || !okInvoice || !okJob || !okArea) {
    return NextResponse.json(
      { error: "A linked record wasn't found for your company." },
      { status: 400 },
    );
  }
  if (assignedToId) {
    const isMember = await db.member.findFirst({
      where: { userId: assignedToId, companyId: member.companyId },
      select: { id: true },
    });
    if (!isMember)
      return NextResponse.json(
        { error: "That person isn't on your team." },
        { status: 400 },
      );
  }

  const task = await db.task.create({
    data: {
      companyId: member.companyId,
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "normal",
      createdById: member.userId,
      assignedToId: assignedToId || null,
      clientId: clientId || null,
      quoteId: quoteId || null,
      invoiceId: invoiceId || null,
      jobId: jobId || null,
      workAreaId: workAreaId || null,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      job: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
