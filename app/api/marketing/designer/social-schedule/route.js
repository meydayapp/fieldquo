// app/api/marketing/designer/social-schedule/route.js
//
// GET — every SocialPublish row for the company across ALL designs, for the
// calendar at app/app/marketing/designer/calendar/page.js
// (docs/SOCIAL-SCHEDULING.md). Deliberately a different route from
// designs/[id]/publish's own GET, which is scoped to one design's history —
// the calendar's whole point is showing everything scheduled company-wide,
// the same way app/api/appointments doesn't scope by client.
//
// Returns a bounded window (default: the surrounding ~3 months) rather than
// the company's whole publish history — a calendar only ever renders one
// month at a time, and an unbounded query here would grow without limit as
// a company's history does.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

// A generous but real bound on how far back/forward a single request can
// ask for — the calendar only ever needs a few months around the visible
// one, and an unbounded range query is an easy way to make this route as
// slow as the company's entire publish history.
const MAX_RANGE_DAYS = 400;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const now = new Date();

  // `from`/`to` are optional ISO dates from the calendar's own month
  // paging. Malformed or missing values fall back to a sane default (60
  // days back, 120 forward) rather than 400ing — a calendar that can't
  // parse its own query string should still show SOMETHING, not an error
  // screen, the same "degrade, don't break" instinct
  // lib/site/generateSite.js's fallback path follows.
  const fromParam = new Date(searchParams.get("from"));
  const toParam = new Date(searchParams.get("to"));
  const from = Number.isNaN(fromParam.getTime())
    ? new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    : fromParam;
  let to = Number.isNaN(toParam.getTime())
    ? new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000)
    : toParam;

  const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (!(rangeDays > 0)) {
    return NextResponse.json({ error: "`to` must be after `from`." }, { status: 400 });
  }
  if (rangeDays > MAX_RANGE_DAYS) {
    to = new Date(from.getTime() + MAX_RANGE_DAYS * 24 * 60 * 60 * 1000);
  }

  // Ordered by whichever timestamp actually describes when it happens or
  // will happen: scheduledFor for anything still waiting, createdAt (an
  // immediate publish has no scheduledFor at all) otherwise. Filtered on
  // BOTH so an old immediate publish from six months ago doesn't show up in
  // "this month" just because scheduledFor is null and therefore not
  // excluded by a naive range filter on that column alone.
  const rows = await db.socialPublish.findMany({
    where: {
      companyId: member.companyId,
      OR: [
        { scheduledFor: { gte: from, lte: to } },
        { AND: [{ scheduledFor: null }, { createdAt: { gte: from, lte: to } }] },
      ],
    },
    select: {
      id: true,
      platform: true,
      status: true,
      caption: true,
      imageUrl: true,
      ratioKey: true,
      isMock: true,
      scheduledFor: true,
      publishedAt: true,
      createdAt: true,
      errorMessage: true,
      design: { select: { id: true, name: true } },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: 500,
  });

  return NextResponse.json({ from, to, rows });
}
