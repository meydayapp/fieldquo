// app/api/public/price-request/[token]/prefill/route.js
//
// /signup?rfq=<token> opens with the email the GC holds for this sub, and
// says so when that address already has a FieldQuo login (log in instead of
// a second account) — the same two fields the signup resume link returns
// (prefill.email / prefill.accountExists). Nothing else: the company name,
// contact name, phone and trade are offered on the welcome questions, read
// server-side from the way-back cookie (app/welcome/[step]/page.js), and only
// what the GC entered about THIS sub (lib/subRequests/model.js signupPrefill).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { prefillForToken } from "@/lib/subRequests/server";

export async function GET(request, { params }) {
  const limited = rateLimit(request, "price-request-read", { limit: 60, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { token } = await params;
  const prefill = await prefillForToken(db, String(token || ""));
  if (!prefill) return NextResponse.json({ error: "This request link isn't valid." }, { status: 404 });
  const email = prefill.email || "";
  const accountExists = email
    ? Boolean(await db.user.findFirst({ where: { email }, select: { id: true } }).catch(() => null))
    : false;
  return NextResponse.json({ prefill: { email, accountExists } });
}
