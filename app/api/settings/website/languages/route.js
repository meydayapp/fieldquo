// app/api/settings/website/languages/route.js
//
// Which languages the public website is published in.
//
// PUT  { languages: ["en","fr"] }   set the list (first = primary)
// POST { language: "fr" }           generate the content for one
//
// ── Adding a language is two separate acts ─────────────────────────────────
//
// Enabling it, and writing it. They're split because the second costs a model
// call and the first doesn't — and because a company that enables French and
// then hits a quota limit should still have a coherent site rather than a
// half-written one.
//
// A language is only ever SERVED once its content exists. `languages` is
// filtered on read against what's actually been written, so the switcher can
// never offer a link to a page that would render in the wrong language.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { generateSite } from "@/lib/site/generateSite";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { recordActivity } from "@/lib/activity/log";
import { SITE_LANGUAGES } from "@/lib/site/siteCopy";
import { recentJobPhotos, jobPhotoPairs } from "@/lib/site/jobPhotos";
import { categoryLabel } from "@/lib/i18n/translateContent";

function isAdmin(role) {
  return role === "owner" || role === "admin";
}

/**
 * Everything generateSite needs. Mirrors loadSource in the parent route.
 *
 * Service names are handed over ALREADY in the target language, because the
 * model is told to reproduce them exactly — that guard is what stops it
 * inventing a trade the company doesn't offer, so the translation has to happen
 * before the prompt, not inside it. It also means the blurbs it writes are about
 * "Peinture intérieure" rather than about a name the page will never show.
 */
async function loadSource(companyId, language) {
  const [enabled, testimonials, photos, photoPairs, areas] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { key: true, label: true, labelTranslations: true } } },
    }),
    db.testimonial.findMany({
      where: { companyId, approved: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
      take: 6,
    }),
    recentJobPhotos(companyId, 12),
    jobPhotoPairs(companyId, 6),
    db.workArea.findMany({ where: { companyId }, select: { name: true }, take: 40 }),
  ]);
  return {
    services: enabled
      .map((e) => e.category)
      .filter(Boolean)
      .map((c) => ({ key: c.key, label: categoryLabel(c, language) })),
    testimonials,
    photos,
    photoPairs,
    areas: areas.map((a) => a.name).filter(Boolean),
  };
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the website." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  // Only languages the product can actually deliver a whole site in. Punjabi and
  // Tagalog are declared in the language list but have no site copy behind them
  // (see lib/site/siteCopy.js), so offering them here would publish a page with
  // an English frame around translated content.
  const wanted = (Array.isArray(body.languages) ? body.languages : [])
    .map((c) => String(c || "").toLowerCase())
    .filter((c) => SITE_LANGUAGES.includes(c));
  const languages = [...new Set(wanted)];

  if (!languages.length) {
    return NextResponse.json(
      { error: "Pick at least one language for your site." },
      { status: 400 },
    );
  }

  const site = await db.companySite.findUnique({
    where: { companyId: member.companyId },
    select: { translations: true, languages: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Create your site first." }, { status: 409 });
  }

  // Dropping a language discards its content. Said in the response rather than
  // done silently — that content cost a generation to produce.
  const translations = { ...(site.translations || {}) };
  const removed = [];
  for (const code of Object.keys(translations)) {
    if (!languages.includes(code)) {
      delete translations[code];
      removed.push(code);
    }
  }

  const updated = await db.companySite.update({
    where: { companyId: member.companyId },
    data: { languages, translations },
    select: { languages: true },
  });

  await recordActivity(member, {
    action: "website.languages_set",
    entityType: "settings",
    summary: `Website languages: ${languages.join(", ")}`,
    metadata: { languages, removed },
  });

  return NextResponse.json({ languages: updated.languages, removed });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the website." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const language = String(body.language || "").toLowerCase();
  if (!SITE_LANGUAGES.includes(language)) {
    return NextResponse.json(
      { error: "That language isn't available for websites yet." },
      { status: 400 },
    );
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }

  const [company, site] = await Promise.all([
    db.company.findUnique({ where: { id: member.companyId } }),
    db.companySite.findUnique({ where: { companyId: member.companyId } }),
  ]);
  if (!site) {
    return NextResponse.json({ error: "Create your site first." }, { status: 409 });
  }

  const source = await loadSource(member.companyId, language);
  const languages = site.languages?.length ? site.languages : ["en"];
  const primary = languages[0];

  if (language === primary) {
    return NextResponse.json(
      { error: "That's already your main language — regenerate the site instead." },
      { status: 400 },
    );
  }

  const result = await generateSite({
    company,
    ...source,
    language,
    // The same interview, so the French page describes the same business in the
    // same voice rather than being a different site that happens to be French.
    interview: site.interview || {},
    // The EXISTING page in the primary language, so photos and before/after
    // pairs carry across instead of the translation arriving with none.
    existingBlocks: Array.isArray(site.blocks) ? site.blocks : [],
    onUsage: (u) =>
      recordAiUsage({
        companyId: member.companyId,
        feature: "website",
        userId: member.userId,
        ...u,
      }),
  });

  const translations = {
    ...(site.translations || {}),
    [language]: {
      blocks: result.blocks,
      seoTitle: result.seoTitle,
      seoDescription: result.seoDescription,
      generated: result.generated,
      at: new Date().toISOString(),
    },
  };

  await db.companySite.update({
    where: { companyId: member.companyId },
    data: {
      translations,
      // Enabling on success, not before: a language in the list with no content
      // behind it would put a link in the switcher to a page that renders in the
      // wrong language.
      languages: languages.includes(language) ? languages : [...languages, language],
    },
  });

  await recordActivity(member, {
    action: "website.language_generated",
    entityType: "settings",
    summary: `Wrote the website in ${language}`,
    metadata: { language, generated: result.generated },
  });

  return NextResponse.json({
    language,
    generated: result.generated,
    sections: result.blocks.filter((b) => b.visible !== false).length,
  });
}
