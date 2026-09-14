// app/api/platform/webhook-health/route.js
//
// Has a Stripe event ever reached this deployment — and are the two event
// destinations in Stripe configured so that one CAN?
//
// Same reasoning as email-health, ai-health and voice-health next door: a
// dependency that is invisible from inside any single account has to be
// visible from outside all of them. A Stripe webhook that is unregistered,
// pointed at another URL or signed with a rotated secret delivers nothing and
// errors nowhere — on 2026-09-13 six hours of production logs held zero
// webhook POSTs, and the only symptom was a cancelled subscription whose row
// still said "active". The stamps are written by the two webhook routes
// themselves after signature verification.
//
// The stamps say WHETHER events arrive. `destinations` says WHY they might
// not: the live billing destination was created on 2026-09-12 with nine events
// none of which a subscription produces, and nothing compared its list to the
// code's until lib/platform/stripeDestinations.js. GET serves the cached audit
// (ten minutes — the dashboard must not call Stripe on every load); POST is
// the "Re-check now" button and asks Stripe again. Neither files an error row
// — that is the billing-sync cron's job, once a day per destination.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { stripeWebhookHealth } from "@/lib/platform/webhookHealth";
import { auditDestinations } from "@/lib/platform/stripeDestinations";

async function respond(request, { force }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [health, destinations] = await Promise.all([
    stripeWebhookHealth(),
    auditDestinations({ force, flag: false }),
  ]);
  return NextResponse.json({
    ...health,
    // Said in one word so the dashboard does not have to reason about two
    // nulls: "never" is the state that matters.
    healthy: Boolean(health.billing && health.connect),
    destinations,
  });
}

export async function GET(request) {
  return respond(request, { force: false });
}

export async function POST(request) {
  return respond(request, { force: true });
}
