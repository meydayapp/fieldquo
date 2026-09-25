// app/api/funnels/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { sanitiseFunnelSteps, funnelHasForm } from "@/app/data/funnelBlocks";
import { slugifyFunnel, uniqueFunnelSlug } from "@/lib/funnels/slug";
import { TRACKING_ID_FIELDS, validateTrackingIdsForWrite } from "@/lib/funnels/pixels";

/**
 * @param read  the platform console's carve-out on GET only — see the fuller
 *              note on the same helper in app/api/funnels/route.js. PATCH and
 *              DELETE below call this with no options and stay closed.
 */
async function requireAdmin(request, { read = false } = {}) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  if (read && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only owners and admins can manage funnels.", status: 403 };
  }
  return { member };
}

// Same defect and the same fix as the list — see the note on GET in
// app/api/funnels/route.js. This one is worse in degree: it returns the whole
// row, which is the funnel's every step and question, its theme, and the Meta,
// TikTok and GA4 pixel ids the company advertises through.
export async function GET(request, { params }) {
  const gate = await requireAdmin(request, { read: true });
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { member } = gate;

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

  // Pixels — validated to the shape each platform issues, and refused with
  // the field named when they are not (lib/funnels/pixels.js
  // validateTrackingIdsForWrite). This used to trim and store anything, so a
  // pasted `fbq('init', …)` line saved, said "Saved", and never loaded.
  //
  // Only a CHANGED id is validated. The builder posts all three on every
  // save, and an id stored before this rule — one the read-side allow-list
  // still fires — must not make the whole funnel unsaveable.
  const pixelBody = {};
  for (const key of TRACKING_ID_FIELDS) {
    if (body[key] === undefined) continue;
    const incoming = typeof body[key] === "string" ? body[key].trim() : body[key];
    if ((incoming || null) === (existing[key] || null)) continue;
    pixelBody[key] = incoming;
  }
  const pixelCheck = validateTrackingIdsForWrite(pixelBody);
  if (pixelCheck.errors.length) {
    return NextResponse.json(
      { error: "One of the pixel ids isn't in the shape the platform issues.", fields: pixelCheck.errors },
      { status: 400 },
    );
  }
  Object.assign(data, pixelCheck.data);

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
