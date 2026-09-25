// app/api/platform/signups/assign/route.js
//
// POST — what a superadmin can DO to a row on /platform/signups: hand it to a
// rep for a callback (`assign`), take it back from the rep to the platform
// (`take_back`), move it from one rep to another (`reassign`), or set the
// trade its own words did not map to (`set_trade`). One or many rows per call
// (the sticky bulk bar sends many).
//
// ══ Why this is a separate file from ../route.js ═══════════════════════════
//
// That endpoint is read-only by design and asserted so (non-negotiable #3:
// the platform console views a company's data and edits nothing). Nothing
// here touches a Company either: the writes are to FieldQuo's OWN sales rows
// — a Prospect, a SalesQueueClaim, an audit line — through the same functions
// the review folder's assign uses (lib/signup/salesFloor.js). Keeping the
// write in its own file keeps that assertion literally true of the list.
//
// ══ Superadmin only ════════════════════════════════════════════════════════
//
// The same gate as /api/platform/sales/review/signups and the reps' assign
// route: handing leads to reps is the owner's job. Checked by role, fresh,
// never by a hidden button.
//
// ══ The owner's rule on referred signups ═══════════════════════════════════
//
// A signup that came in on a rep's link is that rep's. assignSignupForCallback
// refuses any other rep and names the one it belongs to; the screen never
// offers the picker on such a row in the first place.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { assignSignupForCallback, setSignupTrade } from "@/lib/signup/salesFloor";
import { reassignSignup, takeBackSignup } from "@/lib/signup/assignment";

const MAX_TARGETS = 200;

/**
 * The admin with their sign-in address: the rep's push names who took the
 * row ("Emilio Boves took back …", adminDisplayName reads the address), and
 * getCurrentPlatformAdmin does not carry it. The review folder's route reads
 * it the same way.
 */
async function withEmail(admin) {
  const row = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true } }).catch(() => null);
  return { ...admin, email: row?.email || admin.email || null };
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can assign signups to a rep" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const targets = Array.isArray(body?.targets) ? body.targets.slice(0, MAX_TARGETS) : [];
  const clean = targets
    .map((t) => ({
      leadId: typeof t?.leadId === "string" && t.leadId ? t.leadId : null,
      companyId: typeof t?.companyId === "string" && t.companyId ? t.companyId : null,
    }))
    .filter((t) => t.leadId || t.companyId);
  if (!clean.length) return NextResponse.json({ error: "Pick at least one signup." }, { status: 400 });

  const now = new Date();

  if (action === "assign") {
    const salesRepId = typeof body?.salesRepId === "string" ? body.salesRepId : "";
    const rep = salesRepId
      ? await db.salesRep.findUnique({ where: { id: salesRepId }, select: { id: true, name: true, email: true, active: true, endedAt: true, sellsIn: true, language: true } })
      : null;
    if (!rep) return NextResponse.json({ error: "Choose a rep to assign to." }, { status: 400 });
    if (rep.active === false || rep.endedAt) return NextResponse.json({ error: "That rep is deactivated." }, { status: 400 });

    const results = [];
    for (const t of clean) {
      const r = await assignSignupForCallback({ client: db, admin, rep, leadId: t.leadId, companyId: t.companyId, now }).catch((err) => ({
        error: err?.message || "Could not assign.",
      }));
      results.push({ ...t, ...r });
    }
    const assigned = results.filter((r) => r.assigned === 1).length;
    return NextResponse.json({ ok: true, assigned, results, rep: { id: rep.id, name: rep.name } });
  }

  // ── Take back to the platform / move to another rep ─────────────────────
  //
  // The owner, 2026-09-24: "assign it back to me, the platform". Both go
  // through lib/signup/assignment.js, which re-reads the floor row, the
  // holder and the do-not-contact list in THIS request — nothing the screen
  // computed when it rendered is trusted. The admin behind the gate above
  // is the one named in the audit row and on the rep's push.
  if (action === "take_back") {
    const actor = await withEmail(admin);
    const results = [];
    for (const t of clean) {
      const r = await takeBackSignup({ client: db, admin: actor, leadId: t.leadId, companyId: t.companyId, now }).catch((err) => ({
        error: err?.message || "Could not take it back.",
      }));
      results.push({ ...t, ...r });
    }
    const takenBack = results.filter((r) => r.takenBack === 1).length;
    return NextResponse.json({ ok: true, takenBack, results });
  }

  if (action === "reassign") {
    const salesRepId = typeof body?.salesRepId === "string" ? body.salesRepId : "";
    const rep = salesRepId
      ? await db.salesRep.findUnique({ where: { id: salesRepId }, select: { id: true, name: true, email: true, active: true, endedAt: true, sellsIn: true, language: true } })
      : null;
    if (!rep) return NextResponse.json({ error: "Choose a rep to move it to." }, { status: 400 });
    if (rep.active === false || rep.endedAt) return NextResponse.json({ error: "That rep is deactivated." }, { status: 400 });
    const actor = await withEmail(admin);
    const results = [];
    for (const t of clean) {
      let r = await reassignSignup({ client: db, admin: actor, rep, leadId: t.leadId, companyId: t.companyId, now }).catch((err) => ({
        error: err?.message || "Could not reassign.",
      }));
      // Nobody holds it any more (the lease lapsed, or it was taken back,
      // since the page loaded): "move it to Ann" is then "give it to Ann",
      // through the ordinary assign with every one of its guards.
      if (r.unheld) {
        r = await assignSignupForCallback({ client: db, admin: actor, rep, leadId: t.leadId, companyId: t.companyId, now }).catch((err) => ({
          error: err?.message || "Could not assign.",
        }));
      }
      results.push({ ...t, ...r });
    }
    const moved = results.filter((r) => r.reassigned === 1 || r.assigned === 1).length;
    return NextResponse.json({ ok: true, moved, results, rep: { id: rep.id, name: rep.name } });
  }

  if (action === "set_trade") {
    const tradeKey = typeof body?.tradeKey === "string" ? body.tradeKey : "";
    const results = [];
    for (const t of clean) {
      const r = await setSignupTrade({ client: db, leadId: t.leadId, companyId: t.companyId, tradeKey, now }).catch((err) => ({
        error: err?.message || "Could not set the trade.",
      }));
      results.push({ ...t, ...r });
    }
    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
