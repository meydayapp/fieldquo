// app/api/sales/auth/invite/route.js
//
// Accepting a sales-rep invitation: GET checks the link is still good, POST
// sets the password and signs them in.
//
// Unauthenticated on purpose, and named in middleware.js's SALES_AUTH_PREFIX
// passthrough — whoever is clicking an invite link has no account yet, so
// requiring a session here would close the only door in.
//
// ══ The token is the credential, so it is handled like one ════════════════
//
//   · Only its SHA-256 hash is ever stored (lib/sales/invite.js explains why
//     SHA-256 here and bcrypt on the password two fields along).
//   · The lookup is by hash, so a partial or guessed token matches nothing
//     rather than matching the nearest row.
//   · inviteState() is re-evaluated on the FRESHLY READ row inside POST, not
//     carried over from the GET the browser made a moment earlier. That is
//     lib/migrations/state.js's canWrite() discipline: an invitation revoked
//     between the page loading and the button being pressed must be refused,
//     and the only way to know is to look again.
//   · Accepting CLEARS the hash and the expiry in the same update that writes
//     the password. Single-use is enforced by the row, not by the reader — a
//     link left in a mailbox is otherwise a standing password reset for an
//     account somebody else now holds.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  SALES_COOKIE,
  SALES_SESSION_MAX_AGE,
  signSalesToken,
} from "@/lib/sales/auth";
import {
  MIN_PASSWORD_LENGTH,
  hashInviteToken,
  inviteState,
} from "@/lib/sales/invite";

// One sentence per refusal, so the accept screen can say what is actually
// wrong instead of "invalid link". Which one a visitor sees is decided by the
// row, never by anything they sent.
const REASONS = {
  unknown:
    "This invitation link isn't valid. Ask a FieldQuo superadmin to send a new one.",
  accepted:
    "This invitation has already been used. Sign in with the password you set, or ask for a new invitation if you've forgotten it.",
  expired:
    "This invitation has expired. Ask a FieldQuo superadmin to send a new one.",
  inactive:
    "This sales account isn't active. Ask a FieldQuo superadmin about it.",
};

async function findByToken(token) {
  if (!token) return null;
  return db.salesRep.findUnique({
    where: { inviteTokenHash: hashInviteToken(token) },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
      inviteExpiresAt: true,
    },
  });
}

export async function GET(request) {
  // Next 16: searchParams on the URL object, not a synchronous prop.
  const token = new URL(request.url).searchParams.get("token");
  const rep = await findByToken(token);
  const state = inviteState(rep);

  if (!state.ok) {
    return NextResponse.json(
      { error: REASONS[state.reason] || REASONS.unknown },
      { status: 400 },
    );
  }

  // The name and email are shown on the accept screen so the invitee can tell
  // they were invited as themselves. Nothing else about the account is
  // returned — this endpoint answers to anyone holding the link.
  return NextResponse.json({ name: rep.name, email: rep.email });
}

export async function POST(request) {
  const { token, password } = await request.json().catch(() => ({}));

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters — this account can see every company you've brought in.`,
      },
      { status: 400 },
    );
  }

  const rep = await findByToken(token);
  const state = inviteState(rep);
  if (!state.ok) {
    return NextResponse.json(
      { error: REASONS[state.reason] || REASONS.unknown },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  // The `where` re-states acceptedAt: null rather than trusting the check
  // above. Two requests arriving together would both pass inviteState() and
  // both write; the second one updates zero rows here instead. Same
  // "a check can be walked through, a constraint cannot" reasoning
  // lib/voice/credits.js gives for its unique index.
  const updated = await db.salesRep.updateMany({
    where: { id: rep.id, acceptedAt: null },
    data: {
      passwordHash,
      acceptedAt: now,
      startedAt: now,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: REASONS.accepted }, { status: 409 });
  }

  const sessionToken = await signSalesToken(rep.id);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SALES_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SALES_SESSION_MAX_AGE,
    path: "/",
  });
  return response;
}
