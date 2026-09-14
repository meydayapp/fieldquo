// app/api/platform/sales/prospects/duplicates/route.js
//
// GET ?id=<prospectId> — the rows that might be one business as `id`, side
// by side, and the rows already merged into it.
//
// The group is: the row, the row it is flagged against (if any), and every
// live row flagged against either of those — one read for the anchor, one
// for the pointers at it. Retired rows merged INTO the focus come back under
// `merged` so the panel can offer Unmerge; retired rows merged elsewhere are
// left out (lib/sales/discovery/duplicateGroup.js says why).
//
// Superadmin only, like every /platform/sales read of prospect rows.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { GROUP_COLUMNS, GROUP_SELECT, buildGroup, groupAnchor } from "@/lib/sales/discovery/duplicateGroup";
import { mergedFromIds } from "@/lib/sales/discovery/mergeProspects";
import { discoveryTradeLabel } from "@/lib/sales/discovery/trades";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const id = String(new URL(request.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Which prospect?" }, { status: 400 });

  const focus = await db.prospect.findUnique({ where: { id }, select: GROUP_SELECT });
  if (!focus) return NextResponse.json({ error: "No such prospect." }, { status: 404 });

  const anchor = groupAnchor(focus);
  const ids = [...new Set([focus.id, anchor, ...mergedFromIds(focus)].filter(Boolean))];
  const rows = await db.prospect.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { possibleDuplicateOfId: { in: [focus.id, anchor] } },
        { mergedIntoId: focus.id },
      ],
    },
    select: GROUP_SELECT,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const repIds = [...new Set(rows.map((r) => r.assignedRepId).filter(Boolean))];
  const reps = repIds.length ? await db.salesRep.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true, email: true } }) : [];

  const group = buildGroup({ focus, rows, reps, now: new Date() });
  const label = (r) => ({
    ...r,
    tradeLabel: r.tradeKey ? discoveryTradeLabel(r.tradeKey) || r.tradeKey : null,
    sourceLabel: r.sourceProvider ? getDiscoveryProvider(r.sourceProvider)?.label || r.sourceProvider : null,
  });
  return NextResponse.json({
    focusId: focus.id,
    columns: GROUP_COLUMNS,
    rows: group.rows.map(label),
    merged: group.merged.map(label),
    gaps: group.gaps,
    canMerge: group.canMerge,
  });
}
