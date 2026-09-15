// app/api/influencer/payout/route.js
//
// Where an influencer's commission goes — the read and the write, in the
// shape /api/sales/payout gives a rep so PayoutDestinationForm renders both.
//
// Two differences from the rep route, both on purpose:
//
//   · The methods offered are payoutMethodsFor("influencer") — PayPal,
//     Interac, Wise, bank transfer. No Upwork: an influencer has no Upwork
//     contract with FieldQuo. The PUT refuses anything outside that list with
//     isPayoutMethodFor, so a hidden option is a removed one.
//   · The row written is the company's OWN ledger, resolved by the company
//     gate from Company.influencerRepId on this request. The body names no
//     rep. The write itself goes through savePayoutDestination, the same
//     audited function the rep route uses.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { influencerOrRefusal } from "@/lib/influencers/gate";
import { INFLUENCER_KIND } from "@/lib/influencers";
import { savePayoutDestination } from "@/lib/sales/payoutWrite";
import {
  ENGAGEMENTS,
  isPayoutMethodFor,
  payoutMethod,
  payoutMethodsFor,
  payoutReadiness,
  payoutAgeDays,
} from "@/lib/sales/payoutDetails";

const METHODS = payoutMethodsFor(INFLUENCER_KIND);

function view(rep) {
  const readiness = payoutReadiness(rep);
  return {
    engagement: rep.engagement || null,
    accruesPaidLeave: Boolean(rep.accruesPaidLeave),
    payoutMethod: rep.payoutMethod || null,
    payoutHandle: rep.payoutHandle || null,
    confirmedAt: rep.payoutConfirmedAt ? new Date(rep.payoutConfirmedAt).toISOString() : null,
    confirmedDaysAgo: payoutAgeDays(rep.payoutConfirmedAt),
    ready: readiness.ready,
    problems: readiness.problems.filter((p) => p.code !== "no_engagement"),
    adminProblems: readiness.problems.filter((p) => p.code === "no_engagement"),
    methods: METHODS,
    engagements: ENGAGEMENTS,
  };
}

export async function GET(request) {
  const { ledger, response } = await influencerOrRefusal(request);
  if (response) return response;
  return NextResponse.json(view(ledger));
}

export async function PUT(request) {
  const { ledger, response } = await influencerOrRefusal(request);
  if (response) return response;

  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const method = String(body?.payoutMethod ?? "").trim();
  const handle = String(body?.payoutHandle ?? "").trim();

  if (!isPayoutMethodFor(INFLUENCER_KIND, method)) {
    return NextResponse.json(
      { error: "Choose one of the payout methods.", allowed: METHODS.map((m) => m.key) },
      { status: 400 },
    );
  }
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

  const row = await savePayoutDestination({ salesRepId: ledger.id, method, handle, client: db });
  return NextResponse.json(view(row));
}
