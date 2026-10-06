// app/api/settings/meta-conversions/route.js
//
// Settings → Meta Ads → "Send lead results to Meta" (lib/meta/capi/).
//
//   GET    the switch, where events go, what each half can do right now and
//          why not, and what was sent / failed in the last 30 days.
//   PATCH  { enabled?, datasetId?, datasetName?, datasetToken?, acceptTerms? }
//
// Owner and admin only — the same gate as the rest of the Meta Ads screen
// (isBillingAdmin): this decides what the company's ad account is told about
// its customers. A read-only support session may READ (non-negotiable #3:
// view everything) and is refused every write, here AND by middleware.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";
import { metaPageEventsEnabled } from "@/lib/meta/client";
import { getPageConnection } from "@/lib/meta/pageConnection";
import { getConnection } from "@/lib/meta/connection";
import {
  capiReadiness,
  publicCapiSettings,
  getCapiSettings,
  validateCapiPatch,
  saveCapiSettings,
} from "@/lib/meta/capi/settings";

const WINDOW_DAYS = 30;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  const companyId = member.companyId;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [settings, pageConnection, adConnection, company, grouped, recentFailures] = await Promise.all([
    getCapiSettings(companyId),
    getPageConnection(companyId),
    getConnection(companyId),
    db.company.findUnique({ where: { id: companyId }, select: { metaPixelId: true, pixelConsentRequired: true } }),
    db.metaConversionEvent.groupBy({
      by: ["kind", "status"],
      where: { companyId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.metaConversionEvent.findMany({
      where: { companyId, status: "failed", createdAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { kind: true, eventName: true, lastError: true, lastStatusCode: true, updatedAt: true },
    }),
  ]);
  const counts = {};
  for (const g of grouped) {
    counts[g.kind] = counts[g.kind] || {};
    counts[g.kind][g.status] = g._count?._all ?? 0;
  }
  return NextResponse.json({
    settings: publicCapiSettings(settings),
    // `setup`: what each half would do with the switch on — the checklist the
    // screen shows before anyone turns it on. `live`: what it does now.
    setup: capiReadiness({ settings: { ...(settings || {}), enabled: true }, pageConnection }),
    live: capiReadiness({ settings, pageConnection }),
    encryptionConfigured: tokenCryptoConfigured(),
    adAccountConnected: Boolean(adConnection && adConnection.status === "connected"),
    pageConnected: Boolean(pageConnection),
    instagramConnected: Boolean(pageConnection?.instagramUserId),
    pageEventsRequested: metaPageEventsEnabled(),
    suggestedDatasetId: company?.metaPixelId || null,
    consentRequired: Boolean(company?.pixelConsentRequired),
    counts,
    windowDays: WINDOW_DAYS,
    recentFailures,
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  }
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const patch = validateCapiPatch(body || {});
  if (patch.errors.length) {
    return NextResponse.json({ error: "invalid", fields: patch.errors }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { id: member.userId }, select: { name: true, email: true } }).catch(() => null);
  const result = await saveCapiSettings({
    companyId: member.companyId,
    actor: { userId: member.userId, name: user?.name || user?.email || null },
    patch,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ settings: publicCapiSettings(result.row) });
}
