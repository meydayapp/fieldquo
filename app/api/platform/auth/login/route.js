// app/api/platform/auth/login/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

export async function POST(request) {
  // The superadmin door. Same throttle as the sales login, for the same
  // reason; and the body parse guarded, so a malformed login attempt is a
  // 400 and not a bodyless 500 (the class the public intakes were swept for).
  const limited = rateLimit(request, "platform-login", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  }

  const admin = await db.platformAdmin.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin || !admin.active) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await new SignJWT({ adminId: admin.id, role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h") // shorter-lived than company sessions — this is a sensitive account
    .setIssuedAt()
    .sign(PLATFORM_SECRET);

  const response = NextResponse.json({ success: true });

  response.cookies.set("platform-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return response;
}
