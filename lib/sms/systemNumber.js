// lib/sms/systemNumber.js
//
// Which number FieldQuo texts FROM when a company has none of its own.
//
// ══ The bug this closes ════════════════════════════════════════════════════
//
// This was `process.env.TWILIO_PHONE_NUMBER`, read directly at the point of
// send. Production's value was +17372212163 — a number the Twilio account has
// never owned. Every send that fell back to it failed at the carrier with error
// 21606, and nothing in the product could tell: `twilioConfigured()` returned
// true, because an account SID and an API key were both present. Naming a
// number in configuration is not owning it, and only the provider can settle
// which is which.
//
// So the resolution order is: a row FieldQuo actually bought, then the env var.
// The env var stays because removing it would break a deployment mid-flight and
// because a self-hoster must still be able to point at a number by hand — but
// it is now the fallback, not the source of truth.
//
// ══ Why it's cached ════════════════════════════════════════════════════════
//
// Every outbound text would otherwise open with a database read for a value
// that changes when a superadmin buys a number, which is approximately never.
// Sixty seconds is short enough that a purchase takes effect while the operator
// is still looking at the screen, and long enough that a busy send loop doesn't
// query per message. `forgetSystemNumber()` makes it immediate for the one
// caller that knows it changed.

import { db } from "@/lib/db";

const TTL_MS = 60 * 1000;

let cached = null;
let cachedAt = 0;

/** Drop the cache. Called by the purchase and release paths, which know. */
export function forgetSystemNumber() {
  cached = null;
  cachedAt = 0;
}

/**
 * The platform's outbound "From", or null if there genuinely isn't one.
 *
 * Null rather than a thrown error or an empty string: "we have no number" is a
 * real, reportable state — it is the state production is in right now — and the
 * callers that can say something useful about it need to be able to tell it
 * apart from a failure to look.
 */
export async function systemSmsNumber() {
  const now = Date.now();
  if (cached !== null && now - cachedAt < TTL_MS) return cached;

  let row = null;
  try {
    row = await db.platformSmsNumber.findFirst({
      where: { purpose: "system", active: true },
      orderBy: { createdAt: "asc" },
      select: { e164: true },
    });
  } catch (err) {
    // A database blip must not take outbound texting down when the env var can
    // still answer. Deliberately NOT cached — the next send tries the db again.
    console.error("[sms] system number lookup failed:", err?.message);
    return process.env.TWILIO_PHONE_NUMBER || null;
  }

  cached = row?.e164 || process.env.TWILIO_PHONE_NUMBER || null;
  cachedAt = now;
  return cached;
}

/**
 * The same question, answered from configuration alone, synchronously.
 *
 * For the handful of callers that only need to know whether SMS is set up AT
 * ALL and cannot await — and for nothing else. It cannot see a bought number,
 * so a deployment with a row and no env var reads as "no number" here. That is
 * why every caller that actually SENDS uses the async one above.
 */
export function systemSmsNumberFromEnv() {
  return process.env.TWILIO_PHONE_NUMBER || null;
}
