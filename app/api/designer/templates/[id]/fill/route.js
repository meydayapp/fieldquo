// app/api/designer/templates/[id]/fill/route.js
//
// POST — one template, every slide and every format, filled for the caller's
// company: brand colour, logo, name, phone, website, town, language, a real
// approved review when there is one, and photos from one of its own jobs
// (body.jobId, or the most recent job with a tagged before/after pair). This
// is what the campaign editor saves into the design's layouts when somebody
// applies a template (CampaignEditor.js applyTemplate()).
//
// A read, not a write — nothing is stored here. The editor saves the result
// through the ordinary layouts route, so applying a template goes through the
// same save, fingerprint and approval path as any other edit.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadTemplateContext } from "@/lib/designer/templateContext";
import { fillTemplateSlides } from "@/lib/designer/templateFill";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const template = await db.designTemplate.findFirst({
    where: {
      id,
      archivedAt: null,
      OR: [{ companyId: null }, { companyId: member.companyId }],
    },
    select: { id: true, key: true, json: true, width: true, height: true, slides: true },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ctx = await loadTemplateContext(member.companyId, {
    photos: true,
    jobId: typeof body?.jobId === "string" ? body.jobId : null,
  });
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The two original starters have one document and no per-format slides;
  // they come back as a single slide in whatever frame they were drawn for.
  const slides = Array.isArray(template.slides) && template.slides.length
    ? template.slides
    : [{ legacy: { json: template.json, width: template.width, height: template.height } }];

  return NextResponse.json({
    slides: fillTemplateSlides(slides, ctx),
    legacy: !Array.isArray(template.slides) || !template.slides.length,
    // Which job the photos came from, so the editor can say so — or null when
    // no job had photos that fit, and every slot is still "Add a photo".
    jobId: ctx.jobId,
  });
}
