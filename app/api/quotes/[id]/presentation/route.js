// app/api/quotes/[id]/presentation/route.js
//
// THIS quote's proposal: which sections the homeowner will see, which
// library documents, the crew size behind the day plan, and the waivers
// attached. GET answers the Presentation panel; PATCH saves the overrides.
//
// The same three-state rule as the email sections next door: `null` on a
// section means "follow the company default", and the input reader accepts
// all three values and refuses anything else rather than coercing
// (lib/proposal/sections.js#readPresentationInput, shared with the create
// POST in app/api/quotes/route.js).
//
// The answer itself is built by lib/proposal/panel.js, shared with
// /api/quotes/new/presentation — the same panel on a quote that has not been
// saved yet. See that file's header for which two pieces a save is genuinely
// needed for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { readPresentationInput } from "@/lib/proposal/sections";
import { presentProposalPanel } from "@/lib/proposal/panel";

const QUOTE_SELECT = {
  id: true, quoteNumber: true, language: true, presentation: true, status: true,
  scopeGroups: { orderBy: { sortOrder: "asc" }, select: { categoryId: true, takeoff: true, category: { select: { key: true } } } },
};

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
  if (denied) return denied;
  const quote = await db.quote.findFirst({ where: { id, companyId: member.companyId }, select: QUOTE_SELECT });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await presentProposalPanel({ member, quote }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "edit quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const quote = await db.quote.findFirst({ where: { id, companyId: member.companyId }, select: QUOTE_SELECT });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  // The same reader the builder's create POST uses (app/api/quotes/route.js)
  // and the same one the panel merges with in create mode — see
  // lib/proposal/sections.js#readPresentationInput. It was written out
  // longhand here, and a second copy for the create path is the copy that
  // rots, because it is the one nobody looks at.
  const { error: invalid, value: saved, changed } = readPresentationInput(body, quote.presentation);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!changed.length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.quote.update({
    where: { id },
    data: { presentation: saved },
    select: QUOTE_SELECT,
  });
  await recordActivity(member, {
    action: "quote.presentation_updated",
    entityType: "quote",
    entityId: id,
    summary: `Changed the client proposal on ${quote.quoteNumber}`,
    metadata: { changed },
  });
  return NextResponse.json(await presentProposalPanel({ member, quote: updated }));
}
