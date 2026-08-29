// app/api/analytics/win-loss/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  hasLevel,
  hasToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { buildWinLoss } from "@/lib/analytics/winLoss";

// The three statuses that mean "this left the building". `draft` is work in
// progress and belongs in no win/loss figure — counting drafts as outstanding
// would make an abandoned half-written quote look like a live opportunity.
const OUT_STATUSES = ["sent", "accepted", "declined"];

// ══ Who may read it ════════════════════════════════════════════════════════
//
// Two things, and they are the two the report is made of:
//
//   quotes ≥ view_only  it is a list of this company's quotes, one row per
//                       opportunity, with the client's name on it
//   showPricing         every value figure is what a client was quoted, which
//                       is the rate card in aggregate — non-negotiable #4
//
// Lighter than app/api/analytics/statements/route.js on purpose. That route
// composes four predicates because a P&L is the whole cost basis with the
// revenue beside it; this one shows no cost, no margin and no wage, so
// requiring `jobCosting` and `user:manage` would take the sales report away
// from the estimator whose own quotes it is about.
//
// Where that lands, against the presets as shipped:
//
//   Crew        quotes:none, showPricing:false  → refused
//   Estimator   quotes:view_create_edit, true   → allowed (they write them)
//   Dispatcher  view_create_edit, true          → allowed
//   Manager     view_create_edit_delete, true   → allowed
//   owner/admin unrestricted                    → allowed
//
// scripts/check-win-loss.mjs EXECUTES this handler as a crew member and
// asserts the 403, rather than reading the lines above.
function winLossRefusal(full) {
  const missing = [];
  if (!hasLevel(full, "quotes", "view_only")) missing.push("quotes");
  if (!hasToggle(full, "showPricing")) missing.push("showPricing");
  if (missing.length === 0) return null;

  // One sentence whichever half failed, for the reason costBasis.js gives:
  // naming which permission was short hands a map of the model to whoever is
  // probing it. The keys stay on the error for the server log.
  const err = new Error(
    "You don't have access to the company's win/loss report — what was quoted, what was won, and what it was worth. Ask an owner or admin.",
  );
  err.status = 403;
  err.missing = missing;
  return err;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const denied = winLossRefusal(full);
  if (denied) {
    const { body, status } = permissionErrorResponse(denied);
    return NextResponse.json(body, { status });
  }

  // A route handler gets a real URL. `searchParams` is a Promise only on a
  // PAGE's props in Next 16 — getting that backwards here yields
  // "[object Promise]" as a date, silently.
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Shape-checked before a Date constructor sees them: `new Date("banana")` is
  // an Invalid Date, and an Invalid Date in a Prisma `gte` is a query error
  // with a stack trace in it rather than a sentence the caller can act on.
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    return NextResponse.json(
      { error: "Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: `The period runs backwards (${from} to ${to}).` },
      { status: 400 },
    );
  }

  const companyId = member.companyId;
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lte = new Date(`${to}T23:59:59.999Z`);

  const SELECT = {
    id: true,
    quoteNumber: true,
    status: true,
    total: true,
    acceptedTotal: true,
    sentAt: true,
    acceptedAt: true,
    declinedAt: true,
    declineReason: true,
    tierGroupId: true,
    createdById: true,
    client: { select: { name: true } },
    createdBy: { select: { name: true } },
  };

  const [inRange, undatedCount, company] = await Promise.all([
    db.quote.findMany({
      where: { companyId, status: { in: OUT_STATUSES }, sentAt: { gte, lte } },
      select: SELECT,
    }),
    // Quotes that left draft and were never stamped with a send date — every
    // quote decided before `sentAt` existed, plus anything imported. They are
    // in no period at all, so they are counted here and reported as an
    // exclusion rather than dated by guess (AGENTS.md failure class 5).
    db.quote.count({
      where: { companyId, status: { in: OUT_STATUSES }, sentAt: null },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
  ]);

  // ── The tier siblings the range clipped ──────────────────────────────────
  //
  // A Good/Better/Best trio is ONE decision, and lib/analytics/winLoss.js
  // collapses it — but only if it can see the whole group. The three rows are
  // usually sent together and usually all land inside the window; "usually" is
  // not a guarantee, and a group whose accepted sibling fell a day outside the
  // range would otherwise be scored as a loss. So any group touched by the
  // range is fetched whole; the builder still decides period membership, from
  // the group's earliest send.
  const groupIds = [...new Set(inRange.map((q) => q.tierGroupId).filter(Boolean))];
  let quotes = inRange;
  if (groupIds.length) {
    const siblings = await db.quote.findMany({
      // Same status filter as the main query. A tier option still sitting in
      // draft was never offered, and letting it in would drag the group's
      // "lowest price on the table" down to a number no client ever saw.
      where: { companyId, status: { in: OUT_STATUSES }, tierGroupId: { in: groupIds } },
      select: SELECT,
    });
    const byId = new Map(inRange.map((q) => [q.id, q]));
    for (const q of siblings) if (!byId.has(q.id)) byId.set(q.id, q);
    quotes = [...byId.values()];
  }

  let report;
  try {
    report = buildWinLoss({ from, to, quotes, undatedCount });
  } catch (err) {
    if (err?.status === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({
    ...report,
    // Null is passed through rather than defaulted to CAD here: the formatter
    // coalesces at the point of display (lib/format/money.js), and inventing a
    // currency in the payload would put it in an export too.
    currency: company?.currency || null,
  });
}
