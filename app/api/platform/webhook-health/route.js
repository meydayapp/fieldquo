// app/api/platform/webhook-health/route.js
//
// Has a Stripe event ever reached this deployment?
//
// Same reasoning as email-health, ai-health and voice-health next door: a
// dependency that is invisible from inside any single account has to be
// visible from outside all of them. A Stripe webhook that is unregistered,
// pointed at another URL or signed with a rotated secret delivers nothing and
// errors nowhere — on 2026-09-13 six hours of production logs held zero
// webhook POSTs, and the only symptom was a cancelled subscription whose row
// still said "active". Read-only; the stamps are written by the two webhook
// routes themselves after signature verification.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { stripeWebhookHealth } from "@/lib/platform/webhookHealth";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const health = await stripeWebhookHealth();
  return NextResponse.json({
    ...health,
    // Said in one word so the dashboard does not have to reason about two
    // nulls: "never" is the state that matters.
    healthy: Boolean(health.billing && health.connect),
  });
}
