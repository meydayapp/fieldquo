// app/api/marketing/designer/designs/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

function requireMarketingManager(role) {
  requirePermission(role, "user:manage");
}

// Company-scoped load, mirroring app/api/marketing/campaigns/[id]'s
// loadOwned(): a findUnique by id, checked against companyId before the
// caller ever sees the row, rather than a findFirst({ where: { id,
// companyId } }) — either shape is company-scoped; this one matches the
// sibling file's own convention exactly.
async function loadOwned(companyId, id) {
  const design = await db.marketingDesign.findUnique({
    where: { id },
    include: {
      layouts: true,
      // The campaign's name is what assetFilename() (lib/marketing/ratios.js)
      // names every exported file after — the editor page needs it without a
      // second request, and it is the one field of the campaign this screen
      // has any use for.
      campaign: { select: { id: true, name: true } },
    },
  });
  if (!design || design.companyId !== companyId) return null;
  return design;
}

// The editor's whole reason to hit this route: every saved ratio's layout at
// once, so the campaign editor page can build its tab bar without a request
// per tab. See lib/designer/constants.js's JSON_KEYS for what `json` carries.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(design);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const existing = await loadOwned(member.companyId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // layouts cascade with the design (onDelete: Cascade on
  // MarketingDesignLayout.design) — one delete, not a fan-out of five.
  await db.marketingDesign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// Rename only — the layout content is written exclusively through
// .../layouts/[ratio], never through this route, so a PATCH here can never
// become the second way in scripts/check-feature-flags.mjs warns about.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const existing = await loadOwned(member.companyId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const updated = await db.marketingDesign.update({
    where: { id },
    data: { name },
    include: { layouts: true },
  });

  return NextResponse.json(updated);
}
