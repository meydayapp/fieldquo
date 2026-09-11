// app/api/platform/sales/reps/[id]/queue/route.js
//
// One rep's queue as the console sees it — and the two things a superadmin
// can do to it without deactivating anybody.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner: "in the /platform I should also see how many leads the sales
// have in their queue and manually release them if needed, in case they
// disconnect and do not reconnect." A rep who claimed a hundred rows at nine
// and lost their connection at ten is sitting on a hundred rows nobody else
// can dial until the hourly sweep decides their day has ended — in their
// zone, which may be hours away. This is the hand on the lever before then.
//
// ══ GET: what they hold, whether they are here, who could take it ═════════
//
// The held rows are counted by lib/sales/prospectView.js's queueWhere() — the
// same predicate the rep's own queue screen lists — and split by
// lib/sales/queueBatch.js's untouched rule, so "37 held, 12 untouched" here
// is what "Release the rest" would give back there. Presence is
// lib/sales/calls/store.js's presenceFor(), the same rows the floor board is
// drawn from; a stale "available" is reported as stale, never as available.
//
// ══ POST: release, or move ════════════════════════════════════════════════
//
// Release calls releaseUntouched() — the ONE function that puts a Prospect
// back in the pool. It is the function behind the rep's "Release the rest"
// and behind the hourly cron; this route imports it and defines nothing of
// its own, because a second release path is a second opinion about what
// "untouched" means. "Release all held" is the same function with
// `includeDialled`, and the confirm on the screen says the only thing that
// changes: a row the rep dialled loses its place in their list. Nothing is
// deleted; the claim row closes with reason "admin".
//
// Move is lib/sales/reassign.js's reassignHeld(). Its header says what moves
// and what does not: attributions and commission stay with the rep who earned
// them, only work in progress changes hands.
//
// Superadmin only, stated the way the sibling routes state it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { releaseUntouched } from "@/lib/sales/queueBatch";
import { handoffTargets, heldSelect, openLeadWhere, reassignHeld, summariseHeld } from "@/lib/sales/reassign";
import { queueWhere } from "@/lib/sales/prospectView";
import { presenceFor } from "@/lib/sales/calls/store";
import { PAUSE_REASONS, REP_STATES } from "@/lib/sales/calls/agentState";

const ACTIONS = Object.freeze(["release_untouched", "release_all", "reassign"]);

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: { status: 403, body: { error: "Only superadmins can manage a rep's queue" } },
    };
  }
  return { admin, refusal: null };
}

async function repQueue(rep, now) {
  const [held, openLeads, presenceRows] = await Promise.all([
    db.prospect.findMany({ where: queueWhere(rep.id, { now }), select: heldSelect(rep.id) }),
    db.salesLead.count({ where: openLeadWhere(rep.id) }),
    presenceFor([rep.id], { now }).catch(() => null),
  ]);
  const summary = summariseHeld(held, { salesRepId: rep.id, now });
  const live = presenceRows?.[0]?.presence || null;
  return {
    ...summary,
    openLeads,
    // Null when the call store is not available on this build: "could not
    // look" is a different answer from "offline", and the screen prints it as
    // one.
    presence: live
      ? {
          state: live.state,
          label: REP_STATES[live.state]?.label || live.state,
          pauseReason: live.pauseReason,
          pauseLabel: live.pauseReason ? PAUSE_REASONS[live.pauseReason]?.label || live.pauseReason : null,
          since: live.since,
          lastSeenAt: live.lastSeenAt,
          stale: live.stale,
          everSeen: live.everSeen,
          everSignedIn: live.everSignedIn,
          portalSeenAt: live.portalSeenAt,
        }
      : null,
  };
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise.
  const _params = await params;
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const rep = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: { id: true, name: true, active: true },
  });
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  // The queue first, because the targets depend on it: how many of the held
  // rows are Quebec rows decides which reps the picker may offer — a rep
  // without French is greyed, with the reason, when there are any.
  const queue = await repQueue(rep, now);
  const targets = await handoffTargets({ db, admin, excludeRepId: rep.id, frenchHeld: queue.french });
  return NextResponse.json({ rep, queue, ...targets, at: now.toISOString() });
}

export async function POST(request, { params }) {
  const _params = await params;
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const rep = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: { id: true, name: true, email: true, active: true },
  });
  if (!rep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  }
  const now = new Date();

  if (action === "release_untouched" || action === "release_all") {
    const includeDialled = action === "release_all";
    const result = await releaseUntouched({ db, rep, reason: "admin", includeDialled, now });
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_rep_queue_released",
        details: {
          salesRepId: rep.id,
          email: rep.email,
          scope: includeDialled ? "all_held" : "untouched",
          released: result.released,
          kept: result.kept,
          prospectIds: result.releasedIds,
        },
      },
    });
    return NextResponse.json({
      ok: true,
      action,
      released: result.released,
      kept: result.kept,
      queue: await repQueue(rep, now),
    });
  }

  // reassign
  const toRepId = typeof body.toRepId === "string" ? body.toRepId : "";
  if (!toRepId) return NextResponse.json({ error: "Choose a rep to move the work to." }, { status: 400 });
  if (toRepId === rep.id) {
    return NextResponse.json({ error: "That is the same rep. Choose a different one." }, { status: 400 });
  }
  const toRep = await db.salesRep.findUnique({
    where: { id: toRepId },
    // sellsIn: reassignHeld refuses the move when the target cannot take a
    // Quebec row the source holds — lib/sales/leadLanguage.js — and it can
    // only judge that from the row it is handed.
    select: { id: true, name: true, email: true, active: true, sellsIn: true },
  });
  if (!toRep) return NextResponse.json({ error: "That rep does not exist." }, { status: 404 });
  if (!toRep.active) {
    return NextResponse.json(
      { error: "That rep is deactivated. Work can only be moved to an active rep." },
      { status: 409 },
    );
  }

  const moved = await reassignHeld({ db, fromRep: rep, toRep, now });
  // 409 with the reason — the language refusal carries `code: "language"`
  // and the count, so the screen can say which rows and offer the fix.
  if (moved.error) {
    return NextResponse.json(
      { error: moved.error, ...(moved.code ? { code: moved.code, cannot: moved.cannot } : {}) },
      { status: 409 },
    );
  }

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_rep_queue_reassigned",
      details: {
        fromSalesRepId: rep.id,
        fromEmail: rep.email,
        toSalesRepId: toRep.id,
        toEmail: toRep.email,
        prospects: moved.prospects,
        leases: moved.leases,
        worked: moved.worked,
        leads: moved.leads,
        batchId: moved.batchId,
        // Stated in the row because it is the question asked afterwards:
        // attributions and commission did not move, on purpose.
        attributionsMoved: 0,
      },
    },
  });
  return NextResponse.json({ ok: true, action, ...moved, queue: await repQueue(rep, now) });
}
