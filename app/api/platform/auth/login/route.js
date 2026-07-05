// app/api/platform/auth/login/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

export async function POST(request) {
  const { email, password } = await request.json();

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
