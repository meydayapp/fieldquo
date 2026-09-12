// app/api/platform/sales/retry-pool/route.js
//
// The retry pool from the platform side: the rule table as it stands, the
// rows the rule has finished with, and the one thing a superadmin can do
// about them.
//
// ══ GET ════════════════════════════════════════════════════════════════════
//
// The rule table — lib/sales/retryRules.js RETRY_RULES, read-only, printed
// so the owner can see the numbers a rep's queue is being ordered by — and
// the Exhausted list: every Prospect with `exhaustedAt` set, newest first,
// fifty at a time, with the count. The list is FieldQuo's own discovered
// data; non-negotiable #3 is about a customer's tenant and does not reach
// here.
//
// The table is NOT editable from this route, on purpose. Each rule's number
// is paired with a reason in the module, and a superadmin changing "no answer
// → 4" to 40 from a form would change a rep's day without the sentence that
// explains why. lib/sales/calls/dispositions.js makes the same argument for
// the disposition vocabulary. If the owner wants the numbers editable, that
// is a product decision and it needs a reason column beside every number.
//
// ══ POST: recycle ══════════════════════════════════════════════════════════
//
// One or more exhausted rows back into the pool: `attemptCount` to zero,
// `exhaustedAt` cleared, `recycledAt` / `recycledById` stamped, the last
// outcome KEPT. Nothing is deleted — every SalesCallAttempt stays, the
// claim log stays. The write is guarded on `exhaustedAt: { not: null }` so a
// row somebody else recycled a second ago (or that was never exhausted) is
// not stamped twice, and the count the response prints is what the write
// matched, never what was asked. One audit row per press, listing the ids.
//
// Superadmin only, stated the way the sibling routes state it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { RETRY_BLOCKS, recycleData, retryRuleTable, retryStateOf } from "@/lib/sales/retryRules";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import { discoveryTradeLabel } from "@/lib/sales/discovery/trades";

const EXHAUSTED_PAGE_SIZE = 50;
/** How many rows one recycle press may name. */
const RECYCLE_MAX = 200;

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: { status: 403, body: { error: "Only superadmins can recycle exhausted prospects" } },
    };
  }
  return { admin, refusal: null };
}

const EXHAUSTED_SELECT = {
  id: true,
  businessName: true,
  city: true,
  province: true,
  country: true,
  tradeKey: true,
  phoneE164: true,
  attemptCount: true,
  nextAttemptAt: true,
  lastOutcome: true,
  retryBlock: true,
  exhaustedAt: true,
  recycledAt: true,
  recycledById: true,
  assignedRepId: true,
  claimExpiresAt: true,
  doNotContactAt: true,
  status: true,
};

function rowView(p, now) {
  const s = retryStateOf(p, now);
  return {
    id: p.id,
    businessName: p.businessName,
    place: [p.city, p.province, p.country].filter(Boolean).join(", "),
    tradeKey: p.tradeKey,
    tradeLabel: p.tradeKey ? discoveryTradeLabel(p.tradeKey) || p.tradeKey : null,
    phoneE164: p.phoneE164,
    attemptCount: s.attemptCount,
    maxAttempts: s.maxAttempts,
    lastOutcome: s.lastOutcome,
    lastOutcomeLabel: s.lastOutcome ? DISPOSITIONS[s.lastOutcome]?.label || s.lastOutcome : null,
    exhaustedAt: s.exhaustedAt ? s.exhaustedAt.toISOString() : null,
    recycledAt: s.recycledAt ? s.recycledAt.toISOString() : null,
    recycledById: p.recycledById || null,
    // Whether a rep still holds the lease (it lapses 48 h after the last
    // disposition). Said so the owner knows a recycle now puts the row back
    // for THAT rep first, not for the pool.
    heldByRepId: p.assignedRepId && p.claimExpiresAt && p.claimExpiresAt.getTime() > now.getTime() ? p.assignedRepId : null,
    doNotContact: Boolean(p.doNotContactAt),
    status: p.status,
  };
}

async function exhaustedPage({ page, now }) {
  const where = { exhaustedAt: { not: null } };
  const [total, rows, recycledTotal] = await Promise.all([
    db.prospect.count({ where }),
    db.prospect.findMany({
      where,
      orderBy: [{ exhaustedAt: "desc" }],
      skip: Math.max(0, page - 1) * EXHAUSTED_PAGE_SIZE,
      take: EXHAUSTED_PAGE_SIZE,
      select: EXHAUSTED_SELECT,
    }),
    // How many rows have been through a recycle at all, so the owner can see
    // the lever has been used and how often — a recycled row that exhausts
    // again shows in the list above with both dates.
    db.prospect.count({ where: { recycledAt: { not: null } } }),
  ]);
  return {
    total,
    recycledTotal,
    page,
    pageSize: EXHAUSTED_PAGE_SIZE,
    rows: rows.map((p) => rowView(p, now)),
  };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const page = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const now = new Date();
  return NextResponse.json({
    rules: retryRuleTable(),
    blocks: [...RETRY_BLOCKS],
    exhausted: await exhaustedPage({ page, now }),
    at: now.toISOString(),
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "recycle") {
    return NextResponse.json({ error: "action must be recycle" }, { status: 400 });
  }
  const raw = Array.isArray(body.prospectIds) ? body.prospectIds : typeof body.prospectId === "string" ? [body.prospectId] : [];
  const ids = [...new Set(raw.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim().slice(0, 40)))];
  if (ids.length === 0) return NextResponse.json({ error: "Which prospects?" }, { status: 400 });
  if (ids.length > RECYCLE_MAX) {
    return NextResponse.json({ error: `At most ${RECYCLE_MAX} prospects per press.` }, { status: 400 });
  }

  const now = new Date();
  // Guarded on the state that was asked for: only a row that IS exhausted is
  // recycled, and the count is the write's, so two admins pressing at once
  // cannot both be told they recycled the same row.
  const done = await db.prospect.updateMany({
    where: { id: { in: ids }, exhaustedAt: { not: null } },
    data: recycleData({ adminId: admin.id, now }),
  });
  const recycled = await db.prospect.findMany({
    where: { id: { in: ids }, recycledAt: now, recycledById: admin.id },
    select: { id: true },
  });
  const recycledIds = recycled.map((r) => r.id);
  if (recycledIds.length > 0) {
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_prospect_recycled",
        details: { count: recycledIds.length, prospectIds: recycledIds, askedFor: ids.length },
      },
    });
  }
  const page = Math.max(1, Number.parseInt(body.page, 10) || 1);
  return NextResponse.json({
    ok: true,
    recycled: done.count,
    recycledIds,
    // Asked for but not recycled: not exhausted (already recycled, or never
    // was). Said, so a press that did less than it asked is not read as done.
    skipped: ids.length - recycledIds.length,
    exhausted: await exhaustedPage({ page, now }),
  });
}
