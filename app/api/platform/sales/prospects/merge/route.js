// app/api/platform/sales/prospects/merge/route.js
//
// POST { survivorId, otherIds, confirm } — preview, then apply.
//
// Without `confirm: true` the response is the PLAN: every field the merge
// would fill on the kept row, from which row and which source, the claim
// that would move, the funnel deltas — computed fresh from the rows as they
// are now. With `confirm: true` it is applied, in one transaction, and the
// plan is re-computed AT the write (lib/sales/discovery/mergeProspects.js
// applyMerge): a rep who claimed one of the rows between the preview and the
// press turns the merge into a refusal, not a surprise.
//
// Nothing is deleted. Superadmin only — a merge moves a rep's claim.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { GROUP_SELECT, previewMerge } from "@/lib/sales/discovery/duplicateGroup";
import { applyMerge } from "@/lib/sales/discovery/mergeProspects";

const MAX_OTHERS = 20;

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const survivorId = String(body?.survivorId ?? "").trim();
  const otherIds = Array.isArray(body?.otherIds)
    ? [...new Set(body.otherIds.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean))].slice(0, MAX_OTHERS)
    : [];
  if (!survivorId) return NextResponse.json({ error: "Which row is kept?" }, { status: 400 });
  if (!otherIds.length) return NextResponse.json({ error: "Which rows merge into it?" }, { status: 400 });
  if (otherIds.includes(survivorId)) return NextResponse.json({ error: "A row cannot be merged into itself." }, { status: 400 });

  const now = new Date();
  const rows = await db.prospect.findMany({ where: { id: { in: [survivorId, ...otherIds] } }, select: GROUP_SELECT });
  const repIds = [...new Set(rows.map((r) => r.assignedRepId).filter(Boolean))];
  const reps = repIds.length ? await db.salesRep.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true, email: true } }) : [];
  const preview = previewMerge({ survivorId, otherIds, rows, reps, now });
  if (!preview.ok) return NextResponse.json({ error: preview.error }, { status: 409 });

  if (body?.confirm !== true) return NextResponse.json({ ok: true, preview: true, plan: preview.plan });

  const result = await applyMerge({ db, plan: preview.plan, adminId: admin.id, now });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, preview: false, plan: result.plan });
}
