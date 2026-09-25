// app/api/settings/products/confirm-services/route.js
//
// "Confirm what you quote" — the set-up step for a company whose trade
// FieldQuo ships too short a service list for (lib/setupSteps.js). The screen
// is app/app/settings/services/ConfirmServices.js; what is offered, and why,
// is lib/services/confirmServices.js.
//
//   GET  — the candidate services, grouped, in the company's language, with
//          the starting price each would be created at in its currency.
//   POST — { seedKeys } — create the ticked rows and stamp
//          Company.servicesConfirmedAt. An empty list is a valid answer.
//
// ══ What the browser may send ══════════════════════════════════════════════
//
// Seed KEYS only — never a name, never a price (AGENTS.md non-negotiable #5,
// applied to the back office too: a price posted from a screen is a price
// someone can edit in devtools). Every key is checked against the candidate
// set THIS request builds from the company's own enabled trades; one unknown
// key refuses the whole request before anything is written, so a half-honoured
// list never reads as "done". The rows are then written by
// createSeededServices — the signup seeder's own write — so a key the company
// already holds is skipped, never duplicated, and an existing row's price is
// never touched.
//
// ══ Who ════════════════════════════════════════════════════════════════════
//
// Owner/admin (`user:manage`), the gate on the setup-steps card this opens
// from and on the seed-services route beside this one. A support session may
// LOOK (GET), as GET /api/setup-steps allows; getCurrentMember refuses every
// mutating request under impersonation before POST's first line runs.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { tradeEntry } from "@/lib/trades/catalog";
import { tradeLabelIn } from "@/lib/services/newSeedNotice";
import { createSeededServices } from "@/lib/products/seedServices";
import {
  QUOTE_COVERAGE_MIN,
  candidateGroups,
  candidateServicesFor,
  planConfirmedKeys,
  thinTrades,
  tradeCoverage,
} from "@/lib/services/confirmServices";

/** More keys than every seed file holds together is not a real selection. */
const MAX_KEYS = 1000;

/**
 * The company, its enabled CATALOGUE trades (system categories only — a
 * company's own custom quote type has no seed and is never a link target for
 * one) and the seed keys it already holds. One tenant-scoped read each.
 */
async function loadCompany(companyId) {
  const [company, enabled, held] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { defaultLanguage: true, currency: true, dateFormat: true, servicesConfirmedAt: true },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true, category: { companyId: null } },
      select: { category: { select: { id: true, key: true, label: true, labelTranslations: true } } },
    }),
    db.product.findMany({
      where: { companyId, seedKey: { not: null } },
      select: { seedKey: true },
    }),
  ]);
  const seen = new Set();
  const trades = [];
  for (const row of enabled) {
    const c = row.category;
    if (!c?.key || seen.has(c.key) || !tradeEntry(c.key)) continue;
    seen.add(c.key);
    trades.push(c);
  }
  return { company, trades, heldKeys: held.map((p) => p.seedKey) };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only an owner or admin can confirm the services you quote." },
        { status: 403 },
      );
    }
  }

  const { company, trades, heldKeys } = await loadCompany(member.companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const language = company.defaultLanguage || "en";
  const currency = company.currency || "CAD";
  const coverage = trades.map((t) => tradeCoverage(t.key, heldKeys));
  // The thin trades are the reason the step is on the card, so they are what
  // the list is drawn for. A company that reached this screen with none thin
  // (by URL, or after the list filled up) is shown every trade it has, which
  // is still a true answer to "what do you quote?".
  const thin = thinTrades(coverage).map((c) => c.key);
  const drawFor = thin.length ? thin : trades.map((t) => t.key);
  const groups = candidateGroups(candidateServicesFor(drawFor), { language, currency, heldSeedKeys: heldKeys });

  // Trade names for the group sub-headings, in the company's language where
  // the catalogue carries it. The borrowed-from trades are system categories
  // the company may not have switched on, so they are read by key.
  const fromKeys = [...new Set(groups.map((g) => g.fromTrade))];
  const labelRows = fromKeys.length
    ? await db.serviceCategory.findMany({
        where: { companyId: null, key: { in: fromKeys } },
        select: { key: true, label: true, labelTranslations: true },
      })
    : [];
  const labelOf = new Map([...trades, ...labelRows].map((c) => [c.key, tradeLabelIn(c, language)]));

  return NextResponse.json({
    confirmedAt: company.servicesConfirmedAt,
    // The screen prints the date in the browser's own clock, in the format
    // the company chose (lib/format/companyDate.js).
    dateFormat: company.dateFormat || null,
    language,
    currency,
    coverageMin: QUOTE_COVERAGE_MIN,
    trades: coverage.map((c) => ({ ...c, label: labelOf.get(c.key) || c.key, thin: thin.includes(c.key) })),
    groups: groups.map((g) => ({
      ...g,
      fromTradeLabel: labelOf.get(g.fromTrade) || g.fromTrade,
      forTradeLabel: labelOf.get(g.forTrade) || g.forTrade,
    })),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can confirm the services you quote." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const raw = body?.seedKeys;
  if (!Array.isArray(raw) || raw.length > MAX_KEYS || !raw.every((k) => typeof k === "string" && k.length <= 160)) {
    return NextResponse.json({ error: "seedKeys must be a list of service keys." }, { status: 400 });
  }

  const { company, trades, heldKeys } = await loadCompany(member.companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  // The candidate set over EVERY enabled trade, not only the thin ones the
  // screen drew: a trade that stopped being thin between the screen's load
  // and this press must not turn a key it showed into a refusal. Every key it
  // could have shown is in here; nothing outside the company's trades and
  // their neighbours is.
  const plan = planConfirmedKeys(raw, candidateServicesFor(trades.map((t) => t.key)));
  if (plan.unknown.length) {
    return NextResponse.json(
      { error: "Some of those services are not offered for your trades.", unknown: plan.unknown.slice(0, 20) },
      { status: 400 },
    );
  }

  const categoryIdOf = new Map(trades.map((t) => [t.key, t.id]));
  let created = 0;
  let skipped = 0;
  try {
    for (const [trade, services] of plan.byTrade) {
      const r = await createSeededServices({
        companyId: member.companyId,
        categoryId: categoryIdOf.get(trade),
        categoryKey: trade,
        services,
      });
      created += r?.created || 0;
      skipped += r?.skipped || 0;
    }
  } catch (err) {
    console.error("[confirm-services] create failed", err);
    // Not confirmed: the rows that landed are keyed, so pressing again adds
    // exactly the ones that did not. Stamping here would take the step off
    // the card on a list the company never got.
    return NextResponse.json({ error: "Could not add those services. Try again." }, { status: 500 });
  }

  // Stamped once — the first answer is the fact the column records. A later
  // press adds rows but does not move the date.
  await db.company.updateMany({
    where: { id: member.companyId, servicesConfirmedAt: null },
    data: { servicesConfirmedAt: new Date() },
  });
  const after = await db.company.findUnique({
    where: { id: member.companyId },
    select: { servicesConfirmedAt: true },
  });

  return NextResponse.json({
    created,
    skipped,
    requested: plan.requested,
    confirmedAt: after?.servicesConfirmedAt ?? null,
  });
}
