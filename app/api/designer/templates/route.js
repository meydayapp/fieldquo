// app/api/designer/templates/route.js
//
// The Marketing Designer's starter-template gallery. Free — no feature gate,
// no spend check. Restored per the owner's 2026-08-30 correction: every
// editor feature in the ported clone exists in FieldQuo except AI image
// generation, which is the only premium piece.
//
// Global catalog (DesignTemplate has no companyId), so this is a plain read
// behind ordinary staff auth — any signed-in member of any company sees the
// same shelf, the same way every company sees the same Plan pricing tiers.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function GET(request) {
  const { response } = await memberOrRefusal(request);
  if (response) return response;

  const templates = await db.designTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      json: true,
      width: true,
      height: true,
      thumbnailUrl: true,
    },
  });

  // An empty gallery is a real, honest state — see prisma/seed-design-templates.js
  // for why only two rows are seeded today — so this returns `[]` rather than
  // an error. TemplateSidebar renders its own "no templates yet" copy for it,
  // which is the empty-state AGENTS.md asks for rather than a screen that
  // implies a fetch failed.
  return NextResponse.json({ templates });
}
