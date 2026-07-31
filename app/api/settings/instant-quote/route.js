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
import { normaliseFinancing } from "@/lib/estimate/financing";

const TRADE_LABELS = {
  roofing: "Roofing",
  epoxy: "Epoxy & Concrete Coatings",
  parging: "Parging",
  lawn_mowing: "Lawn Mowing",
  cabinet_refacing: "Cabinet Refacing",
  countertop: "Countertops",
  flooring: "Flooring",
  painting: "Painting",
  junk_removal: "Junk Removal",
};

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
      select: { financing: true },
    }),
  ]);
  const byTrade = new Map(saved.map((r) => [r.trade, r]));

  const trades = Object.entries(INSTANT_ESTIMATE_TRADES).map(([trade, spec]) => {
    const row = byTrade.get(trade);
    return {
      trade,
      label: TRADE_LABELS[trade] || trade,
      measure: spec.measure, // roof_address | lawn_polygon | manual_area | manual_units
      hasMaterials: spec.hasMaterials,
      enabled: row?.enabled ?? false,
      // Seed the form with the company's saved config, else the reference
      // defaults so they have something to edit rather than a blank grid.
      config: row?.config ?? INSTANT_ESTIMATE_DEFAULTS[trade] ?? null,
      isDefaults: !row,
    };
  });

  return NextResponse.json({
    trades,
    canEdit: isPricingAdmin(member.role),
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
  if (enabled) {
    const problem = validatePriceable(trade, spec, config);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
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

// The minimum a config needs before the trade can be turned on. Mirrors what
// the estimator in lib/estimate/instantEstimate.js actually reads, so "enabled
// and valid here" means "will produce a number there".
function validatePriceable(trade, spec, config) {
  if (!config || typeof config !== "object") return "Add pricing before enabling this trade.";

  if (spec.hasMaterials && trade !== "cabinet_refacing") {
    const mats = Array.isArray(config.materials) ? config.materials : [];
    const rateKey = trade === "roofing" ? "ratePerSquare" : "ratePerSqft";
    const priced = mats.some((m) => Number(m?.[rateKey]) > 0);
    if (!priced) return "Set a sell rate on at least one material before enabling.";
  }
  if (trade === "lawn_mowing") {
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    if (!tiers.some((t) => Number(t?.pricePerVisit) > 0)) {
      return "Set at least one lot-size tier price before enabling.";
    }
  }
  if (trade === "cabinet_refacing") {
    if (!(Number(config.perDoor) > 0)) return "Set a per-door price before enabling.";
  }
  if (trade === "junk_removal") {
    // Junk prices off the load tiers + minimum; a full-truck price of 0 means
    // the owner blanked the card. normaliseJunkRates fills gaps, but an all-zero
    // load would publish free hauling — refuse it.
    const r = config.rates || {};
    const full = Number(r?.loadCents?.full);
    if (!(full > 0) && !(Number(r?.minimumCents) > 0)) {
      return "Set at least a full-load price or a minimum charge before enabling.";
    }
  }
  return null;
}
