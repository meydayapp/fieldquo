// app/api/funnels/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { buildFunnelFromTemplate } from "@/lib/funnels/templates";
import { slugifyFunnel, uniqueFunnelSlug } from "@/lib/funnels/slug";

// Same gate as the website builder — a funnel is a public marketing surface.
/**
 * @param read  true only on GET, and it is the platform console's carve-out.
 *              Non-negotiable #3: FieldQuo views everything and edits nothing.
 *              A support session's role is "viewer", which holds no permission
 *              at all, so gating the read on user:manage would blind the
 *              console to the funnel it is being asked about. Copied in shape
 *              from app/api/settings/website/route.js, including the reason it
 *              is an ARGUMENT the read opts into rather than a line inside the
 *              gate: a write must not be able to acquire it by editing one
 *              place. POST here and PATCH/DELETE on [id] call this with no
 *              options and stay closed to impersonation.
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

// ── The read was open, and a funnel is the lead machine ───────────────────
//
// POST here and PATCH/DELETE on [id] all go through requireAdmin above. This
// GET had no gate at all, so every member — Crew included — could enumerate
// the company's lead funnels: what campaigns exist, which are live, and how
// many leads each has captured (`_count.responses`). That is the sales
// pipeline's shape, and it is the one thing an employee about to leave for a
// competitor would most want to copy.
//
// Same gate as the writes, through the same helper — reusing it rather than
// restating the check is what keeps the read and the write from drifting, and
// it is what gives the read the impersonation carve-out documented above.
export async function GET(request) {
  const gate = await requireAdmin(request, { read: true });
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { member } = gate;

  const funnels = await db.funnel.findMany({
    where: { companyId: member.companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      channel: true,
      updatedAt: true,
      _count: { select: { responses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(funnels);
}

export async function POST(request) {
  const gate = await requireAdmin(request);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { member } = gate;

  const body = await request.json().catch(() => ({}));

  // Seed the funnel: from a channel template (default), or from a caller-provided
  // steps array (the AI generator / duplicate), or an empty scaffold.
  let name = (body.name || "").trim();
  let channel = body.channel || null;
  let steps;

  if (Array.isArray(body.steps)) {
    steps = sanitiseFunnelSteps(body.steps);
  } else if (body.template) {
    const [company, enabled] = await Promise.all([
      db.company.findUnique({ where: { id: member.companyId }, select: { name: true, currency: true } }),
      db.companyServiceCategory.findMany({
        where: { companyId: member.companyId, enabled: true },
        select: { category: { select: { key: true, label: true } } },
      }),
    ]);
    const services = enabled.map((e) => e.category).filter(Boolean);
    const built = buildFunnelFromTemplate(body.template, { company, services });
    steps = sanitiseFunnelSteps(built.steps);
    if (!name) name = built.name;
    channel = channel || built.channel;
  } else {
    steps = sanitiseFunnelSteps([
      { id: "intro", kind: "intro", headline: name || "Get a quote", buttonText: "Get started" },
      { id: "contact", kind: "form", headline: "Your details", fields: ["name", "email", "phone"], buttonText: "Submit" },
      { id: "done", kind: "thankyou", headline: "Thanks — we'll be in touch." },
    ]);
  }

  if (!name) name = "Untitled funnel";
  const slug = await uniqueFunnelSlug(db, member.companyId, slugifyFunnel(name));

  const funnel = await db.funnel.create({
    data: {
      companyId: member.companyId,
      name,
      slug,
      channel,
      steps,
      status: "draft",
      createdById: member.userId,
    },
    select: { id: true, name: true, slug: true, status: true },
  });

  await recordActivity(member, {
    action: "funnel.created",
    entityType: "funnel",
    entityId: funnel.id,
    summary: `Created funnel "${funnel.name}"`,
    metadata: { template: body.template || null, channel },
  });

  return NextResponse.json(funnel, { status: 201 });
}
