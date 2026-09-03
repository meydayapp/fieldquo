// app/api/no-contact/[token]/route.js
//
// The unsubscribe half of the abandoned-signup recovery email.
//
// ══ Why this is not /api/unsubscribe/[token] ═══════════════════════════════
//
// That route is MarketingSubscriber — a TENANT's relationship with a
// homeowner, keyed by companyId. This is FieldQuo's own do-not-contact list
// (SalesSuppression), which binds FieldQuo rather than one of its customers.
// The two lists answer different questions for different senders, and a single
// route serving both would be one refactor away from a contractor's opt-out
// silencing FieldQuo's sales team, or the reverse.
//
// ══ Two methods, and GET does not mutate ═══════════════════════════════════
//
// The same split app/api/unsubscribe/[token]/route.js already wrote down, and
// for the same reason: Outlook Safe Links and corporate mail proxies pre-fetch
// every link in delivered mail with a plain GET. If GET opted somebody out,
// every scanned inbox would silently suppress itself before a human read the
// message — and this list is one nobody but a superadmin can lift.
//
// POST is also what RFC 8058's List-Unsubscribe-Post points a mailbox provider
// at, so a Gmail "Unsubscribe" chip reaches the mutation with no page render.
//
// ══ Every channel, not just email ══════════════════════════════════════════
//
// The link says "Stop hearing from FieldQuo" and that is what it does. Closing
// only the email channel would leave FieldQuo free to phone somebody who just
// pressed a button meaning "stop" — and this feature's whole point is to put
// these people on a call list. Over-suppression is the safe failure here; see
// lib/sales/suppression.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSuppression, suppress } from "@/lib/sales/suppression";
import { ALL_CHANNELS } from "@/lib/sales/suppressionRules";
import { nudgeRecipient } from "@/lib/signup/abandoned";

/**
 * findFirst rather than findUnique: Company.signupNudgeOptOutToken carries an
 * index but no unique constraint — see the schema comment for why that was left
 * for a deliberate migration. The token is 32 CSPRNG bytes, so "two rows match"
 * is not a state this can reach.
 */
async function companyForToken(token) {
  if (typeof token !== "string" || token.length < 20) return null;
  return db.company.findFirst({
    where: { signupNudgeOptOutToken: token },
    select: { id: true, name: true, email: true },
  });
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const company = await companyForToken(token);
  const address = nudgeRecipient(company?.email);
  if (!company || !address) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  const verdict = await checkSuppression(db, { channel: "email", email: address });

  return NextResponse.json({
    email: address,
    alreadySuppressed: verdict.suppressed,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  const company = await companyForToken(token);
  const address = nudgeRecipient(company?.email);
  if (!company || !address) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }

  // suppress() is idempotent on (kind, value) and unions the channel list, so
  // a second click — or a mail provider's one-click POST arriving after the
  // human already pressed the button — re-evidences the same row rather than
  // creating a second one a lookup might find and a screen might not.
  const result = await suppress(db, {
    kind: "email",
    value: address,
    channels: ALL_CHANNELS,
    // "form" is the closed vocabulary's word for a web form (see
    // SUPPRESSION_SOURCES). Not "reply" — nobody wrote to us — and not
    // "manual", which would misdescribe the one record most likely to be
    // asked about later.
    source: "form",
    reason:
      "Unsubscribed from the FieldQuo signup-recovery email (incomplete signup).",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: address });
}
