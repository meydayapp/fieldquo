// app/api/ui-state/route.js
//
// Per-user UI state — currently just which first-visit tours the person has
// seen. Server-side so a dismissed tour stays dismissed across devices, not
// only in the browser that dismissed it.
//
// Scoped to the logged-in USER, not the company: two people at the same
// company each get the walkthrough once. getCurrentMember gives us the userId.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: member.userId },
    select: { uiState: true },
  });
  const seenTours = Array.isArray(user?.uiState?.seenTours)
    ? user.uiState.seenTours
    : [];
  return NextResponse.json({ seenTours });
}

// Mark one tour as seen. Idempotent: re-marking a tour already seen is a no-op,
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
