// app/api/meta/history/route.js
//
// "Fetch older" — the Facebook / Instagram history walk, by hand — and the
// progress line the two settings cards draw beside it.
//
//   GET   how far each walk has got: per Messenger / Instagram channel and
//         per lead form — status, counts, how far back, last run, Meta's
//         refusal if any. A read.
//   POST  { scope: "messages" | "leads" } — start the walk, or restart a
//         finished one from the top (idempotent: every write underneath is
//         keyed on Meta's own id, so a re-walk duplicates nothing), then run
//         one chunk right away behind the response. The messaging-import and
//         meta-leads crons carry it on from there. See
//         lib/meta/historyBackfill.js for everything else.
//
// ══ Who ════════════════════════════════════════════════════════════════════
//
// The billing admin, the same rung as the two cards it sits on (Settings ›
// Meta Ads lead forms, and the Facebook & Instagram card) and as their own
// routes. The READ is open to an impersonation session — "why didn't my old
// Facebook messages come in" is what a support session opens for — and
// memberOrRefusal plus middleware refuse every non-GET under impersonation,
// so the platform console can never start a walk into a tenant
// (non-negotiable #3).
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse, after } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { backfillState, ensureBackfills, continueBackfills } from "@/lib/meta/historyBackfill";

const SCOPES = Object.freeze({ messages: ["messenger", "instagram"], leads: ["lead_form"] });

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  return NextResponse.json(await backfillState(member.companyId));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const limited = rateLimit(request, "meta-history", {
    limit: 4,
    windowMs: 60 * 1000,
    message: "That is already fetching. Give it a moment.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const scope = typeof body?.scope === "string" ? body.scope : "";
  if (!SCOPES[scope]) {
    return NextResponse.json({ error: "`scope` must be \"messages\" or \"leads\"." }, { status: 400 });
  }

  const started = await ensureBackfills({ companyId: member.companyId, scope, requestedById: member.userId || null, restart: true });
  if (started.kind !== "ok") {
    const error =
      started.kind === "demo"
        ? "This is the sample company, so there is no Facebook history to fetch."
        : scope === "leads"
          ? "Turn on at least one lead form first — history is fetched for the forms you import from."
          : "Connect your Facebook Page (with messaging allowed) first.";
    return NextResponse.json({ error, code: started.kind }, { status: 409 });
  }

  // One chunk now, behind the response — the person sees the walk move
  // without waiting for the next cron tick. Bounded well inside maxDuration.
  after(() => continueBackfills({ companyId: member.companyId, kinds: SCOPES[scope], budgetMs: 40000, maxRows: 5 }).catch(() => null));

  return NextResponse.json({ started: started.rows.length, ...(await backfillState(member.companyId)) });
}
