// app/api/survey/[token]/route.js
//
// Public, token-only, no session — the satisfaction survey's other half. See
// lib/reviews/satisfaction.js for the token shape and
// docs/CUSTOMER-SATISFACTION.md for why this exists.
//
// Same GET-reads/POST-mutates split as app/api/unsubscribe/[token]/route.js,
// for the identical reason: email link-scanners (Outlook Safe Links,
// corporate proxies, some antivirus) pre-fetch every href in a delivered
// message with a plain GET. If GET recorded a score, every scanned inbox
// would silently cast a "3" (or whatever the first link happened to be)
// before a human ever opened the email. GET only reads and renders; the page
// (app/survey/[token]/SurveyForm.js) makes the client press its own Send
// button before anything is written.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { safeUrl } from "@/lib/email/emailTheme";
import { parseScore, cleanComment } from "@/lib/reviews/satisfaction";

async function loadByToken(token) {
  if (!token || typeof token !== "string") return null;
  return db.satisfactionResponse.findUnique({
    where: { token },
    select: {
      id: true,
      language: true,
      score: true,
      comment: true,
      respondedAt: true,
      company: { select: { name: true, brandColor: true, logoUrl: true } },
    },
  });
}

// What the page needs to render itself in the company's colours, and nothing
// else — no jobId, no clientId, no companyId. A leaked/guessed token gets a
// name, a logo and a theme, not a route into anyone's records.
function publicShape(row) {
  const theme = documentTheme(row.company || {});
  // NOT theme.accentFill/accentOn directly. That raw pair is exactly what
  // fillPair() exists to correct — a mid-tone brand colour (mid grey, olive,
  // mid blue) can land around 4.3:1 against BOTH black and white, so no
  // choice of foreground fixes it and the fill itself has to move. Sending
  // the client the ALREADY-CORRECTED pair means the selected-score button
  // clears 4.5:1 whatever the company picked, the same guarantee the review
  // email's own button gets from the same function.
  const selected = fillPair(theme);
  return {
    companyName: row.company?.name || "",
    // documentTheme() carries no logoUrl (it's a colour palette only — see
    // lib/documents/theme.js); safeUrl() here is the same guard
    // lib/email/emailTheme.js's resolveTheme() applies before a logo reaches
    // an <img src>, blocking a javascript:/data: value a company row could
    // somehow hold.
    logoUrl: safeUrl(row.company?.logoUrl) || null,
    theme: {
      selectedBg: selected.bg,
      selectedFg: selected.fg,
      ink: theme.ink,
      inkMuted: theme.inkMuted,
      paper: theme.paper,
      page: theme.page,
      border: theme.border,
    },
    language: row.language,
    alreadyResponded: row.respondedAt !== null,
    score: row.score,
    comment: row.comment,
  };
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;
  const row = await loadByToken(token);
  if (!row) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  return NextResponse.json(publicShape(row));
}

export async function POST(request, { params }) {
  const { token } = await params;
  const row = await loadByToken(token);
  if (!row) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  // Already answered: a no-op, not an error. A reused token (a double-tap, a
  // client re-opening the same email a week later) should feel like "yes, we
  // got it", not fail — and the FIRST answer is the one that stands, the same
  // "idempotent claims don't move a timestamp that's already true" rule as
  // Job.reviewRequestedAt and applyUnsubscribe().
  if (row.respondedAt !== null) {
    return NextResponse.json({ ok: true, alreadyResponded: true, ...publicShape(row) });
  }

  const body = await request.json().catch(() => ({}));
  const score = parseScore(body.score);
  if (score === null) {
    // Deliberately no partial-credit path: a score outside 1–5 or not a
    // whole number is refused rather than clamped or rounded. See
    // lib/reviews/satisfaction.js's parseScore for why "guess what they
    // meant" is the wrong answer here.
    return NextResponse.json(
      { error: "Pick a number from 1 to 5 before sending." },
      { status: 400 },
    );
  }
  const comment = cleanComment(body.comment);

  // A conditional update, not a plain one — same claim pattern as
  // Job.reviewRequestedAt in app/api/cron/review-requests/route.js. Two
  // concurrent submits (a double-tap, a client's browser retrying a slow
  // request) must not let the second one silently overwrite the first
  // person's actual answer; `respondedAt: null` in the WHERE makes that
  // structurally impossible rather than merely unlikely.
  const claim = await db.satisfactionResponse.updateMany({
    where: { id: row.id, respondedAt: null },
    data: { score, comment, respondedAt: new Date() },
  });

  if (claim.count === 0) {
    const current = await loadByToken(token);
    return NextResponse.json({ ok: true, alreadyResponded: true, ...publicShape(current || row) });
  }

  const updated = await loadByToken(token);
  return NextResponse.json({ ok: true, alreadyResponded: false, ...publicShape(updated) });
}
