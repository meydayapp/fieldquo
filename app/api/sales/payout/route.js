// app/api/sales/payout/route.js
//
// How a rep gets paid — the read and the write.
//
// ══ Why this route had to exist ═══════════════════════════════════════════
//
// SalesRep has carried `engagement`, `accruesPaidLeave`, `payoutMethod`,
// `payoutHandle` and `payoutConfirmedAt` since the compensation work, and
// lib/sales/payoutDetails.js has carried the vocabulary and the readiness
// check. Nothing in app/ read or wrote a single one of them. Written and never
// read — AGENTS.md failure class 1 — so a rep who closed a company had no way
// to say where the money should go, and the platform had no way to find out
// except by asking in a chat window.
//
// ══ What a rep may set, and what they may not ═════════════════════════════
//
// A rep sets the DESTINATION: the method and the handle. That is theirs, it is
// about their own bank account, and nobody else should be typing it.
//
// A rep may NOT set `engagement`. Freelancer versus employee is an employment
// classification with tax and leave consequences on FieldQuo's side, and a
// worker self-selecting it is not how that decision is made anywhere. It is
// set by a platform admin and returned here read-only, so the rep can SEE what
// they are on and query it if it is wrong — which is the part that was
// impossible before.
//
// `accruesPaidLeave` is likewise never written here, and never derived from
// the engagement on the way out: the schema comment says it is stored rather
// than computed precisely so that an arrangement which departs from the
// default is recordable. Deriving it for display would quietly overwrite that
// on screen.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { savePayoutDestination } from "@/lib/sales/payoutWrite";
import {
  ENGAGEMENTS,
  PAYOUT_METHODS,
  isPayoutMethod,
  payoutMethod,
  payoutReadiness,
  payoutAgeDays,
} from "@/lib/sales/payoutDetails";

const SELECT = {
  id: true,
  engagement: true,
  accruesPaidLeave: true,
  payoutMethod: true,
  payoutHandle: true,
  payoutConfirmedAt: true,
};

/** The shape both verbs answer with, so the screen never has two readings. */
function view(rep) {
  const readiness = payoutReadiness(rep);
  return {
    engagement: rep.engagement || null,
    accruesPaidLeave: Boolean(rep.accruesPaidLeave),
    payoutMethod: rep.payoutMethod || null,
    payoutHandle: rep.payoutHandle || null,
    confirmedAt: rep.payoutConfirmedAt ? rep.payoutConfirmedAt.toISOString() : null,
    // How stale the confirmation is. A bank account confirmed two years ago is
    // not the same claim as one confirmed last week, and the screen says so
    // rather than showing a tick either way.
    confirmedDaysAgo: payoutAgeDays(rep.payoutConfirmedAt),
    ready: readiness.ready,
    problems: readiness.problems,
    // The vocabulary travels with the answer so the form cannot drift from the
    // validator that will judge it.
    methods: PAYOUT_METHODS,
    engagements: ENGAGEMENTS,
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const row = await db.salesRep.findUnique({ where: { id: rep.id }, select: SELECT });
  if (!row) return NextResponse.json({ error: "No such rep." }, { status: 404 });
  return NextResponse.json(view(row));
}

export async function PUT(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const method = String(body?.payoutMethod ?? "").trim();
  const handle = String(body?.payoutHandle ?? "").trim();

  if (!isPayoutMethod(method)) {
    return NextResponse.json(
      {
        error: "Choose one of the payout methods.",
        allowed: PAYOUT_METHODS.map((m) => m.key),
      },
      { status: 400 },
    );
  }
  // A method with no destination reads as configured on every screen that
  // checks only the method — payoutReadiness calls that out, and refusing it
  // here is what stops it being written in the first place.
  if (!handle) {
    const m = payoutMethod(method);
    return NextResponse.json(
      { error: `Add the ${m?.handleLabel?.toLowerCase() || "destination"}.` },
      { status: 400 },
    );
  }
  if (handle.length > 300) {
    return NextResponse.json({ error: "That is longer than any account detail needs to be." }, { status: 400 });
  }

  // Written through lib/sales/payoutWrite.js rather than here.
  //
  // `salesRep` is on REP_FORBIDDEN_WRITES and check-sales-auth enforces that
  // against the real route files — this route writing the row directly turned
  // that check red, correctly. The rule is right and the answer was not to
  // weaken it: the write moved behind one function that touches a closed,
  // asserted set of columns and audits every change, exactly the way
  // stampLastSeen() already handles the one other exempt column.
  //
  // engagement and accruesPaidLeave are not in that set. See the header.
  const row = await savePayoutDestination({ salesRepId: rep.id, method, handle });

  return NextResponse.json(view(row));
}
