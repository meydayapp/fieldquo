// app/api/public/price-request/[token]/decline/route.js
//
// "Not this one" from the sub, with an optional reason the GC reads on their
// panel. Writes this token's own recipient row and nothing else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { parseDeclineInput } from "@/lib/subRequests/model";
import { declineRequest, RequestError } from "@/lib/subRequests/server";

export async function POST(request, { params }) {
  const limited = rateLimit(request, "price-request-write", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { token } = await params;
  const body = await request.json().catch(() => null);
  try {
    await declineRequest(db, { token: String(token || ""), reason: parseDeclineInput(body).reason });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[price-request decline]", err);
    return NextResponse.json({ error: "Couldn't record that. Please try again." }, { status: 500 });
  }
}
