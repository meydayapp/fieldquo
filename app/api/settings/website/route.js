// app/api/settings/website/route.js
//
// The company's own website: read it, save it, publish it.
//
//   GET    — the site, or a not-yet-created shell with a suggested subdomain
//   PUT    — save blocks, subdomain, SEO
//   POST   — generate a first draft (the only path that spends tokens)
//   DELETE — unpublish
//
// Owners and admins only. A published page is the company's public face, and
// an employee with quote access has no business rewriting it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { sanitiseBlocks, siteFromCompany } from "@/app/data/siteBlocks";
import { validateSubdomain, suggestSubdomain } from "@/lib/site/subdomain";
import { generateSite, INTERVIEW_QUESTIONS } from "@/lib/site/generateSite";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  province: true,
  bookingSlug: true,
};

async function requireAdmin(request) {
  const member = await getCurrentMember(request);
  if (!member) return { error: "Unauthorized", status: 401 };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      error: "Only owners and admins can edit the website.",
      status: 403,
    };
  }
  return { member };
}

/** The company's enabled services and approved testimonials, as facts. */
async function loadSource(companyId) {
  const [enabled, testimonials] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { key: true, label: true } } },
    }),
    db.testimonial.findMany({
      where: { companyId, approved: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
      take: 6,
    }),
  ]);

  return {
    services: enabled.map((e) => e.category).filter(Boolean),
    testimonials,
  };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const [company, site] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: COMPANY_SELECT,
    }),
    db.companySite.findUnique({ where: { companyId: member.companyId } }),
  ]);

  return NextResponse.json({
    // Null until they create one. The editor uses this to decide between the
    // setup interview and the block editor.
    site: site || null,
    // Always a valid suggestion, even when Company.slug is reserved — see
    // suggestSubdomain.
    suggestedSubdomain: site?.subdomain || suggestSubdomain(company || {}),
    company,
    questions: INTERVIEW_QUESTIONS,
  });
}

/** Save. Never publishes as a side effect — that's an explicit flag. */
export async function PUT(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const subdomain = String(body.subdomain || "").trim().toLowerCase();

  const check = validateSubdomain(subdomain);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  // Taken by someone else. Checked before the write rather than relying on the
  // unique constraint, so the message names the problem instead of surfacing
  // a Prisma error.
  const clash = await db.companySite.findFirst({
    where: { subdomain, NOT: { companyId: member.companyId } },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `${subdomain}.fieldquo.com is already taken. Try another.` },
      { status: 409 },
    );
  }

  const data = {
    subdomain,
    blocks: sanitiseBlocks(body.blocks),
    seoTitle: str(body.seoTitle, 70),
    seoDescription: str(body.seoDescription, 200),
    ...(body.interview && typeof body.interview === "object"
      ? { interview: body.interview }
      : {}),
    ...(typeof body.published === "boolean"
      ? {
          published: body.published,
          // Set once, on first publish. A company that unpublishes and
          // republishes hasn't launched twice.
          ...(body.published ? { publishedAt: new Date() } : {}),
        }
      : {}),
  };

  const site = await db.companySite.upsert({
    where: { companyId: member.companyId },
    create: { companyId: member.companyId, ...data },
    update: data,
  });

  return NextResponse.json(site);
}

/**
 * Generate a draft. The only path here that costs money.
 *
 * Returns blocks WITHOUT saving them: the company previews and can regenerate
 * or discard. Persisting a generation they haven't seen would overwrite edits
 * they made before pressing the button.
 */
export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: COMPANY_SELECT,
  });
  if (!company)
    return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { services, testimonials } = await loadSource(member.companyId);

  try {
    const result = await generateSite({
      company,
      services,
      testimonials,
      interview: body.interview || {},
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "website",
          userId: member.userId,
          ...u,
        }),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[settings/website] generation failed:", err);
    // A failed generation still returns a usable site rather than an error
    // screen — the whole point of the factual fallback.
    return NextResponse.json({
      blocks: siteFromCompany({ company, services, testimonials }),
      seoTitle: null,
      seoDescription: null,
      generated: false,
      note: "Couldn't reach the writing assistant, so this draft is built from your saved details. Everything on it is editable.",
    });
  }
}

/** Unpublish. The site and its content survive; it just stops being public. */
export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const site = await db.companySite.updateMany({
    where: { companyId: member.companyId },
    data: { published: false },
  });

  return NextResponse.json({ unpublished: site.count > 0 });
}

function str(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}
