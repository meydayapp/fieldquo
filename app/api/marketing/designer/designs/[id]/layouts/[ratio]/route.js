// app/api/marketing/designer/designs/[id]/layouts/[ratio]/route.js
//
// The one write the campaign editor page calls on every autosave — see
// app/app/marketing/designer/[id]/page.js's per-ratio saveCallback, wired
// through Editor.js's own 500ms debounce (app/components/designer/Editor.js).
//
// PUT, not POST: saving the same ratio again REPLACES its layout (upsert on
// the [designId, ratioKey] unique key in the schema) rather than
// accumulating history rows — matching MarketingDesignLayout's own doc
// comment. This is the mechanism that keeps every ratio's adjustments
// independent: a save here never touches any OTHER ratioKey's row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ratio as ratioByKey } from "@/lib/marketing/ratios";

async function loadOwnedDesign(companyId, id) {
  const design = await db.marketingDesign.findUnique({ where: { id } });
  if (!design || design.companyId !== companyId) return null;
  return design;
}

export async function PUT(request, { params }) {
  const { id, ratio: ratioParam } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  // A ratio key not in AD_RATIOS is refused rather than silently accepted —
  // otherwise a stale client build could write a row that "Download all"
  // (which iterates AD_RATIOS by name) would never find or export again.
  const ratioDef = ratioByKey(ratioParam);
  if (!ratioDef) {
    return NextResponse.json({ error: "Unknown aspect ratio." }, { status: 400 });
  }

  const design = await loadOwnedDesign(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // The editor's own contract (lib/designer/constants.js's saveCallback
  // typedef): json is a STRINGIFIED canvas.toJSON() document. Parsed here so
  // it stores as native Json — DesignTemplate.json's own convention — and so
  // a malformed payload is refused with a real 400 instead of being written
  // as an opaque string nothing downstream can query or trust.
  let parsedJson;
  try {
    parsedJson = typeof body?.json === "string" ? JSON.parse(body.json) : body?.json;
  } catch {
    return NextResponse.json({ error: "json is not valid JSON." }, { status: 400 });
  }
  if (!parsedJson || typeof parsedJson !== "object" || !Array.isArray(parsedJson.objects)) {
    return NextResponse.json({ error: "json must be a fabric canvas document." }, { status: 400 });
  }

  const width = Number(body?.width);
  const height = Number(body?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return NextResponse.json({ error: "width and height must be positive numbers." }, { status: 400 });
  }

  const layout = await db.marketingDesignLayout.upsert({
    where: { designId_ratioKey: { designId: id, ratioKey: ratioDef.key } },
    create: {
      designId: id,
      ratioKey: ratioDef.key,
      json: parsedJson,
      width,
      height,
    },
    update: {
      json: parsedJson,
      width,
      height,
    },
  });

  // Bumps the parent's updatedAt so the designer index's "last edited" sort
  // reflects a save made through a ratio tab, not just a rename.
  await db.marketingDesign.update({ where: { id }, data: { updatedAt: new Date() } });

  return NextResponse.json(layout);
}
