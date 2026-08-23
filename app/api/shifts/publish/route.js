// app/api/shifts/publish/route.js
//
// Publish (or unpublish) every draft shift in a date range in one action — the
// "Publish week" button. Publishing is the moment the schedule becomes visible
// to workers, so it's deliberately explicit rather than per-shift-on-create.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ── The schedule grid decides this, not the coarse role ────────────────
  //
  // `user:manage` is held by SUPERVISORS — it means "may run a crew". The
  // refusal message beside it said "Only an admin or owner", which was already
  // untrue, and the granular `schedule` level was never consulted at all. So a
  // Manager whose schedule was narrowed to their own still edited and
  // published everyone's week.
  //
  // edit_all is the level whose own label is "Edit everyone's schedule" — the
  // same one the appointments routes ask about, because a shift and a visit
  // are the same question wearing different words.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_all")) {
    return NextResponse.json(
      { error: "You can only change your own schedule. Ask whoever runs the rota to change this." },
      { status: 403 },
    );
  }

  const { from, to, published = true } = await request.json().catch(() => ({}));
  if (!from || !to) return NextResponse.json({ error: "from and to are required." }, { status: 400 });

  const result = await db.shift.updateMany({
    where: { companyId: member.companyId, start: { gte: new Date(from), lte: new Date(to) } },
    data: { published: Boolean(published) },
  });
  return NextResponse.json({ ok: true, count: result.count, published: Boolean(published) });
}
