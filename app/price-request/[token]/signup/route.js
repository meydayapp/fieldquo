// app/price-request/[token]/signup/route.js
//
// "Create your free account" from a price request (the email's link, and the
// page's button): leave the way-back cookie — so a signup that outlives its
// tab still lands on the request, and the welcome questions open with what
// the GC holds about this sub (app/welcome/[step]/page.js) — then open
// /signup with the email prefilled and the request as `next`.
//
// A GET that sets a cookie and redirects, nothing more: no row is written
// here, and an invalid token goes to the plain signup page rather than
// carrying anything along.
import { NextResponse } from "next/server";
import { isRequestTokenShape, priceRequestPath, PRICE_REQUEST_COOKIE, PRICE_REQUEST_COOKIE_MAX_AGE } from "@/lib/subRequests/model";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const origin = new URL(request.url).origin;
  if (!isRequestTokenShape(token)) return NextResponse.redirect(`${origin}/signup`);
  const next = priceRequestPath(token);
  const res = NextResponse.redirect(`${origin}/signup?next=${encodeURIComponent(next)}&rfq=${encodeURIComponent(token)}`);
  res.cookies.set(PRICE_REQUEST_COOKIE, token, { maxAge: PRICE_REQUEST_COOKIE_MAX_AGE, path: "/", sameSite: "lax" });
  return res;
}
