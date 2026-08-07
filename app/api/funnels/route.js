// app/api/funnels/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { buildFunnelFromTemplate } from "@/lib/funnels/templates";
import { slugifyFunnel, uniqueFunnelSlug } from "@/lib/funnels/slug";

// Same gate as the website builder — a funnel is a public marketing surface.
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

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
