// middleware.js
//
// One change: /api/platform/billing/* is carved out of the platform-token
// (JWT) gate. Those four routes — webhook, checkout, portal, cancel — are
// NOT platform-staff routes even though they live under the /api/platform
// prefix; they're hit by Stripe itself (webhook, which has no cookies at
// all — its own stripe.webhooks.constructEvent signature check IS its auth)
// or by a logged-in company user via their better-auth session cookie
// (checkout/portal/cancel — not a platform-token). Every one of those was
// getting a blanket 401 from this middleware before the route handler, or
// Stripe's signature check, ever ran. That's why webhook events never
// created a Subscription row, and why "Manage billing" 401'd in the browser.
//
// Everything else in this file — the /platform page gate, the /app
// better-auth gate — is unchanged.
import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { jwtVerify } from "jose";

const PLATFORM_SECRET = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET,
);

// Company-facing routes that happen to live under /api/platform/ but are
// authenticated a different way (Stripe signature, or better-auth session
// inside the route itself) — not the platform-staff JWT.
const PLATFORM_BILLING_PASSTHROUGH = [
  "/api/platform/billing/webhook",
  "/api/platform/billing/checkout",
  "/api/platform/billing/portal",
  "/api/platform/billing/cancel",
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Platform API routes (JSON 401, not a redirect — these are fetch() calls) ──
  if (pathname.startsWith("/api/platform")) {
    if (pathname.startsWith("/api/platform/auth")) {
      return NextResponse.next();
    }

    if (PLATFORM_BILLING_PASSTHROUGH.includes(pathname)) {
      return NextResponse.next();
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
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app",
    "/app/:path*",
    "/platform",
    "/platform/:path*",
    "/api/platform/:path*",
  ],
};
