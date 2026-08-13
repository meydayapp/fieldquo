// app/api/settings/instant-quote/route.js
//
// Read and write the company's instant-estimate sell rates — the rows the
// public estimator prices off. GET returns every wired trade with the saved
// config, or the reference defaults as a STARTING POINT when nothing is saved
// yet (flagged isDefaults, so the UI can say "review these, they're not your
// prices until you save"). PUT saves one trade.
//
// Writes are owner/admin only. A rate card is not company trivia — it's what a
// stranger is shown and what the company may have to honour, so it sits above
// the "user:manage" line that lets a supervisor edit hours.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";
import { tradeLabel } from "@/lib/estimate/instantQuoteServer";
import { normaliseFinancing } from "@/lib/estimate/financing";

function isPricingAdmin(role) {
  return role === "owner" || role === "admin";
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [saved, company] = await Promise.all([
    db.instantQuoteConfig.findMany({ where: { companyId: member.companyId } }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { financing: true, slug: true },
    }),
  ]);
  const byTrade = new Map(saved.map((r) => [r.trade, r]));

  const trades = Object.entries(INSTANT_ESTIMATE_TRADES).map(([trade, spec]) => {
    const row = byTrade.get(trade);
    const config = row?.config ?? INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
    return {
      trade,
      label: tradeLabel(trade),
      measure: spec.measure, // roof_address | lawn_polygon | manual_area | manual_units
      hasMaterials: spec.hasMaterials,
      enabled: row?.enabled ?? false,
      // Seed the form with the company's saved config, else the reference
      // defaults so they have something to edit rather than a blank grid.
      config,
      isDefaults: !row,
      // Whether a homeowner can actually get a number out of the SAVED config,
      // dry-run through the public pricer. An enabled trade that can't price is
      // a dead control in front of a stranger, and the contractor is the only
      // person allowed to be told why — so it's computed here, behind auth, and
      // never on the public endpoint.
      readiness: instantQuoteReadiness(trade, row?.config ?? null),
    };
  });

  return NextResponse.json({
    trades,
    canEdit: isPricingAdmin(member.role),
    // What a homeowner opening the public link would see right now. The owner
    // asked "so I have to turn it on somewhere?" while looking at this screen;
    // the answer belongs on it.
    liveTradeCount: trades.filter((t) => t.enabled && t.readiness.ok).length,
    companySlug: company?.slug || null,
    // Company-level, not per-trade — one financing offer for the business.
    financing: normaliseFinancing(company?.financing),
  });
}

export async function PUT(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPricingAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can set instant-quote pricing." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Company-level financing save ─────────────────────────────────────────
  //
  // Distinct from the per-trade rate save below: financing is one offer for the
  // whole business, so a `{ financing }` payload (no trade) updates the company
  // and returns. normaliseFinancing drops a bad URL and clamps the note before
  // it's stored.
  if (body && body.financing !== undefined) {
    const financing = normaliseFinancing(body.financing);
    await db.company.update({
      where: { id: member.companyId },
      data: { financing },
    });
    await recordActivity(member, {
      action: "settings.financing_updated",
      entityType: "settings",
      summary: financing.enabled ? "Turned on financing on estimates" : "Turned off financing",
      metadata: { enabled: financing.enabled, mode: financing.url ? "provider" : "contact" },
    });
    return NextResponse.json({ ok: true, financing });
  }

  const { trade, enabled, config } = body || {};
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) {
    return NextResponse.json({ error: "Unknown trade" }, { status: 400 });
  }

  // Refuse to enable a trade that can't actually price. Better a clear error
  // here than a public "instant quote" button that returns needsConfig — a
  // dead control in front of a homeowner is exactly what this product forbids.
  //
  // The check is the READINESS dry-run, not a hand-written mirror of the
  // estimator's rules. The hand-written mirror is what let Cabinet Refacing
  // through: it validated a per-door price the public pricer never looked at.
  if (enabled) {
    const readiness = instantQuoteReadiness(trade, config);
    if (!readiness.ok) {
      return NextResponse.json(
        { error: [readiness.message, readiness.fix].filter(Boolean).join(" ") },
        { status: 400 },
      );
    }
  }

  const saved = await db.instantQuoteConfig.upsert({
    where: { companyId_trade: { companyId: member.companyId, trade } },
    update: { enabled: Boolean(enabled), config: config ?? null },
    create: {
      companyId: member.companyId,
      trade,
      enabled: Boolean(enabled),
      config: config ?? null,
    },
  });

  await recordActivity(member, {
    action: "settings.instant_quote_updated",
    entityType: "settings",
    entityId: saved.trade,
    summary: `${saved.enabled ? "Enabled" : "Updated"} instant-quote pricing for ${saved.trade}`,
    metadata: { trade: saved.trade, enabled: saved.enabled },
  });

  return NextResponse.json({ ok: true, trade: saved.trade, enabled: saved.enabled });
}
