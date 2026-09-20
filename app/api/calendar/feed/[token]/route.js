// app/api/calendar/feed/[token]/route.js
//
// GET /api/calendar/feed/{token}.ics — one member's calendar, as the file a
// phone subscribes to. No session: a calendar app cannot sign in, so the
// token in the path IS the credential, and everything about this handler
// follows from that.
//
// ── The refusals say nothing ───────────────────────────────────────────────
//
// A wrong token, a malformed one, a rotated one and a deactivated member's
// all answer an empty 404. Not a JSON error, not a reason: the only caller
// with a legitimate wrong token is a phone still polling a link its owner
// regenerated, and it needs nothing from the body — while anything that
// distinguished "no such token" from "token exists, member inactive" would
// let a guesser confirm a hit. Length and charset are checked before the
// database is touched, so a flood of junk is refused without a query.
//
// ── Why the shape is /feed/{token}.ics and not /feed?token= ────────────────
//
// Apple Calendar and Outlook decide what a webcal URL is by its extension,
// and Google's "add by URL" is happiest with a path that ends in .ics. Next
// cannot route a partially-dynamic segment ("[token].ics"), so the segment is
// [token] and the handler strips the suffix itself.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { loadScheduleFeed } from "@/lib/schedule/feed";
import { buildFeedCalendar, feedEventsFor, feedWindow, FEED_TTL_SECONDS } from "@/lib/calendar/feed";
import { getAppOrigin } from "@/lib/appUrl";
import { rateLimit } from "@/lib/rateLimit";

/** What lib/calendar/feedToken.js mints: 24 random bytes, base64url. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

function notFound() {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request, { params }) {
  // A phone re-reads every fifteen minutes to a few hours; sixty in ten
  // minutes per address is a whole crew behind one office router with
  // headroom, and nowhere near a token-guessing loop.
  const limited = rateLimit(request, "calendar-feed", { limit: 60, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const { token: raw } = await params;
  const token = String(raw || "").replace(/\.ics$/i, "");
  if (!TOKEN_SHAPE.test(token)) return notFound();

  const member = await db.member.findFirst({
    where: { calendarFeedToken: token, active: true },
    select: { id: true, userId: true, companyId: true, role: true },
  });
  if (!member) return notFound();

  const [full, company] = await Promise.all([
    loadEnforceableMember(db, member.id),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true, timezone: true, defaultLanguage: true },
    }),
  ]);
  if (!full || !company) return notFound();

  const now = new Date();
  const { from, to } = feedWindow(now);
  const entries = await loadScheduleFeed(db, member, full, { from, to });
  const events = feedEventsFor({ entries, full, company, origin: getAppOrigin(request), now });
  const ics = buildFeedCalendar({ events, company, from, to });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // `private`: the URL is a credential, and a shared cache in front of
      // it would hand one member's calendar to the next request for the
      // same path from a different network.
      "Cache-Control": `private, max-age=${FEED_TTL_SECONDS}`,
      "Content-Disposition": 'inline; filename="fieldquo.ics"',
    },
  });
}
