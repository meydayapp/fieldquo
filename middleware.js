// middleware.js
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { jwtVerify } from "jose";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Platform API routes (JSON 401, not a redirect — these are fetch() calls) ──
  if (pathname.startsWith("/api/platform")) {
    if (pathname.startsWith("/api/platform/auth")) {
      return NextResponse.next(); // login endpoint can't require a token to reach it
    }

    const platformToken = request.cookies.get("platform-token")?.value;

    if (!platformToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(platformToken, PLATFORM_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Platform pages (FieldQuo's own back office) ─────────────────────────
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") {
      return NextResponse.next();
    }

    const platformToken = request.cookies.get("platform-token")?.value;

    if (!platformToken) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }

    try {
      await jwtVerify(platformToken, PLATFORM_SECRET);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(
        new URL("/platform/login", request.url),
      );
      response.cookies.set("platform-token", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Company app (Better Auth) ───────────────────────────────────────────
  if (pathname.startsWith("/app")) {
    if (pathname.startsWith("/app/login")) {
      return NextResponse.next();
    }

    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/app/login", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/platform/:path*", "/api/platform/:path*"],
};
