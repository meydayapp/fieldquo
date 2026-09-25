// app/api/settings/products/confirm-services/route.js
//
// "Confirm what you quote" — the set-up step for a company whose trade
// FieldQuo ships too short a service list for (lib/setupSteps.js). The screen
// is app/app/settings/services/ConfirmServices.js; what is offered, and why,
// is lib/services/confirmServices.js.
//
//   GET  — the candidate services, grouped, in the company's language, with
//          the starting price each would be created at in its currency, and
//          each row's standing: in the list, removed earlier, or never held.
//   POST — { seedKeys, removeSeedKeys } — the rows to have and the rows to
//          take out, then stamp Company.servicesConfirmedAt. Two empty lists
//          are a valid answer ("I looked; this is my list").
//
// ══ What the browser may send ══════════════════════════════════════════════
//
// Seed KEYS only — never a name, never a price, never a product id (AGENTS.md
// non-negotiable #5, applied to the back office too: a price posted from a
// screen is a price someone can edit in devtools). lib/services/
// confirmServices.js#planServiceChanges decides every key BEFORE anything is
// written: an add must be a candidate THIS request built from the company's
// own enabled trades or a key the company itself holds; a removal must be a
// key the company holds — read by `companyId`, so a key only another company
// holds is as unknown as garbage. One unknown key refuses the whole request.
//
// ══ Removing is archiving ══════════════════════════════════════════════════
//
// An unticked service is set `active: false` (lib/products/offered.js), never
// deleted: past quotes, invoices, costing rows and commissions point at it by
// id, and the owner's standing rule is no data deletion. Ticking it again
// RESTORES that row — the price and template lines it had — because the
// seeder's dedupe (createSeededServices reads every row, active or not) would
// otherwise skip the key and leave it archived, and a fresh create would be
// a duplicate.
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
import { isAddedForYou, signupSeededRows } from "@/lib/services/addedForYou";
import {
  QUOTE_COVERAGE_MIN,
  candidateGroups,
  candidateServicesFor,
  heldState,
  planServiceChanges,
  thinTrades,
  tradeCoverage,
} from "@/lib/services/confirmServices";

/** More keys than every seed file holds together is not a real selection. */
const MAX_KEYS = 1000;

/**
 * The company, its enabled CATALOGUE trades (system categories only — a
 * company's own custom quote type has no seed and is never a link target for
 * one) and every seeded row it holds, removed ones included. One
 * tenant-scoped read each.
 */
async function loadCompany(companyId) {
  const [company, enabled, held] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        defaultLanguage: true,
        currency: true,
        dateFormat: true,
        servicesConfirmedAt: true,
        createdAt: true,
      },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true, category: { companyId: null } },
      select: { category: { select: { id: true, key: true, label: true, labelTranslations: true } } },
    }),
    db.product.findMany({
      where: { companyId, seedKey: { not: null } },
      select: { seedKey: true, active: true, name: true, unitPrice: true, createdAt: true },
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
  return { company, trades, held };
}

function listOfKeys(raw) {
  return Array.isArray(raw) && raw.length <= MAX_KEYS && raw.every((k) => typeof k === "string" && k.length <= 160);
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

  const { company, trades, held } = await loadCompany(member.companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const language = company.defaultLanguage || "en";
  const currency = company.currency || "CAD";
  const state = heldState(held.map((p) => ({ ...p, addedForYou: isAddedForYou(p, { currency }) })));
  // Coverage counts every key the company holds, removed ones included: a
  // removed service is an answer the owner gave, not a gap in the list.
  const heldKeys = held.map((p) => p.seedKey);
  const coverage = trades.map((t) => tradeCoverage(t.key, heldKeys));
  // The thin trades are the reason the step is on the card, so they are what
  // the list is drawn for. A company that reached this screen with none thin
  // (by URL, or after the list filled up) is shown every trade it has, which
  // is still a true answer to "what do you quote?".
  const thin = thinTrades(coverage).map((c) => c.key);
  const drawFor = thin.length ? thin : trades.map((t) => t.key);
  const groups = candidateGroups(candidateServicesFor(drawFor), {
    language,
    currency,
    heldSeedKeys: state.active,
    archivedSeedKeys: state.archived,
    addedForYouKeys: state.addedForYou,
  });

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

  // "We added N services for {trades} when you signed up" — measured from
  // the rows' own creation times (lib/services/addedForYou.js), and named by
  // the enabled trades those rows cover. Nothing seeded at signup → null, and
  // the screen prints no sentence rather than "We added 0".
  const atSignup = signupSeededRows(held, company.createdAt);
  const atSignupKeys = atSignup.map((p) => p.seedKey);
  const signupTrades = trades
    .filter((t) => tradeCoverage(t.key, atSignupKeys).installed > 0)
    .map((t) => labelOf.get(t.key) || t.key);

  return NextResponse.json({
    confirmedAt: company.servicesConfirmedAt,
    // The screen prints the date in the browser's own clock, in the format
    // the company chose (lib/format/companyDate.js).
    dateFormat: company.dateFormat || null,
    language,
    currency,
    coverageMin: QUOTE_COVERAGE_MIN,
    seededAtSignup: atSignup.length ? { count: atSignup.length, trades: signupTrades } : null,
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
  // Absent = nothing to remove: the screen before 2026-09-25 posted seedKeys
  // alone, and a tab left open across the deploy must still confirm.
  const rawRemove = body?.removeSeedKeys === undefined ? [] : body.removeSeedKeys;
  if (!listOfKeys(raw) || !listOfKeys(rawRemove)) {
    return NextResponse.json({ error: "seedKeys must be a list of service keys." }, { status: 400 });
  }

  const { company, trades, held } = await loadCompany(member.companyId);
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  // The candidate set over EVERY enabled trade, not only the thin ones the
  // screen drew: a trade that stopped being thin between the screen's load
  // and this press must not turn a key it showed into a refusal. Every key it
  // could have shown is in here; nothing outside the company's trades and
  // their neighbours is.
  const plan = planServiceChanges({
    add: raw,
    remove: rawRemove,
    candidates: candidateServicesFor(trades.map((t) => t.key)),
    heldRows: held,
  });
  if (plan.conflicting.length) {
    return NextResponse.json(
      { error: "A service can't be added and removed in the same save.", conflicting: plan.conflicting.slice(0, 20) },
      { status: 400 },
    );
  }
  if (plan.unknown.length) {
    return NextResponse.json(
      { error: "Some of those services are not offered for your trades, or are not in your list.", unknown: plan.unknown.slice(0, 20) },
      { status: 400 },
    );
  }

  const categoryIdOf = new Map(trades.map((t) => [t.key, t.id]));
  let created = 0;
  let skipped = 0;
  let restored = 0;
  let removed = 0;
  try {
    // Restore first, create second, archive last: each is keyed and
    // idempotent, so a failure part-way leaves a state the next press
    // completes exactly — and never one where a row the owner kept was
    // archived while the rows they asked for were not yet there.
    if (plan.restore.length) {
      const r = await db.product.updateMany({
        where: { companyId: member.companyId, seedKey: { in: plan.restore }, active: false },
        data: { active: true },
      });
      restored = r?.count || 0;
    }
    for (const [trade, services] of plan.create) {
      const r = await createSeededServices({
        companyId: member.companyId,
        categoryId: categoryIdOf.get(trade),
        categoryKey: trade,
        services,
      });
      created += r?.created || 0;
      skipped += r?.skipped || 0;
    }
    if (plan.archive.length) {
      const r = await db.product.updateMany({
        where: { companyId: member.companyId, seedKey: { in: plan.archive }, active: true },
        data: { active: false },
      });
      removed = r?.count || 0;
    }
  } catch (err) {
    console.error("[confirm-services] write failed", err);
    // Not confirmed: every write above is keyed, so pressing again finishes
    // exactly what did not land. Stamping here would take the step off the
    // card on a list the company never got.
    return NextResponse.json({ error: "Could not save those changes. Try again." }, { status: 500 });
  }

  // Stamped once — the first answer is the fact the column records. A later
  // press changes rows but does not move the date.
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
    restored,
    removed,
    skipped,
    requested: plan.requested,
    confirmedAt: after?.servicesConfirmedAt ?? null,
  });
}
