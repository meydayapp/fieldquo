// app/api/settings/presentation/route.js
//
// The company's side of the client proposal: the story ("About us") and
// which sections are on by default for a new quote. GET returns the current
// values; PATCH saves only the keys that were sent — the shape every
// settings route in this app uses.
//
// The gallery and the document library have routes of their own
// (/api/settings/gallery, /api/settings/company-documents); this one is the
// four story columns and the section defaults.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { PROPOSAL_SECTION_KEYS, sanitiseCompanySections } from "@/lib/proposal/sections";
import { PROPOSAL_COMPANY_SELECT, loadProposalContent } from "@/lib/proposal/load";
// The story and its headline are read by a client in the quote's language;
// a save drafts the other languages after the response.
import { scheduleAutoTranslate } from "@/lib/i18n/autoTranslateSchedule";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

async function present(companyId, company) {
  // What each section currently has behind it, so the settings page can grey
  // a switch that would change nothing — the same rule the quote panel uses.
  const { content, sections } = await loadProposalContent({ companyId, company, language: company.defaultLanguage || "en" });
  return {
    story: company.story || "",
    storyHeadline: company.storyHeadline || "",
    storyVideoUrl: company.storyVideoUrl || "",
    teamPhotoUrl: company.teamPhotoUrl || "",
    sections: PROPOSAL_SECTION_KEYS.map((key) => ({
      key,
      on: sections[key].companyDefault,
      hasContent: sections[key].hasContent,
    })),
    counts: {
      beforeAfter: content.gallery.length,
      documents: content.documents.length,
      testimonials: content.testimonials.length,
      services: content.services.length,
    },
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { ...PROPOSAL_COMPANY_SELECT, defaultLanguage: true },
  });
  return NextResponse.json(await present(member.companyId, company || {}));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can change the client proposal." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  const changed = [];

  if ("story" in body) {
    data.story = str(body.story).slice(0, 4000) || null;
    changed.push("story");
  }
  if ("storyHeadline" in body) {
    data.storyHeadline = str(body.storyHeadline).slice(0, 160) || null;
    changed.push("storyHeadline");
  }
  if ("storyVideoUrl" in body) {
    const url = str(body.storyVideoUrl).slice(0, 1000);
    if (url && !HTTP_URL.test(url)) {
      return NextResponse.json({ error: "The video link must start with http:// or https://." }, { status: 400 });
    }
    data.storyVideoUrl = url || null;
    changed.push("storyVideoUrl");
  }
  if ("teamPhotoUrl" in body) {
    const url = str(body.teamPhotoUrl).slice(0, 1000);
    if (url && !HTTP_URL.test(url)) {
      return NextResponse.json({ error: "The team photo must be an uploaded image." }, { status: 400 });
    }
    data.teamPhotoUrl = url || null;
    changed.push("teamPhotoUrl");
  }
  if ("sections" in body) {
    // Only booleans on known keys survive; a merge with what is stored, so
    // flipping one switch does not silently reset the others.
    const current = (await db.company.findUnique({ where: { id: member.companyId }, select: { proposalSections: true } }))?.proposalSections;
    const merged = { ...(sanitiseCompanySections(current) || {}), ...(sanitiseCompanySections(body.sections) || {}) };
    data.proposalSections = Object.keys(merged).length ? merged : null;
    changed.push("sections");
  }

  if (!changed.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.company.update({
    where: { id: member.companyId },
    data,
    select: { ...PROPOSAL_COMPANY_SELECT, defaultLanguage: true },
  });

  await recordActivity(member, {
    action: "settings.presentation_updated",
    entityType: "company",
    entityId: member.companyId,
    summary: "Updated the client proposal (story / section defaults)",
    metadata: { changed },
  });

  const textChanged = changed.filter((k) => k === "story" || k === "storyHeadline");
  const autoTranslate = textChanged.length
    ? scheduleAutoTranslate({
        companyId: member.companyId,
        model: "company",
        fields: Object.fromEntries(textChanged.map((k) => [k, updated[k] || ""])),
        sourceLanguage: updated.defaultLanguage || "en",
      })
    : null;

  return NextResponse.json({ ...(await present(member.companyId, updated)), autoTranslate });
}

