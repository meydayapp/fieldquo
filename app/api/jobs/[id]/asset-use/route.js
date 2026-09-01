// app/api/jobs/[id]/asset-use/route.js
//
// Which of the company's equipment was on this job, and for how long.
//
// GET  → this job's AssetUseLog rows.
// POST → log one or more (asset, day) entries against this job.
//
// ── Why this is gated exactly like job photos, not like the asset register ──
//
// Adding/editing an ASSET (its cost, life, salvage value) moves the company's
// price floor and is gated on the cost-basis rule (jobCosting + user:manage —
// see lib/permissions/costBasis.js and app/api/assets/route.js). Logging that
// an asset was USED on a job moves nothing by itself — see
// lib/costing/actualJobCost.js's double-count note, and this route never lets
// the browser set a dollar amount either way. It is closer to filing a job
// photo than to editing the register, so it uses the same gate job photos do:
// "jobs" category at view_only, scoped to a Crew member's own assigned jobs
// via assignedJobWhere. The person standing next to the compressor is exactly
// who should be able to say it came along today.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

const SELECT = {
  id: true,
  assetId: true,
  asset: { select: { id: true, name: true, category: true, active: true } },
  usedOn: true,
  hours: true,
  note: true,
  loggedByMemberId: true,
  loggedByMember: { select: { id: true, user: { select: { name: true } } } },
  createdAt: true,
};

async function loadScopedJob(db, id, member, full) {
  return db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see this job's equipment log",
  );
  if (denied) return denied;

  const job = await loadScopedJob(db, id, member, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [logs, assets] = await Promise.all([
    db.assetUseLog.findMany({
      where: { jobId: id, companyId: member.companyId },
      select: SELECT,
      orderBy: { usedOn: "desc" },
    }),
    // The picker's own source list — active assets only, so a retired ladder
    // rack doesn't show up as an option to log on a new job.
    db.asset.findMany({
      where: { companyId: member.companyId, active: true },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ logs, assets });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // See the file header: this is the "filing a photo" gate, not the
  // cost-basis gate — filing which asset was used is not the same act as
  // editing what an asset is worth.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "log equipment on this job",
  );
  if (denied) return denied;

  const job = await loadScopedJob(db, id, member, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.logs) ? body.logs : [body];

  const rows = [];
  for (const raw of items) {
    const assetId = typeof raw?.assetId === "string" ? raw.assetId : "";
    if (!assetId) continue;

    let usedOn = new Date();
    if (raw?.usedOn) {
      const parsed = new Date(raw.usedOn);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
      }
      usedOn = parsed;
    }

    const hours =
      raw?.hours === null || raw?.hours === undefined || raw?.hours === ""
        ? null
        : Number(raw.hours);
    if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 24)) {
      return NextResponse.json({ error: "Hours has to be between 0 and 24." }, { status: 400 });
    }

    rows.push({
      assetId,
      usedOn,
      hours,
      note: typeof raw?.note === "string" ? raw.note.trim().slice(0, 300) || null : null,
    });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "Pick at least one piece of equipment." }, { status: 400 });
  }

  // Every asset id has to be OURS before it's written — a hand-crafted POST
  // could otherwise point a use log at another tenant's register, moving that
  // company's equipment into THIS company's job costing.
  for (const row of rows) {
    const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, {
      assetId: row.assetId,
    });
    if (badLink) return badLink;
  }

  await db.assetUseLog.createMany({
    data: rows.map((r) => ({
      ...r,
      companyId: member.companyId,
      jobId: id,
      loggedByMemberId: full?.id || member.id,
    })),
  });

  const logs = await db.assetUseLog.findMany({
    where: { jobId: id, companyId: member.companyId },
    select: SELECT,
    orderBy: { usedOn: "desc" },
  });

  return NextResponse.json({ logs }, { status: 201 });
}
