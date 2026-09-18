// app/api/demo/rep/[repCode]/route.js
//
// Public: a rep's own demo page. No session — the person is a contractor
// reading an email on their phone, or somebody the rep handed the link to.
//
// GET reads (the slots, the prefill, the language) and writes nothing, so a
// mail scanner's prefetch of the link in the intro email books nothing —
// the same split app/api/intro-link/[token]/route.js keeps. POST books.
// Both are rate-limited per connection: the endpoint is public and every
// booking emails a stranger and pushes a rep.
//
// Prices and tenant data are never involved; the rep's calendar is
// FieldQuo's own. A bad token and an unknown code answer alike (404, "not
// valid") — which check failed is a hint, per lib/dataDeletion/
// signedRequest.js — with expiry the one distinguished case.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { bookRepDemo, repDemoPageState } from "@/lib/sales/demoBooking/book";

function refusal(reason, extra = {}) {
  if (reason === "expired") return NextResponse.json({ error: "This link has expired.", reason, ...extra }, { status: 410 });
  if (reason === "unknown_rep" || reason === "invalid") return NextResponse.json({ error: "This link isn't valid.", reason: "invalid", ...extra }, { status: 404 });
  if (reason === "already") return NextResponse.json({ error: "Already booked.", reason, ...extra }, { status: 409 });
  if (reason === "taken") return NextResponse.json({ error: "That time was just taken.", reason, ...extra }, { status: 409 });
  return NextResponse.json({ error: "That didn't go through.", reason, ...extra }, { status: 400 });
}

export async function GET(request, { params }) {
  const limited = rateLimit(request, "rep-demo-read", { limit: 60 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { repCode } = await params;
  const { searchParams } = new URL(request.url);
  const state = await repDemoPageState({ repCode, token: searchParams.get("t") || null, lang: searchParams.get("lang") || null });
  if (!state.ok) return refusal(state.reason);
  return NextResponse.json(state);
}

export async function POST(request, { params }) {
  const limited = rateLimit(request, "rep-demo-book", { limit: 10 });
  if (limited) return limited;
  const { repCode } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await bookRepDemo({
    repCode,
    token: typeof body?.token === "string" && body.token ? body.token : null,
    slot: body?.slot,
    name: body?.name,
    email: body?.email,
    phone: body?.phone,
    business: body?.business,
    lang: body?.lang,
  });
  if (!result.ok) return refusal(result.reason, result.at ? { at: result.at } : {});
  return NextResponse.json(result, { status: 201 });
}
