// app/api/funnels/generate/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { generateFunnel } from "@/lib/funnels/generate";
import { slugifyFunnel, uniqueFunnelSlug } from "@/lib/funnels/slug";

// Describe a funnel, get one built — grounded on the company's real services,
// with a factual template fallback when AI is unavailable (generateFunnel never
// throws for that reason). Creates a DRAFT the contractor then edits.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners and admins can manage funnels." },
      { status: 403 },
    );
  }

  const { prompt } = await request.json().catch(() => ({}));

  // Metered like every other model call. A factual fallback exists, but honour
  // the quota — an over-limit company gets the template, not a silent AI call.
  const quota = await checkAiQuota(member.companyId);

  const [company, enabled] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true, currency: true },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: { category: { select: { key: true, label: true } } },
    }),
  ]);
  const services = enabled.map((e) => e.category).filter(Boolean);

  const result = await generateFunnel({
    company,
    services,
    prompt,
    // Skip the model entirely when over quota — generateFunnel returns the
    // deterministic template if isAiConfigured() is the only gate, so we gate
    // usage here by not passing onUsage / by forcing the fallback.
    onUsage: quota.allowed
      ? (u) =>
          recordAiUsage({
            companyId: member.companyId,
            feature: "funnel",
            userId: member.userId,
            ...u,
          })
      : undefined,
    forceFallback: !quota.allowed,
  });

  const slug = await uniqueFunnelSlug(db, member.companyId, slugifyFunnel(result.name));
  const funnel = await db.funnel.create({
    data: {
      companyId: member.companyId,
      name: result.name,
      slug,
      channel: result.channel,
      steps: result.steps,
      status: "draft",
      createdById: member.userId,
    },
    select: { id: true, name: true, slug: true, status: true },
  });

  await recordActivity(member, {
    action: "funnel.generated",
    entityType: "funnel",
    entityId: funnel.id,
    summary: `Generated funnel "${funnel.name}" with AI`,
    metadata: { channel: result.channel, aiUsed: result.generated },
  });

  return NextResponse.json({ ...funnel, aiUsed: result.generated }, { status: 201 });
}
