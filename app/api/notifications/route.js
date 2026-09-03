// app/api/notifications/route.js
//
// The feed one member reads, and the unread count the bell polls.
//
// ══ No route here ever accepts a recipient id ══════════════════════════════
//
// Audit §7.3 names this as a whole class of problem to design out rather than
// guard against: `Notification.recipientMemberId` written from a request body
// would need an entry in lib/tenant/ownedIds.js and a proof on every write. So
// the recipient is never in the request at all — the only rows this route can
// see are the ones whose memberId equals the caller's own Member id, resolved
// from the session by getCurrentMember.
//
// The query string carries `limit`, `before` and `count` and nothing else. A
// `memberId` or `userId` parameter is not merely ignored here; there is nothing
// for one to reach.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { serialiseDelivery } from "@/lib/notifications/render";

const MAX_LIMIT = 50;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A support session has no Member row (getCurrentMember returns id: null for
  // an impersonating platform admin), so there is nothing addressed to them and
  // the honest answer is an empty feed rather than somebody else's. Reads are
  // otherwise allowed under impersonation — the same rule
  // app/api/activity/route.js:20-31 documents — but "read-only" here resolves
  // to "there is nothing of yours to read".
  if (!member.id) {
    return NextResponse.json({ unread: 0, notifications: [], impersonating: Boolean(member.impersonation) });
  }

  const { searchParams } = new URL(request.url);

  const unread = await db.notificationDelivery.count({
    where: { companyId: member.companyId, memberId: member.id, readAt: null },
  });

  // The bell polls for a number, not a list. One indexed count against
  // [companyId, memberId, readAt, createdAt] instead of a page of rows plus the
  // event join — see the poll comment in NotificationBell.js.
  if (searchParams.get("count")) {
    return NextResponse.json({ unread });
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || 20));
  const before = searchParams.get("before");

  const deliveries = await db.notificationDelivery.findMany({
    where: {
      companyId: member.companyId,
      memberId: member.id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      event: {
        select: {
          type: true,
          entityType: true,
          entityId: true,
          params: true,
          amount: true,
          currency: true,
          actorName: true,
          createdAt: true,
        },
      },
    },
  });

  // The grid, for the money decision — getCurrentMember does not return
  // `permissions`, and lib/notifications/render.js needs it to decide whether
  // this reader sees a figure. Loaded once for the whole page rather than per
  // row.
  const full = await loadEnforceableMember(db, member.id);

  return NextResponse.json({
    unread,
    notifications: deliveries.map((d) => serialiseDelivery(d, full)),
    nextBefore: deliveries.length === limit ? deliveries[deliveries.length - 1].createdAt : null,
  });
}
