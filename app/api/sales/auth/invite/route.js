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
//   · Accepting also writes SalesRep.language, in that same update, when the
//     body carries a supported code. The accept screen asks (its header says
//     why), and app/sales/layout.js reads the column on the next request.
//     An absent key leaves the column alone; an unsupported value is read the
//     way lib/sales/repLanguage.js reads the column itself — as no statement,
//     stored as nothing — rather than refusing the whole activation over a
//     field the picker cannot produce a bad value for. The account is the
//     point of this request; the language has two more places to be set.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
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
import { repLanguageOrNull } from "@/lib/sales/repLanguage";
import { ensureRepDemo, ensureRepDemoLogin } from "@/lib/sales/repDemo";
import { materialiseDemoCheckIn } from "@/lib/sales/checkin/materialise";

// One sentence per refusal, so the accept screen can say what is actually
// wrong instead of "invalid link". Which one a visitor sees is decided by the
// row, never by anything they sent.
//
// ══ And a CODE beside each sentence, for the same reason ═══════════════════
//
// This is the first FieldQuo screen a new sales hire ever sees, and it was the
// one place in the portal with no translation at all: four distinct refusals,
// each of which tells somebody a different thing to do next, all English
// regardless of the language they were hired in.
//
// The sentences stay exactly as they are — they go into an `error` body, which
// a script or a log reads with no reader whose language could be consulted,
// and they are the fallback when a catalogue is missing a key. What is added
// is `code`, and the ACCEPT SCREEN maps code → catalogue entry. Deliberately
// four codes and not one generic "invalid": the whole reason this map exists
// is that "ask for a new invitation", "sign in with the password you set" and
// "ask a superadmin about your account" are three different instructions, and
// collapsing them into one translated sentence would give back exactly what
// the map was built to provide.
const REASON_CODES = {
  unknown: "invite_unknown",
  accepted: "invite_accepted",
  expired: "invite_expired",
  inactive: "invite_inactive",
};

// The code → catalogue-key map lives in lib/sales/authRefusals.js, not here: a
// route module may only export its HTTP methods and the segment config, and
// the accept SCREEN needs the same map. One table, two readers.

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
      {
        error: REASONS[state.reason] || REASONS.unknown,
        code: REASON_CODES[state.reason] || REASON_CODES.unknown,
      },
      { status: 400 },
    );
  }

  // The name and email are shown on the accept screen so the invitee can tell
  // they were invited as themselves. Nothing else about the account is
  // returned — this endpoint answers to anyone holding the link.
  return NextResponse.json({ name: rep.name, email: rep.email });
}

export async function POST(request) {
  // An invite token is a credential too — see the login route for why the
  // throttle is here. Same budget.
  const limited = rateLimit(request, "sales-invite", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const { token, password } = body;

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters — this account can see every company you've brought in.`,
        code: "invite_weak_password",
        // The minimum travels as a value, because it is one. The sentence
        // around it is the catalogue's, and gluing a translated stem to an
        // English number is how a rule ends up stated in two languages.
        minLength: MIN_PASSWORD_LENGTH,
      },
      { status: 400 },
    );
  }

  const rep = await findByToken(token);
  const state = inviteState(rep);
  if (!state.ok) {
    return NextResponse.json(
      {
        error: REASONS[state.reason] || REASONS.unknown,
        code: REASON_CODES[state.reason] || REASON_CODES.unknown,
      },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  // Only when the body says something: `"language" in body` keeps an old
  // client that never sent the field from writing null over nothing, and
  // repLanguageOrNull turns anything unsupported into null — no statement.
  const language = "language" in body ? repLanguageOrNull(body.language) : undefined;

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
      // Omitted entirely when nothing was said, written (possibly as null)
      // when something was. Prisma skips an undefined key.
      ...(language === undefined ? {} : { language }),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: REASONS.accepted, code: REASON_CODES.accepted },
      { status: 409 },
    );
  }

  // ── Their demo, ready before they open the tab ──────────────────────────
  //
  // Seeded now, after the response, so the accept is not held for the thirty
  // inserts a fixture takes. The password is the one they just chose: the
  // demo login (demo-<code>@fieldquo.com) is minted with it, so the manual can
  // say "your demo sign-in is that address with your portal password" and be
  // right on day one. Both are idempotent and both fail soft — /sales/demo's
  // GET seeds the company if this did not, and its page offers to set the
  // password if the login is missing. Nothing about the account itself
  // depends on this block.
  after(async () => {
    try {
      const row = await db.salesRep.findUnique({
        where: { id: rep.id },
        select: { id: true, name: true, code: true, demoCompanyId: true },
      });
      if (!row) return;
      await ensureRepDemo({ rep: row });
      const fresh = await db.salesRep.findUnique({
        where: { id: rep.id },
        select: { id: true, name: true, code: true, demoCompanyId: true },
      });
      await ensureRepDemoLogin({ rep: fresh, password });
      await materialiseDemoCheckIn({ salesRepId: rep.id });
    } catch (err) {
      console.error("[sales invite] demo not seeded on accept:", err?.message);
    }
  });

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
