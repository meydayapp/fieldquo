// app/api/settings/cabinet-rates/route.js
//
// The company's cabinet rate card, for the kitchen designer.
//
//   GET   — the current card, the defaults, and whether they've set their own
//   PUT   — save
//   DELETE— go back to the defaults
//
// Owners and admins only. This is the company's pricing; an employee who can
// build a quote has no business changing what a linear foot costs.
//
// Also gated by TRADE, on top of role: this is the ONLY screen that reads or
// writes Company.cabinetRates, and the only thing that ever reads that column
// back out is the Kitchen Designer's own save routes, which are gated on
// kitchen_design (lib/kitchen/access.js). A company that has never turned
// kitchen_design on — and has never saved its own rates either — has nothing
// this screen can do for them; the nav row hides for exactly that company
// (app/components/layout/SettingsSidebar.js via lib/settings/tradeGateNav.js)
// and this route refuses it too, because AGENTS.md is explicit that hiding a
// row is not the gate. See lib/settings/tradeGate.js for the full reasoning,
// including why this is whole-screen where Material Costs next door is not.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  normaliseRates,
  DEFAULT_CABINET_RATES,
  DOOR_MATERIALS,
  BOX_MATERIALS,
} from "@/lib/kitchen/pricing";
import { hasOwnRates } from "@/lib/kitchen/rates";
import { canUseCabinetRatesSettings } from "@/lib/settings/tradeGate";

/**
 * @param read  true only on GET. Non-negotiable #3: the platform console views
 *              everything and edits nothing. A support session's role is
 *              "viewer", which holds no permission at all, so requirePermission
 *              refuses it and the console saw a 403 where it is supposed to see
 *              the customer's rate card. The carve-out is an argument the READ
 *              opts into rather than a line inside the shared gate, so a write
 *              cannot acquire it by editing one place — PUT and DELETE below
 *              call requireAdmin(request) with no options and are unchanged.
 *              The TRADE gate is carved out with it: a support session must be
 *              able to see a company's cabinet rates while investigating a
 *              ticket even if the company never turned kitchen_design on —
 *              "views everything" does not stop being true because the row is
 *              unusual for that tenant.
 */
async function requireAdmin(request, { read = false } = {}) {
  // memberOrRefusalPlain, not getCurrentMember: this helper's callers turn a
  // returned { error, status } into the response themselves, and the gates
  // inside getCurrentMember THROW. A locked-for-non-payment company hitting
  // this got a 500 with an empty body instead of the 402 that names the
  // billing screen. The plain variant is exactly for helpers shaped like this.
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  if (read && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only owners and admins can change pricing.", status: 403 };
  }
  if (!(await canUseCabinetRatesSettings(member.companyId))) {
    return {
      error: "Kitchen Design & New Installs isn't turned on for your company.",
      status: 403,
    };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request, { read: true });
  if (error) return NextResponse.json({ error }, { status });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { cabinetRates: true },
  });

  return NextResponse.json({
    // Normalised, so the form is never handed an undefined field to render.
    rates: normaliseRates(company?.cabinetRates),
    defaults: DEFAULT_CABINET_RATES,
    // The page says this out loud. The defaults are one real cabinet maker's
    // real prices, and a shop quoting at them without noticing is quoting
    // someone else's business.
    usingDefaults: !hasOwnRates(company?.cabinetRates),
    doorMaterials: DOOR_MATERIALS,
    boxMaterials: BOX_MATERIALS,
  });
}

export async function PUT(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  if (!body?.rates || typeof body.rates !== "object") {
    return NextResponse.json({ error: "No rates received." }, { status: 400 });
  }

  // Normalised BEFORE storage, not on the way out. Storing what the browser
  // sent and cleaning it up on every read would mean the database holds a rate
  // card nobody can price with, and the next thing to read it directly — a
  // report, an export, a migration — gets the bad copy.
  const rates = normaliseRates(body.rates);

  await db.company.update({
    where: { id: member.companyId },
    data: { cabinetRates: rates },
  });

  await recordActivity(member, {
    action: "settings.cabinet_rates_saved",
    entityType: "settings",
    summary: "Updated cabinet pricing",
    // The rate card itself, so a "why did this quote change" question later has
    // an answer. Pricing history is exactly what an activity log is for.
    metadata: { rates },
  });

  return NextResponse.json({ rates, usingDefaults: false });
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  await db.company.update({
    where: { id: member.companyId },
    data: { cabinetRates: null },
  });

  await recordActivity(member, {
    action: "settings.cabinet_rates_reset",
    entityType: "settings",
    summary: "Reset cabinet pricing to the starting rates",
  });

  return NextResponse.json({ rates: normaliseRates(null), usingDefaults: true });
}
