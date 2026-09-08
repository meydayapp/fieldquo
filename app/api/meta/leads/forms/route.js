// app/api/meta/leads/forms/route.js
//
// What the "Facebook lead forms" panel in Settings → Meta Ads reads and
// writes: the honest state of the feature, the forms this company knows
// about, and the on/off switch for each.
//
// ══ The honest state ═══════════════════════════════════════════════════════
//
// `leadsScopeEnabled` is the whole story, and it is answered from ONE place
// (metaLeadsScopeEnabled in lib/meta/client.js) so no screen can disagree
// with another about whether leads are flowing. With it false, the panel says
// so in plain words and every toggle is disabled with that reason attached —
// never hidden, and never a switch that flips and changes nothing.
//
// Gated like the rest of the Meta surface: isBillingAdmin, matching
// app/api/meta-ads/status/route.js, with the same impersonation carve-out on
// the READ only. "Why aren't my Facebook leads arriving" is exactly what a
// support session opens for, and middleware already refuses every non-GET
// under an impersonation cookie, so the carve-out cannot become a write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { metaLeadsScopeEnabled } from "@/lib/meta/client";
import { getConnection } from "@/lib/meta/connection";
import { META_LEAD_SOURCE } from "@/lib/meta/leadsImport";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const [connection, forms] = await Promise.all([
    getConnection(member.companyId),
    db.metaLeadForm.findMany({
      where: { companyId: member.companyId },
      orderBy: [{ pageName: "asc" }, { name: "asc" }],
    }),
  ]);

  // How many leads each form has actually produced. This is the panel's proof
  // that the wiring works — a connection status nobody can verify against a
  // real lead is the kind of control AGENTS.md's first rule is about.
  const perForm = await db.leadRequest.groupBy({
    by: ["metaFormId"],
    where: { companyId: member.companyId, source: META_LEAD_SOURCE },
    _count: { _all: true },
  });
  const counts = new Map(perForm.map((r) => [r.metaFormId, r._count._all]));

  // ── Which campaigns these leads came from ────────────────────────────────
  //
  // The reason LeadRequest.metaCampaignId is written: it is READ here and
  // rendered, so it is not a column nothing looks at.
  //
  // Counts only — deliberately no cost-per-lead figure. MarketingSpend keys a
  // Meta row by `<campaignId>:<date>`, so the join to money is possible, but
  // stating a CPL would be a new claim on a dashboard that currently refuses
  // to make one (lib/analytics/kpis.js's NOT_TRACKED costPerLead entry) and
  // would be right only for the lead-form share of a campaign's leads. That
  // is a product decision, not something to slip in beside a toggle.
  const byCampaign = await db.leadRequest.groupBy({
    by: ["metaCampaignId", "metaCampaignName"],
    where: {
      companyId: member.companyId,
      source: META_LEAD_SOURCE,
      metaCampaignId: { not: null },
    },
    _count: { _all: true },
  });

  const lastLead = await db.leadRequest.findFirst({
    where: { companyId: member.companyId, source: META_LEAD_SOURCE },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json({
    // The one answer, from the one place. See metaLeadsScopeEnabled().
    leadsScopeEnabled: metaLeadsScopeEnabled(),
    connected: Boolean(connection),
    connectionStatus: connection?.status || null,
    forms: forms.map((f) => ({
      id: f.id,
      pageId: f.pageId,
      pageName: f.pageName,
      formId: f.formId,
      name: f.name,
      active: f.active,
      lastLeadAt: f.lastLeadAt,
      leadCount: counts.get(f.formId) || 0,
    })),
    campaigns: byCampaign
      .map((c) => ({
        campaignId: c.metaCampaignId,
        campaignName: c.metaCampaignName,
        leadCount: c._count._all,
      }))
      .sort((a, b) => b.leadCount - a.leadCount),
    lastLeadAt: lastLead?.createdAt || null,
  });
}

/**
 * The on/off switch for one form.
 *
 * Refuses while the permission is pending. The panel already disables the
 * toggle with the reason on it, but hiding a button is not access control
 * (AGENTS.md non-negotiable #2's own wording) — a POST from a console must
 * hit the same wall, otherwise `active: true` becomes a stored flag that
 * nothing can ever act on, which is the "wrote a column nothing read" failure
 * this codebase has been swept for.
 */
export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  if (!metaLeadsScopeEnabled()) {
    return NextResponse.json(
      {
        error:
          "Facebook lead forms need Meta's approval of one more permission (leads_retrieval). Turning a form on would store a setting nothing can act on yet.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const formId = typeof body.formId === "string" ? body.formId.trim() : "";
  if (!formId) return NextResponse.json({ error: "`formId` is required." }, { status: 400 });
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "`active` must be true or false." }, { status: 400 });
  }

  // Scoped by companyId in the WHERE, not checked after the read: a form id
  // from the request body naming another tenant's row must not be loadable at
  // all. updateMany because the compound unique is (companyId, formId) and
  // this is the shape that cannot be made to match a foreign row.
  const result = await db.metaLeadForm.updateMany({
    where: { companyId: member.companyId, formId },
    data: { active: body.active },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "No such lead form for this company." }, { status: 404 });
  }

  return NextResponse.json({ formId, active: body.active });
}
