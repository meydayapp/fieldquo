// app/api/funnels/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { sanitiseFunnelSteps, funnelHasForm } from "@/app/data/funnelBlocks";
import { slugifyFunnel, uniqueFunnelSlug } from "@/lib/funnels/slug";

async function requireAdmin(request) {
  const member = await getCurrentMember(request);
  if (!member) return { error: "Unauthorized", status: 401 };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only owners and admins can manage funnels.", status: 403 };
  }
  return { member };
}

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const funnel = await db.funnel.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!funnel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Company branding + slug so the builder can render a branded preview and show
  // the public /f/<slug>/<funnel> link without a second round-trip.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true, slug: true, logoUrl: true, brandColor: true },
  });
  return NextResponse.json({ ...funnel, company });
}

export async function PATCH(request, { params }) {
  const gate = await requireAdmin(request);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { member } = gate;

  const { id } = await params;
  const existing = await db.funnel.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, 120);
  }
  if (Array.isArray(body.steps)) {
    data.steps = sanitiseFunnelSteps(body.steps);
  }
  if (body.theme !== undefined) data.theme = body.theme || null;

  // Pixels — plain identifiers, trimmed. Empty string clears.
  for (const [field, key] of [
    ["metaPixelId", "metaPixelId"],
    ["tiktokPixelId", "tiktokPixelId"],
    ["ga4Id", "ga4Id"],
  ]) {
    if (body[key] !== undefined) {
      const v = typeof body[key] === "string" ? body[key].trim().slice(0, 64) : "";
      data[field] = v || null;
    }
  }

  // Rename requires a fresh slug (unique per company).
  if (data.name && data.name !== existing.name) {
    data.slug = await uniqueFunnelSlug(db, member.companyId, slugifyFunnel(data.name), id);
  }

  // Publishing is blocked unless the funnel can actually capture a lead — a
  // published funnel with no form step collects nothing, the classic dead
  // control this codebase is swept for.
  if (body.status === "published" || body.status === "draft") {
    if (body.status === "published") {
      const steps = data.steps || existing.steps;
      if (!funnelHasForm(steps)) {
        return NextResponse.json(
          { error: "Add a contact step before publishing — a funnel with no form captures nothing." },
          { status: 400 },
        );
      }
    }
    data.status = body.status;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await db.funnel.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await recordActivity(member, {
      action: data.status === "published" ? "funnel.published" : "funnel.unpublished",
      entityType: "funnel",
      entityId: id,
      summary: `${data.status === "published" ? "Published" : "Unpublished"} funnel "${updated.name}"`,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const gate = await requireAdmin(request);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { member } = gate;

  const { id } = await params;
  const existing = await db.funnel.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.funnel.delete({ where: { id } });
  await recordActivity(member, {
    action: "funnel.deleted",
    entityType: "funnel",
    entityId: id,
    summary: `Deleted funnel "${existing.name}"`,
  });
  return NextResponse.json({ ok: true });
}
