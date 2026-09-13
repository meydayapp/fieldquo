// app/api/signup/progress/route.js
//
// The public signup page reporting where it is — to the rep who texted the
// link, and to nobody else.
//
// ══ What this accepts ═════════════════════════════════════════════════════
//
// `{ token, step }`, where `token` is the `&link=` value on a texted signup
// link (lib/sales/signupProgress.js) and `step` is one of the two the
// browser is allowed to report: "opened" (the page loaded) and "company"
// (the business form was submitted). Every later step is the server's own
// fact, stamped by app/api/companies and lib/platform/stripeBilling.js, so
// a stranger holding a token cannot draw "Card entered" on a rep's screen.
//
// ══ What this answers ═════════════════════════════════════════════════════
//
// 204, always — a known token, an unknown one, a step already stamped, a
// table that is not there. The page fires this as a beacon and never reads
// it; answering differently for a known token would turn the endpoint into
// an oracle for guessing tokens. Malformed input is a 400 only because the
// shape is public and a client should learn it is wrong; it still says
// nothing about any row. No session, no cookie, no personal data: a token
// and a word.
//
// Rate-limited per IP at the door the way app/api/help/feedback is: a
// beacon is cheap to fire and this must not be a way to fill a log.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { BROWSER_REPORTABLE_STEPS, isLinkToken, stampSignupStepByToken } from "@/lib/sales/signupProgress";

/** Two steps per page load; a hundred a window is a lot of page loads from one address. */
const PROGRESS_LIMIT = { limit: 100, windowMs: 10 * 60 * 1000 };

export async function POST(request) {
  const limited = rateLimit(request, "signup-progress", PROGRESS_LIMIT);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const step = typeof body?.step === "string" ? body.step.trim() : "";
  if (!isLinkToken(token) || !BROWSER_REPORTABLE_STEPS.includes(step)) {
    return NextResponse.json({ error: "token and step are required" }, { status: 400 });
  }

  // Whatever the write matched — one row, none, a table that is not there
  // — the answer is the same. See the header.
  await stampSignupStepByToken({ client: db, token, step, now: new Date() }).catch((err) => {
    console.error("[signup/progress] stamp failed:", err?.message || err);
  });
  return new NextResponse(null, { status: 204 });
}
