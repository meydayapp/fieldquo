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
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { instantRateFields } from "@/lib/estimate/instantRateFields";
import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";
import { tradeLabel } from "@/lib/estimate/instantQuoteServer";
import {
  categoryKeysForInstantTrade,
  categoryLabel,
  catalogueMismatches,
} from "@/lib/trades/catalog";
import { normaliseFinancing } from "@/lib/estimate/financing";
import { reprovisionIfLive } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

function isPricingAdmin(role) {
  return role === "owner" || role === "admin";
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── The read had no check at all ─────────────────────────────────────────
  //
  // Writes were owner/admin from the start; reading was open to any member of
  // the company. What this returns is `config` and `rateFields` per trade —
  // the per-unit sell rates a stranger is quoted from, the same $150 per door
  // Settings > Services carries — so it is gated on the same toggle
  // /api/products is, and refuses rather than redacting for the same reason
  // that route gives: a rate card with the rates removed is a broken screen,
  // not a boundary.
  //
  // Impersonation is carved out of the READ only. Non-negotiable #3 is that the
  // platform console views everything and edits nothing, and a support
  // session's role is "viewer", which holds no grid at all. PUT below does not
  // consult member.impersonation, so a write cannot pick the carve-out up.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireToggle(full, "showPricing", "see the instant-quote rates");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const [saved, company, enabledCategories] = await Promise.all([
    db.instantQuoteConfig.findMany({ where: { companyId: member.companyId } }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { financing: true, slug: true },
    }),
    // What the company says it SELLS. This screen used to render every wired
    // estimator with no reference to it, which is how a cabinet painter came to
    // have a roofing rate card: he was shown the card, so he filled it in.
    db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: { category: { select: { key: true } } },
    }),
  ]);
  const byTrade = new Map(saved.map((r) => [r.trade, r]));
  const enabledKeys = enabledCategories.map((r) => r.category.key);
  const enabledSet = new Set(enabledKeys);

  const trades = Object.entries(INSTANT_ESTIMATE_TRADES).map(([trade, spec]) => {
    const row = byTrade.get(trade);
    const seed = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
    const config = row?.config ?? seed ?? null;
    // Which of the company's own services this estimator prices. Plural: one
    // `painting` estimator serves interior and exterior painting both.
    const categoryKeys = categoryKeysForInstantTrade(trade);
    return {
      trade,
      label: tradeLabel(trade),
      measure: spec.measure, // roof_address | lawn_polygon | manual_area | manual_units
      // ── Two different questions the screen used to answer by trade NAME ───
      //
      // `spec.hasMaterials` says the public form asks the homeowner to pick a
      // material. It does NOT say the company edits a list of material sell
      // rates: refacing declares it and prices off a per-door rate times a
      // material multiplier, with no `materials[]` rows to iterate. The screen
      // encoded that gap as `trade !== "cabinet_refacing"`, which is a fact
      // about one trade written where a rule belongs. The seed already carries
      // the answer, and reproduces today's set exactly — so this replaces
      // `hasMaterials` in the payload rather than joining it. Sending both would
      // leave a field nothing on the screen reads.
      hasMaterialRates: Array.isArray(seed?.materials),
      // The unit rates this trade prices off, resolved from its price book and
      // its seed — see lib/estimate/instantRateFields.js. Filtered HERE rather
      // than in the browser so a supplier cost flagged `internal` never leaves
      // the server for a screen that edits client-facing prices.
      rateFields: instantRateFields(trade, seed),
      enabled: row?.enabled ?? false,
      // Is this one of their trades? Drives the grouping on the settings
      // screen — their own services first, everything else behind a
      // disclosure — so nobody configures a rate card for work they don't do.
      offeredAsService: categoryKeys.some((k) => enabledSet.has(k)),
      serviceLabels: categoryKeys.map(categoryLabel),
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

  // ── Where the two screens disagree ───────────────────────────────────────
  //
  // Reported, never repaired. He has roofing switched on; that is his row and
  // his call, and a migration that turned it off on his behalf would be a
  // destructive operation labelled as tidying. So the screen says what it sees
  // and every change still comes from him pressing something.
  const mismatches = catalogueMismatches({
    enabledCategoryKeys: enabledKeys,
    instantRows: saved.map((r) => ({ trade: r.trade, enabled: r.enabled })),
    wiredTrades: Object.keys(INSTANT_ESTIMATE_TRADES),
  });

  return NextResponse.json({
    trades,
    canEdit: isPricingAdmin(member.role),
    // Labelled here rather than in the catalogue: the estimator's public name
    // ("Stairs & Railings") is not the catalogue's name for the trade
    // ("Stairs"), and the screen is talking about the estimator.
    mismatches: {
      instantWithoutService: mismatches.instantWithoutService.map((m) => ({
        ...m,
        tradeLabel: tradeLabel(m.trade),
      })),
      serviceWithoutInstant: mismatches.serviceWithoutInstant.map((m) => ({
        ...m,
        tradeLabel: tradeLabel(m.trade),
      })),
    },
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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
      metadata: {
        enabled: financing.enabled,
        mode: financing.url ? "provider" : "contact",
        // Whether a monthly estimate is now shown to homeowners, and on what.
        // This is the company committing to a rate in front of clients, so it
        // belongs in the audit trail rather than only in the row.
        aprPct: financing.aprPct,
        termMonths: financing.termMonths,
      },
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

  // ── The phone receptionist asks for whatever this trade needs ───────────
  //
  // Its questions are derived from these rows (lib/voice/quoteQuestions.js), so
  // enabling a trade here and not pushing would leave an agent that has never
  // heard of it — the settings screen saying one thing and the phone another,
  // which is the whole reason provisionAgent pushes on every save.
  //
  // Best-effort, and it never creates an agent: reprovisionIfLive refuses when
  // the company has no live one, so a company that has never set up voice pays
  // nothing for saving a rate card.
  await reprovisionIfLive(member.companyId, getAppOrigin(request)).catch((err) =>
    console.error("[settings/instant-quote] couldn't refresh the receptionist:", err?.message),
  );

  return NextResponse.json({ ok: true, trade: saved.trade, enabled: saved.enabled });
}
