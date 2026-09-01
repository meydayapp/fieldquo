// app/api/safety-incidents/route.js
//
// GET  → the incidents this member is allowed to see (own reports, or every
//        incident when the grid grants "view_all"/"view_edit_all").
// POST → file a new one.
//
// ── Who may do what ─────────────────────────────────────────────────────────
//
// Gated on the "safety" category — see lib/permissions.js for the ladder and
// its reasoning. The floor is `report_own`, not `none`: the owner's own
// framing was "a crew member should be able to report one", so a member who
// cannot see every incident in the company must still be able to file their
// own. hasLevel's fall-open rule (no grid, or a grid that never mentions
// `safety`) means every member who predates this feature keeps full access,
// same as every other category.
//
// ── "own" means "reported by you" ───────────────────────────────────────────
//
// Not "incidents you were involved in but somebody else filed" — that would
// need resolving `full.userId` to a Worker row (Member and Worker are
// separate tables, both pointing at the same User) on every request, and the
// simpler rule is the one that matches what the person filing actually
// controls. A worker who wants to see an incident filed ABOUT them by a
// supervisor asks that supervisor — a real gap, named in
// docs/SAFETY-AND-EQUIPMENT.md rather than silently assumed away.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { scopeFilter } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { normaliseIncidentInput } from "@/lib/safety/incidentFields";
import { recordActivity } from "@/lib/activity/log";

const LIST_SELECT = {
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
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  photos: {
    select: { id: true, url: true, caption: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  },
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "safety",
    "report_own",
    "see safety incidents",
  );
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");

  const rows = await db.safetyIncident.findMany({
    where: {
      companyId: member.companyId,
      ...scopeFilter(full, "safety", "reportedByMemberId", full?.id),
      ...(jobId ? { jobId } : {}),
      ...(status ? { status } : {}),
    },
    select: LIST_SELECT,
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ incidents: rows });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "safety",
    "report_own",
    "report a safety incident",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const { data, error } = normaliseIncidentInput(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    jobId: data.jobId,
    involvedWorkerId: data.involvedWorkerId,
  });
  if (badLink) return badLink;

  const created = await db.safetyIncident.create({
    data: {
      companyId: member.companyId,
      // The reporter is the session, never the request — a member cannot
      // file a report attributed to someone else.
      reportedByMemberId: full?.id || member.id,
      jobId: data.jobId,
      involvedWorkerId: data.involvedWorkerId,
      occurredAt: data.occurredAt,
      location: data.location,
      kind: data.kind,
      description: data.description,
      workStopped: data.workStopped,
      regulatoryNote: data.regulatoryNote,
    },
    select: LIST_SELECT,
  });

  await recordActivity(member, {
    action: "safety.incident_reported",
    entityType: "safety_incident",
    entityId: created.id,
    summary:
      created.kind === "injury"
        ? "Reported a safety incident (injury)"
        : created.kind === "near_miss"
          ? "Reported a near-miss"
          : "Reported a safety incident",
    metadata: { kind: created.kind, jobId: created.jobId, workStopped: created.workStopped },
  });

  return NextResponse.json({ incident: created }, { status: 201 });
}
