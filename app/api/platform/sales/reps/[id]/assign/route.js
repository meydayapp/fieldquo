// app/api/platform/sales/reps/[id]/assign/route.js
//
// The console handing a rep their next leads.
//
// ══ GET: what the panel offers ════════════════════════════════════════════
//
// Per-trade counts for THIS rep — what they hold and what the pool would
// offer them, by the same claimCandidateWhere({ rep }) the rep's own
// ClaimCard counts with (lib/sales/assignLeads.js poolCountsFor) — the
// province list from the calling-rules table, the rep's own selling
// languages, and how many claims they have left today.
//
// ══ POST: assign ══════════════════════════════════════════════════════════
//
// Two bodies. `{ tradeKey, count, province?, language? }` hands the rep
// the next `count` of one trade through assignBatchToRep(), which is the
// rep's OWN selection (selectClaimBatch / writeClaimBatch, imported from
// lib/sales/queueBatch.js) narrowed by what was asked — never a console
// copy of the rules. `{ prospectIds }` hands the rep rows a superadmin
// ticked on /platform/sales/prospects through assignProspectsToRep(),
// which judges each row by assignRefusalFor() and returns the ones it
// would not, with why.
//
// Both write the audit row and tell the rep (push, and the Today line)
// from inside the library, so a second caller cannot forget either.
//
// Superadmin only, stated the way the sibling queue route states it: the
// literal role check, so scripts/check-platform-truth.mjs can hold the
// screen's `isSuperadmin` flag to it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { loadWindowPolicyContext } from "@/lib/sales/windowOverrides";
import {
  assignBatchToRep,
  assignOptionsFor,
  assignProspectsToRep,
  lastKnownZoneFor,
  poolCountsFor,
} from "@/lib/sales/assignLeads";
import { localDateIn } from "@/lib/sales/queueBatch";

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: { status: 403, body: { error: "Only superadmins can assign leads to a rep" } },
    };
  }
  // The token carries id and role only; the rep's notification names the
  // admin, so the sign-in email is read here (PlatformAdmin has no name).
  const row = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true } });
  return { admin: { ...admin, email: row?.email || null }, refusal: null };
}

/** The rep, with the columns the language rule and the sentences need. */
async function loadRep(id) {
  return db.salesRep.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, active: true, sellsIn: true },
  });
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const rep = await loadRep(_params.id);
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const zone = await lastKnownZoneFor({ db, salesRepId: rep.id, now });
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  const [trades, takenToday] = await Promise.all([
    poolCountsFor({ db, rep, now }),
    db.salesQueueClaim.count({ where: { salesRepId: rep.id, localDate } }),
  ]);
  return NextResponse.json({
    rep: { id: rep.id, name: rep.name, active: rep.active },
    trades,
    ...assignOptionsFor(rep),
    // Today's tally, as a fact. There is no daily ceiling to hold it
    // against (lib/sales/queueBatch.js at SHIFT_HOURS).
    takenToday,
    // The zone the rep's day is judged in — their last claim's, or UTC
    // when they have never claimed. Said so the screen can say it.
    timeZone: zone,
    at: now.toISOString(),
  });
}

export async function POST(request, { params }) {
  const _params = await params;
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const rep = await loadRep(_params.id);
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rep.active) {
    return NextResponse.json(
      { error: "That rep is deactivated. Leads can only be assigned to an active rep." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  const now = new Date();

  // ── Hand-picked rows ────────────────────────────────────────────────────
  if (Array.isArray(body.prospectIds)) {
    const result = await assignProspectsToRep({ db, rep, admin, ids: body.prospectIds, now });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, how: "picked", ...result });
  }

  // ── The next N of a trade ───────────────────────────────────────────────
  // The same override context the rep's own claim reads, so a state whose
  // window the console switched off is assignable at the same hours it is
  // claimable — lib/sales/windowOverrides.js.
  const policyContext = await loadWindowPolicyContext({ now });
  const result = await assignBatchToRep({
    db,
    rep,
    admin,
    tradeKey: typeof body.tradeKey === "string" ? body.tradeKey : "",
    count: body.count,
    province: typeof body.province === "string" ? body.province : null,
    language: typeof body.language === "string" ? body.language : null,
    now,
    policyContext,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, how: "batch", ...result });
}
