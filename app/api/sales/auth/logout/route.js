// app/api/sales/auth/logout/route.js
//
// Clears the rep's cookie. Mirrors app/api/platform/auth/logout — and, like it,
// takes no session to work: signing out must succeed even when the token has
// already expired, or a rep with a stale cookie could never get rid of it.
import { NextResponse } from "next/server";
import { SALES_COOKIE, getCurrentSalesRep } from "@/lib/sales/auth";
import { setRepState } from "@/lib/sales/calls/store";
import { STATE_OFFLINE } from "@/lib/sales/calls/agentState";

export async function POST(request) {
  // Signing out IS going offline (owner, 2026-09-16: "when they log out yes
  // it should say offline"). Best-effort, before the cookie goes: a board
  // that still said Available for fifteen minutes after the rep left was
  // reporting a session, not a person.
  try {
    const claims = await getCurrentSalesRep(request);
    if (claims?.salesRepId) await setRepState({ salesRepId: claims.salesRepId, to: STATE_OFFLINE, now: new Date() });
  } catch {
    // The sign-out must not fail because the board could not be told.
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(SALES_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
