// app/api/verify-email/route.js
//
// POST { token } — confirm an email address from the link in the email, and
// say WHOSE address it was and who is signed in on this browser.
//
// ── Why this exists beside Better Auth's own /api/auth/verify-email ─────────
//
// Better Auth's endpoint confirms and redirects to a bare /verify-email: no
// address, no token. The page then had only the browser's session to go on,
// and on 2026-09-25 the owner opened his link while signed in as a different
// test account — the page could not say which address had just been
// confirmed, and its one button led into the OTHER account's company. So the
// link now lands on the page with its token (lib/authLinks.js verifyPageLink)
// and the page asks here. Better Auth still does the confirming —
// auth.api.verifyEmail below, the same endpoint — this route only adds the
// two facts the page must be able to say out loud.
//
// ── What this route will never do ──────────────────────────────────────────
//
// Sign anybody in. autoSignInAfterVerification stays off (lib/auth.js), the
// call below carries no headers so Better Auth sees no session to amend, and a
// change-of-address token — the one kind Better Auth answers by CREATING a
// session — is refused before Better Auth ever sees it (readVerifyToken's
// "change_email"). The browser's existing session is read, never written.
//
// A POST, not a GET, so a mail scanner that pre-fetches links does not confirm
// an address on the reader's behalf — the page confirms when it is opened —
// and so the read-only impersonation gate in middleware.js refuses it during
// a support session, as it refuses every other write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { readVerifyToken, verifyOutcome } from "@/lib/authLinks";

// A person clicks this once or twice. The tokens are HS256 JWTs, so this is
// not guarding a guessable secret — it is keeping a stuck page or a script
// from turning one link into a stream of database reads.
const LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

export async function POST(request) {
  const limited = rateLimit(request, "verify-email-link", LIMIT);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";

  const [{ secret }, session] = await Promise.all([
    auth.$context,
    auth.api.getSession({ headers: request.headers }).catch(() => null),
  ]);
  const sessionShape = session?.user?.id ? { userId: session.user.id, email: session.user.email } : null;

  const read = await readVerifyToken(token, secret);
  let user = null;
  if (read.email) {
    user = await db.user
      .findFirst({
        where: { email: { equals: read.email, mode: "insensitive" } },
        select: { id: true, email: true, emailVerified: true },
      })
      .catch(() => null);
  }

  const wasVerified = Boolean(user?.emailVerified);
  let verifyFailed = false;
  if (user && read.state === "valid" && !wasVerified) {
    try {
      // No headers: the confirmation is about the token's address, and must
      // not be able to reach the browser's session in either direction.
      await auth.api.verifyEmail({ query: { token } });
    } catch (err) {
      verifyFailed = true;
      console.error("[verify-email] Better Auth refused a token we had verified:", err?.body?.code || err?.message || err);
    }
  }

  const outcome = verifyOutcome({ tokenState: read.state, user, wasVerified, verifyFailed, session: sessionShape });
  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
