// app/api/receipts/route.js
//
// The receipts book.
//
//   GET   the list, filtered — everyone's for the office, your own for crew
//   POST  capture: store the uploaded file(s) as a Receipt in "reading".
//         Spends nothing. The read is a second call (./[id]/read), so the
//         row — and the photo, which is the bookkeeping record — exists
//         before anything can fail, and a failed or abandoned read leaves a
//         receipt that says so and offers "Read again" rather than a photo
//         that vanished.
//
// Permission: the Expenses grid (lib/receipts/access.js). Everyone with any
// expenses level may capture; the list narrows to their own below the
// "everyone's" level. Impersonation is read-only (middleware + currentMember),
// so a support session can open the list and cannot capture.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { receiptFilesOrRefusal } from "@/lib/receipts/media";
import { receiptScope, seesAllReceipts } from "@/lib/receipts/access";
import { linkableJobWhere } from "@/lib/receipts/candidates";
import { listRow } from "@/lib/receipts/view";
import { dayRangeUtc } from "@/lib/analytics/dayRange";

const SOURCES = new Set(["expenses", "job", "snap"]);

/** The list filters, each a Prisma fragment. Unknown → no filter. */
function statusWhere(filter) {
  switch (filter) {
    case "needs_review":
      return { status: "needs_review" };
    case "unlinked":
      // Not booked yet, whatever the reason: still reading, read, or failed.
      return { status: { in: ["reading", "needs_review", "unreadable"] } };
    case "job":
      return { status: "confirmed", expenses: { some: { projectId: { not: null } } } };
    case "overhead":
      return { status: "confirmed", expenses: { some: { isOverhead: true } } };
    case "confirmed":
      return { status: "confirmed" };
    case "unreadable":
      return { status: "unreadable" };
    case "void":
      return { status: "void" };
    default:
      // "All" still hides void — a voided duplicate is kept, not shown by
      // default. The Void filter is where it is found.
      return { status: { not: "void" } };
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";
  const vendor = (searchParams.get("vendor") || "").trim().slice(0, 80);
  const jobId = (searchParams.get("jobId") || "").trim();
  const range = dayRangeUtc(searchParams.get("from"), searchParams.get("to"));

  const rows = await db.receipt.findMany({
    where: {
      companyId: member.companyId,
      ...receiptScope(full, member.userId),
      ...statusWhere(filter),
      ...(vendor ? { vendorName: { contains: vendor, mode: "insensitive" } } : {}),
      ...(jobId ? { expenses: { some: { projectId: jobId } } } : {}),
      ...(range ? { createdAt: range } : {}),
    },
    // "Let the office decide" first — that flag is a question waiting for
    // exactly the person looking at this list.
    orderBy: [{ officeDecides: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { expenses: { select: { id: true, projectId: true, isOverhead: true, category: true, amount: true } } },
  });

  const ids = [...new Set(rows.map((r) => r.createdById).filter(Boolean))];
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name || u.email || null]));

  const counts = await db.receipt.groupBy({
    by: ["status"],
    where: { companyId: member.companyId, ...receiptScope(full, member.userId) },
    _count: true,
  });

  return NextResponse.json({
    receipts: rows.map((r) => listRow(r, names)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    capped: rows.length === 200,
    seesAll: seesAllReceipts(full),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "expenses", "view_record_edit_own", "record a receipt");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const files = receiptFilesOrRefusal(body.files);
  if (!files.ok) return NextResponse.json({ error: files.error, code: files.code }, { status: 400 });

  // The job page it was snapped from — a hint to the scoring, never a link.
  // Checked against the jobs this person may link to, so a hint cannot be a
  // way to learn that some other job id exists.
  let contextJobId = null;
  if (typeof body.contextJobId === "string" && body.contextJobId) {
    const job = await db.job.findFirst({
      where: {
        id: body.contextJobId,
        ...linkableJobWhere({ companyId: member.companyId, userId: member.userId, seesAll: seesAllReceipts(full) }),
      },
      select: { id: true },
    });
    if (job) contextJobId = job.id;
  }

  const stored = (Array.isArray(body.files) ? body.files : []).map((f) => ({
    url: String(f.url),
    kind: f.kind === "document" ? "document" : "photo",
    filename: typeof f.filename === "string" ? f.filename.slice(0, 160) : null,
  }));

  const receipt = await db.receipt.create({
    data: {
      companyId: member.companyId,
      createdById: member.userId || null,
      source: SOURCES.has(body.source) ? body.source : contextJobId ? "job" : "expenses",
      contextJobId,
      files: stored,
      status: "reading",
    },
    select: { id: true, status: true },
  });

  return NextResponse.json({ receipt }, { status: 201 });
}
