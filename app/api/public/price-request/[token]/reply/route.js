// app/api/public/price-request/[token]/reply/route.js
//
// "Reply with a price without an account": the sub's price, a note and an
// optional file (a PDF of their quote), onto THIS token's own pending reply
// and nowhere else (lib/subRequests/server.js submitReply).
//
// The amount is the one figure in the whole flow a browser sends, and it is
// the sub stating their OWN price — what a quote is. It moves nothing on its
// own: the GC sees it as a reply waiting for them and must press "Add to
// compare" (POST /api/price-requests/recipients/[id]/confirm, which reads no
// body) before it is anything but a message. Once confirmed, this route
// refuses — the figure is the GC's snapshot then.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { parseReplyInput } from "@/lib/subRequests/model";
import { loadRecipientByToken, submitReply, RequestError } from "@/lib/subRequests/server";

const REFUSALS = {
  bad_body: "We couldn't read that reply.",
  bad_amount: "Enter your price as a number, like 4250 or 4250.50.",
  bad_file: "That file didn't upload correctly. Attach it again.",
};

export async function POST(request, { params }) {
  const limited = rateLimit(request, "price-request-write", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { token } = await params;
  const r = await loadRecipientByToken(db, String(token || ""));
  if (!r) return NextResponse.json({ error: "This request link isn't valid." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = parseReplyInput(body, { gcCompanyId: r.request.companyId, cloudName: process.env.CLOUDINARY_CLOUD_NAME });
  if (!parsed.ok) return NextResponse.json({ error: REFUSALS[parsed.error] || REFUSALS.bad_body }, { status: 400 });
  try {
    await submitReply(db, { token: r.token, input: parsed.data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[price-request reply]", err);
    return NextResponse.json({ error: "Couldn't send your price. Please try again." }, { status: 500 });
  }
}
