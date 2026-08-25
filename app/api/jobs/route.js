// app/api/jobs/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { createJob } from "@/lib/jobs/createJob";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  // Archived jobs are hidden by default and returned only when asked for.
  // `?archived=1` shows the drawer; nothing returns both at once, because a
  // list that silently mixes filed and live work is the reason the filing
  // exists.
  const archived = searchParams.get("archived") === "1";

  const jobs = await db.job.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      archivedAt: archived ? { not: null } : null,
    },
    include: {
      client: { select: { id: true, name: true } },
      visits: { orderBy: { scheduledAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Coarse role gate, then the granular level on top. The role answers "may
  // you create jobs at all"; the grid answers "has this member been narrowed
  // to view-only".
  try {
    requirePermission(member.role, "job:create");
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "create jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json();
  const { clientId, quoteId, title, recurring, recurrenceRule } = body;

  // The validation, the cross-tenant quote check and the imported-cost
  // materialisation moved to lib/jobs/createJob.js when the invoice detail page
  // became a second place a job can be raised from. One copy, so the two cannot
  // start disagreeing about what a new job needs.
  const { job, error, status } = await createJob(db, {
    companyId: member.companyId,
    createdByUserId: member.userId,
    clientId,
    quoteId,
    title,
    recurring,
    recurrenceRule,
  });
  if (error) return NextResponse.json({ error }, { status });

  return NextResponse.json(job, { status: 201 });
}
