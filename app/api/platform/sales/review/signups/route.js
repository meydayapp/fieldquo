// app/api/platform/sales/review/signups/route.js
//
// The review folder's signup section: the leads the public signup form
// produced and the owner still has to hand to a rep.
//
// ══ GET ═══════════════════════════════════════════════════════════════════
//
// Every unplaced signup row — hot first, newest first — with the badge, the
// fact sentence and who to ask for, plus the active reps to assign to. Rows
// are `status: "signup"` Prospects, which the folder's own SQL never
// selects (their status is outside REVIEW_STATUSES) and the dispatcher never
// claims (outside CLAIMABLE_STATUSES); this endpoint is the one list of
// them. `?hot=1` is the funnel's link: only the abandoned ones.
//
// ══ POST ══════════════════════════════════════════════════════════════════
//
// `{ prospectId, salesRepId }` — ONE row to ONE rep, by hand. That is the
// owner's whole ruling for these ("assign to sales reps manually"), and it
// is why there is no bulk here and no "assign the next N". The write is
// lib/signup/salesFloor.js assignSignupToRep(): the same three Prospect
// columns and the same mode-"admin" claim row the prospects list's hand-pick
// writes, the same audit row, the same push to the rep. A refusal (do not
// contact, held by another rep, Quebec row to a rep with no French) comes
// back as `{ error, refused: true }` with the reason in words.
//
// Superadmin only, as the sibling assign route states it — the literal role
// check, so scripts/check-platform-truth.mjs can hold the screen to it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { assignSignupToRep, listUnplacedSignups } from "@/lib/signup/salesFloor";

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  if (admin.role !== "superadmin") {
    return { admin: null, refusal: { status: 403, body: { error: "Only superadmins can assign leads to a rep" } } };
  }
  const row = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true } });
  return { admin: { ...admin, email: row?.email || null }, refusal: null };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const hotOnly = new URL(request.url).searchParams.get("hot") === "1";
  const [signups, reps] = await Promise.all([
    listUnplacedSignups({ client: db, now, hotOnly }),
    db.salesRep.findMany({
      where: { active: true, endedAt: null, testAccount: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sellsIn: true, language: true },
    }),
  ]);
  return NextResponse.json({ signups, reps, hotOnly, count: signups.length });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const prospectId = typeof body?.prospectId === "string" ? body.prospectId.trim() : "";
  const salesRepId = typeof body?.salesRepId === "string" ? body.salesRepId.trim() : "";
  if (!prospectId || !salesRepId) {
    return NextResponse.json({ error: "prospectId and salesRepId are required" }, { status: 400 });
  }
  const rep = await db.salesRep.findUnique({
    where: { id: salesRepId },
    select: { id: true, name: true, email: true, active: true, sellsIn: true, language: true },
  });
  if (!rep) return NextResponse.json({ error: "No rep with that id." }, { status: 404 });

  const result = await assignSignupToRep({ client: db, admin, rep, prospectId, now: new Date() });
  if (result.error) return NextResponse.json({ error: result.error, refused: Boolean(result.refused) }, { status: result.refused ? 409 : 400 });
  return NextResponse.json({ ok: true, ...result, rep: { id: rep.id, name: rep.name } });
}
