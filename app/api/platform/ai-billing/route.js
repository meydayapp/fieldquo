// app/api/platform/ai-billing/route.js
//
// Who pays for each AI feature — FieldQuo or the company — and what each one
// cost last month and so far this month, on BOTH ledgers.
//
//   GET    any platform admin: the features, their payer, their spend, and
//          receipt reading per company — plus, for the features the company
//          pays from its AI CREDIT (the AI employee, lib/ai/walletMeter.js),
//          the dollars actually debited, per feature and per company.
//   PATCH  superadmin only: { feature, payer } for a WIRED feature (one whose
//          code routes through meterFor — lib/ai/featurePayer.js). An unwired
//          feature is refused rather than saved: a stored payer nothing reads
//          is a switch that looks like it worked and didn't.
//
// This edits FieldQuo's OWN configuration (AiFeaturePayer), never a tenant's
// data — non-negotiable 3 is untouched.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  PAYER_FEATURES,
  PAYER_CACHE_MS,
  payerFeature,
  normalisePayer,
  resolvePayer,
  setFeaturePayer,
} from "@/lib/ai/featurePayer";
import { PAY_AS_YOU_GO_MULTIPLIER, AI_EMPLOYEE_GRACE_ENDS_ON } from "@/lib/ai/walletMeter";

function monthStart(offset = 0) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}

/** Both spellings a feature is recorded under — with and without images. */
const namesOf = (feature) => [feature, `${feature}_photos`];

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thisMonth = monthStart(0);
  const lastMonth = monthStart(-1);
  const all = PAYER_FEATURES.flatMap((f) => namesOf(f.feature));

  const [rows, companyThis, companyLast, platformThis, platformLast, receiptPlatform, receiptCompany] =
    await Promise.all([
      db.aiFeaturePayer.findMany(),
      db.aiUsage.groupBy({ by: ["feature"], where: { feature: { in: all }, createdAt: { gte: thisMonth } }, _sum: { costMicros: true }, _count: true }),
      db.aiUsage.groupBy({ by: ["feature"], where: { feature: { in: all }, createdAt: { gte: lastMonth, lt: thisMonth } }, _sum: { costMicros: true }, _count: true }),
      db.platformAiUsage.groupBy({ by: ["area"], where: { area: { in: all }, createdAt: { gte: thisMonth } }, _sum: { costMicros: true }, _count: true }),
      db.platformAiUsage.groupBy({ by: ["area"], where: { area: { in: all }, createdAt: { gte: lastMonth, lt: thisMonth } }, _sum: { costMicros: true }, _count: true }),
      // Receipt reading per company, FieldQuo-paid side: the company lives in
      // meta, so these rows are summed here rather than grouped in SQL.
      // Bounded to two months of one feature.
      db.platformAiUsage.findMany({
        where: { area: { in: namesOf("receipt_scan") }, createdAt: { gte: lastMonth } },
        select: { meta: true, costMicros: true, createdAt: true },
        take: 20000,
      }),
      db.aiUsage.groupBy({
        by: ["companyId"],
        where: { feature: { in: namesOf("receipt_scan") }, createdAt: { gte: lastMonth } },
        _sum: { costMicros: true },
        _count: true,
      }),
    ]);

  const byFeature = (groups, key) => {
    const out = new Map();
    for (const g of groups) {
      const base = String(g[key]).replace(/_photos$/, "");
      const cur = out.get(base) || { costMicros: 0, calls: 0 };
      cur.costMicros += g._sum?.costMicros || 0;
      cur.calls += g._count || 0;
      out.set(base, cur);
    }
    return out;
  };
  const cThis = byFeature(companyThis, "feature");
  const cLast = byFeature(companyLast, "feature");
  const pThis = byFeature(platformThis, "area");
  const pLast = byFeature(platformLast, "area");
  const rowBy = new Map(rows.map((r) => [r.feature, r]));

  const features = PAYER_FEATURES.map((f) => {
    const row = rowBy.get(f.feature) || null;
    const zero = { costMicros: 0, calls: 0 };
    return {
      feature: f.feature,
      label: f.label,
      blurb: f.blurb,
      wired: f.wired,
      // What "company" means for this feature: its monthly token allowance,
      // or its AI credit in dollars (the AI employee).
      companyLedger: f.companyLedger === "wallet" ? "wallet" : "allowance",
      defaultPayer: f.defaultPayer,
      payer: resolvePayer(f.feature, row),
      explicit: Boolean(normalisePayer(row?.payer)),
      updatedAt: row?.updatedAt || null,
      spend: {
        thisMonth: { fieldquo: pThis.get(f.feature) || zero, company: cThis.get(f.feature) || zero },
        lastMonth: { fieldquo: pLast.get(f.feature) || zero, company: cLast.get(f.feature) || zero },
      },
    };
  });

  // Receipt reading by company — both ledgers, this month and last.
  const perCompany = new Map();
  const bump = (companyId, ledger, when, micros, calls = 1) => {
    if (!companyId) return;
    const cur = perCompany.get(companyId) || {
      companyId,
      thisMonth: { fieldquo: 0, company: 0, calls: 0 },
      lastMonth: { fieldquo: 0, company: 0, calls: 0 },
    };
    const bucket = cur[when];
    bucket[ledger] += micros || 0;
    bucket.calls += calls;
    perCompany.set(companyId, cur);
  };
  for (const r of receiptPlatform) {
    const companyId = r.meta && typeof r.meta === "object" ? r.meta.companyId : null;
    bump(companyId, "fieldquo", r.createdAt >= thisMonth ? "thisMonth" : "lastMonth", r.costMicros || 0);
  }
  // The company-ledger rows are grouped over both months together; split
  // them with a second, small query only when there are any.
  if (receiptCompany.length) {
    const split = await db.aiUsage.groupBy({
      by: ["companyId"],
      where: { feature: { in: namesOf("receipt_scan") }, createdAt: { gte: thisMonth } },
      _sum: { costMicros: true },
      _count: true,
    });
    const thisBy = new Map(split.map((s) => [s.companyId, s]));
    for (const g of receiptCompany) {
      const t = thisBy.get(g.companyId);
      const thisMicros = t?._sum?.costMicros || 0;
      const thisCalls = t?._count || 0;
      bump(g.companyId, "company", "thisMonth", thisMicros, thisCalls);
      bump(g.companyId, "company", "lastMonth", (g._sum?.costMicros || 0) - thisMicros, (g._count || 0) - thisCalls);
    }
  }
  // ── The AI employee, in dollars debited per company ─────────────────────
  //
  // The features whose company ledger is the AI WALLET (lib/ai/walletMeter.js)
  // are charged in cents on VoiceCreditEntry, kind = the feature name. The
  // DEBITS are the revenue side; the AiUsage rows for the same features are
  // the vendor cost. Both, per company, this month and last — so the margin
  // the multiplier promises can be read off real rows, not assumed.
  const walletKinds = PAYER_FEATURES.filter((f) => f.companyLedger === "wallet").map((f) => f.feature);
  const [debitThis, debitLast, empCostThis, empCostLast] = await Promise.all([
    db.voiceCreditEntry.groupBy({ by: ["companyId", "kind"], where: { kind: { in: walletKinds }, cents: { lt: 0 }, createdAt: { gte: thisMonth } }, _sum: { cents: true }, _count: true }),
    db.voiceCreditEntry.groupBy({ by: ["companyId", "kind"], where: { kind: { in: walletKinds }, cents: { lt: 0 }, createdAt: { gte: lastMonth, lt: thisMonth } }, _sum: { cents: true }, _count: true }),
    db.aiUsage.groupBy({ by: ["companyId"], where: { feature: { in: walletKinds.flatMap(namesOf) }, createdAt: { gte: thisMonth } }, _sum: { costMicros: true }, _count: true }),
    db.aiUsage.groupBy({ by: ["companyId"], where: { feature: { in: walletKinds.flatMap(namesOf) }, createdAt: { gte: lastMonth, lt: thisMonth } }, _sum: { costMicros: true }, _count: true }),
  ]);
  const walletByFeature = (groups) => {
    const out = new Map();
    for (const g of groups) {
      const cur = out.get(g.kind) || { cents: 0, debits: 0 };
      cur.cents += -(Number(g._sum?.cents) || 0);
      cur.debits += Number(g._count) || 0;
      out.set(g.kind, cur);
    }
    return out;
  };
  const wThis = walletByFeature(debitThis);
  const wLast = walletByFeature(debitLast);
  for (const f of features) {
    if (!walletKinds.includes(f.feature)) continue;
    const zero = { cents: 0, debits: 0 };
    f.spend.thisMonth.wallet = wThis.get(f.feature) || zero;
    f.spend.lastMonth.wallet = wLast.get(f.feature) || zero;
  }
  const employee = new Map();
  const emp = (companyId) => {
    const cur = employee.get(companyId) || {
      companyId,
      thisMonth: { chargedCents: 0, replies: 0, costMicros: 0 },
      lastMonth: { chargedCents: 0, replies: 0, costMicros: 0 },
    };
    employee.set(companyId, cur);
    return cur;
  };
  for (const [when, groups] of [["thisMonth", debitThis], ["lastMonth", debitLast]]) {
    for (const g of groups) {
      const row = emp(g.companyId)[when];
      row.chargedCents += -(Number(g._sum?.cents) || 0);
      if (g.kind === "ai_employee_reply") row.replies += Number(g._count) || 0;
    }
  }
  for (const [when, groups] of [["thisMonth", empCostThis], ["lastMonth", empCostLast]]) {
    for (const g of groups) emp(g.companyId)[when].costMicros += Number(g._sum?.costMicros) || 0;
  }

  const ids = [...new Set([...perCompany.keys(), ...employee.keys()])];
  const companies = ids.length
    ? await db.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(companies.map((c) => [c.id, c.name]));
  const aiEmployeeCharges = [...employee.values()]
    .map((r) => ({ ...r, name: names.get(r.companyId) || "(deleted company)" }))
    .sort((a, b) => b.thisMonth.chargedCents - a.thisMonth.chargedCents || b.lastMonth.chargedCents - a.lastMonth.chargedCents);
  const receiptScans = [...perCompany.values()]
    .map((r) => ({ ...r, name: names.get(r.companyId) || "(deleted company)" }))
    .sort(
      (a, b) =>
        b.thisMonth.fieldquo + b.thisMonth.company - (a.thisMonth.fieldquo + a.thisMonth.company) ||
        b.lastMonth.fieldquo + b.lastMonth.company - (a.lastMonth.fieldquo + a.lastMonth.company),
    );

  return NextResponse.json({
    periodStart: thisMonth,
    lastPeriodStart: lastMonth,
    cacheSeconds: PAYER_CACHE_MS / 1000,
    isSuperadmin: admin.role === "superadmin",
    features,
    receiptScans,
    receiptScansCapped: receiptPlatform.length === 20000,
    aiEmployeeCharges,
    walletMultiplier: PAY_AS_YOU_GO_MULTIPLIER,
    aiEmployeeGraceEndsOn: AI_EMPLOYEE_GRACE_ENDS_ON,
  });
}

export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Moving a feature onto FieldQuo's card costs FieldQuo money; moving it off
  // charges customers. Either is a superadmin's call, like the AI caps.
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can change who pays for AI." }, { status: 403 });
  }

  const { feature, payer } = await request.json().catch(() => ({}));
  const f = payerFeature(feature);
  const p = normalisePayer(payer);
  if (!f || !p) return NextResponse.json({ error: "Unknown feature or payer." }, { status: 400 });
  if (!f.wired) {
    return NextResponse.json(
      { error: `${f.label} isn't routed through the switch yet, so changing it here would do nothing.` },
      { status: 400 },
    );
  }

  const before = await db.aiFeaturePayer.findUnique({ where: { feature: f.feature } });
  const row = await setFeaturePayer({ feature: f.feature, payer: p, adminId: admin.id });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "ai_payer_changed",
      details: { feature: f.feature, from: resolvePayer(f.feature, before), to: p },
    },
  });

  return NextResponse.json({ ok: true, feature: row.feature, payer: row.payer });
}
