// app/api/assets/utilisation/route.js
//
// Which of the company's equipment is actually getting used, and which has
// sat in the yard — the "equipment utilisation" figure
// lib/analytics/kpis.js's NOT_TRACKED list named as having no data source at
// all. It has one now: AssetUseLog.
//
// ── Why this is gated like the asset register, not like job photos ─────────
//
// Logging a single use (app/api/jobs/[id]/asset-use/route.js) is a field
// action and is gated like a photo upload. THIS is a roll-up across every
// asset the company owns, next to its depreciation and book value — the same
// class of figure the register itself shows, so it takes the register's own
// gate (lib/permissions/costBasis.js's `fixedCosts`: jobCosting AND
// user:manage). A crew member who can log a compressor on their own job
// still cannot see the whole yard's utilisation report.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireCostBasisRead } from "@/lib/permissions/costBasis";
import { assetCharge } from "@/lib/accounting/depreciation";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const hasRange = DAY_RE.test(from || "") && DAY_RE.test(to || "");
  const rangeWhere = hasRange
    ? { usedOn: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } }
    : {};

  const [assets, logs] = await Promise.all([
    db.asset.findMany({
      where: { companyId: member.companyId },
      select: {
        id: true,
        name: true,
        category: true,
        cost: true,
        salvageValue: true,
        inServiceDate: true,
        usefulLifeMonths: true,
        disposedOn: true,
        active: true,
      },
      orderBy: { name: "asc" },
    }),
    db.assetUseLog.findMany({
      where: { companyId: member.companyId, ...rangeWhere },
      select: { assetId: true, usedOn: true, hours: true, jobId: true },
    }),
  ]);

  const now = new Date();
  const byAsset = new Map(assets.map((a) => [a.id, { logCount: 0, jobIds: new Set(), lastUsedOn: null }]));

  for (const log of logs) {
    const entry = byAsset.get(log.assetId);
    if (!entry) continue;
    entry.logCount += 1;
    if (log.jobId) entry.jobIds.add(log.jobId);
    if (!entry.lastUsedOn || log.usedOn > entry.lastUsedOn) entry.lastUsedOn = log.usedOn;
  }

  const rows = assets.map((asset) => {
    const usage = byAsset.get(asset.id);
    const charge = assetCharge(asset, now);
    return {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      active: asset.active,
      monthlyDepreciation: Math.round(charge.monthly * 100) / 100,
      chargeable: charge.chargeable,
      chargeReason: charge.reason,
      daysLogged: usage.logCount,
      distinctJobs: usage.jobIds.size,
      lastUsedOn: usage.lastUsedOn,
      // Never used at all — the "sat in the yard" case the owner asked about.
      // Not the same as "used but not this period": `hasRange` says which
      // question was asked.
      neverLogged: usage.logCount === 0,
    };
  });

  rows.sort((a, b) => b.daysLogged - a.daysLogged);

  return NextResponse.json({
    assets: rows,
    range: hasRange ? { from, to } : null,
  });
}
