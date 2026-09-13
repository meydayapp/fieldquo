// lib/platform/webhookHealth.js
//
// Has a Stripe event ever reached this deployment, and when was the last one?
//
// ── The "never" the owner needed to see ─────────────────────────────────────
//
// On 2026-09-13, six hours of production logs held zero POSTs to either Stripe
// webhook route. Nothing in the product said so: a webhook that is not
// registered, or registered against another URL, produces no error anywhere —
// only rows that quietly stop matching Stripe. The owner found it by cancelling
// his own subscription and watching the row stay "active".
//
// So each webhook route stamps the last event it VERIFIED (after the signature
// check, so a probe cannot write it), and the platform dashboard reads the two
// stamps back. "Billing: never — no event has reached this deployment" is the
// sentence this file exists to be able to print.
//
// Two endpoints, two stamps: FieldQuo's own billing (STRIPE_BILLING_WEBHOOK_SECRET,
// app/api/platform/billing/webhook) and Connect (STRIPE_CONNECT_WEBHOOK_SECRET,
// app/api/stripe/webhook). They are registered separately in Stripe and fail
// separately.
import { db } from "@/lib/db";

export const WEBHOOK_ENDPOINTS = Object.freeze(["billing", "connect"]);

export const webhookStampKey = (endpoint) => `stripe_webhook_last.${endpoint}`;

/**
 * Record that a verified event arrived. Never throws: a stamp that fails must
 * not turn a good delivery into a 500 that Stripe retries.
 */
export async function stampWebhookReceived(endpoint, event) {
  if (!WEBHOOK_ENDPOINTS.includes(endpoint)) return;
  const value = {
    at: new Date().toISOString(),
    eventId: event?.id || null,
    type: event?.type || null,
  };
  try {
    await db.platformSetting.upsert({
      where: { key: webhookStampKey(endpoint) },
      update: { value },
      create: { key: webhookStampKey(endpoint), value },
    });
  } catch (err) {
    console.error(`[webhookHealth] could not stamp ${endpoint}:`, err?.message);
  }
}

/**
 * The last verified event per endpoint, or null where none has ever arrived.
 *
 * @returns {Promise<{ billing: {at,eventId,type}|null, connect: {at,eventId,type}|null }>}
 */
export async function stripeWebhookHealth() {
  const rows = await db.platformSetting.findMany({
    where: { key: { in: WEBHOOK_ENDPOINTS.map(webhookStampKey) } },
  });
  const out = {};
  for (const endpoint of WEBHOOK_ENDPOINTS) {
    const row = rows.find((r) => r.key === webhookStampKey(endpoint));
    const v = row?.value;
    out[endpoint] = v && typeof v === "object" && v.at ? { at: v.at, eventId: v.eventId || null, type: v.type || null } : null;
  }
  return out;
}
