// app/api/designer/templates/route.js
//
// The Marketing Designer's template gallery. Free — no feature gate, no spend
// check. Restored per the owner's 2026-08-30 correction: every editor feature
// in the ported clone exists in FieldQuo except AI image generation, which is
// the only premium piece.
//
// ══ Two shelves (2026-09-29) ══════════════════════════════════════════════
//
//   FieldQuo templates — DesignTemplate rows with companyId null: the
//     contractor catalogue (lib/designer/templateCatalog.js) and the two
//     original generic starters. Every company sees the same shelf.
//   Your templates — rows with companyId = the caller's company, made with
//     "Save as template" (POST below). Nobody else ever sees them: every read
//     and write here is scoped in its WHERE clause, not filtered afterwards.
//
// Archived rows (a company template somebody deleted — see [id]/route.js)
// are excluded from both.
//
// Each catalogue template comes back with a PREVIEW already in the company's
// own brand colour, language and details (templateFill.js), so the sidebar
// shows what the person will actually get — photo slots stay placeholders
// here; the real job photos go in when a template is applied
// ([id]/fill/route.js).
export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { loadTemplateContext } from "@/lib/designer/templateContext";
import { fillTemplateDoc } from "@/lib/designer/templateFill";
import { groupSlides } from "@/lib/marketing/slides";
import { PORTRAIT } from "@/lib/marketing/destinations";

const MAX_NAME = 80;

const LIST_SELECT = {
  id: true,
  key: true,
  name: true,
  displayName: true,
  category: true,
  companyId: true,
  json: true,
  width: true,
  height: true,
  slides: true,
  thumbnailUrl: true,
  createdAt: true,
};

/** The first slide's 4:5 layout, else its first layout, else the row's own json. */
function previewLayout(row) {
  const first = Array.isArray(row.slides) ? row.slides[0] : null;
  if (first && typeof first === "object") {
    const layout = first[PORTRAIT] || Object.values(first)[0];
    if (layout?.json) return layout;
  }
  return { json: row.json, width: row.width, height: row.height };
}

function toItem(row, ctx) {
  const preview = previewLayout(row);
  const slides = Array.isArray(row.slides) ? row.slides : null;
  return {
    id: row.id,
    key: row.key,
    // A company template's own name; a catalogue template is named by the
    // client from its key (app.designerTemplates.name.<key>), with this as
    // the fallback for the two original starters.
    name: row.displayName || row.name,
    category: row.category,
    own: Boolean(row.companyId),
    slideCount: slides ? slides.length : 1,
    formats: slides ? Object.keys(slides[0] || {}) : [],
    thumbnailUrl: row.thumbnailUrl,
    preview: {
      json: ctx ? fillTemplateDoc(preview.json, ctx) : preview.json,
      width: preview.width,
      height: preview.height,
    },
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const [rows, ctx] = await Promise.all([
    db.designTemplate.findMany({
      where: {
        archivedAt: null,
        OR: [{ companyId: null }, { companyId: member.companyId }],
      },
      orderBy: { createdAt: "asc" },
      select: LIST_SELECT,
    }),
    loadTemplateContext(member.companyId, { photos: false }),
  ]);

  // An empty gallery is a real, honest state — TemplateSidebar renders its
  // own "no templates yet" copy for it rather than a screen that implies a
  // fetch failed.
  const own = rows.filter((r) => r.companyId === member.companyId).map((r) => toItem(r, null));
  const catalog = rows.filter((r) => r.companyId === null).map((r) => toItem(r, ctx));
  return NextResponse.json({ own, catalog, templates: [...own, ...catalog] });
}

/**
 * "Save as template" — the design the person has open, every slide and every
 * format it has, becomes one of this company's templates.
 */
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
  const designId = typeof body?.designId === "string" ? body.designId : "";

  // From the saved rows, never from a document the browser sends: a template
  // is what the design IS, and a body could claim anything.
  const design = designId
    ? await db.marketingDesign.findFirst({
        where: { id: designId, companyId: member.companyId },
        select: {
          id: true,
          name: true,
          layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
          slideLayouts: { select: { position: true, ratioKey: true, json: true, width: true, height: true } },
        },
      })
    : null;
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!design.layouts.length) {
    return NextResponse.json({ error: "Save the design first — there's nothing on it to keep yet." }, { status: 409 });
  }

  const slides = groupSlides(design.layouts, design.slideLayouts).filter((s) => Object.keys(s).length);
  const primary = slides[0][PORTRAIT] || Object.values(slides[0])[0];

  const row = await db.designTemplate.create({
    data: {
      // `name` is unique across every company, so it cannot be what a person
      // typed — two companies may both call theirs "Spring promo". It is an
      // internal handle; `displayName` is theirs. See the schema.
      name: `company-template:${randomUUID()}`,
      displayName: name,
      companyId: member.companyId,
      slides,
      json: primary.json,
      width: primary.width,
      height: primary.height,
    },
    select: LIST_SELECT,
  });

  await recordActivity(member, {
    action: "marketing.template_saved",
    entityType: "settings",
    entityId: row.id,
    summary: `Saved "${design.name}" as the template "${name}"`,
    metadata: { designId: design.id, slides: slides.length },
  }).catch(() => {});

  return NextResponse.json(toItem(row, null), { status: 201 });
}
