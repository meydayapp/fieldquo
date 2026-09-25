// app/api/settings/kitchen-designer/route.js
//
// The company's own on/off for the Kitchen Designer — Company.
// kitchenDesignerOverride — and the answer the one gate gives today.
//
//   GET    → { override: true|false|null, grantingKeys: string[], on: boolean }
//   PATCH  { override: true|false|null }   owner/admin only
//
// ── Why an override exists at all ───────────────────────────────────────────
//
// 2026-09-25 the owner turned the designer on automatically for every
// kitchen-building trade (lib/kitchen/key.js). "Remodeling is on" is our
// guess about a company, not the company's statement: a remodeler who only
// does bathrooms would otherwise have a public "design your kitchen" page it
// never asked for, with no way to take it down short of switching off the
// trade it actually sells. And the other direction: a handyman or cabinet
// refinisher who does install kitchens can say so without pretending to be a
// general contractor.
//
// ── Why its own route, not a field on PATCH /api/settings/service-categories
//
// That PATCH takes the whole services list as an array and several screens
// depend on its plain-array GET. A company-level boolean folded into a
// per-category payload would be saved by every Services save, including the
// home page's set-up dialogs that never render the control — the "written by
// something that never showed it" shape AGENTS.md warns about.
//
// ── Why GET is open to any member ───────────────────────────────────────────
//
// Share your links (app/app/settings/lead-form) asks it whether to show the
// kitchen link, and that page is not owner-only. The answer carries no price
// and nothing another member could not already see in the app. Only the
// write is owner/admin, matching the Services switches beside it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import {
  companyKitchenDesignerState,
  kitchenDesignerOnPure,
  kitchenGrantingKeys,
} from "@/lib/kitchen/access";

async function stateFor(companyId) {
  const { enabledCategoryKeys, override } = await companyKitchenDesignerState(companyId);
  return {
    override,
    grantingKeys: kitchenGrantingKeys(enabledCategoryKeys),
    on: kitchenDesignerOnPure(enabledCategoryKeys, override),
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await stateFor(member.companyId));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  // Exactly three values. A missing key is refused rather than read as null:
  // null means "follow my trades", which is a statement, and a malformed
  // request must not quietly reset a company that had said "off".
  if (!body || !("override" in body) || ![true, false, null].includes(body.override)) {
    return NextResponse.json(
      { error: "override must be true, false or null" },
      { status: 400 },
    );
  }

  await db.company.update({
    where: { id: member.companyId },
    data: { kitchenDesignerOverride: body.override },
  });

  await recordActivity(member, {
    action: "settings.kitchen_designer_override",
    entityType: "settings",
    summary:
      body.override === true
        ? "Turned the Kitchen Designer on"
        : body.override === false
          ? "Turned the Kitchen Designer off"
          : "Set the Kitchen Designer to follow the services offered",
    metadata: { override: body.override },
  });

  return NextResponse.json(await stateFor(member.companyId));
}
