// app/api/commissions/settings/route.js
//
// Settings › Commissions: whether the company pays commission on its own jobs,
// and on what basis.
//
// GET   everyone — the job page, the team page and the pay-run screen read it
//       to decide whether to draw a commission control at all, so a member who
//       may not change it still needs to know it is on.
// PATCH owner/admin — the same people who agree the pay cycle.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { BASES } from "@/lib/commissions/compute";
import { canConfigureCommissions, commissionAccess } from "@/lib/commissions/access";
import { recordActivity } from "@/lib/activity/log";

async function shape(member) {
  const [company, full] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { commissionsEnabled: true, commissionsEnabledAt: true, commissionBasis: true },
    }),
    loadEnforceableMember(db, member.id),
  ]);
  const access = commissionAccess(full);
  return {
    enabled: Boolean(company?.commissionsEnabled),
    enabledAt: company?.commissionsEnabledAt || null,
    basis: BASES.includes(company?.commissionBasis) ? company.commissionBasis : "revenue",
    canConfigure: canConfigureCommissions(member),
    seesAll: access.seesAll,
    canEdit: access.canEdit,
    canSettle: access.canSettle,
    memberId: member.id,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await shape(member));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!canConfigureCommissions(member)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change how commissions work." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.enabled !== undefined) data.commissionsEnabled = body.enabled === true;
  if (body.basis !== undefined) {
    if (!BASES.includes(body.basis)) {
      return NextResponse.json({ error: "Pick revenue or gross profit." }, { status: 400 });
    }
    data.commissionBasis = body.basis;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const before = await db.company.findUnique({
    where: { id: member.companyId },
    select: { commissionsEnabled: true, commissionsEnabledAt: true, commissionBasis: true },
  });
  // Stamped the FIRST time only, never moved: payments before it earn nothing
  // (see Company.commissionsEnabledAt). Turning it off and on again must not
  // quietly make the gap between the two commissionable after the fact — nor
  // retroactively un-earn what was earned before the gap.
  if (data.commissionsEnabled && !before?.commissionsEnabledAt) data.commissionsEnabledAt = new Date();

  await db.company.update({ where: { id: member.companyId }, data });

  const changes = [];
  if (data.commissionsEnabled !== undefined && data.commissionsEnabled !== before?.commissionsEnabled) {
    changes.push(data.commissionsEnabled ? "switched commissions on" : "switched commissions off");
  }
  if (data.commissionBasis && data.commissionBasis !== before?.commissionBasis) {
    changes.push(`changed the commission basis to ${data.commissionBasis === "gross_profit" ? "gross profit" : "revenue"}`);
  }
  if (changes.length) {
    await recordActivity(member, {
      action: "commissions.settings_changed",
      entityType: "settings",
      entityId: member.companyId,
      summary: changes.join("; "),
      metadata: { before, after: data },
    });
  }

  return NextResponse.json(await shape(member));
}
