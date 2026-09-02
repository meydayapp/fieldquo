// app/api/sales/auth/logout/route.js
//
// Clears the rep's cookie. Mirrors app/api/platform/auth/logout — and, like it,
// takes no session to work: signing out must succeed even when the token has
// already expired, or a rep with a stale cookie could never get rid of it.
import { NextResponse } from "next/server";
import { SALES_COOKIE } from "@/lib/sales/auth";

export async function POST() {
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
