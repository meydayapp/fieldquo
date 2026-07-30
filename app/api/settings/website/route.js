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
import {
  generateSite,
  INTERVIEW_QUESTIONS,
  STYLE_PRESETS,
} from "@/lib/site/generateSite";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { SITE_STYLES, SITE_STYLE_KEYS } from "@/lib/site/siteStyles";
import { recentJobPhotos, jobPhotoPairs } from "@/lib/site/jobPhotos";
import { COMPOSITION_PRESETS, COMPOSITION_KEYS } from "@/lib/site/composition";
import { siteGaps } from "@/lib/site/gaps";
import { countPlaceholders, isPlaceholder } from "@/lib/site/placeholderImages";

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
  // The site blocks render hours, the booking calendar and the quote form
  // from these rather than from typed text — see the "derived" blocks in
  // app/data/siteBlocks.js. The editor needs them to decide which blocks to
  // offer at all.
  businessHours: true,
  timezone: true,
  weekStartsOn: true,
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
  // Everything the composer needs to decide what the page can contain. Loaded
  // together because "which sections are possible" is one question — asking it
  // in pieces is how a page ends up with a gallery heading and no photos.
  const [enabled, testimonials, photos, photoPairs, areas] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { key: true, label: true } } },
    }),
    db.testimonial.findMany({
      where: { companyId, approved: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
      take: 6,
    }),
    recentJobPhotos(companyId, 12),
    jobPhotoPairs(companyId, 6),
    db.workArea.findMany({
      where: { companyId },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 40,
    }),
  ]);

  return {
    services: enabled.map((e) => e.category).filter(Boolean),
    testimonials,
    photos,
    photoPairs,
    areas: areas.map((a) => a.name).filter(Boolean),
  };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const [company, site, source] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: COMPANY_SELECT,
    }),
    db.companySite.findUnique({ where: { companyId: member.companyId } }),
    loadSource(member.companyId),
  ]);

  // Photos available to pair FROM: whatever was uploaded to the site's own
  // library, plus what crews shot on job visits. One pool, so a photo doesn't
  // have to live inside a block before it can be used.
  const library = Array.isArray(site?.photoLibrary) ? site.photoLibrary : [];
  const libraryUrls = library.map((p) => p?.url).filter(Boolean);
  const photoPool = [...new Set([...libraryUrls, ...source.photos])];

  // Pairs the company has CONFIRMED, read off the block. Suggestions derived
  // from two-photo job visits are offered separately — a suggestion is not a
  // confirmation, and the difference matters on a public page.
  const confirmedPairs = (Array.isArray(site?.blocks) ? site.blocks : [])
    .filter((b) => b?.type === "beforeafter")
    .flatMap((b) => (Array.isArray(b.content?.pairs) ? b.content.pairs : []))
    .filter((x) => x?.before && x?.after);

  return NextResponse.json({
    // Only what's actually absent — see lib/site/gaps.js. The builder asks about
    // these and nothing else; everything the company record already holds is read
    // live and never re-requested.
    gaps: siteGaps({
      company: company || {},
      services: source.services,
      testimonials: source.testimonials,
      photos: photoPool,
      photoPairs: confirmedPairs,
      hasHours: Array.isArray(company?.businessHours)
        ? company.businessHours.some((d) => d && typeof d === "object" && !d.closed)
        : false,
    }),
    photoPool,
    suggestedPairs: source.photoPairs,
    confirmedPairs,
    chat: Array.isArray(site?.chat) ? site.chat : [],
    // Stock images still on the page. Surfaced so the builder can badge them and
    // warn before publishing — a placeholder that quietly goes live and stays
    // there for a year is the failure this count exists to prevent.
    placeholderCount: countPlaceholders(Array.isArray(site?.blocks) ? site.blocks : []),
    // Null until they create one. The editor uses this to decide between the
    // setup interview and the block editor.
    site: site || null,
    // Always a valid suggestion, even when Company.slug is reserved — see
    // suggestSubdomain.
    suggestedSubdomain: site?.subdomain || suggestSubdomain(company || {}),
    company,
    questions: INTERVIEW_QUESTIONS,
    // Served rather than imported by the editor — see the note at the top of
    // app/app/settings/website/page.js.
    stylePresets: STYLE_PRESETS,
    // Page shapes the company can pick directly, so choosing a different layout
    // doesn't require spending tokens on a regeneration.
    compositions: COMPOSITION_KEYS.map((key) => ({
      key,
      label: COMPOSITION_PRESETS[key].label,
      sections: COMPOSITION_PRESETS[key].sections,
    })),
    // The design styles the company (or the AI) can pick from. Label + hint
    // only; the visual rules stay server-side in lib/site/siteStyles.js.
    siteStyles: SITE_STYLE_KEYS.map((key) => ({
      key,
      label: SITE_STYLES[key].label,
      hint: SITE_STYLES[key].hint,
    })),
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
    // Clamped to the closed set — a styleKey from a browser can never become an
    // arbitrary style rule.
    ...(SITE_STYLE_KEYS.includes(body.styleKey)
      ? { styleKey: body.styleKey }
      : {}),
    ...(body.interview && typeof body.interview === "object"
      ? { interview: body.interview }
      : {}),
    // The conversation. Capped and shape-checked here rather than trusted: this
    // is a Json column written from a browser, and an unbounded array would grow
    // until the row stopped loading.
    // Set by the Sections pane, cleared by a generation. A boolean from the
    // browser rather than a diff on the server: the client knows whether a human
    // typed in a field, and reconstructing that by comparing block text would be
    // guesswork that gets it wrong the first time punctuation changes.
    ...(body.handEdited === true ? { handEditedAt: new Date() } : {}),
    ...(body.handEdited === false ? { handEditedAt: null } : {}),
    ...(Array.isArray(body.chat)
      ? {
          chat: body.chat
            .filter((m) => m && (m.role === "user" || m.role === "assistant"))
            .slice(-40)
            .map((m) => ({
              role: m.role,
              text: String(m.text || "").slice(0, 2000),
              at: typeof m.at === "string" ? m.at.slice(0, 40) : null,
              ...(m.meta && typeof m.meta === "object" ? { meta: m.meta } : {}),
            })),
        }
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
  const { services, testimonials, photos, photoPairs, areas } =
    await loadSource(member.companyId);

  // The page as currently SAVED. generateSite carries images across from it,
  // so pressing Regenerate rewrites the words without discarding the job
  // photos — which are the one thing on the page FieldQuo can't reproduce.
  //
  // Read from the database rather than taken from the request body: the
  // browser holds unsaved edits, and honouring those would make Regenerate
  // silently persist work the company hadn't chosen to save.
  const existing = await db.companySite.findUnique({
    where: { companyId: member.companyId },
    select: { blocks: true, handEditedAt: true },
  });

  try {
    const result = await generateSite({
      company,
      services,
      testimonials,
      // The real content: job photos become the gallery, two-photo visits become
      // before/after sliders, WorkArea rows become the areas-served list. None
      // of it is retyped, so none of it can go stale.
      photos,
      photoPairs,
      areas,
      interview: body.interview || {},
      existingBlocks: Array.isArray(existing?.blocks) ? existing.blocks : [],
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
      blocks: siteFromCompany({ company, services, testimonials, photos, photoPairs, areas }),
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
