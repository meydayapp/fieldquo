// app/api/signup/lead/route.js
//
// The public signup page keeping what it has typed — and reading it back on
// a resume link.
//
// ══ POST: a capture ═══════════════════════════════════════════════════════
//
// `{ email, step, firstName, lastName, companyName, phone, city, province,
// country, language, trades[], salesCode, referralCode, utm, visitorId,
// referrer }` — the first step of the funnel as it stands, posted by
// app/signup/page.js CAPTURE_DEBOUNCE_MS after the last change and at once
// on a step change (lib/signup/leadCapture.js). A JSON body, never a query
// string: it carries a person's name and number.
//
// 204, always — created, updated, refused as not-yet-worth-a-row, refused as
// locked (a company completed it; a rep already holds it), or malformed.
// Answering differently for an address that has a row would turn a public
// endpoint into "has this email started a signup" — the same reason
// app/api/signup/progress answers 204 for a token it has never seen. A
// malformed body is a 400 only because the shape is public and a client
// should learn it is wrong; it still says nothing about any row.
//
// Rate-limited per IP the way signup/progress is: a capture is cheap to fire
// and this must not be a way to fill a table. Nothing here is read by the
// session — a stranger writes their own row and can read nothing back.
//
// ══ GET ?token=: the resume prefill ════════════════════════════════════════
//
// The rep's intro email to an abandoned signup links to
// /signup?…&resume=<token>. The page asks here with the token and gets back
// exactly what the person typed themselves — name, company, number, place,
// trades, language — so the form opens filled in. The token is 32 random
// bytes, unique per row; the email address is not in the URL. An unknown
// token is a 404 with nothing else, and there is no listing.
//
// ══ GET ?mine=1: the same prefill, for a signed-in person ══════════════════
//
// The owner signed back in on 2026-09-21 from a fresh session, was shown the
// business step with every box empty, and a banner promising nothing was
// lost. The row that knew he had reached Plan was keyed on his email, and
// the page only ever asked for it by token. A session proves the address
// better than a token does, so the read is allowed on it: the address comes
// from Better Auth's session, never from the query string. A signed-out
// caller gets a 404 that says nothing — same as an unknown token.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { isResumeToken } from "@/lib/signup/leads";
import { captureSignupLead, signupLeadForResume } from "@/lib/signup/salesFloor";
import { decideResumeRoute, loginFromUser } from "@/lib/signup/resumeRoute";

/** A step's worth of typing is a handful of posts; a hundred in ten minutes is not a person. */
const CAPTURE_LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };
const RESUME_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

export async function POST(request) {
  const limited = rateLimit(request, "signup-lead", CAPTURE_LIMIT);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.email !== "string" || typeof body.step !== "string") {
    return NextResponse.json({ error: "email and step are required" }, { status: 400 });
  }

  // The session, when there is one, so the row can carry the Better Auth
  // user id the address signed in as — the capture right after the account
  // step is created, and every one after it, arrives on that session. Read
  // from the cookie, never from the body; captureSignupLead only attaches it
  // when the session's address is the one being captured.
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const who = session?.user?.id ? { userId: session.user.id, email: session.user.email || null } : null;
  await captureSignupLead({ client: db, body, now: new Date(), session: who }).catch((err) => {
    console.error("[signup/lead] capture failed:", err?.message || err);
  });
  return new NextResponse(null, { status: 204 });
}

export async function GET(request) {
  const limited = rateLimit(request, "signup-lead-resume", RESUME_LIMIT);
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const token = params.get("token") || "";
  let email = null;
  let userId = null;
  if (!token && params.get("mine") === "1") {
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
    email = session?.user?.email || null;
    userId = session?.user?.id || null;
    if (!email && !userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (!isResumeToken(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prefill = await signupLeadForResume({ client: db, token: token || undefined, email, userId }).catch((err) => {
    console.error("[signup/lead] resume read failed:", err?.message || err);
    return null;
  });
  if (!prefill) {
    // A login with no company and no row: the page will capture one on its
    // next debounce (it seeds the form from the session for exactly this),
    // and /platform/signups shows it as "signed in, no company yet" from
    // then on. Logged by user id — no address, no name — so the gap between
    // "has a login" and "has a row" is visible in the function logs.
    if (userId) console.info("[signup/lead] signed-in return with no SignupLead", { userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!token) return NextResponse.json({ prefill }, { headers: { "Cache-Control": "no-store" } });

  // ── A token: is there a login behind this address, and who is here? ────
  const [userRow, session] = await Promise.all([
    db.user
      .findFirst({
        where: { email: { equals: prefill.email, mode: "insensitive" } },
        select: {
          id: true,
          emailVerified: true,
          memberships: {
            where: { active: true },
            // Both columns hasFinishedSignup needs, selected — it throws on
            // either being absent rather than reading a customer as unfinished.
            select: { company: { select: { isDemo: true, trialEndsAt: true, subscription: { select: { id: true } } } } },
          },
        },
      })
      .catch((err) => {
        console.error("[signup/lead] login read failed:", err?.message || err);
        return undefined;
      }),
    auth.api.getSession({ headers: request.headers }).catch(() => null),
  ]);
  // A failed read is NOT "no login": answering "signup" would put the account
  // step back in front of somebody who has one — the exact bug. No route, and
  // the page falls back to what it did before.
  if (userRow === undefined) return NextResponse.json({ prefill }, { headers: { "Cache-Control": "no-store" } });

  const login = loginFromUser(userRow);
  const route = decideResumeRoute({
    prefill,
    login,
    session: session?.user?.id ? { userId: session.user.id, email: session.user.email || null } : null,
    token,
  });
  // The row's own guess, corrected by the fact: the account step's "sign in
  // instead" line reads this too.
  const corrected = login && !prefill.accountExists ? { ...prefill, accountExists: true } : prefill;
  return NextResponse.json({ prefill: corrected, route }, { headers: { "Cache-Control": "no-store" } });
}
