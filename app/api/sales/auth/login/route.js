// app/api/sales/auth/login/route.js
//
// The sales portal's sign-in. Structurally the platform console's login route
// (app/api/platform/auth/login), with two differences that are the whole point:
// a different cookie, and a mandatory scope claim in the token. See
// lib/sales/auth.js for why one secret with two verified scopes beats a second
// environment variable nobody sets.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  SALES_COOKIE,
  SALES_SESSION_MAX_AGE,
  signSalesToken,
} from "@/lib/sales/auth";
import { canAuthenticate } from "@/lib/sales/invite";

export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  }

  const rep = await db.salesRep.findUnique({
    where: { email: String(email).toLowerCase().trim() },
    select: {
      id: true,
      passwordHash: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
    },
  });

  // One message for every refusal — no such rep, wrong password, invitation
  // never accepted, deactivated, left the company. Telling them apart tells a
  // stranger which FieldQuo staff email addresses are real, and tells a
  // deactivated rep that their password still works.
  const invalid = () =>
    NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  if (!canAuthenticate(rep)) return invalid();

  const valid = await bcrypt.compare(password, rep.passwordHash);
  if (!valid) return invalid();

  const token = await signSalesToken(rep.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SALES_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SALES_SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}
