// app/api/safety-incidents/[id]/route.js
//
// GET   → one incident, if this member is allowed to see it (their own
//         report, or company-wide with "view_all"/"view_edit_all").
// PATCH → status, follow-up notes, the regulatory note, whether work
//         stopped. Requires "view_edit_all" — the reporter's own
//         `report_own` grant covers filing and reading, not editing.
//
// ── Why the reporter cannot edit their own report ───────────────────────────
//
// This is a safety record, potentially the one a WCB/CNESST claim or an
// insurer asks for later. Letting the person who filed it quietly rewrite it
// afterwards — even to fix a typo — undermines the one thing that makes the
// record worth keeping: that it says what was reported, when. A correction
// goes through someone with `view_edit_all` (dispatcher/manager/owner/admin
// by default), the same way a supervisor countersigns a correction on a
// paper form rather than the original filer erasing it.
//
// ── No DELETE, deliberately ─────────────────────────────────────────────────
//
// See the model's own header comment in prisma/schema.prisma. `status` moves
// open → reviewed → closed; nothing here removes a row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { scopeFilter } from "@/lib/permissions/enforce";
import { normaliseIncidentUpdate } from "@/lib/safety/incidentFields";
import { recordActivity } from "@/lib/activity/log";

const SELECT = {
  id: true,
  jobId: true,
  job: { select: { id: true, title: true } },
  reportedByMemberId: true,
  reportedByMember: { select: { id: true, user: { select: { name: true, email: true } } } },
  involvedWorkerId: true,
  involvedWorker: { select: { id: true, name: true } },
  occurredAt: true,
  location: true,
  kind: true,
  description: true,
  workStopped: true,
  regulatoryNote: true,
  status: true,
  followUpNotes: true,
  followUpAt: true,
  reviewedByMemberId: true,
  reviewedByMember: { select: { id: true, user: { select: { name: true, email: true } } } },
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  photos: {
    select: { id: true, url: true, caption: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  },
};

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "safety",
    "report_own",
    "see safety incidents",
  );
  if (denied) return denied;

  const incident = await db.safetyIncident.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...scopeFilter(full, "safety", "reportedByMemberId", full?.id),
    },
    select: SELECT,
  });
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ incident });
}

export async function PATCH(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "safety",
    "view_edit_all",
    "follow up on a safety incident",
  );
  if (denied) return denied;

  const existing = await db.safetyIncident.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { data } = normaliseIncidentUpdate(body);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await db.safetyIncident.update({
    where: { id: existing.id },
    data: {
      ...data,
      reviewedByMemberId: full?.id || member.id,
      reviewedAt: new Date(),
    },
    select: SELECT,
  });

  await recordActivity(member, {
    action: "safety.incident_followed_up",
    entityType: "safety_incident",
    entityId: existing.id,
    summary: data.status
      ? `Marked a safety incident ${data.status}`
      : "Added a follow-up note to a safety incident",
    metadata: { previousStatus: existing.status, ...data },
  });

  return NextResponse.json({ incident: updated });
}
