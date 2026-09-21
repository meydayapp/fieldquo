// app/api/platform/signups/assign/route.js
//
// POST — the two things a superadmin can DO to a row on /platform/signups:
// hand it to a rep for a callback, or set the trade its own words did not map
// to. One or many rows per call (the sticky bulk bar sends many).
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

const MAX_TARGETS = 200;

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
