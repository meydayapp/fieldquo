// app/api/shifts/publish/route.js
//
// Publish (or unpublish) every draft shift in a date range in one action — the
// "Publish week" button. Publishing is the moment the schedule becomes visible
// to workers, so it's deliberately explicit rather than per-shift-on-create.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { notifyPublished, notifyShiftChange, recordShiftActivity } from "@/lib/shifts/shiftNotify";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
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

  // ── Read what is about to flip, then flip it ─────────────────────────────
  //
  // updateMany answers with a count and nothing else, and the count was all
  // this route ever knew. The rows that CHANGE are what matter: a worker is
  // told about the shifts that just became visible to them (never the ones
  // that were already published — a re-press of Publish must not re-notify
  // the whole crew), and an unpublish tells the people whose shifts just
  // vanished from their phone. So the rows whose `published` differs from
  // the target are read first, the update is scoped to exactly those, and
  // the notifications go out after it has committed.
  const target = Boolean(published);
  const changing = await db.shift.findMany({
    where: {
      companyId: member.companyId,
      start: { gte: new Date(from), lte: new Date(to) },
      published: !target,
    },
    select: {
      id: true,
      workerId: true,
      start: true,
      end: true,
      jobId: true,
      published: true,
      job: { select: { title: true, siteAddress: true, client: { select: { name: true } } } },
    },
  });
  const result = changing.length
    ? await db.shift.updateMany({
        where: { id: { in: changing.map((s) => s.id) }, companyId: member.companyId },
        data: { published: target },
      })
    : { count: 0 };

  if (result.count > 0) {
    // One audit row for the press, not one per shift: "Published 14 shifts"
    // is the fact; the per-shift trail is on each shift's own edits.
    await recordShiftActivity(member, {
      verb: "published",
      shift: { id: null, start: from, end: to, published: target },
      count: result.count,
    });
    if (target) {
      notifyPublished({ companyId: member.companyId, shifts: changing, actorUserId: member.userId || null }).catch(() => {});
    } else {
      for (const s of changing) {
        notifyShiftChange({
          companyId: member.companyId,
          before: { ...s, published: true },
          after: { ...s, published: false },
          actorUserId: member.userId || null,
        }).catch(() => {});
      }
    }
  }
  return NextResponse.json({ ok: true, count: result.count, published: target });
}
