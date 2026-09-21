// app/api/calendar/google/busy/route.js
//
// The grey "busy (Google)" blocks the calendar page draws: opaque intervals
// from connected members' own calendars, never a title — the freebusy read
// (lib/calendar/googleBusy.js) has none to give.
//
// Scoped the way the schedule itself is: a member who may see the whole
// team's schedule (lib/schedule/teamScope.js canSeeTeamSchedule) sees every
// connected colleague's blocks; anyone else sees only their own. The
// question is answered from the permission grid, not from a query string.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { canSeeTeamSchedule } from "@/lib/schedule/teamScope";
import { googleCalendarConfigured } from "@/lib/calendar/googleClient";
import { googleBusyRanges } from "@/lib/calendar/googleBusy";

/** At most a quarter, whatever the page asks for. */
const MAX_WINDOW_MS = 93 * 86400000;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!googleCalendarConfigured()) return NextResponse.json({ blocks: [], configured: false });

  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || "");
  const to = new Date(url.searchParams.get("to") || "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !(to > from)) {
    return NextResponse.json({ error: "from and to must be ISO instants, from before to." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
    return NextResponse.json({ error: "Window too wide." }, { status: 400 });
  }

  const full = await loadEnforceableMember(db, member.id);
  const teamWide = canSeeTeamSchedule(full);

  const connections = await db.memberGoogleCalendar.findMany({
    where: {
      busyReadEnabled: true,
      member: teamWide ? { companyId: member.companyId, active: true } : { id: member.id },
    },
    select: { memberId: true, member: { select: { userId: true, user: { select: { name: true } } } } },
  });

  const blocks = [];
  for (const c of connections) {
    const ranges = await googleBusyRanges({ userId: c.member.userId, companyId: member.companyId, from, to });
    for (const r of ranges) {
      if (r.memberId !== c.memberId) continue;
      blocks.push({
        start: r.start.toISOString(),
        end: r.end.toISOString(),
        userId: c.member.userId,
        memberName: c.member.user?.name || null,
      });
    }
  }
  blocks.sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json({ blocks, configured: true });
}
