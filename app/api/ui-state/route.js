// app/api/ui-state/route.js
//
// Per-user UI state — which first-visit tours the person has seen, which
// one-off notices they've waved away, and the account-standing flag the
// seat-sharing banner reads. Server-side so a dismissed tour stays dismissed
// across devices, not only in the browser that dismissed it.
//
// Scoped to the logged-in USER, not the company: two people at the same
// company each get the walkthrough once. getCurrentMember gives us the userId.
//
// Account standing is served from HERE rather than a route of its own because
// the app shell already calls this on every load — a second endpoint would be
// a second round trip on every page to answer a question whose answer is "no"
// for essentially every company.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

const DAY = 24 * 60 * 60 * 1000;

/**
 * What the seat-sharing banner needs, or null when there is nothing to say —
 * which is the normal case, and the reason this returns null rather than a
 * zeroed-out object the client then has to interpret.
 *
 * Never throws: the banner is a nudge, and a failure to load it must not take
 * out the tours it shares an endpoint with.
 */
async function accountStanding(companyId) {
  try {
    if (!companyId) return null;

    const [company, strike] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { accountStatus: true },
      }),
      db.accountAbuseStrike.findFirst({
        where: { companyId, createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const status = company?.accountStatus || "active";
    if (status === "active" && !strike) return null;

    return {
      status,
      latestStrikeAt: strike?.createdAt ?? null,
      // Keyed to the most recent strike, so dismissing the warning silences
      // THAT observation and no other. A permanent dismissal would let the
      // first false positive hide every later real one.
      noticeKey: strike ? `seat-sharing:${new Date(strike.createdAt).toISOString()}` : null,
    };
  } catch (err) {
    console.error("[ui-state] couldn't read account standing:", err);
    return null;
  }
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, account] = await Promise.all([
    db.user.findUnique({
      where: { id: member.userId },
      select: { uiState: true },
    }),
    accountStanding(member.companyId),
  ]);

  const seenTours = Array.isArray(user?.uiState?.seenTours)
    ? user.uiState.seenTours
    : [];
  const dismissedNotices = Array.isArray(user?.uiState?.dismissedNotices)
    ? user.uiState.dismissedNotices
    : [];
  return NextResponse.json({ seenTours, dismissedNotices, account });
}

// Mark one tour as seen, or dismiss one notice. Idempotent in both directions,
// and an impersonating support session (read-only) is refused by the middleware
// long before it reaches here, so this never records a support user's tours
// against the customer.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // ── Dismiss a one-off notice ────────────────────────────────────────────
  //
  // Stored against the USER rather than in localStorage so waving the banner
  // away on the phone also clears it on the laptop. That matters more than
  // usual here: the banner is about being on several devices, and making
  // someone dismiss it once per device would be a small joke at their expense.
  const dismiss = String(body?.dismiss || "").trim();
  if (dismiss) {
    const user = await db.user.findUnique({
      where: { id: member.userId },
      select: { uiState: true },
    });
    const current = Array.isArray(user?.uiState?.dismissedNotices)
      ? user.uiState.dismissedNotices
      : [];
    if (current.includes(dismiss)) {
      return NextResponse.json({ dismissedNotices: current });
    }
    // Newest last, oldest trimmed. Notice keys carry a timestamp, so this list
    // grows forever otherwise — and a key old enough to fall off is one whose
    // notice can no longer be raised again.
    const dismissedNotices = [...current, dismiss].slice(-50);
    await db.user.update({
      where: { id: member.userId },
      data: { uiState: { ...(user?.uiState || {}), dismissedNotices } },
    });
    return NextResponse.json({ dismissedNotices });
  }

  const tour = String(body?.tour || "").trim();
  if (!tour) return NextResponse.json({ error: "Missing tour" }, { status: 400 });

  // seen:false RESETS a tour — removes it from the seen list so the walkthrough
  // plays again next time its page loads. That's how "Replay the tour" in the
  // Help Center works; default (seen omitted/true) marks it seen as before.
  const markSeen = body?.seen !== false;

  const user = await db.user.findUnique({
    where: { id: member.userId },
    select: { uiState: true },
  });
  const current = Array.isArray(user?.uiState?.seenTours)
    ? user.uiState.seenTours
    : [];

  if (markSeen && current.includes(tour)) {
    return NextResponse.json({ seenTours: current });
  }
  if (!markSeen && !current.includes(tour)) {
    return NextResponse.json({ seenTours: current });
  }

  const seenTours = markSeen
    ? [...current, tour]
    : current.filter((k) => k !== tour);
  await db.user.update({
    where: { id: member.userId },
    data: { uiState: { ...(user?.uiState || {}), seenTours } },
  });
  return NextResponse.json({ seenTours });
}
